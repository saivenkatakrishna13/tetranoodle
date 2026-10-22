// Opt-in live validation of an existing consented workspace. Original files are
// read only; personal source text stays in private .data/qa storage.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {discoveryResults,shortlistLeads} from '../shared/discovery-results.js';
import {researchCoverage} from '../server/research-quality.js';
const argument=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const workspace=argument('workspace');if(!/^[\w-]{12,80}$/.test(workspace||''))throw Error('Supply --workspace=<existing consented workspace ID>.');
const source=path.resolve('.data/sessions',workspace+'.json'),original=await readFile(source),seed=JSON.parse(original);
const hash=b=>createHash('sha256').update(b).digest('hex'),beforeHash=hash(original);
const term=argument('intake-term');if(term&&!['Summer','Spring','Winter','Fall'].includes(term))throw Error('Invalid intake term.');
await mkdir('.data/qa',{recursive:true,mode:0o700});const directory=await mkdtemp(path.resolve('.data/qa/current-profile-live-'));
const id=randomUUID();seed.id=id;if(term)seed.profile.intake_term=term;
await writeFile(path.join(directory,id+'.json'),JSON.stringify(seed),{mode:0o600});
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const base=`http://127.0.0.1:${port}`,budget=480000;
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),TETRA_DATA_DIR:directory,RESEARCH_BUDGET_MS:String(budget),RESEARCH_MAX_TOOL_CALLS:'100'},stdio:'ignore'});
const phases=['profile','discovery','eligibility','rank','draft','summary'];
const report={checkedAt:new Date().toISOString(),liveProviders:true,isolatedStorage:true,intakeTerm:term||seed.profile.intake_term||null,before:{elapsedMs:seed.run?.pipeline?.elapsedMs,found:seed.run?.foundCount,saved:seed.opportunities.length,fullyVerified:researchCoverage(seed.opportunities,!!seed.draft).ready,recommendations:seed.opportunities.filter(o=>o.recommended).length},errors:[]};
const events=[],controller=new AbortController();let browser;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const json=async(url,body)=>{const response=await fetch(base+url,{signal:AbortSignal.timeout(15000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;};
const reportPath='artifacts/research-speed-validation.json';
try{
 let ready=false;for(let i=0;i<100;i++){try{await json('/api/sessions/'+id);ready=true;break;}catch{await sleep(100);}}if(!ready)throw Error('Isolated API did not start.');
 const stream=fetch(`${base}/api/sessions/${id}/events?after=${seed.events?.at(-1)?.sequence||0}`,{signal:controller.signal}).then(async response=>{let pending='';const decoder=new TextDecoder();for await(const chunk of response.body){pending+=decoder.decode(chunk,{stream:true});const lines=pending.split('\n');pending=lines.pop();for(const line of lines)if(line.startsWith('data: '))events.push(JSON.parse(line.slice(6)));}}).catch(e=>{if(!controller.signal.aborted)report.errors.push(e.message);});
 await json('/api/research',{sessionId:id});let state,last=0,began=Date.now();
 do{
  await sleep(1000);state=await json('/api/sessions/'+id);
  if(Date.now()-last>30000){last=Date.now();console.log(JSON.stringify({elapsedSeconds:Math.round((Date.now()-began)/1000),phase:state.run?.pipeline?.phase,status:state.run?.status,found:state.run?.candidates?.length||0,checked:Object.values(state.run?.pipeline?.checks||{}).filter(c=>c.checked).length,calls:state.run?.pipeline?.toolCalls}));}
 }while(state.run?.status==='running'&&Date.now()-began<budget+15000);
 if(state.run?.status==='running'){await json(`/api/sessions/${id}/pause`,{});throw Error('Live run exceeded its total budget.');}
 await sleep(300);state=await json('/api/sessions/'+id);
 const p=state.run?.pipeline||{},milestones=events.filter(e=>e.type==='pipeline'),top=state.opportunities.filter(o=>o.recommended);
 report.after={status:state.run?.status,fullyVerified:state.run?.coverage?.ready||0,recommendations:top.length,found:state.run?.foundCount||0,checked:Object.values(p.checks||{}).filter(c=>c.checked).length,toolCalls:p.toolCalls,elapsedMs:p.elapsedMs,draftMethod:state.draftMeta?.method,profileConflicts:state.profileConflicts?.map(c=>c.key)||[],fieldLabels:Object.fromEntries(['Verified','Verified (with note)','Partial','Unverified','Missing'].map(label=>[label,top.reduce((n,o)=>n+['funding','deadline','requirements','application'].filter(k=>(o.claims?.[k]?.status||'Missing')===label).length,0)])),top:top.map(o=>({name:o.name,university:o.university,country:o.country,url:o.url,claims:Object.fromEntries(Object.entries(o.claims||{}).map(([k,c])=>[k,c?{status:c.status,note:c.note,url:c.url}:null])),intakeCheck:o.intake_check?.status})),phaseLog:milestones.map(e=>({agent:e.agent,phase:e.phase,count:e.count,checked:e.checked,outcome:e.outcome}))};
 const discovery=milestones.find(e=>e.phase==='discovery');
 report.checks={originalWorkspaceUnchanged:hash(await readFile(source))===beforeHash,phaseOrder:JSON.stringify(milestones.map(e=>e.phase))===JSON.stringify(phases),discoveryStopsAtTen:discovery?.count===10,atMostOneRepair:(state.run?.discoveryPasses||0)<=2,terminal:p.finished===true,withinBudget:p.elapsedMs<=budget+1500&&p.toolCalls<=100,oneArjunSummary:events.filter(e=>e.type==='message'&&e.message.profile_summary).length<=1&&!!state.profileAssessment,oneFinalSummary:events.filter(e=>e.type==='message'&&e.message.agent==='mira'&&/^\*\*(Complete|Partial \()/u.test(e.message.content)).length===1,noRepeatedInterruptions:!events.some(e=>e.type==='message'&&/run was interrupted|widening the search/i.test(e.message.content))};
 const lifecycle=events.filter(e=>e.type==='agent_lifecycle'),finished=Object.fromEntries(lifecycle.filter(e=>e.state==='finished').map(e=>[e.agent,e.time]));
 const owners={profile:'arjun',discovery:'nova',eligibility:'sage',rank:'mira',draft:'leo',summary:'mira'};
 Object.assign(report.checks,{
  lifecycleOnce:['arjun','nova','sage','mira','leo'].every(agent=>['started','finished'].every(state=>lifecycle.filter(e=>e.agent===agent&&e.state===state).length===1)),
  rolesRespected:(p.toolLog||[]).every(t=>t.agent===owners[t.phase]||t.phase==='eligibility'&&t.agent==='nova'&&t.repair===true),
  noWorkAfterDone:(p.toolLog||[]).every(t=>!finished[t.agent]||t.time<=finished[t.agent]||t.agent==='nova'&&t.repair===true&&t.phase==='eligibility'),
  fieldRetriesBounded:Object.values(p.checks||{}).every(c=>Object.values(c.fieldAttempts||{}).every(n=>n<=2)),
  candidateTimeBounded:Object.values(p.checks||{}).every(c=>(c.spentMs||0)<=46000),
 });
 report.quotaEvents=events.filter(e=>e.limitReached).map(({agent,model,limitType,keySetting})=>({agent,model,limitType,keySetting}));
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${base}/app?workspace=${id}`);await page.getByRole('button',{name:'Your matches',exact:true}).click();await page.getByRole('heading',{name:'Your next possibilities',exact:true}).waitFor();
 const allFound=discoveryResults(state.opportunities,state.run),shown=top.length+shortlistLeads(allFound,top).length;
 report.after.displayedShortlist=shown;report.after.allFoundVisible=allFound.length;report.after.speedupPercent=Math.round((1-report.after.elapsedMs/report.before.elapsedMs)*100);
 report.checks.matchesVisible=await page.locator('.opportunity-card').count()===shown;
 report.checks.fieldLabelsVisible=await page.locator('.field-verification .verification-badge').count()===shown*4;
 await page.getByRole('button',{name:/All found/}).click();report.checks.everyLeadVisible=await page.locator('.opportunity-card').count()===allFound.length;
 report.checks.fasterThanPrevious=report.after.elapsedMs<report.before.elapsedMs;
 const beforeCursor=state.cursor;await json('/api/research',{sessionId:id,resume:true});await sleep(200);report.checks.terminalResumeNoop=(await json('/api/sessions/'+id)).cursor===beforeCursor;
 controller.abort();await stream;
 report.workflowPassed=Object.values(report.checks).every(Boolean)&&!report.errors.length;
 report.deliveryGoalsMet=top.length===5&&!!state.draftDocument&&report.after.fullyVerified===5&&report.after.draftMethod!=='profile-template';
 if(!report.workflowPassed)process.exitCode=1;else if(!report.deliveryGoalsMet)process.exitCode=2;
 console.log(JSON.stringify({before:report.before,after:{...report.after,top:undefined},checks:report.checks,quotaEvents:report.quotaEvents}));
}catch(error){report.errors.push(error.message);process.exitCode=1;}
finally{controller.abort();await browser?.close();server.kill('SIGTERM');report.checks||={};report.checks.originalWorkspaceUnchanged=hash(await readFile(source))===beforeHash;await writeFile(reportPath,JSON.stringify(report,null,2));console.log('Redacted validation report: '+reportPath);console.log('Private validation checkpoint: '+directory);}
