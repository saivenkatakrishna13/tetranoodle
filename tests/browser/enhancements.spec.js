import {test,expect} from '@playwright/test';
const id='enhancements-fictional-ui-student',url='https://example.edu/fixture';
const proof={value:'Provide a portfolio',quote:'Applicants must provide a portfolio.',url,retrieved_at:'2026-10-21T00:00:00Z'};
async function fixture(page){
 const state={sessionId:id,profile:{name:'Fictional UI Student',degree:'Bachelor of Design',target_degree:'Master of Design',countries:'Finland'},messages:[{id:'intro',agent:'mira',content:'Your saved findings are ready.',time:Date.now()}],documents:[],opportunities:[{id:'fixture-match',name:'Fixture Programme',university:'Fixture Provider',country:'Finland',url,recommended:true,rank:1,integrity_checked:true,score:60,score_components:{academic:22,funding:15,preferences:18,evidence:10},score_adjustment:-5,eligibility:'conditional',deadline_state:'upcoming',funding:'Missing: living support',deadline:'1 November 2026',claims:{requirements:proof,application:proof,deadline:{...proof,value:'1 November 2026',quote:'Applications close on 1 November 2026.'},funding:null},criteria:[{label:'Language score',required:'Official score required',student_value:'Not supplied',status:'unknown',evidence:proof}],missing_information:['Language score'],application_steps:['Provide a portfolio'],application_step_evidence:[proof]}],run:{status:'partial',coverage:{ready:0,suitable:1}},facts:[],activity:[],cursor:0,draftDocument:'# DRAFT\nFictional test draft.',draftMeta:{opportunityId:'fixture-match'},checklist:{},runHistory:[{id:'run-one',savedAt:Date.now(),goal:'Master of Design',count:1,status:'partial',verified:0},{id:'run-two',savedAt:Date.now(),goal:'Master of Design',count:2,status:'partial',verified:1}],metrics:{sage:{requests:2,inputTokens:120,outputTokens:30,latencyMs:1000,unknownUsage:0,unknownCost:2,cost:0}},profileStrength:{score:40,label:'Profile completeness, not admission probability',suggestions:[{key:'language_scores',label:'Add language results.'}]},demoFailures:{}};
 await page.route('**/api/status',r=>r.fulfill({json:{live:true,provider:'Groq'}}));await page.route(`**/api/sessions/${id}`,r=>r.fulfill({json:state}));await page.route(`**/api/sessions/${id}/insights`,r=>r.fulfill({json:state}));await page.route(`**/api/sessions/${id}/events?*`,r=>r.fulfill({contentType:'text/event-stream',body:': connected\n\n'}));await page.goto(`/app?workspace=${id}`);return state;
}
test('matches show source labels, score components, cost gaps, deadline urgency and persistent tasks',async({page})=>{
 const s=await fixture(page);await page.route(`**/api/sessions/${id}/checklist`,r=>{const body=r.request().postDataJSON();s.checklist[body.id]=body.done;return r.fulfill({json:{checklist:s.checklist}});});
 await page.getByRole('button',{name:'Your matches',exact:true}).click();await page.getByLabel('Sort matches').selectOption('urgency');
 await page.getByText('Source evidence & research priority',{exact:true}).click();await expect(page.locator('.evidence-content .verification-badge.verified')).toHaveCount(3);await expect(page.locator('.evidence-content .verification-badge.missing')).toHaveCount(1);
 await expect(page.getByRole('definition')).toHaveCount(4);await expect(page.locator('.official-match-source')).toContainText(url);await expect(page.locator('.field-verification .verification-badge.missing')).toHaveCount(1);
 await page.getByText('Fit score breakdown',{exact:true}).click();await expect(page.locator('.score-breakdown')).toContainText('22/30');await expect(page.locator('.score-breakdown')).toContainText('-5');
 await page.getByText('Funding fit & remaining gap',{exact:true}).click();await expect(page.getByText('Missing: sourced cost comparison',{exact:true})).toBeVisible();
 await page.getByText('Application checklist & timeline',{exact:true}).click();await page.locator('.application-checklist input').check();await expect(page.locator('.application-checklist input')).toBeChecked();await page.reload();await page.getByRole('button',{name:'Your matches',exact:true}).click();await page.getByText('Application checklist & timeline',{exact:true}).click();await expect(page.locator('.application-checklist input')).toBeChecked();
 await page.setViewportSize({width:320,height:667});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('research tools expose real usage, scoped demo controls and run diffs without replacing chat',async({page})=>{
 const s=await fixture(page);let applied;
 await page.route(`**/api/sessions/${id}/demo-failures`,r=>{applied=r.request().postDataJSON();s.demoFailures=applied;return r.fulfill({json:s});});
 await page.route(`**/api/sessions/${id}/runs/diff?*`,r=>r.fulfill({json:{added:['Second fixture result'],removed:[],changed:[]}}));
 await page.getByRole('textbox',{name:'Message your team'}).fill('Keep this unsent.');await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Research tools',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Research tools',exact:true});await expect(dialog.getByText('120 input / 30 output tokens',{exact:true})).toBeVisible();await expect(dialog.getByText('Cost Missing: no cited model price configured').first()).toBeVisible();
 await dialog.getByLabel('Fail next search provider once').check();await dialog.getByRole('button',{name:'Apply demo failure controls'}).click();expect(applied).toEqual({searchOnce:true,sourceOnce:false});
 await dialog.getByLabel('Select run run-one').check();await dialog.getByLabel('Select run run-two').check();await dialog.getByRole('button',{name:'Diff selected runs'}).click();await expect(dialog.getByText('Second fixture result',{exact:true})).toBeVisible();
 await page.evaluate(()=>{window.__speechCancelled=0;window.speechSynthesis.speak=utterance=>{window.__spoken=utterance.text;};window.speechSynthesis.cancel=()=>{window.__speechCancelled++;};});
 await dialog.getByRole('button',{name:'Read matches aloud',exact:true}).click();expect(await page.evaluate(()=>window.__spoken)).toContain('Fixture Programme');await dialog.getByRole('button',{name:'Stop audio summary',exact:true}).click();expect(await page.evaluate(()=>window.__speechCancelled)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message your team'})).toHaveValue('Keep this unsent.');
});
test('SOP language and PDF/DOCX controls call the matching workspace endpoints',async({page})=>{
 const s=await fixture(page);let requested;
 await page.route(`**/api/sessions/${id}/draft-language`,r=>{requested=r.request().postDataJSON();s.draftDocument='# DRAFT\nBrouillon de candidature\nSource facts preserved.';return r.fulfill({json:s});});
 await page.getByRole('button',{name:'Your matches',exact:true}).click();await expect(page.getByRole('link',{name:'Export top five PDF',exact:true})).toHaveAttribute('href',`/api/sessions/${id}/report.pdf`);
 await page.getByRole('button',{name:'Applications',exact:true}).click();await page.getByLabel('Draft language').selectOption('fr');await page.getByRole('button',{name:'Prepare language draft',exact:true}).click();expect(requested).toEqual({language:'fr',opportunityId:'fixture-match'});await expect(page.locator('.application-paper')).toContainText('Brouillon de candidature');await expect(page.getByRole('link',{name:'Export SOP .docx',exact:true})).toHaveAttribute('href',`/api/sessions/${id}/sop.docx`);
});
test('Sage missing-info action returns to chat through the existing session endpoint',async({page})=>{
 const s=await fixture(page);let called=0;await page.route(`**/api/sessions/${id}/missing-info`,r=>{called++;return r.fulfill({json:s});});
 await page.getByRole('button',{name:'Your matches',exact:true}).click();await page.getByRole('button',{name:'Ask Sage to resolve missing information',exact:true}).click();expect(called).toBe(1);await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();
});
test('replayed metric events do not double-count usage and recovery reaches the live graph',async({page})=>{
 const s=await fixture(page);const metric={type:'metric',sequence:2,agent:'sage',inputTokens:80,outputTokens:20,latencyMs:100,cost:null,metrics:{sage:{requests:1,inputTokens:80,outputTokens:20,latencyMs:100,unknownUsage:0,unknownCost:1,cost:0}}};
 await page.route(`**/api/sessions/${id}/events?*`,r=>r.fulfill({contentType:'text/event-stream',body:[metric,metric,{type:'activity',sequence:3,agent:'nova',state:'failure',label:'Source unavailable'},{type:'activity',sequence:4,agent:'nova',state:'recovery',label:'Alternative source actually fetched'}].map(e=>`data: ${JSON.stringify(e)}\n\n`).join('')}));
 await page.reload();await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Research tools',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Research tools',exact:true});await expect(dialog.getByText('80 input / 20 output tokens',{exact:true})).toBeVisible();await expect(dialog.locator('.agent-constellation')).toHaveAttribute('data-health','recovered');
});
test('demo loader creates a separate profile and never seeds opportunities',async({page})=>{
 await fixture(page);let created;const next='new-fictional-demo-profile';
 await page.route('**/api/sessions?current=*',r=>r.fulfill({json:{students:[],deletedIds:[]}}));await page.route('**/api/demo-profile',r=>r.fulfill({json:{fictional:true,profile:{name:'Rahul (fictional demo)',degree:'Final-year B.Tech Computer Science',target_degree:'Master of Computer Science',countries:'Canada'}}}));
 await page.route('**/api/sessions',r=>{created=r.request().postDataJSON();return r.fulfill({status:201,json:{sessionId:next}});});await page.route(`**/api/sessions/${next}`,r=>r.fulfill({json:{sessionId:next,profile:{name:'Rahul (fictional demo)',degree:'Final-year B.Tech Computer Science',target_degree:'Master of Computer Science',countries:'Canada'},messages:[],documents:[],opportunities:[],draftDocument:'',facts:[],activity:[],run:null,cursor:0}}));await page.route(`**/api/sessions/${next}/events?*`,r=>r.fulfill({contentType:'text/event-stream',body:': connected\n\n'}));
 await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Switch student',exact:true}).click();await page.getByRole('button',{name:'Load fictional Rahul demo',exact:true}).click();await expect(page.getByRole('heading',{name:'Tell us your story.',exact:true})).toBeVisible();expect(created.profile.name).toBe('Rahul (fictional demo)');expect(created.opportunities).toBeUndefined();await expect(page.locator('.profile-start-fields input[name=name]')).toHaveValue('Rahul (fictional demo)');
});


