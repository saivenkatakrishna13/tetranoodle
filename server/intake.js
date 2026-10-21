import {randomUUID} from 'node:crypto';
import {structured} from './groq.js';
import {missingEssentials,PROFILE_FIELDS,labeledProfileFacts} from './profile.js';

export const REQUIRED_QUESTIONS={degree:'What are you studying right now?',target_degree:'What degree and subject would you like to pursue next?',countries:'Which countries would you like us to focus on?'};
const norm=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase();
export function supportedIntakeFields(fields,message){
 const text=norm(message),patch={};
 for(const f of Array.isArray(fields)?fields:[]){
  if(!f||!PROFILE_FIELDS.includes(f.key)||typeof f.value!=='string'||typeof f.quote!=='string')continue;
  const value=norm(f.value),quote=norm(f.quote);
  if(value.length<2||value.includes('?')||!text.includes(quote)||!quote.includes(value)||/^(?:unknown|not (?:sure|known|supplied)|i don.?t know|unsure|skip|n\/?a|yes|no)$/i.test(value))continue;
  patch[f.key]=f.value.trim().slice(0,1000);
 }
 return patch;
}
export async function readIntakeAnswer(session,message,{signal,emit}={}){
 const labeled=labeledProfileFacts(message);
 if(labeled.length)return {profile:supportedIntakeFields(labeled,message),reply:'Thanks, I’ve saved the details you supplied.'};
 const data=await structured('arjun',`Read the student's latest reply to your required-profile question. Return {fields:[{key,value,quote}],reply:string}. Allowed keys: ${PROFILE_FIELDS.join(', ')}. Extract only facts explicitly stated in LATEST_REPLY. Values and quotes must be exact text from that reply. Do not infer nationality, grade equivalence, country names, subject or degree level. Current profile and pending question provide context only, never new facts. If the student asks a question or is unsure, answer briefly in reply and leave unanswered fields absent. Do not turn "I don't know", "skip", a question or a yes/no reply into a profile value. Keep reply to 1-2 short sentences without questions, source claims or requests for additional details; the server appends one required question. No opportunity research yet.`,{CURRENT_PROFILE:session.profile,PENDING_QUESTION:session.pendingQuestion,LATEST_REPLY:message},{signal,emit,maxTokens:900});
 return {profile:supportedIntakeFields(data.fields,message),reply:typeof data.reply==='string'?data.reply.slice(0,500):'Thanks, I’ve saved the details you supplied.'};
}
export function advanceIntake(session,emit,{reply=''}={}){
 const missing=missingEssentials(session.profile),question=missing[0];
 session.intake={active:!!question,requestedResearch:true,missing,updatedAt:Date.now()};
 session.pendingQuestion=question||null;
 const introduction=reply?reply.split(/(?<=[.!?])\s+/).filter(s=>!s.includes('?')).join(' ').trim():'';
 if(!question){
  emit({type:'message',message:{agent:'arjun',content:`${introduction?introduction+'\n\n':''}Your required profile details are ready. I’m handing them to Nova to begin research. Missing grades, nationality, language results and funding details will stay unknown until you supply them.`}});
  return true;
 }
 session.run={...(session.run||{id:randomUUID(),startedAt:Date.now(),target:10}),status:'needs_input',stage:'profile',progress:5,finalizing:false,message:'Arjun is waiting for one required profile detail.'};
 emit({type:'run',run:session.run});
 emit({type:'message',message:{agent:'arjun',content:`${introduction?introduction+'\n\n':'Before Nova starts searching, I need a little more about your plans.\n\n'}${REQUIRED_QUESTIONS[question]}`}});
 return false;
}
