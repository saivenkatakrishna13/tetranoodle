const key=url=>{try{const u=new URL(url);u.hash='';return u.href.replace(/\/$/,'');}catch{return '';}};
export function publicLeadReason(reason){
 const text=String(reason||'').replace(/\s+/g,' ').trim();
 if(!text)return null;
 if(/self signed certificate|certificate chain|SSL certificate|curl:\s*\(60\)/i.test(text))return 'The official page could not be read because its security certificate could not be verified. Open the source website or try again later.';
 if(/candidate time limit|run budget|source-work time budget/i.test(text))return 'The official page needs a follow-up check; research time ended before its details could be established.';
 if(/HTTP (?:404|410)|ENOTFOUND|NXDOMAIN|page (?:is )?unavailable/i.test(text))return 'The official page was unavailable when Sage checked it. It is retained as a source lead, not a recommendation.';
 if(/official source did not establish/i.test(text))return 'The page was reached, but it did not establish the specific programme or award. It remains a source lead for review.';
 return 'This source needs an official evidence check before ScholarX can make a recommendation.';
}
// Discovery metadata is a lead, never evidence for eligibility or funding.
export function publicLeads(run){
 return (run?.candidates||run?.discovered||[]).filter(c=>/^https?:\/\//.test(c.url||'')).map(c=>{
  const receipt=run?.pipeline?.checks?.[c.url]||(!run?.candidates?{state:c.state,checked:c.attempted,reason:c.reason,officialUrl:c.officialUrl}:null);
  return {url:c.url,name:c.name||'Programme details pending',university:c.university||'',country:c.country||'',state:receipt?.state||'pending',attempted:!!receipt?.checked,reason:publicLeadReason(receipt?.reason),officialUrl:receipt?.officialUrl||null};
 });
}
export function discoveryResults(opportunities,run){
 const seen=new Set(),results=[];
 for(const candidate of publicLeads(run)){
  const item=opportunities.find(o=>key(o.url)===key(candidate.officialUrl||candidate.url));
  if(item){if(!seen.has(item.id)){results.push(item);seen.add(item.id);}continue;}
  results.push({id:`lead:${key(candidate.url)}`,...candidate,discovery_only:true,integrity_checked:false,identity_verified:false,recommended:false,eligibility:'unknown',claims:{funding:null,deadline:null,requirements:null,application:null},funding:'Missing: official funding evidence',deadline:'Missing: official intake / deadline',criteria:[],application_steps:[],missing_information:[candidate.reason||'Eligibility and source details still need verification.'],reason:'Discovered source lead. Eligibility, funding and intake have not been established.',score:0});
 }
 for(const item of opportunities)if(!seen.has(item.id))results.push(item);
 return results;
}
export function shortlistLeads(results,recommendations){
 const institutions=new Set(recommendations.map(o=>(o.university||'').trim().toLowerCase()).filter(Boolean));
 return results.filter(o=>{
  if(!o.discovery_only||['dead','ineligible'].includes(o.state))return false;
  const institution=(o.university||'').trim().toLowerCase();if(institution&&institutions.has(institution))return false;
  if(institution)institutions.add(institution);return true;
 }).slice(0,Math.max(0,5-recommendations.length));
}
