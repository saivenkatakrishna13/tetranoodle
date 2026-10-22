import {researchBudgetMs,withinBudget,draftBudgetMs} from './research-delivery.js';
import {researchCoverage} from './research-quality.js';
import {discoveryResults,shortlistLeads} from '../shared/discovery-results.js';
export const phases=['profile','discovery','eligibility','rank','draft','summary'];
const owners=['arjun','nova','sage','mira','leo','mira'];
const stages=['profile','discover','verify','rank','draft','done'];
const progress=[5,15,30,82,90,95];
// Leave tool calls for ranking and one fact-checked draft after source work.
export const laterPhaseReserve=p=>{const configured=Number(process.env.RESEARCH_RESERVE_CALLS);return Math.min(Number.isFinite(configured)?Math.max(0,configured):14,Math.floor((p?.maxToolCalls||0)*.15));};
export class RunBudgetError extends Error{constructor(message,code='RUN_BUDGET'){super(message);this.name='RunBudgetError';this.code=code;}}
export function pipelineState(session){
 if(session.run.pipeline){
  const p=session.run.pipeline;if(p.cursor>=6&&p.summaryPosted)p.finished=true;
  if(p.active&&session.run.status==='interrupted'){
   // An interrupted process cannot prove when it stopped. Conservatively count
   // wall time since its last active pass; a restart never grants a fresh budget.
   const now=Date.now();if(p.activeSince)p.elapsedMs=Math.min(p.maxTimeMs,p.elapsedMs+Math.max(0,now-p.activeSince));
   for(const receipt of Object.values(p.checks||{}))if(receipt.activeSince){receipt.spentMs=Math.min(45000,(receipt.spentMs||0)+Math.max(0,now-receipt.activeSince));delete receipt.activeSince;}
   p.active=false;delete p.activeSince;delete p.currentCandidate;delete p.candidateDeadlineAt;
  }
  return p;
 }
 const p=session.run.pipeline={version:1,cursor:0,phase:'profile',done:{},started:{},finishedAgents:{},milestones:{},checks:{},repairUsed:false,toolCalls:0,maxToolCalls:Math.max(1,Number(process.env.RESEARCH_MAX_TOOL_CALLS)||100),maxTimeMs:researchBudgetMs(),elapsedMs:0,finished:false,active:false};
 // Adopt saved work instead of re-running completed legacy stages.
 if(session.run.profileReviewed){p.done.profile=true;p.cursor=1;}
 if(session.run.topFiveIds?.length||session.run.completedAt){p.done.profile=p.done.discovery=p.done.eligibility=p.done.rank=true;p.cursor=4;}
 if(session.draft&&p.cursor===4){p.done.draft=true;p.cursor=5;}
 if(session.run.completedAt&&session.draft){p.done.summary=true;p.cursor=6;p.finished=true;p.phase='summary';}
 return p;
}
export function consumeRunTool(session,agent,name){
 const p=session?.run?.pipeline;if(!p?.active)return;
 if(p.finished)throw new RunBudgetError('This research run has finished.','RUN_FINISHED');
 const allowed=p.phase==='profile'?agent==='arjun':p.phase==='discovery'?agent==='nova':p.phase==='eligibility'?agent==='sage'||agent==='nova'&&p.repairActive:p.phase==='rank'||p.phase==='summary'?agent==='mira':p.phase==='draft'&&agent==='leo';
 if(!allowed)throw new RunBudgetError(`${agent} cannot work during ${p.phase}.`,'AGENT_SCOPE');
 const tools={arjun:['model_completion','read_documents','read_page','github_profile'],nova:['model_completion','search_web'],sage:['model_completion','search_web','read_page'],mira:['model_completion'],leo:['model_completion']};
 if(!tools[agent]?.includes(name))throw new RunBudgetError(`${agent} is not allowed to use ${name}.`,'AGENT_SCOPE');
 const sourcePhase=p.phase==='discovery'||p.phase==='eligibility';
 if(p.toolCalls>=p.maxToolCalls-(sourcePhase?laterPhaseReserve(p):0))throw new RunBudgetError('The run reached its tool-call budget.');
 if(Date.now()>=p.deadlineAt)throw new RunBudgetError('The run reached its time budget.');
 if(agent==='sage'&&p.candidateDeadlineAt&&Date.now()>=p.candidateDeadlineAt)throw new RunBudgetError('The candidate reached its 45-second limit.','CANDIDATE_BUDGET');
 p.toolCalls++;p.toolLog||=[];p.toolLog.push({agent,name,phase:p.phase,time:Date.now(),repair:!!p.repairActive});
}
export async function orderedPipeline(session,emit,parentSignal,deps,{finish=false,candidateMs=45000}={}){
 const p=pipelineState(session);if(p.finished)return;
 const startedAt=Date.now(),remaining=Math.max(0,p.maxTimeMs-p.elapsedMs);
 const finalReserve=Math.min(1000,remaining*.1),draftReserve=Math.min(draftBudgetMs(),remaining*.12);
 p.active=true;p.activeSince=startedAt;p.deadlineAt=Date.now()+Math.max(0,remaining-finalReserve);
 const work=new AbortController();const stop=()=>work.abort(parentSignal.reason);parentSignal.addEventListener('abort',stop,{once:true});
 if(parentSignal.aborted)stop();
 const timer=setTimeout(()=>work.abort(new RunBudgetError('The run reached its time budget.')),Math.max(0,remaining-finalReserve));
 const checkpoint=()=>deps.save();
 const lifecycle=(agent,state,detail={})=>{const seen=state==='started'?p.started:p.finishedAgents;if(seen[agent])return;seen[agent]=true;emit({type:'agent_lifecycle',agent,state,phase:p.phase,runId:session.run.id,...detail});};
 const enter=index=>{if(index<p.cursor)throw Error('The pipeline cannot move backwards.');p.cursor=index;p.phase=phases[index];session.run.stage=stages[index];session.run.progress=Math.max(session.run.progress||0,progress[index]);lifecycle(owners[index],'started');emit({type:'typing',agent:owners[index]});emit({type:'run',run:session.run});checkpoint();};
 const done=(index,detail={})=>{const phase=phases[index];if(p.done[phase])return;p.done[phase]=true;if(!p.milestones[phase]){p.milestones[phase]=true;emit({type:'pipeline',agent:owners[index],phase,state:'done',runId:session.run.id,...detail});}if(index!==3)lifecycle(owners[index],'finished',detail);p.cursor=index+1;checkpoint();};
 const sourceTimeLeft=()=>p.deadlineAt-Date.now()-draftReserve;
 const sourceCallLimit=()=>p.maxToolCalls-laterPhaseReserve(p);
 const budgetAvailable=()=>!work.signal.aborted&&p.toolCalls<sourceCallLimit()&&sourceTimeLeft()>0;
 const skipSources=(reason)=>{p.stopReason=reason;session.run.foundCount=(session.run.candidates||[]).length;for(let i=p.cursor;i<3;i++){enter(i);done(i,{outcome:'partial',reason});}};
 try{
  parentSignal.throwIfAborted();
  if(finish)skipSources('The user requested saved partial results.');
  if(p.cursor===0){
   enter(0);
   if(!session.run.profileReviewed){await withinBudget(signal=>deps.profile(signal),Math.max(1,sourceTimeLeft()),work.signal);session.run.profileReviewed=true;checkpoint();}
   if(await deps.needsInput()){session.run.status='needs_input';return;}
   done(0,{outcome:'produced'});
  }
  // A checkpoint may already contain Arjun's profile while essentials are still
  // missing. The intake gate applies before discovery even on that checkpoint.
  if(p.cursor<=1&&await deps.needsInput()){session.run.status='needs_input';return;}
  if(p.cursor===1){
   enter(1);
   if(budgetAvailable())await withinBudget(signal=>deps.discover(10,false,signal),Math.max(1,sourceTimeLeft()),work.signal);
   session.run.foundCount=(session.run.candidates||[]).length;
   done(1,{count:session.run.foundCount,outcome:session.run.foundCount>=10?'complete':'partial'});
  }
  if(p.cursor===2){
   enter(2);
   const check=async(candidate,mode='initial')=>{
    const key=candidate.url,receipt=p.checks[key]||={state:'pending',fieldAttempts:{},spentMs:0};
    if(mode==='initial'?receipt.checked:receipt[mode+'Done']||!receipt.basicDone)return;
    const remainingCandidate=Math.min(candidateMs,45000)-(receipt.spentMs||0);
    const available=deps.progressiveChecks?Math.min(remainingCandidate,mode==='initial'?20000:mode==='audit'?15000:45000):remainingCandidate;
    if(available<=0){receipt.checked=true;receipt.state='partial';receipt.reason='Candidate time limit reached.';checkpoint();return;}
    const began=Date.now();receipt.activeSince=began;p.currentCandidate=key;p.candidateDeadlineAt=began+Math.min(available,Math.max(1,sourceTimeLeft()));checkpoint();
    try{const result=await withinBudget(signal=>deps.check(candidate,receipt,signal,deps.progressiveChecks?mode:'full'),Math.min(available,Math.max(1,sourceTimeLeft())),work.signal);receipt.state=result?.state||'partial';receipt.reason=result?.reason||null;receipt.checked=true;receipt[mode+'Done']=true;}
    catch(error){
     if(parentSignal.aborted)throw error;
     if(error.code==='RUN_BUDGET'||work.signal.aborted)throw error;
     receipt.checked=true;receipt[mode+'Done']=true;receipt.state=/HTTP (?:404|410)|ENOTFOUND|NXDOMAIN/i.test(error.message)?'dead':'partial';receipt.reason=error.name==='TimeoutError'?'Candidate time limit reached (45 seconds).':error.message;
    }finally{receipt.spentMs=(receipt.spentMs||0)+Date.now()-began;delete receipt.activeSince;delete p.currentCandidate;delete p.candidateDeadlineAt;emit({type:'run',run:session.run});checkpoint();}
   };
   for(const candidate of session.run.candidates||[]){if(!budgetAvailable())break;await check(candidate);}
   // Give every discovered source an initial check before spending time on the critic or gap retries.
   if(deps.progressiveChecks){
    const priority=deps.auditPriority?.()||[],candidates=[...(session.run.candidates||[])];
    const position=c=>{const index=priority.indexOf(p.checks[c.url]?.officialUrl||c.url);return index<0?Infinity:index;};
    candidates.sort((a,b)=>position(a)-position(b));
    for(const candidate of candidates){if(!budgetAvailable()||deps.auditedEnough?.())break;await check(candidate,'audit');}
   }
   const checked=Object.values(p.checks).filter(r=>r.checked),invalid=checked.filter(r=>['dead','ineligible'].includes(r.state));
   const valid=checked.length-invalid.length;
   if(invalid.length&&valid<10&&!p.repairUsed&&budgetAvailable()){
    p.repairUsed=true;p.repairActive=true;const shortfall=Math.min(10-valid,invalid.length);checkpoint();
    emit({type:'typing',agent:'nova'});
    emit({type:'activity',agent:'nova',label:`Sage confirmed ${invalid.length} dead or clearly ineligible candidate(s). Finding only the shortfall: ${shortfall}.`});
    try{const extras=await withinBudget(signal=>deps.discover(shortfall,true,signal),Math.max(1,sourceTimeLeft()),work.signal);session.run.foundCount=session.run.candidates.length;p.repairActive=false;emit({type:'typing',agent:'sage'});for(const c of extras){if(!budgetAvailable())break;await check(c);if(deps.progressiveChecks&&budgetAvailable())await check(c,'audit');}}finally{p.repairActive=false;checkpoint();}
   }
   if(deps.progressiveChecks&&budgetAvailable()){
    const priority=new Set(deps.priority?.()||[]);
    for(const candidate of session.run.candidates||[]){if(!budgetAvailable())break;const receipt=p.checks[candidate.url];if(priority.has(receipt?.officialUrl||candidate.url))await check(candidate,'details');}
   }
   if(!budgetAvailable())p.stopReason=p.toolCalls>=sourceCallLimit()?'Tool-call budget reached.':'Source-work time budget reached; reserved time is used for the draft and summary.';
   done(2,{checked:Object.values(p.checks).filter(r=>r.checked).length,candidates:session.run.candidates?.length||0,outcome:budgetAvailable()?'checked':'partial'});
  }
 }catch(error){
  if(parentSignal.aborted){session.run.status='paused';session.run.message='Paused. Resume research manually to continue the saved stage.';return;}
  skipSources(error.message);
 }finally{
  if(parentSignal.aborted||session.run.status==='needs_input'){clearTimeout(timer);parentSignal.removeEventListener('abort',stop);p.active=false;delete p.activeSince;p.elapsedMs+=Date.now()-startedAt;checkpoint();}
 }
 if(parentSignal.aborted||session.run.status==='needs_input')return;
 try{
  if(p.cursor===3){
   enter(3);let outcome='ranked';
   try{await withinBudget(()=>deps.rank(),Math.max(1,p.deadlineAt-Date.now()),work.signal);}
   catch(error){if(parentSignal.aborted)throw error;p.stopReason=error.message;outcome='partial';}
   done(3,{count:session.opportunities.filter(o=>o.recommended).length,outcome});
  }
  if(p.cursor===4){
   enter(4);
   if(!session.draft){
    const room=Math.max(0,p.deadlineAt-Date.now());
    let scaffoldAttempted=false;
    const scaffold=()=>{scaffoldAttempted=true;return withinBudget(()=>deps.draft(null,1),Math.max(1,p.maxTimeMs-p.elapsedMs-(Date.now()-startedAt)),parentSignal);};
    try{
     if(room>500&&!work.signal.aborted)await withinBudget(signal=>deps.draft(signal,Math.min(draftBudgetMs(),room)),Math.min(draftBudgetMs(),room),work.signal);
     else await scaffold();
    }catch(error){
     if(parentSignal.aborted)throw error;p.stopReason=error.message;
     if(!session.draft&&!scaffoldAttempted)try{await scaffold();}catch(fallbackError){p.stopReason+=` Draft unavailable: ${fallbackError.message}`;}
    }
   }
   done(4,{saved:!!session.draft,method:session.draftMeta?.method||null});
  }
  if(p.cursor===5){
   enter(5);const coverage=researchCoverage(session.opportunities,!!session.draft&&session.draftMeta?.method!=='profile-template');
   session.run.coverage=coverage;session.run.status=coverage.complete?'completed':'partial';session.run.completedAt=Date.now();session.run.finalizing=false;
   const partial=Math.max(0,coverage.recommended-coverage.ready);
   const recommended=session.opportunities.filter(o=>o.recommended);
   const sourceLeads=shortlistLeads(discoveryResults(session.opportunities,session.run),recommended).length;
   const found=session.run.candidates?.length||(session.run.foundCount??session.opportunities.length);
   if(!p.summaryPosted){
    p.summaryPosted=true;
    emit({type:'message',message:{agent:'mira',status:true,content:`**${coverage.complete?'Complete':`Partial (${coverage.ready} verified, ${partial} partial)`}**\n\n${found} source leads found (10 required) · ${Object.values(p.checks).filter(r=>r.checked).length} checked · ${coverage.reviewed} independently reviewed · ${coverage.recommended}/5 recommendations${sourceLeads?` · ${sourceLeads} additional source lead${sourceLeads===1?'':'s'} visible in Matches`:''} · ${session.draft?'One draft saved':'Draft Missing: no reviewed match available'}.\n\n${p.stopReason?`Stopped within the run budget: ${p.stopReason}\n\n`:''}${coverage.items.filter(o=>!o.complete).map(o=>`- **${o.name}**: ${o.missing.join('; ')}.`).join('\n')}\n\nReview student eligibility gaps and check the official sources before applying. Draft only; nothing has been submitted.`}});
   }
   done(5,{outcome:session.run.status,verified:coverage.ready,partial});
   p.finished=true;session.run.stage='done';session.run.progress=coverage.complete?100:95;session.run.message=coverage.complete?'Your research pack is ready.':'Partial findings saved. This run has finished.';
  }
 }catch(error){
  if(!parentSignal.aborted)throw error;
  session.run.status='paused';session.run.message='Paused. Resume research manually to continue the saved stage.';
 }finally{clearTimeout(timer);parentSignal.removeEventListener('abort',stop);p.active=false;delete p.activeSince;p.elapsedMs+=Date.now()-startedAt;emit({type:'typing',agent:null});emit({type:'run',run:session.run});checkpoint();}
}
