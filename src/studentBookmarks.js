const key='tetranoodle.students.v1';
export function studentBookmarks(){try{const saved=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(saved)?saved.filter(s=>s&&typeof s.sessionId==='string'&&/^[a-zA-Z0-9-]{12,80}$/.test(s.sessionId)):[];}catch{return [];}}
export function rememberStudent(sessionId,profile,opportunities=0,status='not_started'){
 if(!profile.name&&!profile.degree)return;
 try{const entry={sessionId,name:profile.name||'Unnamed student',degree:profile.degree||'',target_degree:profile.target_degree||'',countries:profile.countries||'',opportunities,status,updatedAt:Date.now()};localStorage.setItem(key,JSON.stringify([entry,...studentBookmarks().filter(s=>s.sessionId!==sessionId)].slice(0,50)));}catch{/* Server-created students remain saved if browser storage is unavailable. */}
}
