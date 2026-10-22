import test from 'node:test';
import assert from 'node:assert/strict';
import {withinBudget,needsMoreCandidates,profileDraft} from '../server/research-delivery.js';
import {createDraft,startResearch,stopResearch,fingerprint,discover} from '../server/research.js';
import {researchBrief,discoveryQueries} from '../server/profile.js';
import {sessionFor,saveSession,record} from '../server/store.js';
import {advanceIntake} from '../server/intake.js';
import {unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const opportunity={id:'verified-program',integrity_checked:true,name:'MSc Interaction Design',university:'Example University',url:'https://example.edu/design'};
const makeSession=()=>({profile:{name:'Fictional Student',degree:'Final-year B.Des',cgpa:'8.6 / 10',budget:'EUR 4000 per year'},evidence:new Map([[opportunity.url,{text:'Official programme source.'}]]),draft:''});
test('exhausted replacement queries preserve checked sources and continue instead of interrupting',async()=>{
 const profile={degree:'B.Tech Computer Science',target_degree:'Master of Computer Science',countries:'Canada'},brief=researchBrief(profile),events=[];
 const s={profile,researchBrief:brief,opportunities:[opportunity],run:{queries:discoveryQueries([],brief,9),attempted:[opportunity.url]},searchResults:{old:[{url:opportunity.url}]}};
 const results=await discover(s,e=>events.push(e),new AbortController().signal,15,true);
 assert.deepEqual(results,[]);assert.equal(s.run.searchExhausted,true);assert.equal(s.opportunities[0],opportunity);assert.match(events.at(-1).label,/already been checked.*Continuing verification/);
 assert.ok(!JSON.stringify(events).includes('TAVILY_API_KEY'));
});
test('repeated start requests do not duplicate the pending required-profile question',async()=>{
 const s=sessionFor(randomUUID());advanceIntake(s,event=>record(s,event));const before=s.messages.length;
 try{const run=s.run;assert.equal(startResearch(s),run);assert.equal(startResearch(s),run);assert.equal(s.messages.length,before);assert.equal(s.run.status,'needs_input');}
 finally{saveSession(s,true);await unlink(`.data/sessions/${s.id}.json`).catch(()=>{});}
});
test('unknown deadlines alone do not launch more discovery waves',()=>{
 assert.equal(needsMoreCandidates({suitable:10,recommended:5,ready:0}),false);
 assert.equal(needsMoreCandidates({suitable:9,recommended:5,ready:5}),true);
 assert.equal(needsMoreCandidates({suitable:10,recommended:4,ready:4}),true);
});
test('a hung preparation step is bounded and aborts its work',async()=>{
 let child;await assert.rejects(withinBudget(signal=>{child=signal;return new Promise(()=>{});},10,new AbortController().signal),{name:'TimeoutError'});assert.equal(child.aborted,true);
});
test('rate-limited drafting delivers a labelled scaffold with exact profile facts',async()=>{
 const s=makeSession(),events=[],emit=e=>{events.push(e);if(e.type==='draft')s.draft=e.content;};
 await createDraft(s,opportunity,emit,new AbortController().signal,{budgetMs:10,generate:()=>new Promise(()=>{})});
 assert.equal(s.draftMeta.method,'profile-template');assert.match(s.draft,/8\.6 \/ 10/);assert.match(s.draft,/EUR 4000/);assert.match(s.draft,/not a newly AI-reviewed statement/);assert.match(s.draft,/\[If supplied, describe one genuine project/);assert.ok(!s.draft.includes('I meet'));assert.ok(events.some(e=>e.type==='typing'&&e.agent===null));
});
test('manually pausing a draft never silently produces a scaffold',async()=>{
 const s=makeSession(),controller=new AbortController();const draft=createDraft(s,opportunity,()=>{},controller.signal,{budgetMs:100,generate:()=>new Promise(()=>{})});controller.abort();await assert.rejects(draft,{name:'AbortError'});assert.equal(s.draft,'');assert.equal(s.draftMeta,undefined);
});
test('unchecked discoveries cannot be used to prepare even a fallback scaffold',async()=>{
 const s=makeSession();await assert.rejects(createDraft(s,{...opportunity,integrity_checked:false},()=>{},new AbortController().signal),/successfully reviewed/);assert.equal(s.draft,'');
 assert.ok(!profileDraft({},opportunity).includes('Fictional Student'));
});
test('pausing in the same turn as start never begins profile or internet work',async()=>{
 const s=sessionFor(randomUUID());s.profile={degree:'B.Des',target_degree:'Master of Design',countries:'Finland'};
 try{startResearch(s);assert.equal(await stopResearch(s),true);assert.equal(s.run.status,'paused');assert.ok(!s.events.some(e=>e.type==='activity'));assert.equal(s.run.profileReviewed,undefined);}
 finally{saveSession(s,true);await unlink(`.data/sessions/${s.id}.json`).catch(()=>{});}
});
test('detail-only verification rejects stale profiles and active chat without clearing findings',()=>{
 const s={...makeSession(),opportunities:[opportunity],draft:'Existing reviewed draft',run:{profileFingerprint:fingerprint({degree:'Different student'})}};
 assert.throws(()=>startResearch(s,{detailsOnly:true}),/profile changed/);assert.equal(s.draft,'Existing reviewed draft');assert.equal(s.opportunities[0],opportunity);
 s.chatBusy=true;assert.throws(()=>startResearch(s,{resume:true}),/current reply/);assert.equal(s.draft,'Existing reviewed draft');
});