test('ambiguous source fields retain a visible Partial label and caveated verification stays separate',async({page})=>{
 const state=await fixture(page);
 state.opportunities[0].claims.requirements={...proof,status:'Partial',note:'Degree equivalence requires confirmation.'};
 state.opportunities[0].claims.application={...proof,status:'Verified (with note)',note:'Competitive admission.'};
 await page.reload();await page.getByRole('button',{name:'Your matches',exact:true}).click();
 await expect(page.locator('.field-verification .verification-badge.partial')).toHaveText('Partial');
 await expect(page.locator('.field-verification')).toContainText('Degree equivalence requires confirmation.');
 await expect(page.locator('.field-verification')).toContainText('Verified (with note)');
 await page.getByText('Source evidence & research priority',{exact:true}).click();
 await expect(page.locator('.evidence-content .verification-badge.partial')).toHaveCount(1);
 await expect(page.locator('.evidence-content .verification-badge.missing')).toHaveCount(1);
});


test('different original grade scales show Needs conversion check instead of a legacy pass',async({page})=>{
 const state=await fixture(page);state.profile.cgpa='7.41/10';
 state.opportunities[0].criteria=[{label:'Academic GPA',required:'Minimum 3.2 CGPA out of a possible 4.0 CGPA',student_value:'7.41/10',status:'met',evidence:proof}];
 await page.reload();await page.getByRole('button',{name:'Your matches',exact:true}).click();await page.getByText('Eligibility & missing information',{exact:true}).click();
 await expect(page.locator('.criteria-list .status-pill')).toHaveText('Needs conversion check');
 await expect(page.locator('.criteria-list .criterion-icon.met')).toHaveCount(0);
 await expect(page.locator('.criteria-list')).toContainText('No conversion or pass/fail judgment has been made.');
});

