import {executeTool} from '../server/tools.js';
import {writeFile} from 'node:fs/promises';
const checks=[],events=[],originalFetch=globalThis.fetch;
const run=()=>executeTool('github_profile',{username:'octocat'},{evidence:new Map()},event=>events.push(event),'arjun',new AbortController().signal);
try{
 const api=await run();checks.push({check:'live public GitHub lookup',provider:api.provider||'GitHub API',repositories:api.repositories.length,url:api.profile.url});
 // Inject only the API failure; Scrapling still fetches the real public page.
 globalThis.fetch=(url,options)=>String(url).startsWith('https://api.github.com/')?Promise.resolve(new Response('{}',{status:403})):originalFetch(url,options);
 const fallback=await run();checks.push({check:'API 403 recovery',injectedFailure:true,publicPageFetchedLive:true,provider:fallback.provider,characters:fallback.public_page?.text.length||0,url:fallback.profile.url});
 if(!fallback.public_page?.text.length)throw Error('GitHub fallback did not return real public-page text.');
}finally{globalThis.fetch=originalFetch;await writeFile('artifacts/github-tool-validation.json',JSON.stringify({checkedAt:new Date().toISOString(),purpose:'Integration checks only; octocat is not attributed to a fictional student',checks,events},null,2));}
console.log(checks);
