import { unzipSync, strFromU8 } from 'fflate';
export function extractDocx(buffer) {
  const files = unzipSync(buffer, { filter: f => f.name === 'word/document.xml' && f.originalSize <= 5 * 1024 * 1024 });
  if (!files['word/document.xml']) throw new Error('Word document is invalid or its text exceeds the 5 MB extraction limit.');
  const xml = strFromU8(files['word/document.xml']);
  const text = xml.replace(/<w:tab\b[^>]*\/?\s*>/g, '\t').replace(/<w:br\b[^>]*\/?\s*>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity.startsWith('#')) { const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10); return code <= 0x10ffff ? String.fromCodePoint(code) : ''; }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity];
  });
}
