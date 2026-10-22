import test from 'node:test';
import assert from 'node:assert/strict';
import {detailSearchPlan,detailQuery,selectSupportingPages,detailPassages,deepenReview} from '../server/research-details.js';

test('detail research searches missing admission instructions and uses the student study level',()=>{
 const proof={value:'A tuition waiver',quote:'A tuition waiver is available for eligible students.',url:'https://example.edu/funding'};
 const previous={funding:proof,deadline:{...proof,quote:'Applications close 15 January 2027.'},requirements:proof,criteria:[{...proof}],application_steps:[]};
 const plan=detailSearchPlan({name:'BA Design'},previous,{intake:'2027'},{level:'bachelor'});
 assert.deepEqual(plan.map(p=>p.topic),['application']);assert.match(plan[0].terms,/undergraduate/);assert.ok(!plan[0].terms.includes('graduate funding'));
 const doctoral=detailSearchPlan({name:'PhD Design'},{},{},{level:'phd'});assert.match(doctoral.find(p=>p.topic==='funding').terms,/doctoral/);assert.equal(doctoral.length,4);
 assert.match(detailSearchPlan({}, {}, {}, {level:'doctorate'})[0].terms,/doctoral/);
});
test('gap excerpts retain late application instructions despite earlier funding and date sections',()=>{
 const text='Navigation\n'.repeat(500)+'Funding stipend CAD 20000 scholarship funding tuition\n'.repeat(40)+'Applications close 15 January 2027.\n'.repeat(40)+'Application Process\nApplicants will submit:\nA CV or résumé and two reference letters.\n'+'Contact\n'.repeat(300);
 const passages=detailPassages([{url:'https://example.edu/award',text,topic:'all'}],[{topic:'application'}]);
 assert.ok(passages.some(p=>p.text.includes('A CV or résumé and two reference letters.')));
 assert.ok(passages.reduce((sum,p)=>sum+p.text.length,0)<=8500);
});
test('a failed supporting page has an alternative and a gap retry preserves sourced facts',async()=>{
 const url='https://example.edu/award',quote='Eligible masters students receive a CAD 20000 stipend for the 2027 intake.';
 const proof={value:'CAD 20000 stipend',quote,url};
 const previous={name:'Computing Award',funding:proof,funding_status:'partial',deadline:{...proof,value:'2027 intake'},requirements:{...proof,value:'Eligible masters students'},criteria:[{...proof,label:'Study level',status:'unknown'}],application:null,application_steps:[],identity:proof};
 const session={profile:{target_degree:'Master of Computing'},researchBrief:{level:'master'},run:{profileFingerprint:'test'},evidence:new Map([[url,{url,text:quote,links:[{text:'Apply application',url:'https://example.edu/first-apply'},{text:'Apply application alternative',url:'https://example.edu/second-apply'}]}]])};
 const reads=[];
 const result=await deepenReview({name:'Computing Award',url},previous,session,()=>{},new AbortController().signal,{
  execute:async(name,args)=>{if(name==='search_web')return {results:[]};reads.push(args.url);if(args.url.endsWith('first-apply'))throw new Error('Page unavailable');session.evidence.set(args.url,{url:args.url,text:'Submit your application using the official online portal.',retrieved_at:new Date().toISOString()});},
  generate:async(_agent,_instruction,data)=>{const p=data.passages.find(p=>p.text.includes('official online portal'));return {funding:null,deadline:null,requirements:null,application:{value:'Submit using the official online portal.',evidence_id:p.id},application_steps:[{value:'Submit using the official online portal.',evidence_id:p.id}],criteria:[],funding_status:'unknown'};}
 });
 assert.equal(reads.length,2);assert.deepEqual(result.funding,proof);assert.deepEqual(result.deadline,previous.deadline);assert.deepEqual(result.criteria,previous.criteria);assert.equal(result.funding_status,'partial');assert.match(result.application.url,/second-apply/);assert.equal(result.integrity_version,0);
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
