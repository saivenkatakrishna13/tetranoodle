import React from 'react';
import {ArrowUpRight, ArrowRight, FileText, Compass, BookOpen, Sparkles, Check} from 'lucide-react';
import AgentConstellation from './AgentConstellation';
import {missingStudyEssentials} from '../shared/profile-readiness';

export function ResearchWelcome({onMeetTeam,activeAgent,waiting}) {
  return <section className="welcome-hero" aria-label="Your scholarship team">
    <div className="hero-copy">
      <span className="hero-eyebrow"><Sparkles size={13}/> SCHOLARX · YOUR SCHOLARSHIP TEAM</span>
      <h2>Your next chapter.<br/><em>Beyond the expected.</em></h2>
      <p>Discover global opportunities through an AI research team built around your potential.</p>
      <button className="hero-team-link" onClick={onMeetTeam}>Meet your team <ArrowUpRight size={16}/></button>
    </div>
    <AgentConstellation activeAgent={activeAgent} waiting={waiting}/>
  </section>;
}

export function WorkspaceProgress({profile,opportunities,draftReady,run,onProfile,onMatches,onDraft}) {
  const hasProfile=missingStudyEssentials(profile).length===0;
  const partial=!!run&&run.status!=='completed'&&run.status!=='running';
  const steps=[
    {Icon:FileText,label:'Your story',detail:hasProfile?'Profile shared':'Start with your profile',done:hasProfile,action:onProfile},
    {Icon:Compass,label:'Your possibilities',detail:partial?`${run.coverage?.ready||0}/5 matches fully verified`:opportunities?`${opportunities} opportunities researched`:'Explore programs & funding',done:opportunities>0&&(!run||run.status==='completed'),action:onMatches},
    {Icon:BookOpen,label:'Your next step',detail:draftReady?(partial?'Draft saved · evidence incomplete':'Application draft prepared'):'A draft made for you',done:!!draftReady&&(!run||run.status==='completed'),action:onDraft},
  ];
  return <nav className="workspace-progress" aria-label="Your scholarship journey">{steps.map(({Icon,label,detail,done,action},index)=><React.Fragment key={label}>{index>0&&<ArrowRight className="journey-arrow" size={13}/>}<button onClick={action} className={done?'journey-step done':'journey-step'} aria-label={`${label}: ${detail}`}><span className="journey-step-icon">{done?<Check size={15}/>:<Icon size={15}/>}</span><span><strong>{label}</strong><small>{detail}</small></span><span className="journey-step-number">0{index+1}</span></button></React.Fragment>)}</nav>;
}
