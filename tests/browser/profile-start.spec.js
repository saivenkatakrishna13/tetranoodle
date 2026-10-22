import {test,expect} from '@playwright/test';
const id='profile-first-browser-2026';
async function fresh(page){
 const state={sessionId:id,profile:{},documents:[],messages:[],opportunities:[],draftDocument:'',facts:[],run:null,activity:[],cursor:0};
 const calls=[];
 await page.route('**/api/status',route=>route.fulfill({json:{live:true,provider:'Groq',agents:{mira:true,arjun:true,nova:true,sage:true,leo:true},scrapling:true}}));
 await page.route(`**/api/sessions/${id}`,route=>route.fulfill({json:state}));
 await page.route(`**/api/sessions/${id}/events?*`,route=>route.fulfill({contentType:'text/event-stream',body:': connected\n\n'}));
 await page.route(`**/api/sessions/${id}/profile`,route=>{calls.push({step:'profile',profile:route.request().postDataJSON()});state.profile=route.request().postDataJSON();return route.fulfill({json:{...state,changed:true}});});
 await page.route('**/api/documents',route=>{calls.push({step:'documents',body:route.request().postDataBuffer().toString()});state.documents=[{id:'fixture-resume',name:'resume.txt',size:40,characters:40}];return route.fulfill({json:{documents:state.documents}});});
 await page.route('**/api/research',route=>{calls.push({step:'research',body:route.request().postDataJSON()});state.run={status:state.profile.degree&&state.profile.target_degree&&state.profile.countries?'running':'needs_input',stage:'profile',progress:5,passStartedAt:Date.now()};return route.fulfill({status:202,json:{run:state.run}});});
 await page.goto(`/app?workspace=${id}`);await expect(page.getByRole('heading',{name:'Tell us your story.',exact:true})).toBeVisible();
 return {calls,state};
}

test('manual profile and documents save before research begins, with missing fields left for Arjun',async({page})=>{
 const {calls}=await fresh(page);await expect(page.locator('.profile-start-fields input')).toHaveCount(14);
 await page.locator('.profile-start-fields input[name=name]').fill('Fictional Design Student');await page.locator('.profile-start-fields input[name=degree]').fill('B.Des Communication Design');await page.locator('.profile-start-fields input[name=target_degree]').fill('Master of Interaction Design');await page.locator('.profile-start-fields input[name=countries]').fill('Finland, Sweden');await page.locator('.profile-start-fields input[name=cgpa]').fill('8.6 / 10');
 expect(calls).toEqual([]);await page.getByLabel('Profile supporting documents').setInputFiles({name:'resume.txt',mimeType:'text/plain',buffer:Buffer.from('Fictional design student resume for testing.')});
 await page.getByRole('button',{name:'Save profile & find opportunities',exact:true}).click();
 await expect(page.locator('.profile-start-form')).toHaveCount(0);expect(calls.map(c=>c.step)).toEqual(['profile','documents','research']);expect(calls[0].profile).toMatchObject({degree:'B.Des Communication Design',countries:'Finland, Sweden',cgpa:'8.6 / 10'});expect(calls[2].body.sessionId).toBe(id);await expect(page.getByRole('textbox',{name:'Message your team'})).toBeInViewport();
});

