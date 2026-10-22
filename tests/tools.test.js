import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyOpportunities, worker, executeTool } from '../server/tools.js';
import { extractDocx } from '../server/documents.js';
import { zipSync, strToU8 } from 'fflate';
const url = 'https://example.edu/funding';
const evidence = new Map([[url, { url, text: 'The award covers full tuition for two years. Applications close on 15 January 2027. Applicants must hold a bachelor degree in Computer Science.', retrieved_at: '2026-10-19' }]]);
test('pipeline tool guards stay scoped to the background job and preserve explicit chat document access',async()=>{
 const session={documents:[],run:{pipeline:{active:true,phase:'eligibility',toolCalls:0,maxToolCalls:10,deadlineAt:Date.now()+1000}}};
 await executeTool('read_documents',{},session,()=>{},'arjun',new AbortController().signal);
 assert.equal(session.run.pipeline.toolCalls,0);
 const emit=()=>{};emit.runSession=session;
 await assert.rejects(executeTool('read_documents',{},session,emit,'arjun',new AbortController().signal),/cannot work during eligibility/);
});
test('independent search failure falls back to real browser-search receipts without retrying the same failed service',async()=>{
 const keys=['SEARCH_PROVIDER','GROQ_API_KEY_NOVA','TAVILY_API_KEY'],previous=keys.map(k=>process.env[k]);
 process.env.SEARCH_PROVIDER='ddgs';process.env.GROQ_API_KEY_NOVA='test-search-account';delete process.env.TAVILY_API_KEY;
 let reads=0,generations=0;const events=[];
 const dependencies={searchWorker:async()=>{reads++;throw new Error('Search unavailable');},searchCompletion:async()=>{generations++;return {content:'Search complete',executed_tools:[{search_results:[{url:'https://example.edu/program',title:'Official programme'}]}]};}};
 try{
  const result=await executeTool('search_web',{query:'Computing master funding'},{},e=>events.push(e),'nova',new AbortController().signal,dependencies);
  assert.equal(reads,1);assert.equal(generations,1);assert.equal(result.results[0].url,'https://example.edu/program');assert.match(result.provider,/Groq/);
  dependencies.searchCompletion=async()=>{throw new Error('Other service unavailable');};
  await assert.rejects(executeTool('search_web',{query:'Computing master funding'},{},()=>{},'nova',new AbortController().signal,dependencies),/temporarily unavailable/);assert.equal(reads,2);
 }finally{keys.forEach((key,i)=>{if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i];});}
});
test('unretrieved scholarship URLs cannot enter the shortlist', () => {
  assert.throws(() => verifyOpportunities([{ name: 'Made up', url: 'https://unread.example' }], evidence), /not retrieved/);
});
test('unsupported funding and deadlines are replaced with explicit unknowns', () => {
  const [result] = verifyOpportunities([{ name: 'MSc', url, funding: 'Everything covered', funding_quote: 'A quote that does not appear in the source page.', deadline: 'Tomorrow', deadline_quote: 'Tomorrow is the deadline for every applicant.' }], evidence);
  assert.match(result.funding, /not confirmed/); assert.match(result.deadline, /not confirmed/); assert.equal(result.quotes.funding, null);
});
test('genuine source excerpts retain funding, deadlines, and source timestamps', () => {
  const [result] = verifyOpportunities([{ name: 'MSc', url, funding: 'Full tuition for two years', funding_quote: 'The award covers full tuition for two years.', deadline: '15 January 2027', deadline_quote: 'Applications close on 15 January 2027.' }], evidence);
  assert.equal(result.funding, 'Full tuition for two years'); assert.equal(result.deadline, '15 January 2027'); assert.equal(result.retrieved_at, '2026-10-19');
});
test('Word extraction preserves paragraph boundaries and XML-escaped student names', () => {
  const docx = zipSync({ 'word/document.xml': strToU8('<w:document><w:body><w:p><w:r><w:t>Rahul &amp; projects</w:t></w:r></w:p><w:p><w:r><w:t>CGPA 8.2 / 10</w:t></w:r></w:p></w:body></w:document>') });
  assert.equal(extractDocx(docx).trim(), 'Rahul & projects\nCGPA 8.2 / 10');
});
test('Scrapling blocks private-network sources before fetching', async () => {
  for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'file:///etc/passwd', 'http://169.254.169.254/latest/meta-data/']) await assert.rejects(worker('read_page', { url }, new AbortController().signal), /Private|public|local/);
});
