import test from 'node:test';
import assert from 'node:assert/strict';
import {detailSearchPlan,detailQuery,selectSupportingPages} from '../server/research-details.js';

test('detail research searches missing admission instructions and uses the student study level',()=>{
 const proof={value:'A tuition waiver',quote:'A tuition waiver is available for eligible students.',url:'https://example.edu/funding'};
 const previous={funding:proof,deadline:{...proof,quote:'Applications close 15 January 2027.'},requirements:proof,criteria:[{...proof}],application_steps:[]};
 const plan=detailSearchPlan({name:'BA Design'},previous,{intake:'2027'},{level:'bachelor'});
 assert.deepEqual(plan.map(p=>p.topic),['application']);assert.match(plan[0].terms,/undergraduate/);assert.ok(!plan[0].terms.includes('graduate funding'));
 const doctoral=detailSearchPlan({name:'PhD Design'},{},{},{level:'phd'});assert.match(doctoral.find(p=>p.topic==='funding').terms,/doctoral/);assert.equal(doctoral.length,3);
});
test('long programme titles produce short domain-constrained queries retaining the intended intake',()=>{
 const candidate={name:'Master of Computing in Artificial Intelligence'};
 const q=detailQuery('nus.edu.sg',candidate,{terms:'masters admission requirements apply'});
 assert.equal(q,'site:nus.edu.sg Computing Artificial Intelligence masters admission requirements apply');
 const long=detailQuery('example.edu',{name:'The International Master of Science in Sustainable Digital Transformation and Applied Interaction Design'}, {terms:'2027 application deadline'});
 assert.ok(long.split(' ').length<=12);assert.match(long,/site:example\.edu/);assert.match(long,/2027 application deadline/);
});
test('supporting source selection excludes graduate-only pages for a bachelor applicant',()=>{
 const pool=new Map([
  ['grad',{url:'https://example.edu/graduate/design/admissions',title:'Graduate Design admissions',topic:'application',search:true}],
  ['undergrad',{url:'https://example.edu/undergraduate/design/apply',title:'Undergraduate design applications',topic:'application'}],
  ['funding',{url:'https://example.edu/design/funding',title:'Design scholarships',topic:'funding'}]
 ]);
 const selected=selectSupportingPages(pool,{name:'BA Design'},'bachelor','https://example.edu/design',['application']);
 assert.equal(selected.length,1);assert.match(selected[0].url,/undergraduate/);
 const masters=selectSupportingPages(pool,{name:'MSc Design'},'master','https://example.edu/design',['application']);assert.match(masters[0].url,/graduate\/design/);assert.ok(!masters[0].url.includes('undergraduate'));
});
