import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const base=process.env.TETRA_WEB_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch();const errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({colorScheme:'light'});
 await page.goto(base+'/app?workspace=ui-refinement-preview-2026');await expect(page.getByRole('heading',{name:/Your next chapter\. Beyond the expected\./})).toBeVisible();
 const shot=async name=>{await page.waitForTimeout(200);await page.screenshot({path:`artifacts/${name}.png`,animations:'disabled'});};
 await shot('ui-refined-light');
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await shot('ui-refined-dark');
 await page.setViewportSize({width:390,height:844});await shot('ui-refined-phone-dark');
 await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();await shot('ui-refined-phone');
 for(const size of [{width:320,height:667},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
  await page.setViewportSize(size);await page.waitForTimeout(100);const bounds=await page.evaluate(()=>({viewportWidth:innerWidth,viewportHeight:innerHeight,scrollWidth:document.documentElement.scrollWidth,headerTop:document.querySelector('.chat-header').getBoundingClientRect().top,composerBottom:document.querySelector('.composer').getBoundingClientRect().bottom}));
  const passed=bounds.scrollWidth<=bounds.viewportWidth&&bounds.headerTop===0&&bounds.composerBottom<=bounds.viewportHeight;
  checks.push({check:'fixed chat boundaries',...size,...bounds,passed});if(!passed)throw Error('Chat bounds failed: '+JSON.stringify(bounds));
 }
 await page.goto(base+'/app?workspace=hackathon-rahul-complete-2026');await page.getByRole('button',{name:'Your matches',exact:true}).click();await expect(page.locator('.opportunity-card').first()).toBeVisible();await shot('ui-refined-matches');
 await page.getByRole('button',{name:'Applications',exact:true}).click();await expect(page.locator('.application-paper')).toBeVisible();await shot('ui-refined-application');
}catch(e){errors.push(e.message);}finally{await browser.close();await writeFile('artifacts/ui-refinement-validation.json',JSON.stringify({checkedAt:new Date().toISOString(),realStoredWorkspaces:true,mockedRoutes:false,providerCallsRequired:false,checks,errors},null,2)+'\n');}
console.log(JSON.stringify({checks:checks.length,errors},null,2));if(errors.length)process.exitCode=1;
