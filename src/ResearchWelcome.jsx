import React from 'react';
import {ArrowUpRight, ArrowRight, FileText, Compass, BookOpen, Sparkles, Check} from 'lucide-react';
import {AGENTS} from './agents';

export function ResearchWelcome({onMeetTeam}) {
  return <section className="welcome-hero" aria-label="Your scholarship team">
    <div className="hero-copy">
      <span className="hero-eyebrow"><Sparkles size={13}/> SCHOLARX · YOUR SCHOLARSHIP TEAM</span>
      <h2>Your next chapter.<br/><em>Within reach.</em></h2>
      <p>Find the funding. Explore the possibilities.<br/>Five AI specialists, working on your future together.</p>
      <button className="hero-team-link" onClick={onMeetTeam}>Meet your team <ArrowUpRight size={16}/></button>
    </div>
    <div className="hero-orbit" aria-hidden="true">
      <svg viewBox="0 0 280 260"><defs><radialGradient id="orbit-glow"><stop stopColor="#b6f7bd" stopOpacity=".6"/><stop offset="1" stopColor="#b6f7bd" stopOpacity="0"/></radialGradient></defs><circle cx="140" cy="130" r="120" fill="url(#orbit-glow)"/><circle cx="140" cy="130" r="91"/><circle cx="140" cy="130" r="65"/><path d="M140 38V130L230 112M140 130L182 219M140 130L58 190M140 130L55 70"/></svg>
      <div className="orbit-core"><Sparkles size={30}/><span>Your future.<br/><strong>Our focus.</strong></span></div>
      {AGENTS.map(agent=><div className={`orbit-agent orbit-${agent.id}`} key={agent.id} style={{'--node-color':agent.color,'--node-background':agent.background}}><span>{agent.initial}</span><small>{agent.name}</small></div>)}
      <span className="orbit-caption"><i/>FIVE SPECIALISTS · ONE TEAM</span>
    </div>
  </section>;
}

export function WorkspaceProgress({profile,opportunities,draftReady,onProfile,onMatches,onDraft}) {
  const hasProfile=!!(profile.degree&&profile.target_degree&&profile.countries);
  const steps=[
    {Icon:FileText,label:'Your story',detail:hasProfile?'Profile shared':'Start with your profile',done:hasProfile,action:onProfile},
    {Icon:Compass,label:'Your possibilities',detail:opportunities?`${opportunities} opportunities researched`:'Explore programs & funding',done:opportunities>0,action:onMatches},
    {Icon:BookOpen,label:'Your next step',detail:draftReady?'Application draft prepared':'A draft made for you',done:!!draftReady,action:onDraft},
  ];
  return <nav className="workspace-progress" aria-label="Your scholarship journey">{steps.map(({Icon,label,detail,done,action},index)=><React.Fragment key={label}>{index>0&&<ArrowRight className="journey-arrow" size={13}/>}<button onClick={action} className={done?'journey-step done':'journey-step'} aria-label={`${label}: ${detail}`}><span className="journey-step-icon">{done?<Check size={15}/>:<Icon size={15}/>}</span><span><strong>{label}</strong><small>{detail}</small></span><span className="journey-step-number">0{index+1}</span></button></React.Fragment>)}</nav>;
}
