import {evidenceCoverage} from './research-quality.js';
export const verificationFields=['funding','deadline','requirements','application'];
const usable=o=>o.eligibility!=='not_eligible'&&!o.preference_mismatch&&o.deadline_state!=='expired';

// Callbacks reuse Sage, Mira, persisted evidence and the existing ranking model.
// This controller never discovers new opportunities or relaxes evidence rules.
export async function verifyShortlist(session,emit,signal,{rank,refine,audit,review,checkpoint,checked=new Set()}){
 const key=session.run.profileFingerprint;
 let reserves=0,replacePending=false;
 for(let turn=0;turn<40;turn++){
  signal.throwIfAborted();session.opportunities=rank(session.opportunities);
  if(session.opportunities.filter(o=>o.recommended&&o.integrity_checked&&evidenceCoverage(o).complete).length===5)break;
  const item=session.opportunities.find(o=>{
   if(!o.recommended||!usable(o)||checked.has(o.url))return false;
   const coverage=evidenceCoverage(o),attempts=o.verification?.profile===key?o.verification.attempts:{};
   return verificationFields.some(field=>!coverage[field]&&(attempts?.[field]||0)<2);
  });
  if(!item||replacePending){
   // Initial discovery can find 20 leads but stop reviewing after ten. Consume
   // those saved extras before requesting another search from Nova.
   const attempted=new Set(session.run.attempted||[]);
   const candidate=(session.run.candidates||[]).find(c=>!attempted.has(c.url)&&!session.opportunities.some(o=>o.url===c.url));
   if(!candidate||reserves>=10){if(replacePending){replacePending=false;continue;}break;}
   replacePending=false;
   reserves++;attempted.add(candidate.url);session.run.attempted=[...attempted];checkpoint();
   emit({type:'message',message:{agent:'mira',content:`I’m checking **${candidate.name}**, an extra opportunity Nova already found, as a replacement for a recommendation with unresolved source evidence.`}});
   try{const result=await review(candidate);if(result){session.opportunities=rank([...session.opportunities,result]);await audit([result.id]);}}catch(error){if(signal.aborted||/Groq|rate limit|readable result/i.test(error.message))throw error;emit({type:'activity',agent:'sage',label:`The saved alternative could not be verified: ${candidate.name}.`});}
   checkpoint();continue;
  }
  checked.add(item.url);
  const previousTop=session.opportunities.filter(o=>o.recommended).map(o=>o.id);
  let state=item.verification?.profile===key?structuredClone(item.verification):{profile:key,attempts:{},exhausted:false};
  for(let retry=1;retry<=2;retry++){
   const current=session.opportunities.find(o=>o.id===item.id);if(!current||!usable(current))break;
   const coverage=evidenceCoverage(current);
   const topics=verificationFields.filter(field=>!coverage[field]&&(state.attempts[field]||0)<2);
   if(!topics.length)break;
   topics.forEach(field=>state.attempts[field]=(state.attempts[field]||0)+1);
   state.updatedAt=Date.now();current.verification=state;checkpoint(current,state);
   emit({type:'activity',agent:'sage',label:`${item.name}: targeted retry ${Math.max(...topics.map(f=>state.attempts[f]))}/2 for ${topics.join(', ')}.`});
   try{await refine(current,topics,Math.max(...topics.map(f=>state.attempts[f])));await audit([item.id]);}
   catch(error){if(signal.aborted||/Groq|rate limit|readable result/i.test(error.message))throw error;emit({type:'activity',agent:'sage',label:`A targeted retry could not read sufficient official evidence for ${item.name}.`});}
   const refreshed=session.opportunities.find(o=>o.id===item.id);if(refreshed){refreshed.verification=state;checkpoint(refreshed,state);}
  }
  const current=session.opportunities.find(o=>o.id===item.id);
  if(current){state.exhausted=!evidenceCoverage(current).complete;current.verification=state;checkpoint(current,state);}
  session.opportunities=rank(session.opportunities);
  const promoted=session.opportunities.filter(o=>o.recommended&&!previousTop.includes(o.id));
  if(state.exhausted&&!promoted.length)replacePending=true;
  if(state.exhausted&&promoted.length)emit({type:'message',message:{agent:'mira',content:`**${item.name}** still has source gaps after two targeted retries. I’ve moved **${promoted[0].name}** into the shortlist for verification. The original remains in All researched.`}});
  emit({type:'opportunities',opportunities:session.opportunities});checkpoint();
 }
 return session.opportunities;
}
