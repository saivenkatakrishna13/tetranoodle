// Re-run only Leo for a consented saved profile, using its existing sources.
// No discovery/profile edits and no original workspace writes during validation.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import net from 'node:net';
import {chromium,expect} from '@playwright/test';
const workspace=process.argv.find(a=>a.startsWith('--workspace='))?.split('=')[1];
if(!/^[\w-]{12,80}$/.test(workspace||''))throw Error('Supply --workspace=<consented saved workspace ID>.');
const source=path.resolve('.data/sessions',workspace+'.json'),original=await readFile(source),seed=JSON.parse(original),hash=b=>createHash('sha256').update(b).digest('hex');
const chosen=seed.opportunities.find(o=>o.recommended&&o.integrity_checked);if(!chosen)throw Error('A saved independently reviewed opportunity is needed.');
await mkdir('.data/qa',{recursive:true,mode:0o700});const directory=await mkdtemp(path.resolve('.data/qa/current-sop-')),id=randomUUID();seed.id=id;
await writeFile(path.join(directory,id+'.json'),JSON.stringify(seed),{mode:0o600});
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),TETRA_DATA_DIR:directory},stdio:'ignore'});
const report={checkedAt:new Date().toISOString(),isolatedStorage:true,realLeoApi:true,opportunity:{id:chosen.id,name:chosen.name,url:chosen.url},before:{genericMissing:(seed.draft.match(/Missing: add a supported statement here/g)||[]).length,characters:seed.draft.length},errors:[]};
const request=async(url,body)=>{const response=await fetch(base+url,{signal:AbortSignal.timeout(70000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.error||response.status);return value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let browser;
try{
 let state;for(let i=0;i<100;i++){try{state=await request(`/api/sessions/${id}`);break;}catch{await sleep(100);}}if(!state)throw Error('Isolated API did not start.');
 const cursor=state.cursor,runBefore=JSON.stringify(state.run),started=Date.now();await request(`/api/sessions/${id}/draft`,{opportunityId:chosen.id});state=await request(`/api/sessions/${id}`);
 const body=state.draftDocument.split('## Supported student facts')[0];
 report.after={method:state.draftMeta.method,elapsedMs:Date.now()-started,characters:state.draftDocument.length,narrativeWords:body.split(/\s+/).length,genericMissing:(state.draftDocument.match(/Missing: add a supported statement here/g)||[]).length,sources:state.draftMeta.sources.map(({id,kind})=>({id,kind})),blocked:state.draftMeta.blockedClaims?.length||0};
 const saved=JSON.parse(await readFile(path.join(directory,id+'.json'),'utf8')),events=saved.events.filter(e=>e.sequence>cursor);
 report.checks={leoArranged:state.draftMeta.method==='source-grounded-ai-arranged',noOtherAgentCalls:events.filter(e=>e.type==='metric').every(e=>e.agent==='leo'),noResearchRestart:JSON.stringify(state.run)===runBefore&&!events.some(e=>e.type==='pipeline'||e.type==='research_reset'),noSearch:!events.some(e=>e.type==='activity'&&/Searching:|browser search|Exploring GitHub/.test(e.label||'')),studentFactsCited:state.draftMeta.sources.some(s=>s.kind==='student'),githubCited:state.draftMeta.sources.some(s=>s.kind==='github'),documentCited:state.draftMeta.sources.some(s=>s.kind==='document'),officialCited:state.draftMeta.sources.some(s=>s.kind==='official'),narrativeHasCitations:/\[\^S\d+\]/.test(body)&&/\[\^O\d+\]/.test(body),noGenericMissing:report.after.genericMissing===0,oneGapsList:(state.draftDocument.match(/## Gaps to complete/g)||[]).length===1,noEmptyDraftHeadings:!state.draftDocument.includes('# Draft section'),appendicesPreserved:state.draftDocument.includes('## Supported student facts')&&state.draftDocument.includes('## Opportunity evidence for your review'),draftOnly:state.draftDocument.includes('Draft only. Verify on the official site'),originalUnchanged:hash(await readFile(source))===hash(original)};
 await writeFile(path.join(directory,'draft.md'),state.draftDocument,{mode:0o600});
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(`${base}/app?workspace=${id}`);await page.getByRole('button',{name:'Applications',exact:true}).click();await expect(page.locator('.application-paper')).toContainText('Gaps to complete');
 report.checks.renderedFootnotes=await page.locator('.application-paper a[data-footnote-ref]').count()>0;
 report.checks.bannerVisible=await page.locator('.draft-notice').filter({hasText:'Draft only.'}).isVisible();
 report.passed=Object.values(report.checks).every(Boolean)&&!report.errors.length;if(!report.passed)process.exitCode=1;
 console.log(JSON.stringify(report));console.log('Private draft: '+path.join(directory,'draft.md'));
}catch(error){report.errors.push(error.message);process.exitCode=1;}
finally{await browser?.close();server.kill('SIGTERM');await writeFile('artifacts/current-sop-validation.json',JSON.stringify(report,null,2));}
