export const intakeTerms=['Fall','Winter','Spring','Summer'];
export const gradeScales=['10','4','%'];
export const fundingNeeds=['none','partial','full'];
export function gradeParts(value){
 const text=String(value||'').trim(),match=text.match(/^(\d+(?:\.\d+)?)\s*(?:\/\s*(10|4)|(%))?$/);
 return match?{score:match[1],scale:match[2]||match[3]||''}:{score:text,scale:''};
}
export function normalizeProfileOptions(profile){
 const result={...profile};
 if(result.intake_term){const term=intakeTerms.find(t=>t.toLowerCase()===result.intake_term.toLowerCase());if(!term)throw Error('Choose Fall, Winter, Spring or Summer for the intake term.');result.intake_term=term;}
 if(result.funding_need&&!fundingNeeds.includes(result.funding_need))throw Error('Choose none, partial or full for funding need.');
 if(result.cgpa_scale){
  if(!gradeScales.includes(result.cgpa_scale))throw Error('Choose /10, /4 or % for the original score scale.');
  if(result.cgpa){const p=gradeParts(result.cgpa);if(!/^\d+(?:\.\d+)?$/.test(p.score)||p.scale&&p.scale!==result.cgpa_scale)throw Error('Enter a numeric score on the selected original scale; no conversion is performed.');
   if(Number(p.score)>Number(result.cgpa_scale==='%'?100:result.cgpa_scale))throw Error('The score exceeds the selected scale.');
   result.cgpa=result.cgpa_scale==='%'?`${p.score}%`:`${p.score} / ${result.cgpa_scale}`;
  }
 }
 return result;
}
