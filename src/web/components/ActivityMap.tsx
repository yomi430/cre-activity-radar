import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { Market } from '../../shared/contracts';
import 'leaflet/dist/leaflet.css';

type Basemap = 'street' | 'satellite' | 'none';
type MapFeatureProperties = { h3Cell: string; current: number; label: string };
const layers: Record<Exclude<Basemap, 'none'>, { url: string; attribution: string }> = {
  street: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
  satellite: { url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community' }
};

const low = [255, 247, 188], middle = [254, 178, 76], high = [189, 0, 38];
function blend(a: number[], b: number[], amount: number) { return a.map((value, index) => Math.round(value + (b[index]! - value) * amount)); }
function rgb(values: number[]) { return `rgb(${values.join(',')})`; }
function heatColor(current: number, maximum: number) {
  if (current <= 0) return '#eef2f2';
  // Square-root scaling keeps a large count from making one-record cells indistinguishable.
  const scaled = Math.sqrt(current / maximum);
  return rgb(scaled < .5 ? blend(low, middle, scaled * 2) : blend(middle, high, (scaled - .5) * 2));
}

export function ActivityMap({ geojson, market, selected, onSelect, comparisonAvailable = true }: { geojson: GeoJSON.FeatureCollection; market: Market; selected: string | null; onSelect: (cell: string) => void; comparisonAvailable?: boolean }) {
  const node = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), shapes = useRef<L.GeoJSON | null>(null), tiles = useRef<L.TileLayer | null>(null), fitted = useRef<string | null>(null);
  const [basemap, setBasemap] = useState<Basemap>('street'), [tileError, setTileError] = useState(false);
  const counts = useMemo(() => geojson.features.map(feature => (feature.properties as MapFeatureProperties).current), [geojson]);
  const maximum = Math.max(1, ...counts), minimumNonzero = counts.length ? Math.min(...counts.filter(count => count > 0)) : 0;
  const sameNonzeroCount = minimumNonzero > 0 && minimumNonzero === maximum;
  const boundsKey = `${market}:${geojson.features.map(feature => (feature.properties as MapFeatureProperties).h3Cell).join(',')}`;

  useEffect(() => { if (!node.current) return; map.current = L.map(node.current, { attributionControl: true }).setView(market === 'CHICAGO' ? [41.88, -87.63] : [40.72, -73.98], 10); return () => { map.current?.remove(); map.current = null; }; }, []);
  useEffect(() => { if (!map.current) return; tiles.current?.remove(); tiles.current = null; setTileError(false); if (basemap === 'none') return; const layer = L.tileLayer(layers[basemap].url, { attribution: layers[basemap].attribution, maxZoom: 19, crossOrigin: true }); layer.on('tileerror', () => setTileError(true)); layer.addTo(map.current); tiles.current = layer; }, [basemap]);
  useEffect(() => { if (!map.current) return; shapes.current?.remove(); shapes.current = L.geoJSON(geojson as GeoJSON.GeoJsonObject, { style: feature => { const p = feature?.properties as MapFeatureProperties, isSelected = p.h3Cell === selected; return { color: isSelected ? '#102a43' : '#51656a', weight: isSelected ? 3.5 : 1, dashArray: isSelected ? undefined : '2 1', fillColor: heatColor(p.current, maximum), fillOpacity: isSelected ? .94 : .78 }; }, onEachFeature: (feature, layer) => { const p = feature.properties as MapFeatureProperties; layer.bindTooltip(`${p.label}: ${p.current} current permit record${p.current === 1 ? '' : 's'}`); layer.on('click', () => onSelect(p.h3Cell)); } }).addTo(map.current); if (geojson.features.length && fitted.current !== boundsKey) { map.current.fitBounds(shapes.current.getBounds(), { padding: [18, 18], maxZoom: 13 }); fitted.current = boundsKey; } }, [boundsKey, geojson, maximum, onSelect, selected]);

  return <div className="map-wrap"><div className="heatmap-legend" aria-label="Current permit count heat map legend"><div><strong>Current permit records per H3 cell</strong><span>{comparisonAvailable ? 'Color shows current count; it does not show the change from the prior period.' : 'Comparison is unavailable, so color shows current recorded count only.'}</span></div><div className="legend-scale"><span>{minimumNonzero}</span><i aria-hidden="true" /><span>{maximum}</span></div><p>{sameNonzeroCount ? `Every displayed cell with activity has ${maximum} current record${maximum === 1 ? '' : 's'}, so the scale cannot show a count difference.` : 'Low → high current count'}<b>Selected cell: dark outline</b></p></div><fieldset className="basemap-controls"><legend>Basemap</legend>{([{ value: 'street', label: 'Street' }, { value: 'satellite', label: 'Satellite' }, { value: 'none', label: 'No basemap' }] as Array<{ value: Basemap; label: string }>).map(item => <label key={item.value}><input type="radio" name="basemap" value={item.value} checked={basemap === item.value} onChange={() => setBasemap(item.value)} /> {item.label}</label>)}</fieldset>{tileError && <p className="tile-error" role="status">Map tiles are unavailable. The H3 permit areas remain interactive.</p>}<div className="leaflet-map" ref={node} aria-label="Interactive permit activity map" /></div>;
}
