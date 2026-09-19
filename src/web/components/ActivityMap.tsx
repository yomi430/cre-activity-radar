import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Market } from '../../shared/contracts';
import 'leaflet/dist/leaflet.css';

export function ActivityMap({ geojson, market, selected, onSelect }: { geojson: GeoJSON.FeatureCollection; market: Market; selected: string | null; onSelect: (cell: string) => void }) {
  const node = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null); const shapes = useRef<L.GeoJSON | null>(null); const fitted = useRef<Market | null>(null);
  useEffect(() => { if (!node.current) return; map.current = L.map(node.current, { attributionControl: false }).setView(market === 'CHICAGO' ? [41.88, -87.63] : [40.72, -73.98], 10); return () => { map.current?.remove(); }; }, []);
  useEffect(() => { if (!map.current) return; shapes.current?.remove(); const max = Math.max(1, ...geojson.features.map(feature => (feature.properties as { current: number }).current)); shapes.current = L.geoJSON(geojson as GeoJSON.GeoJsonObject, { style: f => { const p = f?.properties as { h3Cell: string; current: number }; const v = p.current / max; return { color: p.h3Cell === selected ? '#102a2a' : '#fff', weight: p.h3Cell === selected ? 3 : 1, fillColor: `rgb(${224 - Math.round(v * 170)},${242 - Math.round(v * 103)},${254 - Math.round(v * 55)})`, fillOpacity: .85 }; }, onEachFeature: (f, layer) => { const p = f.properties as { h3Cell: string; label: string; current: number }; layer.bindTooltip(`${p.label}: ${p.current} current permits`); layer.on('click', () => onSelect(p.h3Cell)); } }).addTo(map.current); if (geojson.features.length && fitted.current !== market) { map.current.fitBounds(shapes.current.getBounds(), { padding: [18, 18], maxZoom: 13 }); fitted.current = market; } }, [geojson, market, selected, onSelect]);
  return <div className="leaflet-map" ref={node} aria-label="Interactive permit activity map" />;
}
