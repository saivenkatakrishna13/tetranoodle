const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export function calendarRange(value){
 const text=String(value||'');let year,month,day;
 let m=text.match(/\b(20\d{2})-(\d{2})(?:-(\d{2}))?\b/);
 if(m){year=+m[1];month=+m[2]-1;day=m[3]?+m[3]:null;}
 else if((m=text.match(/\b(\d{1,2})\s+([a-z]{3,9})[,]?\s+(20\d{2})\b/i))){year=+m[3];month=months.indexOf(m[2].slice(0,3).toLowerCase());day=+m[1];}
 else if((m=text.match(/\b([a-z]{3,9})\s+(?:(\d{1,2})(?:st|nd|rd|th)?[,]?\s+)?(?:and\s+)?(20\d{2})\b/i))){year=+m[3];month=months.indexOf(m[1].slice(0,3).toLowerCase());day=m[2]?+m[2]:null;}
 if(!year||month<0||month>11||day&& (day<1||day>new Date(Date.UTC(year,month+1,0)).getUTCDate()))return null;
 return {earliest:Date.UTC(year,month,day||1),latest:Date.UTC(year,month,day||new Date(Date.UTC(year,month+1,0)).getUTCDate()),precision:day?'day':'month'};
}
export function intakeCompatibility(profile,startClaim){
 const graduation=calendarRange(profile.graduation);if(!graduation)return {status:'unknown',reason:'Graduation month/date Missing; intake timing cannot be confirmed.'};
 let start=null;
 if(startClaim&&startClaim.status!=='Partial'&&/start|begin|commenc|classes|teaching|term\s*:/i.test(startClaim.quote||'')){
  const proposed=calendarRange(startClaim.value),quoted=calendarRange(startClaim.quote);
  if(proposed&&quoted&&proposed.earliest===quoted.earliest)start=proposed;
 }
 if(start){
  if(start.latest<graduation.earliest)return {status:'before_graduation',reason:'The sourced intake starts before the supplied graduation date.',evidence:startClaim};
  if(start.earliest>=graduation.latest)return {status:'compatible',reason:'The sourced intake starts after the supplied graduation date.',evidence:startClaim};
  return {status:'unknown',reason:'Intake and graduation overlap. Supply the exact graduation day before eligibility can be confirmed.',evidence:startClaim};
 }
 const term=profile.intake_term||String(profile.intake||'').match(/Fall|Winter|Spring|Summer/i)?.[0],year=String(profile.intake||'').match(/\b20\d{2}\b/)?.[0];
 const month={winter:0,spring:2,summer:5,fall:8}[String(term||'').toLowerCase()];
 if(year&&month!==undefined&&Date.UTC(+year,month,1)<graduation.earliest)return {status:'before_graduation',reason:`Requested ${term} ${year} precedes graduation under the planning calendar. A later actual provider start date must be sourced before recommending that intake.`,planningEstimate:true};
 return {status:'unknown',reason:'Official intake start date Missing. Term names alone do not prove a university starts after graduation.'};
}
