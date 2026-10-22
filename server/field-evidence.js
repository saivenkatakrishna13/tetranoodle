const norm=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase();
export function datedDeadline(quote){
 const text=String(quote||'').replace(/copyright[^\n]*(?:\n|$)/ig,'').replace(/©[^\n]*(?:\n|$)/g,'');
 return /\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\s+[a-z]{3,9}\s+20\d{2}\b|\b[a-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}\b/i.test(text)||/rolling|year.round|any.time|not yet (?:been )?(?:announced|published)|dates? (?:will be|to be) (?:announced|confirmed)/i.test(text);
}
// Cheap, conservative guards supplement (never replace) Mira's semantic review.
export function fieldEvidenceSupported(field,claim,{candidate,page}={}){
 if(!claim)return false;
 const value=String(claim.value||''),quote=String(claim.quote||'');
 if(field==='deadline'&&/\b20\d{2}\b/.test(value)&&!datedDeadline(quote))return false;
 if(field==='application'&&/online|portal|upload/i.test(value)&&!/online|portal|upload/i.test(quote))return false;
 if(field==='application'&&/(?:[$€£]|\b(?:CAD|USD|EUR|GBP)\b)\s*\d/i.test(value)&&/\b(?:most (?:graduate )?programs?|usually|typically|may vary)\b/i.test(quote))return false;
 if(field==='requirements'&&/\b(?:English|IELTS|TOEFL|language)\b/i.test(value)&&!/\b(?:English|IELTS|TOEFL|language)\b/i.test(quote))return false;
 // An explicitly named subject/concentration in a degree heading narrows the
 // source. A shared institution or degree acronym does not broaden its scope.
 const heading=quote.match(/^\s*([^:\n.]{6,150}):\s*(?:Master|Bachelor|Doctor|MSc\b|MA\b|PhD\b)/i);
 if(heading&&candidate?.name){
  const generic=/^(?:the|and|for|with|from|our|your|how|apply|application|applications|entry|admission|admissions|requirement|requirements|programme?|programs?|specific|school|faculty|department|graduate|postgraduate|degree|degrees|funding|financial|support|scholarships?|deadlines?|fall|spring|winter|summer)$/;
  const qualifiers=norm(heading[1]).split(/[^\p{L}\p{N}]+/u).filter(t=>t.length>3&&!generic.test(t)&&!/^\d+$/.test(t));
  if(qualifiers.some(t=>!norm(candidate.name).includes(t)))return false;
 }
 // A multi-award directory cannot lend another award's funding or procedure.
 // A specific award needs its name near the actual quoted section, unless a
 // separate supporting page is explicitly identified as that award's source.
 if(candidate?.type==='scholarship'&&page?.text){
  const tokens=norm(candidate.name).split(/[^\p{L}\p{N}]+/u).filter(t=>t.length>3&&!/^(scholarships?|awards?|fellowships?|merit|excellence|students?|international|programme?|university|master|doctoral|degree|study|studies)$/.test(t));
  const text=norm(page.text),fragment=norm(quote).slice(0,100);
  if(tokens.length&&fragment&&!tokens.some(t=>norm(page.title).includes(t))){
   let at=text.indexOf(fragment),belongs=false;
   while(at>=0){const nearby=text.slice(Math.max(0,at-900),at+norm(quote).length+250);if(tokens.some(t=>nearby.includes(t))){belongs=true;break;}at=text.indexOf(fragment,at+fragment.length);}
   if(!belongs)return false;
  }
 }
 return true;
}