test('SOP source footnotes keep their target IDs and navigate inside the draft',async({page})=>{
 const state=await fixture(page);state.draftDocument='# DRAFT\n\nMy recorded academic result is 7.41/10.[^S1]\n\n## Supported student facts\n- CGPA: 7.41/10\n\n[^S1]: Student-provided profile: original academic result.\n\n## Gaps to complete\n- Confirm institutional grade equivalence.';
 await page.reload();await page.getByRole('button',{name:'Applications',exact:true}).click();
 const ref=page.locator('.application-paper a[data-footnote-ref]');await expect(ref).toHaveCount(1);await expect(ref).not.toHaveAttribute('target','_blank');
 const target=await ref.getAttribute('href');await expect(page.locator(target)).toHaveCount(1);await ref.click();await expect(page).toHaveURL(new RegExp(target+'$'));
 await expect(page.locator('.draft-notice').filter({hasText:'Draft only.'})).toBeVisible();
});

test('Applications refreshes stale draft text and guard metadata on entry and window focus',async({page})=>{
 const state=await fixture(page);state.draftDocument='# DRAFT\n[Missing: add a supported statement here.]';state.draftMeta={blockedClaims:Array(17).fill('legacy')};await page.reload();
 const fresh={...state,cursor:4,draftDocument:'# DRAFT\nA refreshed source-backed statement.[^S1]\n\n## Gaps to complete\n- Confirm motivation.\n\n[^S1]: Student-provided profile.',draftMeta:{method:'source-grounded-ai-arranged',blockedClaims:[]}};
 await page.route(`**/api/sessions/${id}/insights`,r=>r.fulfill({json:fresh}));
 await page.getByRole('button',{name:'Applications',exact:true}).click();await expect(page.locator('.application-paper')).toContainText('A refreshed source-backed statement.');await expect(page.locator('.application-paper')).not.toContainText('add a supported statement here');await expect(page.locator('.sop-options')).toContainText('Source-backed draft with sentence citations');await expect(page.locator('.sop-options')).not.toContainText('17 unsourced');
 fresh.cursor=5;fresh.draftDocument='# DRAFT\nLatest saved statement after returning to the window.';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.application-paper')).toContainText('Latest saved statement after returning');await expect(page.locator('.draft-notice').filter({hasText:'Draft only.'})).toBeVisible();
});

