import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOfficialSource} from '../server/official-source.js';
import {extractPage,publicPageUrl} from '../server/page-extract.js';
import {verifyShortlist} from '../server/verify-shortlist.js';
import {rankOpportunities,validateReview,reviewCandidate} from '../server/research.js';
import {askMissing,resolveMissing} from '../server/missing-info.js';
import {dedupeStatusMessages} from '../shared/status-messages.js';
import {datedDeadline,fieldEvidenceSupported} from '../server/field-evidence.js';
const proof={value:'A supported fact',quote:'A supported source passage for this fact.',url:'https://example.edu/programme',retrieved_at:'2026-10-21T00:00:00Z'};
const complete={claims:{funding:proof,deadline:{...proof,quote:'Applications close 15 January 2027.'},requirements:proof,application:proof},criteria:[{label:'Degree',evidence:proof}],application_step_evidence:[proof]};
const item=(id,score=50)=>({id,name:`Programme ${id}`,university:`Provider ${id}`,country:'Example country',url:`https://${id}.example.edu/programme`,score,integrity_checked:true,eligibility:'conditional',...structuredClone(complete)});

test('compact extraction and ownership use separate model allowances under Sage’s key',async()=>{
 const request=globalThis.fetch,role=process.env.GROQ_MODEL_SAGE,detail=process.env.GROQ_EXTRACTION_MODEL,models=[];
 process.env.GROQ_MODEL_SAGE='fixture-role-model';process.env.GROQ_EXTRACTION_MODEL='fixture-extraction-model';
 const url='https://example.edu/arts',text='Example University offers the Master of Fine Arts programme.';
 const review={source_kind:'degree_program',publisher_is_official:true,name:'Master of Fine Arts',university:'Example University',country:'Germany',identity:{value:'Master of Fine Arts',quote:text,url}};
 try{
  globalThis.fetch=async(_url,options)=>{models.push(JSON.parse(options.body).model);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(models.length===1?{official:true,reason:'University-owned fixture source'}:review)}}]}));};
  const session={profile:{},evidence:new Map([[url,{url,text,title:'Master of Fine Arts',links:[],retrieved_at:new Date().toISOString()}]])};
  const result=await reviewCandidate({name:'Master of Fine Arts',url},session,()=>{},new AbortController().signal);
  assert.deepEqual(models,[process.env.GROQ_SOURCE_MODEL||'openai/gpt-oss-120b','fixture-extraction-model']);assert.equal(result.identity_verified,true);assert.equal(result.claims.funding,null);
 }finally{globalThis.fetch=request;if(role===undefined)delete process.env.GROQ_MODEL_SAGE;else process.env.GROQ_MODEL_SAGE=role;if(detail===undefined)delete process.env.GROQ_EXTRACTION_MODEL;else process.env.GROQ_EXTRACTION_MODEL=detail;}
});

