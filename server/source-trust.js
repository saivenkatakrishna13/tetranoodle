// Publisher classification is separate from claim correctness. URL suffixes alone
// never prove university ownership; only the existing independent review can.
export function sourceTrust(url,{official=false}={}){
 let host;try{host=new URL(url).hostname;}catch{return {kind:'unknown',score:null,label:'Missing',reason:'No valid source URL.'};}
 if(official)return {kind:'official',score:95,label:'Official · 95/100',reason:'Publisher ownership independently reviewed; this is a provenance heuristic, not a factual guarantee.'};
 if(/(?:^|\.)(?:medium\.com|wordpress\.com|blogspot\.com)$/.test(host)||/\bblog\b/.test(host))return {kind:'blog',score:25,label:'Blog · 25/100',reason:'Third-party commentary; verify every claim with the actual provider.'};
 return {kind:'aggregator',score:45,label:'Third party · 45/100',reason:'Publisher ownership unverified; discovery lead only.'};
}
