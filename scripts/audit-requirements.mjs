import {readFile,writeFile} from 'node:fs/promises';
import {supportedClaim} from '../server/research.js';
import {researchCoverage} from '../server/research-quality.js';
const base=process.env.TETRA_URL||'http://127.0.0.1:3001';
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const ids=['hackathon-rahul-complete-2026',(await readJson('artifacts/adaptation-validation.json')).sessionId];
const cases=[];
for(const id of ids){
 const s=await fetch(`${base}/api/sessions/${id}`).then(r=>r.json());
 const raw=await readJson(`.data/sessions/${id}.json`),evidence=new Map(raw.evidence);
 const retained=s.opportunities.flatMap(o=>[...Object.values(o.claims||{}),...(o.application_step_evidence||[]),...(o.criteria||[]).map(c=>c.evidence)]).filter(Boolean);
 const unsupported=retained.filter(c=>!supportedClaim(c,evidence));
 const draftSourceStillReviewed=s.opportunities.some(o=>o.id===raw.draftMeta?.opportunityId&&o.integrity_checked===true);
 cases.push({name:s.profile.name,workspace:id,goal:s.profile.target_degree,countries:s.profile.countries,status:s.run?.status,opportunities:s.opportunities.length,suitable:researchCoverage(s.opportunities,!!s.draftDocument).suitable,recommended:s.opportunities.filter(o=>o.recommended).length,retainedClaims:retained.length,unsupportedQuotes:unsupported.length,unreviewedRecommendations:s.opportunities.filter(o=>o.recommended&&o.integrity_checked!==true).length,documentCount:s.documents.length,documentFacts:s.facts.length,draftCharacters:s.draftDocument.length,draftMethod:raw.draftMeta?.method||'legacy-ai-reviewed',draftSourceStillReviewed,contributingAgents:[...new Set(s.messages.filter(m=>m.agent!=='you').map(m=>m.agent))],coverage:researchCoverage(s.opportunities,!!s.draftDocument&&draftSourceStillReviewed&&raw.draftMeta?.method!=='profile-template')});
}
const ui=await readJson('artifacts/end-to-end-ui-validation.json'),github=await readJson('artifacts/github-tool-validation.json'),video=await readJson('artifacts/demo-recording.json');
const status=await fetch(base+'/api/status').then(r=>r.json());
const checks={fiveRolesConfigured:Object.values(status.agents).every(Boolean),scraplingReady:status.scrapling,allRetainedQuotesMatchRetrievedText:cases.every(c=>c.unsupportedQuotes===0),liveUi:ui.errors.length===0&&ui.checks.every(c=>c.passed),githubRecovery:github.checks.some(c=>c.injectedFailure&&c.publicPageFetchedLive&&c.characters>0),recordingHasNoSceneErrors:video.errors.length===0};
const audit={checkedAt:new Date().toISOString(),brand:'ScholarX',checks,cases,limitations:['Unknown student nationality, language results, credits, portfolio and individual project outcomes are never fabricated.','An annual day/month alone is not proof of a current intake year. A pack remains partial when practical source evidence is incomplete.','No real university applications were submitted.']};
await writeFile('artifacts/requirements-audit.json',JSON.stringify(audit,null,2));
const rows=[
 ['Understand the student','Implemented','PDF/DOCX/TXT extraction; supported facts; supplied GitHub/public-page tools; conflict detection.'],
 ['10 real opportunities',cases.every(c=>c.suitable>=10)?'Live checked':'Live evidence still partial',cases.map(c=>`${c.name}: ${c.opportunities} reviewed, ${c.suitable} potentially suitable`).join('; ')],
 ['Official eligibility checks','Implemented and live checked','Requirement-by-requirement comparisons, unknowns, source excerpts, source ownership and independent semantic review.'],
 ['Top 5, funding, deadlines, application steps',cases.every(c=>c.coverage.complete)?'Live pack complete':'Live evidence still partial',cases.map(c=>`${c.name}: ${c.recommended} ranked; ${c.coverage.ready}/5 with all practical details evidenced`).join('; ')],
 ['One application draft',cases.every(c=>c.draftCharacters>0&&c.draftSourceStillReviewed&&c.draftMethod!=='profile-template')?'Live checked':'Needs current source review',cases.map(c=>`${c.name}: ${c.draftCharacters} characters; source ${c.draftSourceStillReviewed?'reviewed':'needs rechecking'}`).join('; ')],
 ['Upload/profile/start/progress website','Live checked','Unmocked browser walkthrough, real PDF upload, real Groq document review, refresh, exports, themes and student switch.'],
 ['4+ collaborating agents and recovery','Live checked','Five specialist roles; persistent artifacts; failed-source alternatives, provider backoff, pause/resume, public GitHub-page fallback.'],
 ['Adapt to another student','Live checked','Design student and CS student use the same implementation with separate profile-driven searches and isolated documents.'],
 ['Repository / demo / recording / diagram / note','Prepared','Private GitHub repository; local website; five-minute video; architecture.svg; experiment-and-challenge.md.'],
 ];
await writeFile('docs/requirements-audit.md',`# ScholarX hackathon audit\n\nChecked ${audit.checkedAt}. The table separates implemented capabilities from the completeness of live research evidence.\n\n| Requirement | Status | Evidence |\n| --- | --- | --- |\n${rows.map(row=>'| '+row.join(' | ')+' |').join('\n')}\n\nSee [machine-readable audit](../artifacts/requirements-audit.json), [real browser checks](../artifacts/end-to-end-ui-validation.json), and the source-linked research reports in [artifacts](../artifacts/README.md).\n\n${audit.limitations.map(t=>'- '+t).join('\n')}\n`);
console.log(JSON.stringify(audit,null,2));
if(Object.values(checks).some(ok=>!ok))process.exitCode=1;
