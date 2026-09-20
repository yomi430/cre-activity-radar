import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const canonicalBbl = value => {
  const source = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d+)(?:\.0+)?$/.exec(source); if (!match) return null;
  try { const n = BigInt(match[1]); return n > 0n && n <= 9_999_999_999n ? n.toString().padStart(10, '0') : null; } catch { return null; }
};
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const classification = (bbl, parcel) => {
  if (!bbl) return { category:'UNKNOWN', provenance:'PLUTO_LANDUSE_DIRECT', confidence:'HIGH', reason:'NO_BBL', canonicalBbl:null, landuseRaw:null, bldgclassRaw:null };
  if (!parcel) return { category:'UNKNOWN', provenance:'PLUTO_LANDUSE_DIRECT', confidence:'HIGH', reason:'PLUTO_UNMATCHED', canonicalBbl:bbl, landuseRaw:null, bldgclassRaw:null };
  const landuse=text(parcel.landuse), bldgclass=text(parcel.bldgclass), categories={1:'RESIDENTIAL',2:'MULTIFAMILY',3:'MULTIFAMILY',4:'MIXED_USE',5:'LIKELY_COMMERCIAL',6:'LIKELY_COMMERCIAL'};
  return categories[landuse] ? { category:categories[landuse],provenance:'PLUTO_LANDUSE_DIRECT',confidence:'HIGH',reason:null,canonicalBbl:bbl,landuseRaw:landuse,bldgclassRaw:bldgclass } : { category:'UNKNOWN',provenance:'PLUTO_LANDUSE_DIRECT',confidence:'HIGH',reason:landuse?'UNMAPPED_LANDUSE':'MISSING_LANDUSE',canonicalBbl:bbl,landuseRaw:landuse,bldgclassRaw:bldgclass };
};

export function seedPropertyUseRows(db, { snapshotId, permitSnapshotSha256, retrievedAt, plutoRowsUpdatedAt = null, parcels, manifest = {}, reset = true }) {
  db.exec(`CREATE TABLE IF NOT EXISTS property_use_snapshots(snapshot_id TEXT PRIMARY KEY,permit_snapshot_sha256 TEXT NOT NULL,pluto_rows_updated_at TEXT,retrieved_at TEXT NOT NULL,manifest_json TEXT NOT NULL,complete INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS pluto_property_use_parcels(snapshot_id TEXT NOT NULL,bbl TEXT NOT NULL,landuse_raw TEXT,bldgclass_raw TEXT,unitsres_raw TEXT,unitstotal_raw TEXT,borough_raw TEXT,block_raw TEXT,lot_raw TEXT,latitude_raw TEXT,longitude_raw TEXT,raw_json TEXT NOT NULL,PRIMARY KEY(snapshot_id,bbl)); CREATE TABLE IF NOT EXISTS permit_property_use(permit_id TEXT NOT NULL,snapshot_id TEXT,canonical_bbl TEXT,category TEXT NOT NULL,provenance TEXT NOT NULL,confidence TEXT NOT NULL,reason TEXT,landuse_raw TEXT,bldgclass_raw TEXT,PRIMARY KEY(permit_id)); CREATE INDEX IF NOT EXISTS permit_property_use_category ON permit_property_use(category,permit_id);`);
  if (reset) db.exec('DELETE FROM permit_property_use; DELETE FROM pluto_property_use_parcels; DELETE FROM property_use_snapshots;');
  db.prepare('INSERT INTO property_use_snapshots VALUES(?,?,?,?,?,1)').run(snapshotId, permitSnapshotSha256, plutoRowsUpdatedAt, retrievedAt, JSON.stringify(manifest));
  const lookup = new Map(); const insertParcel=db.prepare('INSERT INTO pluto_property_use_parcels VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  for(const raw of parcels){const bbl=canonicalBbl(raw.bbl);if(!bbl||lookup.has(bbl))continue;lookup.set(bbl,raw);insertParcel.run(snapshotId,bbl,text(raw.landuse),text(raw.bldgclass),text(raw.unitsres),text(raw.unitstotal),text(raw.borough),text(raw.block),text(raw.lot),text(raw.latitude),text(raw.longitude),JSON.stringify(raw));}
  const insert=db.prepare('INSERT INTO permit_property_use VALUES(?,?,?,?,?,?,?,?,?)');
  const permits=db.prepare('SELECT id,market,raw_json FROM permits').all();
  for(const row of permits){ if(row.market==='CHICAGO'){insert.run(row.id,null,null,'UNKNOWN','CHICAGO_UNAVAILABLE','NONE','CHICAGO_PROPERTY_USE_UNAVAILABLE',null,null);continue;} const raw=JSON.parse(row.raw_json),bbl=canonicalBbl(raw.bbl),value=classification(bbl, bbl?lookup.get(bbl)??null:null); insert.run(row.id,snapshotId,value.canonicalBbl,value.category,value.provenance,value.confidence,value.reason,value.landuseRaw,value.bldgclassRaw); }
  return { snapshotId, parcels:lookup.size, permits:permits.length };
}
export function seedPropertyUseFixture(db, directory = resolve('data/fixtures')) { const file=resolve(directory,'nyc-property-use-pluto.json'), textValue=readFileSync(file,'utf8'), parcels=JSON.parse(textValue); return seedPropertyUseRows(db,{snapshotId:'bundled-nyc-property-use-fixture-v1',permitSnapshotSha256:createHash('sha256').update('bundled-public-retained-sample-v1').digest('hex'),retrievedAt:'2026-09-20T00:00:00.000Z',plutoRowsUpdatedAt:'2026-09-19T00:00:00.000Z',parcels,manifest:{mode:'fixture',source:'NYC PLUTO direct LandUse',file:'nyc-property-use-pluto.json'}}); }
