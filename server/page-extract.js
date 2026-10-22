import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

export async function publicPageUrl(value,{resolve=lookup}={}){
 const u=new URL(value);
 if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port))throw Error('Only public HTTP(S) source URLs are supported.');
 const addresses=await resolve(u.hostname,{all:true});
 const privateAddress=address=>{
  if(isIP(address)===6){const a=address.toLowerCase();if(a.startsWith('::ffff:'))return privateAddress(a.slice(7));return !/^[23][0-9a-f]{3}:/.test(a)||/^2001:(?:db8|0:)/.test(a);}
  if(isIP(address)!==4)return true;
  const [a,b]=address.split('.').map(Number);return a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&[18,19].includes(b);
 };
 if(!addresses.length||addresses.some(a=>privateAddress(a.address)))throw Error('Private or local source URLs cannot be extracted.');
 return u.href;
}

// No query/chunks_per_source: Tavily must return page content, never search
// snippets. Only use it when local Scrapling cannot retrieve a readable page.
export async function extractPage(url,signal,{request=fetch,key=process.env.TAVILY_API_KEY,validate=publicPageUrl}={}){
 if(!key)throw Error('Full-page extraction fallback is not configured.');
 await validate(url);
 const response=await request('https://api.tavily.com/extract',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({urls:[url],extract_depth:'advanced',format:'markdown',timeout:20}),signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(25000)])});
 if(!response.ok)throw Error(`Full-page extractor returned HTTP ${response.status}.`);
 const data=await response.json(),page=data.results?.find(p=>typeof p.raw_content==='string'&&p.raw_content.trim().length>=150);
 if(!page)throw Error('Full-page extractor could not read this source.');
 await validate(page.url);
 const text=page.raw_content.slice(0,120000),links=[];
 for(const match of text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g))links.push({text:match[1],url:match[2]});
 return {url:page.url,requested_url:url,title:new URL(page.url).hostname,text,links:[...new Map(links.map(l=>[l.url,l])).values()].slice(0,100),retrieved_at:new Date().toISOString(),engine:'Tavily Extract',status:200};
}
