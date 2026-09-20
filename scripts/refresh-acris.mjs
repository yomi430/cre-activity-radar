import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { activateAcrisSnapshot, acrisLocalSnapshot, acrisPointerText, acrisPublisherMatchesSnapshot, acrisPublisherState, acrisStoredSnapshotForPublisher, fetchAcrisSnapshot, restoreAcrisPointer } from './acris-source.mjs';
import { activateStagedDatabase, discardStagedDatabase, stageDatabase } from './rebuild-database.mjs';

function prepare(snapshot) { return stageDatabase({ env: { ...process.env, RADAR_ACRIS_SNAPSHOT_DIR: snapshot.directory } }); }

/**
 * The raw pointer and SQLite database are committed as a small two-file unit:
 * seed+verify a private SQLite file, advance the checksum-verified pointer, then
 * swap the database. A failed swap restores the exact previous pointer; a failed
 * pointer write leaves the active database untouched.
 */
export async function refreshAcris({rawDirectory=resolve('data/raw'),getLocalSnapshot=()=>acrisLocalSnapshot(rawDirectory),getPublisherState=acrisPublisherState,getStagedSnapshot=publisher=>acrisStoredSnapshotForPublisher(rawDirectory,publisher),fetchSnapshot=options=>fetchAcrisSnapshot({rawDirectory,...options}),activateSnapshot=snapshot=>activateAcrisSnapshot(snapshot,rawDirectory),pointerText=()=>acrisPointerText(rawDirectory),restorePointer=text=>restoreAcrisPointer(text,rawDirectory),prepareDatabase=prepare,activateDatabase=activateStagedDatabase,discardDatabase=discardStagedDatabase,rebuildDatabase,log=console.log}={}) { log('STAGE CHECKING_LOCAL_SNAPSHOT');const snapshot=getLocalSnapshot();log(snapshot?`LOCAL_ACRIS_SNAPSHOT ${snapshot.snapshotId}`:'LOCAL_ACRIS_SNAPSHOT missing_or_checksum_invalid');log('STAGE CHECKING_PUBLISHER');const publisher=await getPublisherState();if(acrisPublisherMatchesSnapshot(publisher,snapshot)){log('OUTCOME UP_TO_DATE');return {outcome:'UP_TO_DATE',publisher,snapshot};}const reusable=getStagedSnapshot(publisher);let manifest;if(reusable){log(`STAGE REUSING_ACRIS_SNAPSHOT snapshot=${reusable.snapshotId}`);manifest=reusable;}else{log('STAGE FETCHING_ACRIS_SNAPSHOT');manifest=await fetchSnapshot({log});}if(!manifest?.complete)throw new Error('ACRIS extraction did not produce a complete snapshot.');log(`STAGE VALIDATED_ACRIS_SNAPSHOT snapshot=${manifest.snapshotId}`);log('STAGE REBUILDING_DATABASE');if(rebuildDatabase){rebuildDatabase(manifest);activateSnapshot(manifest);}else{const prepared=prepareDatabase(manifest),previousPointer=pointerText();try{activateSnapshot(manifest);try{activateDatabase(prepared);}catch(error){restorePointer(previousPointer);throw error;}}finally{discardDatabase(prepared);}}log('OUTCOME UPDATED');return {outcome:'UPDATED',publisher,manifest}; }
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await refreshAcris();
