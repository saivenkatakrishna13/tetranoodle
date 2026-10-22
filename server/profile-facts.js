import {createHash} from 'node:crypto';
import {gradeParts} from '../shared/profile-options.js';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
const nameKey=v=>norm(v).normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'');
export function realProfileConflict(key,saved,document){
 if(key==='name')return nameKey(saved)!==nameKey(document);
 if(key==='cgpa'){const a=gradeParts(saved),b=gradeParts(document);if(/^\d/.test(a.score)&&/^\d/.test(b.score))return Number(a.score)!==Number(b.score)||!!(a.scale&&b.scale&&a.scale!==b.scale);}
 return norm(saved)!==norm(document);
}
export function profileReviewSignature(session){return createHash('sha256').update(JSON.stringify({profile:Object.fromEntries(Object.entries(session.profile).sort()),revision:session.profileRevision||0,documents:session.documents.map(d=>({id:d.id,name:d.name,text:d.text}))})).digest('hex');}
export function githubFacts(data){
 const facts=[];
 for(const repo of data.repositories||[]){
  if(repo.fork||!/^https:\/\/github\.com\//.test(repo.url||''))continue;
  const add=(key,value,quote,confidence)=>facts.push({key,value,quote,source:repo.url,url:repo.url,confidence,retrieved_at:data.retrieved_at});
  add('project',repo.name,repo.name,'repository metadata; authorship not verified');
  for(const skill of [repo.language,...(repo.topics||[])].filter(Boolean))add('skill',skill,skill,'repository metadata; not proof of proficiency');
  const readme=data.readmes?.find(r=>r.url===repo.url)?.readme;if(!readme)continue;
  const lines=readme.split(/\r?\n/);let stack=false,remaining=0;
  for(const line of lines){
   if(/^#{1,6}\s/.test(line)){stack=/tech(?:nology)?\s*stack|technologies|built with|languages|tools used|skills/i.test(line);remaining=5;continue;}
   if(stack&&remaining-- >0&&line.trim().length>=3&&!/^\s*(?:!\[|<|```)/.test(line))add('skill',line.replace(/^\s*[-*+]\s*/,'').slice(0,300),line,'repository README; not proof of proficiency');
  }
  const description=lines.find(l=>l.trim().length>25&&!/^\s*(?:#|!\[|\[!|<|```)/.test(l));if(description)add('project_description',description.slice(0,400),description,'repository README; project claims not independently verified');
 }
 return [...new Map(facts.map(f=>[`${f.key}\0${f.url}\0${f.value}`,f])).values()];
}
export function restrictedProfile(page){
 if(!/linkedin\.com/i.test(page.url||''))return false;
 const text=String(page.text||'').trim();
 return /authwall|\/login|\/checkpoint|sign in to (?:view|see)|security verification/i.test(`${page.url}\n${text}`)||text.length<100||text.length<600&&/join (?:now|linkedin)|sign in/i.test(text);
}
