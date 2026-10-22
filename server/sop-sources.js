import {githubFacts} from './profile-facts.js';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
const clean=v=>String(v||'').replace(/[\r\n]+/g,' ').trim();
const phrase=v=>clean(v).replace(/\*\*|`/g,'').replace(/\s+([,.;!?])/g,'$1').replace(/[.!?]+$/,'');
const literal=v=>clean(v).replace(/[\\`*_{}\[\]<>]/g,'\\$&');
const publicUrl=value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
export const sopSections=[['intro','Introduction'],['academic','Academic background'],['projects','Projects'],['interests','Interests and goals'],['fit','Programme fit'],['closing','Closing']];
export const sectionPlaceholder={intro:'[If supplied, add the degree you intend to pursue.]',academic:'[If supplied, add your current qualification and original-scale academic result.]',projects:'[If supplied, describe one genuine project and your own contribution.]',interests:'[If supplied, describe your interests and career goals.]',fit:'[If confirmed on the official site, explain how a specific programme feature supports your stated interests.]',closing:'[Review and personalise this closing before using the draft.]'};
// Sentences are constructed from known facts, never accepted merely because a
// model supplies a source ID. GitHub references describe metadata, not ownership
// of code, independently assessed skill, or a project's success.
export function sopCatalog(session,opportunity={}){
 const sources=[],sentences=[],facts=[],p=session.profile||{};
 const source=(data)=>{const id=`${data.kind==='official'?'O':'S'}${sources.filter(s=>(s.kind==='official')===(data.kind==='official')).length+1}`;const value={id,...data};sources.push(value);return id;};
 const add=(section,id,text,sourceIds)=>{if(sourceIds.every(Boolean))sentences.push({section,id,text,source_ids:sourceIds});};
 const supplied=source({kind:'student',label:'Student request to prepare an application draft; nothing has been submitted.'});
 const ids={};
 for(const [key,value] of Object.entries(p)){
  if(!clean(value))continue;
  let docFact=(session.facts||[]).find(f=>f.key===key&&norm(f.value)===norm(value)&&norm(f.quote).length>=6&&(session.documents||[]).some(d=>d.name===f.source&&norm(d.text).includes(norm(f.quote))));
  if(!docFact&&key==='cgpa'){
   const score=String(value).match(/^\d+(?:\.\d+)?$/)?.[0];
   if(score){const escaped=score.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const pattern=new RegExp(`\\b(?:CGPA|GPA|cumulative grade point average)\\s*[:=–—-]?\\s*${escaped}\\b[^\\n]{0,35}`,'i');
    for(const d of session.documents||[]){const quote=String(d.text||'').match(pattern)?.[0];if(quote){docFact={source:d.name,quote};break;}}
   }
  }
  ids[key]=source(docFact?{kind:'document',label:docFact.source,key,value:clean(value),quote:clean(docFact.quote)}:{kind:'student',label:`Student-provided profile: ${key.replaceAll('_',' ')} (self-reported)`,key,value:clean(value)});
  facts.push({key,value:clean(value),source_id:ids[key]});
 }
 const pages=session.evidence instanceof Map?session.evidence:new Map();
 const supported=c=>{const page=pages.get(c?.url);return c?.value&&publicUrl(c.url)&&c.quote&&norm(c.quote).length>=16&&page&&norm(page.text).includes(norm(c.quote));};
 const identity=supported(opportunity.identity)&&(opportunity.integrity_checked||opportunity.identity_verified)?opportunity.identity:null;
 const officialId=identity?source({kind:'official',label:'Verified opportunity identity',value:opportunity.name,url:identity.url,quote:identity.quote,retrieved_at:identity.retrieved_at}):null;
 if(p.target_degree&&officialId)add('intro','intro-goal',`I am seeking ${literal(phrase(p.target_degree).replace(/^masters?['’]?s? in /i,"a master's in "))} and am preparing this application for ${literal(opportunity.name)}.`,[ids.target_degree,officialId]);
 else if(p.target_degree)add('intro','intro-goal',`I am seeking ${literal(phrase(p.target_degree).replace(/^masters?['’]?s? in /i,"a master's in "))}.`,[ids.target_degree]);
 else if(officialId)add('intro','intro-opportunity',`I am preparing this application for ${literal(opportunity.name)}.`,[officialId,supplied]);
 if(p.degree)add('academic','academic-degree',`My current studies are ${literal(phrase(p.degree))}.`,[ids.degree]);
 if(p.cgpa)add('academic','academic-grade',`My recorded academic result is ${literal(p.cgpa)}.`,[ids.cgpa]);
 if(p.graduation)add('academic','academic-graduation',`My expected graduation is ${literal(phrase(p.graduation).replace(/\b([a-z]{3,9}) and (20\d{2})\b/i,(_,month,year)=>month[0].toUpperCase()+month.slice(1)+' '+year))}.`,[ids.graduation]);
 if(p.intake)add('academic','academic-intake',`My intended intake is ${literal([p.intake_term,p.intake].filter(Boolean).join(' '))}.`,[ids.intake,...(ids.intake_term?[ids.intake_term]:[])]);
 if(p.interests)add('interests','interests-subject',`My stated academic interests are ${literal(p.interests)}.`,[ids.interests]);
 if(p.career_goals)add('interests','interests-goals',`My stated career goals are ${literal(phrase(p.career_goals).replace(/^(Work|Become|Build|Pursue|Research)\b/i,v=>'to '+v.toLowerCase()))}.`,[ids.career_goals]);
 const github=githubFacts(session.github||{}),projects=github.filter(f=>f.key==='project');
 for(const [i,project] of projects.entries()){
  const id=source({kind:'github',label:`GitHub repository metadata: ${project.value}; authorship and proficiency not independently verified`,url:project.url,value:project.value,retrieved_at:project.retrieved_at});
  facts.push({key:'GitHub project',value:project.value,source_id:id});
  add('projects',`project-${i}`,`My supplied GitHub profile lists the repository “${literal(project.value)}”.`,[id]);
  const description=github.find(f=>f.url===project.url&&f.key==='project_description');
  if(description){const ref=source({kind:'github',label:'Repository README description (repository statement, not an independently verified outcome)',url:project.url,value:description.value,quote:description.quote});add('projects',`project-${i}-description`,`Its README describes the project as “${literal(phrase(description.value))}”.`,[ref]);}
  const skills=github.filter(f=>f.url===project.url&&f.key==='skill').slice(0,4);
  if(skills.length){const ref=source({kind:'github',label:'Repository languages, topics or README technology references; not proof of proficiency',url:project.url,value:skills.map(f=>f.value).join(', ')});facts.push({key:'GitHub technologies',value:skills.map(f=>f.value).join(', '),source_id:ref});add('projects',`project-${i}-skills`,`Its recorded technology references include ${skills.map(f=>`“${literal(phrase(f.value))}”`).join(', ')}.`,[ref]);}
 }
 for(const [i,fact] of (session.facts||[]).entries()){
  if(!['project','achievement','coursework','skill','experience'].includes(fact.key)||!clean(fact.value)||norm(fact.quote).length<16||!norm(fact.quote).includes(norm(fact.value)))continue;
  const document=(session.documents||[]).find(d=>d.name===fact.source&&norm(d.text).includes(norm(fact.quote)));if(!document)continue;
  const ref=source({kind:'document',label:document.name,key:fact.key,value:clean(fact.value),quote:clean(fact.quote)});
  facts.push({key:fact.key,value:clean(fact.value),source_id:ref});
  add(fact.key==='coursework'?'academic':'projects',`document-${i}`,`My uploaded ${fact.key==='coursework'?'academic document':'resume'} records ${literal(fact.key)} as “${literal(fact.value)}”.`,[ref]);
 }
 for(const [key,claim] of Object.entries(opportunity.claims||{})){
  if(!opportunity.integrity_checked||!['Verified','Verified (with note)'].includes(claim?.status)||!supported(claim))continue;
  const id=source({kind:'official',label:`Verified official ${key}`,value:claim.value,url:claim.url,quote:claim.quote,retrieved_at:claim.retrieved_at,note:claim.note});
  const label={requirements:'entry requirement',application:'application instruction',funding:'funding information',deadline:'application timing'}[key];
  if(label)add('fit',`fit-${key}`,`The official ${label} states: “${literal(claim.value)}”.`,[id]);
 }
 add('closing','closing-thanks','Thank you for considering my application.',[supplied]);
 return {sources,sentences,facts,sections:sopSections.map(([id,title])=>({id,title})),hasGithubProjects:projects.length>0};
}
export const sourcedSentence=sentence=>`${sentence.text}${sentence.source_ids.map(id=>`[^${id}]`).join('')}`;
export function defaultSopPlan(catalog){
 return {sections:sopSections.map(([id])=>({id,sentence_ids:catalog.sentences.filter(s=>s.section===id&&(id!=='projects'||!/^project-(\d+)/.test(s.id)||Number(s.id.match(/^project-(\d+)/)[1])<2)).map(s=>s.id)}))};
}
export function plannedSop(catalog,plan=defaultSopPlan(catalog)){
 const fallback=defaultSopPlan(catalog);
 return sopSections.map(([id,title])=>{
  const chosen=plan.sections?.find(s=>s.id===id),requested=Array.isArray(chosen?.sentence_ids)?chosen.sentence_ids:[];
  const allowed=catalog.sentences.filter(s=>s.section===id);
  let selected=[...new Set(requested)].map(key=>allowed.find(s=>s.id===key)).filter(Boolean);
  if(!selected.length)selected=fallback.sections.find(s=>s.id===id).sentence_ids.map(key=>allowed.find(s=>s.id===key));
  // A description must follow its repository name; never leave an orphan "Its".
  if(id==='projects'){const projects=new Set(selected.map(s=>s.id.match(/^project-(\d+)/)?.[1]).filter(Boolean));selected=selected.filter(s=>!/^project-\d+/.test(s.id));for(const index of [...projects].slice(0,2)){for(const suffix of ['','-description','-skills']){const s=allowed.find(s=>s.id===`project-${index}${suffix}`);if(s)selected.push(s);}}}
  const text=selected.length?selected.map(sourcedSentence).join(' '):sectionPlaceholder[id];
  return `## ${title}\n\n${text}${id==='fit'&&selected.length?`\n\n${sectionPlaceholder.fit}`:''}`;
 }).join('\n\n');
}
export function sopFootnote(source){
 return `[^${source.id}]: ${literal(source.label)}${source.url?` — [source](${source.url})`:''}${source.retrieved_at?` · fetched ${literal(source.retrieved_at)}`:''}${source.quote?` · “${literal(source.quote).slice(0,300)}”`:''}`;
}
