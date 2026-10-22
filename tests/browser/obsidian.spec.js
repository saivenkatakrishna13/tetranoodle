import {test,expect} from '@playwright/test';

const id='obsidian-design-browser-fixture';
async function workspace(page,{profileFirst=false,events=[]}={}){
 const state={sessionId:id,profile:{},messages:profileFirst?[]:[{id:'welcome',agent:'mira',content:'Your research team is ready.',time:Date.now()}],documents:[],opportunities:[],draftDocument:'',facts:[],run:null,activity:[],cursor:0};
 await page.route('**/api/status',route=>route.fulfill({json:{live:true,provider:'Groq',agents:{mira:true,arjun:true,nova:true,sage:true,leo:true}}}));
 await page.route(`**/api/sessions/${id}`,route=>route.fulfill({json:state}));
 await page.route(`**/api/sessions/${id}/events?*`,route=>route.fulfill({contentType:'text/event-stream',body:events.length?events.map(event=>`data: ${JSON.stringify(event)}\n\n`).join(''):': connected\n\n'}));
 await page.goto(`/app?workspace=${id}`);return state;
}

test('gold design preserves readable profiles, themes, and form access across desktop, tablet and phone',async({page})=>{
 await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await workspace(page,{profileFirst:true});
 await expect(page.locator('.main-panel')).toHaveCSS('background-color','rgb(9, 10, 12)');
 for(const width of [1600,1280,1024,768,390,320]){
  await page.setViewportSize({width,height:width<700?844:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`horizontal overflow at ${width}`).toBe(true);
  const fields=page.locator('.profile-start-fields input');await expect(fields).toHaveCount(14);
  for(const name of ['name','degree','target_degree','countries','budget','public_profiles']){
   const field=page.locator(`.profile-start-fields input[name=${name}]`);await field.scrollIntoViewIfNeeded();await expect(field).toBeInViewport();
   const box=await field.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
  }
 }
 await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();await expect(page.locator('.main-panel')).toHaveCSS('background-color','rgb(244, 240, 232)');
 await expect(page.locator('.ambient-field')).toHaveAttribute('data-renderer','static');await expect(page.locator('.interactive-atlas')).toHaveCount(0);
});

test('ambient rendering pauses while hidden and uses bounded resolution',async({page})=>{
 await workspace(page,{profileFirst:true});const field=page.locator('.ambient-field'),canvas=field.locator('canvas');await expect(field).toHaveAttribute('data-renderer','canvas');
 const size=await canvas.evaluate(element=>({pixels:element.width,width:element.getBoundingClientRect().width}));expect(size.pixels).toBeLessThanOrEqual(Math.ceil(size.width*1.4));
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__testHidden||false});window.__testHidden=true;document.dispatchEvent(new Event('visibilitychange'));});
 const count=await canvas.getAttribute('data-frames');await page.waitForTimeout(200);expect(await canvas.getAttribute('data-frames')).toBe(count);
 await page.evaluate(()=>{window.__testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(async()=>Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(Number(count)+2);
});

test('only actual agent events activate the collaboration diagram',async({page})=>{
 const now=Date.now();await workspace(page,{events:[{type:'run',run:{status:'running',stage:'verify',passStartedAt:now}},{type:'activity',agent:'sage',time:now,label:'Checking an official source.'},{type:'typing',agent:'sage'}]});
 await expect(page.locator('.agent-constellation')).toHaveAttribute('data-active-agent','sage');await expect(page.locator('.constellation-node.is-working')).toHaveCount(1);
 await expect(page.locator('.constellation-node')).toHaveCount(5);await expect(page.locator('.ambient-field')).toHaveAttribute('data-research','active');
 await expect(page.getByRole('textbox',{name:'Message your team'})).toBeInViewport();
});

test('dialogs keep keyboard focus and return it after the exit transition',async({page})=>{
 await workspace(page);const opener=page.getByRole('button',{name:'Edit your profile',exact:true});await opener.click();
 const dialog=page.getByRole('dialog',{name:'Your student profile',exact:true});await expect(dialog).toBeVisible();
 await page.keyboard.press('Shift+Tab');expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
 await page.setViewportSize({width:320,height:667});await page.getByRole('button',{name:'Chat menu',exact:true}).click();await page.locator('.chat-menu').getByRole('button',{name:/^Appearance/}).click();
 const appearance=page.getByRole('dialog',{name:'Appearance',exact:true});await expect(appearance).toBeVisible();await appearance.getByRole('button',{name:'Done',exact:true}).scrollIntoViewIfNeeded();await expect(appearance.getByRole('button',{name:'Done',exact:true})).toBeInViewport();
});
