export function studyLevels(value){
 const text=String(value||''),levels=[];
 if(/bachelor|undergrad|\bB\.?\s?(?:Sc|Tech|Eng|Des|Com|A)\b/i.test(text))levels.push('bachelor');
 if(/master|postgrad|\bM\.?\s?(?:Sc|Tech|Eng|Des|A)\b|\bMBA\b|\bLLM\b/i.test(text))levels.push('master');
 if(/\bPh\.?D\b|doctor(?:al|ate)|\bDPhil\b/i.test(text))levels.push('doctorate');
 if(/diploma|certificate/i.test(text))levels.push('diploma');
 return levels;
}
export function missingStudyEssentials(profile,goal=profile.target_degree){
 const missing=[];
 if(!profile.degree?.trim()||/^(?:(?:final|first|second|third|fourth|last|[1-6](?:st|nd|rd|th)?)\s*(?:year|eyar|semester)|student|undergraduate|graduate)\s*(?:student)?$/i.test(profile.degree.trim()))missing.push('degree');
 if(!studyLevels(goal).length)missing.push('target_degree');
 if(!String(profile.countries||'').trim())missing.push('countries');
 return missing;
}
