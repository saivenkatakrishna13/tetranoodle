// Completion describes the evidence delivered, independently of student eligibility.
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
  const funding=!!claims.funding;
  const deadline=!!claims.deadline && (
    /\b20\d{2}\b/.test(claims.deadline.quote) ||
    /rolling|year.round|any.time|not yet (?:been )?(?:announced|published)|dates? (?:will be|to be) (?:announced|confirmed)/i.test(claims.deadline.quote)
  );
  const application=!!claims.application && (opportunity.application_step_evidence?.length||0)>0;
  const requirements=!!claims.requirements && (opportunity.criteria||[]).some(c=>c.evidence);
  const missing=[!funding&&'funding',!deadline&&'current intake / deadline',!application&&'application instructions',!requirements&&'entry requirements'].filter(Boolean);
  return {funding,deadline,application,requirements,complete:missing.length===0,missing};
}

export function researchCoverage(opportunities,hasDraft) {
  opportunities=distinctProgramPages(opportunities);
  const suitable=opportunities.filter(o=>o.integrity_checked===true&&o.eligibility!=='not_eligible'&&o.deadline_state!=='expired'&&!o.preference_mismatch).length;
  const top=opportunities.filter(o=>o.recommended).slice(0,5);
  const items=top.map(o=>({id:o.id,name:o.name,...evidenceCoverage(o)}));
  return {reviewed:opportunities.filter(o=>o.integrity_checked===true).length,suitable,recommended:top.length,ready:items.filter(o=>o.complete).length,items,
    complete:suitable>=10&&top.length===5&&items.every(o=>o.complete)&&!!hasDraft};
}

// Long university pages often begin with thousands of navigation characters.
// Rank bounded windows around the requested facts instead of cutting at the top.
export function focusedExcerpt(text,topic='all',limit=4200) {
  text=String(text||'');if(text.length<=limit)return text;
  const patterns={funding:/scholarship|funding|stipend|tuition|assistantship|bursar/ig,
    deadline:/deadline|closing date|applications? (?:open|close)|20\d{2}|intake/ig,
    application:/how to apply|application process|apply online|application portal|supporting documents|references|statement of|transcripts/ig,
    all:/scholarship|funding|stipend|deadline|how to apply|entry requirements|admission requirements|20\d{2}/ig};
  const regex=patterns[topic]||patterns.all,windows=[];
  for(const match of text.matchAll(regex)){
    const start=Math.max(0,match.index-180),end=Math.min(text.length,match.index+950);
    const snippet=text.slice(start,end);
    const score=(snippet.match(regex)||[]).length + (/\b20\d{2}\b/.test(snippet)?2:0) + (/\d[\d,.]*\s*(?:CAD|EUR|€|\$)|(?:CAD|EUR|€|\$)\s*\d/.test(snippet)?2:0);
    windows.push({start,end,score});
  }
  const chosen=[{start:0,end:Math.min(650,limit)}];let length=chosen[0].end;
  for(const w of windows.sort((a,b)=>b.score-a.score||a.start-b.start)){
    if(chosen.some(c=>w.start<c.end&&w.end>c.start))continue;
    const remaining=limit-length-12;if(remaining<180)break;
    chosen.push({...w,end:Math.min(w.end,w.start+remaining)});length+=chosen.at(-1).end-w.start+12;
  }
  return chosen.sort((a,b)=>a.start-b.start).map(w=>text.slice(w.start,w.end)).join('\n[…]\n').slice(0,limit);
}

export function institutionDomain(url) {
  const host=new URL(url).hostname.replace(/^www\./,'');
  const parts=host.split('.');
  return parts.slice(/\.(?:ac\.uk|edu\.(?:sg|au|in)|ac\.in)$/.test(host)?-3:-2).join('.');
}
