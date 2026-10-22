// Completion describes the evidence delivered, independently of student eligibility.
import {datedDeadline} from './field-evidence.js';
export function distinctProgramPages(items) {
  const result=[],seen=new Map();
  for(const item of items){
    let key;
    if(item.type!=='scholarship')try{
      const url=new URL(item.url);
      const path=url.pathname.replace(/\/(?:admissions?|entry-requirements|tuition-fees(?:-and-financial-support)?)\/?$/i,'').replace(/[-/]+$/,'');
      key=url.hostname.replace(/^www\./,'').toLowerCase()+path.toLowerCase()+url.search;
    }catch{/* Invalid URLs are handled by source validation. */}
    if(!key||!seen.has(key)){if(key)seen.set(key,result.length);result.push(item);continue;}
    const index=seen.get(key),old=result[index];
    const quality=o=>Number(o.integrity_checked===true)*1000+Number(o.eligibility==='not_eligible'||o.deadline_state==='expired')*100+Object.values(o.claims||{}).filter(Boolean).length+(o.criteria||[]).filter(c=>c.evidence).length;
    if(quality(item)>quality(old))result[index]=item;
  }
  return result;
}

export function evidenceCoverage(opportunity) {
  const claims=opportunity.claims||{};
  const verified=c=>!!c&&!['Partial','Unverified','Missing'].includes(c.status);
  const funding=verified(claims.funding);
  const deadline=verified(claims.deadline)&&datedDeadline(claims.deadline.quote);
  const application=verified(claims.application) && (opportunity.application_step_evidence?.length||0)>0;
  const requirements=verified(claims.requirements) && (opportunity.criteria||[]).some(c=>c.evidence);
  const missing=[!funding&&'funding',!deadline&&'current intake / deadline',!application&&'application instructions',!requirements&&'entry requirements'].filter(Boolean);
  return {funding,deadline,application,requirements,complete:missing.length===0,missing};
}

export function researchCoverage(opportunities,hasDraft) {
  opportunities=distinctProgramPages(opportunities);
  const suitable=opportunities.filter(o=>(o.integrity_checked===true||o.identity_verified===true)&&o.eligibility!=='not_eligible'&&o.deadline_state!=='expired'&&!o.preference_mismatch).length;
  const top=opportunities.filter(o=>o.recommended).slice(0,5);
  const items=top.map(o=>{const coverage=evidenceCoverage(o);return {id:o.id,name:o.name,...coverage,missing:o.integrity_checked!==true?[...coverage.missing,'independent field verification']:coverage.missing,complete:o.integrity_checked===true&&coverage.complete};});
  return {reviewed:opportunities.filter(o=>o.integrity_checked===true).length,suitable,recommended:top.length,ready:items.filter(o=>o.complete).length,items,
    complete:suitable>=10&&top.length===5&&items.every(o=>o.complete)&&!!hasDraft};
}

// Long university pages often begin with thousands of navigation characters.
// Rank bounded windows around the requested facts instead of cutting at the top.
export function focusedExcerpt(text,topic='all',limit=4200) {
  text=String(text||'');if(text.length<=limit)return text;
  const patterns={costs:/living|accommodation|maintenance|tuition|fees|stipend/ig,funding:/scholarship|funding|stipend|tuition|assistantship|bursar/ig,
    deadline:/deadline|closing date|applications? (?:open|close)|20\d{2}|intake/ig,
    application:/how to apply|application process|apply on.?line|application portal|supporting documents|references|statement of|transcripts/ig,
    requirements:/entry requirements|admission requirements|minimum|bachelor|English|IELTS|TOEFL|prerequisite/ig,
    all:/scholarship|funding|stipend|deadline|how to apply|entry requirements|admission requirements|20\d{2}/ig};
  const regex=patterns[topic]||patterns.all,windows=[];
  for(const match of text.matchAll(regex)){
    const start=Math.max(0,match.index-180),end=Math.min(text.length,match.index+950);
    const snippet=text.slice(start,end);
    const score=(snippet.match(regex)||[]).length + (/\b20\d{2}\b/.test(snippet)?2:0) + (/\d[\d,.]*\s*(?:CAD|EUR|€|\$)|(?:CAD|EUR|€|\$)\s*\d/.test(snippet)?2:0);
    windows.push({start,end,score});
  }
  const chosen=[{start:0,end:Math.min(350,Math.floor(limit*.18))}];let length=chosen[0].end;
  for(const w of windows.sort((a,b)=>b.score-a.score||a.start-b.start)){
    if(chosen.some(c=>w.start<c.end&&w.end>c.start))continue;
    const remaining=limit-length-12;if(remaining<180)break;
    chosen.push({...w,end:Math.min(w.end,w.start+remaining)});length+=chosen.at(-1).end-w.start+12;
  }
  return chosen.sort((a,b)=>a.start-b.start).map(w=>text.slice(w.start,w.end)).join('\n[…]\n').slice(0,limit);
}

// Keep the actual subject/programme passage even when navigation or funding
// links dominate a long university page. Every character stays verbatim.
export function candidateExcerpt(text,name,limit=2800){
 text=String(text||'');if(text.length<=limit)return text;
 const generic=new Set(['master','masters','science','arts','bachelor','graduate','admission','admissions','university','programme','program','programs','programmes','future','students','school','studies','computing-school']);
 const words=[...new Set(String(name||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>3&&!generic.has(w)))];
 const lower=text.toLowerCase(),windows=[];
 for(const word of words){let at=lower.indexOf(word),count=0;while(at>=0&&count++<50){const start=Math.max(0,at-140),end=Math.min(text.length,at+620),part=lower.slice(start,end);windows.push({start,end,score:words.filter(w=>part.includes(w)).length*3+Number(/\bmsc\b|master|degree|programme|program/.test(part))});at=lower.indexOf(word,at+word.length);}}
 const best=windows.sort((a,b)=>b.score-a.score||a.start-b.start)[0];
 if(!best)return focusedExcerpt(text,'all',limit);
 const identity=text.slice(best.start,best.end);return identity+'\n[…]\n'+focusedExcerpt(text,'all',limit-identity.length-7);
}

export function institutionDomain(url) {
  const host=new URL(url).hostname.replace(/^www\./,'');
  const parts=host.split('.');
  return parts.slice(/\.(?:ac\.uk|edu\.(?:sg|au|in)|ac\.in)$/.test(host)?-3:-2).join('.');
}
