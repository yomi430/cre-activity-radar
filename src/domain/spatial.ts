import { cellToBoundary, latLngToCell } from 'h3-js';
export function cellFor(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return latLngToCell(lat, lng, 8);
}
export function isMarketCoordinate(market: 'CHICAGO' | 'NYC', lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  return market === 'CHICAGO' ? lat >= 41.6 && lat <= 42.1 && lng >= -88 && lng <= -87.4 : lat >= 40.45 && lat <= 40.95 && lng >= -74.3 && lng <= -73.65;
}
export function polygonFor(cell: string): number[][][] {
  const ring = cellToBoundary(cell, true).map(([lng, lat]) => [lng, lat]);
  ring.push([...ring[0]!]);
  return [ring];
}
