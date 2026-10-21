import test from 'node:test';
import assert from 'node:assert/strict';
import {completion,structured,clearBudgetBackoffs,quotaType} from '../server/groq.js';
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
