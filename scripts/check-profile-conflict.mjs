import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.TETRA_URL||'http://127.0.0.1:3001';
async function json(url,body){const r=await fetch(base+url,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||r.status);return d;}
const s=await json('/api/sessions',{profile:{name:'Rahul',degree:'Final-year B.Tech Computer Science',target_degree:'Master of Computer Science',cgpa:'9.8 / 10',countries:'Canada'}});
const form=new FormData();form.append('sessionId',s.sessionId);form.append('files',new Blob([await readFile('fixtures/rahul-transcript.pdf')]),'rahul-transcript.pdf');
const uploaded=await fetch(base+'/api/documents',{method:'POST',body:form});if(!uploaded.ok)throw Error('Test transcript could not be uploaded.');
await json('/api/research',{sessionId:s.sessionId});
let current;
for(let n=0;n<150;n++){await new Promise(r=>setTimeout(r,2000));current=await json(`/api/sessions/${s.sessionId}`);if(current.run?.status!=='running')break;}
const passed=current.run?.status==='needs_input'&&current.profileConflicts.some(c=>c.key==='cgpa')&&current.opportunities.length===0&&!current.run.queries?.length;
await writeFile('artifacts/profile-conflict-validation.json',JSON.stringify({checkedAt:new Date().toISOString(),fictionalTest:true,injectedContradiction:'Self-reported 9.8 / 10 versus uploaded transcript 8.2 / 10',passed,snapshot:current},null,2));
console.log({passed,status:current.run?.status,conflicts:current.profileConflicts,opportunities:current.opportunities.length});if(!passed)process.exitCode=1;
