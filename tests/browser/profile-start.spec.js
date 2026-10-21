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
 await page.goto(`/?workspace=${id}`);await expect(page.getByRole('heading',{name:'Tell us your story.',exact:true})).toBeVisible();
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

test('the WebGL atlas rotates, resets, and allows animation to be paused without changing the form',async({page})=>{
 await fresh(page);const atlas=page.locator('.interactive-atlas');await expect(atlas).toHaveAttribute('data-renderer','webgl',{timeout:20000});
 const stage=page.getByRole('button',{name:/Interactive scholarship atlas/}),box=await stage.boundingBox();const canvas=atlas.locator('canvas');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+65,box.y+box.height/2+20,{steps:5});await page.mouse.up();await expect(canvas).not.toHaveAttribute('data-rotation','0.00,0.00');
 await page.getByRole('button',{name:'Pause background animation',exact:true}).click();await expect(atlas).toHaveAttribute('data-motion','still');await page.getByRole('button',{name:'Reset 3D view',exact:true}).click();await expect(canvas).toHaveAttribute('data-rotation','0.00,0.00');
 await page.locator('.profile-start-fields input[name=name]').fill('Still editable');await expect(page.locator('.profile-start-fields input[name=name]')).toHaveValue('Still editable');await page.getByRole('button',{name:'Resume background animation',exact:true}).click();await expect(atlas).toHaveAttribute('data-motion','active');
});

test('reduced motion uses the static atlas and the profile remains readable and scrollable on a phone',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:667});await fresh(page);await expect(page.locator('.interactive-atlas')).toHaveAttribute('data-renderer','static');await expect(page.locator('.scholar-atmosphere canvas')).toHaveCount(0);
 await page.locator('.profile-start-fields input[name=degree]').fill('B.Sc Biology');await expect(page.locator('.profile-start-fields input[name=degree]')).toHaveValue('B.Sc Biology');await expect(page.getByRole('button',{name:'Switch to dark mode',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Save profile & continue with Arjun',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Save profile & continue with Arjun',exact:true})).toBeInViewport();
});

test('a browser without WebGL gets a working static profile screen',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'||type==='webgl'||type==='experimental-webgl')return null;return original.call(this,type,...args);};});
 await fresh(page);await expect(page.locator('.interactive-atlas')).toHaveAttribute('data-renderer','static');await page.locator('.profile-start-fields input[name=name]').fill('Accessible without WebGL');expect(errors).toEqual([]);await expect(page.locator('.profile-start-fields input[name=name]')).toHaveValue('Accessible without WebGL');
});

test('the existing sidebar start button submits the manual form without dropping entered values',async({page})=>{
 const {calls}=await fresh(page);await page.locator('.profile-start-fields input[name=degree]').fill('B.Tech Computer Science');await page.getByRole('button',{name:'Start scholarship research',exact:true}).click();await expect(page.locator('.run-strip strong')).toHaveText('A little more context is needed');expect(calls[0].profile.degree).toBe('B.Tech Computer Science');expect(calls.map(c=>c.step)).toEqual(['profile','research']);
});
