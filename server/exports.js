import {zipSync,strToU8} from 'fflate';
import {worker} from './tools.js';
const xml=value=>String(value||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export function sopDocx(content){
 const paragraphs=String(content||'No draft prepared.').split('\n').map(line=>{const heading=line.match(/^(#{1,6})\s+/);const quote=/^> ?/.test(line);const text=line.replace(/^#{1,6}\s+/,'').replace(/^> ?/,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'$1: $2');return `<w:p><w:pPr><w:spacing w:after="140" w:line="288"/>${heading?'<w:keepNext/>':''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${heading?'<w:b/><w:sz w:val="'+(heading[1].length===1?'36':'26')+'"/>':'<w:sz w:val="22"/>'}${quote?'<w:i/>':''}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;}).join('');
 return Buffer.from(zipSync({
  '[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
  '_rels/.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
  'word/document.xml':strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:bottom="1134" w:left="1134" w:right="1134"/></w:sectPr></w:body></w:document>`)
 }));
}
export async function reportPdf(session,signal){
 const lines=[`ScholarX — Scholarship research report`,`Generated ${new Date().toISOString()}`,`Student: ${session.profile.name||'Missing'}`,`Study goal: ${session.profile.target_degree||'Missing'}`,`Draft only. Verify on the official site. No applications submitted.`,`Verified application details: ${session.run?.coverage?.ready||0}/5`,``];
 for(const o of session.opportunities.filter(o=>o.recommended&&o.integrity_checked).slice(0,5)){
  lines.push(`${o.rank}. ${o.name}`,o.university,`Official source: ${o.url}`,`Why: ${o.reason}`,`Research priority: ${o.score}/100 (not admission probability)`,`Funding: ${o.funding||'Missing'}`,`Deadline: ${o.deadline||'Missing'}`,`Eligibility: ${o.eligibility}`,`Missing: ${(o.missing_information||[]).join('; ')||'Confirm all official requirements'}`);
  for(const [key,c]of Object.entries(o.claims||{}))lines.push(c?`${key}: ${c.value}\nSource: ${c.url}\nFetched: ${c.retrieved_at}\nSnippet: ${c.quote}`:`${key}: Missing`);
  for(const [i,c]of(o.application_step_evidence||[]).entries())lines.push(`Apply ${i+1}: ${c.value}\n${c.url}\n${c.quote}`);lines.push('');
 }
 if(!session.opportunities.some(o=>o.recommended))lines.push('No reviewed recommendations available yet.');
 const result=await worker('render_pdf',{title:'ScholarX research report',lines},signal);return Buffer.from(result.base64,'base64');
}
