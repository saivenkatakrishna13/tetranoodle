import {test,expect} from '@playwright/test';
const id='landing-browser-fictional-student';
async function fixture(page,{events=[]}={}){
 const state={sessionId:id,profile:{name:'Fictional Student',degree:'B.Tech Computer Science',target_degree:'Master of Computer Science',countries:'Germany'},messages:[{id:'landing-welcome',agent:'mira',content:'Your saved research is ready for review.',time:Date.now()}],documents:[{id:'resume',name:'fictional-resume.txt',size:100,characters:100}],opportunities:[],draftDocument:'# Application draft\nA fictional UI validation draft.',facts:[],run:{status:'partial',stage:'done',progress:90,coverage:{ready:0}},activity:[],cursor:0};
 await page.route('**/api/status',route=>route.fulfill({json:{live:true,provider:'Groq'}}));
 await page.route(`**/api/sessions/${id}`,route=>route.fulfill({json:state}));
 await page.route(`**/api/sessions/${id}/events?*`,route=>route.fulfill({contentType:'text/event-stream',body:events.map(event=>`data: ${JSON.stringify(event)}\n\n`).join('')||': connected\n\n'}));
 return state;
}

test('landing is first, uses the supplied sections, and never starts research',async({page})=>{
 const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/api/'))requests.push(request.url());});
 await page.goto('/');await expect(page.getByRole('heading',{name:'Scholarships, sourced. Not guessed.'})).toBeVisible();
 await expect(page.locator('.landing-agent-card')).toHaveCount(5);await expect(page.getByRole('region',{name:'Example failure recovery workflow'})).toBeAttached();
 await page.getByRole('link',{name:'How it works',exact:true}).click();await expect(page.getByRole('heading',{name:'A swarm, not a chatbot.'})).toBeInViewport();
 expect(requests).toEqual([]);expect(errors).toEqual([]);
 await page.emulateMedia({colorScheme:'dark'});
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await expect(page.locator('.scholar-landing')).toHaveAttribute('data-theme','dark');
 await page.reload();
 await expect(page.locator('.scholar-landing')).toHaveAttribute('data-theme','light');
 expect(await page.evaluate(()=>localStorage.getItem('tetranoodle.appearance.v1'))).toBe('dark');
});

test('launch and Home preserve workspace, unsent chat, tabs, resume research, and shared appearance',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});await fixture(page);let resumes=0;
 await page.route('**/api/research',route=>{resumes++;expect(route.request().postDataJSON()).toMatchObject({sessionId:id,resume:true});return route.fulfill({status:202,json:{run:{status:'running',stage:'verify',progress:40}}});});
 await page.goto(`/?workspace=${id}`);await expect(page.locator('.scholar-landing')).toHaveAttribute('data-theme','light');
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
 await page.getByRole('link',{name:'Launch app',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/app\\?workspace=${id}$`));
 await expect(page.locator('.scholar-landing')).toHaveCount(0);await expect(page.locator('.landing-canvas')).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();await expect(page.locator('.main-panel')).toHaveCSS('background-color','rgb(244, 240, 232)');
 await page.getByRole('textbox',{name:'Message your team'}).fill('Keep this unsent question.');
 await page.getByRole('link',{name:'Home',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/\\?workspace=${id}$`));
 await expect(page.locator('.scholar-landing')).toBeVisible();await expect(page.getByRole('textbox',{name:'Message your team'})).not.toBeVisible();
 await page.getByRole('link',{name:'Meet your team',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message your team'})).toHaveValue('Keep this unsent question.');
 await page.getByRole('button',{name:'Documents',exact:true}).click();await expect(page.getByText('fictional-resume.txt',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Matches',exact:true}).click();await expect(page.getByRole('heading',{name:'Your next possibilities',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Applications',exact:true}).click();await expect(page.locator('.application-paper')).toContainText('A fictional UI validation draft.');
 await page.getByRole('button',{name:'Group chat',exact:true}).click();await page.getByRole('button',{name:'Resume research',exact:true}).click();expect(resumes).toBe(1);
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await page.getByRole('link',{name:'Home',exact:true}).click();await expect(page.locator('.scholar-landing')).toHaveAttribute('data-theme','dark');
 await page.goBack();await expect(page.locator('.scholar-landing')).toHaveCount(0);await expect(page.getByRole('textbox',{name:'Message your team'})).toHaveValue('Keep this unsent question.');
});

