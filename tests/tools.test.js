import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyOpportunities, worker } from '../server/tools.js';
import { extractDocx } from '../server/documents.js';
import { zipSync, strToU8 } from 'fflate';
const url = 'https://example.edu/funding';
const evidence = new Map([[url, { url, text: 'The award covers full tuition for two years. Applications close on 15 January 2027. Applicants must hold a bachelor degree in Computer Science.', retrieved_at: '2026-10-19' }]]);
test('unretrieved scholarship URLs cannot enter the shortlist', () => {
  assert.throws(() => verifyOpportunities([{ name: 'Made up', url: 'https://unread.example' }], evidence), /not retrieved/);
});
test('unsupported funding and deadlines are replaced with explicit unknowns', () => {
  const [result] = verifyOpportunities([{ name: 'MSc', url, funding: 'Everything covered', funding_quote: 'A quote that does not appear in the source page.', deadline: 'Tomorrow', deadline_quote: 'Tomorrow is the deadline for every applicant.' }], evidence);
  assert.match(result.funding, /not confirmed/); assert.match(result.deadline, /not confirmed/); assert.equal(result.quotes.funding, null);
});
test('genuine source excerpts retain funding, deadlines, and source timestamps', () => {
  const [result] = verifyOpportunities([{ name: 'MSc', url, funding: 'Full tuition for two years', funding_quote: 'The award covers full tuition for two years.', deadline: '15 January 2027', deadline_quote: 'Applications close on 15 January 2027.' }], evidence);
  assert.equal(result.funding, 'Full tuition for two years'); assert.equal(result.deadline, '15 January 2027'); assert.equal(result.retrieved_at, '2026-10-19');
});
test('Word extraction preserves paragraph boundaries and XML-escaped student names', () => {
  const docx = zipSync({ 'word/document.xml': strToU8('<w:document><w:body><w:p><w:r><w:t>Rahul &amp; projects</w:t></w:r></w:p><w:p><w:r><w:t>CGPA 8.2 / 10</w:t></w:r></w:p></w:body></w:document>') });
  assert.equal(extractDocx(docx).trim(), 'Rahul & projects\nCGPA 8.2 / 10');
});
test('Scrapling blocks private-network sources before fetching', async () => {
  for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'file:///etc/passwd', 'http://169.254.169.254/latest/meta-data/']) await assert.rejects(worker('read_page', { url }, new AbortController().signal), /Private|public|local/);
});
