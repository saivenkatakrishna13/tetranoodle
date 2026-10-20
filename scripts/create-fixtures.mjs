import {readFile,writeFile}from'node:fs/promises';
function pdf(lines){
 const escape=s=>s.replace(/[\\()]/g,'\\$&').replace(/[^\x20-\x7e]/g,"'");
 const stream=`BT /F1 11 Tf 48 790 Td 16 TL ${lines.flatMap((line,i)=>[...(i?['T*']:[]),`(${escape(line)}) Tj`]).join('\n')} ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [3 0 R] >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let output='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(output));output+=`${i+1} 0 obj\n${object}\nendobj\n`;});const xref=Buffer.byteLength(output);output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return output;
}
for(const name of['rahul-resume','rahul-transcript']){const text=await readFile(`fixtures/${name}.txt`,'utf8');const lines=text.split('\n').flatMap(line=>line.match(/.{1,83}(?:\s|$)/g)||['']);await writeFile(`fixtures/${name}.pdf`,pdf(lines));}
console.log('Created two clearly labeled fictional text-PDF fixtures.');
