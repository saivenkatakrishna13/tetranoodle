import test from 'node:test';
import assert from 'node:assert/strict';
import {sopCatalog,plannedSop,defaultSopPlan,sourcedSentence} from '../server/sop-sources.js';
import {validateDraft,sourceDraft} from '../server/draft-validation.js';
import {executeTool} from '../server/tools.js';
import {gradeComparison} from '../server/grade-comparison.js';
import {createDraft,validateReview,rankOpportunities} from '../server/research.js';
import {researchBrief} from '../server/profile.js';
const url='https://example.edu/computing',repo='https://github.com/fictional-student/vision';
function fixture(){
 const identity='Example University offers the Master of Computer Science programme.';
 const requirement='Applicants need a minimum GPA of 3.2/4.0 for this programme.';
 const opportunity={id:'fixture',name:'Master of Computer Science',university:'Example University',country:'Canada',url,identity_verified:true,integrity_checked:true,identity:{value:'Master of Computer Science',quote:identity,url},claims:{requirements:{value:'Minimum GPA 3.2/4.0',quote:requirement,url,status:'Verified',retrieved_at:'2026-10-22'},funding:{value:'Full tuition and living costs',quote:'Generic funding may be available.',url,status:'Partial'},application:{value:'Upload a portfolio',quote:'Applicants should upload a portfolio.',url,status:'Verified (with note)',note:'Final instructions require confirmation.'}},criteria:[]};
 const session={profile:{name:'Fictional Student',degree:'Final-year B.Tech Computer Science',target_degree:'Master of Computer Science',cgpa:'7.41/10',interests:'Computer vision',career_goals:'Work as a software engineer'},documents:[{name:'transcript.txt',text:'Original CGPA: 7.41/10. Coursework: Computer Vision.'}],facts:[{key:'cgpa',value:'7.41/10',source:'transcript.txt',quote:'Original CGPA: 7.41/10.'},{key:'coursework',value:'Computer Vision',source:'transcript.txt',quote:'Coursework: Computer Vision.'},{key:'achievement',value:'Won an invented medal',source:'not-a-document',quote:'Won an invented medal'}],github:{retrieved_at:'2026-10-22',repositories:[{name:'vision',url:repo,language:'Python',topics:['computer-vision'],fork:false}],readmes:[{url:repo,readme:'# Vision\nAn image classification experiment using publicly available photographs.\n## Tech Stack\n- PyTorch'}]},publicProfileFacts:[],evidence:new Map([[url,{url,title:'Master of Computer Science',text:identity+'\n'+requirement+'\nApplicants should upload a portfolio.',retrieved_at:'2026-10-22'}]]),opportunities:[opportunity],messages:[],events:[],draft:''};
 return {session,opportunity};
}
test('student form, transcript and GitHub facts become sourced narrative sentences without an authorship claim',()=>{
 const {session,opportunity}=fixture(),result=sourceDraft(session,opportunity),body=result.content.split('## Supported student facts')[0];
 assert.match(body,/My current studies are Final-year B.Tech Computer Science/);assert.match(body,/My recorded academic result is 7.41\/10/);assert.match(body,/repository “vision”/);assert.match(body,/Python/);assert.match(body,/PyTorch/);assert.match(body,/Computer Vision/);assert.match(body,/My stated career goals/);
 assert.doesNotMatch(body,/I (?:built|created|mastered|won)|invented medal|Full tuition|12 papers|Draft section|add a supported statement here/);
 assert.match(result.content,/transcript\.txt/);assert.match(result.content,/https:\/\/github.com\/fictional-student\/vision/);assert.ok(result.sources.some(s=>s.kind==='document'));assert.ok(result.sources.some(s=>s.kind==='github'));assert.ok(result.sources.some(s=>s.kind==='official'));
 assert.equal(result.blocked.length,0);
 for(const section of body.split(/## [^\n]+\n\n/).slice(1))for(const paragraph of section.trim().split(/\n\n/))if(!paragraph.startsWith('['))assert.match(paragraph,/\[\^[SO]\d+\]$/,'every narrative paragraph ends in a real footnote');
});
test('a forged footnote or genuine URL cannot authorize invented text; unknown fields stay outside the SOP',()=>{
 const {session,opportunity}=fixture(),catalog=sopCatalog(session,opportunity),known=sourcedSentence(catalog.sentences.find(s=>s.id==='academic-grade'));
 const result=validateDraft(`## Academic background\n\n${known} I published 12 papers.[^S2]\n\nI work with Professor Imaginary in the Quantum Lab. ${url}`,session,opportunity);
 assert.match(result.content,/7.41\/10/);assert.doesNotMatch(result.content,/published 12|Professor Imaginary|Quantum Lab/);assert.equal(result.blocked.length,2);
});
test('missing program-fit evidence produces one conditional placeholder, one gaps list and no empty Draft section headings',()=>{
 const {session,opportunity}=fixture();opportunity.claims={};opportunity.integrity_checked=false;
 const catalog=sopCatalog(session,opportunity),raw=plannedSop(catalog)+'\n\n# Draft section\n\n[Missing: add a supported statement here]\n\n[Missing: add a supported statement here]';
 const result=validateDraft(raw,session,opportunity),fit=result.content.split('## Programme fit')[1].split('## Closing')[0];
 assert.equal((fit.match(/\[If confirmed/g)||[]).length,1);assert.equal((result.content.match(/## Gaps to complete/g)||[]).length,1);assert.doesNotMatch(result.content,/Draft section|add a supported statement here/);
 assert.match(result.content,/## Supported student facts/);assert.match(result.content,/## Opportunity evidence for your review/);assert.match(result.content,/Draft only\. Verify on the official site/);
});
test('known citation definitions are regenerated; malicious plan text and foreign sentence IDs are ignored',()=>{
 const {session,opportunity}=fixture(),catalog=sopCatalog(session,opportunity);
 const plan={sections:[{id:'academic',sentence_ids:['I won 99 prizes','fit-requirements','academic-grade']},{id:'projects',sentence_ids:['project-0-skills']}]};
 const content=sourceDraft(session,opportunity,{plan}).content;
 assert.doesNotMatch(content,/99 prizes/);assert.match(content,/repository “vision”/);assert.match(content,/Python/);
 const expected=defaultSopPlan(catalog);assert.ok(expected.sections.length===6);
});
test('4.0 vs 10 scales require conversion regardless of a model pass or fail; same scales retain comparison',()=>{
 const {session,opportunity}=fixture(),criterion={label:'Minimum GPA',required:'3.2 / 4.0',evidence:opportunity.claims.requirements};
 assert.ok(gradeComparison({...criterion,required:'An eligible Bachelor degree with a minimum 3.2 CGPA out of a possible 4.0 CGPA'},researchBrief(session.profile)).conversion_check);
 assert.ok(gradeComparison({...criterion,required:'Minimum GPA 3.2 out\nof a possible 4.0'},researchBrief(session.profile)).conversion_check);
 const conversion=gradeComparison(criterion,researchBrief(session.profile));assert.equal(conversion.status,'unknown');assert.equal(conversion.conversion_check,true);assert.match(conversion.note,/Needs conversion check/);
 assert.equal(gradeComparison(criterion,researchBrief({...session.profile,cgpa:'3.5 / 4.0'})),null);
 assert.equal(gradeComparison({...criterion,label:'Language',required:'IELTS 6.5',evidence:{quote:'IELTS overall 6.5 is required.'}},researchBrief(session.profile)),null);
 for(const status of ['met','not_met']){
  const review={source_kind:'degree_program',publisher_is_official:true,name:opportunity.name,university:opportunity.university,country:'Canada',identity:opportunity.identity,requirements:opportunity.claims.requirements,criteria:[{label:'Minimum GPA',...opportunity.claims.requirements,student_value:'7.41/10',status}]};
  const item=validateReview({name:opportunity.name,url},review,session.evidence,researchBrief(session.profile));
  assert.equal(item.criteria[0].status,'unknown');assert.equal(item.criteria[0].conversion_check,true);assert.equal(item.eligibility,'conditional');assert.match(item.missing_information.join(' '),/Needs conversion check/);
 }
});
test('one Leo model call arranges only known sentences, saves a real draft and never searches or invokes another agent',async()=>{
 const {session,opportunity}=fixture(),request=globalThis.fetch,bodies=[];
 try{
  globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);bodies.push(body);return Response.json({choices:[{message:{content:JSON.stringify({sections:defaultSopPlan(sopCatalog(session,opportunity)).sections,content:'I invented 999 robots.'})}}]});};
  await createDraft(session,opportunity,e=>{if(e.type==='draft')session.draft=e.content;},new AbortController().signal);
  assert.equal(bodies.length,1);assert.match(bodies[0].messages[0].content,/You are leo/);assert.equal(bodies[0].tools,undefined);assert.equal(session.draftMeta.method,'source-grounded-ai-arranged');assert.doesNotMatch(session.draft,/999 robots/);assert.match(session.draft,/repository “vision”/);
 }finally{globalThis.fetch=request;}
});


test('direct transcript annotation matches the exact numeric grade and never fabricates a scale',()=>{
 const {session,opportunity}=fixture();session.facts=[];session.profile.cgpa='7.41';
 session.documents=[{name:'transcript.txt',text:'Student record. CGPA: 7x41.'}];
 assert.equal(sopCatalog(session,opportunity).sources.find(s=>s.key==='cgpa').kind,'student');
 session.documents[0].text='Student record. CGPA: 7.41.';
 const catalog=sopCatalog(session,opportunity);assert.equal(catalog.sources.find(s=>s.key==='cgpa').kind,'document');
 assert.doesNotMatch(sourceDraft(session,opportunity).content.split('## Supported student facts')[0],/7.41\s*\/\s*10/);
 session.profile.cgpa='7.41/10';assert.equal(sopCatalog(session,opportunity).sources.find(s=>s.key==='cgpa').kind,'student');
});


test('the ordinary-chat draft tool uses the same sourced facts and guard as the explicit draft action',async()=>{
 const {session,opportunity}=fixture();
 await executeTool('save_application_draft',{url:opportunity.url,content:'I published 12 papers in the Imaginary Lab.'},session,()=>{},'leo',new AbortController().signal);
 assert.doesNotMatch(session.draft,/published 12|Imaginary Lab/);assert.equal(session.draftMeta.blockedClaims.length,1);
 assert.match(session.draft,/repository “vision”/);assert.match(session.draft,/7.41\/10/);assert.ok(session.draftMeta.sources.some(s=>s.kind==='github'));
 assert.equal((session.draft.match(/## Gaps to complete/g)||[]).length,1);
});
