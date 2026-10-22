import React,{useEffect,useRef,useSyncExternalStore} from 'react';
import {ArrowDown,ArrowRight,ArrowUpRight,Check,Sun,Moon} from 'lucide-react';
import {AGENTS} from './agents';
import {getAgentSceneSnapshot,subscribeAgentScene} from './agentEvents';
import useThreeScene from './useThreeScene';
import './Landing.css';

const descriptions = {
  mira:'Plans the run, routes work between agents and recovers when a step fails.',
  arjun:'Reads your resume, marksheet and GitHub to build a profile grounded in your evidence.',
  nova:'Searches the web for real programs and scholarship opportunities that fit your ambitions.',
  sage:'Visits official pages, compares requirements and flags missing evidence.',
  leo:'Drafts a statement of purpose for a recommended match. Yours to review, never auto-submitted.',
};
const journey = [
  ['Your story','Share your documents and profiles. Arjun asks about the details still missing.'],
  ['Your possibilities','A researched shortlist with funding, deadlines, eligibility and official sources.'],
  ['Your next step','A draft application, ready for your edits. Save your findings and return at any time.'],
];

export default function Landing({appearanceControls,onLaunch,scrollPosition}) {
  const root=useRef(null),canvas=useRef(null),tags=useRef(null);
  const {dark,toggleAppearance}=appearanceControls;
  const sceneStatus=useThreeScene({root,canvas,tags,dark});
  const live=useSyncExternalStore(subscribeAgentScene,getAgentSceneSnapshot);
  useEffect(()=>{
    const element=root.current; element.scrollTop=scrollPosition.current;
    element.querySelector('h1')?.focus({preventScroll:true});
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    const timers=new Set();let played=false;
    const terminal=element.querySelector('.landing-terminal');
    const reveal=element.querySelectorAll('.landing-reveal');
    let observer;
    function showAll(){reveal.forEach(node=>node.classList.add('is-visible'));terminal.querySelectorAll('.landing-log-line').forEach(node=>node.classList.add('is-visible'));}
    if(!('IntersectionObserver' in window)||reduce.matches)showAll();
    else{
      observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        entry.target.classList.add('is-visible');observer.unobserve(entry.target);
        if(entry.target===terminal&&!played){
          played=true;
          terminal.querySelectorAll('.landing-log-line').forEach((node,i)=>{
            const timer=setTimeout(()=>{node.classList.add('is-visible');timers.delete(timer);},i*650);timers.add(timer);
          });
        }
      }),{root:element,threshold:.12});
      reveal.forEach((node,i)=>{node.style.setProperty('--reveal-delay',`${i%5*65}ms`);observer.observe(node);});observer.observe(terminal);
    }
    const changed=()=>{if(reduce.matches){timers.forEach(clearTimeout);timers.clear();observer?.disconnect();showAll();}};
    reduce.addEventListener('change',changed);
    return()=>{scrollPosition.current=element.scrollTop;observer?.disconnect();timers.forEach(clearTimeout);reduce.removeEventListener('change',changed);};
  },[scrollPosition]);
  const tilt=event=>{
    if(event.pointerType!=='mouse'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const node=event.currentTarget,box=node.getBoundingClientRect();
    node.style.setProperty('--tilt-x',`${-(event.clientY-box.top)/box.height*6+3}deg`);
    node.style.setProperty('--tilt-y',`${(event.clientX-box.left)/box.width*6-3}deg`);
  };
  const untilt=event=>{event.currentTarget.style.setProperty('--tilt-x','0deg');event.currentTarget.style.setProperty('--tilt-y','0deg');};
  const launchUrl=`/app${window.location.search}`;
  return <main ref={root} className="scholar-landing" data-theme={dark?'dark':'light'} data-scene={sceneStatus} aria-label="ScholarX introduction">
    <a className="landing-skip" href="#landing-launch">Skip to launch</a>
    <div className="landing-scene" aria-hidden="true">
      <div className="landing-scene-fallback"><span/><span/><span/></div>
      <canvas ref={canvas} className="landing-canvas"/>
      <div ref={tags} className="landing-tags"/>
    </div>
    <header className="landing-nav">
      <a className="landing-logo" href="/" aria-label="ScholarX Home">Scholar<i>X</i></a>
      <nav aria-label="Introduction navigation">
        <a className="landing-nav-story" href="#landing-agents">The team</a>
        <button className="landing-icon" aria-label={dark?'Switch to light mode':'Switch to dark mode'} onClick={toggleAppearance}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
        <a className="landing-btn landing-nav-launch" href={launchUrl} onClick={onLaunch}>Launch app <ArrowUpRight size={15}/></a>
      </nav>
    </header>

    <section className="landing-section landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <div className="landing-eyebrow"><span/> YOUR NEXT CHAPTER</div>
        <h1 id="landing-title" tabIndex={-1}>Scholarships,<br/><em>sourced.</em><br/>Not guessed.</h1>
        <p className="landing-lead">Upload your resume and marksheet. A swarm of AI agents researches real universities and scholarships, checks official sources, and drafts your application while you watch.</p>
        <div className="landing-actions"><a className="landing-btn" href={launchUrl} onClick={onLaunch}>Meet your team <ArrowRight size={17}/></a><a className="landing-text-link" href="#landing-agents">How it works <ArrowDown size={15}/></a></div>
        <div className="landing-trust"><span><Check size={12}/> Real opportunities</span><span><Check size={12}/> Official sources</span></div>
      </div>
      <div className="landing-scene-caption"><span className="landing-scene-dot"/>{live.status==='running'?'Your research team is working':live.status==='interrupted'?'Findings saved · research interrupted':'Five specialists. One shared direction.'}<small>{live.status==='running'?'Live workspace activity':'An illustration of your agent team'}</small></div>
      <a className="landing-scroll" href="#landing-agents">EXPLORE THE POSSIBILITIES <ArrowDown size={14}/></a>
    </section>

    <section id="landing-agents" className="landing-section landing-team" aria-labelledby="landing-team-title">
      <div className="landing-eyebrow landing-reveal">01 / YOUR TEAM</div>
      <h2 id="landing-team-title" className="landing-reveal">A swarm, <em>not a chatbot.</em></h2>
      <p className="landing-lead landing-reveal">Each agent has one job and passes its findings to the next. At the centre of it all is you.</p>
      <div className="landing-grid">{AGENTS.map((agent,i)=><article key={agent.id} className="landing-card landing-agent-card landing-reveal" onPointerMove={tilt} onPointerLeave={untilt}>
        <div className="landing-card-top"><span className="landing-avatar">{agent.initial}</span><span className="landing-index">0{i+1}</span></div>
        <h3>{agent.name}</h3><span className="landing-role">{agent.role}</span><p>{descriptions[agent.id]}</p>
      </article>)}</div>
    </section>

    <section className="landing-section landing-journey" aria-labelledby="landing-journey-title">
      <div className="landing-eyebrow landing-reveal">02 / THE JOURNEY</div>
      <h2 id="landing-journey-title" className="landing-reveal">From “where do I start?”<br/><em>to a shortlist.</em></h2>
      <div className="landing-steps">{journey.map(([title,copy],i)=><article key={title} className="landing-card landing-reveal" onPointerMove={tilt} onPointerLeave={untilt}><div className="landing-step-number">0{i+1}<ArrowUpRight size={18}/></div><h3>{title}</h3><p>{copy}</p></article>)}</div>
    </section>

    <section className="landing-section landing-recovery" aria-labelledby="landing-recovery-title">
      <div className="landing-recovery-copy"><div className="landing-eyebrow landing-reveal">03 / BUILT TO RECOVER</div><h2 id="landing-recovery-title" className="landing-reveal">A closed door.<br/><em>Another way forward.</em></h2><p className="landing-lead landing-reveal">When a source fails, the swarm looks for alternatives. Verified findings stay saved, evidence gaps stay visible, and you can resume where you left off.</p><span className="landing-example-note landing-reveal">Illustrative workflow · your results depend on your profile and available sources.</span></div>
      <div className="landing-terminal" role="region" aria-label="Example failure recovery workflow">
        <div className="landing-terminal-head"><span><i/><i/><i/></span><span>RECOVERY / EXAMPLE</span></div>
        <div className="landing-log-line"><b>[Mira]</b> Plan: profile → search → verify → draft</div>
        <div className="landing-log-line"><b>[Arjun]</b> Documents read · profile facts extracted</div>
        <div className="landing-log-line"><b>[Nova]</b> <span className="landing-error">Source unavailable</span> → trying an alternative</div>
        <div className="landing-log-line"><b>[Nova]</b> <span className="landing-success">Alternative sources collected</span></div>
        <div className="landing-log-line"><b>[Sage]</b> Requirements compared · missing evidence flagged</div>
        <div className="landing-log-line"><b>[Leo]</b> Draft saved · placeholders marked for review</div>
        <div className="landing-log-line"><b>[Mira]</b> <span className="landing-success">Findings saved. Ready to resume.</span></div>
        <span className="landing-terminal-cursor" aria-hidden="true">▍</span>
      </div>
    </section>

    <section id="landing-launch" className="landing-section landing-launch" aria-labelledby="landing-launch-title">
      <div className="landing-eyebrow landing-reveal">YOUR FUTURE IS STILL UNWRITTEN</div>
      <h2 id="landing-launch-title" className="landing-reveal">Find a future you didn’t<br/>know was <em>possible.</em></h2>
      <p className="landing-lead landing-reveal">Real opportunities. Official sources. Your agents are ready.</p>
      <div className="landing-reveal"><a className="landing-btn" href={launchUrl} onClick={onLaunch}>Start with ScholarX <ArrowUpRight size={17}/></a></div>
    </section>
    <footer className="landing-footer"><a className="landing-logo" href="/">Scholar<i>X</i></a><p>Check official sources before applying.<br/>Drafts only. No applications are submitted for you.</p><span>YOUR NEXT CHAPTER ↗</span></footer>
  </main>;
}
