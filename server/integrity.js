// Explicit calendar dates override a model's guess about whether a cycle is open.
export function deadlineState(claim, proposed, now=Date.now()) {
  if(!claim)return 'unknown';
  const text=String(claim.quote).replace(/\s+/g,' '),dates=[];
  if(proposed==='expired'&&/\b(?:call|applications?)\s+(?:(?:is|are|has|have)\s+)?(?:now\s+)?(?:been\s+)?closed\b/i.test(text))return 'expired';
  const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  for(const m of text.matchAll(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/g))if(months[m[1].slice(0,3).toLowerCase()]!==undefined)dates.push(Date.UTC(+m[3],months[m[1].slice(0,3).toLowerCase()],+m[2])+86400000);
  for(const m of text.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})\b/g))if(months[m[2].slice(0,3).toLowerCase()]!==undefined)dates.push(Date.UTC(+m[3],months[m[2].slice(0,3).toLowerCase()],+m[1])+86400000);
  for(const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g))dates.push(Date.UTC(+m[1],+m[2]-1,+m[3])+86400000);
  if(dates.length)return Math.max(...dates)<now?'expired':proposed==='expired'?'unknown':'upcoming';
  if(proposed==='rolling'&&/rolling|year.round|any.time/i.test(text))return 'rolling';
  return 'unknown';
}

// Even a source-supported admission rule cannot certify an individual applicant.
export function guardDraft(content, {profile={},opportunity={}}={}) {
  return String(content).split(/((?<=[.!?])\s+(?=[A-Z\[])|(?<=\])\s+(?=[A-Z])|\n\n)/).map(part=>{
    if(/^\s*\[/.test(part))return part;
    if(opportunity.type==='scholarship'&&/^\*\*Program(?:me)?:/i.test(part))return '**Programme:** [Confirm the exact eligible degree programme and admission status]';
    if(/\bI (?:have )?completed\b.*\b(?:degree|B\.Sc|B\.Tech|bachelor|master)/i.test(part)&&!/completed|graduated/i.test(profile.degree||''))return '[Confirm degree completion and graduation date. Current recorded degree: '+(profile.degree||'not supplied')+'.]';
    if(/\b(?:curriculum|coursework)\b|\b(?:my|undergraduate) studies (?:have )?(?:included|covered|equipped|emphasised|emphasized|provided|given|built|developed)|\bMy academic background has provided\b|\bIt also (?:covers|includes|covered|included)\b|\b(?:strong|solid|rigorous) (?:analytical )?foundation\b/i.test(part))return '[Add only transcript-supported coursework and academic preparation here.]';
    if(/\b(?:these|those|my) experiences (?:have )?(?:honed|developed|strengthened|equipped|prepared|introduced)\b/i.test(part))return '[Describe only your confirmed project contributions, outcomes and learning here.]';
    if(/\bI am drawn\b|\breputation for\b|\binterdisciplinary approach\b|\baligns? with my career aspirations\b|\bvibrant academic community\b|\bfaculty members who are active\b|\bI am confident that\b/i.test(part))return '[Add your own motivation and explain the programme fit using verified official information.]';
    if(/\bI (?:can |have reviewed|confirm|am able)\b.*\b(?:additional costs|remaining costs|unfunded costs|not funded|not covered|meet the costs|cover the costs)\b/i.test(part))return '[Confirm a realistic plan for costs not covered by the scholarship; no ability to pay has been established.]';
    if(/\bI have maintained\b.*\bthroughout\b/i.test(part))return `My recorded academic result is ${profile.cgpa||'[enter the original-scale academic result]'}.`;
    if(!profile.career_goals&&/\bI (?:envision|aim|intend|plan|hope)\b/i.test(part))return '[Add your own confirmed career or research goals here.]';
    if(/\b(?:I|we)\s+(?:already\s+)?(?:meet|satisfy|fulfil|fulfill)\b|\b(?:meeting|satisfying)\s+(?:the|all)\s+(?:scholarship|English|admission|academic|language).*requirement|\b(?:CGPA|grade).*\bequivalent\b|\bI am (?:fully )?eligible\b/i.test(part))return '[Confirm academic equivalence, language scores and eligibility with the institution before adding any claim that a requirement is met.]';
    return part;
  }).join('');
}
