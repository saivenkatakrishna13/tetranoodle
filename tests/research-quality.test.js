import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceCoverage,researchCoverage,focusedExcerpt,institutionDomain,distinctProgramPages} from '../server/research-quality.js';
import {validateReview,integrityContext,rankOpportunities} from '../server/research.js';

test('a degree overview and its admissions page count as one opportunity',()=>{
 const program={id:'overview',name:'Master’s Programme in Interaction Design',url:'https://example.edu/programmes/interaction-design/',type:'program',integrity_checked:true,eligibility:'conditional',score:70};
 const admissions={...program,id:'admissions',name:'MFA in Interaction Design',url:'https://www.example.edu/programmes/interaction-design-/admission/',claims:{requirements:{value:'Portfolio'}}};
 const award={...program,id:'award',type:'scholarship',name:'Design Scholarship'};
 assert.equal(distinctProgramPages([program,admissions]).length,1);
 assert.equal(rankOpportunities([program,admissions]).length,1);
 assert.equal(researchCoverage([program,admissions],false).suitable,1);
 assert.equal(distinctProgramPages([program,admissions,award]).length,2,'the degree and its scholarship remain separate');
 assert.equal(distinctProgramPages([{...program,url:'https://example.edu/catalog?degree=one'},{...program,url:'https://example.edu/catalog?degree=two'}]).length,2,'catalog query IDs can identify different degrees');
});

test('a ten-opportunity pack is partial when its top five lack practical application evidence',()=>{
 const items=Array.from({length:10},(_,i)=>({integrity_checked:true,id:String(i),name:`Program ${i}`,recommended:i<5,claims:{}}));
 const coverage=researchCoverage(items,true);assert.equal(coverage.reviewed,10);assert.equal(coverage.recommended,5);assert.equal(coverage.complete,false);assert.equal(coverage.ready,0);
 const claim={value:'Apply',quote:'Applications for the 2027 intake close on 15 January 2027.',url:'https://example.edu/apply'};
 for(const item of items)Object.assign(item,{claims:{funding:claim,deadline:claim,requirements:claim,application:claim},criteria:[{evidence:claim}],application_step_evidence:[claim]});
 assert.equal(researchCoverage(items,true).complete,true);
 items[0].deadline_state='expired';assert.equal(researchCoverage(items,true).suitable,9);assert.equal(researchCoverage(items,true).complete,false);delete items[0].deadline_state;
 items[0].claims.deadline={...claim,quote:'The deadline is January 15.'};assert.equal(evidenceCoverage(items[0]).deadline,false);assert.equal(researchCoverage(items,true).complete,false);
});

test('focused extraction reaches deadline and funding information after long navigation',()=>{
 const text='Navigation menu item\n'.repeat(1200)+'Applications for September 2027 close 15 January 2027. A stipend of CAD 20,000 is available to eligible research masters.\n'+'Contact information\n'.repeat(500);
 assert.match(focusedExcerpt(text,'deadline',1800),/15 January 2027/);assert.match(focusedExcerpt(text,'funding',1800),/CAD 20,000/);assert.ok(focusedExcerpt(text,'funding',1800).length<=1800);
 assert.equal(institutionDomain('https://www.cs.usask.ca/graduate'),'usask.ca');assert.equal(institutionDomain('https://www.comp.nus.edu.sg/admission'),'nus.edu.sg');assert.equal(institutionDomain('https://www.ox.ac.uk/'),'ox.ac.uk');
});

test('application steps cannot carry unevidenced portal instructions',()=>{
 const url='https://example.edu/degree';const page={url,text:'Example University offers the MSc in Computing. Apply using the university online application portal.',retrieved_at:new Date().toISOString()};
 const proof={value:'Apply using the university online application portal.',quote:'Apply using the university online application portal.',url};
 const review={name:'MSc Computing',source_kind:'degree_program',publisher_is_official:true,identity:{value:'MSc Computing',quote:'Example University offers the MSc in Computing.',url},application:proof,application_steps:['Email a passport and payment to an invented address.',proof,{value:'Pay $500',quote:'The fee is $500',url}]};
 const result=validateReview({url},review,new Map([[url,page]]));assert.deepEqual(result.application_steps,[proof.value]);assert.equal(result.application_step_evidence.length,1);
});

test('the independent review retains complete source passages without duplicating shared evidence',()=>{
 const url='https://example.edu/admissions',claim={value:'Apply online',quote:'Submit the application online before 15 January 2027.',url};
 const context=integrityContext({profile:{name:'Student'},evidence:new Map([[url,{title:'Graduate admissions',text:claim.quote}]])},[{id:'one',url,name:'MSc Computing',claims:{application:claim,deadline:{...claim,value:'15 January 2027'}},application_step_evidence:[claim],criteria:[]}]);
 assert.equal(context.passages.length,1);assert.equal(context.passages[0].quote,claim.quote);assert.equal(context.items[0].claims.deadline.evidence_id,context.items[0].application_step_evidence[0].evidence_id);
});

test('an unreviewed high-scoring lead cannot become a recommendation',()=>{
 const ranked=rankOpportunities([{id:'pending',name:'Unreviewed lead',score:100,eligibility:'appears_eligible',integrity_checked:false},{id:'checked',name:'Verified conditional match',score:45,eligibility:'conditional',integrity_checked:true}]);
 assert.equal(ranked[0].id,'checked');assert.equal(ranked[0].recommended,true);assert.equal(ranked.find(o=>o.id==='pending').recommended,false);
});