test('a delayed insights response cannot replace a newer SSE draft',async({page})=>{
 const state=await fixture(page);await page.addInitScript(()=>{window.EventSource=class{constructor(){window.__draftStream=this;}close(){}};});await page.reload();
 await page.waitForFunction(()=>!!window.__draftStream?.onmessage);
 let release;const held=new Promise(resolve=>{release=resolve;});let started;const pending=new Promise(resolve=>{started=resolve;});
 await page.route(`**/api/sessions/${id}/insights`,async r=>{started();await held;await r.fulfill({json:{...state,cursor:1,draftDocument:'# DRAFT\nObsolete draft from delayed response.'}});});
 await page.getByRole('button',{name:'Applications',exact:true}).click();await pending;
 await page.evaluate(()=>window.__draftStream.onmessage({data:JSON.stringify({type:'draft',sequence:9,content:'# DRAFT\nNewer SSE draft must stay visible.'})}));
 await expect(page.locator('.application-paper')).toContainText('Newer SSE draft must stay visible.');release();await expect(page.locator('.application-paper')).not.toContainText('Obsolete draft');await expect.poll(()=>page.locator('.application-paper').innerText()).toContain('Newer SSE draft must stay visible.');
});

test('unverified leads do not present a legacy intake-fit claim or confirmed countdown',async({page})=>{
 const state=await fixture(page);Object.assign(state.opportunities[0],{integrity_checked:false,identity_verified:true,reason:'Spring 2027 fits your graduation.',funding:'20,000 tuition support',deadline:'1 November 2026',claims:{...state.opportunities[0].claims,funding:{...proof,value:'20,000 tuition support',status:'Unverified'}}});
 await page.reload();await page.getByRole('button',{name:'Your matches',exact:true}).click();await expect(page.locator('.match-reason')).toContainText('This is a partial lead.');await expect(page.locator('.match-reason')).not.toContainText('Spring 2027 fits');await expect(page.locator('.opportunity-key-facts')).toContainText('Unverified: 20,000 tuition support');await expect(page.locator('.opportunity-key-facts')).toContainText('Unverified: 1 November 2026');await expect(page.locator('.deadline-badge')).toHaveText('Deadline Unverified');await expect(page.locator('.official-match-source')).toHaveAttribute('href',url);
});

test('all ten discovered sources remain visible and provisional top-five leads never appear verified',async({page})=>{
 const state=await fixture(page);
 state.run={...state.run,pipeline:{finished:true},foundCount:10,discovered:Array.from({length:10},(_,i)=>({name:i?'Source '+i:'Fixture Programme',university:i?'Provider '+i:'Fixture Provider',country:i%2?'Germany':'Finland',url:i?`https://example${i}.edu/source`:url,state:'partial',attempted:true,reason:'Source check timed out.'}))};
 await page.reload();await page.getByRole('button',{name:'Your matches',exact:true}).click();await expect(page.locator('.opportunity-card')).toHaveCount(5);await expect(page.getByText(/1 reviewed recommendation\(s\). 4 additional source lead/)).toBeVisible();await expect(page.locator('.rank-badge').filter({hasText:'SOURCE LEAD'})).toHaveCount(4);
 const leads=page.locator('.opportunity-card').filter({has:page.locator('.rank-badge').filter({hasText:'SOURCE LEAD'})});await expect(leads.locator('.field-verification .verification-badge.verified')).toHaveCount(0);for(const button of await leads.getByRole('button',{name:'Review source first',exact:true}).all())await expect(button).toBeDisabled();
 await page.getByRole('button',{name:'All found 10',exact:true}).click();await expect(page.locator('.opportunity-card')).toHaveCount(10);await expect(page.locator('.opportunity-card a.official-match-source')).toHaveCount(10);await expect(page.locator('.match-reason').filter({hasText:'This source needs an official evidence check'})).toHaveCount(9);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
