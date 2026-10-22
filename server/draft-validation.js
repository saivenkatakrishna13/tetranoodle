import {gradeComparison} from './grade-comparison.js';
import {guardDraft} from './integrity.js';
import {sopCatalog,sopSections,sectionPlaceholder,sourcedSentence,plannedSop,sopFootnote} from './sop-sources.js';
const norm=text=>String(text||'').replace(/\s+/g,' ').trim();
const literal=value=>String(value||'').replace(/[\r\n]+/g,' ').replace(/[\\`*_{}\[\]<>]/g,'\\$&');
// Fail closed at sentence level. An attached URL/footnote never authorizes new
// prose: only exact server-built sentences from the two source classes survive.
export function validateDraft(content,session,opportunity,options={}){
 const catalog=sopCatalog(session,opportunity),blocked=[],gaps=new Set();
 const groups=Object.fromEntries(sopSections.map(([id])=>[id,[]]));let current='intro';
 const body=String(content||'').split(/\n## (?:Supported student facts|Opportunity evidence for your review|Sentence sources|Gaps to complete)\b/)[0];
 const allowed=catalog.sentences.slice().sort((a,b)=>b.text.length-a.text.length);
 for(const paragraph of body.split(/\n\s*\n/)){
  const text=paragraph.trim();if(!text)continue;
  if(/^#{1,6}\s/.test(text)){
   const title=text.replace(/^#{1,6}\s+/,'').trim().toLowerCase(),section=sopSections.find(([,label])=>label.toLowerCase()===title);
   if(section)current=section[0];continue;
  }
  if(text.includes('[Confirm a realistic plan'))gaps.add('Confirm a realistic plan for costs not covered by the scholarship; no ability to pay has been established.');
  if(/^\[.*\]$/s.test(text)){
   if(/^\[Confirm a realistic plan/i.test(text))gaps.add('Confirm a realistic plan for costs not covered by the scholarship; no ability to pay has been established.');
   else gaps.add(sectionPlaceholder[current].slice(1,-1));
   continue;
  }
  let remaining=norm(text);
  while(remaining){
   const sentence=allowed.find(s=>remaining===norm(sourcedSentence(s))||remaining.startsWith(norm(sourcedSentence(s))+' ')||remaining===norm(s.text)||remaining.startsWith(norm(s.text)+' '));
   if(sentence){const canonical=norm(sourcedSentence(sentence)),plain=norm(sentence.text),length=remaining.startsWith(canonical)?canonical.length:plain.length;groups[sentence.section].push(sourcedSentence(sentence));remaining=remaining.slice(length).trim();continue;}
   // Legacy exact field values remain usable, but acquire real provenance.
   const fact=catalog.facts.find(f=>remaining===norm(literal(f.value)));
   if(fact){groups[current].push(`${literal(fact.value)}[^${fact.source_id}]`);remaining='';continue;}
   blocked.push(remaining);gaps.add(sectionPlaceholder[current].slice(1,-1));remaining='';
  }
 }
 const sections=sopSections.map(([id,title])=>{
  const sentences=[...new Set(groups[id])];
  if(!sentences.length)gaps.add(sectionPlaceholder[id].slice(1,-1));
  if(id==='fit')gaps.add('Confirm a specific programme feature on the official site, then explain its fit with your own interests.');
  return `## ${title}\n\n${sentences.join(' ').replace(/ (My supplied GitHub profile lists)/g,'\n\n$1')||sectionPlaceholder[id]}${id==='fit'&&sentences.length?`\n\n${sectionPlaceholder.fit}`:''}`;
 }).join('\n\n');
 if(catalog.hasGithubProjects)gaps.add('Add your own contribution and any evidenced outcomes for the selected GitHub projects; metadata alone does not prove authorship or proficiency.');
 for(const key of ['funding','deadline'])if(!opportunity.integrity_checked||!['Verified','Verified (with note)'].includes(opportunity.claims?.[key]?.status))gaps.add(`Confirm ${key==='deadline'?'the current application deadline':'funding coverage and any remaining costs'} on the official site.`);
 for(const raw of opportunity.criteria||[]){const c={...raw,...(gradeComparison(raw,{original_grade:session.profile?.cgpa,cgpa_scale:session.profile?.cgpa_scale})||{})};if(c.status==='unknown')gaps.add(c.conversion_check?`${c.label}: ${c.note}`:`Confirm ${c.label}: ${c.required||'the sourced requirement'}`);}
 const used=new Set([...sections.matchAll(/\[\^([SO]\d+)\]/g)].map(m=>m[1]));
 const facts=catalog.facts.filter(f=>!/^GitHub/.test(f.key)||used.has(f.source_id));
 const factLines=facts.map(f=>{used.add(f.source_id);return `- ${f.key.replaceAll('_',' ')} (student supplied): ${literal(f.value)}[^${f.source_id}]`;});
 const sources=Object.entries(opportunity.claims||{}).filter(([,c])=>c?.quote&&c.url).map(([key,c])=>`### ${key}\n${c.status==='Verified'&&opportunity.integrity_checked?'Verified':c.status||'Unverified'}\n> ${c.quote.replace(/\n/g,'\n> ')}\n\n[Official source](${c.url}) · read ${c.retrieved_at}`);
 const footnotes=catalog.sources.filter(s=>used.has(s.id)).map(sopFootnote).join('\n');
 const gapLines=[...new Set([...gaps].map(g=>String(g).replace(/^\[|\]$/g,'').trim()))].filter(Boolean).map(g=>`- ${g}`).join('\n');
 return {content:`# DRAFT — ${literal(opportunity.name||'Application')}\n\n${options.fallback?'> Prepared from source-backed student facts because AI drafting was unavailable. This is not a newly AI-reviewed statement.\n\n':''}${sections}\n\n## Supported student facts\n${factLines.join('\n')||'[Missing: student facts]'}\n\n## Opportunity evidence for your review\n${sources.join('\n\n')||'[Missing: source evidence]'}\n\n${footnotes}\n\nDraft only. Verify on the official site before applying. Nothing has been submitted.\n\n## Gaps to complete\n${gapLines||'- Review the cited facts and personalise this draft before use.'}`,blocked,validated:true,sources:catalog.sources.filter(s=>used.has(s.id))};
}
export function sourceDraft(session,opportunity,{plan,fallback=false}={}){
 const catalog=sopCatalog(session,opportunity);
 // This plan contains only exact catalog sentences; prose supplied by a model
 // or a user still goes through the fail-closed validator and existing guard.
 return validateDraft(plannedSop(catalog,plan),session,opportunity,{fallback});
}
export function readableDraft(session){
 if(!session.draft)return '';
 if(session.draftMeta?.validation==='source-constrained'||session.draftMeta?.method==='profile-template')return session.draft;
 const opportunity=session.opportunities?.find(o=>o.id===session.draftMeta?.opportunityId)||session.opportunities?.find(o=>o.recommended)||{claims:{}};
 return validateDraft(guardDraft(session.draft,{profile:session.profile,opportunity}),session,opportunity).content;
}
