import {test,expect}from'@playwright/test';
const welcome={id:'welcome',agent:'mira',content:'Welcome. What are you studying?',time:Date.now()};
async function isolate(page,overrides={}){
 await page.route('**/api/status',route=>route.fulfill({json:{live:true,provider:'Groq'}}));
 await page.route('**/api/sessions/*',async route=>{
  if(route.request().method()==='GET'&&!route.request().url().includes('/events'))return route.fulfill({json:{sessionId:'browser-fixture-session',profile:{},documents:[],opportunities:[],messages:[welcome],draftDocument:'',facts:[],run:null,activity:[],cursor:0,...overrides}});
  return route.continue();
 });
 // Keep test event feeds controlled and offline so tests never use Groq quota.
 await page.route('**/api/sessions/*/events?*',route=>route.fulfill({contentType:'text/event-stream',body:': connected\n\n'}));
}
test('desktop and phone show WhatsApp-style chat, working search, and group details',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await isolate(page);await page.goto('/app');
 await expect(page.getByRole('heading',{name:'Scholarship squad',exact:true}).first()).toBeVisible();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();
 await page.getByRole('button',{name:'Search messages',exact:true}).click();await page.getByRole('textbox',{name:'Search messages',exact:true}).fill('impossible match');await expect(page.getByText('No messages match “impossible match”.')).toBeVisible();
 await page.getByRole('button',{name:'Close search'}).click();await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Group details',exact:true}).click();await expect(page.getByText('Group info',{exact:true})).toBeVisible();await expect(page.getByText('6 participants',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close details'}).click();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('provider waits show a live countdown and saved findings can finish without another search',async({page})=>{
 const now=Date.now(),run={status:'running',stage:'details',progress:70,startedAt:now-1000,passStartedAt:now-1000};
 await isolate(page,{messages:[welcome],run,opportunities:[{id:'checked-program',name:'Reviewed programme',integrity_checked:true}],activity:[{time:now,waitUntil:now+60000,waitReason:'Groq rate limit',attempt:1,maxAttempts:5}]});
 let finishCalls=0;await page.route('**/api/sessions/*/finish',route=>{finishCalls++;return route.fulfill({json:{run:{...run,finalizing:true,stage:'draft',passStartedAt:Date.now(),message:'Preparing saved findings'}}});});
 await page.goto('/app');await expect(page.locator('.run-strip strong')).toHaveText('Waiting for Groq');
 const countdown=await page.locator('.run-strip small').innerText();await expect(page.locator('.run-strip small')).not.toHaveText(countdown);
 await page.setViewportSize({width:320,height:667});await expect(page.getByRole('textbox',{name:'Message your team'})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Finish with current results'}).click();await expect(page.locator('.run-strip strong')).toHaveText('Preparing saved results');expect(finishCalls).toBe(1);
 await expect(page.getByRole('button',{name:'Finish with current results'})).toHaveCount(0);
});
test('planned token scheduling is distinct from a provider error and unnecessary chat controls are absent',async({page})=>{
 const now=Date.now();await isolate(page,{run:{status:'running',stage:'verify',passStartedAt:now},activity:[{time:now,waitUntil:now+30000,waitReason:'Provider token allowance',label:'Scheduling next request.'}]});
 await page.goto('/app');await expect(page.locator('.run-strip strong')).toHaveText('Scheduling next request');await expect(page.locator('.run-strip small')).toContainText('next request in');
 await expect(page.getByRole('button',{name:/starred|star message|add an emoji/i})).toHaveCount(0);
 await page.getByRole('button',{name:'Chat menu',exact:true}).click();await expect(page.getByRole('button',{name:'Starred messages',exact:true})).toHaveCount(0);
});
test('a partial research pack does not show all journey steps as completed',async({page})=>{
 await isolate(page,{profile:{degree:'B.Tech Computer Science',target_degree:'Master of Computer Science',countries:'Canada'},opportunities:[{id:'saved',recommended:true}],draftDocument:'# DRAFT\nReview required.',run:{status:'partial',coverage:{ready:0}}});
 await page.goto('/app');await expect(page.getByText('0/5 matches fully verified',{exact:true})).toBeVisible();await expect(page.getByText('Draft saved · evidence incomplete',{exact:true})).toBeVisible();
 await expect(page.locator('.journey-step.done')).toHaveCount(1);await expect(page.locator('.run-strip small')).toContainText('verification incomplete');
});
test('the scholarship journey opens the existing profile, research and draft workspaces',async({page})=>{
 await isolate(page);await page.goto('/app');
 await expect(page.getByRole('heading',{name:/Your next chapter\. Beyond the expected\./})).toBeVisible();
 await page.setViewportSize({width:320,height:667});await expect(page.getByRole('heading',{name:/Your next chapter\. Beyond the expected\./})).toBeInViewport();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeInViewport();await page.setViewportSize({width:1440,height:900});
 const journey=page.getByRole('navigation',{name:'Your scholarship journey'});
 await journey.getByRole('button',{name:/Your story:/}).click();
 await expect(page.getByRole('dialog',{name:'Your student profile'})).toBeVisible();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await journey.getByRole('button',{name:/Your possibilities:/}).click();await expect(page.getByRole('heading',{name:'Your next possibilities',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Group chat',exact:true}).click();await journey.getByRole('button',{name:/Your next step:/}).click();await expect(page.getByRole('heading',{name:'Application draft',exact:true})).toBeVisible();
});
test('streamed replies persist, messages can be quoted, provider errors stay readable',async({page})=>{
 const serverState={messages:[welcome]};await isolate(page,serverState);await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:[{type:'profile',profile:{name:'Rahul',degree:'B.Tech Computer Science',cgpa:'8.2 / 10'}},{type:'message',message:{id:'arjun-reply',agent:'arjun',content:'Thanks Rahul. I’ll keep your CGPA on its original scale.',time:Date.now()}},{type:'done'}].map(e=>`data: ${JSON.stringify(e)}\n\n`).join('')}));
 await page.goto('/app');await page.getByRole('textbox',{name:'Message your team'}).fill('I am Rahul, B.Tech CS, CGPA 8.2 / 10.');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByText('Thanks Rahul. I’ll keep your CGPA on its original scale.',{exact:true})).toBeVisible();
 const bubble=page.locator('#message-arjun-reply');await expect(page.getByRole('button',{name:/star message|starred messages|add an emoji/i})).toHaveCount(0);
 await bubble.hover();await bubble.getByRole('button',{name:'Reply to message'}).click();await expect(page.locator('.reply-preview')).toContainText('Arjun');await page.getByRole('button',{name:'Cancel reply'}).click();
 serverState.messages=[{id:'arjun-reply',agent:'arjun',content:'Thanks Rahul. I’ll keep your CGPA on its original scale.',time:Date.now()}];
 await page.reload();await expect(page.getByText('Thanks Rahul. I’ll keep your CGPA on its original scale.',{exact:true})).toBeVisible();
 await page.unroute('**/api/chat');await page.route('**/api/chat',route=>route.fulfill({status:503,json:{error:'Provider unavailable. Please retry.'}}));
 await page.getByRole('textbox',{name:'Message your team'}).fill('Germany');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByText('Provider unavailable. Please retry.',{exact:true})).toBeVisible();
});
test('long conversations scroll while header and composer remain fixed on desktop, phone and landscape',async({page})=>{
 const messages=Array.from({length:35},(_,i)=>({id:`long-${i}`,agent:['mira','arjun','nova','sage','leo'][i%5],content:`Message ${i+1}. `+'A longer research finding with requirements, funding details, and next steps. '.repeat(12),time:Date.now()}));
 await isolate(page,{messages});await page.goto('/app');
 for(const size of[{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);await page.waitForTimeout(400);
  const metrics=await page.evaluate(()=>({headerTop:document.querySelector('.chat-header').getBoundingClientRect().top,composerBottom:document.querySelector('.composer').getBoundingClientRect().bottom,height:innerHeight,pageScroll:scrollY,scrollable:document.querySelector('.chat-scroll').scrollHeight>document.querySelector('.chat-scroll').clientHeight,overflow:document.documentElement.scrollWidth>innerWidth}));
  expect(metrics.headerTop).toBe(0);expect(metrics.composerBottom).toBeLessThanOrEqual(metrics.height);expect(metrics.pageScroll).toBe(0);expect(metrics.scrollable).toBe(true);expect(metrics.overflow).toBe(false);
  await page.locator('.chat-scroll').evaluate(el=>{el.scrollTop=0;});await expect(page.getByRole('button',{name:'Jump to latest messages'})).toBeVisible();await page.getByRole('button',{name:'Jump to latest messages'}).click();await expect.poll(()=>page.locator('.chat-scroll').evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(5);
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('textbox',{name:'Message your team'}).fill('Line one\nLine two\nLine three\nLine four');await expect(page.getByRole('button',{name:'Send message',exact:true})).toBeInViewport();
});
test('research recommendations expose requirements, source proof, application steps and draft action',async({page})=>{
 const opportunity={integrity_checked:true,id:'opportunity-1',name:'MSc Computing',university:'Example University',country:'Canada',url:'https://example.edu/msc',recommended:true,rank:1,score:65,eligibility:'conditional',funding:'Funding not confirmed',deadline:'Current deadline not confirmed',reason:'A degree in the requested field.',missing_information:['English test result'],criteria:[{label:'English test',required:'IELTS 6.5',student_value:'Not supplied',status:'unknown'}],application_steps:['Complete the official application.'],claims:{requirements:{value:'IELTS 6.5',quote:'Applicants need IELTS overall 6.5.',url:'https://example.edu/msc',retrieved_at:'2026-10-19T00:00:00Z'},funding:null}};
 await isolate(page,{opportunities:[opportunity],draftDocument:'# DRAFT\n\nA student-specific draft with [project details].'});await page.goto('/app');await page.getByRole('button',{name:'Your matches',exact:true}).click();await expect(page.getByRole('heading',{name:'MSc Computing',exact:true})).toBeVisible();
 await page.getByText('Eligibility & missing information',{exact:true}).click();await expect(page.getByText('English test result',{exact:true})).toBeVisible();await page.getByText('How to apply',{exact:true}).click();await expect(page.getByText('Complete the official application.',{exact:true})).toBeVisible();
 await page.getByText('Source evidence & research priority',{exact:true}).click();await expect(page.getByText('Applicants need IELTS overall 6.5.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Applications',exact:true}).click();await expect(page.getByRole('button',{name:'Download draft',exact:true})).toBeVisible();
});
test('a partial shortlist can verify its missing details without starting discovery',async({page})=>{
 const opportunity={integrity_checked:true,id:'checked-design',name:'MSc Design',university:'Example University',country:'Finland',url:'https://example.edu/design',recommended:true,rank:1,eligibility:'conditional',claims:{},criteria:[],missing_information:[]};
 await isolate(page,{profile:{degree:'B.Des',target_degree:'Master of Design',countries:'Finland'},messages:[welcome],opportunities:[opportunity],run:{status:'partial',stage:'done',coverage:{complete:false,suitable:10,ready:2}}});
 let request;await page.route('**/api/research',route=>{request=route.request().postDataJSON();return route.fulfill({status:202,json:{run:{status:'running',mode:'details',stage:'details',passStartedAt:Date.now(),message:'Rechecking saved official sources'}}});});
 await page.goto('/app');await page.getByRole('button',{name:'Your matches',exact:true}).click();
 await page.setViewportSize({width:320,height:667});await expect(page.getByRole('button',{name:'Verify missing details'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Verify missing details'}).click();await expect.poll(()=>request).toMatchObject({resume:true,mode:'details'});await expect(page.locator('.run-strip strong')).toHaveText('Checking application details');await expect(page.getByRole('textbox',{name:'Message your team'})).toBeInViewport();
});
test('invalid uploads report a readable error',async({page})=>{
 await isolate(page);
 await page.goto('/app');await page.locator('.app-shell>input[type=file]').setInputFiles({name:'scan.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a valid PDF')});await expect(page.getByRole('alert')).toContainText('could not be read');
});
test('a finished partial pipeline opens saved matches and only an explicit fresh run starts more research',async({page})=>{
 const opportunity={identity_verified:true,integrity_checked:false,id:'finished-source',name:'MSc Design',university:'Example University',country:'Finland',url:'https://example.edu/design',recommended:true,rank:1,eligibility:'conditional',claims:{},criteria:[],missing_information:[]};
 await isolate(page,{profile:{degree:'B.Des',target_degree:'Master of Design',countries:'Finland'},opportunities:[opportunity],run:{status:'partial',stage:'done',pipeline:{finished:true,cursor:6},coverage:{complete:false,suitable:1,ready:0}}});
 const requests=[];await page.route('**/api/research',route=>{requests.push(route.request().postDataJSON());return route.fulfill({status:202,json:{run:{status:'running',stage:'profile',progress:5}}});});
 await page.goto('/app');await page.locator('.run-strip').getByRole('button',{name:'View matches',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your next possibilities',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Resume research$|^Verify missing details$/})).toHaveCount(0);await expect(page.locator('.opportunity-card .status-pill')).toHaveText('Not confirmed');expect(requests).toEqual([]);
 await page.getByRole('button',{name:'Start new research',exact:true}).click();await expect.poll(()=>requests.length).toBe(1);expect(requests[0]).toMatchObject({resume:false,mode:'research'});
});
test('appearance is accessible on phones and persists across reloads and workspaces',async({page})=>{
 await isolate(page);await page.emulateMedia({colorScheme:'light'});await page.goto('/app');
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
 await expect(page.locator('html')).toHaveCSS('color-scheme','dark');
 await page.reload();await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
 await page.goto('/app?workspace=appearance-second-workspace-2026');await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
 await page.setViewportSize({width:320,height:667});
 await expect(page.getByRole('button',{name:'Switch to light mode',exact:true})).toBeInViewport();
 await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.locator('.chat-menu').getByRole('button',{name:/^Appearance/}).click();
 await page.getByRole('radio',{name:'Light',exact:true}).click();await expect(page.locator('.app-shell')).not.toHaveClass(/theme-dark/);
 await page.getByRole('button',{name:'Done',exact:true}).click();await page.reload();
 await expect(page.getByRole('button',{name:'Switch to dark mode',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('textbox',{name:'Message your team'})).toBeInViewport();
});
test('System appearance follows device changes, while an explicit choice overrides them',async({page})=>{
 await isolate(page);await page.emulateMedia({colorScheme:'dark'});await page.goto('/app');
 await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
 await page.getByRole('button',{name:'Appearance',exact:true}).click();
 await expect(page.getByRole('radio',{name:'System',exact:true})).toHaveAttribute('aria-checked','true');
 await page.getByRole('radio',{name:'System',exact:true}).press('ArrowLeft');
 await expect(page.getByRole('radio',{name:'Dark',exact:true})).toHaveAttribute('aria-checked','true');
 await page.emulateMedia({colorScheme:'light'});await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
 await page.getByRole('radio',{name:'System',exact:true}).click();await expect(page.locator('.app-shell')).not.toHaveClass(/theme-dark/);
 await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
 await page.getByRole('button',{name:'Done',exact:true}).click();await page.reload();await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
});
test('a new imported student gets an empty workspace and switching back restores the original student',async({page})=>{
 const originalId='original-student-browser-2026',newId='new-design-student-browser-2026';
 const original={sessionId:originalId,profile:{name:'Rahul',degree:'B.Tech Computer Science',target_degree:'Master Computer Science',countries:'Canada'},documents:[{id:'original-doc',name:'rahul-transcript.txt',size:200,characters:100}],messages:[{id:'original-message',agent:'you',content:'Rahul’s original conversation',time:Date.now()}],opportunities:[],draftDocument:'',facts:[],run:null,activity:[],cursor:0};
 const incoming={...original,sessionId:newId,profile:{name:'Meera',degree:'B.Des. Communication Design',target_degree:'Master Interaction Design',countries:'Finland, Sweden'},documents:[],messages:[],opportunities:[]};
 const summaries=[{sessionId:originalId,name:'Rahul',degree:original.profile.degree,target_degree:original.profile.target_degree,countries:'Canada',opportunities:0},{sessionId:newId,name:'Meera',degree:incoming.profile.degree,target_degree:incoming.profile.target_degree,countries:'Finland, Sweden',opportunities:0}];
 await isolate(page);await page.route('**/api/sessions?*',route=>route.fulfill({json:{students:route.request().url().includes(originalId)?summaries:[summaries[1]]}}));
 for(const state of [original,incoming])await page.route(`**/api/sessions/${state.sessionId}`,route=>route.fulfill({json:state}));
 let creation,uploadedTo;
 await page.route('**/api/documents',async route=>{uploadedTo=route.request().postDataBuffer().toString();incoming.documents=[{id:'new-resume',name:'meera-resume.txt',size:120,characters:100}];return route.fulfill({json:{documents:incoming.documents}});});
 await page.route('**/api/sessions' ,async route=>{creation=route.request().postDataJSON();return route.fulfill({status:201,json:incoming});});
 await page.goto(`/app?workspace=${originalId}`);await expect(page.getByText('Rahul’s original conversation',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Switch student',exact:true}).click();await page.getByRole('button',{name:'New student',exact:true}).click();await page.getByRole('textbox',{name:'New student profile',exact:true}).fill(JSON.stringify(incoming.profile));await page.getByLabel('New student documents',{exact:true}).setInputFiles({name:'meera-resume.txt',mimeType:'text/plain',buffer:Buffer.from('Fictional Meera profile. B.Des. Communication Design.')});await page.getByRole('button',{name:'Create student workspace',exact:true}).click();
 await expect(page).toHaveURL(new RegExp(`workspace=${newId}`));await expect(page.locator('.student-workspace-button')).toContainText('Meera');await expect(page.getByText('Rahul’s original conversation',{exact:true})).not.toBeVisible();expect(creation.previousSessionId).toBe(originalId);expect(uploadedTo).toContain(newId);expect(uploadedTo).not.toContain(originalId);expect(JSON.parse(creation.profileText).target_degree).toBe('Master Interaction Design');await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
 await page.getByRole('button',{name:'Your documents',exact:true}).click();await expect(page.getByText('rahul-transcript.txt',{exact:true})).not.toBeVisible();await expect(page.getByText('meera-resume.txt',{exact:true})).toBeVisible();await page.reload();await expect(page.locator('.student-workspace-button')).toContainText('Meera');
 await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Switch student',exact:true}).click();await page.locator('.saved-student').filter({hasText:'Rahul'}).click();await expect(page.locator('.student-workspace-button')).toContainText('Rahul');await expect(page.getByText('Rahul’s original conversation',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Your documents',exact:true}).click();await expect(page.getByText('rahul-transcript.txt',{exact:true})).toBeVisible();
});
test('a late reply from a previous student cannot overwrite the newly selected student',async({page})=>{
 const first='late-original-student-2026',second='late-new-student-2026';
 const base={documents:[],messages:[welcome],opportunities:[],draftDocument:'',facts:[],run:null,activity:[],cursor:0};
 await isolate(page);
 for(const [id,name]of [[first,'Rahul'],[second,'Meera']])await page.route(`**/api/sessions/${id}`,route=>route.fulfill({json:{...base,sessionId:id,profile:{name,degree:name==='Rahul'?'B.Tech CS':'B.Des. Design'}}}));
 await page.route('**/api/sessions?*',route=>route.fulfill({json:{students:[{sessionId:first,name:'Rahul',opportunities:0},{sessionId:second,name:'Meera',opportunities:0}]}}));
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/chat',async route=>{await gate;try{await route.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify({type:'profile',profile:{name:'OLD STUDENT PRIVATE FACT'}})}\n\ndata: ${JSON.stringify({type:'message',message:{id:'late-message',agent:'arjun',content:'OLD STUDENT PRIVATE FACT',time:Date.now()}})}\n\n`});}catch{/* An aborted request cannot deliver its old response. */}});
 await page.goto(`/app?workspace=${first}`);await expect(page.locator('.student-workspace-button')).toContainText('Rahul');await page.getByRole('textbox',{name:'Message your team'}).fill('Review my studies');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Switch student',exact:true}).click();await page.locator('.saved-student').filter({hasText:'Meera'}).click();release();await expect(page.locator('.student-workspace-button')).toContainText('Meera');await page.waitForTimeout(200);await expect(page.getByText('OLD STUDENT PRIVATE FACT',{exact:true})).not.toBeVisible();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeEnabled();await expect(page.getByRole('button',{name:'Stop responding',exact:true})).not.toBeVisible();
});

test('deleting another student requires confirmation, handles rejection and removes the saved bookmark',async({page})=>{
 const current='delete-current-student-2026',other='delete-other-student-2026';
 const base={documents:[],messages:[welcome],opportunities:[],draftDocument:'',facts:[],run:null,activity:[],cursor:0};
 let removed=false,rejectDelete=true,deletes=0;
 await isolate(page);
 await page.route(`**/api/sessions/${current}`,route=>route.fulfill({json:{...base,sessionId:current,profile:{name:'Rahul',degree:'B.Tech CS'}}}));
 await page.route('**/api/sessions?*',route=>route.fulfill({json:{students:[{sessionId:current,name:'Rahul',opportunities:0},...removed?[]:[{sessionId:other,name:'Meera',opportunities:0}]],deletedIds:removed?[other]:[]}}));
 await page.route(`**/api/sessions/${other}`,route=>{deletes++;if(rejectDelete)return route.fulfill({status:409,json:{error:'Wait for the current reply to finish before deleting this student.'}});removed=true;return route.fulfill({json:{deleted:true,sessionId:other}});});
 await page.goto(`/app?workspace=${current}`);await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Switch student',exact:true}).click();
 await page.setViewportSize({width:320,height:667});await page.getByRole('button',{name:'Delete Meera',exact:true}).click();await expect(page.getByRole('heading',{name:'Delete Meera?',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel deletion'}).click();expect(deletes).toBe(0);
 await page.getByRole('button',{name:'Delete Meera',exact:true}).click();await page.getByRole('button',{name:'Delete student permanently'}).click();await expect(page.locator('.student-error')).toContainText('Wait for the current reply');
 rejectDelete=false;await page.getByRole('button',{name:'Delete student permanently'}).click();await expect(page.getByRole('button',{name:'Delete Meera',exact:true})).toHaveCount(0);await expect(page.locator('.student-workspace-button')).toContainText('Rahul');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Switch student',exact:true}).click();await expect(page.getByRole('button',{name:'Delete Meera',exact:true})).toHaveCount(0);
});

test('deleting the active and last student opens a safe remaining or fresh workspace',async({page})=>{
 const first='delete-active-first-2026',second='delete-active-second-2026';
 const deleted=new Set(),students=[{sessionId:first,name:'Rahul',opportunities:0},{sessionId:second,name:'Meera',opportunities:0}];
 await isolate(page);
 await page.route('**/api/sessions?*',route=>route.fulfill({json:{students:students.filter(s=>!deleted.has(s.sessionId)),deletedIds:[...deleted]}}));
 for(const student of students)await page.route(`**/api/sessions/${student.sessionId}`,route=>{if(route.request().method()==='DELETE'){deleted.add(student.sessionId);return route.fulfill({json:{deleted:true,sessionId:student.sessionId}});}return route.fulfill({json:{sessionId:student.sessionId,profile:{name:student.name,degree:'B.Des'},documents:[],messages:[{id:'private-'+student.sessionId,agent:'arjun',content:student.name+' private conversation',time:Date.now()}],opportunities:[],draftDocument:'',facts:[],run:null,activity:[],cursor:0}});});
 await page.goto(`/app?workspace=${first}`);
 for(const [name,next]of [['Rahul','Meera'],['Meera',null]]){
  await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Switch student',exact:true}).click();await page.getByRole('button',{name:'Delete '+name,exact:true}).click();await page.getByRole('button',{name:'Delete student permanently'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByText(name+' private conversation',{exact:true})).toHaveCount(0);
  if(next)await expect(page.locator('.student-workspace-button')).toContainText(next);else{await expect(page.locator('.student-workspace-button')).toContainText('Your journey');expect(new URL(page.url()).searchParams.get('workspace')).not.toBe(second);}
 }
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tetranoodle.students.v1')||'[]').some(s=>['delete-active-first-2026','delete-active-second-2026'].includes(s.sessionId)))).toBe(false);
});

test('provider limit events notify the user with the agent and key setting',async({page})=>{
 await isolate(page,{messages:[welcome]});const label='Groq limit reached for Sage: tokens per day on openai/gpt-oss-120b. Key setting: GROQ_API_KEY_SAGE. Your progress is saved.';
 await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify({type:'activity',agent:'sage',limitReached:true,limitType:'tokens per day',keySetting:'GROQ_API_KEY_SAGE',label})}\n\ndata: ${JSON.stringify({type:'done'})}\n\n`}));
 await page.goto('/app');await page.getByRole('textbox',{name:'Message your team'}).fill('Check the saved evidence');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Groq limit reached for Sage');await expect(page.getByRole('alert')).toContainText('GROQ_API_KEY_SAGE');
 await page.getByRole('button',{name:'Dismiss notification'}).click();await page.getByRole('button',{name:'Group details',exact:true}).click();await expect(page.locator('.activity-log')).toContainText(label);
});

test('opening a deleted student URL clears stale browser data and starts a fresh workspace',async({page})=>{
 const id='deleted-url-student-2026';
 await isolate(page);await page.addInitScript(id=>localStorage.setItem('tetranoodle.workspace.v1',JSON.stringify({sessionId:id,profile:{name:'Deleted private name'},messages:[{id:'old-private',agent:'arjun',content:'DELETED PRIVATE FACTS',time:Date.now()}],documents:[{id:'old-file',name:'deleted-private-transcript.txt'}]})),id);
 await page.route(`**/api/sessions/${id}`,route=>route.fulfill({status:410,json:{error:'This student workspace was deleted.'}}));
 await page.goto(`/app?workspace=${id}`);await expect(page).not.toHaveURL(new RegExp(id));await expect(page.locator('.student-workspace-button')).toContainText('Your journey');await expect(page.getByText('DELETED PRIVATE FACTS',{exact:true})).toHaveCount(0);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tetranoodle.workspace.v1')));expect(saved.profile.name).toBeUndefined();expect(saved.documents).toEqual([]);
});

test('starting with an incomplete profile opens Arjun intake in chat instead of the profile form',async({page})=>{
 await isolate(page,{messages:[welcome],profile:{name:'Fictional student'}});
 let requested;await page.route('**/api/research',route=>{requested=route.request().postDataJSON();return route.fulfill({status:202,json:{run:{status:'needs_input',stage:'profile',progress:5,message:'Arjun is waiting for your current studies.'}}});});
 await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:[{type:'profile',profile:{name:'Fictional student',degree:'B.Sc Biology'}},{type:'message',message:{id:'intake-next',agent:'arjun',content:'Thanks, I’ve saved your current studies. What degree and subject would you like to pursue next?',time:Date.now()}},{type:'done'}].map(e=>`data: ${JSON.stringify(e)}\n\n`).join('')}));
 await page.goto('/app');await page.getByRole('button',{name:'Start scholarship research',exact:true}).click();await expect.poll(()=>requested?.mode).toBe('research');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.run-strip strong')).toHaveText('A little more context is needed');
 await page.getByRole('textbox',{name:'Message your team'}).fill('B.Sc Biology');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.locator('#message-intake-next')).toContainText('Arjun');await expect(page.locator('#message-intake-next')).toContainText('What degree and subject');
});
