import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { groqChat } from '../server/groqClient.js';
import { poolStats, resetPool } from '../server/keyPool.js';
import { completion } from '../server/groq.js';

const KEYS = ['pool-key-0', 'pool-key-1', 'pool-key-2'];
const message = [{ role: 'user', content: 'Reply with ok.' }];
const savedKeys = process.env.GROQ_KEYS;
const savedAgentKey = process.env.GROQ_API_KEY_MIRA;
const savedFetch = globalThis.fetch;

beforeEach(() => {
  process.env.GROQ_KEYS = KEYS.join(',');
  resetPool();
});
afterEach(() => {
  globalThis.fetch = savedFetch;
  if (savedKeys === undefined) delete process.env.GROQ_KEYS; else process.env.GROQ_KEYS = savedKeys;
  if (savedAgentKey === undefined) delete process.env.GROQ_API_KEY_MIRA; else process.env.GROQ_API_KEY_MIRA = savedAgentKey;
  resetPool();
});

const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
const limited = (retryAfter) => new Response(JSON.stringify({ error: { message: 'Rate limit reached: requests per minute' } }), { status: 429, ...(retryAfter ? { headers: { 'retry-after': retryAfter } } : {}) });
const indexUsed = (authorization) => KEYS.findIndex((key) => `Bearer ${key}` === authorization);

test('a 429 on key 0 cools that key down and the same request succeeds on key 1', async () => {
  const used = [];
  globalThis.fetch = async (_url, options) => {
    used.push(options.headers.Authorization);
    return options.headers.Authorization === `Bearer ${KEYS[0]}` ? limited('60') : ok();
  };
  const response = await groqChat({ model: 'test-model', messages: message });
  assert.equal(response.status, 200);
  assert.equal(response.keyIndex, 1);
  assert.deepEqual(used.map(indexUsed), [0, 1]);
  const cooled = poolStats().coolingDownMs;
  assert.ok(cooled[0] > 0, 'key 0 must be cooling down');
  assert.equal(cooled[1], 0, 'key 1 must stay available');
  // The cooled key is skipped by the next draw.
  const next = await groqChat({ model: 'test-model', messages: message });
  assert.notEqual(next.keyIndex, 0);
});

test('cooldown follows retry-after and defaults to 60 seconds when the header is missing', async () => {
  let call = 0;
  globalThis.fetch = async () => (++call === 1 ? limited('30') : ok());
  await groqChat({ model: 'test-model', messages: message });
  let cooled = poolStats().coolingDownMs[0];
  assert.ok(cooled > 25_000 && cooled <= 30_000, `retry-after 30s left ${cooled}ms`);

  resetPool();
  call = 0;
  globalThis.fetch = async () => (++call === 1 ? limited() : ok());
  await groqChat({ model: 'test-model', messages: message });
  cooled = poolStats().coolingDownMs[0];
  assert.ok(cooled > 55_000 && cooled <= 60_000, `default cooldown left ${cooled}ms`);
});

test('all-429 responses stop after keys * 2 attempts and the last 429 is returned, not thrown', async () => {
  const used = [];
  // A short retry-after keeps the all-keys-cooling wait path quick; the attempt count is what matters.
  globalThis.fetch = async (_url, options) => { used.push(options.headers.Authorization); return limited('0.5'); };
  const response = await groqChat({ model: 'test-model', messages: message });
  assert.equal(used.length, KEYS.length * 2, 'exactly keys * 2 attempts');
  assert.deepEqual(used.map(indexUsed), [0, 1, 2, 0, 1, 2], 'round-robin across the whole pool');
  assert.equal(response.status, 429);
  const body = await response.json(); // body must stay readable for the caller's quota handling
  assert.match(body.error.message, /requests per minute/);
});

test('a non-429 network failure throws immediately with no rotation and no cooldown', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('connection refused'); };
  await assert.rejects(groqChat({ model: 'test-model', messages: message }), /connection refused/);
  assert.equal(calls, 1, 'no retry with another key');
  assert.ok(poolStats().coolingDownMs.every((ms) => ms === 0), 'nothing was marked limited');
});

test('a non-429 HTTP status is returned unchanged with no rotation', async () => {
  const used = [];
  globalThis.fetch = async (_url, options) => { used.push(options.headers.Authorization); return new Response(JSON.stringify({ error: { message: 'server error' } }), { status: 500 }); };
  const response = await groqChat({ model: 'test-model', messages: message });
  assert.equal(response.status, 500);
  assert.equal(used.length, 1, 'only one key was tried');
  assert.ok(poolStats().coolingDownMs.every((ms) => ms === 0), '500 does not cool a key down');
});

test('without GROQ_KEYS exactly one fetch runs with the agent\'s own key', async () => {
  delete process.env.GROQ_KEYS;
  process.env.GROQ_API_KEY_MIRA = 'agent-own-key';
  const used = [];
  globalThis.fetch = async (_url, options) => { used.push(options.headers.Authorization); return ok(); };
  const reply = await completion([{ role: 'user', content: 'Reply with ok.' }], { agent: 'mira', modelOverride: 'test-model', maxTokens: 50 });
  assert.equal(reply.content, 'ok');
  assert.deepEqual(used, ['Bearer agent-own-key'], 'the pooled keys must not be used when the pool is empty');
  assert.equal(poolStats().size, 0);
});
