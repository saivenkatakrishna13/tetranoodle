import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeRunTool, laterPhaseReserve,orderedPipeline} from '../server/pipeline-state.js';

const session = (phase, toolCalls) => ({run: {pipeline: {active: true, phase, toolCalls, maxToolCalls: 100, deadlineAt: Date.now() + 60000}}});

test('Sage cannot spend the calls reserved for Mira ranking and Leo drafting', () => {
  const reserve = laterPhaseReserve({maxToolCalls: 100});
  assert.ok(reserve >= 12 && reserve <= 15);
  assert.throws(() => consumeRunTool(session('eligibility', 100 - reserve), 'sage', 'model_completion'), /tool-call budget/);
  assert.doesNotThrow(() => consumeRunTool(session('eligibility', 100 - reserve - 1), 'sage', 'model_completion'));
});

test('Leo and Mira can still use the reserved calls', () => {
  assert.doesNotThrow(() => consumeRunTool(session('draft', 95), 'leo', 'model_completion'));
  assert.doesNotThrow(() => consumeRunTool(session('rank', 90), 'mira', 'model_completion'));
  assert.throws(() => consumeRunTool(session('draft', 100), 'leo', 'model_completion'), /tool-call budget/);
});

test('tiny budgets are not starved by the reserve', () => {
  assert.equal(laterPhaseReserve({maxToolCalls: 2}), 0);
});


test('source exhaustion still permits the real ordered pipeline to rank and draft once',async()=>{
 const s={profile:{},opportunities:[],run:{id:'reserve-run',status:'running',candidates:[{url:'https://example.edu/program'}],pipeline:{active:false,phase:'profile',cursor:0,toolCalls:0,maxToolCalls:100,maxTimeMs:10000,elapsedMs:0,done:{},started:{},finishedAgents:{},milestones:{},checks:{}}}};
 const phases=[],emit=e=>{if(e.type==='pipeline')phases.push(e.phase);if(e.type==='draft')s.draft=e.content;};
 await orderedPipeline(s,emit,new AbortController().signal,{save:()=>{},needsInput:async()=>false,profile:async()=>consumeRunTool(s,'arjun','model_completion'),discover:async()=>consumeRunTool(s,'nova','search_web'),check:async()=>{while(true)consumeRunTool(s,'sage','model_completion');},rank:async()=>consumeRunTool(s,'mira','model_completion'),draft:async()=>{consumeRunTool(s,'leo','model_completion');consumeRunTool(s,'leo','model_completion');s.draft='Source-constrained DRAFT';}});
 assert.deepEqual(phases,['profile','discovery','eligibility','rank','draft','summary']);
 assert.equal(s.run.pipeline.toolCalls,89);assert.equal(s.run.pipeline.finished,true);assert.ok(s.draft);assert.equal(s.run.status,'partial');
});
