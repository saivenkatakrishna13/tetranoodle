import test from 'node:test';
import assert from 'node:assert/strict';
import {deadlineState,guardDraft} from '../server/integrity.js';
import {snapshot} from '../server/store.js';
import {reportMarkdown} from '../server/research.js';
test('a past explicitly dated deadline cannot be labelled upcoming by the model',()=>{
 const now=Date.UTC(2026,9,20);
 assert.equal(deadlineState({quote:'Internal deadline: February 25, 2026'},'upcoming',now),'expired');
 assert.equal(deadlineState({quote:'Apply before 1 February 2027'},'upcoming',now),'upcoming');
 assert.equal(deadlineState({quote:'Apply before February 1'},'upcoming',now),'unknown');
 assert.equal(deadlineState({quote:'Application: Call closed. The general deadline is 30 June.'},'expired',now),'expired');
});
test('drafts cannot certify grade conversion or eligibility',()=>{
 const draft='I have a CGPA of 8.2/10. I meet the minimum requirement of 77%.\n\n[Describe an actual project.]';
 const result=guardDraft(draft);assert.ok(result.includes('8.2/10'));assert.ok(!result.includes('I meet'));assert.ok(result.includes('[Confirm academic equivalence'));assert.ok(result.includes('[Describe an actual project.]'));
 const academic=guardDraft('I completed my B.Sc. in Economics with a CGPA of 7.6/10. My undergraduate studies included econometrics and statistics.',{profile:{degree:'B.Sc. Economics',graduation:'2027'}});
 assert.ok(!academic.includes('I completed'));assert.ok(!academic.includes('included econometrics'));assert.ok(academic.includes('[Confirm degree completion'));
 assert.ok(!guardDraft('It also covers digital media and introductory interaction design.').includes('covers digital media'));
 assert.ok(!guardDraft('[Add only supported coursework here.] It also covers digital media.').includes('covers digital media'));
});
test('drafts replace unsupported academic preparation, project outcomes and institutional motivation',()=>{
 const content='I am a final-year B.Tech student with a CGPA of 8.2/10. My undergraduate studies have provided a foundation in algorithms and software development. These experiences have honed my programming skills. I am drawn to Trent’s interdisciplinary approach. Trent’s reputation for fostering collaborative research environments makes it attractive.\n\n[Add your actual project here.]';
 const result=guardDraft(content,{profile:{degree:'Final-year B.Tech Computer Science',cgpa:'8.2/10'}});
 assert.match(result,/8\.2\/10/);assert.match(result,/\[Add your actual project here\.\]/);
 for(const invented of ['foundation in algorithms','honed my programming','interdisciplinary approach','reputation for fostering'])assert.ok(!result.includes(invented));
});
test('restored drafts and reports cannot self-certify ability to cover a scholarship shortfall',()=>{
 const original='My budget is EUR 4000 per year. I have reviewed the scholarship coverage and confirm that I can meet the additional costs not funded by the UTS.';
 const session={profile:{budget:'EUR 4000 per year'},documents:[],messages:[],opportunities:[],events:[],draft:original};
 const shown=snapshot(session).draftDocument,report=reportMarkdown(session);
 for(const text of [shown,report]){assert.match(text,/EUR 4000/);assert.ok(!text.includes('I can meet the additional costs'));assert.match(text,/Confirm a realistic plan/);}
 assert.equal(session.draft,original,'stored progress remains intact');
 assert.equal(guardDraft(shown),shown,'guarding restored content is idempotent');
});
