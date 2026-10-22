import {readIntakeAnswer} from './intake.js';
import {structured} from './groq.js';
import {researchBrief} from './profile.js';
import {reviewCandidate,auditPack,rankOpportunities,fingerprint} from './research.js';
import {researchCoverage} from './research-quality.js';
const dependencies={language_scores:/\b(?:IELTS|TOEFL|English|language)\b/i,nationality:/\b(?:nationality|citizens?|citizenship)\b/i,residency:/\b(?:permanent resident|residency|residence)\b/i,cgpa:/\b(?:CGPA|GPA|grades?|academic (?:score|standing))\b/i,graduation:/\b(?:graduation|graduated|completed? degree|degree completion)\b/i,budget:/\b(?:budget|financial|ability to pay)\b/i,intake:/\b(?:intake|entry year)\b/i,references:/\b(?:recommendations?|references?|LORs?)\b/i,portfolio:/\bportfolio\b/i,work_experience:/\b(?:work experience|employment)\b/i,credits:/\b(?:ECTS|credits?)\b/i,prerequisite_courses:/\b(?:prerequisites?|coursework|required courses)\b/i,supervisor:/\b(?:supervisor|faculty advisor|adviser)\b/i,admission_status:/\b(?:offer of admission|admission offer|admission letter|admitted|enrolment|enrollment|enrolled)\b/i,age:/\bage\b/i};
const profileFields=['language_scores','nationality','cgpa','graduation','budget','intake'];
export function missingRequests(session){
 const requests=[];
 for(const o of (session.opportunities||[]).filter(o=>o.eligibility!=='not_eligible'&&!o.preference_mismatch&&o.deadline_state!=='expired'))for(const c of o.criteria||[]){
  if(c.status!=='unknown'||!c.evidence)continue;
  const fields=Object.keys(dependencies).filter(k=>dependencies[k].test(c.label+' '+c.required));
  if(/final[\s‑-]*year|currently (?:studying|pursuing)/i.test(session.profile.degree||'')&&/\b(?:degree|qualification)\b/i.test(c.label)&&!session.profile.graduation&&!fields.includes('graduation'))fields.push('graduation');
  for(const field of fields)if(!session.profile[field]&&!session.eligibilityAnswers?.[field]||field==='language_scores'&&/component|sub.?score|band/i.test(c.label))requests.push({field,label:c.label,opportunityId:o.id,evidence:c.evidence});
 }
 return requests;
}
const question=(requests,ids)=>`To recheck ${ids.length} affected match(es), could you provide these missing student details in one reply? You can mark any item “not available”.\n\n${[...new Set(requests.map(r=>r.field))].map(field=>{const r=requests.find(r=>r.field===field);return `- **${field.replaceAll('_',' ')}** — ${r.evidence.value}\n  [Official requirement](${r.evidence.url})`;}).join('\n')}\n\nOnly matches depending on the details you supply will be rechecked. Say “skip” to leave them Missing.`;
export function askMissing(session,emit,{automatic=false}={}){
 if(session.pendingEligibility)return session.pendingEligibility;
 const requests=missingRequests(session);if(!requests.length){if(automatic)return null;throw Error('No resolvable missing student field is linked to the checked requirements. Source gaps need Verify missing details.');}
 const fields=[...new Set(requests.map(r=>r.field))],ids=[...new Set(requests.map(r=>r.opportunityId))],signature=JSON.stringify([[...fields].sort(),[...ids].sort(),session.profileRevision||0]);
 if(automatic&&session.lastEligibilityQuestion===signature)return null;
 session.pendingEligibility={field:fields[0],fields,ids,requests};session.lastEligibilityQuestion=signature;
 emit({type:'message',message:{agent:'sage',content:question(requests,ids)}});return session.pendingEligibility;
}
async function readEligibilityAnswer(session,message,{signal,emit}={}){
 const fields=session.pendingEligibility?.fields||[session.pendingEligibility?.field];
 if(fields.length===1&&profileFields.includes(fields[0]))return readIntakeAnswer({...session,pendingQuestion:fields[0]},message,{signal,emit});
 const result=await structured('arjun','Extract ONLY explicit student facts from the reply for the requested fields. Return {fields:[{key,value,quote}]}. Copy value and quote verbatim from the reply. Never infer a test score, availability of letters, nationality or work experience. Omit unknown/not available/not sure/skip answers and questions. Page requirements are not student facts.',{requested_fields:fields,reply:message},{signal,emit,maxTokens:1000});
 const norm=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase(),text=norm(message),profile={};
 for(const item of result.fields||[]){const value=norm(item.value),quote=norm(item.quote);if(typeof item.value==='string'&&typeof item.quote==='string'&&fields.includes(item.key)&&value.length>1&&quote.includes(value)&&text.includes(quote)&&!value.includes('?')&&!/^(unknown|not available|not sure|skip|n\/a)$/i.test(value))profile[item.key]=item.value.trim().slice(0,1000);}
 return {profile};
}
export async function resolveMissing(session,message,emit,signal,{readAnswer=readEligibilityAnswer,review=reviewCandidate,audit=auditPack}={}){
 if(/^(?:skip|not now|cancel|pause)[.!\s]*$/i.test(message)){session.pendingEligibility=null;emit({type:'message',message:{agent:'sage',content:'I’ve kept that information Missing. Your saved matches remain available.'}});return;}
 const pending=session.pendingEligibility,fields=pending.fields||[pending.field];
 const answer=pending.answerSaved?{profile:pending.savedValues||{[pending.field]:session.profile[pending.field]||session.eligibilityAnswers?.[pending.field]}}:await readAnswer({...session,pendingQuestion:fields.join(', ')},message,{signal,emit});
 const values=Object.fromEntries(fields.filter(field=>typeof answer.profile?.[field]==='string'&&answer.profile[field].trim()).map(field=>[field,answer.profile[field].trim()]));
 if(!Object.keys(values).length){emit({type:'message',message:{agent:'sage',content:`The requested details are still Missing. Please give any available results explicitly, or say “skip”.`}});return;}
 for(const [field,value] of Object.entries(values)){if(profileFields.includes(field))session.profile[field]=value;else{session.eligibilityAnswers||={};session.eligibilityAnswers[field]=value;}}
 const affected=pending.requests?[...new Set(pending.requests.filter(r=>values[r.field]).map(r=>r.opportunityId))]:pending.ids;
 session.profileRevision=(session.profileRevision||0)+Number(!pending.answerSaved);session.researchBrief=researchBrief(session.profile);session.pendingEligibility={...pending,answerSaved:true,savedValues:values};if(session.run){session.run.profileFingerprint=fingerprint(session.profile);session.run.status='partial';}
 emit({type:'profile',profile:session.profile});emit({type:'message',message:{agent:'sage',content:`Saved your supplied ${Object.keys(values).map(f=>f.replaceAll('_',' ')).join(', ')}. I’m rechecking only ${affected.length} affected match(es); the other source findings stay saved.`}});
 for(const id of affected){const old=session.opportunities.find(o=>o.id===id);if(!old)continue;const item=await review({name:old.name,university:old.university,country:old.country,url:old.url},session,emit,signal);if(item){
   const latest=[...(session.reviewAudit||[])].reverse().find(a=>a.candidate.url===item.url);
   for(const field of ['funding','deadline','requirements','application'])if(!item.claims?.[field]&&old.integrity_checked&&old.claims?.[field]){item.claims[field]=old.claims[field];if(latest)latest.review[field]=old.claims[field];}
   if(!item.application_step_evidence?.length&&old.integrity_checked&&old.application_step_evidence?.length){item.application_step_evidence=old.application_step_evidence;item.application_steps=old.application_steps;if(latest)latest.review.application_steps=old.application_step_evidence;}
   // Retire superseded comparisons for this same match. Rebuilding the pack
   // must not select an older criterion verdict with an equal source score.
   if(latest)session.reviewAudit=session.reviewAudit.filter(a=>a===latest||![old.url,item.url].includes(a.candidate.url));
   item.id=id;session.opportunities=session.opportunities.map(o=>o.id===id?item:o);
  }}
 await audit(session,emit,signal,affected);session.pendingEligibility=null;session.opportunities=rankOpportunities(session.opportunities);
 if(affected.includes(session.draftMeta?.opportunityId)){session.draft='';session.draftMeta=null;emit({type:'draft',content:''});}
 if(session.run){session.run.profileFingerprint=fingerprint(session.profile);session.run.researchBrief=session.researchBrief;session.run.coverage=researchCoverage(session.opportunities,!!session.draft);session.run.status='partial';emit({type:'run',run:session.run});}
 emit({type:'opportunities',opportunities:session.opportunities});emit({type:'typing',agent:null});
 const remaining=(pending.requests||[]).filter(r=>!values[r.field]);if(remaining.length){const remainingFields=[...new Set(remaining.map(r=>r.field))],ids=[...new Set(remaining.map(r=>r.opportunityId))];session.pendingEligibility={field:remainingFields[0],fields:remainingFields,ids,requests:remaining};emit({type:'message',message:{agent:'sage',content:question(remaining,ids)}});}
}