test('an incomplete manual form can continue to Arjun without inventing the missing fields',async({page})=>{
 const {calls}=await fresh(page);await page.locator('.profile-start-fields input[name=degree]').fill('B.Sc Biology');await page.getByRole('button',{name:'Save profile & continue with Arjun',exact:true}).click();
 await expect(page.locator('.run-strip strong')).toHaveText('A little more context is needed');expect(calls[0].profile.degree).toBe('B.Sc Biology');expect(calls[0].profile.countries).toBeUndefined();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();
});
test('a subject alone does not appear ready for research',async({page})=>{
 await fresh(page);await page.locator('input[name=degree]').fill('B.Tech Computer Science');await page.locator('input[name=target_degree]').fill('cse');await page.locator('input[name=countries]').fill('Canada');
 await expect(page.getByText('2/3 search essentials shared',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save profile & continue with Arjun',exact:true})).toBeVisible();
 await page.locator('input[name=target_degree]').fill('Master’s in Computer Science / AI');await expect(page.getByText('3/3 search essentials shared',{exact:true})).toBeVisible();
});

test('ambient motion continues while editing, with no pause button or legacy pause preference',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('scholarx.motion.paused','true'));
 await fresh(page);const field=page.locator('.ambient-field');await expect(field).toHaveAttribute('data-renderer','canvas');
 const canvas=field.locator('canvas'),frames=Number(await canvas.getAttribute('data-frames'));await expect.poll(async()=>Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(frames+3);
 expect(await field.evaluate(element=>getComputedStyle(element).pointerEvents)).toBe('none');await expect(page.locator('.interactive-atlas')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/^(Pause|Resume) background animation$/})).toHaveCount(0);
 await expect(field).toHaveAttribute('data-motion','active');
 const editingFrames=Number(await canvas.getAttribute('data-frames'));
 await page.locator('.profile-start-fields input[name=name]').fill('Still editable');await expect(page.locator('.profile-start-fields input[name=name]')).toHaveValue('Still editable');
 await expect.poll(async()=>Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(editingFrames+3);
});

test('reduced motion uses static filaments and the profile remains readable and scrollable on a phone',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:667});await fresh(page);await expect(page.locator('.ambient-field')).toHaveAttribute('data-renderer','static');await expect(page.locator('.scholar-atmosphere canvas')).toHaveCount(0);
 await page.locator('.profile-start-fields input[name=degree]').fill('B.Sc Biology');await expect(page.locator('.profile-start-fields input[name=degree]')).toHaveValue('B.Sc Biology');await expect(page.getByRole('button',{name:'Switch to dark mode',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Save profile & continue with Arjun',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Save profile & continue with Arjun',exact:true})).toBeInViewport();
});

test('a browser without Canvas gets a working static profile screen',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='2d'||type==='webgl2'||type==='webgl'||type==='experimental-webgl')return null;return original.call(this,type,...args);};});
 await fresh(page);await expect(page.locator('.ambient-field')).toHaveAttribute('data-renderer','static');await page.locator('.profile-start-fields input[name=name]').fill('Accessible without Canvas');expect(errors).toEqual([]);await expect(page.locator('.profile-start-fields input[name=name]')).toHaveValue('Accessible without Canvas');
});

test('the existing sidebar start button submits the manual form without dropping entered values',async({page})=>{
 const {calls}=await fresh(page);await page.locator('.profile-start-fields input[name=degree]').fill('B.Tech Computer Science');await page.getByRole('button',{name:'Start scholarship research',exact:true}).click();await expect(page.locator('.run-strip strong')).toHaveText('A little more context is needed');expect(calls[0].profile.degree).toBe('B.Tech Computer Science');expect(calls.map(c=>c.step)).toEqual(['profile','research']);
});


test('intake, original score scale and funding need save through the manual profile form',async({page})=>{
 const {calls}=await fresh(page);
 await page.locator('select[name=intake_term]').selectOption('Summer');
 await page.locator('input[name=intake]').fill('2027');
 await page.locator('input[name=graduation]').fill('May 2027');
 await page.locator('input[name=cgpa]').fill('3.5');
 await page.locator('select[name=cgpa_scale]').selectOption('4');
 await page.locator('select[name=funding_need]').selectOption('full');
 await page.locator('input[name=budget]').fill('USD 5000 per year');
 await page.getByRole('button',{name:'Save profile & continue with Arjun',exact:true}).click();
 expect(calls[0].profile).toMatchObject({intake:'2027',intake_term:'Summer',graduation:'May 2027',cgpa:'3.5 / 4',cgpa_scale:'4',funding_need:'full',budget:'USD 5000 per year'});
});
