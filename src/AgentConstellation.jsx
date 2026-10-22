import React,{useId,useEffect,useState} from 'react';
import {AGENTS} from './agents';

const positions=[[16,29],[54,15],[84,40],[67,79],[23,76]];
export default function AgentConstellation({activeAgent=null,waiting=false,failureAt=0,recoveryAt=0,ambient=false}){
 const[,redraw]=useState(0);useEffect(()=>{const timer=setTimeout(()=>redraw(n=>n+1),2700);return()=>clearTimeout(timer);},[failureAt,recoveryAt]);
 const health=failureAt&&Date.now()-failureAt<2600?'failure':recoveryAt&&Date.now()-recoveryAt<2600?'recovered':'idle';
 const id=useId().replace(/:/g,'');
 const active=AGENTS.find(agent=>agent.id===activeAgent);
 return <section className="agent-constellation" aria-label="Your five-agent research team" data-ambient={ambient?'true':'false'} data-health={health} data-active-agent={active?.id||'none'} data-waiting={waiting?'true':'false'}>
  <div className="constellation-topline"><span>THE RESEARCH COLLECTIVE</span><span>01 — 05</span></div>
  <div className="constellation-map">
   <svg viewBox="0 0 400 260" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={id}><stop stopColor="#C6A66B" stopOpacity=".1"/><stop offset=".5" stopColor="#C6A66B" stopOpacity=".65"/><stop offset="1" stopColor="#C6A66B" stopOpacity=".1"/></linearGradient></defs><path className="constellation-thread" stroke={`url(#${id})`} d="M64 75Q120 8 216 39T336 104Q347 175 268 205T92 198Q28 151 64 75M64 75L268 205M216 39L92 198M336 104L92 198"/><path className="constellation-highlight" d="M64 75Q120 8 216 39T336 104Q347 175 268 205T92 198"/></svg>
   {AGENTS.map((agent,index)=><div key={agent.id} className={`constellation-node ${active?.id===agent.id?'is-working':''}`} style={{left:`${positions[index][0]}%`,top:`${positions[index][1]}%`,'--float-delay':`${-index*1.3}s`}}><span>{agent.initial}<i/></span><strong>{agent.name}</strong><small>{agent.role}</small></div>)}
   <span className="constellation-coordinate">SX / INTELLIGENCE IN COLLABORATION</span>
  </div>
  <div className="constellation-caption"><span className={active?'is-live':''}/>{active?`${active.name} · ${waiting?'waiting for provider allowance':'working on your research'}`:'Five specialists. One shared direction.'}<span>ScholarX</span></div>
 </section>;
}
