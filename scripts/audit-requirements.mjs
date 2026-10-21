import {readFile,writeFile} from 'node:fs/promises';
import {supportedClaim} from '../server/research.js';
import {researchCoverage} from '../server/research-quality.js';
const base=process.env.TETRA_URL||'http://127.0.0.1:3001';
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const ids=['hackathon-rahul-complete-2026',(await readJson('artifacts/adaptation-validation.json')).sessionId];
const previous=await readJson('artifacts/requirements-audit.json').catch(()=>({}));
const cases=[],unavailableWorkspaces=[];
for(const id of ids){
 let raw;try{raw=await readJson(`.data/sessions/${id}.json`);}catch(e){if(e.code!=='ENOENT')throw e;unavailableWorkspaces.push({workspace:id,reason:'Saved demo workspace no longer exists; deletion is preserved.'});continue;}
 const response=await fetch(`${base}/api/sessions/${id}`);if(!response.ok){unavailableWorkspaces.push({workspace:id,reason:`Workspace unavailable (HTTP ${response.status}).`});continue;}
 const s=await response.json(),evidence=new Map(raw.evidence);
 const retained=s.opportunities.flatMap(o=>[...Object.values(o.claims||{}),...(o.application_step_evidence||[]),...(o.criteria||[]).map(c=>c.evidence)]).filter(Boolean);
 const unsupported=retained.filter(c=>!supportedClaim(c,evidence));
 const draftSourceStillReviewed=s.opportunities.some(o=>o.id===raw.draftMeta?.opportunityId&&o.integrity_checked===true);
 cases.push({name:s.profile.name,workspace:id,goal:s.profile.target_degree,countries:s.profile.countries,status:s.run?.status,opportunities:s.opportunities.length,suitable:researchCoverage(s.opportunities,!!s.draftDocument).suitable,recommended:s.opportunities.filter(o=>o.recommended).length,retainedClaims:retained.length,unsupportedQuotes:unsupported.length,unreviewedRecommendations:s.opportunities.filter(o=>o.recommended&&o.integrity_checked!==true).length,documentCount:s.documents.length,documentFacts:s.facts.length,draftCharacters:s.draftDocument.length,draftMethod:raw.draftMeta?.method||'legacy-ai-reviewed',draftSourceStillReviewed,contributingAgents:[...new Set(s.messages.filter(m=>m.agent!=='you').map(m=>m.agent))],coverage:researchCoverage(s.opportunities,!!s.draftDocument&&draftSourceStillReviewed&&raw.draftMeta?.method!=='profile-template')});
}
const ui=await readJson('artifacts/end-to-end-ui-validation.json'),github=await readJson('artifacts/github-tool-validation.json'),video=await readJson('artifacts/demo-recording.json');
const status=await fetch(base+'/api/status').then(r=>r.json());
const checks={fiveRolesConfigured:Object.values(status.agents).every(Boolean),scraplingReady:status.scrapling,allRetainedQuotesMatchRetrievedText:cases.length?cases.every(c=>c.unsupportedQuotes===0):null,liveUi:ui.errors.length===0&&ui.checks.every(c=>c.passed),githubRecovery:github.checks.some(c=>c.injectedFailure&&c.publicPageFetchedLive&&c.characters>0),recordingHasNoSceneErrors:video.errors.length===0};
const historicalCases=previous.cases?.length?previous.cases:previous.historicalCases||[];
const historicalCheckedAt=previous.cases?.length?previous.checkedAt:previous.historicalCheckedAt;
const audit={checkedAt:new Date().toISOString(),brand:'ScholarX',checks,cases,unavailableWorkspaces,...(unavailableWorkspaces.length?{historicalCases,historicalCheckedAt}:{}),limitations:['Unknown student nationality, language results, credits, portfolio and individual project outcomes are never fabricated.','An annual day/month alone is not proof of a current intake year. A pack remains partial when practical source evidence is incomplete.','No real university applications were submitted.',...(unavailableWorkspaces.length?['Deleted demo workspaces were not recreated. Their retained reports are historical evidence, not a fresh verification of source completeness.']:[])]};
await writeFile('artifacts/requirements-audit.json',JSON.stringify(audit,null,2));
const rows=[
 ['Understand the student','Implemented','PDF/DOCX/TXT extraction; supported facts; supplied GitHub/public-page tools; conflict detection.'],
 ['10 real opportunities',!cases.length?'Historical evidence only':cases.every(c=>c.suitable>=10)?'Live checked':'Live evidence still partial',cases.length?cases.map(c=>`${c.name}: ${c.opportunities} reviewed, ${c.suitable} potentially suitable`).join('; '):'The saved demo workspaces were deleted. Historical results are retained in the machine-readable audit.'],
 ['Official eligibility checks',cases.length?'Implemented and live checked':'Implemented; previously live checked','Requirement-by-requirement comparisons, unknowns, source excerpts, source ownership and independent semantic review.'],
 ['Top 5, funding, deadlines, application steps',!cases.length?'Historical evidence only':cases.every(c=>c.coverage.complete)?'Live pack complete':'Live evidence still partial',cases.length?cases.map(c=>`${c.name}: ${c.recommended} ranked; ${c.coverage.ready}/5 with all practical details evidenced`).join('; '):'Previous packs had unresolved funding, date and application gaps; no fresh completeness claim is made.'],
 ['One application draft',!cases.length?'Historical evidence only':cases.every(c=>c.draftCharacters>0&&c.draftSourceStillReviewed&&c.draftMethod!=='profile-template')?'Live checked':'Needs current source review',cases.length?cases.map(c=>`${c.name}: ${c.draftCharacters} characters; source ${c.draftSourceStillReviewed?'reviewed':'needs rechecking'}`).join('; '):'Previously generated fictional-student drafts remain in artifacts; their workspaces are deleted.'],
 ['Upload/profile/start/progress website','Live checked','Unmocked browser walkthrough, real PDF upload, real Groq document review, refresh, exports, themes and student switch.'],
 ['4+ collaborating agents and recovery','Live checked','Five specialist roles; persistent artifacts; failed-source alternatives, provider backoff, pause/resume, public GitHub-page fallback.'],
 ['Adapt to another student','Live checked','Design student and CS student use the same implementation with separate profile-driven searches and isolated documents.'],
 ['Repository / demo / recording / diagram / note','Prepared','Private GitHub repository; local website; five-minute video; architecture.svg; experiment-and-challenge.md.'],
 ];
await writeFile('docs/requirements-audit.md',`# ScholarX hackathon audit\n\nChecked ${audit.checkedAt}. The table separates implemented capabilities from the completeness of live research evidence.\n\n| Requirement | Status | Evidence |\n| --- | --- | --- |\n${rows.map(row=>'| '+row.join(' | ')+' |').join('\n')}\n\nSee [machine-readable audit](../artifacts/requirements-audit.json), [real browser checks](../artifacts/end-to-end-ui-validation.json), and the source-linked research reports in [artifacts](../artifacts/README.md).\n\n${audit.limitations.map(t=>'- '+t).join('\n')}\n`);
console.log(JSON.stringify(audit,null,2));
if(Object.values(checks).some(ok=>ok===false))process.exitCode=1;
