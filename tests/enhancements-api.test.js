import {applicationTaskId} from '../shared/match-planning.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {extractDocx} from '../server/documents.js';
test('new API controls, source-backed tasks, run reopen/diff and real PDF/DOCX exports are isolated',{timeout:60000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'scholarx-features-')),address=net.createServer();await new Promise(r=>address.listen(0,'127.0.0.1',r));const port=address.address().port;await new Promise(r=>address.close(r));
 const id='fictional-enhancement-api',proof={value:'Provide a portfolio',quote:'Applicants must provide a portfolio.',url:'https://example.edu/fixture',retrieved_at:'2026-10-21T00:00:00Z'},opportunity={id:'fixture',name:'Fictional Programme',university:'Fixture Provider',url:proof.url,rank:1,recommended:true,score:50,integrity_checked:true,claims:{requirements:proof},application_step_evidence:[proof],criteria:[{label:'IELTS',required:'IELTS 6.5',status:'unknown',evidence:proof}]};
 const pack={id:'archive-one',savedAt:Date.now(),profile:{degree:'Bachelor of Design',target_degree:'Master of Design',countries:'Finland'},run:{id:'archive-one',status:'partial'},opportunities:[opportunity],draft:'Archived [Missing: motivation]',draftMeta:null,evidence:[[proof.url,{...proof,text:proof.quote}]],documents:[]};
 await writeFile(path.join(dir,id+'.json'),JSON.stringify({profile:pack.profile,documents:[],messages:[],events:[],opportunities:[opportunity],draft:'Stored draft with [Missing: motivation].',run:{id:'current-pack',status:'partial'},evidence:pack.evidence,runHistory:[pack,{...pack,id:'archive-two',opportunities:[{...opportunity,name:'Changed name',score:40}]}]}));
 const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),TETRA_DATA_DIR:dir},stdio:'ignore'}),base=`http://127.0.0.1:${port}`;
 const get=async url=>{const r=await fetch(base+url);assert.ok(r.ok);return r.json();};const post=async(url,body={})=>{const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;};
 try{
  let ready=false;for(let i=0;i<70;i++){try{await get('/api/sessions/'+id);ready=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}assert.ok(ready);
  assert.equal((await get('/api/demo-profile')).fictional,true);
  await post(`/api/sessions/${id}/demo-failures`,{sourceOnce:true});const insights=await get(`/api/sessions/${id}/insights`);assert.equal(insights.demoFailures.sourceOnce,true);assert.equal(insights.draftDocument,(await get(`/api/sessions/${id}`)).draftDocument);assert.equal(typeof insights.cursor,'number');
  await post(`/api/sessions/${id}/checklist`,{id:applicationTaskId('fixture',proof),done:true});assert.equal((await get(`/api/sessions/${id}`)).checklist[applicationTaskId('fixture',proof)],true);
  const unknown=await fetch(base+`/api/sessions/${id}/checklist`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'invented-task',done:true})});assert.equal(unknown.status,400);
  const prompted=await post(`/api/sessions/${id}/missing-info`);assert.deepEqual(prompted.pendingEligibility.ids,['fixture']);assert.ok(prompted.messages.at(-1).content.includes(proof.url));
  const translated=await post(`/api/sessions/${id}/draft-language`,{language:'fr',opportunityId:'fixture'});assert.match(translated.draftDocument,/Brouillon/);assert.match(translated.draftDocument,/https:\/\/example.edu/);
  const doc=await fetch(base+`/api/sessions/${id}/sop.docx`);assert.match(doc.headers.get('content-type'),/wordprocessingml/);assert.match(extractDocx(new Uint8Array(await doc.arrayBuffer())),/Brouillon/);
  const pdf=await fetch(base+`/api/sessions/${id}/report.pdf`);assert.match(pdf.headers.get('content-type'),/application\/pdf/);assert.ok(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString()==='%PDF');
  const diff=await get(`/api/sessions/${id}/runs/diff?before=archive-one&after=archive-two`);assert.equal(diff.changed.length,1);
  const reopened=await post(`/api/sessions/${id}/runs/archive-one/reopen`);assert.equal(reopened.run.reopenedFrom,'archive-one');assert.equal(reopened.opportunities[0].name,'Fictional Programme');assert.equal(reopened.pendingEligibility,null);
  await post(`/api/sessions/${id}/checklist`,{id:applicationTaskId('fixture',proof),done:false});
 }finally{server.kill();await new Promise(r=>server.once('close',r));await rm(dir,{recursive:true,force:true});}
});

test('English language action uses Leo’s sourced draft path instead of restoring the legacy template',{timeout:30000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'scholarx-english-draft-')),address=net.createServer();await new Promise(r=>address.listen(0,'127.0.0.1',r));const port=address.address().port;await new Promise(r=>address.close(r));
 const id='fictional-english-sop',url='https://example.edu/msc',text='Applicants must provide a portfolio.',profile={name:'Fictional Student',degree:'Bachelor of Computer Science',target_degree:'Master of Computer Science',interests:'Computer vision',career_goals:'Build accessible software'},opportunity={id:'fixture',name:'Master of Computer Science',url,recommended:true,integrity_checked:true,claims:{requirements:{value:'Provide a portfolio',quote:text,url,status:'Verified',retrieved_at:'2026-10-22'}}};
 await writeFile(path.join(dir,id+'.json'),JSON.stringify({profile,documents:[],messages:[],events:[],opportunities:[opportunity],draft:'Legacy English template',draftOptions:{language:'fr'},evidence:[[url,{url,text,retrieved_at:'2026-10-22'}]],run:{status:'partial'}}));
 const preload=path.join(dir,'mock-fetch.mjs');await writeFile(preload,`globalThis.fetch=async(url,options)=>{if(!String(url).startsWith('https://api.groq.com/'))throw Error('Unexpected external request');const body=JSON.parse(options.body);if(!body.messages[0].content.includes('You are leo'))throw Error('Unexpected agent');return Response.json({choices:[{message:{content:JSON.stringify({sections:[]})}}]});};`);
 const server=spawn(process.execPath,['--import',preload,'server/index.js'],{env:{...process.env,PORT:String(port),TETRA_DATA_DIR:dir},stdio:'ignore'}),base=`http://127.0.0.1:${port}`;
 try{
  let ready=false;for(let i=0;i<70;i++){try{ready=(await fetch(base+`/api/sessions/${id}`)).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready);
  const response=await fetch(base+`/api/sessions/${id}/draft-language`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'en',opportunityId:'fixture'})}),state=await response.json();assert.equal(response.status,200,JSON.stringify(state));
  assert.equal(state.draftMeta.method,'source-grounded-ai-arranged');assert.equal(state.draftOptions.language,'en');assert.deepEqual(state.draftMeta.blockedClaims,[]);assert.match(state.draftDocument,/My current studies are Bachelor of Computer Science/);assert.match(state.draftDocument,/\[\^S\d+\]/);assert.doesNotMatch(state.draftDocument,/add a supported statement here|Legacy English template/);assert.equal((state.draftDocument.match(/## Gaps to complete/g)||[]).length,1);
  const insights=await (await fetch(base+`/api/sessions/${id}/insights`)).json();assert.equal(insights.draftDocument,state.draftDocument);assert.equal(insights.draftMeta.method,state.draftMeta.method);assert.deepEqual(state.profile,profile);assert.equal(state.opportunities.length,1);assert.equal(state.run.status,'partial');
 }finally{server.kill();await new Promise(r=>server.once('close',r));await rm(dir,{recursive:true,force:true});}
});
