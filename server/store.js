import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const directory = path.resolve(import.meta.dirname, '../.data/sessions');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const cache = new Map(), timers = new Map();
export const validId = id => typeof id === 'string' && /^[a-zA-Z0-9-]{12,80}$/.test(id);
export function sessionFor(id) {
  if (!validId(id)) throw new Error('A valid workspace ID is required.');
  if (cache.has(id)) return cache.get(id);
  const filename = path.join(directory, `${id}.json`);
  let data = {};
  if (existsSync(filename)) {
    try { data = JSON.parse(readFileSync(filename, 'utf8')); } catch { throw new Error('This saved workspace could not be read. Start a new journey or restore its backup.'); }
  }
  const session = { profile: {}, documents: [], opportunities: [], messages: [], events: [], draft: '', run: null, facts: [], ...data, id, evidence: new Map(data.evidence || []), chatBusy: false };
  if (session.run?.status === 'running') { session.run.status = 'interrupted'; session.run.message = 'The server restarted. Resume to continue from saved findings.'; }
  cache.set(id, session); return session;
}
export function saveSession(session, immediate = false) {
  clearTimeout(timers.get(session.id));
  const save = () => {
    const filename = path.join(directory, `${session.id}.json`), temporary = `${filename}.tmp`;
    const { chatBusy, controller, subscribers, ...data } = session;
    writeFileSync(temporary, JSON.stringify({ ...data, evidence: [...session.evidence] }), { mode: 0o600 });
    renameSync(temporary, filename); timers.delete(session.id);
  };
  if (immediate) save(); else timers.set(session.id, setTimeout(save, 150));
}
export function record(session, event) {
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
export function snapshot(session) {
  return { sessionId: session.id, profile: session.profile, documents: session.documents.map(({ text, ...d }) => d), messages: session.messages, opportunities: session.opportunities, draftDocument: session.draft, facts: session.facts, run: session.run, activity: session.events.filter(e => e.type === 'activity').slice(-30), cursor: session.events.at(-1)?.sequence || 0 };
}
