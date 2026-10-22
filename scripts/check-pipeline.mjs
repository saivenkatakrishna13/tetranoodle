// Unmocked browser -> API -> provider -> official-page validation. Fictional
// inputs and temporary storage protect existing students and credentials.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {chromium,expect} from '@playwright/test';

const budget=480000,phases=['profile','discovery','eligibility','rank','draft','summary'];
const selected=process.argv.find(a=>a.startsWith('--case='))?.split('=')[1];
const inputs=[['rahul','fixtures/rahul-profile.json'],['arts-germany','fixtures/arts-germany-profile.json']].filter(([id])=>!selected||id===selected);
if(!inputs.length)throw Error('Unknown --case; use rahul or arts-germany.');
const address=net.createServer();await new Promise(r=>address.listen(0,'127.0.0.1',r));const port=address.address().port;await new Promise(r=>address.close(r));
const directory=await mkdtemp(path.join(os.tmpdir(),'scholarx-strict-pipeline-')),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),TETRA_DATA_DIR:directory,RESEARCH_BUDGET_MS:String(budget),RESEARCH_MAX_TOOL_CALLS:'100',DRAFT_BUDGET_MS:'45000'},stdio:'ignore'});
const report={checkedAt:new Date().toISOString(),realProviders:true,isolatedStorage:true,budgetPerCaseMs:budget,maxToolCalls:100,cases:[],errors:[]};
const reportPath=`artifacts/strict-pipeline${selected?'-'+selected:''}-validation.json`;
let browser;
const save=()=>writeFile(reportPath,JSON.stringify(report,null,2));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,body){const response=await fetch(base+url,{signal:AbortSignal.timeout(20000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.error||`HTTP ${response.status}`);return value;}
async function collect(id,events,signal){
 const response=await fetch(`${base}/api/sessions/${id}/events?after=0`,{signal});let pending='';const decoder=new TextDecoder();
 for await(const chunk of response.body){pending+=decoder.decode(chunk,{stream:true});const lines=pending.split('\n');pending=lines.pop();for(const line of lines)if(line.startsWith('data: '))events.push(JSON.parse(line.slice(6)));}
}
try{
 let ready=false;for(let i=0;i<100;i++){try{await json('/api/status');ready=true;break;}catch{await sleep(100);}}if(!ready)throw Error('Isolated API did not start.');
 if(!(await json('/api/status')).live)throw Error('The five existing agent credentials are required for live validation.');
 browser=await chromium.launch();
 for(const [label,fixture] of inputs){
  const profile=JSON.parse(await readFile(fixture,'utf8'));if(label==='rahul')profile.name='Rahul'; // Matches the supplied fictional PDF documents.
  const initial=await json('/api/sessions',{}),id=initial.sessionId,events=[],pageErrors=[],stream=new AbortController();
  const collecting=collect(id,events,stream.signal).catch(error=>{if(!stream.signal.aborted)pageErrors.push('SSE: '+error.message);});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>pageErrors.push(error.message));
  const result={label,fixture,profile,pageErrors};report.cases.push(result);await save();
  try{
   await page.goto(`${base}/app?workspace=${id}`);await expect(page.getByRole('heading',{name:'Tell us your story.',exact:true})).toBeVisible();
   for(const [key,value] of Object.entries(profile)){const input=page.locator(`.profile-start-fields input[name="${key}"]`);if(await input.count())await input.fill(value);}
   if(label==='rahul')await page.getByLabel('Profile supporting documents').setInputFiles(['fixtures/rahul-resume.pdf','fixtures/rahul-transcript.pdf']);
   else await page.getByLabel('Profile supporting documents').setInputFiles({name:'fictional-arts-profile.txt',mimeType:'text/plain',buffer:Buffer.from('Fictional validation profile. No achievements are implied.\n'+Object.entries(profile).map(([k,v])=>`${k}: ${v}`).join('\n'))});
   await page.getByRole('button',{name:'Save profile & find opportunities',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();
   const began=Date.now();let current,lastLog=0;
   do{
    await sleep(1000);current=await json(`/api/sessions/${id}`);
    if(Date.now()-lastLog>30000){lastLog=Date.now();console.log(JSON.stringify({case:label,elapsed:Math.round((Date.now()-began)/1000),phase:current.run?.pipeline?.phase,found:current.run?.candidates?.length||0,checked:Object.values(current.run?.pipeline?.checks||{}).filter(c=>c.checked).length,tools:current.run?.pipeline?.toolCalls,activity:current.activity.at(-1)?.label}));}
   }while((!current.run||current.run.status==='running')&&Date.now()-began<budget+20000);
   if(current.run?.status==='running'){await json(`/api/sessions/${id}/pause`,{});throw Error('Research exceeded the configured total budget.');}
   await sleep(300);current=await json(`/api/sessions/${id}`);
   const p=current.run?.pipeline||{},milestones=events.filter(e=>e.type==='pipeline'),lifecycle=events.filter(e=>e.type==='agent_lifecycle');
   const finishTimes=Object.fromEntries(lifecycle.filter(e=>e.state==='finished').map(e=>[e.agent,e.time]));
   const owners={profile:'arjun',discovery:'nova',eligibility:'sage',rank:'mira',draft:'leo',summary:'mira'};
   const top=current.opportunities.filter(o=>o.recommended);
   const sourceCalls=p.toolLog||[];
   const checks={
    profileDriven:current.researchBrief?.goal===profile.target_degree&&current.researchBrief?.academic_background===profile.degree,
    phaseOrder:JSON.stringify(milestones.map(e=>e.phase))===JSON.stringify(phases),
    lifecycleOnce:['arjun','nova','sage','mira','leo'].every(agent=>['started','finished'].every(state=>lifecycle.filter(e=>e.agent===agent&&e.state===state).length===1)),
    rolesRespected:sourceCalls.every(t=>t.agent===owners[t.phase]||t.phase==='eligibility'&&t.agent==='nova'&&t.repair===true),
    noWorkAfterDone:sourceCalls.every(t=>!finishTimes[t.agent]||t.time<=finishTimes[t.agent]||t.agent==='nova'&&t.repair===true&&t.phase==='eligibility'),
    discoveryReachedTen:(milestones.find(e=>e.phase==='discovery')?.count||0)>=10,
    atMostOneRepair:(current.run?.discoveryPasses||0)<=2,
    fieldRetriesBounded:Object.values(p.checks||{}).every(c=>Object.values(c.fieldAttempts||{}).every(n=>n<=2)),
    candidateTimeBounded:Object.values(p.checks||{}).every(c=>(c.spentMs||0)<=46000),
    runWithinBudget:(p.elapsedMs||0)<=budget+1500&&p.toolCalls<=p.maxToolCalls,
    oneFinalSummary:events.filter(e=>e.type==='message'&&e.message.agent==='mira'&&/^\*\*(?:Complete|Partial \()/u.test(e.message.content)).length===1,
    noInterruptedMessages:!events.some(e=>e.type==='message'&&/run was interrupted|widening the search/i.test(e.message.content)),
    topFive:top.length===5,draftSaved:!!current.draftDocument,
    terminal:p.finished===true&&['completed','partial'].includes(current.run.status),
   };
   Object.assign(result,{status:current.run.status,elapsedMs:p.elapsedMs,found:current.run.foundCount,checked:Object.values(p.checks||{}).filter(c=>c.checked).length,fullyVerified:current.run.coverage?.ready||0,recommendations:top.length,draftMethod:current.draftMeta?.method||null,checks,phaseLog:milestones.map(({agent,phase,time,...event})=>({agent,phase,time,count:event.count,checked:event.checked,saved:event.saved,outcome:event.outcome})),lifecycle,toolCalls:p.toolCalls,toolLog:sourceCalls,candidateChecks:p.checks,stopReason:p.stopReason||null,quotaEvents:events.filter(e=>e.limitReached).map(({agent,model,limitType,keySetting,label})=>({agent,model,limitType,keySetting,label})),top:top.map(o=>({name:o.name,university:o.university,country:o.country,url:o.url,integrity_checked:o.integrity_checked,identity_verified:o.identity_verified,claims:o.claims,missing_information:o.missing_information})),searchQueries:current.run.queries});
   await save();
   // A manual Resume on a terminal run is a no-op, even through the real API.
   const before=current.cursor;await json('/api/research',{sessionId:id,resume:true});await sleep(250);const after=await json(`/api/sessions/${id}`);checks.completedResumeIsNoop=after.cursor===before;
   await page.getByRole('button',{name:'Your matches',exact:true}).click();await expect(page.getByRole('heading',{name:'Your next possibilities',exact:true})).toBeVisible();
   checks.matchesUI=await page.locator('.opportunity-card').count()===top.length; // Zero is a real empty result, not a fabricated card.
   await page.getByRole('button',{name:'Documents',exact:true}).click();checks.documentsUI=await page.getByText(label==='rahul'?'rahul-resume.pdf':'fictional-arts-profile.txt',{exact:true}).isVisible();
   await page.getByRole('button',{name:'Applications',exact:true}).click();checks.draftUI=!current.draftDocument||await page.locator('.application-paper').isVisible();
   await page.getByRole('button',{name:'Group chat',exact:true}).click();checks.chatUI=await page.getByRole('textbox',{name:'Message your team'}).isVisible();
   checks.noBrowserErrors=pageErrors.length===0;
   console.log(label+': '+milestones.map(e=>`${e.agent} ${e.phase} done`).join(' -> '));
   result.workflowPassed=Object.entries(checks).filter(([key])=>!['discoveryReachedTen','topFive','draftSaved'].includes(key)).every(([,value])=>value);
   result.deliveryGoalsMet=checks.discoveryReachedTen&&checks.topFive&&checks.draftSaved;
   result.allResearchComplete=current.run.status==='completed'&&result.fullyVerified===5&&result.deliveryGoalsMet;
   result.passed=result.workflowPassed&&result.allResearchComplete;console.log(JSON.stringify({case:label,status:result.status,found:result.found,verified:result.fullyVerified,recommendations:top.length,checks}));
  }catch(error){result.error=error.message;result.passed=false;console.log(JSON.stringify({case:label,error:error.message}));}
  finally{stream.abort();await collecting;await page.close();await save();}
 }
}catch(error){report.errors.push(error.message);}
finally{
 await browser?.close();if(server.exitCode===null&&server.signalCode===null){const closed=new Promise(r=>server.once('close',r));server.kill();await closed;}await rm(directory,{recursive:true,force:true});
 report.temporaryDataDeleted=true;report.validationComplete=true;report.workflowPassed=!report.errors.length&&report.cases.length===inputs.length&&report.cases.every(c=>c.workflowPassed);report.deliveryGoalsMet=report.cases.every(c=>c.deliveryGoalsMet);report.allResearchComplete=report.cases.every(c=>c.allResearchComplete);report.passed=report.workflowPassed&&report.allResearchComplete;await save();process.exitCode=!report.workflowPassed?1:report.allResearchComplete?0:2;
}
