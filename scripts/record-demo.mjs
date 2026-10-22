import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.TETRA_WEB_URL||'http://127.0.0.1:5173';
const primaryWorkspace=process.env.TETRA_RECORDING_PRIMARY_WORKSPACE,alternateWorkspace=process.env.TETRA_RECORDING_ALTERNATE_WORKSPACE;
if(!primaryWorkspace||!alternateWorkspace)throw Error('Set TETRA_RECORDING_PRIMARY_WORKSPACE and TETRA_RECORDING_ALTERNATE_WORKSPACE to two prepared saved students. No deleted demo IDs are assumed.');
const alternateState=await fetch(new URL(`/api/sessions/${alternateWorkspace}`,base)).then(r=>{if(!r.ok)throw Error('The alternate saved workspace is unavailable.');return r.json();});
const alternateName=alternateState.profile?.name||'Unnamed student';
await mkdir('artifacts/raw-recordings',{recursive:true});
const openingWorkspace=process.env.TETRA_RECORDING_OPENING_WORKSPACE||`recording-chat-${Date.now()}`;
if(!process.env.TETRA_RECORDING_OPENING_WORKSPACE){
 const intro=await fetch(new URL('/api/chat',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:openingWorkspace,message:'What is this app for?'}),signal:AbortSignal.timeout(240000)});
 if(!intro.ok)throw Error('Live opening chat could not be prepared.');
 await intro.text();
}
const prepared=await fetch(new URL(`/api/sessions/${openingWorkspace}`,base)).then(r=>r.json());
if(!prepared.messages.some(m=>m.agent==='mira'))throw Error('The opening live reply is missing.');
const openingChatPreparedAt=new Date(prepared.messages.findLast(m=>m.agent==='mira').time).toISOString();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:'artifacts/raw-recordings',size:{width:1440,height:900}}});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const started=Date.now(),scenes=[];
async function caption(title,text){await page.evaluate(({title,text})=>{let el=document.getElementById('demo-caption');if(!el){el=document.createElement('aside');el.id='demo-caption';el.style.cssText='position:fixed;top:85px;left:15px;width:300px;padding:14px 18px;background:#103e34f5;border:1px solid #78d9ad80;border-radius:12px;color:white;font:14px/1.45 system-ui;z-index:10000;pointer-events:none;box-shadow:0 5px 25px #0003';document.body.append(el);}el.replaceChildren();const heading=document.createElement('strong');heading.style.cssText='display:block;color:#87e3b6;font-size:12px;letter-spacing:1px;margin-bottom:5px';heading.textContent=title;const copy=document.createElement('span');copy.textContent=text;el.append(heading,copy);},{title,text});}
async function at(seconds,title,text,action){const wait=seconds*1000-(Date.now()-started);if(wait>0)await page.waitForTimeout(wait);console.log(`${seconds}s ${title}`);scenes.push({seconds,title,text});try{if(action)await action();await caption(title,text);}catch(e){errors.push(`${title}: ${e.message.split('\n')[0]}`);console.log('Scene issue:',title,e.message.split('\n')[0]);}}
const nav=name=>page.getByRole('button',{name,exact:true}).click();
const workspace=id=>page.goto(`${base}/app?workspace=${id}`);
await at(0,'SCHOLARX · REAL LOCAL DEMO','Five AI specialists. One calm group conversation. The opening reply, research and tool activity come from real saved Groq runs.',async()=>{await workspace(openingWorkspace);});
await at(30,'01 · ONE TURN AT A TIME','Mira chooses a relevant speaker and one focused follow-up. The whole team does not ask competing questions.',async()=>{await page.locator('.chat-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);});
await at(48,'02 · FIVE DISTINCT RESPONSIBILITIES','Profile → discovery → official-source checks → application writing → final review. Each specialist contributes an artifact.',async()=>{await nav('Group details');});
await at(65,'03 · STUDENT DOCUMENTS','Uploaded documents and extracted facts remain separate from assumptions. Student achievements are never invented.',async()=>{await workspace(primaryWorkspace);await nav('Your documents');});
await at(90,'04 · THE TEAM’S ACTUAL HANDOFFS','This workspace contains saved live agent messages and tool activity. Research can continue while the browser reconnects.',async()=>{await nav('Group chat');await page.locator('.chat-scroll').evaluate(el=>el.scrollTop=0);});
await at(108,'04 · RESEARCH PROGRESS','Sources are actually fetched with Scrapling. Rate-limit retries and unavailable pages are shown honestly.',async()=>{await page.locator('.chat-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);await nav('Group details');await page.locator('.activity-log').scrollIntoViewIfNeeded();});
await at(130,'05 · REAL OPPORTUNITIES','Top five is a research shortlist. Conditional eligibility and unknown funding are clearly labelled; scores are not admission probabilities.',async()=>{await nav('Close details');await nav('Your matches');});
await at(150,'06 · ELIGIBILITY, WITH GAPS','The agent compares requirements with the student’s known facts. Missing language results, nationality or credits remain unknown.',async()=>{await page.getByText('Eligibility & missing information',{exact:true}).first().click();await page.locator('.criteria-list').first().scrollIntoViewIfNeeded();});
await at(173,'07 · CHECKABLE SOURCE EVIDENCE','Every retained detailed claim has an excerpt, official URL and retrieval date. An excerpt match proves provenance, not guaranteed eligibility.',async()=>{await page.getByText('Source evidence & research priority',{exact:true}).first().click();await page.locator('.evidence-content').first().scrollIntoViewIfNeeded();});
await at(195,'08 · COMPARE POSSIBILITIES','Compare funding, deadlines and fit side by side. The full report can be exported for review.',async()=>{await page.locator('.workspace-view').evaluate(el=>el.scrollTop=0);const boxes=page.locator('.compare-check input');if(await boxes.count()>1){await boxes.nth(0).check();await boxes.nth(1).check();await nav('Compare 2');}});
await at(215,'09 · A DRAFT, NEVER A SUBMISSION','Leo prepares a source-specific application draft. Missing personal stories and achievements stay as placeholders.',async()=>{await nav('Applications');if(await page.locator('.application-paper').count()===0){await workspace(alternateWorkspace);await nav('Applications');}await page.locator('.application-paper').waitFor({timeout:12000});});
await at(239,'10 · A DIFFERENT STUDENT, SAME SYSTEM','Switch student restores the other selected student’s own study goal, countries and saved findings. Their workspaces stay separate.',async()=>{await nav('Chat menu');await nav('Switch student');await page.locator('.saved-student').filter({hasText:alternateName}).first().click();await nav('Your matches');});
await at(259,'10 · LIGHT, DARK OR SYSTEM','Appearance follows your preference across student workspaces. Research uses each student’s own subject, study level and destinations.',async()=>{await nav('Chat menu');await nav('Appearance');await page.getByRole('radio',{name:'Dark',exact:true}).click();await nav('Done');});
await at(278,'11 · A CHAT THAT FITS THE SCREEN','The header and message box stay in place. Only the conversation scrolls. The same workspace works on a phone.',async()=>{await workspace(primaryWorkspace);await page.setViewportSize({width:390,height:844});await page.locator('.chat-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);});
await at(292,'SCHOLARX · YOUR NEXT CHAPTER','Real tools, sequential specialists, source-linked findings and a reviewable draft. Use fictional or consented student profiles for the demonstration.',async()=>{await page.setViewportSize({width:1440,height:900});await nav('Your matches');await page.screenshot({path:'artifacts/demo-desktop.png'});});
await page.waitForTimeout(Math.max(0,300000-(Date.now()-started)));
await page.screenshot({path:'artifacts/demo-final.png'});
const video=page.video();await context.close();await video.saveAs('artifacts/scholarx-5-minute-demo.webm');await video.delete();await browser.close();
await writeFile('artifacts/demo-recording.json',JSON.stringify({recordedAt:new Date().toISOString(),openingChatWorkspace:openingWorkspace,openingChatPreparedAt,openingChatReused:!!process.env.TETRA_RECORDING_OPENING_WORKSPACE,introPreparedBeforeCapture:true,durationSeconds:(Date.now()-started)/1000,liveRecording:true,editedWaits:false,narration:'On-screen captions; no audio',scenes,errors},null,2));
console.log('Recording saved.',{errors,durationSeconds:(Date.now()-started)/1000});
if(errors.length)process.exitCode=1;
