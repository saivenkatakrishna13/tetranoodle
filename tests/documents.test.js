import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {worker} from '../server/tools.js';
import {reportPdf,sopDocx} from '../server/exports.js';
import {extractDocx} from '../server/documents.js';
test('PDF text and scanned-PDF OCR both extract actual fictional document content',{timeout:65000},async()=>{
 const text=await worker('parse_pdf',{base64:(await readFile('fixtures/rahul-transcript.pdf')).toString('base64')},AbortSignal.timeout(60000));assert.match(text.text,/8\.2/);assert.equal(text.method,'PDF text');
 const scanned=await worker('parse_pdf',{base64:(await readFile('fixtures/scanned-transcript-test.pdf')).toString('base64')},AbortSignal.timeout(60000));assert.equal(scanned.method,'PDF text + local OCR');assert.deepEqual(scanned.ocr_pages,[1]);assert.match(scanned.text,/8\.4/);assert.match(scanned.text,/Design/i);
 await assert.rejects(worker('parse_pdf',{base64:Buffer.from('not a PDF').toString('base64')},AbortSignal.timeout(60000)));
});
test('PDF report is a readable real PDF with source URLs, timestamps and missing evidence',{timeout:65000},async()=>{
 const c={value:'Portfolio required',quote:'Applicants must provide a portfolio.',url:'https://example.edu/fixture',retrieved_at:'2026-10-21T00:00:00Z'};
 const pdf=await reportPdf({profile:{name:'Fictional Export Student',target_degree:'Master of Design'},run:{coverage:{ready:0}},opportunities:[{id:'fixture',rank:1,recommended:true,integrity_checked:true,name:'Fixture Programme',university:'Fixture Provider',url:c.url,claims:{requirements:c,funding:null},application_step_evidence:[c],score:40,eligibility:'conditional',missing_information:['Language score']}]},AbortSignal.timeout(60000));assert.ok(pdf.subarray(0,4).toString()==='%PDF');
 const extracted=await worker('parse_pdf',{base64:pdf.toString('base64')},AbortSignal.timeout(60000));assert.match(extracted.text,/https:\/\/example.edu\/fixture/);assert.match(extracted.text,/2026-10-21/);assert.match(extracted.text,/funding: Missing/);assert.match(extracted.text,/Draft only/);
 const doc=sopDocx('DRAFT\nFictional student & actual source\nhttps://example.edu');assert.match(extractDocx(doc),/Fictional student & actual source/);
});
