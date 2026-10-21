import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceIntake,supportedIntakeFields} from '../server/intake.js';
import {runSwarm} from '../server/agents.js';

const makeSession=()=>({profile:{},documents:[],messages:[],events:[],opportunities:[],evidence:new Map(),run:null,facts:[],chatBusy:true});
test('Arjun asks exactly one missing required question and never asks known fields again',()=>{
 const s=makeSession(),events=[];assert.equal(advanceIntake(s,e=>events.push(e)),false);assert.equal(s.pendingQuestion,'degree');assert.equal(s.run.status,'needs_input');
 const replies=events.filter(e=>e.type==='message');assert.equal(replies.length,1);assert.equal(replies[0].message.agent,'arjun');assert.equal(replies[0].message.content.match(/\?/g).length,1);
 s.profile={degree:'B.Des',target_degree:'Master of Interaction Design'};advanceIntake(s,()=>{});assert.equal(s.pendingQuestion,'countries');
});
test('sequential answers preserve original facts and queue research only after all essentials are supplied',async()=>{
 const s=makeSession();advanceIntake(s,()=>{});
 for(const [message,next]of [['Current degree: B.Des. Communication Design','target_degree'],['Intended degree: Master of Interaction Design','countries'],['Preferred countries: Finland, Sweden',null]]){
  const events=[];await runSwarm(s,[],message,e=>events.push(e),new AbortController().signal);
  assert.equal(s.pendingQuestion,next);assert.equal(events.filter(e=>e.type==='message').length,1);assert.equal(events.find(e=>e.type==='message').message.agent,'arjun');
  if(next){assert.equal(s.autoResearch,undefined);assert.equal(s.run.status,'needs_input');}else assert.deepEqual(s.autoResearch,{resume:false});
 }
 assert.equal(s.profile.degree,'B.Des. Communication Design');assert.equal(s.profile.countries,'Finland, Sweden');assert.equal(s.profile.cgpa,undefined);assert.equal(s.profile.nationality,undefined);assert.equal(s.intake.active,false);
});
test('unknown answers, questions and unsupported profile claims remain missing',()=>{
 const message="I don't know. Which countries are affordable?";
 assert.deepEqual(supportedIntakeFields([{key:'countries',value:"I don't know",quote:"I don't know"},{key:'countries',value:'Which countries are affordable?',quote:message},{key:'nationality',value:'Indian',quote:'Indian'}],message),{});
 assert.deepEqual(supportedIntakeFields([{key:'cgpa',value:'8.2 / 10',quote:'My CGPA is 8.2 / 10.'}],'My CGPA is 8.2 / 10.'),{cgpa:'8.2 / 10'});
});
test('cancelling intake saves the supplied details without queuing research',async()=>{
 const s=makeSession();s.profile={degree:'B.Des'};advanceIntake(s,()=>{});await runSwarm(s,[],'Not now',()=>{},new AbortController().signal);
 assert.equal(s.intake,null);assert.equal(s.run.status,'paused');assert.equal(s.profile.degree,'B.Des');assert.equal(s.autoResearch,undefined);
});
