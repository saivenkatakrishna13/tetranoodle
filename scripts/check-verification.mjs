// Live provider verification benchmark. Originals are read-only; all writes use isolated storage.
import 'dotenv/config';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root=process.cwd(),arg=key=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const label=arg('label')||'after',seedPath=arg('seed');
if(!seedPath||!/^[a-z0-9-]+$/i.test(label))throw Error('Usage: node scripts/check-verification.mjs --seed=<saved fictional workspace.json> --label=after [--budget=480000] [--profile=fixtures/rahul-profile.json]');
const budget=Math.max(15000,Math.min(1800000,Number(arg('budget'))||480000));
const dir=await mkdtemp(path.join(os.tmpdir(),'scholarx-verify-'));
process.env.TETRA_DATA_DIR=dir;process.env.RESEARCH_BUDGET_MS=String(budget);process.env.DRAFT_BUDGET_MS='30000';
const {startResearch,fingerprint}=await import(path.join(root,'server/research.js'));
const {sessionFor,saveSession}=await import(path.join(root,'server/store.js'));
const {researchCoverage}=await import(path.join(root,'server/research-quality.js'));
try{
const seed=JSON.parse(await readFile(path.resolve(seedPath),'utf8'));
const s=sessionFor('rahul-isolated-verification');Object.assign(s,seed,{id:s.id,events:[],messages:[],metrics:[],runHistory:[],evidence:new Map(seed.evidence)});
s.profile=JSON.parse(await readFile(arg('profile')||'fixtures/rahul-profile.json','utf8'));s.run.profileFingerprint=fingerprint(s.profile);s.run.status='partial';
const initial=researchCoverage(s.opportunities,!!s.draft),started=Date.now();
console.log(JSON.stringify({label,initialReady:initial.ready,initialReviewed:initial.reviewed}));
startResearch(s,{resume:true,detailsOnly:true});saveSession(s,true);
const log=setInterval(()=>console.log(JSON.stringify({label,elapsed:Math.round((Date.now()-started)/1000),stage:s.run.stage,ready:researchCoverage(s.opportunities,!!s.draft).ready,activity:s.events.filter(e=>e.type==='activity').at(-1)?.label})),30000);
while(s.run.status==='running')await new Promise(r=>setTimeout(r,1000));clearInterval(log);

const coverage=researchCoverage(s.opportunities,!!s.draft);
const result={label,checkedAt:new Date().toISOString(),realProviders:true,isolated:true,budgetMs:Number(process.env.RESEARCH_BUDGET_MS),elapsedSeconds:Math.round((Date.now()-started)/1000),initial,coverage,status:s.run.status,error:s.run.error||null,items:s.opportunities.map(o=>({name:o.name,university:o.university,country:o.country,url:o.url,recommended:o.recommended,integrity_checked:o.integrity_checked,claims:o.claims,criteria:o.criteria,deadline_state:o.deadline_state,verification:o.verification})),events:s.events.filter(e=>['activity','message'].includes(e.type)).map(e=>e.type==='activity'?{agent:e.agent,label:e.label}:{agent:e.message.agent,content:e.message.content})};
await writeFile(path.join(root,`artifacts/rahul-verification-${label}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify({label,status:result.status,ready:coverage.ready,reviewed:coverage.reviewed,error:result.error}));

}finally{await new Promise(r=>setTimeout(r,500));await rm(dir,{recursive:true,force:true});}
