import {unlink} from 'node:fs/promises';
import test from 'node:test';import assert from 'node:assert/strict';
import {orderedPipeline,pipelineState,consumeRunTool} from '../server/pipeline-state.js';
import {rankOpportunities,startResearch,discover} from '../server/research.js';
const proof={value:'A supported narrow requirement',quote:'An eligible bachelor degree is required.',url:'https://example.edu/programme',retrieved_at:'2026-10-21T00:00:00Z'};
function setup(count=10){
 const session={id:'fictional-pipeline-unit',profile:{degree:'Bachelor of Arts',target_degree:'Master of Arts',countries:'Germany'},opportunities:[],documents:[],messages:[],evidence:new Map(),run:{id:'run',status:'running',stage:'profile',progress:0,candidates:Array.from({length:count},(_,i)=>({name:`Programme ${i}`,url:`https://example.edu/programme-${i}`,university:`University ${i}`,country:'Germany'}))}};
 const events=[],calls=[],emit=e=>{events.push(structuredClone(e));if(e.type==='message')session.messages.push(e.message);if(e.type==='draft')session.draft=e.content;};
 const deps={save:()=>{},profile:async()=>{calls.push('arjun');session.run.profileReviewed=true;},needsInput:async()=>false,discover:async(n,extra)=>{calls.push(extra?'nova-repair':'nova');return session.run.candidates;},check:async(c)=>{calls.push('sage:'+c.url);session.opportunities.push({id:c.url,...c,score:70,integrity_checked:true,claims:{funding:proof,requirements:proof,application:proof,deadline:null},criteria:[{evidence:proof}],application_step_evidence:[proof],eligibility:'conditional'});return {state:'valid'};},rank:async()=>{calls.push('mira-rank');session.opportunities=rankOpportunities(session.opportunities);},draft:async()=>{calls.push('leo');session.draft='A source-constrained draft with [Missing: personal motivation]';session.draftMeta={method:'ai-reviewed'};}};
 return {session,events,calls,emit,deps};
}
const trace=events=>events.filter(e=>e.type==='pipeline').map(e=>e.phase);
test('progressive eligibility checks every source before critic work and limits detail retries to the shortlist',async()=>{
 const s=setup(),passes=[];s.deps.progressiveChecks=true;
 const original=s.deps.check;
 s.deps.check=async(c,receipt,signal,mode)=>{
  passes.push(mode);
  if(mode==='initial'){
   receipt.basicDone=true;const result=await original(c,receipt,signal);
   s.session.opportunities.find(o=>o.url===c.url).integrity_checked=false;
   return result;
  }
  assert.equal(passes.filter(p=>p==='initial').length,10);
  if(mode==='audit')s.session.opportunities.find(o=>o.url===c.url).integrity_checked=true;
  return {state:'valid'};
 };
 s.deps.auditPriority=()=>s.session.run.candidates.slice(0,5).map(c=>c.url);
 s.deps.auditedEnough=()=>passes.filter(p=>p==='audit').length>=5;
 s.deps.priority=()=>s.session.run.candidates.slice(0,5).map(c=>c.url);
 await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps);
 assert.deepEqual(passes,[...Array(10).fill('initial'),...Array(5).fill('audit'),...Array(5).fill('details')]);
 assert.deepEqual(trace(s.events),['profile','discovery','eligibility','rank','draft','summary']);assert.equal(s.session.run.pipeline.finished,true);
 assert.match(s.session.messages.at(-1).content,/10 checked · 5 independently reviewed/);
});
test('an initial source timeout does not prevent later sources being checked',async()=>{
 const s=setup(3),visited=[];s.deps.progressiveChecks=true;
 s.deps.check=async(c,receipt,signal,mode)=>{visited.push([c.url,mode]);if(c===s.session.run.candidates[0])return new Promise(()=>{});receipt.basicDone=true;return {state:'valid'};};
 s.deps.priority=()=>[];
 await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps,{candidateMs:15});
 assert.equal(visited.filter(([,m])=>m==='initial').length,3);assert.equal(visited.filter(([,m])=>m==='audit').length,2);assert.equal(s.session.run.pipeline.finished,true);assert.equal(s.session.run.pipeline.repairUsed,false);
});
test('ten candidates with missing fields finish in strict order without discovery repair or replacements',async()=>{
 const s=setup(12);await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps);
 assert.deepEqual(trace(s.events),['profile','discovery','eligibility','rank','draft','summary']);assert.equal(s.calls.filter(c=>c==='nova').length,1);assert.equal(s.calls.filter(c=>c==='nova-repair').length,0);assert.equal(s.calls.filter(c=>c.startsWith('sage:')).length,12);assert.equal(s.calls.filter(c=>c==='leo').length,1);
 assert.equal(s.session.run.status,'partial');assert.equal(s.session.run.pipeline.finished,true);assert.equal(s.session.messages.filter(m=>m.content.startsWith('**Partial')).length,1);assert.match(s.session.messages.at(-1).content,/12 source leads found \(10 required\)/);
 const before=s.calls.length;await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps);assert.equal(s.calls.length,before);
 for(const agent of ['arjun','nova','sage','mira','leo'])for(const state of ['started','finished'])assert.equal(s.events.filter(e=>e.type==='agent_lifecycle'&&e.agent===agent&&e.state===state).length,1,agent+' '+state);
});
test('only dead or clearly ineligible candidates permit one Nova shortfall round inside eligibility',async()=>{
 const s=setup();let i=0;s.deps.check=async()=>({state:++i<=2?'dead':'valid'});
 s.deps.discover=async(n,extra)=>{s.calls.push([n,extra]);if(!extra)return s.session.run.candidates;const added=[{url:'https://example.edu/extra-a'},{url:'https://example.edu/extra-b'}];s.session.run.candidates.push(...added);return added;};
 await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps);assert.deepEqual(s.calls.filter(Array.isArray),[[10,false],[2,true]]);assert.equal(s.session.run.pipeline.repairUsed,true);assert.equal(i,12);assert.deepEqual(trace(s.events),['profile','discovery','eligibility','rank','draft','summary']);
});
test('candidate timeout is partial, not dead, and never triggers Nova repair',async()=>{
 const s=setup(1);let signal;s.deps.check=async(_c,_receipt,child)=>{signal=child;return new Promise(()=>{});};
 await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps,{candidateMs:10});const receipt=Object.values(s.session.run.pipeline.checks)[0];assert.equal(signal.aborted,true);assert.equal(receipt.state,'partial');assert.equal(receipt.checked,true);assert.match(receipt.reason,/45-second|45 seconds/);assert.equal(s.calls.includes('nova-repair'),false);assert.equal(s.session.run.pipeline.finished,true);
});
test('tool budget terminates gracefully, produces one final summary and never exceeds its limit',async()=>{
 const s=setup();const p=pipelineState(s.session);p.maxToolCalls=2;
 s.deps.profile=async()=>consumeRunTool(s.session,'arjun','model_completion');s.deps.discover=async()=>{consumeRunTool(s.session,'nova','search_web');return s.session.run.candidates;};
 s.deps.check=async()=>{throw Error('Sage should not start network work once tools are exhausted.');};
 await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps);assert.equal(p.toolCalls,2);assert.equal(p.finished,true);assert.equal(s.session.run.status,'partial');assert.equal(s.session.messages.filter(m=>m.content.startsWith('**Partial')).length,1);assert.equal(s.events.some(e=>/interrupted/i.test(e.message?.content||'')),false);
});
test('role guards reject Nova source verification, Sage discovery after completion, and Leo web tools',()=>{
 const s=setup();const p=pipelineState(s.session);Object.assign(p,{active:true,phase:'eligibility',deadlineAt:Date.now()+1000});
 assert.throws(()=>consumeRunTool(s.session,'nova','search_web'),/cannot work/);consumeRunTool(s.session,'sage','read_page');p.phase='draft';assert.throws(()=>consumeRunTool(s.session,'sage','read_page'),/cannot work/);
 // Leo may call the model, never a web tool.
 assert.throws(()=>consumeRunTool(s.session,'leo','search_web'),/cannot|web|allowed/);
});
test('manual pause preserves the cursor and completed agents; Resume does not rerun profile or discovery',async()=>{
 const s=setup(1),controller=new AbortController();let first=true;
 s.deps.check=async()=>{if(first){first=false;controller.abort();throw new DOMException('Paused','AbortError');}return {state:'valid'};};
 await orderedPipeline(s.session,s.emit,controller.signal,s.deps);assert.equal(s.session.run.status,'paused');assert.equal(s.session.run.pipeline.cursor,2);const before=s.calls.slice();s.session.run.status='running';
 await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps);assert.equal(s.calls.filter(c=>c==='arjun').length,1);assert.equal(s.calls.filter(c=>c==='nova').length,1);assert.deepEqual(s.calls.slice(0,before.length),before);assert.equal(s.session.run.pipeline.finished,true);
});
test('a saved finished pipeline cannot be restarted by Resume or Verify missing details',async()=>{
 const s=setup().session;s.run.pipeline={version:1,cursor:6,summaryPosted:true,finished:false};s.run.coverage={complete:false};const profile=JSON.stringify(s.profile);
 assert.equal(startResearch(s,{resume:true}),s.run);assert.equal(s.run.pipeline.finished,true);assert.equal(s.run.status,'partial');assert.equal(JSON.stringify(s.profile),profile);await unlink('.data/sessions/'+s.id+'.json').catch(()=>{});
});
test('a hung discovery is bounded by the total run budget and ends with one partial summary',async()=>{
 const s=setup(0),p=pipelineState(s.session);p.maxTimeMs=60;let child;
 s.deps.discover=async(_n,_extra,signal)=>{child=signal;return new Promise(()=>{});};
 const began=Date.now();await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps);
 assert.ok(Date.now()-began<300);assert.equal(child.aborted,true);assert.equal(p.finished,true);assert.equal(p.active,false);assert.ok(p.elapsedMs<=p.maxTimeMs+30);
 assert.equal(s.session.messages.filter(m=>m.content.startsWith('**Partial')).length,1);assert.deepEqual(trace(s.events),['profile','discovery','eligibility','rank','draft','summary']);
});
test('ranking or drafting failures still close the run once, without restarting source work',async()=>{
 const s=setup(1);s.deps.rank=async()=>{throw Error('Ranking unavailable');};s.deps.draft=async()=>{throw Error('Draft unavailable');};
 await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps);
 assert.equal(s.session.run.pipeline.finished,true);assert.equal(s.session.run.status,'partial');assert.equal(s.session.messages.filter(m=>m.content.startsWith('**Partial')).length,1);
 assert.match(s.session.messages.at(-1).content,/Draft unavailable/);assert.equal(s.calls.filter(c=>c==='nova').length,1);
});
test('pausing during Leo preserves the completed shortlist and resumes only the draft',async()=>{
 const s=setup(1),controller=new AbortController();let attempt=0;
 s.deps.draft=async()=>{if(++attempt===1){controller.abort();throw controller.signal.reason;}s.session.draft='Saved draft';};
 await orderedPipeline(s.session,s.emit,controller.signal,s.deps);assert.equal(s.session.run.status,'paused');assert.equal(s.session.run.pipeline.cursor,4);
 s.session.run.status='running';await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps);
 assert.equal(s.calls.filter(c=>c==='mira-rank').length,1);assert.equal(s.calls.filter(c=>c==='nova').length,1);assert.equal(attempt,2);assert.equal(s.session.run.pipeline.finished,true);
 assert.equal(s.events.filter(e=>e.type==='agent_lifecycle'&&e.agent==='leo'&&e.state==='started').length,1);
});
test('real discovery returns immediately with ten saved URL-backed candidates',async()=>{
 const s=setup();const before=structuredClone(s.session.run.candidates),events=[];
 const result=await discover(s.session,e=>events.push(e),new AbortController().signal);
 assert.deepEqual(result,before);assert.equal(events.length,0);assert.equal(s.session.run.discoveryPasses,undefined);
});
test('even an unavailable draft fallback cannot outlive the total budget',async()=>{
 const s=setup(0),p=pipelineState(s.session);p.maxTimeMs=60;let attempts=0;
 s.deps.draft=async()=>{attempts++;return new Promise(()=>{});};
 const began=Date.now();await orderedPipeline(s.session,s.emit,new AbortController().signal,s.deps);
 assert.ok(Date.now()-began<300);assert.equal(attempts,1);assert.equal(p.finished,true);assert.equal(s.session.run.status,'partial');assert.equal(s.events.filter(e=>e.type==='pipeline'&&e.phase==='summary').length,1);
});
test('a restarted worker clears its active scope and cannot reset run or candidate budgets',()=>{
 const s=setup(),p=pipelineState(s.session),now=Date.now();
 Object.assign(p,{active:true,activeSince:now-300,elapsedMs:100,maxTimeMs:1000,currentCandidate:'first',candidateDeadlineAt:now+100,checks:{first:{state:'pending',spentMs:500,activeSince:now-200}}});s.session.run.status='interrupted';
 pipelineState(s.session);assert.equal(p.active,false);assert.ok(p.elapsedMs>=400&&p.elapsedMs<500);assert.ok(p.checks.first.spentMs>=700&&p.checks.first.spentMs<800);assert.equal(p.currentCandidate,undefined);assert.equal(p.activeSince,undefined);
});
