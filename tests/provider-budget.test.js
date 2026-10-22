import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberTokenBudget,tokenWait,clearTokenBudgets,estimateRequestTokens} from '../server/provider-budget.js';
test('provider token headers schedule only the shortfall and replenish over time',()=>{
 clearTokenBudgets();rememberTokenBudget('account-a/model',new Headers({'x-ratelimit-limit-tokens':'8000','x-ratelimit-remaining-tokens':'1000'}),1000);
 assert.equal(tokenWait('account-a/model',3000,1000).milliseconds,15100);
 assert.equal(tokenWait('account-a/model',3000,16000),null);
 assert.equal(tokenWait('account-b/model',3000,1000),null);
 assert.equal(tokenWait('account-a/other-model',3000,1000),null);
 assert.equal(tokenWait('account-a/model',9000,1000),null,'an oversized request needs provider feedback, not an endless wait');
});
test('missing rate headers do not invent a provider allowance',()=>{
 clearTokenBudgets();rememberTokenBudget('unknown',new Headers(),1000);assert.equal(tokenWait('unknown',3000,1000),null);
 assert.ok(estimateRequestTokens([{role:'user',content:'Read source.'}],100)>100);
});
