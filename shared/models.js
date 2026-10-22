export const verificationStates=Object.freeze(['Verified','Verified (with note)','Partial','Unverified','Missing']);
export function publicWebUrl(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
/** @param {unknown} value @returns {asserts value is import('./models').StudentProfile} */
export function assertStudentProfile(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.values(value).some(v=>typeof v!=='string'))throw Error('StudentProfile fields must be strings.');}
/** @param {unknown} value @returns {asserts value is import('./models').Evidence} */
export function assertEvidence(value){if(!value||typeof value!=='object'||!publicWebUrl(value.url)||typeof value.value!=='string'||!value.value.trim()||typeof value.quote!=='string'||value.quote.trim().length<16||!Number.isFinite(Date.parse(value.retrieved_at)))throw Error('Evidence needs a value, source URL, snippet and valid retrieval time.');}
/** @param {unknown} value @returns {asserts value is import('./models').Opportunity} */
export function assertOpportunity(value){if(!value||typeof value!=='object'||!value.id||!value.name||!publicWebUrl(value.url)||!value.claims)throw Error('Opportunity requires an identity, URL and claims.');for(const claim of Object.values(value.claims))if(claim)assertEvidence(claim);}
export function evidenceLabel(claim,reviewed=false){return !claim?'Missing':claim.status==='Partial'?'Partial':reviewed&&claim.status==='Verified (with note)'?'Verified (with note)':reviewed?'Verified':'Unverified';}
