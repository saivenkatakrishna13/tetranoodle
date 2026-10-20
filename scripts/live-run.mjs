import { readFile, writeFile } from 'node:fs/promises';
const alternate=process.argv.includes('--alternate');
const base=process.env.TETRA_URL||'http://127.0.0.1:3001';
const id=process.env.TETRA_WORKSPACE_ID||(alternate?'hackathon-alternate-student-2026':'hackathon-rahul-complete-2026');
const profile=alternate?JSON.parse(await readFile('fixtures/alternate-student.json','utf8')):{name:'Rahul',degree:'Final-year B.Tech Computer Science',target_degree:'Master’s in Computer Science or Artificial Intelligence',cgpa:'8.2 / 10',countries:'Canada, Germany, Singapore',budget:'Needs substantial funding; family cannot afford expensive tuition',interests:'Artificial intelligence; details of individual AI projects not supplied'};
async function json(url,options){const response=await fetch(base+url,options);const data=await response.json();if(!response.ok)throw new Error(data.error||response.status);return data;}
let state=await json(`/api/sessions/${id}`);
if(!state.run){
 await json(`/api/sessions/${id}/profile`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});
 if(!alternate){const form=new FormData();form.append('sessionId',id);for(const name of ['rahul-resume.pdf','rahul-transcript.pdf'])form.append('files',new Blob([await readFile(`fixtures/${name}`)]),name);await json('/api/documents',{method:'POST',body:form});}
}
console.log('Workspace:',id);
const started=await json('/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:id,resume:!!state.run})});console.log('Started',{status:started.run.status,stage:started.run.stage});
const response=await fetch(base+`/api/sessions/${id}/events?after=${state.cursor||0}`);
const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
while(true){const{value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const events=buffer.split('\n\n');buffer=events.pop();for(const e of events){const line=e.split('\n').find(l=>l.startsWith('data: '));if(!line)continue;const d=JSON.parse(line.slice(6));if(d.type==='activity')console.log(d.label);if(d.type==='message')console.log(d.message.agent+': '+d.message.content.slice(0,350));if(d.type==='run')console.log('RUN',d.run.status,d.run.stage,d.run.progress);if(d.type==='run'&&['completed','partial','interrupted','paused','needs_input'].includes(d.run.status)){await new Promise(r=>setTimeout(r,400));state=await json(`/api/sessions/${id}`);await writeFile(`artifacts/${alternate?'alternate':'rahul'}-live-validation.json`,JSON.stringify(state,null,2));await writeFile(`artifacts/${alternate?'alternate':'rahul'}-research-report.md`,await fetch(base+`/api/sessions/${id}/report`).then(r=>r.text()));console.log('RESULT',{status:state.run.status,opportunities:state.opportunities.length,topFive:state.opportunities.filter(o=>o.recommended).length,draftCharacters:state.draftDocument.length});await reader.cancel();process.exit(state.run.status==='completed'?0:2);}}}
