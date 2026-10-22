// Presentation-only bridge. No prompts, documents, secrets or student data.
// App keeps its existing event handling; the landing reads this small snapshot.
const listeners = new Set();
let snapshot = {agent: null, status: 'idle', failureAt: 0,recoveryAt:0};
export const getAgentSceneSnapshot = () => snapshot;
export function subscribeAgentScene(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function publishAgentSceneEvent(event) {
  let next = snapshot;
  if (event.type === 'research_reset' || event.type === 'workspace_deleted') next = {agent:null,status:'idle',failureAt:0,recoveryAt:0};
  if (event.type === 'run') next = {...next,status:event.run?.status || 'idle',agent:event.run?.status === 'running' ? next.agent : null};
  if (event.type === 'typing') next = {...next,agent:event.agent || null};
  if (event.type === 'activity' && event.agent) next = {...next,agent:event.agent};
  if (event.type === 'error' || event.type === 'activity' && /fail|error|unavailable|blocked/i.test(event.label || '')) next = {...next,failureAt:event.time||Date.now()};
  if(event.type==='activity'&&event.state==='recovery')next={...next,recoveryAt:event.time||Date.now(),failureAt:0};
  if (next !== snapshot) { snapshot = next; listeners.forEach(listener => listener()); }
}
