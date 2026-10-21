import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {chromium,expect} from '@playwright/test';
const directory=await mkdtemp(path.join(os.tmpdir(),'scholarx-production-'));
const address=net.createServer();await new Promise(r=>address.listen(0,'127.0.0.1',r));const port=address.address().port;await new Promise(r=>address.close(r));
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),TETRA_DATA_DIR:directory},stdio:'ignore'});
let browser;const errors=[];
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${port}/`)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Production server did not become ready.');
 browser=await chromium.launch({headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/?workspace=production-browser-check`);await expect(page).toHaveTitle(/ScholarX/);await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();await expect(page.locator('.small-brand')).toHaveText('ScholarX');
 await page.reload();await expect(page.getByRole('textbox',{name:'Message your team'})).toBeVisible();
 await writeFile('artifacts/production-validation.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:errors.length===0,servesBuiltAssets:true,brand:'ScholarX',refreshWorks:true,isolatedStorage:true,errors},null,2));if(errors.length)throw Error(errors.join('; '));console.log('Production build loads and refreshes with ScholarX branding.');
}finally{await browser?.close();server.kill();await new Promise(r=>server.once('close',r));await rm(directory,{recursive:true,force:true});}
