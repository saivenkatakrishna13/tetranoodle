import test from 'node:test';
import assert from 'node:assert/strict';
import {supportedClaim,validateReview,rankOpportunities} from '../server/research.js';
import {sessionFor,saveSession,record} from '../server/store.js';
import {stat,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const url='https://example.edu/msc',fundingUrl='https://example.edu/funding';
const evidence=new Map([[url,{url,title:'MSc Computing',text:'The Master of Science in Computing is a two-year research degree. Applicants need a bachelor degree in computing and IELTS overall 6.5.',retrieved_at:'2026-10-19T12:00:00Z'}],[fundingUrl,{url:fundingUrl,title:'Research funding',text:'All admitted research masters receive a tuition waiver and an annual living stipend.',retrieved_at:'2026-10-19T12:01:00Z'}]]);
const identity={value:'MSc Computing',quote:'The Master of Science in Computing is a two-year research degree.',url};
const base={is_opportunity:true,is_official:true,name:'MSc Computing',university:'Example University',country:'Canada',identity,reason:'Research degree in the requested field',match_components:{academic:30,funding:35,preferences:20,evidence:15}};
test('claims can cite a separate official funding page only if its excerpt was retrieved',()=>{
 assert.ok(supportedClaim({value:'Tuition and living stipend',quote:'All admitted research masters receive a tuition waiver and an annual living stipend.',url:fundingUrl},evidence));
 assert.equal(supportedClaim({value:'Full funding',quote:'All students are fully funded forever.',url:fundingUrl},evidence),null);
});
test('unknown requirements and funding cannot become an unconditional match',()=>{
 const result=validateReview({name:'MSc',url},base,evidence);
 assert.equal(result.eligibility,'conditional');assert.equal(result.funding_status,'unknown');assert.ok(result.score<=55);assert.match(result.funding,/not confirmed/);
});
test('an evidenced unmet criterion overrides the model score',()=>{
 const result=validateReview({name:'MSc',url},{...base,criteria:[{label:'IELTS',value:'IELTS 6.5',quote:'Applicants need a bachelor degree in computing and IELTS overall 6.5.',url,student_value:'IELTS 5.5',status:'not_met'}]},evidence);
 assert.equal(result.eligibility,'not_eligible');assert.ok(result.score<=20);
});
test('ten candidates yield at most five recommendations; expired or ineligible candidates are excluded',()=>{
 const items=Array.from({length:10},(_,i)=>({integrity_checked:true,id:`c${i}`,name:`Program ${i}`,university:`University ${i}`,score:100-i,eligibility:i===0?'not_eligible':'conditional',deadline_state:i===1?'expired':'upcoming'}));
 const ranked=rankOpportunities(items);assert.equal(ranked.filter(x=>x.recommended).length,5);assert.equal(ranked.find(x=>x.id==='c0').recommended,false);assert.equal(ranked.find(x=>x.id==='c1').recommended,false);
 assert.equal(rankOpportunities([...items,items[2]]).length,10);
});
test('research event snapshots do not mutate when the active run advances',async()=>{
 const id=`snapshot-test-${Date.now()}`;const session=sessionFor(id);session.run={status:'running',stage:'discover',candidates:[{name:'Private raw candidate'}]};
 const event=record(session,{type:'run',run:session.run});session.run.stage='verify';assert.equal(event.run.stage,'discover');assert.equal(event.run.candidates,undefined);saveSession(session,true);
 const mode=(await stat(`.data/sessions/${id}.json`)).mode&0o777;assert.equal(mode,0o600);
 const restored=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`import {sessionFor} from './server/store.js';const s=sessionFor('${id}');console.log(JSON.stringify({status:s.run.status,stage:s.run.stage}));`],{encoding:'utf8'}));
 assert.equal(restored.status,'interrupted');assert.equal(restored.stage,'verify');await unlink(`.data/sessions/${id}.json`);
});
test('an official degree program remains a valid opportunity without an award',()=>{
 const review={...base,is_opportunity:undefined,is_official:undefined,source_kind:'degree_program',publisher_is_official:true};
 const result=validateReview({name:'MSc',url},review,evidence);assert.ok(result);assert.equal(result.type,'program');assert.equal(result.funding_status,'unknown');
});
test('an ellipsis appended to an identity excerpt is trimmed only when its full remaining text exists',()=>{
 const result=validateReview({name:'MSc',url},{...base,identity:{...identity,quote:identity.quote+' ...'}},evidence);assert.ok(result);assert.equal(result.identity.quote,identity.quote);
 assert.equal(validateReview({name:'Fake',url},{...base,identity:{...identity,quote:'A completely fabricated degree program name ...'}},evidence),null);
});
test('omitted excerpts require all fragments in the same source and in order',()=>{
 const claim={value:'Research degree requires IELTS',quote:'The Master of Science in Computing ... IELTS overall 6.5.',url};
 assert.ok(supportedClaim(claim,evidence));
 assert.equal(supportedClaim({...claim,quote:'The Master of Science in Computing ... IELTS overall 5.0.'},evidence),null);
 assert.equal(supportedClaim({...claim,quote:'IELTS overall 6.5. ... The Master of Science in Computing'},evidence),null);
});
test('different official listings of one program do not count as distinct opportunities',()=>{
 const items=[{name:'Master of Public Policy (MPP)',university:'University of Erfurt',country:'Germany',url:'https://example.edu/listing',eligibility:'not_eligible',score:20},{name:'Master of Public Policy',university:'University of Erfurt – Willy Brandt School of Public Policy',country:'Germany',url:'https://example.edu/program',eligibility:'conditional',score:60}];
 const result=rankOpportunities(items);assert.equal(result.length,1);assert.equal(result[0].recommended,false);
});
test('an unquoted intake year cannot become a verified deadline',()=>{
 const result=validateReview({name:'MSc',url},{...base,deadline:{value:'1 May 2027',quote:identity.quote,url},deadline_state:'upcoming'},evidence);
 assert.equal(result.claims.deadline,null);assert.equal(result.deadline_state,'unknown');
});

test('institution aliases cannot double-count the same displayed programme',()=>{
 const common={name:'MSc Design for Interaction',university:'TU Delft',country:'Netherlands',eligibility:'conditional',score:60};
 const result=rankOpportunities([{...common,id:'first',url:'https://example.edu/program',dedupe_institution:'TU Delft'},{...common,id:'second',url:'https://example.edu/program/admission',dedupe_institution:'TUDelft'}]);assert.equal(result.length,1);
});

test('an opportunity outside the requested countries is not recommended even with a high score',()=>{
 const result=rankOpportunities([{name:'Outside program',university:'Outside University',score:100,preference_mismatch:true,eligibility:'conditional'},{name:'Requested program',university:'Requested University',score:40,eligibility:'conditional'}]);assert.equal(result[0].name,'Requested program');assert.equal(result.find(o=>o.preference_mismatch).recommended,false);
});
