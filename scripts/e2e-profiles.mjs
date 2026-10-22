// Actual website + actual API + configured live providers. All cases use an
// isolated temporary server/data directory; existing student workspaces stay intact.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {chromium,expect} from '@playwright/test';
import {labeledProfileFacts} from '../server/profile.js';
const fixturePaths=['fixtures/rahul-profile.json','fixtures/alternate-student.json','fixtures/unseen-design-student.txt'];
const budget=Math.max(15000,Math.min(480000,Number(process.argv.find(v=>v.startsWith('--budget='))?.split('=')[1])||480000));
const address=net.createServer();await new Promise(r=>address.listen(0,'127.0.0.1',r));const port=address.address().port;await new Promise(r=>address.close(r));
const directory=await mkdtemp(path.join(os.tmpdir(),'scholarx-three-profiles-')),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),TETRA_DATA_DIR:directory,RESEARCH_BUDGET_MS:String(budget),DRAFT_BUDGET_MS:'45000'},stdio:'ignore'});
let browser;const cases=[],errors=[];
async function json(url,body){const r=await fetch(base+url,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
try{
 let ready=false;for(let i=0;i<80;i++){try{await json('/api/status');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}if(!ready)throw Error('Isolated API did not start.');
 if(!(await json('/api/status')).live)throw Error('Configure the existing role keys to run live E2E validation.');
 browser=await chromium.launch();
 for(const fixture of fixturePaths){
  const raw=await readFile(fixture,'utf8');let profile;try{profile=JSON.parse(raw);}catch{profile=Object.fromEntries(labeledProfileFacts(raw).map(f=>[f.key,f.value]));}
  const state=await json('/api/sessions',{}),id=state.sessionId,page=await browser.newPage({viewport:{width:1440,height:1000}}),pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));const started=Date.now();
  try{
   await page.goto(`${base}/app?workspace=${id}`);await expect(page.getByRole('heading',{name:'Tell us your story.',exact:true})).toBeVisible();
   for(const [key,value]of Object.entries(profile)){const input=page.locator(`.profile-start-fields input[name="${key}"]`);if(await input.count())await input.fill(String(value));}
   if(fixture.includes('rahul-profile'))await page.getByLabel('Profile supporting documents').setInputFiles(['fixtures/rahul-resume.pdf','fixtures/rahul-transcript.pdf']);
   await page.locator('.profile-start-cta').click();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();
   let current;const deadline=Date.now()+budget+65000;
   do{await new Promise(r=>setTimeout(r,1000));current=await json(`/api/sessions/${id}`);}while(current.run?.status==='running'&&Date.now()<deadline);
   if(current.run?.status==='running'){await json(`/api/sessions/${id}/pause`,{});current=await json(`/api/sessions/${id}`);}
   await page.getByRole('button',{name:'Your matches',exact:true}).click();await expect(page.getByRole('heading',{name:'Your next possibilities',exact:true})).toBeVisible();
   const result={fixture,elapsedSeconds:Math.round((Date.now()-started)/1000),status:current.run?.status,goal:current.researchBrief?.goal||null,opportunities:current.opportunities.length,recommendations:current.opportunities.filter(o=>o.recommended).length,fullyVerified:current.run?.coverage?.ready||0,hasDraft:!!current.draftDocument,metrics:current.metrics,pageErrors,workflowReachedSavedState:['partial','completed','interrupted'].includes(current.run?.status),error:current.run?.error||null};
   cases.push(result);console.log(JSON.stringify({fixture,status:result.status,opportunities:result.opportunities,fullyVerified:result.fullyVerified}));
  }catch(e){cases.push({fixture,error:e.message,pageErrors});}finally{await page.close();}
 }
}catch(e){errors.push(e.message);}finally{
 await browser?.close();server.kill();await new Promise(r=>server.once('close',r));await rm(directory,{recursive:true,force:true});
 const workflowPassed=cases.length===3&&cases.every(c=>c.workflowReachedSavedState&&!c.pageErrors.length&&!c.error),allResearchComplete=cases.length===3&&cases.every(c=>c.status==='completed'&&c.opportunities>=10&&c.recommendations===5&&c.fullyVerified===5&&c.hasDraft);
 await writeFile('artifacts/three-profile-e2e.json',JSON.stringify({checkedAt:new Date().toISOString(),realProviders:true,isolatedStorage:true,temporaryDataDeleted:true,budgetPerCaseMs:budget,workflowPassed,allResearchComplete,cases,errors},null,2));
 process.exitCode=errors.length||!workflowPassed?1:allResearchComplete?0:2;
}
