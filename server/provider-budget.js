// Provider budgets stay in memory and are scoped to the same account/model as
// the request queue. No credentials or student text are exposed in activity.
const budgets=new Map();
export const clearTokenBudgets=()=>budgets.clear();
export function rememberTokenBudget(key,headers,now=Date.now()){
 const limit=Number(headers.get('x-ratelimit-limit-tokens'));
 const remaining=headers.get('x-ratelimit-remaining-tokens');
 if(limit>0&&remaining!==null&&Number.isFinite(Number(remaining)))budgets.set(key,{limit,remaining:Math.max(0,Number(remaining)),at:now});
}
export function tokenWait(key,estimatedTokens,now=Date.now()){
 const budget=budgets.get(key);
 if(!budget||estimatedTokens>budget.limit)return null;
 const available=Math.min(budget.limit,budget.remaining+Math.max(0,now-budget.at)*budget.limit/60000);
 const milliseconds=Math.ceil(Math.max(0,estimatedTokens-available)*60000/budget.limit);
 return milliseconds>100?{milliseconds:milliseconds+100,limit:budget.limit}:null;
}
export function estimateRequestTokens(messages,maxTokens,tools){
 return Math.ceil((JSON.stringify(messages).length+(tools?.length?JSON.stringify(tools).length:0))/4)+maxTokens;
}
