import test from 'node:test';
import assert from 'node:assert/strict';
import {unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {cleanProfile,researchBrief} from '../server/profile.js';
import {realProfileConflict,githubFacts,restrictedProfile} from '../server/profile-facts.js';
import {intakeCompatibility} from '../server/intake-dates.js';
import {enrichProfile,auditPack,validateReview,rankOpportunities} from '../server/research.js';
import {evidenceCoverage} from '../server/research-quality.js';
import {executeTool} from '../server/tools.js';
import {record} from '../server/store.js';
const signal=()=>new AbortController().signal;
const url='https://example.edu/computing';
const identity='Example University offers the Master of Computer Science programme.';
const quote='Applicants must have a bachelor degree in Computer Science.';
const proof={value:'A bachelor degree in Computer Science is required.',quote,url};
const review=()=>({source_kind:'degree_program',publisher_is_official:true,name:'Master of Computer Science',university:'Example University',country:'Canada',identity:{value:'Master of Computer Science',quote:identity,url},requirements:proof,criteria:[{label:'Degree',...proof,student_value:'B.Tech Computer Science',status:'met'}]});
const evidence=()=>new Map([[url,{url,title:'Master of Computer Science — Example University',text:identity+'\n'+quote,links:[],retrieved_at:new Date().toISOString()}]]);

test('original grade scales and funding dropdowns preserve values without conversion or invented defaults',()=>{
 assert.deepEqual(cleanProfile({cgpa:'3.5',cgpa_scale:'4',funding_need:'none',intake_term:'summer'}),{cgpa:'3.5 / 4',cgpa_scale:'4',funding_need:'none',intake_term:'Summer'});
 assert.equal(cleanProfile({cgpa:'82',cgpa_scale:'%'}).cgpa,'82%');
 assert.equal(cleanProfile({cgpa:'7.41'}).cgpa,'7.41');
 assert.throws(()=>cleanProfile({cgpa:'7.41',cgpa_scale:'4'}),/exceeds/);
 assert.throws(()=>cleanProfile({cgpa:'8.2 / 10',cgpa_scale:'4'}),/no conversion/);
 assert.throws(()=>cleanProfile({funding_need:'guaranteed'}),/Choose/);
 assert.equal(researchBrief({intake:'2027',intake_term:'Summer',funding_need:'full'}).intake_term,'Summer');
});
test('case-only names and identical original scores do not block; actual score conflicts do',()=>{
 assert.equal(realProfileConflict('name','RAHUL SHARMA','Rahul Sharma'),false);
 assert.equal(realProfileConflict('name','Rahul Sharma','Rahul Kumar'),true);
 assert.equal(realProfileConflict('cgpa','7.41','7.41 / 10'),false);
 assert.equal(realProfileConflict('cgpa','7.41','8.2 / 10'),true);
 assert.equal(realProfileConflict('cgpa','3.5 / 4','3.5 / 10'),true);
});
test('May graduation excludes Spring intake, and actual sourced dates override planning seasons',()=>{
 const p={graduation:'may and 2027',intake:'2027',intake_term:'Spring'};
 assert.equal(intakeCompatibility(p).status,'before_graduation');
 assert.equal(intakeCompatibility({...p,intake_term:'Summer'}).status,'unknown','a term alone cannot establish actual provider dates');
 const start=(value)=>({value,quote:`Classes start ${value}.`,url});
 assert.equal(intakeCompatibility({...p,intake_term:'Summer'},start('April 15, 2027')).status,'before_graduation');
 assert.equal(intakeCompatibility({...p,intake_term:'Summer'},start('June 15, 2027')).status,'compatible');
 assert.equal(intakeCompatibility(p,start('May 15, 2027')).status,'unknown');
 const r=review();r.intake_start=start('April 15, 2027');const pages=evidence();pages.get(url).text+='\n'+r.intake_start.quote;
 const checked=validateReview({url,name:r.name},r,pages,researchBrief({...p,intake_term:'Summer',target_degree:r.name,countries:'Canada'}));
 assert.equal(checked.eligibility,'not_eligible');assert.equal(rankOpportunities([checked])[0].recommended,false);
});
test('GitHub repo names, languages and README stack become source-linked facts, not proficiency claims',()=>{
 const repo={name:'vision-lab',url:'https://github.com/student/vision-lab',language:'Python',topics:['computer-vision']};
 const facts=githubFacts({repositories:[repo,{...repo,name:'forked',fork:true}],readmes:[{url:repo.url,readme:'# Vision lab\nA student exploration of image segmentation.\n## Tech Stack\n- PyTorch\n- OpenCV'}]});
 for(const value of ['vision-lab','Python','computer-vision','PyTorch','OpenCV'])assert.ok(facts.some(f=>f.value===value&&f.url===repo.url));
 assert.equal(facts.some(f=>f.value==='forked'),false);
 assert.ok(facts.filter(f=>f.key==='skill').every(f=>/not proof of proficiency/.test(f.confidence)));
 assert.equal(restrictedProfile({url:'https://www.linkedin.com/in/student',text:'Sign in to view this profile.'}),true);
 assert.equal(restrictedProfile({url:'https://www.linkedin.com/in/student',text:'A readable public professional profile. '.repeat(40)+'Join LinkedIn'}),false);
});
test('full-page cache reuses URL aliases, retains complete text and still honors injected failures',async()=>{
 const session={evidence:new Map()},events=[];let calls=0;
 const options={pageWorker:async()=>{calls++;return {url,text:'A supported source passage. '.repeat(500),links:[],retrieved_at:new Date().toISOString()};}};
 await executeTool('read_page',{url},session,e=>events.push(e),'sage',signal(),options);
 const second=await executeTool('read_page',{url:url+'/#admissions'},session,e=>events.push(e),'sage',signal(),options);
 assert.equal(calls,1);assert.equal(second.cached,true);assert.ok(session.evidence.get(url).text.length>second.text.length);
 session.demoFailures={sourceOnce:true};
 await assert.rejects(executeTool('read_page',{url},session,e=>events.push(e),'sage',signal(),options),/DEMO/);
 assert.equal(calls,1);
});
test('Arjun adopts document name spelling, keeps genuine CGPA conflict and emits one summary per change',async()=>{
 const request=globalThis.fetch;
 const session={id:randomUUID(),profile:{name:'RAHUL SHARMA',cgpa:'7.41'},profileRevision:1,documents:[{id:'doc',name:'transcript.txt',text:'Student Rahul Sharma. CGPA 8.2 / 10.'}],facts:[],messages:[],events:[],evidence:new Map()};
 let calls=0;const emit=e=>record(session,e);
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({choices:[{message:{content:JSON.stringify({fields:[{key:'name',value:'Rahul Sharma',source:'transcript.txt',quote:'Student Rahul Sharma.'}],conflicts:[{key:'name',document_value:'Rahul Sharma',source:'transcript.txt',quote:'Student Rahul Sharma.'},{key:'cgpa',document_value:'8.2 / 10',source:'transcript.txt',quote:'CGPA 8.2 / 10.'}],summary:'Your documented name is Rahul Sharma.'})}}]});};
  await enrichProfile(session,emit,signal());await enrichProfile(session,emit,signal());
  assert.equal(calls,1);assert.equal(session.profile.name,'Rahul Sharma');assert.equal(session.profileConflicts.length,1);assert.equal(session.profileConflicts[0].key,'cgpa');
  assert.equal(session.messages.filter(m=>m.profile_summary).length,1);
  session.profileRevision++;await enrichProfile(session,emit,signal());assert.equal(calls,2);
  assert.equal(session.messages.filter(m=>m.profile_summary).length,2);
 }finally{globalThis.fetch=request;await new Promise(r=>setTimeout(r,200));await unlink('.data/sessions/'+session.id+'.json').catch(()=>{});}
});
test('critic keeps ambiguous supported fields as Partial, unsupported fields Missing and caveated facts verified',async()=>{
 const request=globalThis.fetch;const session={id:randomUUID(),profile:{},opportunities:[],reviewAudit:[],evidence:evidence(),messages:[],events:[]};
 const original=review();session.reviewAudit=[{candidate:{url,name:original.name},review:original}];session.opportunities=[validateReview(session.reviewAudit[0].candidate,original,session.evidence)];
 const emit=e=>record(session,e);
 try{
  globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({items:[{id:session.opportunities[0].id,publisher_is_official:true,specific_opportunity_supported:true,unsupported_fields:['requirements','funding'],field_assessments:[{field:'requirements',status:'Missing',note:'Subject equivalence needs the admissions office.'}],criteria:[{index:0,requirement_supported:false,status:'unknown',reason:'Exact degree equivalence is ambiguous.'}]}]})}}]});
  await auditPack(session,emit,signal(),null,{rank:false});
  let item=session.opportunities[0];assert.equal(item.claims.requirements.status,'Partial');assert.equal(item.claims.requirements.value,quote);assert.equal(item.claims.requirements.url,url);assert.equal(item.claims.funding,null);assert.equal(evidenceCoverage(item).requirements,false);
  original.requirements={...proof};delete original.integrity_context_version;
  globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({items:[{id:item.id,publisher_is_official:true,specific_opportunity_supported:true,field_assessments:[{field:'requirements',status:'Verified (with note)',note:'Admission remains competitive.'}],criteria:[{index:0,requirement_supported:true,status:'unknown'}]}]})}}]});
  await auditPack(session,emit,signal(),null,{rank:false});item=session.opportunities[0];assert.equal(item.claims.requirements.status,'Verified (with note)');assert.match(item.claims.requirements.note,/competitive/);
 }finally{globalThis.fetch=request;await new Promise(r=>setTimeout(r,200));await unlink('.data/sessions/'+session.id+'.json').catch(()=>{});}
});

