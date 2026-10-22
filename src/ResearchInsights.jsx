import React,{useState,useEffect,useSyncExternalStore} from 'react';
import {Modal} from './ui';
import {AGENTS} from './agents';
import AgentConstellation from './AgentConstellation';
import {subscribeAgentScene,getAgentSceneSnapshot} from './agentEvents';
import RunHistory from './RunHistory';
export default function ResearchInsights({sessionId,data={},onAction,onReopen,close,opportunities=[],active=true}){
 const [search,setSearch]=useState(false),[source,setSource]=useState(false),[audio,setAudio]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setSearch(!!data.demoFailures?.searchOnce);setSource(!!data.demoFailures?.sourceOnce);},[data.demoFailures]);
 useEffect(()=>{if(!active){window.speechSynthesis?.cancel();setAudio(false);}},[active]);
 const live=useSyncExternalStore(subscribeAgentScene,getAgentSceneSnapshot);
 useEffect(()=>()=>{if(audio)window.speechSynthesis?.cancel();},[audio]);
 function speak(){if(audio){window.speechSynthesis?.cancel();setAudio(false);return;}if(!window.speechSynthesis){setError('Audio summary is unavailable in this browser.');return;}const top=opportunities.filter(o=>o.recommended).slice(0,5);if(!top.length){setError('No recommendations are ready to summarise.');return;}const text='ScholarX research summary. These are conditional research matches, not admission guarantees. '+top.map(o=>`${o.name}, ${o.university}. Funding: ${o.funding||'Missing'}. Deadline: ${o.deadline||'Missing'}. Missing information: ${(o.missing_information||[]).join(', ')||'Check official requirements'}.`).join(' ');const speech=new SpeechSynthesisUtterance(text);speech.onend=()=>setAudio(false);speech.onerror=()=>{setAudio(false);setError('Audio could not play. The written matches remain available.');};setError('');setAudio(true);window.speechSynthesis.speak(speech);}
 async function arm(){try{await onAction('demo-failures',{searchOnce:search,sourceOnce:source});setError('');}catch(e){setError(e.message);}}
 return <Modal title="Research tools" subtitle="Live activity, profile completeness and saved runs." close={close} wide>
  <div className="research-insights">
   <section className="insight-section"><h3>Live agent graph</h3><AgentConstellation activeAgent={live.status==='running'?live.agent:null} failureAt={live.failureAt} recoveryAt={live.recoveryAt}/><p>Red indicates a failed tool call; green indicates successful recovery. The graph follows real events, including explicitly labelled demo failures.</p></section>
   <section className="insight-section"><h3>Profile completeness</h3><meter min="0" max="100" value={data.profileStrength?.score||0}/><strong>{data.profileStrength?.score||0}/100</strong><p>{data.profileStrength?.label||'Not an admission probability.'}</p><ul>{(data.profileStrength?.suggestions||[]).map(item=><li key={item.key}>{item.label}</li>)}</ul></section>
   <section className="insight-section"><h3>Agent usage</h3><p>Groq model requests and response time. Search-provider fees are not estimated.</p><div className="agent-meter-table">{AGENTS.map(agent=>{const m=data.metrics?.[agent.id];return <div key={agent.id}><strong>{agent.name}</strong><span>{m?.requests||0} requests · {((m?.latencyMs||0)/1000).toFixed(1)}s cumulative</span><small>{m?`${m.inputTokens} input / ${m.outputTokens} output tokens${m.unknownUsage?' · some usage Missing':''}`:'Token usage Missing until a request completes'}</small><small>{m&&!m.unknownCost?`Configured estimate: $${m.cost.toFixed(6)}`:'Cost Missing: no cited model price configured'}</small>{m?.pricingSources?.map(url=><a key={url} href={url} target="_blank" rel="noreferrer">Pricing source</a>)}</div>;})}</div></section>
   <section className="insight-section"><h3>Failure recovery demo</h3><p>Arms one failure in this student workspace’s next matching tool call. It does not manufacture research results.</p><label><input type="checkbox" checked={search} onChange={e=>setSearch(e.target.checked)}/>Fail next search provider once</label><label><input type="checkbox" checked={source} onChange={e=>setSource(e.target.checked)}/>Fail next official-page fetch once</label><button className="secondary-button" onClick={arm}>Apply demo failure controls</button><small>Currently armed: {data.demoFailures?.searchOnce?'search ':''}{data.demoFailures?.sourceOnce?'source':''}{!data.demoFailures?.searchOnce&&!data.demoFailures?.sourceOnce?'none':''}</small></section>
   <RunHistory sessionId={sessionId} runs={data.runHistory||[]} onReopen={onReopen}/>
   <section className="insight-section"><h3>Optional audio summary</h3><p>Uses this browser’s speech service. Voice availability and processing depend on your browser and operating system.</p><button className="secondary-button" onClick={speak}>{audio?'Stop audio summary':'Read matches aloud'}</button></section>
   {error&&<p role="alert">{error}</p>}
  </div>
 </Modal>;
}
