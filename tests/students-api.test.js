import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

test('new student workspaces isolate profiles, documents, conversation and stored research',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'tetranoodle-students-'));
 const address=net.createServer();await new Promise(resolve=>address.listen(0,'127.0.0.1',resolve));const port=address.address().port;await new Promise(resolve=>address.close(resolve));
 const server=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,TETRA_DATA_DIR:directory,PORT:String(port),GROQ_API_KEY:'',...Object.fromEntries(['MIRA','ARJUN','NOVA','SAGE','LEO'].map(role=>[`GROQ_API_KEY_${role}`,'']))},stdio:'ignore'});
 const base=`http://127.0.0.1:${port}`;
 async function request(url,body,method='POST'){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;}
 try{
  let ready=false;for(let i=0;i<80;i++){try{await fetch(base+'/api/sessions?current=initial-test-student');ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}assert.ok(ready,'isolated API started');
  const first=await request('/api/sessions',{profile:{name:'First Student',degree:'B.Tech Computer Science',target_degree:'Master of Computer Science',countries:'Canada',github:'https://github.com/first-student'}});
  const form=new FormData();form.append('sessionId',first.sessionId);form.append('files',new Blob(['Fictional first student transcript. CGPA: 8.2 / 10.']), 'first-transcript.txt');assert.equal((await fetch(base+'/api/documents',{method:'POST',body:form})).status,200);
  const second=await request('/api/sessions',{previousSessionId:first.sessionId,profileText:JSON.stringify({name:'Second Student',degree:'M.Sc. Environmental Science',target_degree:'PhD Climate Science',countries:['Sweden','Finland'],cgpa:'3.7 / 4.0'})});
  assert.notEqual(second.sessionId,first.sessionId);assert.equal(second.profile.name,'Second Student');assert.equal(second.profile.github,undefined);assert.equal(second.documents.length,0);assert.equal(second.opportunities.length,0);assert.equal(second.draftDocument,'');assert.equal(second.run,null);assert.ok(!JSON.stringify(second).includes('First Student'));assert.ok(!JSON.stringify(second).includes('first-transcript'));
  const restored=await request(`/api/sessions/${first.sessionId}`,undefined,'GET');assert.equal(restored.profile.name,'First Student');assert.equal(restored.documents[0].name,'first-transcript.txt');
  const prematureFinish=await fetch(base+`/api/sessions/${first.sessionId}/finish`,{method:'POST'});assert.equal(prematureFinish.status,409);assert.match((await prematureFinish.json()).error,/independently reviewed/);
  const preserved=await request(`/api/sessions/${first.sessionId}`,undefined,'GET');assert.deepEqual(preserved.profile,restored.profile);assert.deepEqual(preserved.documents,restored.documents);assert.equal(preserved.run,null);
  const list=await request(`/api/sessions?current=${second.sessionId}`,undefined,'GET');assert.equal(list.students.length,2);assert.ok(list.students.some(s=>s.name==='First Student'));assert.ok(list.students.some(s=>s.name==='Second Student'));
  const changed=await request(`/api/sessions/${second.sessionId}/profile`,{countries:'Germany'},'PATCH');assert.equal(changed.changed,true);assert.equal(changed.profileRevision,2);assert.equal(changed.run,null);assert.equal(changed.profile.name,'Second Student');
  const exported=await request(`/api/sessions/${second.sessionId}/export`,undefined,'GET');assert.equal(exported.profile.countries,'Germany');assert.equal(exported.documents.length,0);
  const seededId='document-change-test-student';
  await writeFile(path.join(directory,`${seededId}.json`),JSON.stringify({profile:{name:'Document Student',cgpa:'8.2 / 10'},documentProfileFields:{cgpa:'8.2 / 10'},documents:[],opportunities:[{name:'Stale match'}],draft:'Stale draft',run:{status:'completed'},facts:[{value:'Stale fact'}],evidence:[]}));
  const replacement=new FormData();replacement.append('sessionId',seededId);replacement.append('files',new Blob(['Fictional corrected transcript. Academic result: 8.7 / 10.']),'corrected-transcript.txt');
  assert.equal((await fetch(base+'/api/documents',{method:'POST',body:replacement})).status,200);
  const invalidated=await request(`/api/sessions/${seededId}`,undefined,'GET');assert.equal(invalidated.run,null);assert.equal(invalidated.draftDocument,'');assert.equal(invalidated.opportunities.length,0);assert.equal(invalidated.facts.length,0);assert.equal(invalidated.profile.cgpa,undefined);assert.equal(invalidated.profile.name,'Document Student');assert.equal(invalidated.documents.length,1);
  await request(`/api/sessions/${seededId}/documents/${invalidated.documents[0].id}`,undefined,'DELETE');
  assert.equal((await request(`/api/sessions/${seededId}`,undefined,'GET')).documents.length,0);
  const turn=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:first.sessionId,message:'Hi'})});
  const blocked=await fetch(base+`/api/sessions/${first.sessionId}`,{method:'DELETE'});assert.equal(blocked.status,409,'active replies finish before student deletion');await turn.text();
  const events=await fetch(base+`/api/sessions/${first.sessionId}/events?after=${restored.cursor}`),reader=events.body.getReader();
  const removed=await request(`/api/sessions/${first.sessionId}`,undefined,'DELETE');assert.equal(removed.deleted,true);
  let feed='';for(;;){const part=await reader.read();if(part.done)break;feed+=new TextDecoder().decode(part.value);}assert.match(feed,/workspace_deleted/);
  await assert.rejects(access(path.join(directory,`${first.sessionId}.json`)));
  assert.equal((await fetch(base+`/api/sessions/${first.sessionId}`)).status,410,'old URLs cannot recreate a deleted student');
  assert.equal((await fetch(base+`/api/sessions/${first.sessionId}/profile`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Resurrected'})})).status,410);
  const afterDelete=await request(`/api/sessions?current=${first.sessionId}`,undefined,'GET');assert.ok(afterDelete.deletedIds.includes(first.sessionId));assert.ok(!afterDelete.students.some(s=>s.sessionId===first.sessionId));assert.ok(afterDelete.students.some(s=>s.sessionId===second.sessionId));
  const secondAfter=await request(`/api/sessions/${second.sessionId}`,undefined,'GET');assert.equal(secondAfter.profile.name,'Second Student');assert.equal(secondAfter.profile.countries,'Germany');
  const deletedAgain=await fetch(base+`/api/sessions/${first.sessionId}`,{method:'DELETE'});assert.equal(deletedAgain.status,410);
 }finally{server.kill();await new Promise(resolve=>server.once('close',resolve));await rm(directory,{recursive:true,force:true});}
});
