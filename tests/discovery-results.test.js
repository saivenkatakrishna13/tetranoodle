import test from 'node:test';
import assert from 'node:assert/strict';
import {publicLeads,publicLeadReason,discoveryResults,shortlistLeads} from '../shared/discovery-results.js';
import {resolveOfficialSource} from '../server/official-source.js';
import {candidateExcerpt} from '../server/research-quality.js';
import {validateReview} from '../server/research.js';
test('programme excerpts retain a real subject passage beneath long navigation',()=>{
 const identity='Master of Fine Arts in Illustration is a postgraduate degree.',text='Navigation '.repeat(500)+identity+' Application details follow. '+'Tuition and funding information. '.repeat(200);
 const excerpt=candidateExcerpt(text,'Master of Fine Arts in Illustration',2800);assert.ok(excerpt.includes(identity));assert.ok(excerpt.length<=2800);for(const piece of excerpt.split('\n[…]\n'))assert.ok(text.includes(piece));
});
test('the program schema synonym still requires exact identity evidence',()=>{
 const url='https://example.edu/programme',text='Example University offers a Master of Illustration.',evidence=new Map([[url,{url,text}]]),review={source_kind:'program',publisher_is_official:true,name:'Master of Illustration',identity:{value:'Master of Illustration',quote:text,url}};
 assert.ok(validateReview({url},review,evidence));assert.equal(validateReview({url},{...review,identity:{...review.identity,quote:'This unsupported university offers a made-up degree.'}},evidence),null);
});
test('ten discovered URLs remain visible even when only two produced reviewed recommendations',()=>{
 const candidates=Array.from({length:10},(_,i)=>({url:`https://example${i}.edu/programme`,name:`Programme ${i}`,university:`University ${i}`,country:'Germany',reason:'Unverified scholarship promise'}));
 const opportunities=candidates.slice(0,2).map((c,i)=>({...c,id:String(i),recommended:true,integrity_checked:true}));
 const run={candidates,pipeline:{checks:{[candidates[9].url]:{checked:true,state:'dead',reason:'HTTP 404'}}}};
 const publicRun={discovered:publicLeads(run)},results=discoveryResults(opportunities,publicRun),leads=shortlistLeads(results,opportunities);
 assert.equal(results.length,10);assert.equal(leads.length,3);assert.equal(publicRun.discovered[0].reason,null);assert.equal(results.at(-1).state,'dead');
 for(const lead of leads){assert.equal(lead.recommended,false);assert.equal(lead.integrity_checked,false);assert.ok(Object.values(lead.claims).every(c=>c===null));assert.doesNotMatch(lead.reason,/scholarship promise/);}
 assert.equal(opportunities.length,2);
});
test('source-lead status never exposes scraper diagnostics',()=>{
 const raw='Failed to perform, curl: (60) SSL certificate OpenSSL verify result: self signed certificate in certificate chain (19).';
 const reason=publicLeadReason(raw);
 assert.match(reason,/security certificate/i);assert.doesNotMatch(reason,/curl|self signed|OpenSSL/i);
});
test('an official redirect joins its discovered URL to the reviewed card without duplication',()=>{
 const run={discovered:[{name:'Programme',url:'https://example.edu/old',officialUrl:'https://example.edu/current'}]},item={id:'review',url:'https://example.edu/current'};
 assert.deepEqual(discoveryResults([item],run),[item]);
});
test('cached official ownership is reused only for exactly the same fetched page',async()=>{
 const candidate={name:'Programme',url:'https://example.edu/current'},page={url:candidate.url,title:'University programme',text:'The university offers a postgraduate programme.',links:[]};let calls=0;
 const options={generate:async()=>{calls++;return {official:true,reason:'Provider identity is present in the fetched page.'};}};
 const resolved=await resolveOfficialSource(candidate,page,{},()=>{},new AbortController().signal,options);
 await resolveOfficialSource(candidate,resolved,{},()=>{},new AbortController().signal,options);assert.equal(calls,1);
 await resolveOfficialSource(candidate,{...resolved,text:'Changed page text.'},{},()=>{},new AbortController().signal,options);assert.equal(calls,2);
});
