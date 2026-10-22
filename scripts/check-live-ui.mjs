// Uses the running app and real providers. No intercepted routes or canned replies.
import {chromium,expect} from '@playwright/test';
import {writeFile,readFile} from 'node:fs/promises';
const base=process.env.TETRA_WEB_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.setDefaultTimeout(30000);
const errors=[],checks=[],startedAt=new Date().toISOString();page.on('pageerror',e=>errors.push(e.message));
const expectedDesignName=(await readFile('fixtures/unseen-design-student.txt','utf8')).match(/^Name:\s*(.+)$/m)[1].trim();
const profile={name:'Rahul',degree:'Final-year B.Tech Computer Science',target_degree:'Master’s in Computer Science or Artificial Intelligence',cgpa:'8.2 / 10',countries:'Canada, Germany, Singapore',budget:'Needs substantial funding; family cannot afford expensive tuition',interests:'Artificial intelligence'};
const nav=name=>page.getByRole('button',{name,exact:true}).click();
const state=()=>page.evaluate(async()=>{const id=new URLSearchParams(location.search).get('workspace');return fetch(`/api/sessions/${id}`).then(r=>r.json());});
try{
 await page.goto(base+'/app?workspace=hackathon-rahul-complete-2026');
 await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();
 await nav('Chat menu');await nav('Switch student');await nav('New student');
 await page.getByRole('textbox',{name:'New student profile'}).fill(JSON.stringify(profile));
 await page.getByLabel('New student documents').setInputFiles(['fixtures/rahul-resume.pdf','fixtures/rahul-transcript.pdf']);
 await nav('Create student workspace');await expect(page.getByRole('dialog')).not.toBeVisible({timeout:60000});
 let current=await state();checks.push({check:'new workspace via website',passed:current.sessionId!=='hackathon-rahul-complete-2026'&&current.opportunities.length===0&&current.documents.length===2,workspace:current.sessionId});
 await nav('Your documents');await expect(page.getByText('rahul-resume.pdf',{exact:true})).toBeVisible();await expect(page.getByText('rahul-transcript.pdf',{exact:true})).toBeVisible();
 await nav('Group chat');
 await page.getByRole('textbox',{name:'Message your team'}).fill('Please read my uploaded resume and transcript and check my academic facts.');await nav('Send message');
 await expect(page.getByRole('button',{name:'Stop responding',exact:true})).not.toBeVisible({timeout:240000});
 current=await state();checks.push({check:'actual PDF extraction and live Arjun review',passed:current.facts.length>=3&&current.profile.cgpa==='8.2 / 10'&&!current.profile.nationality,facts:current.facts.map(f=>({key:f.key,source:f.source})),messages:current.messages.filter(m=>m.agent!=='you').map(m=>({agent:m.agent,content:m.content}))});
 const before=current.messages.length;
 await page.getByRole('textbox',{name:'Message your team'}).fill('What is this app for?');await nav('Send message');await expect(page.getByRole('button',{name:'Stop responding',exact:true})).not.toBeVisible({timeout:180000});
 current=await state();const replies=current.messages.slice(before).filter(m=>m.agent!=='you');checks.push({check:'one public speaker in ordinary chat',passed:replies.length===1&&replies[0].agent==='mira'&&(replies[0].content.match(/\?/g)||[]).length<=1,replies});
 await page.screenshot({path:'artifacts/e2e-live-chat.png',animations:'disabled'});
 await nav('Chat menu');await page.locator('.chat-menu').getByRole('button',{name:/Appearance/}).click();await page.getByRole('radio',{name:'Dark',exact:true}).click();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('textbox',{name:'Message your team'}).fill('A multiline message\nthat stays inside\nthe phone screen');
 const geometry=await page.evaluate(()=>({composerBottom:document.querySelector('.composer').getBoundingClientRect().bottom,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}));checks.push({check:'phone composer and horizontal bounds',passed:geometry.composerBottom<=geometry.height&&!geometry.overflow,...geometry});
 await page.screenshot({path:'artifacts/e2e-live-phone-dark.png',animations:'disabled'});
 await page.reload();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();current=await state();checks.push({check:'server restore after refresh',passed:current.documents.length===2&&current.messages.some(m=>m.agent==='mira')});
 await page.setViewportSize({width:1440,height:900});await nav('Chat menu');await nav('Switch student');await page.locator('.saved-student').filter({hasText:'Meera'}).first().click();
 await expect(page.locator('.student-workspace-button')).toContainText('Meera');current=await state();checks.push({check:'different subject and student restored without document leakage',passed:current.profile.name===expectedDesignName&&/design/i.test(current.profile.target_degree)&&current.documents.length===0,workspace:current.sessionId,profile:current.profile});
 await nav('Your matches');await expect(page.getByRole('heading',{name:'Your next possibilities',exact:true})).toBeVisible();await page.screenshot({path:'artifacts/e2e-adapted-matches.png',animations:'disabled'});
 await page.goto(base+'/app?workspace=hackathon-rahul-complete-2026');await nav('Your matches');await expect(page.locator('.opportunity-card').first()).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('link',{name:'Export report',exact:true}).click();const report=await download;checks.push({check:'report download',passed:report.suggestedFilename().endsWith('.md')});
 await nav('Applications');await expect(page.locator('.application-paper')).toContainText('DRAFT');checks.push({check:'draft displayed',passed:true});
}catch(e){errors.push(e.message);}
finally{await browser.close();await writeFile('artifacts/end-to-end-ui-validation.json',JSON.stringify({startedAt,finishedAt:new Date().toISOString(),realProviders:true,mockedRoutes:false,checks,errors},null,2));}
console.log(JSON.stringify({checks:checks.map(c=>({check:c.check,passed:c.passed})),errors},null,2));
if(errors.length||checks.some(c=>!c.passed))process.exitCode=1;