test('long GitHub enrichment and source menus cannot bloat Sage extraction requests',async()=>{
 const request=globalThis.fetch,requests=[],pages=evidence();
 pages.get(url).text+='\n'+('General navigation. '.repeat(2000))+'\nEntry requirements: '+quote;
 pages.get(url).links=Array.from({length:100},(_,i)=>({url:`https://example.edu/navigation-${i}?tracking=${'x'.repeat(200)}`,text:'Navigation '.repeat(50)}));
 const session={profile:{degree:'B.Tech Computer Science',target_degree:'Master of Computer Science',countries:'Canada'},evidence:pages,enrichment:{skills:Array(50).fill('Repository technology reference '.repeat(20)),projects:Array(100).fill({value:'Long unrelated repository metadata '.repeat(200)})}};
 try{
  globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);return Response.json({choices:[{message:{content:JSON.stringify(requests.length===1?{official:true,reason:'University-owned source'}:review())}}]});};
  const {reviewCandidate}=await import('../server/research.js');
  await reviewCandidate({url,name:review().name},session,()=>{},signal());
  const input=JSON.parse(requests[1].messages[1].content);
  assert.equal(input.student_enrichment.projects,undefined);assert.equal(input.student_enrichment.skills.length,12);
  assert.ok(input.pages.reduce((n,p)=>n+p.text.length,0)<=6600);
  for(const body of requests)assert.ok(Math.ceil(JSON.stringify(body.messages).length/4)+body.max_tokens<8000,'compact extraction fits the known 8k planning allowance');
  assert.ok(pages.get(url).text.length>30000,'source provenance retains the complete fetched page');
 }finally{globalThis.fetch=request;}
});