test('aggregator text is used only to resolve an observed provider link, not as claim evidence',async()=>{
 const aggregator={url:'https://aggregator.example/award',text:'An article about the actual university programme.',links:[{text:'Official programme website',url:proof.url}]};
 const official={url:proof.url,text:'The actual university programme page.',links:[]},session={evidence:new Map()},calls=[],reads=[];
 const result=await resolveOfficialSource({name:'Programme'},aggregator,session,()=>{},new AbortController().signal,{
  generate:async(_agent,prompt,data)=>{calls.push(data.page.url);assert.match(prompt,/before extracting/);return {official:data.page.url===proof.url,follow_urls:[proof.url,'https://invented.example/not-observed']};},
  execute:async(_name,args)=>{reads.push(args.url);session.evidence.set(args.url,official);return official;},
 });
 assert.equal(result.url,proof.url);assert.deepEqual(reads,[proof.url]);assert.deepEqual(calls,[aggregator.url,proof.url]);
});
test('Tavily extraction requests full content and handles per-URL failures without accepting snippets',async()=>{
 let body;const signal=new AbortController().signal;
 const opts={key:'test-only',validate:async()=>{},request:async(_url,args)=>{body=JSON.parse(args.body);return {ok:true,json:async()=>({results:[{url:proof.url,raw_content:('Official source facts. ').repeat(15)+'[Apply](https://example.edu/apply)'}],failed_results:[]})};}};
 const result=await extractPage(proof.url,signal,opts);assert.equal(body.query,undefined);assert.equal(body.chunks_per_source,undefined);assert.equal(body.extract_depth,'advanced');assert.equal(result.engine,'Tavily Extract');assert.equal(result.links[0].url,'https://example.edu/apply');
 await assert.rejects(extractPage(proof.url,signal,{...opts,request:async()=>({ok:true,json:async()=>({results:[],failed_results:[{url:proof.url,error:'Unavailable'}]})})}),/could not read/);
 for(const address of ['127.0.0.1','192.168.1.1','::1','::ffff:127.0.0.1'])await assert.rejects(publicPageUrl(proof.url,{resolve:async()=>[{address}]}),/Private/);
});
test('each missing field gets at most two retries, exhausted picks yield to saved reserves, resume does not repeat retries',async()=>{
 const thin=item('thin',95);thin.claims.funding=null;const reserve=item('reserve',30),others=['a','b','c','d'].map(id=>item(id,80));
 const session={run:{profileFingerprint:'profile',candidates:[]},opportunities:rankOpportunities([thin,...others,reserve])},calls=[],events=[];
 const deps={rank:rankOpportunities,refine:async(o,topics,retry)=>calls.push({id:o.id,topics,retry}),audit:async()=>{},review:async()=>null,checkpoint:()=>{}};
 await verifyShortlist(session,e=>events.push(e),new AbortController().signal,deps);
 // Complete reserves take precedence immediately; force a thin top five below.
 assert.equal(calls.length,0);session.opportunities=session.opportunities.filter(o=>o.id!=='reserve');
 await verifyShortlist(session,e=>events.push(e),new AbortController().signal,deps);
 assert.deepEqual(calls.map(c=>c.topics),[['funding'],['funding']]);assert.deepEqual(calls.map(c=>c.retry),[1,2]);assert.equal(session.opportunities.find(o=>o.id==='thin').verification.exhausted,true);
 await verifyShortlist(session,e=>events.push(e),new AbortController().signal,{...deps,force:true});assert.equal(calls.length,2);
});
test('Mira checks an extra discovery candidate after a shortlisted match exhausts retries',async()=>{
 const thin=item('thin',95);thin.claims.funding=null;const others=['a','b','c','d'].map(id=>item(id,80)),replacement=item('replacement',40),events=[];
 const session={run:{profileFingerprint:'p',candidates:[replacement],attempted:[]},opportunities:rankOpportunities([thin,...others])};let reviews=0;
 await verifyShortlist(session,e=>events.push(e),new AbortController().signal,{rank:rankOpportunities,refine:async()=>{},audit:async()=>{},review:async()=>{reviews++;return replacement;},checkpoint:()=>{}});
 assert.equal(reviews,1);assert.equal(session.opportunities.find(o=>o.id==='thin').recommended,false);assert.equal(session.opportunities.find(o=>o.id==='replacement').recommended,true);assert.ok(events.some(e=>/extra opportunity Nova already found/.test(e.message?.content||'')));
});
test('a saved replacement is reviewed immediately after two failed retries, before retrying another thin match',async()=>{
 const first=item('first',90),second=item('second',80);first.claims.funding=null;second.claims.funding=null;
 const replacement=item('replacement',70),trace=[],session={run:{profileFingerprint:'p',candidates:[replacement]},opportunities:rankOpportunities([first,second])};
 await verifyShortlist(session,()=>{},new AbortController().signal,{rank:rankOpportunities,refine:async(o)=>trace.push(o.id),audit:async()=>{},review:async()=>{trace.push('replacement');return replacement;},checkpoint:()=>{}});
 assert.deepEqual(trace.slice(0,3),['first','first','replacement']);
});
test('critic rejection triggers another targeted pass instead of treating an extracted field as verified',async()=>{
 const thin=item('thin');thin.claims.application=null;thin.application_step_evidence=[];
 const s={run:{profileFingerprint:'p',candidates:[]},opportunities:rankOpportunities([thin])},seen=[];let audits=0;
 await verifyShortlist(s,()=>{},new AbortController().signal,{rank:rankOpportunities,refine:async(o,topics)=>{seen.push(topics);o.claims.application=proof;o.application_step_evidence=[proof];},audit:async()=>{if(++audits===1){thin.claims.application=null;thin.application_step_evidence=[];}},review:async()=>null,checkpoint:()=>{}});
 assert.equal(seen.length,2);assert.equal(audits,2);assert.equal(s.opportunities[0].verification.exhausted,false);
});
test('one combined student question includes IELTS and LORs and only answered dependencies are rechecked',async()=>{
 const language={...item('language'),criteria:[{label:'IELTS',required:'IELTS 7.0',status:'unknown',evidence:proof}]};
 const letters={...item('letters'),criteria:[{label:'LORs',required:'Two references',status:'unknown',evidence:proof}]};
 const untouched=item('untouched'),s={profile:{},opportunities:[language,letters,untouched],run:{id:'run',status:'partial'}},events=[],reviewed=[];
 askMissing(s,e=>events.push(e));assert.equal(events.length,1);assert.match(events[0].message.content,/language scores/);assert.match(events[0].message.content,/references/);assert.deepEqual(s.pendingEligibility.ids,['language','letters']);
 await resolveMissing(s,'IELTS 7.0',e=>events.push(e),new AbortController().signal,{readAnswer:async()=>({profile:{language_scores:'IELTS 7.0'}}),review:async c=>{reviewed.push(c.url);return language;},audit:async(_s,_emit,_sig,ids)=>assert.deepEqual(ids,['language'])});
 assert.deepEqual(reviewed,[language.url]);assert.deepEqual(s.pendingEligibility.fields,['references']);assert.equal(s.opportunities.find(o=>o.id==='untouched').claims.funding.quote,proof.quote);
});
test('repeated research status bubbles collapse while repeated student messages are preserved',()=>{
 const interrupted={agent:'mira',content:'The run was interrupted: search unavailable.'};
 const messages=[interrupted,{agent:'nova',content:'A different update'},interrupted,{agent:'you',content:'hello'},{agent:'you',content:'hello'}];
 assert.equal(dedupeStatusMessages(messages).length,4);
});
test('an absent language result remains unknown even when a model proposes rejection or acceptance',()=>{
 const identity={...proof,value:'Programme',quote:'Example University offers this specific Programme.'},evidence=new Map([[proof.url,{url:proof.url,text:identity.quote+' '+proof.quote}]]);
 for(const status of ['met','not_met']){
  const result=validateReview({url:proof.url},{name:'Programme',source_kind:'degree_program',publisher_is_official:true,identity,criteria:[{...proof,label:'German language proficiency',student_value:'Not supplied',status}]},evidence,{level:'unspecified',destinations:[],language_scores:null});
  assert.equal(result.criteria[0].status,'unknown');assert.equal(result.eligibility,'conditional');
 }
});
test('missing-info dependency matching does not confuse preference with references or undergraduate standing with graduation',()=>{
 const s={profile:{cgpa:'8.2/10'},opportunities:[{...item('one'),criteria:[{label:'Country preference',required:'Preference stated',status:'unknown',evidence:proof},{label:'Academic standing',required:'B+ equivalent in final undergraduate year',status:'unknown',evidence:proof}]}]};
 assert.equal(askMissing(s,()=>{},{automatic:true}),null);assert.equal(s.pendingEligibility,undefined);
});
test('a final-year qualification is pending, unless completion is explicitly required at application time',()=>{
 const identity={...proof,value:'Programme',quote:'Example University offers this specific Programme.'};
 for(const [quote,status] of [['An honours bachelor degree is required for admission.','unknown'],['Degree completion is required at the time of application.','not_met']]){
  const evidence=new Map([[proof.url,{url:proof.url,text:identity.quote+' '+quote}]]);
  const result=validateReview({url:proof.url},{name:'Programme',source_kind:'degree_program',publisher_is_official:true,identity,criteria:[{value:quote,quote,url:proof.url,label:'Degree',student_value:'Final-year B.Tech',status:'not_met'}]},evidence,{level:'unspecified',destinations:[],academic_background:'Final-year B.Tech'});
  assert.equal(result.criteria[0].status,status);
 }
});
test('a copyright year cannot make an annual date into a verified current deadline',()=>{
 const quote='Fall intake\nApplications open September 15\nInternational deadline December 15\nCopyright © 2026 University';
 assert.equal(datedDeadline(quote),false);assert.equal(fieldEvidenceSupported('deadline',{value:'September 15, 2026',quote}),false);
 assert.equal(datedDeadline('International applications close on March 1, 2027.'),true);
});
test('narrow field evidence cannot borrow an online portal, language requirement or another award procedure',()=>{
 assert.equal(fieldEvidenceSupported('application',{value:'Apply via the online portal',quote:'Submit your application and documentation early.'}),false);
 assert.equal(fieldEvidenceSupported('requirements',{value:'70% plus English proficiency',quote:'A minimum grade average of 70% is required.'}),false);
 const page={title:'University awards',text:'Agricola scholarship\nFunding: 300 per month\n'+'Unrelated material. '.repeat(100)+'Saxon Mobility Award\nComplete application via Mobility Online.'};
 assert.equal(fieldEvidenceSupported('application',{value:'Apply via Mobility Online',quote:'Complete application via Mobility Online.'},{candidate:{name:'Agricola scholarship',type:'scholarship'},page}),false);
});
test('a rejected compound requirements summary can use an individually audited narrow criterion only',()=>{
 const identity={...proof,value:'Programme',quote:'Example University offers this specific Programme.'},criterion={...proof,label:'Degree',student_value:'Final-year degree',status:'unknown'},evidence=new Map([[proof.url,{url:proof.url,text:identity.quote+' '+proof.quote}]]);
 const review={name:'Programme',source_kind:'degree_program',publisher_is_official:true,identity,integrity_version:2,requirements:null,criteria:[criterion]};
 assert.equal(validateReview({url:proof.url},review,evidence).claims.requirements,null);
 const result=validateReview({url:proof.url},{...review,criteria:[{...criterion,evidence_audited:true}]},evidence);assert.equal(result.claims.requirements.quote,proof.quote);
});
test('another concentration in an explicit degree heading cannot establish this programme deadline',()=>{
 const claim={value:'1 December 2026',quote:'Artificial Intelligence in Healthcare: Master of Science in Applied Computing\nApplications close December 1, 2026.'};
 assert.equal(fieldEvidenceSupported('deadline',claim,{candidate:{name:'Computer Science: Applied Computing; Concentration Artificial Intelligence'}}),false);
 assert.equal(fieldEvidenceSupported('deadline',claim,{candidate:{name:'Artificial Intelligence in Healthcare: Applied Computing'}}),true);
});
test('a fee for most programmes cannot be presented as the selected programme fee',()=>{
 assert.equal(fieldEvidenceSupported('application',{value:'Apply online and pay the $125 fee.',quote:'Apply online. The application fee for most graduate programs is $125.'}),false);
 assert.equal(fieldEvidenceSupported('application',{value:'Apply online.',quote:'Apply online. The application fee for most graduate programs is $125.'}),true);
});
