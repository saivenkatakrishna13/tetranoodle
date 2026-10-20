import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { extractDocx } from './documents.js';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { runSwarm, preview } from './agents.js';
import { scraperReady, worker } from './tools.js';
import { liveReady, agentKey, agentModel } from './groq.js';
import { sessionFor, snapshot, saveSession, record } from './store.js';
import { startResearch, pauseResearch, createDraft, reportMarkdown } from './research.js';

const app = express(), port = Number(process.env.PORT || 3001), root = path.resolve(import.meta.dirname, '..');
app.disable('x-powered-by');
app.use((req,res,next)=>{
  const origin=req.get('origin');
  if(origin && ![`http://127.0.0.1:5173`,`http://localhost:5173`,`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin))return res.status(403).json({error:'This is a private local workspace.'});
  res.setHeader('X-Content-Type-Options','nosniff');next();
});
app.use(express.json({limit:'1mb'}));
app.get('/api/status',async(req,res)=>res.json({live:liveReady(),agents:Object.fromEntries(['mira','arjun','nova','sage','leo'].map(id=>[id,!!agentKey(id)])),models:Object.fromEntries(['mira','arjun','nova','sage','leo'].map(id=>[id,agentModel(id)])),provider:'Groq',model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',scrapling:await scraperReady(),storage:'local-disk'}));
app.get('/api/sessions/:id',(req,res)=>res.json(snapshot(sessionFor(req.params.id))));
app.patch('/api/sessions/:id/profile',(req,res)=>{
  const session=sessionFor(req.params.id);
  const allowed=['name','degree','target_degree','cgpa','countries','budget','github','nationality','graduation','intake','language_scores','interests','career_goals','public_profiles'];
  if(session.run?.status==='running')pauseResearch(session);
  for(const [key,value]of Object.entries(req.body||{}))if(allowed.includes(key)&&typeof value==='string')session.profile[key]=value.slice(0,1000);
  record(session,{type:'profile',profile:session.profile});saveSession(session,true);res.json({profile:session.profile});
});
app.get('/api/sessions/:id/report',(req,res)=>{
  const session=sessionFor(req.params.id);res.setHeader('Content-Disposition','attachment; filename="tetranoodle-research-report.md"');res.type('text/markdown').send(reportMarkdown(session));
});
app.get('/api/sessions/:id/export',(req,res)=>{
  const session=sessionFor(req.params.id);res.setHeader('Content-Disposition','attachment; filename="tetranoodle-workspace.json"');res.json(snapshot(session));
});
app.get('/api/sessions/:id/events',(req,res)=>{
  const session=sessionFor(req.params.id), after=Number(req.query.after||req.get('Last-Event-ID')||0);
  res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');res.flushHeaders();
  const send=event=>{if(!res.writableEnded)res.write(`id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`);};
  session.events.filter(e=>e.sequence>after).forEach(send);
  session.subscribers ||=new Set();session.subscribers.add(send);
  const heartbeat=setInterval(()=>{if(!res.writableEnded)res.write(': heartbeat\n\n');},15000);
  res.on('close',()=>{clearInterval(heartbeat);session.subscribers.delete(send);});
});
app.post('/api/research',(req,res)=>{
  if(!liveReady())return res.status(503).json({error:'Connect the five Groq keys in .env before starting live research.'});
  const session=sessionFor(req.body.sessionId);
  try{const run=startResearch(session,{resume:!!req.body.resume});res.status(202).json({run});}catch(e){res.status(409).json({error:e.message});}
});
app.post('/api/sessions/:id/pause',(req,res)=>{const session=sessionFor(req.params.id);const paused=pauseResearch(session);res.json({requested:paused,run:session.run});});
app.post('/api/sessions/:id/draft',async(req,res,next)=>{
  const session=sessionFor(req.params.id);
  if(session.chatBusy||session.run?.status==='running')return res.status(409).json({error:'Wait for the current task or pause research before generating another draft.'});
  if(!liveReady())return res.status(503).json({error:'Connect Groq to create an application draft.'});
  const opportunity=session.opportunities.find(o=>o.id===req.body.opportunityId);
  if(!opportunity)return res.status(404).json({error:'This researched opportunity was not found.'});
  session.chatBusy=true;
  try{await createDraft(session,opportunity,event=>record(session,event),new AbortController().signal);saveSession(session,true);res.json({content:session.draft,meta:session.draftMeta});}catch(e){next(e);}finally{session.chatBusy=false;record(session,{type:'typing',agent:null});}
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:4},fileFilter:(req,file,cb)=>cb(null,/\.(pdf|docx|txt|md)$/i.test(file.originalname))});
app.post('/api/documents',upload.array('files',4),async(req,res,next)=>{
  try{
    const session=sessionFor(req.body.sessionId);
    if(session.chatBusy||session.run?.status==='running')return res.status(409).json({error:'Pause the current work before adding documents.'});
    if(!req.files?.length)return res.status(400).json({error:'Choose a PDF, DOCX, TXT or Markdown file, up to 10 MB.'});
    if(session.documents.length+req.files.length>12)return res.status(400).json({error:'Up to twelve documents per journey are supported.'});
    const extracted=[];
    for(const file of req.files){
      const ext=path.extname(file.originalname).toLowerCase();let text;
      try{if(ext==='.pdf')text=(await worker('parse_pdf',{base64:file.buffer.toString('base64')},new AbortController().signal)).text;else if(ext==='.docx')text=extractDocx(file.buffer);else text=file.buffer.toString('utf8');}catch{throw new Error(`${file.originalname} could not be read. Upload a valid, text-based PDF, DOCX or TXT file.`);}
      if(text.trim().length<20)throw new Error(`${file.originalname} contains too little text. A scanned PDF needs OCR; please use a text-based document.`);
      extracted.push({id:randomUUID(),name:path.basename(file.originalname),size:file.size,characters:text.length,text:text.slice(0,40000)});
    }
    session.documents.push(...extracted);saveSession(session,true);res.json({documents:extracted.map(({text,...meta})=>meta)});
  }catch(e){next(e);}
});
app.delete('/api/sessions/:id/documents/:documentId',(req,res)=>{
  const session=sessionFor(req.params.id);
  if(session.chatBusy||session.run?.status==='running')return res.status(409).json({error:'Pause the current work before removing a document.'});
  session.documents=session.documents.filter(d=>d.id!==req.params.documentId);saveSession(session,true);res.json({documents:session.documents.map(({text,...d})=>d)});
});
app.post('/api/chat',async(req,res)=>{
  let session;try{session=sessionFor(req.body.sessionId);}catch(e){return res.status(400).json({error:e.message});}
  const {message,history=[],profile={}}=req.body;
  if(typeof message!=='string'||!message.trim()||message.length>10000||!Array.isArray(history))return res.status(400).json({error:'Send between 1 and 10,000 characters.'});
  if(session.chatBusy)return res.status(409).json({error:'The team is still replying. You can send your next message in a moment.'});
  if(!Object.keys(session.profile).length)for(const[k,v]of Object.entries(profile))if(['name','degree','target_degree','cgpa','countries','budget','github','nationality','intake','language_scores','interests'].includes(k)&&typeof v==='string')session.profile[k]=v.slice(0,1000);
  const prior=session.messages.length?session.messages.slice():history;
  session.messages.push({id:req.body.messageId||randomUUID(),agent:'you',content:message.trim(),time:Date.now(),documents:req.body.documents||[]});
  session.chatBusy=true;saveSession(session);
  res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');res.flushHeaders();
  const controller=new AbortController(),signal=controller.signal;
  const emit=event=>{if(!signal.aborted&&!res.writableEnded){const saved=record(session,event);res.write(`data: ${JSON.stringify(saved)}\n\n`);}};
  const heartbeat=setInterval(()=>{if(!res.writableEnded)res.write(': heartbeat\n\n');},15000);
  const deadline=setTimeout(()=>{emit({type:'error',error:'This chat turn timed out. Your messages are saved; please retry.'});controller.abort();},8*60000);
  res.on('close',()=>controller.abort());
  try{
    const cleanHistory=prior.slice(-32).filter(m=>m&&typeof m.content==='string'&&m.id!==req.body.messageId).map(m=>({role:m.agent==='you'?'user':'assistant',content:m.agent==='you'?m.content.slice(0,10000):`[${m.agent}] ${m.content.slice(0,9000)}`}));
    if(liveReady())await runSwarm(session,cleanHistory,message,emit,signal);else await preview(session,cleanHistory,message,emit,signal);
    emit({type:'done'});
  }catch(e){if(!signal.aborted)emit({type:'error',error:e.message||'The team was interrupted. Please retry.'});}
  finally{clearInterval(heartbeat);clearTimeout(deadline);session.chatBusy=false;saveSession(session,true);res.end();}
});
app.use(express.static(path.join(root,'dist')));
app.get('/{*path}',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'Not found'});res.sendFile(path.join(root,'dist/index.html'));});
app.use((err,req,res,next)=>{if(res.headersSent)return next(err);res.status(err instanceof multer.MulterError?400:400).json({error:err instanceof multer.MulterError?err.code==='LIMIT_FILE_SIZE'?'That file is larger than 10 MB.':'Upload up to four files at a time.':err.message||'The request could not be completed.'});});
app.listen(port,'127.0.0.1',()=>console.log(`TetraNoodle ready · http://127.0.0.1:${port} · ${liveReady()?'Groq live':'guided preview'}`));
