// Quick rotation check for the shared Groq key pool.
//
//   node scripts/key-rotation-check.mjs                 # 20 real parallel requests, logs key index per request
//   node scripts/key-rotation-check.mjs --simulate      # no network: keys 0 and 1 answer 429, shows rotation + cooldown
//   node scripts/key-rotation-check.mjs --calls=40      # different load
//
// Uses the same groqChat() path as the five agents, so it proves the production code path.
import 'dotenv/config';
import { groqChat } from '../server/groqClient.js';
import { poolKeys, poolStats } from '../server/keyPool.js';

const args = process.argv.slice(2);
const simulate = args.includes('--simulate');
const total = Number(args.find((arg) => arg.startsWith('--calls='))?.split('=')[1]) || 20;
const keys = poolKeys();
if (!keys.length) {
  console.error('GROQ_KEYS is empty. Add the comma-separated pool to .env first.');
  process.exit(1);
}
console.log(`Pool: ${keys.length} keys${simulate ? ' · simulated 429 on keys 0 and 1 (no network)' : ''}`);

if (simulate) {
  globalThis.fetch = async (_url, options) => {
    const index = keys.findIndex((key) => options.headers.Authorization === `Bearer ${key}`);
    if (index < 2) return new Response(JSON.stringify({ error: { message: 'Rate limit reached: requests per minute' } }), { status: 429, headers: { 'retry-after': '2' } });
    await new Promise((resolve) => setTimeout(resolve, 30));
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
  };
}

const started = Date.now();
const results = await Promise.all(
  Array.from({ length: total }, async (_, i) => {
    try {
      const response = await groqChat(
        { model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', messages: [{ role: 'user', content: 'Reply with the word ok.' }], max_tokens: 5, temperature: 0 },
        { apiKey: keys[0], timeoutMs: 20000 },
      );
      const body = await response.json().catch(() => ({}));
      return { i, keyIndex: response.keyIndex, status: response.status, note: body.error?.message ? String(body.error.message).slice(0, 70) : '' };
    } catch (error) {
      return { i, keyIndex: null, status: 'ERR', note: error.message };
    }
  }),
);

for (const result of results) {
  console.log(`request ${String(result.i + 1).padStart(2)} → key ${String(result.keyIndex).padStart(2)} · HTTP ${result.status}${result.note ? ` · ${result.note}` : ''}`);
}
const stats = poolStats();
const spread = new Set(results.map((result) => result.keyIndex)).size;
console.log(`\n${total} parallel requests in ${Date.now() - started}ms`);
console.log(`distinct keys used: ${spread}/${keys.length}`);
console.log(`uses per key:      ${stats.uses.join(', ')}`);
if (simulate) console.log(`cooldowns left ms: ${stats.coolingDownMs.join(', ')}`);
