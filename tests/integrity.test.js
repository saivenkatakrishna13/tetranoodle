import test from 'node:test';
import assert from 'node:assert/strict';
import {deadlineState,guardDraft} from '../server/integrity.js';
test('a past explicitly dated deadline cannot be labelled upcoming by the model',()=>{
 const now=Date.UTC(2026,9,20);
 assert.equal(deadlineState({quote:'Internal deadline: February 25, 2026'},'upcoming',now),'expired');
 assert.equal(deadlineState({quote:'Apply before 1 February 2027'},'upcoming',now),'upcoming');
 assert.equal(deadlineState({quote:'Apply before February 1'},'upcoming',now),'unknown');
});
test('drafts cannot certify grade conversion or eligibility',()=>{
 const draft='I have a CGPA of 8.2/10. I meet the minimum requirement of 77%.\n\n[Describe an actual project.]';
 const result=guardDraft(draft);assert.ok(result.includes('8.2/10'));assert.ok(!result.includes('I meet'));assert.ok(result.includes('[Confirm academic equivalence'));assert.ok(result.includes('[Describe an actual project.]'));
 const academic=guardDraft('I completed my B.Sc. in Economics with a CGPA of 7.6/10. My undergraduate studies included econometrics and statistics.',{profile:{degree:'B.Sc. Economics',graduation:'2027'}});
 assert.ok(!academic.includes('I completed'));assert.ok(!academic.includes('included econometrics'));assert.ok(academic.includes('[Confirm degree completion'));
 assert.ok(!guardDraft('It also covers digital media and introductory interaction design.').includes('covers digital media'));
 assert.ok(!guardDraft('[Add only supported coursework here.] It also covers digital media.').includes('covers digital media'));
});
