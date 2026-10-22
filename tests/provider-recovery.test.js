import test from 'node:test';
import assert from 'node:assert/strict';
import {completion,structured,clearBudgetBackoffs,quotaType} from '../server/groq.js';
test('provider allowance scheduling cancels before another network request without claiming quota exhaustion',async()=>{
 clearBudgetBackoffs();const original=globalThis.fetch,events=[];let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:'OK'}}]}),{headers:{'x-ratelimit-limit-tokens':'8000','x-ratelimit-remaining-tokens':'0'}});};
  const options={agent:'budget-test',modelOverride:'test-budget-model',maxTokens:100};
  await completion([{role:'user',content:'First'}],options);
  const controller=new AbortController();
  await assert.rejects(completion([{role:'user',content:'Second'}],{...options,signal:controller.signal,emit:event=>{events.push(event);controller.abort();}}),{name:'AbortError'});
  assert.equal(calls,1);assert.ok(events.some(e=>e.waitReason==='Provider token allowance'));assert.ok(!events.some(e=>e.limitReached));
 }finally{globalThis.fetch=original;clearBudgetBackoffs();}
});
test('separate account keys can proceed while another account is waiting',async()=>{
 const original=globalThis.fetch,first=process.env.GROQ_API_KEY_QUEUE_A,second=process.env.GROQ_API_KEY_QUEUE_B;
 process.env.GROQ_API_KEY_QUEUE_A='test-account-a';process.env.GROQ_API_KEY_QUEUE_B='test-account-b';
 let release,markStarted;
 const blocked=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{markStarted=resolve;});
 let waiting;
 try{
  globalThis.fetch=async(_url,options)=>{
   if(options.headers.Authorization==='Bearer test-account-a'){markStarted();await blocked;}
   return new Response(JSON.stringify({choices:[{message:{content:'OK'}}]}));
  };
  waiting=completion([{role:'user',content:'First'}],{agent:'queue_a',modelOverride:'test-model'});
  await started;
  const independent=await completion([{role:'user',content:'Second'}],{agent:'queue_b',modelOverride:'test-model',signal:AbortSignal.timeout(1000)});
  assert.equal(independent.content,'OK');
 }finally{
  release();await waiting;globalThis.fetch=original;
  for(const [name,value] of [['GROQ_API_KEY_QUEUE_A',first],['GROQ_API_KEY_QUEUE_B',second]])if(value===undefined)delete process.env[name];else process.env[name]=value;
 }
});
test('shared account requests stay sequential and cancelled queued work never fetches',async()=>{
 const original=globalThis.fetch,previous=process.env.GROQ_API_KEY_QUEUE_SHARED;
 process.env.GROQ_API_KEY_QUEUE_SHARED='test-shared-account';
 let release,markStarted,calls=0;
 const blocked=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{markStarted=resolve;});
 const controller=new AbortController(),options={agent:'queue_shared',modelOverride:'test-model'};
 let first,second,cancelled;
 try{
  globalThis.fetch=async()=>{
   if(++calls===1){markStarted();await blocked;}
   return new Response(JSON.stringify({choices:[{message:{content:'OK'}}]}));
  };
  first=completion([{role:'user',content:'First'}],options);await started;
  cancelled=completion([{role:'user',content:'Cancelled'}],{...options,signal:controller.signal});
  second=completion([{role:'user',content:'Second'}],options);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
  controller.abort();await assert.rejects(cancelled,{name:'AbortError'});
  release();await Promise.all([first,second]);assert.equal(calls,2);
 }finally{
  release();await Promise.allSettled([first,second,cancelled]);globalThis.fetch=original;
  if(previous===undefined)delete process.env.GROQ_API_KEY_QUEUE_SHARED;else process.env.GROQ_API_KEY_QUEUE_SHARED=previous;
 }
});
test('daily model exhaustion switches models once and preserves the agent request',async()=>{
 clearBudgetBackoffs();
 const originalFetch=globalThis.fetch,previous=process.env.GROQ_DAILY_FALLBACK_MODEL,calls=[],events=[];
 process.env.GROQ_DAILY_FALLBACK_MODEL='qwen/qwen3.8-27b';
 try{
  globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);return calls.length===1?new Response(JSON.stringify({error:{message:'Rate limit reached: tokens per day (TPD)'}}),{status:429}):new Response(JSON.stringify({choices:[{message:{content:'{"ok":true}'}}]}),{status:200});};
  const result=await completion([{role:'user',content:'Check the supplied source.'}],{agent:'mira',modelOverride:'openai/gpt-oss-120b',json:true,maxTokens:100,emit:e=>events.push(e)});
  assert.equal(calls.length,2);assert.equal(calls[1].model,'qwen/qwen3.8-27b');assert.deepEqual(calls[0].messages,calls[1].messages);assert.equal(result.content,'{"ok":true}');assert.ok(events.some(e=>e.label.includes('daily allowance')));
  const notice=events.find(e=>e.limitReached);assert.equal(notice.agent,'mira');assert.equal(notice.limitType,'tokens per day');assert.equal(notice.keySetting,'GROQ_API_KEY_MIRA');assert.equal(notice.model,'openai/gpt-oss-120b');assert.ok(!JSON.stringify(notice).includes('Bearer'));
  clearBudgetBackoffs();calls.length=0;globalThis.fetch=async()=>{calls.push(true);return new Response(JSON.stringify({error:{message:'tokens per day (TPD) exhausted'}}),{status:429});};
  await assert.rejects(completion([{role:'user',content:'Check source.'}],{agent:'mira',modelOverride:'openai/gpt-oss-120b',maxTokens:100}),/daily allowance is exhausted/);assert.equal(calls.length,2);
 }finally{clearBudgetBackoffs();globalThis.fetch=originalFetch;if(previous===undefined)delete process.env.GROQ_DAILY_FALLBACK_MODEL;else process.env.GROQ_DAILY_FALLBACK_MODEL=previous;}
});
test('quota warnings distinguish request size, minute and daily limits without guessing unknown types',()=>{
 assert.equal(quotaType('tokens per minute (TPM) reached'),'tokens per minute');assert.equal(quotaType('requests per day (RPD) exhausted'),'requests per day');assert.equal(quotaType('Request too large for tokens per minute'),'request size');assert.equal(quotaType('Too many requests'),'rate limit (type not specified)');
});
test('a rejected JSON generation is repaired instead of terminating the research job',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>++calls===1?new Response(JSON.stringify({error:{code:'json_validate_failed',message:'Failed to generate JSON',failed_generation:'{"ok":tru}'}}),{status:400}):new Response(JSON.stringify({choices:[{message:{content:'{"ok":true}'}}]}),{status:200});
  assert.deepEqual(await structured('mira','Return {ok:boolean}.',{}, {maxTokens:100,validate:d=>d.ok===true}),{ok:true});assert.equal(calls,2);
 }finally{globalThis.fetch=original;}
});
test('similar requests skip a primary model whose daily allowance just failed',async()=>{
 clearBudgetBackoffs();const original=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(_url,options)=>{const b=JSON.parse(options.body);calls.push(b.model);return b.model==='openai/gpt-oss-120b'?new Response(JSON.stringify({error:{message:'tokens per day (TPD) exhausted'}}),{status:429}):new Response(JSON.stringify({choices:[{message:{content:'OK'}}]}),{status:200});};
  const options={agent:'cache-test',modelOverride:'openai/gpt-oss-120b',maxTokens:100};
  await completion([{role:'user',content:'Review supplied facts.'}],options);
  await completion([{role:'user',content:'Review supplied facts.'}],options);
  assert.deepEqual(calls,['openai/gpt-oss-120b','qwen/qwen3.8-27b','qwen/qwen3.8-27b']);
 }finally{globalThis.fetch=original;clearBudgetBackoffs();}
});
