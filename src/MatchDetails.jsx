import React from 'react';
import {fundingFit,applicationPlan,deadlineInfo} from '../shared/match-planning';
import {evidenceLabel} from '../shared/models';
import {sourceTrust} from '../server/source-trust';
import {evidenceCoverage} from '../server/research-quality';
export function SourceBadge({claim,reviewed}){const trust=claim?sourceTrust(claim.url,{official:reviewed}):null;return <span className="source-badges" title={claim?.note||undefined}><span className={`verification-badge ${evidenceLabel(claim,reviewed).startsWith('Verified')?'verified':evidenceLabel(claim,reviewed).toLowerCase()}`}>{evidenceLabel(claim,reviewed)}</span>{trust&&<span title={trust.reason}>{trust.label}</span>}</span>;}
export function DeadlineBadge({opportunity}){if(opportunity.claims?.deadline&&(opportunity.integrity_checked!==true||['Unverified','Partial','Missing'].includes(opportunity.claims.deadline.status)))return <span className="deadline-badge">Deadline Unverified</span>;const d=deadlineInfo(opportunity);return <span className={`deadline-badge ${d.status==='Closing soon'?'soon':''}`} title={d.timezone}>{d.date?`${d.status} · ${d.days} days`:`Deadline ${d.status}`}</span>;}
export default function MatchDetails({opportunity:o,checklist={},onTask,onResolve}){
 const fit=fundingFit(o.costs),tasks=applicationPlan(o,checklist),deadline=deadlineInfo(o);
 return <div className="match-enhancements">
  <a className="official-match-source" href={o.url} target="_blank" rel="noreferrer">{o.integrity_checked?'Official source':'Source awaiting ownership verification'}: {o.url}</a>
  <dl className="field-verification" aria-label="Verification per field">{[['funding','Funding'],['deadline','Deadline / intake'],['requirements','Entry requirements'],['application','Application steps']].map(([key,label])=>{
   const claim=o.claims?.[key],status=evidenceLabel(claim,o.integrity_checked===true&&evidenceCoverage(o)[key]);
   return <div key={key}><dt>{label}</dt><dd><span className={`verification-badge ${status.startsWith('Verified')?'verified':status.toLowerCase()}`}>{status}</span>{claim?.note&&<small>{claim.note}</small>}{claim&&<a href={claim.url} target="_blank" rel="noreferrer">Source</a>}</dd></div>;
  })}</dl>
  <DeadlineBadge opportunity={o}/>
  {o.score_components&&<details className="match-details"><summary>Fit score breakdown</summary><div className="score-breakdown">{Object.entries(o.score_components).map(([key,value])=><div key={key}><span>{key}</span><strong>{value}/{({academic:30,funding:35,preferences:20,evidence:15})[key]}</strong></div>)}<p>Evidence/eligibility adjustment: {o.score_adjustment||0}. Total {o.score}/100. Research priority only.</p></div></details>}
  <details className="match-details"><summary>Funding fit & remaining gap</summary><div className="funding-fit"><strong>{fit.gap===null?'Missing: sourced cost comparison':`${fit.currency} ${fit.gap.toLocaleString()} / ${fit.period} remaining gap`}</strong><p>{fit.reason}</p>{Object.entries(o.costs||{}).map(([key,c])=><p key={key}>{key}: {c.amount} {c.currency} / {c.period} · <a href={c.evidence.url} target="_blank" rel="noreferrer">Source</a><small>{c.evidence.quote}</small></p>)}</div></details>
  <details className="match-details"><summary>Application checklist & timeline</summary><div className="application-checklist">{tasks.length?tasks.map(task=><label key={task.id}><input type="checkbox" checked={task.done} onChange={e=>onTask?.(task.id,e.target.checked)}/><span>{task.label}<small>{task.date?`Suggested target: ${task.date}; confirm task deadline`:'Date Missing'} · <a href={task.evidence.url} target="_blank" rel="noreferrer">Official instructions</a></small></span></label>):<p>Missing: source-backed document and test instructions. Use Verify missing details.</p>}<p>{deadline.timezone}</p></div></details>
  {onResolve&&o.criteria?.some(c=>c.status==='unknown'&&c.evidence)&&<button className="secondary-button resolve-info" onClick={onResolve}>Ask Sage to resolve missing information</button>}
 </div>;
}
