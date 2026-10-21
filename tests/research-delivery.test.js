import test from 'node:test';
import assert from 'node:assert/strict';
import {withinBudget,needsMoreCandidates,profileDraft} from '../server/research-delivery.js';
import {createDraft} from '../server/research.js';
const opportunity={id:'verified-program',integrity_checked:true,name:'MSc Interaction Design',university:'Example University',url:'https://example.edu/design'};
const makeSession=()=>({profile:{name:'Fictional Student',degree:'Final-year B.Des',cgpa:'8.6 / 10',budget:'EUR 4000 per year'},evidence:new Map([[opportunity.url,{text:'Official programme source.'}]]),draft:''});
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
 assert.equal(s.draftMeta.method,'profile-template');assert.match(s.draft,/8\.6 \/ 10/);assert.match(s.draft,/EUR 4000/);assert.match(s.draft,/not a newly AI-reviewed statement/);assert.match(s.draft,/\[Describe one genuine project/);assert.ok(!s.draft.includes('I meet'));assert.ok(events.some(e=>e.type==='typing'&&e.agent===null));
});
test('manually pausing a draft never silently produces a scaffold',async()=>{
 const s=makeSession(),controller=new AbortController();const draft=createDraft(s,opportunity,()=>{},controller.signal,{budgetMs:100,generate:()=>new Promise(()=>{})});controller.abort();await assert.rejects(draft,{name:'AbortError'});assert.equal(s.draft,'');assert.equal(s.draftMeta,undefined);
});
test('unchecked discoveries cannot be used to prepare even a fallback scaffold',async()=>{
 const s=makeSession();await assert.rejects(createDraft(s,{...opportunity,integrity_checked:false},()=>{},new AbortController().signal),/successfully reviewed/);assert.equal(s.draft,'');
 assert.ok(!profileDraft({},opportunity).includes('Fictional Student'));
});
