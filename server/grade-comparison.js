const scaleIn=value=>{
 const text=String(value||'').replace(/\s+/g,' '),match=text.match(/\b\d+(?:\.\d+)?\s*(?:(?:CGPA|GPA|grade)\s*)?(?:\/|out of(?: a(?: possible)?)?\s*|on (?:a |the )?)\s*(4|10|100)(?:\.0+)?\b/i)||text.match(/\b(4|10|100)(?:\.0+)?[ -](?:point|grade)\s*scale\b/i);
 if(match)return match[1]==='100'?'%':match[1];
 return /\b\d+(?:\.\d+)?\s*%/.test(text)?'%':null;
};
export function gradeComparison(criterion,brief){
 if(!brief||!criterion.evidence||!/\b(?:CGPA|GPA|grade|academic (?:score|result|average)|minimum average)\b/i.test(criterion.label+' '+criterion.required))return null;
 const required=scaleIn(criterion.required)||scaleIn(criterion.evidence.quote),original=brief.cgpa_scale||scaleIn(brief.original_grade);
 if(!required||original&&original===required)return null;
 const reason=original?`The student result is on /${original==='%'?'100 (%)':original}; the requirement is on /${required==='%'?'100 (%)':required}. No conversion or pass/fail judgment has been made.`:'The original student score scale is Missing; it cannot be compared with the published requirement.';
 return {status:'unknown',conversion_check:true,note:`Needs conversion check. ${reason} Confirm an official equivalence or institution-approved conversion.`};
}
