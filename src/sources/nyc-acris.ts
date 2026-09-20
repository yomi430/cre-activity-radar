import { dateOnly } from '../domain/dates.js';
import { cellFor, isMarketCoordinate } from '../domain/spatial.js';
export function canonicalAcrisBbl(borough: unknown, block: unknown, lot: unknown): string | null {
  const parsed=(value:unknown,max:number)=>{const raw=typeof value==='number'&&Number.isSafeInteger(value)?String(value):typeof value==='string'?value.trim():'';return /^\d+$/.test(raw)&&Number(raw)<=max?Number(raw):null;}; const b=parsed(borough,9),bl=parsed(block,99999),l=parsed(lot,9999); return b&&b<=4&&bl!==null&&l!==null?`${b}${String(bl).padStart(5,'0')}${String(l).padStart(4,'0')}`:null;
}
export function normalizedLegalAssociation(row: Record<string,unknown>) { const flag=(key:string)=>String(row[key]??'').trim().toUpperCase(); return {documentId:String(row.document_id??'').trim(),bbl:canonicalAcrisBbl(row.borough,row.block,row.lot),easement:flag('easement'),partialLot:flag('partial_lot'),airRights:flag('air_rights'),subterraneanRights:flag('subterranean_rights')}; }
export function legalAssociationIdentity(row: Record<string,unknown>) { const n=normalizedLegalAssociation(row);return [n.documentId,n.bbl??'INVALID_BBL',n.easement,n.partialLot,n.airRights,n.subterraneanRights].join('|'); }
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;

export function normalizeAcrisMaster(raw: Record<string, unknown>) {
  const documentId = text(raw.document_id), recordedDate = dateOnly(raw.recorded_datetime);
  return documentId && recordedDate && text(raw.doc_type) === 'DEED'
    ? { documentId, recordedDate, documentDate: dateOnly(raw.document_date), raw }
    : { reason: !documentId ? 'missing_document_id' : !recordedDate ? 'invalid_recorded_datetime' : 'not_exact_deed' };
}
export function normalizeAcrisParcel(raw: Record<string, unknown>) {
  const bbl = typeof raw.bbl === 'string' ? raw.bbl.trim().replace(/\.0+$/, '').padStart(10, '0') : null;
  if (!bbl || !/^\d{10}$/.test(bbl)) return { reason: 'invalid_bbl' };
  const lat = number(raw.latitude), lng = number(raw.longitude);
  const mapped = isMarketCoordinate('NYC', lat, lng);
  return { bbl, lat: mapped ? lat : null, lng: mapped ? lng : null, h3Cell: mapped ? cellFor(lat, lng) : null, raw };
}
export function materialMasterSignature(raw: Record<string, unknown>) {
  // The source has no audited winner/version field. Identical material duplicates collapse;
  // otherwise activation must stop rather than arbitrarily selecting a correction.
  return ['doc_type', 'recorded_datetime', 'document_date', 'document_amt', 'good_through_date'].map(key => String(raw[key] ?? '').trim()).join('\u0000');
}
