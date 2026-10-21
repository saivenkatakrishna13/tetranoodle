import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,Check,FileText,Loader2,ShieldCheck,Sparkles,Upload,X} from 'lucide-react';
import ScholarAtmosphere from './ScholarAtmosphere';
import {profileFields} from './profileFields';
import {AGENTS} from './agents';
import './profile-start.css';

const sections=[
 {title:'Your starting point',note:'The essentials for a relevant search.',keys:['name','degree','target_degree','countries']},
 {title:'Your academic picture',note:'Keep grades on their original scale. Leave unknown details blank.',keys:['cgpa','nationality','graduation','intake','language_scores','budget']},
 {title:'The person beyond the grades',note:'Optional context for a more personal recommendation and draft.',keys:['github','public_profiles','interests','career_goals']},
];
const essentials=['degree','target_degree','countries'];
export default function ProfileStart({profile={},documents=[],dark,onSubmit,onChat,onStudents,sessionId}){
 const[values,setValues]=useState(()=>{try{return {...profile,...JSON.parse(sessionStorage.getItem(`scholarx.profile-draft.${sessionId}`)||'{}')};}catch{return profile;}});
 const[files,setFiles]=useState([]),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const submitting=useRef(false),input=useRef(null),filled=essentials.filter(key=>values[key]?.trim()).length;
 useEffect(()=>{setValues(current=>({...profile,...current}));},[profile]);
 useEffect(()=>{const timer=setTimeout(()=>{try{sessionStorage.setItem(`scholarx.profile-draft.${sessionId}`,JSON.stringify(values));}catch{}},250);return()=>clearTimeout(timer);},[values,sessionId]);
 function addFiles(incoming){const selected=Array.from(incoming||[]);if(selected.some(f=>!(/\.(pdf|docx|txt|md)$/i.test(f.name))||f.size>10*1024*1024)){setError('Use PDF, DOCX, TXT or Markdown files up to 10 MB each.');return;}setFiles(prev=>[...new Map([...prev,...selected].map(f=>[`${f.name}:${f.size}`,f])).values()].slice(0,4));setError('');}
 async function submit(event){event.preventDefault();if(submitting.current)return;submitting.current=true;setSaving(true);setError('');try{await onSubmit({profile:values,files});try{sessionStorage.removeItem(`scholarx.profile-draft.${sessionId}`);}catch{}}catch(e){setError(e.message||'Your profile could not be saved. Please retry.');}finally{submitting.current=false;setSaving(false);}}
 return <section className="profile-start" aria-label="Start with your student profile">
  <div className="profile-intro"><div className="profile-intro-copy"><span className="profile-eyebrow"><span/> YOUR NEXT CHAPTER STARTS HERE</span><h1>Your next chapter.<br/><em>Within reach.</em></h1><p>Find the funding. Explore the possibilities.<br/>Five AI specialists, working on your future together.</p><div className="intro-route"><span><i>01</i>Your story</span><ArrowRight size={13}/><span><i>02</i>Your possibilities</span><ArrowRight size={13}/><span><i>03</i>Your draft</span></div></div>
   <ScholarAtmosphere dark={dark} interactive/>
   <div className="profile-team"><div>{AGENTS.map(a=><span key={a.id} title={`${a.name} · ${a.role}`} style={{background:a.background,color:a.color}}>{a.initial}</span>)}</div><p><strong>Five specialists. One next chapter.</strong><span>Arjun reads your story. Your team takes it from there.</span></p></div>
   <button type="button" className="profile-chat-link" onClick={onChat}>Already know your way around? Open group chat <ArrowUpRight size={14}/></button>
  </div>
  <form className="profile-start-form" aria-label="Student profile and research preferences" onSubmit={submit}>
   <header><span className="profile-step-label"><Sparkles size={13}/> STEP 01 · YOUR STORY</span><h2>Tell us your story.</h2><p>Start with what you know. If you miss an essential detail, Arjun will ask you in the group before research begins.</p><div className="profile-readiness"><div><span style={{width:`${filled/3*100}%`}}/></div><span>{filled}/3 search essentials shared</span></div></header>
   {sections.map((section,index)=><fieldset key={section.title} disabled={saving}><legend><span>0{index+1}</span>{section.title}</legend><p>{section.note}</p><div className="profile-start-fields">{section.keys.map(key=>{const[,label,placeholder]=profileFields.find(f=>f[0]===key);return <label key={key} className={['budget','public_profiles','interests','career_goals'].includes(key)?'full-field':''}><span>{label}{essentials.includes(key)&&<small>ESSENTIAL</small>}</span><input name={key} autoComplete={key==='name'?'name':'off'} placeholder={placeholder} maxLength={1000} value={values[key]||''} onChange={event=>setValues(v=>({...v,[key]:event.target.value}))}/></label>;})}</div></fieldset>)}
   <fieldset className="profile-documents" disabled={saving}><legend><span>04</span>Your supporting documents</legend><p>Optional now. Add a resume and marksheet so Arjun can check the facts.</p><button type="button" className="profile-file-drop" onClick={()=>input.current?.click()} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();addFiles(event.dataTransfer.files);}}><Upload size={20}/><span><strong>Add your resume & transcript</strong><small>PDF, DOCX, TXT, Markdown · Up to 10 MB each</small></span><span className="file-add">+</span></button><input ref={input} type="file" hidden multiple accept=".pdf,.docx,.txt,.md" aria-label="Profile supporting documents" onChange={event=>{addFiles(event.target.files);event.target.value='';}}/>
    {[...documents.map(d=>({...d,saved:true})),...files].map((file,index)=><div className="profile-file-row" key={`${file.name}-${index}`}><FileText size={14}/><span>{file.name}</span>{file.saved?<Check size={14}/>:<button type="button" onClick={()=>setFiles(prev=>prev.filter(f=>f!==file))} aria-label={`Remove selected ${file.name}`}><X size={14}/></button>}</div>)}
   </fieldset>
   {error&&<p className="profile-start-error" role="alert">{error}</p>}
   <footer><p><ShieldCheck size={15}/>Saved locally. Your profile and document text are shared with Groq for AI research. Applications stay drafts.</p><button className="profile-start-cta" type="submit" disabled={saving}>{saving?<Loader2 size={17} className="spin"/>:<Sparkles size={17}/>}<span>{saving?'Preparing your student workspace…':filled===3?'Save profile & find opportunities':'Save profile & continue with Arjun'}</span><ArrowRight size={18}/></button><button className="profile-saved-link" type="button" onClick={onStudents} disabled={saving}>Continue with a saved student <ArrowUpRight size={13}/></button></footer>
  </form>
 </section>;
}
