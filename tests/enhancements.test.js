import {createDraft} from '../server/research.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {assertEvidence,assertStudentProfile,evidenceLabel} from '../shared/models.js';
import {sourceTrust} from '../server/source-trust.js';
import {validateDraft} from '../server/draft-validation.js';
import {executeTool} from '../server/tools.js';
import {fundingFit,validateCosts,deadlineInfo,profileStrength,applicationPlan} from '../shared/match-planning.js';
import {archiveRun,diffRuns,reopenRun} from '../server/run-history.js';
import {missingRequests,askMissing,resolveMissing} from '../server/missing-info.js';
import {recordMetric,aggregateMetrics} from '../server/run-metrics.js';
import {localizedDraft} from '../server/draft-languages.js';
import {sopDocx} from '../server/exports.js';
import {extractDocx} from '../server/documents.js';
test('shared contracts reject missing provenance and operational profile data',()=>{
 assert.throws(()=>assertEvidence({value:'Unknown',url:'https://example.edu'}),/Evidence/);
 assert.throws(()=>assertStudentProfile({name:'Fictional',run:{}}),/strings/);
 assert.equal(evidenceLabel(null),'Missing');assert.equal(evidenceLabel({},false),'Unverified');assert.equal(evidenceLabel({},true),'Verified');
});
test('source trust requires ownership review, never just an academic-looking URL',()=>{
 assert.equal(sourceTrust('https://example.edu').kind,'aggregator');assert.equal(sourceTrust('https://example.edu',{official:true}).score,95);assert.equal(sourceTrust('https://medium.com/story').kind,'blog');assert.equal(sourceTrust('not a URL').score,null);
});
test('arbitrary unsupported draft claims are blocked even with a known source URL',async()=>{
 const opportunity={id:'sample',name:'Sample Programme',university:'Sample Provider',url:'https://example.edu',integrity_checked:true,claims:{}};
 const s={profile:{degree:'Final-year B.Des'},facts:[],opportunities:[opportunity],evidence:new Map([[opportunity.url,{text:'Source page'}]])};
 const checked=validateDraft('I published 12 papers in 2025.',s,opportunity);assert.ok(!checked.content.includes('published 12'));assert.equal(checked.blocked.length,1);assert.ok(checked.content.includes('Final-year B.Des'));
 const events=[];await executeTool('save_application_draft',{url:opportunity.url,content:'I published 12 papers in 2025.'},s,e=>events.push(e),'leo',new AbortController().signal);assert.ok(!s.draft.includes('published 12'));assert.equal(s.draftMeta.validation,'source-constrained');
 s.opportunities=[];await assert.rejects(executeTool('save_application_draft',{url:opportunity.url,content:'A draft'},s,()=>{},'leo',new AbortController().signal),/independently reviewed/);
});
test('empty Tavily falls through Serper and Brave, then same-query cache after outages',async()=>{
 const keys=['TAVILY_API_KEY','SERPER_API_KEY','BRAVE_SEARCH_API_KEY','SEARCH_PROVIDER','GROQ_API_KEY','GROQ_API_KEY_NOVA'],old=keys.map(k=>process.env[k]),original=globalThis.fetch;
 const s={},events=[],signal=new AbortController().signal;let offline=false;const called=[];
 try{
  for(const key of keys.slice(0,3))process.env[key]='test-not-a-key';process.env.SEARCH_PROVIDER='ddgs';process.env.GROQ_API_KEY='';process.env.GROQ_API_KEY_NOVA='';
  globalThis.fetch=async url=>{called.push(String(url));if(offline)return new Response('{}',{status:503});return new Response(JSON.stringify(String(url).includes('tavily')?{results:[]}:String(url).includes('serper')?{organic:[]}:{web:{results:[{url:'https://example.edu/program',title:'Fixture source'}]}}));};
  const dependencies={searchWorker:async()=>{throw Error('offline');}};
  const result=await executeTool('search_web',{query:'fixture query'},s,e=>events.push(e),'nova',signal,dependencies);assert.equal(result.provider,'Brave');assert.equal(called.length,3);assert.ok(events.some(e=>e.state==='recovery'));
  offline=true;const cached=await executeTool('search_web',{query:'fixture query'},s,()=>{},'nova',signal,dependencies);assert.equal(cached.cached,true);
  await assert.rejects(executeTool('search_web',{query:'different query'},s,()=>{},'nova',signal,dependencies),/unavailable/);
 }finally{globalThis.fetch=original;keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
});
test('demo search actually skips the failed provider and recovery waits for receipts',async()=>{
 const keys=['TAVILY_API_KEY','SERPER_API_KEY','BRAVE_SEARCH_API_KEY','SEARCH_PROVIDER','GROQ_API_KEY_NOVA'],old=keys.map(k=>process.env[k]);let workerCalls=0;const events=[],s={demoFailures:{searchOnce:true}};
 try{for(const k of keys.slice(0,3))delete process.env[k];process.env.SEARCH_PROVIDER='ddgs';process.env.GROQ_API_KEY_NOVA='test-not-a-key';
  const result=await executeTool('search_web',{query:'fixture'},s,e=>events.push(e),'nova',new AbortController().signal,{searchWorker:async()=>{workerCalls++;return {};},searchCompletion:async()=>({executed_tools:[{search_results:[{url:'https://example.edu/fixture'}]}]})});
  assert.equal(workerCalls,0);assert.equal(s.demoFailures.searchOnce,false);assert.equal(result.provider,'Groq browser_search');assert.ok(events.find(e=>e.demo&&e.state==='failure'));assert.ok(events.at(-1).state==='recovery');
 }finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
});
test('funding gap requires compatible cited amounts and never substitutes a country average',()=>{
 assert.equal(fundingFit(null).gap,null);const evidence={url:'https://example.edu',quote:'Tuition EUR 10000 per year.',retrieved_at:new Date().toISOString()};
 const costs={tuition:{amount:10000,currency:'EUR',period:'year',evidence},living:{amount:12000,currency:'EUR',period:'year',evidence},funding:{amount:18000,currency:'EUR',period:'year',evidence}};
 assert.equal(fundingFit(costs).gap,4000);assert.equal(fundingFit({...costs,living:{...costs.living,currency:'CAD'}}).gap,null);assert.equal(fundingFit({...costs,living:{...costs.living,period:'month'}}).gap,null);
 const pages=new Map([[evidence.url,{...evidence,text:evidence.quote}]]);assert.equal(validateCosts({tuition:{amount:10000,currency:'EUR',period:'year',url:evidence.url,quote:evidence.quote}},pages).tuition.amount,10000);assert.equal(validateCosts({tuition:{amount:9000,currency:'EUR',period:'year',url:evidence.url,quote:evidence.quote}},pages).tuition,undefined);
});
test('countdown uses source dates, rejects impossible or yearless dates, and marks closing soon',()=>{
 const now=Date.UTC(2026,9,21),o={claims:{deadline:{quote:'Apply before 1 November 2026.',value:'1 November 2026'}}};assert.equal(deadlineInfo(o,now).status,'Closing soon');assert.equal(deadlineInfo(o,now).date,'2026-11-01');
 assert.equal(deadlineInfo({claims:{deadline:{quote:'Apply before 31 February 2027',value:'31 February 2027'}}},now).status,'Missing');assert.equal(deadlineInfo({claims:{deadline:{quote:'Apply before 1 November',value:'1 November'}}},now).date,null);
});
test('run archives preserve distinct packs and diff/reopen without overwriting source history',()=>{
 const s={profile:{target_degree:'Master of Design'},documents:[],evidence:new Map(),run:{id:'first',status:'partial'},opportunities:[{id:'one',name:'First',url:'https://example.edu/one',score:30}],draft:'Saved draft'};archiveRun(s);
 s.run={id:'second',status:'completed'};s.opportunities=[{id:'two',name:'Second',url:'https://example.edu/two',score:40}];archiveRun(s);
 assert.deepEqual(diffRuns(s.runHistory[1],s.runHistory[0]).added,['Second']);reopenRun(s,'first');assert.equal(s.opportunities[0].name,'First');assert.equal(s.run.reopenedFrom,'first');assert.equal(s.runHistory.length,2);s.opportunities[0].name='Edited';assert.equal(s.runHistory.find(r=>r.id==='first').opportunities[0].name,'First');
});
test('Sage resolves only unknown student fields tied to source-backed criteria',()=>{
 const proof={url:'https://example.edu',value:'IELTS 6.5',quote:'An IELTS overall score of 6.5 is required.'};const s={profile:{},opportunities:[{id:'a',criteria:[{label:'IELTS',required:'6.5',status:'unknown',evidence:proof}]},{id:'b',criteria:[{label:'Portfolio',status:'unknown'}]},{id:'c',criteria:[{label:'IELTS',required:'6.5',status:'met',evidence:proof}]}]};
 assert.equal(missingRequests(s).length,1);const events=[];askMissing(s,e=>events.push(e));assert.deepEqual(s.pendingEligibility.ids,['a']);assert.ok(events[0].message.content.includes(proof.url));assert.equal(s.opportunities.length,3);
});
test('usage meter uses actual response counts and Missing when prices or tokens are absent',()=>{
 const events=[];recordMetric(e=>events.push(e),'sage','fixture-model',Date.now()-10,{prompt_tokens:120,completion_tokens:30},true);recordMetric(e=>events.push(e),'sage','fixture-model',Date.now(),null,false);const m=aggregateMetrics(events).sage;assert.equal(m.requests,2);assert.equal(m.inputTokens,120);assert.equal(m.outputTokens,30);assert.equal(m.unknownUsage,1);assert.equal(m.unknownCost,2);
});
test('optional eligibility answer rechecks only affected IDs and retains a retry after provider failure',async()=>{
 const proof={url:'https://example.edu/fixture',quote:'An IELTS overall score is required.',value:'IELTS 6.5'};
 const item={id:'affected',name:'Programme',university:'Provider',url:proof.url,integrity_checked:true,claims:{requirements:proof},criteria:[{label:'IELTS',required:'IELTS 6.5',status:'unknown',evidence:proof}],score:40,eligibility:'conditional'};
 const unaffected={...item,id:'other',name:'Other programme',url:'https://example.edu/other',criteria:[]};
 const s={profile:{degree:'B.Des',target_degree:'Master of Design',countries:'Finland'},opportunities:[item,unaffected],pendingEligibility:{field:'language_scores',ids:['affected']},run:{id:'run',status:'partial'},evidence:new Map(),draft:'Old draft',draftMeta:{opportunityId:'affected'}};
 const seen=[];const deps={readAnswer:async()=>({profile:{language_scores:'IELTS 7.0'}}),review:async()=>{throw Error('Provider unavailable');},audit:async()=>{}};
 await assert.rejects(resolveMissing(s,'IELTS 7.0',()=>{},new AbortController().signal,deps),/unavailable/);assert.equal(s.pendingEligibility.answerSaved,true);assert.equal(s.profile.language_scores,'IELTS 7.0');
 deps.review=async candidate=>{seen.push(candidate.url);return {...item,criteria:[{...item.criteria[0],status:'met',student_value:'IELTS 7.0'}]};};
 await resolveMissing(s,'retry',()=>{},new AbortController().signal,deps);assert.deepEqual(seen,[item.url]);assert.equal(s.opportunities.find(o=>o.id==='other').url,unaffected.url);assert.equal(s.pendingEligibility,null);assert.equal(s.draft,'');
});
test('multilingual drafts preserve original facts, sources and draft-only status; DOCX round-trips Unicode',()=>{
 const s={profile:{name:'Fictional Student',degree:'B.Des'}},o={name:'Fixture Programme',claims:{requirements:{quote:'A portfolio is required.',url:'https://example.edu',retrieved_at:'2026-10-21'}}};
 const content=localizedDraft(s,o,'hi');assert.ok(content.includes('आवेदन'));assert.ok(content.includes('B.Des'));assert.ok(content.includes('https://example.edu'));assert.ok(content.includes('Missing'));assert.ok(extractDocx(sopDocx(content)).includes('आवेदन'));assert.throws(()=>localizedDraft(s,o,'invalid'),/Unsupported/);
 assert.ok(profileStrength({}).score===0);const tasks=applicationPlan({id:'fixture',application_step_evidence:[o.claims.requirements]},{});assert.equal(tasks.length,1);const changed=applicationPlan({id:'fixture',application_step_evidence:[{...o.claims.requirements,value:'Provide two different documents'}]},{[tasks[0].id]:true});assert.equal(changed[0].done,false);
});

test('saved language preference survives subsequent draft generation without calling an unrelated language model',async()=>{
 const o={id:'language-fixture',name:'Fixture Programme',university:'Fixture Provider',url:'https://example.edu',integrity_checked:true,claims:{}};const s={profile:{degree:'B.Des'},draftOptions:{language:'fr'},evidence:new Map([[o.url,{text:'Source'}]]),documents:[],draft:''};
 await createDraft(s,o,event=>{if(event.type==='draft')s.draft=event.content;},new AbortController().signal);assert.match(s.draft,/Brouillon/);assert.equal(s.draftMeta.language,'fr');assert.equal(s.draftMeta.validation,'source-constrained');
});
