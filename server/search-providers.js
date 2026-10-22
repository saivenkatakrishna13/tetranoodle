import {publicWebUrl} from '../shared/models.js';
export function usableResults(items){return [...new Map((items||[]).filter(r=>publicWebUrl(r.url)).map(r=>[r.url,{url:r.url,title:String(r.title||r.url),snippet:String(r.snippet||r.content||'').slice(0,1600)}])).values()];}
export function cacheSearch(session,query,result){
 const results=usableResults(result.results);if(!results.length)throw Error('Search returned no usable results.');
 session.searchCache||={};session.searchCache[query]={results,provider:result.provider,fetched_at:new Date().toISOString()};
 return {...result,results};
}
export function cachedSearch(session,query){const entry=session.searchCache?.[query];return entry&&Date.now()-Date.parse(entry.fetched_at)<86400000?{...entry,provider:`Cache (${entry.provider})`,cached:true,note:'Previously fetched discovery leads; page verification remains required.'}:null;}
export async function secondarySearch(args,signal,emit,agent,{request=fetch,before=()=>{}}={}){
 const timeout=()=>AbortSignal.any([signal,AbortSignal.timeout(15000)]);
 const providers=[];
 if(process.env.SERPER_API_KEY)providers.push(['Serper',async()=>{const r=await request('https://google.serper.dev/search',{method:'POST',headers:{'Content-Type':'application/json','X-API-KEY':process.env.SERPER_API_KEY},body:JSON.stringify({q:args.query,num:Math.min(args.limit||8,10)}),signal:timeout()});if(!r.ok)throw Error('Serper unavailable');return (await r.json()).organic?.map(r=>({url:r.link,title:r.title,snippet:r.snippet}));}]);
 if(process.env.BRAVE_SEARCH_API_KEY)providers.push(['Brave',async()=>{const url=new URL('https://api.search.brave.com/res/v1/web/search');url.searchParams.set('q',args.query);url.searchParams.set('count',Math.min(args.limit||8,10));const r=await request(url,{headers:{'X-Subscription-Token':process.env.BRAVE_SEARCH_API_KEY,Accept:'application/json'},signal:timeout()});if(!r.ok)throw Error('Brave unavailable');return (await r.json()).web?.results?.map(r=>({url:r.url,title:r.title,snippet:r.description}));}]);
 for(const [provider,run]of providers)try{before();const results=usableResults(await run());if(!results.length)throw Error('Empty results');return {provider,results};}catch(e){if(signal.aborted)throw e;emit({type:'activity',agent,label:`${provider} unavailable or empty; trying the next search provider.`,state:'failure'});}
 return null;
}
