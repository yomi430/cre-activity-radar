import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Market } from '../../shared/contracts';
import 'leaflet/dist/leaflet.css';

type Basemap = 'street' | 'satellite' | 'none';
const layers: Record<Exclude<Basemap, 'none'>, { url: string; attribution: string }> = {
  street: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
  satellite: { url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community' }
};

export function ActivityMap({ geojson, market, selected, onSelect }: { geojson: GeoJSON.FeatureCollection; market: Market; selected: string | null; onSelect: (cell: string) => void }) {
  const node = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), shapes = useRef<L.GeoJSON | null>(null), tiles = useRef<L.TileLayer | null>(null), fitted = useRef<Market | null>(null);
  const [basemap, setBasemap] = useState<Basemap>('street'), [tileError, setTileError] = useState(false);
  useEffect(() => { if (!node.current) return; map.current = L.map(node.current, { attributionControl: true }).setView(market === 'CHICAGO' ? [41.88, -87.63] : [40.72, -73.98], 10); return () => { map.current?.remove(); map.current = null; }; }, []);
  useEffect(() => { if (!map.current) return; tiles.current?.remove(); tiles.current = null; setTileError(false); if (basemap === 'none') return; const layer = L.tileLayer(layers[basemap].url, { attribution: layers[basemap].attribution, maxZoom: 19, crossOrigin: true }); layer.on('tileerror', () => setTileError(true)); layer.addTo(map.current); tiles.current = layer; }, [basemap]);
  useEffect(() => { if (!map.current) return; shapes.current?.remove(); const max = Math.max(1, ...geojson.features.map(feature => (feature.properties as { current: number }).current)); shapes.current = L.geoJSON(geojson as GeoJSON.GeoJsonObject, { style: feature => { const p = feature?.properties as { h3Cell: string; current: number }; const intensity = p.current / max; return { color: p.h3Cell === selected ? '#ffffff' : '#17353a', weight: p.h3Cell === selected ? 4 : 1.3, fillColor: `rgb(${29 - Math.round(intensity * 8)},${151 - Math.round(intensity * 54)},${136 - Math.round(intensity * 28)})`, fillOpacity: .72 }; }, onEachFeature: (feature, layer) => { const p = feature.properties as { h3Cell: string; label: string; current: number }; layer.bindTooltip(`${p.label}: ${p.current} current permits`); layer.on('click', () => onSelect(p.h3Cell)); } }).addTo(map.current); if (geojson.features.length && fitted.current !== market) { map.current.fitBounds(shapes.current.getBounds(), { padding: [18, 18], maxZoom: 13 }); fitted.current = market; } }, [geojson, market, selected, onSelect]);
  return <div className="map-wrap"><fieldset className="basemap-controls"><legend>Basemap</legend>{([{ value: 'street', label: 'Street' }, { value: 'satellite', label: 'Satellite' }, { value: 'none', label: 'No basemap' }] as Array<{ value: Basemap; label: string }>).map(item => <label key={item.value}><input type="radio" name="basemap" value={item.value} checked={basemap === item.value} onChange={() => setBasemap(item.value)} /> {item.label}</label>)}</fieldset>{tileError && <p className="tile-error" role="status">Map tiles are unavailable. The H3 permit areas remain interactive.</p>}<div className="leaflet-map" ref={node} aria-label="Interactive permit activity map" /></div>;
}
