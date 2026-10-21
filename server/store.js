import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {guardDraft} from './integrity.js';
import {distinctProgramPages,researchCoverage} from './research-quality.js';
const directory = process.env.TETRA_DATA_DIR||path.resolve(import.meta.dirname, '../.data/sessions');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const deletedDirectory=path.join(directory,'.deleted');
mkdirSync(deletedDirectory,{recursive:true,mode:0o700});
const isDeleted=id=>existsSync(path.join(deletedDirectory,id));
export const deletedStudentIds=()=>readdirSync(deletedDirectory).filter(validId);
const cache = new Map(), timers = new Map();
export const validId = id => typeof id === 'string' && /^[a-zA-Z0-9-]{12,80}$/.test(id);
export function sessionFor(id) {
  if (!validId(id)) throw new Error('A valid workspace ID is required.');
  if(isDeleted(id))throw Object.assign(new Error('This student workspace was deleted.'),{statusCode:410});
  if (cache.has(id)) return cache.get(id);
  const filename = path.join(directory, `${id}.json`);
  let data = {};
  if (existsSync(filename)) {
    try { data = JSON.parse(readFileSync(filename, 'utf8')); } catch { throw new Error('This saved workspace could not be read. Start a new journey or restore its backup.'); }
  }
  const session = { profile: {}, documents: [], opportunities: [], messages: [], events: [], draft: '', run: null, facts: [], createdAt:Date.now(),profileRevision:0,...data, id, evidence: new Map(data.evidence || []), chatBusy: false };
  if (session.run?.status === 'running') { session.run.status = 'interrupted'; session.run.message = 'The server restarted. Resume to continue from saved findings.'; }
  cache.set(id, session); return session;
}
export function saveSession(session, immediate = false) {
  clearTimeout(timers.get(session.id));
  if(isDeleted(session.id)){timers.delete(session.id);return;}
  const save = () => {
    if(isDeleted(session.id)){timers.delete(session.id);return;}
    session.updatedAt=Date.now();
    const filename = path.join(directory, `${session.id}.json`), temporary = `${filename}.tmp`;
    const { chatBusy, controller, subscribers, ...data } = session;
    writeFileSync(temporary, JSON.stringify({ ...data, evidence: [...session.evidence] }), { mode: 0o600 });
    renameSync(temporary, filename); timers.delete(session.id);
  };
  if (immediate) save(); else timers.set(session.id, setTimeout(save, 150));
}
export function record(session, event) {
  if(isDeleted(session.id))return {type:'workspace_deleted',sessionId:session.id};
  if (event.type === 'message') { event.message = { id: randomUUID(), time: Date.now(), ...event.message }; session.messages.push(event.message); }
  if (event.type === 'profile') Object.assign(session.profile, event.profile);
  if (event.type === 'opportunities') session.opportunities = event.opportunities;
  if (event.type === 'draft') session.draft = event.content;
  if (event.type === 'facts') session.facts = event.facts;
  if (event.type === 'run' && event.run) { const { candidates, queries, attempted, rejected, profileSnapshot, ...publicRun } = event.run; event = { ...event, run: publicRun }; }
  const stored = { ...structuredClone(event), sequence: (session.events.at(-1)?.sequence || 0) + 1, time: Date.now() };
  session.events.push(stored); if (session.events.length > 500) session.events.splice(0, session.events.length - 500);
  saveSession(session); session.subscribers?.forEach(send => send(stored)); return stored;
}
export function deleteSession(session){
  // Keep only the ID as a tombstone so old tabs and late saves cannot recreate data.
  writeFileSync(path.join(deletedDirectory,session.id),'',{mode:0o600});
  clearTimeout(timers.get(session.id));timers.delete(session.id);
  rmSync(path.join(directory,`${session.id}.json`),{force:true});
  rmSync(path.join(directory,`${session.id}.json.tmp`),{force:true});
  cache.delete(session.id);
  session.subscribers?.forEach(send=>send({type:'workspace_deleted',sessionId:session.id}));
  session.subscribers?.clear();
}
export function snapshot(session) {
  const opportunities=distinctProgramPages(session.opportunities);
  const run=session.run?.coverage?{...session.run,coverage:researchCoverage(opportunities,!!session.draft&&session.draftMeta?.method!=='profile-template')}:session.run;
  const draft=guardDraft(session.draft||'',{profile:session.profile,opportunity:session.opportunities.find(o=>o.id===session.draftMeta?.opportunityId)});
  return { sessionId: session.id, profile: session.profile, profileRevision:session.profileRevision,researchBrief:session.researchBrief||null,profileConflicts:session.profileConflicts||[],documents: session.documents.map(({ text, ...d }) => d), messages: session.messages, opportunities, draftDocument: draft, facts: session.facts, run, activity: session.events.filter(e => e.type === 'activity').slice(-30), cursor: session.events.at(-1)?.sequence || 0 };
}
export function listStudents(currentId){
 const ids=new Set(readdirSync(directory).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)));
 if(validId(currentId))ids.add(currentId);
 const result=[];
 for(const id of ids){try{const session=cache.get(id)||JSON.parse(readFileSync(path.join(directory,`${id}.json`),'utf8'));if(!session.listed&&id!==currentId)continue;result.push({sessionId:id,name:session.profile?.name||'Unnamed student',degree:session.profile?.degree||'',target_degree:session.profile?.target_degree||'',countries:session.profile?.countries||'',updatedAt:session.updatedAt||session.createdAt||0,status:session.run?.status||'not_started',opportunities:distinctProgramPages(session.opportunities||[]).length});}catch{/* Ignore an unreadable unrelated workspace. */}}
 return result.sort((a,b)=>b.updatedAt-a.updatedAt);
}
