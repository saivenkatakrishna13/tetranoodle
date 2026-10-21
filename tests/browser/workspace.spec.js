import {test,expect}from'@playwright/test';
const welcome={id:'welcome',agent:'mira',content:'Welcome. What are you studying?',time:Date.now()};
async function isolate(page,overrides={}){
 await page.route('**/api/sessions/*',async route=>{
  if(route.request().method()==='GET'&&!route.request().url().includes('/events'))return route.fulfill({json:{sessionId:'browser-fixture-session',profile:{},documents:[],opportunities:[],messages:[],draftDocument:'',facts:[],run:null,activity:[],cursor:0,...overrides}});
  return route.continue();
 });
 // Keep test event feeds controlled and offline so tests never use Groq quota.
 await page.route('**/api/sessions/*/events?*',route=>route.fulfill({contentType:'text/event-stream',body:': connected\n\n'}));
}
test('desktop and phone show WhatsApp-style chat, working search, and group details',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await isolate(page);await page.goto('/');
 await expect(page.getByRole('heading',{name:'Scholarship squad',exact:true}).first()).toBeVisible();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();
 await page.getByRole('button',{name:'Search messages',exact:true}).click();await page.getByRole('textbox',{name:'Search messages',exact:true}).fill('impossible match');await expect(page.getByText('No messages match “impossible match”.')).toBeVisible();
 await page.getByRole('button',{name:'Close search'}).click();await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Group details',exact:true}).click();await expect(page.getByText('Group info',{exact:true})).toBeVisible();await expect(page.getByText('6 participants',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close details'}).click();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('streamed replies persist, messages can be starred and quoted, provider errors stay readable',async({page})=>{
 const serverState={messages:[]};await isolate(page,serverState);await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:[{type:'profile',profile:{name:'Rahul',degree:'B.Tech Computer Science',cgpa:'8.2 / 10'}},{type:'message',message:{id:'arjun-reply',agent:'arjun',content:'Thanks Rahul. I’ll keep your CGPA on its original scale.',time:Date.now()}},{type:'done'}].map(e=>`data: ${JSON.stringify(e)}\n\n`).join('')}));
 await page.goto('/');await page.getByRole('textbox',{name:'Message your team'}).fill('I am Rahul, B.Tech CS, CGPA 8.2 / 10.');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByText('Thanks Rahul. I’ll keep your CGPA on its original scale.',{exact:true})).toBeVisible();
 const bubble=page.locator('#message-arjun-reply');await bubble.hover();await bubble.getByRole('button',{name:'Star message',exact:true}).click();await expect(bubble.getByRole('button',{name:'Unstar message',exact:true})).toBeAttached();
 await bubble.hover();await bubble.getByRole('button',{name:'Reply to message'}).click();await expect(page.locator('.reply-preview')).toContainText('Arjun');await page.getByRole('button',{name:'Cancel reply'}).click();
 serverState.messages=[{id:'arjun-reply',agent:'arjun',content:'Thanks Rahul. I’ll keep your CGPA on its original scale.',time:Date.now()}];
 await page.reload();await expect(page.getByText('Thanks Rahul. I’ll keep your CGPA on its original scale.',{exact:true})).toBeVisible();
 await page.unroute('**/api/chat');await page.route('**/api/chat',route=>route.fulfill({status:503,json:{error:'Provider unavailable. Please retry.'}}));
 await page.getByRole('textbox',{name:'Message your team'}).fill('Germany');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByText('Provider unavailable. Please retry.',{exact:true})).toBeVisible();
});
test('long conversations scroll while header and composer remain fixed on desktop, phone and landscape',async({page})=>{
 const messages=Array.from({length:35},(_,i)=>({id:`long-${i}`,agent:['mira','arjun','nova','sage','leo'][i%5],content:`Message ${i+1}. `+'A longer research finding with requirements, funding details, and next steps. '.repeat(12),time:Date.now()}));
 await isolate(page,{messages});await page.goto('/');
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
 await isolate(page,{opportunities:[opportunity],draftDocument:'# DRAFT\n\nA student-specific draft with [project details].'});await page.goto('/');await page.getByRole('button',{name:'Your matches',exact:true}).click();await expect(page.getByRole('heading',{name:'MSc Computing',exact:true})).toBeVisible();
 await page.getByText('Eligibility & missing information',{exact:true}).click();await expect(page.getByText('English test result',{exact:true})).toBeVisible();await page.getByText('How to apply',{exact:true}).click();await expect(page.getByText('Complete the official application.',{exact:true})).toBeVisible();
 await page.getByText('Source evidence & research priority',{exact:true}).click();await expect(page.getByText('Applicants need IELTS overall 6.5.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Applications',exact:true}).click();await expect(page.getByRole('button',{name:'Download draft',exact:true})).toBeVisible();
});
test('invalid uploads report a readable error',async({page})=>{
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'scan.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a valid PDF')});await expect(page.getByRole('alert')).toContainText('could not be read');
});
test('appearance is accessible on phones and persists across reloads and workspaces',async({page})=>{
 await isolate(page);await page.emulateMedia({colorScheme:'light'});await page.goto('/');
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
 await expect(page.locator('html')).toHaveCSS('color-scheme','dark');
 await page.reload();await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
 await page.goto('/?workspace=appearance-second-workspace-2026');await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
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
 await isolate(page);await page.emulateMedia({colorScheme:'dark'});await page.goto('/');
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
 await page.goto(`/?workspace=${originalId}`);await expect(page.getByText('Rahul’s original conversation',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Switch student',exact:true}).click();await page.getByRole('button',{name:'New student',exact:true}).click();await page.getByRole('textbox',{name:'New student profile',exact:true}).fill(JSON.stringify(incoming.profile));await page.getByLabel('New student documents',{exact:true}).setInputFiles({name:'meera-resume.txt',mimeType:'text/plain',buffer:Buffer.from('Fictional Meera profile. B.Des. Communication Design.')});await page.getByRole('button',{name:'Create student workspace',exact:true}).click();
 await expect(page).toHaveURL(new RegExp(`workspace=${newId}`));await expect(page.locator('.student-workspace-button')).toContainText('Meera');await expect(page.getByText('Rahul’s original conversation',{exact:true})).not.toBeVisible();expect(creation.previousSessionId).toBe(originalId);expect(uploadedTo).toContain(newId);expect(uploadedTo).not.toContain(originalId);expect(JSON.parse(creation.profileText).target_degree).toBe('Master Interaction Design');await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
 await page.getByRole('button',{name:'Your documents',exact:true}).click();await expect(page.getByText('rahul-transcript.txt',{exact:true})).not.toBeVisible();await expect(page.getByText('meera-resume.txt',{exact:true})).toBeVisible();await page.reload();await expect(page.locator('.student-workspace-button')).toContainText('Meera');
 await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Switch student',exact:true}).click();await page.locator('.saved-student').filter({hasText:'Rahul'}).click();await expect(page.locator('.student-workspace-button')).toContainText('Rahul');await expect(page.getByText('Rahul’s original conversation',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Your documents',exact:true}).click();await expect(page.getByText('rahul-transcript.txt',{exact:true})).toBeVisible();
});
test('a late reply from a previous student cannot overwrite the newly selected student',async({page})=>{
 const first='late-original-student-2026',second='late-new-student-2026';
 const base={documents:[],messages:[],opportunities:[],draftDocument:'',facts:[],run:null,activity:[],cursor:0};
 await isolate(page);
 for(const [id,name]of [[first,'Rahul'],[second,'Meera']])await page.route(`**/api/sessions/${id}`,route=>route.fulfill({json:{...base,sessionId:id,profile:{name,degree:name==='Rahul'?'B.Tech CS':'B.Des. Design'}}}));
 await page.route('**/api/sessions?*',route=>route.fulfill({json:{students:[{sessionId:first,name:'Rahul',opportunities:0},{sessionId:second,name:'Meera',opportunities:0}]}}));
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/chat',async route=>{await gate;try{await route.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify({type:'profile',profile:{name:'OLD STUDENT PRIVATE FACT'}})}\n\ndata: ${JSON.stringify({type:'message',message:{id:'late-message',agent:'arjun',content:'OLD STUDENT PRIVATE FACT',time:Date.now()}})}\n\n`});}catch{/* An aborted request cannot deliver its old response. */}});
 await page.goto(`/?workspace=${first}`);await expect(page.locator('.student-workspace-button')).toContainText('Rahul');await page.getByRole('textbox',{name:'Message your team'}).fill('Review my studies');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.getByRole('button',{name:'Switch student',exact:true}).click();await page.locator('.saved-student').filter({hasText:'Meera'}).click();release();await expect(page.locator('.student-workspace-button')).toContainText('Meera');await page.waitForTimeout(200);await expect(page.getByText('OLD STUDENT PRIVATE FACT',{exact:true})).not.toBeVisible();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeEnabled();await expect(page.getByRole('button',{name:'Stop responding',exact:true})).not.toBeVisible();
});
