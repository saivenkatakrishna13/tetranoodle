export function injectFailure(session,kind,emit,agent){
 const mode=kind==='search'?'searchOnce':'sourceOnce';
 if(!session.demoFailures?.[mode])return;
 session.demoFailures[mode]=false;if(kind==='source')session.sourceRecoveryPending=true;
 emit({type:'activity',agent,state:'failure',demo:true,failureKind:kind,label:`DEMO: injected ${kind} failure. Real recovery will run next.`});
 throw Error(`DEMO injected ${kind} failure`);
}
