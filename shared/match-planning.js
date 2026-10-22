// Costs are never guessed from a destination. Structured amounts need their own
// exact official quote, currency and period; incompatible periods stay Missing.
export function fundingFit(costs){
 const keys=['tuition','living','funding'];
 if(!costs||keys.some(key=>!costs[key]||!Number.isFinite(costs[key].amount)||costs[key].amount<0||!costs[key].evidence))return {status:'Missing',gap:null,reason:'Sourced tuition, living costs and funding amounts are required.'};
 const values=keys.map(key=>costs[key]);
 if(new Set(values.map(v=>v.currency)).size!==1||new Set(values.map(v=>v.period)).size!==1)return {status:'Missing',gap:null,reason:'Currencies and cost periods must match; no exchange rate or duration is assumed.'};
 return {status:'Estimate',gap:Math.max(0,costs.tuition.amount+costs.living.amount-costs.funding.amount),currency:costs.tuition.currency,period:costs.tuition.period,reason:'Tuition + living costs − offered funding. Competitive awards are not guaranteed.',sources:values.map(v=>v.evidence)};
}
export function validateCosts(costs,evidence){const result={};for(const key of ['tuition','living','funding']){const c=costs?.[key],page=evidence.get(c?.url);if(!c||!page||typeof c.quote!=='string'||!page.text.toLowerCase().includes(c.quote.toLowerCase())||!Number.isFinite(c.amount)||c.amount<0||!/^[A-Z]{3}$/.test(c.currency||'')||!['year','month','total'].includes(c.period))continue;const number=String(c.amount);const numeric=c.quote.replace(/[,\s]/g,'');const periodPattern={year:/\b(?:year|annual|annum)\b/i,month:/\bmonth(?:ly)?\b/i,total:/\btotal\b/i}[c.period];const amounts=[...c.quote.replace(/,/g,'').matchAll(/\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));if(!amounts.includes(c.amount)||!c.quote.includes(c.currency)||!periodPattern.test(c.quote))continue;if(c.period==='year'&&/\bmonth(?:ly)?\b/i.test(c.quote)||c.period==='month'&&/\b(?:year|annual|annum)\b/i.test(c.quote))continue;result[key]={amount:c.amount,currency:c.currency,period:c.period,evidence:{value:`${c.amount} ${c.currency} / ${c.period}`,url:page.url,quote:c.quote,retrieved_at:page.retrieved_at}};}return result;}
export function applicationTaskId(id,claim){let hash=2166136261;for(const char of `${claim.url}\n${claim.value}\n${claim.quote}`)hash=Math.imul(hash^char.charCodeAt(0),16777619);return `${id}:${(hash>>>0).toString(16)}`;}
export function applicationPlan(opportunity,progress={}){return (opportunity.application_step_evidence||[]).map(claim=>{const id=applicationTaskId(opportunity.id,claim);return {id,label:claim.value,evidence:claim,done:!!progress[id],date:deadlineInfo(opportunity).date};});}
function calendarDates(text){
 const result=[],months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 const add=(year,month,day)=>{const date=new Date(Date.UTC(+year,+month,+day));if(date.getUTCFullYear()===+year&&date.getUTCMonth()===+month&&date.getUTCDate()===+day)result.push(date.toISOString().slice(0,10));};
 for(const m of String(text||'').matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g))add(m[1],+m[2]-1,m[3]);
 for(const m of String(text||'').matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})[,]?\s+(20\d{2})\b/g)){const month=months.indexOf(m[2].slice(0,3).toLowerCase());if(month>=0)add(m[3],month,m[1]);}
 for(const m of String(text||'').matchAll(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/g)){const month=months.indexOf(m[1].slice(0,3).toLowerCase());if(month>=0)add(m[3],month,m[2]);}
 return [...new Set(result)];
}
export function deadlineInfo(opportunity,now=Date.now()){
 const claim=opportunity.claims?.deadline;if(!claim)return {status:'Missing',date:null,days:null};
 const dates=calendarDates(claim.quote),values=calendarDates(claim.value);
 const matching=values.filter(date=>dates.includes(date));
 const supplied=opportunity.deadline_date;
 const date=supplied&&dates.includes(supplied)?supplied:matching.length===1?matching[0]:dates.length===1?dates[0]:null;
 if(!date)return {status:opportunity.deadline_state==='rolling'?'Rolling':'Missing',date:null,days:null};
 const closes=Date.parse(date+'T00:00:00Z')+86400000,days=Math.max(0,Math.ceil((closes-now)/86400000)-1);
 return {date,days,status:closes<now?'Closed':days<=30?'Closing soon':'Upcoming',timezone:'UTC calendar estimate; confirm the provider’s exact closing time.'};
}
export function profileStrength(profile,documents=[],opportunities=[]){const fields=['degree','target_degree','countries','cgpa','nationality','language_scores','intake','graduation','budget','career_goals'];const missing=fields.filter(key=>!profile[key]&&!(key==='budget'&&profile.funding_need));return {score:Math.round((fields.length-missing.length)/fields.length*100),label:'Profile completeness, not admission probability',suggestions:missing.map(key=>({key,label:`Add ${key.replaceAll('_',' ')} to improve eligibility checks.`})),documentCount:documents.length,unresolved:opportunities.flatMap(o=>(o.criteria||[]).filter(c=>c.status==='unknown').map(c=>c.label))};}
