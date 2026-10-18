import {audioDatabaseName} from './learning-profile.mjs?v=mail-20261018-4';

export function legacyPractice(){try{const value=JSON.parse(localStorage.getItem('bee-independent-v1')||'null');return value&&Array.isArray(value.history)?value:null;}catch{return null;}}

export function mergeLegacyPractice(current,legacy){
  const existing=new Set(current.history.map(s=>s.id));
  const added=legacy.history.filter(s=>s?.id&&!existing.has(s.id));
  const active=current.active||legacy.active||null;
  return {state:{...current,history:[...current.history,...added],active},ids:new Set([...added.map(s=>s.id),...(!current.active&&legacy.active?[legacy.active.id]:[])])};
}

function openDB(name){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('recordings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}

export async function importLegacyPractice(userId,current){
  const legacy=legacyPractice();if(!legacy)throw new Error('No previous unassigned practice was found.');
  const merged=mergeLegacyPractice(current,legacy),source=await openDB('bee-audio-v1');
  let records;
  try{records=await new Promise((resolve,reject)=>{const transaction=source.transaction('recordings'),store=transaction.objectStore('recordings'),keys=store.getAllKeys(),values=store.getAll();transaction.oncomplete=()=>resolve(keys.result.map((key,index)=>[key,values.result[index]]));transaction.onerror=()=>reject(transaction.error);});}finally{source.close();}
  const destination=await openDB(audioDatabaseName(userId));
  try{await new Promise((resolve,reject)=>{const transaction=destination.transaction('recordings','readwrite');for(const [key,value] of records)if(merged.ids.has(String(key).split(':')[0]))transaction.objectStore('recordings').put(value,key);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});}finally{destination.close();}
  merged.state.settings.legacyImported=true;
  return merged.state;
}
