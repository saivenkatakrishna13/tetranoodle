// Real frontend + API + Groq. Only temporary fictional students are created/deleted.
import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const api=process.env.TETRA_URL||'http://127.0.0.1:3001',web=process.env.TETRA_WEB_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true}),checks=[],errors=[],ids=[];
async function post(path,body={}){const r=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error((await r.json()).error);return r.json();}
const state=async id=>(await fetch(`${api}/api/sessions/${id}`)).json();
async function create(name){const s=await post('/api/sessions',{profile:{name}});ids.push(s.sessionId);return s.sessionId;}
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 const id=await create('Rahul');await page.goto(`${web}/?workspace=${id}`);await expect(page.getByRole('heading',{name:'Tell us your story.',exact:true})).toBeVisible();
 checks.push({check:'first screen is a manual profile; research has not started',passed:!(await state(id)).run});
 for(const [key,value]of Object.entries({degree:'Final-year B.Tech Computer Science',target_degree:'Master of Computer Science or Artificial Intelligence',cgpa:'8.2 / 10',budget:'Substantial scholarship funding needed',countries:'Canada, Germany, Singapore'}))await page.locator(`.profile-start-fields input[name=${key}]`).fill(value);
 await page.getByLabel('Profile supporting documents').setInputFiles(['fixtures/rahul-resume.pdf','fixtures/rahul-transcript.pdf']);
 await page.getByRole('button',{name:'Save profile & find opportunities',exact:true}).click();
 await expect.poll(async()=>{const s=await state(id);return s.facts.length>=3||['needs_input','interrupted'].includes(s.run?.status);},{timeout:120000}).toBe(true);
 let s=await state(id);checks.push({check:'real PDF upload and Arjun extraction use the supplied profile',passed:s.documents.length===2&&s.facts.length>=3&&s.profile.cgpa==='8.2 / 10'&&!s.profile.nationality});
 await expect.poll(async()=>{const s=await state(id);return ['discover','verify','details','done'].includes(s.run?.stage)||s.run?.status==='interrupted';},{timeout:120000}).toBe(true);
 s=await state(id);checks.push({check:'manual country preferences are retained without asking again',passed:!!s.profile.countries&&s.run?.status==='running'&&s.run.stage!=='profile'});await post(`/api/sessions/${id}/pause`);
 const partial=await create('Fictional Biology Student');await page.goto(`${web}/?workspace=${partial}`);await expect(page.getByRole('heading',{name:'Tell us your story.',exact:true})).toBeVisible();
 await page.locator('.profile-start-fields input[name=degree]').fill('B.Sc Biology');await page.locator('.profile-start-fields input[name=target_degree]').fill('Master of Biology');
 await page.getByRole('button',{name:'Save profile & continue with Arjun',exact:true}).click();
 await expect(page.getByText('Which countries would you like us to focus on?',{exact:false})).toBeVisible({timeout:30000});s=await state(partial);
 checks.push({check:'missing manual country preference is asked by Arjun before discovery',passed:s.run?.status==='needs_input'&&s.messages.at(-1)?.agent==='arjun'&&!s.activity.some(a=>a.label?.includes('Searching:'))});
 await page.getByRole('textbox',{name:'Message your team'}).fill('Germany');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect.poll(async()=>{const s=await state(partial);return s.profile.countries==='Germany'&&s.run?.status==='running';},{timeout:90000}).toBe(true);
 s=await state(partial);checks.push({check:'a real chat answer completes intake and starts the other agents automatically',passed:s.profile.countries==='Germany'&&s.run.status==='running'&&!s.profile.nationality});await post(`/api/sessions/${partial}/pause`);
}catch(e){errors.push(e.message);for(const id of ids){const s=await state(id).catch(()=>null);if(s)errors.push(JSON.stringify({status:s.run?.status,stage:s.run?.stage,conflicts:s.profileConflicts,lastMessages:s.messages?.slice(-2).map(m=>({agent:m.agent,content:m.content}))}));}}
finally{
 await browser.close();for(const id of ids){await post(`/api/sessions/${id}/pause`).catch(()=>{});const removed=await fetch(`${api}/api/sessions/${id}`,{method:'DELETE'});if(!removed.ok&&removed.status!==410)errors.push('Temporary fictional workspace cleanup failed.');}
 await writeFile('artifacts/profile-first-live-validation.json',JSON.stringify({checkedAt:new Date().toISOString(),realProviders:true,mockedRoutes:false,fictionalStudentsOnly:true,temporaryWorkspacesDeleted:true,checks,errors},null,2));
}
console.log(JSON.stringify({checks,errors},null,2));if(errors.length||checks.some(c=>!c.passed))process.exitCode=1;
