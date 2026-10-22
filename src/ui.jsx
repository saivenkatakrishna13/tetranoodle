import React, { useEffect, useRef, useState } from 'react';
import { Users, X, FileText, CheckCheck, Check, Clock3, AlertCircle, CornerUpLeft, Copy, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AGENTS, byId } from './agents';
export const timeLabel = time => new Date(time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
export function IconButton({title,children,className='',...props}){return <button type="button" title={title} aria-label={title} className={`icon-button ${className}`} {...props}>{children}</button>;}
export function Avatar({agent,size='',online=false}){return <span className={`avatar ${size}`} style={{'--agent-background':agent.background,'--agent-color':agent.color}}><span>{agent.name[0]}</span>{online&&<i/>}</span>;}
export function TeamMark({large=false}){return <span className={`team-mark ${large?'large':''}`}><Users size={large?42:25}/><i><span>✦</span></i></span>;}
export function Markdown({children}){return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({children,href,node,...props})=>href?.startsWith('#')?<a {...props} href={href}>{children}</a>:<a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={11}/></a>}}>{children}</ReactMarkdown>;}
export function Modal({title,subtitle,children,close,wide=false}){
  const dialog=useRef(null),latestClose=useRef(close);latestClose.current=close;
  const[leaving,setLeaving]=useState(false),exitTimer=useRef(null);
  function requestClose(){if(exitTimer.current)return;if(matchMedia('(prefers-reduced-motion: reduce)').matches){latestClose.current();return;}setLeaving(true);exitTimer.current=setTimeout(()=>latestClose.current(),160);}
  useEffect(()=>{const before=document.activeElement;const focusable=()=>[...dialog.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(e=>!e.disabled);focusable()[0]?.focus();const key=e=>{if(!dialog.current?.getClientRects().length)return;if(e.key==='Escape')requestClose();if(e.key==='Tab'){const list=focusable(),first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{clearTimeout(exitTimer.current);document.removeEventListener('keydown',key);before?.focus?.();};},[]);
  return <div className={`modal-backdrop ${leaving?'is-closing':''}`} onMouseDown={e=>e.target===e.currentTarget&&requestClose()}><section ref={dialog} className={`modal ${wide?'wide':''} ${leaving?'is-closing':''}`} role="dialog" aria-modal="true" aria-label={title}><header><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><IconButton title="Close dialog" onClick={requestClose}><X size={22}/></IconButton></header>{children}</section></div>;
}
export const MessageBubble=React.memo(function MessageBubble({message:m,grouped,onReply,onCopy}){
  if(m.agent==='system')return <div className="system-message">{m.content}</div>;
  const mine=m.agent==='you',agent=byId(m.agent);
  return <article className={`message-row ${mine?'mine':''} ${grouped?'grouped':''}`} id={`message-${m.id}`}>
    {!mine&&<span className={grouped?'invisible':''}><Avatar agent={agent} size="message-avatar"/></span>}
    <div className={`bubble ${mine?'outgoing':''} ${m.kind==='error'?'error-bubble':''}`}>
      {!mine&&!grouped&&<div className="message-author" style={{'--agent-color':agent.color}}>{agent.name}<span>{agent.role}</span></div>}
      {m.replyTo&&<div className="quoted-message"><strong>{m.replyTo.agent==='you'?'You':byId(m.replyTo.agent).name}</strong><p>{m.replyTo.content.slice(0,180)}</p></div>}
      {m.documents?.map(d=><div className="attachment" key={d.id}><span><FileText size={27}/></span><div><strong>{d.name}</strong><small>{Math.max(1,Math.round(d.size/1024))} KB · Document</small></div></div>)}
      <div className="message-text"><Markdown>{m.content}</Markdown></div>
      <div className="message-meta">{m.preview&&<span>Preview</span>}<time>{timeLabel(m.time)}</time>{mine&&(m.delivery==='sending'?<Clock3 size={13}/>:m.delivery==='failed'?<AlertCircle size={14}/>:m.delivery==='sent'?<Check size={15}/>:<CheckCheck className="read-ticks" size={17}/>)}</div>
      <div className="message-actions"><IconButton title="Reply to message" onClick={()=>onReply(m)}><CornerUpLeft size={16}/></IconButton><IconButton title="Copy message" onClick={()=>onCopy(m.content)}><Copy size={15}/></IconButton></div>
    </div>
  </article>;
});
export function StatusPill({status}){const labels={outside_preferences:'Outside your preferences',conditional:'Needs your details',appears_eligible:'Meets checked criteria',not_eligible:'Requirement mismatch',met:'Met',not_met:'Not met',unknown:'Not confirmed',needs_conversion_check:'Needs conversion check'};return <span className={`status-pill ${status}`}>{labels[status]||status}</span>;}
