import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanProfile,studyLevels,researchBrief,missingEssentials,discoveryQueries,changeProfile,parseStudentText,labeledProfileFacts,countryPreferenceMatch} from '../server/profile.js';
import {validateReview,runResearch} from '../server/research.js';
const science={name:'Rahul',degree:'Final-year B.Tech Computer Science',target_degree:'Master’s in Computer Science',countries:'Canada, Germany',cgpa:'8.2/10'};
const art={name:'Meera',degree:'Final-year B.Des. Communication Design',target_degree:'Master’s in Interaction Design',countries:'Finland, Sweden',cgpa:'8.6/10'};
test('the same profile engine supports bachelor, master and doctorate goals without assuming CS',()=>{
 for(const [goal,level] of [['Bachelor of Biology','bachelor'],['Master’s in Interaction Design','master'],['PhD Environmental Science','doctorate']]){
  const brief=researchBrief({...art,target_degree:goal});assert.equal(brief.level,level);
  const queries=discoveryQueries(['computer science masters admission Canada','AI scholarships Canada'],brief);
  assert.ok(queries[0].includes('Finland'));assert.ok(queries[1].includes('Sweden'));assert.ok(!queries.join(' ').includes('computer science'));assert.ok(!queries.join(' ').includes('Canada'));
  if(level!=='master')assert.ok(!/\bmasters?\b/i.test(queries.join(' ')));
 }
 assert.equal(researchBrief({...science,target_degree:''}).level,'unspecified');assert.ok(missingEssentials({...science,target_degree:''}).includes('target_degree'));
 assert.equal(researchBrief({degree:"B.Sc. Economics; seeking a master's in public policy",countries:'Netherlands'}).level,'master');
});
test('changing the same student’s goal clears all prior research, public enrichment and draft state',()=>{
 const session={profile:{...science},documents:[{id:'own-document'}],messages:[{agent:'you',content:'A saved conversation'}],opportunities:[{name:'MSc CS'}],run:{status:'completed',candidates:['old candidate']},draft:'old SOP',draftMeta:{},facts:[{value:'old grade'}],searchResults:{old:['old result']},reviewAudit:[{}],evidence:new Map([['old',{}]]),github:{username:'old'},enrichment:{skills:['old']},publicProfileFacts:[{}],pendingQuestion:'cgpa'};
 assert.equal(changeProfile(session,{target_degree:art.target_degree,countries:art.countries}),true);
 for(const key of ['opportunities','reviewAudit','facts','publicProfileFacts'])assert.deepEqual(session[key],[]);
 assert.deepEqual(session.searchResults,{});assert.equal(session.evidence.size,0);assert.equal(session.draft,'');assert.equal(session.run,null);assert.equal(session.github,null);assert.equal(session.pendingQuestion,null);assert.equal(session.documents[0].id,'own-document');assert.equal(session.profile.cgpa,'8.2/10');
 assert.equal(changeProfile(session,{countries:art.countries}),false);
});
test('profile imports preserve original facts, accept country arrays, and ignore operational fields',async()=>{
 const imported=await parseStudentText(JSON.stringify({profile:{...art,countries:['Finland','Sweden'],cgpa:8.6,run:{status:'completed'},api_key:'not-a-profile-field'}}));
 assert.equal(imported.profile.countries,'Finland, Sweden');assert.equal(imported.profile.cgpa,'8.6');assert.equal(imported.profile.run,undefined);assert.equal(imported.profile.api_key,undefined);
 assert.deepEqual(cleanProfile({nationality:'',cgpa:'3.7 / 4.0'}),{cgpa:'3.7 / 4.0',nationality:''});
});
test('a PhD applicant cannot receive a master-only program as a recommendation',()=>{
 const url='https://example.edu/master';const identity={value:'MSc Biology',quote:'Master of Science in Biology is a two-year degree.',url};const evidence=new Map([[url,{url,title:'MSc Biology',text:identity.quote,retrieved_at:'2026-10-20'}]]);
 const result=validateReview({name:'MSc Biology',url},{source_kind:'degree_program',publisher_is_official:true,name:'MSc Biology',university:'Example University',identity,match_components:{academic:30,funding:35,preferences:20,evidence:15}},evidence,researchBrief({degree:'MSc Biology',target_degree:'PhD Biology',countries:'Sweden'}));
 assert.equal(result.eligibility,'not_eligible');assert.ok(result.criteria.some(c=>c.label==='Intended study level'&&c.status==='not_met'));
});
test('missing intended study asks one question without searching or silently choosing a master',async()=>{
 const session={id:'missing-target-unit-test',profile:{degree:'B.Sc. Biology',countries:'Sweden'},documents:[],facts:[],messages:[],events:[],evidence:new Map(),run:{status:'running',profileReviewed:true}};const events=[];
 await runResearch(session,e=>events.push(structuredClone(e)),new AbortController().signal,true);
 assert.equal(session.run.status,'needs_input');assert.equal(events.filter(e=>e.type==='message').length,1);assert.match(events.find(e=>e.type==='message').message.content,/degree and subject/);assert.equal(events.filter(e=>e.type==='message').map(e=>e.message.content).join('').match(/\?/g).length,1);
});

test('explicit labels preserve supplied countries, funding constraints and original grading scales',()=>{
 const fields=Object.fromEntries(labeledProfileFacts("Name: New student\nPreferred countries: Finland, Sweden, Netherlands.\nAcademic result: 8.6 / 10 CGPA.\nFunding need: Scholarship needed; EUR 4000 per year.\nResidence: Jalandhar, India.").map(f=>[f.key,f.value]));
 assert.equal(fields.countries,'Finland, Sweden, Netherlands');assert.equal(fields.cgpa,'8.6 / 10 CGPA');assert.equal(fields.budget,'Scholarship needed; EUR 4000 per year');assert.equal(fields.nationality,undefined);
});

test('searches broaden only to supplied interests and recommendations respect country preferences',()=>{
 const brief=researchBrief({...art,interests:'Human-computer interaction, User experience'});const queries=discoveryQueries(['CS admission','computer science funding'],brief);assert.ok(queries[1].includes('Human-computer interaction'));assert.ok(!queries.join(' ').includes('computer science'));
 assert.equal(countryPreferenceMatch('Estonia',['Finland','Sweden']),'outside_preferences');assert.equal(countryPreferenceMatch('The Netherlands',['Netherlands']),'matched');assert.equal(countryPreferenceMatch('UK',['United Kingdom']),'matched');assert.equal(countryPreferenceMatch('Sweden',['Europe']),'unknown');
});
