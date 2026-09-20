import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { latLngToCell } from 'h3-js';
import { canonicalAcrisBbl, legalAssociationIdentity, normalizedLegalAssociation } from './nyc-acris-audit-lib.mjs';

const fixture=(name,directory)=>JSON.parse(readFileSync(resolve(directory,name),'utf8'));
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):null;
const mapped=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=40.45&&lat<=40.95&&lng>=-74.3&&lng<=-73.65;
export function seedAcrisRows(db,{snapshotId='bundled-acris-fixture-v1',retrievedAt='2026-09-20T00:00:00.000Z',publisherUpdatedAt=null,master,legals,parcels,manifest={}}){
  db.exec(`CREATE TABLE IF NOT EXISTS acris_snapshots (snapshot_id TEXT PRIMARY KEY,retrieved_at TEXT NOT NULL,master_updated_at TEXT,legals_updated_at TEXT,pluto_updated_at TEXT,master_rows INTEGER NOT NULL,legal_rows INTEGER NOT NULL,pluto_rows INTEGER NOT NULL,complete INTEGER NOT NULL,manifest_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS acris_documents (document_id TEXT PRIMARY KEY,recorded_date TEXT NOT NULL,document_date TEXT,raw_json TEXT NOT NULL,snapshot_id TEXT NOT NULL); CREATE TABLE IF NOT EXISTS acris_legal_associations (association_id TEXT PRIMARY KEY,document_id TEXT NOT NULL,bbl TEXT,easement TEXT NOT NULL,partial_lot TEXT NOT NULL,air_rights TEXT NOT NULL,subterranean_rights TEXT NOT NULL,raw_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS acris_parcels (bbl TEXT PRIMARY KEY,lat REAL,lng REAL,h3_cell TEXT,raw_json TEXT NOT NULL,snapshot_id TEXT NOT NULL); CREATE TABLE IF NOT EXISTS acris_document_cells (document_id TEXT NOT NULL,h3_cell TEXT NOT NULL,precision TEXT NOT NULL,PRIMARY KEY(document_id,h3_cell)); CREATE TABLE IF NOT EXISTS acris_quality (snapshot_id TEXT NOT NULL,kind TEXT NOT NULL,value_json TEXT NOT NULL,PRIMARY KEY(snapshot_id,kind));`);
  db.exec('DELETE FROM acris_document_cells; DELETE FROM acris_legal_associations; DELETE FROM acris_documents; DELETE FROM acris_parcels; DELETE FROM acris_quality; DELETE FROM acris_snapshots;');
  const masters=new Map(),excluded={}; let duplicateMasterRows=0;
  for (const raw of master) {
    const type=String(raw.doc_type??'').trim();
    if(type!=='DEED'){excluded[type||'(missing)']=(excluded[type||'(missing)']??0)+1;continue;}
    const id=String(raw.document_id??'').trim(),recorded=day(raw.recorded_datetime);
    if(!id||!recorded)throw new Error('ACRIS fixture invalid exact DEED Master row.');
    const signature=['doc_type','recorded_datetime','document_date','document_amt','good_through_date']
      .map(key => String(raw[key] ?? '').trim())
      .join('\0');
    if(masters.has(id)){
      duplicateMasterRows++;
      if(masters.get(id).signature!==signature)throw new Error(`ACRIS Master duplicate ${id} disagrees on material event fields; activation refused.`);
      continue;
    }
    masters.set(id,{raw,recorded,signature});
  }
  db.prepare('INSERT INTO acris_snapshots VALUES(?,?,?,?,?,?,?,?,?,?)').run(snapshotId,retrievedAt,publisherUpdatedAt?.master??null,publisherUpdatedAt?.legals??null,publisherUpdatedAt?.pluto??null,master.length,legals.length,parcels.length,1,JSON.stringify(manifest));const insertDoc=db.prepare('INSERT INTO acris_documents VALUES(?,?,?,?,?)');for(const [id,item] of masters)insertDoc.run(id,item.recorded,day(item.raw.document_date),JSON.stringify(item.raw),snapshotId);
  const ids=new Set(masters.keys()),seen=new Set(),bbls=new Set();let duplicateLegalRows=0,invalidBblRows=0,associations=0;const insertLegal=db.prepare('INSERT INTO acris_legal_associations VALUES(?,?,?,?,?,?,?,?)');for(const raw of legals){const n=normalizedLegalAssociation(raw);if(!ids.has(n.documentId))continue;const identity=legalAssociationIdentity(raw);if(seen.has(identity)){duplicateLegalRows++;continue;}seen.add(identity);if(!n.bbl){invalidBblRows++;continue;}bbls.add(n.bbl);insertLegal.run(identity,n.documentId,n.bbl,n.easement,n.partialLot,n.airRights,n.subterraneanRights,JSON.stringify(raw));associations++;}
  const seenParcels=new Set();let nullCoordinateBbls=0;const insertParcel=db.prepare('INSERT INTO acris_parcels VALUES(?,?,?,?,?,?)');for(const raw of parcels){const bbl=typeof raw.bbl==='string'?raw.bbl.trim().replace(/\.0+$/,'').padStart(10,'0'):null;if(!bbl||!bbls.has(bbl)||seenParcels.has(bbl))continue;seenParcels.add(bbl);const lat=Number(raw.latitude),lng=Number(raw.longitude),valid=mapped(lat,lng);if(!valid)nullCoordinateBbls++;insertParcel.run(bbl,valid?lat:null,valid?lng:null,valid?latLngToCell(lat,lng,8):null,JSON.stringify(raw),snapshotId);}
  const unmatchedBbls=[...bbls].filter(bbl=>!seenParcels.has(bbl)).length;db.prepare("INSERT INTO acris_document_cells SELECT DISTINCT l.document_id,p.h3_cell,'PARCEL_CENTROID' FROM acris_legal_associations l JOIN acris_parcels p ON p.bbl=l.bbl WHERE p.h3_cell IS NOT NULL").run();const deedsWithoutLegals=(db.prepare('SELECT COUNT(*) AS n FROM acris_documents d WHERE NOT EXISTS(SELECT 1 FROM acris_legal_associations l WHERE l.document_id=d.document_id)').get()).n,placedDocumentCells=(db.prepare('SELECT COUNT(*) AS n FROM acris_document_cells').get()).n,multiBblDocuments=(db.prepare('SELECT COUNT(*) AS n FROM (SELECT document_id FROM acris_legal_associations GROUP BY document_id HAVING COUNT(DISTINCT bbl)>1)').get()).n;const result={snapshotId,acceptedDocuments:masters.size,duplicateMasterRows,excludedRawTypeCounts:excluded,legalRows:legals.length,acceptedAssociations:associations,duplicateLegalRows,invalidBblRows,deedsWithoutLegals,unmatchedBbls,nullCoordinateBbls,placedDocumentCells,multiBblDocuments};db.prepare('INSERT INTO acris_quality VALUES(?,?,?)').run(snapshotId,'result',JSON.stringify(result));return result;
}
export function seedAcrisFixture(db,directory=resolve('data/fixtures')){return seedAcrisRows(db,{master:fixture('acris-master.json',directory),legals:fixture('acris-legals.json',directory),parcels:fixture('acris-pluto.json',directory)});}
export function seedAcrisLiveSnapshot(db,snapshot){const rows=name=>readFileSync(resolve(snapshot.directory,snapshot.files[name].file),'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));return seedAcrisRows(db,{snapshotId:snapshot.snapshotId,retrievedAt:snapshot.retrievedAt,publisherUpdatedAt:Object.fromEntries(['master','legals','pluto'].map(name=>[name,snapshot.publisher?.[name]?.apiUpdatedAt??null])),master:rows('master'),legals:rows('legals'),parcels:rows('pluto'),manifest:snapshot});}