test('Three scene animates, disposes tags and context on launch, and can be entered again',async({page})=>{
 await fixture(page);await page.goto(`/?workspace=${id}`);await expect(page.locator('.scholar-landing')).toHaveAttribute('data-scene','webgl');
 await expect(page.locator('.landing-tag')).toHaveCount(5);
 const canvas=page.locator('.landing-canvas');const initial=Number(await canvas.getAttribute('data-frames'));
 await expect.poll(async()=>Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(initial+2);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const hiddenFrames=await canvas.getAttribute('data-frames');await page.waitForTimeout(160);expect(await canvas.getAttribute('data-frames')).toBe(hiddenFrames);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(async()=>Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(Number(hiddenFrames));
 await page.evaluate(()=>{window.__landingCanvas=document.querySelector('.landing-canvas');window.__landingCanvas.addEventListener('webglcontextlost',()=>window.__contextDisposed=true);});
 await page.getByRole('link',{name:'Launch app',exact:true}).click();await expect(page.locator('.landing-tag')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__contextDisposed)).toBe(true);
 const stopped=await page.evaluate(()=>window.__landingCanvas.dataset.frames);await page.waitForTimeout(180);expect(await page.evaluate(()=>window.__landingCanvas.dataset.frames)).toBe(stopped);
 await page.getByRole('link',{name:'Home',exact:true}).click();await expect(page.locator('.landing-tag')).toHaveCount(5);
 await expect(page.getByRole('button',{name:/^(Pause|Resume) landing animation$/})).toHaveCount(0);
 const resumed=Number(await canvas.getAttribute('data-frames'));await expect.poll(async()=>Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(resumed+2);
});

test('reduced motion stays still and all landing content remains accessible on a phone',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:667});await page.goto('/');
 await expect(page.locator('.scholar-landing')).toHaveAttribute('data-scene','static');
 const canvas=page.locator('.landing-canvas');await page.waitForTimeout(180);const frames=await canvas.getAttribute('data-frames');await page.waitForTimeout(180);expect(await canvas.getAttribute('data-frames')).toBe(frames);
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:844});expect(await page.locator('.scholar-landing').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
 await page.setViewportSize({width:320,height:667});const launch=page.getByRole('link',{name:'Start with ScholarX',exact:true});await launch.scrollIntoViewIfNeeded();await expect(launch).toBeInViewport();await expect(page.locator('.landing-log-line.is-visible')).toHaveCount(7);
});

test('missing WebGL falls back to readable content and working Launch',async({page})=>{
 await fixture(page);await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type.includes('webgl'))return null;return original.call(this,type,...args);};});
 await page.goto(`/?workspace=${id}`);await expect(page.locator('.scholar-landing')).toHaveAttribute('data-scene','fallback');await expect(page.getByRole('heading',{name:'Scholarships, sourced. Not guessed.'})).toBeVisible();
 await page.getByRole('link',{name:'Launch app',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();
});

test('real event bridge highlights Nova and dims an interrupted run without fake activity',async({page})=>{
 await fixture(page,{events:[{type:'run',run:{status:'running',stage:'discover'}},{type:'typing',agent:'nova'}]});
 await page.goto(`/app?workspace=${id}`);await expect(page.locator('.typing-bubble')).toContainText('Nova');await page.getByRole('link',{name:'Home',exact:true}).click();
 await expect(page.locator('.landing-canvas')).toHaveAttribute('data-agent','nova');await expect(page.locator('.landing-tag[data-active=true]')).toHaveCount(1);await expect(page.locator('.landing-tag[data-active=true]')).toHaveAttribute('data-agent','nova');
 await page.getByRole('link',{name:'Launch app',exact:true}).click();
 // Feed the actual UI event ingress on a fresh browser navigation.
 await page.route(`**/api/sessions/${id}/events?*`,route=>route.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify({type:'run',run:{status:'interrupted',stage:'discover'}})}\n\n`}));
 await page.reload();await expect(page.locator('.run-strip strong')).toContainText('Research paused or interrupted');await page.getByRole('link',{name:'Home',exact:true}).click();
 await expect(page.locator('.landing-canvas')).toHaveAttribute('data-run','interrupted');await expect(page.locator('.landing-scene-caption')).toContainText('research interrupted');
});
