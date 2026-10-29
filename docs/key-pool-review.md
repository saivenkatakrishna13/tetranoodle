# Shared Groq key pool — review brief

Goal: replace the per-agent Groq key arrangement with one shared pool of keys so a single
rate-limited key never blocks an agent. All five agents (Mira, Arjun, Nova, Sage, Leo) draw
from the same pool, rotate on 429, and cool a limited key down until its Retry-After time.

Requested constraints: no frontend changes, no API route / request-response format changes,
no agent prompt or logic changes, minimal diff.

---

## 1. Files created

### `server/keyPool.js` (new)

- Parses `GROQ_KEYS` (comma-separated) **at call time**, so nothing is hardcoded and tests can
  override the environment. Empty/blank entries are dropped.
- `acquireKey({signal})` — round-robin cursor over the pool, skipping keys whose cooldown has
  not expired; expired cooldowns are deleted lazily. Returns `{key, index, count}`, or `null`
  when no pool is configured (caller then uses its own key).
- When **every** key is cooling down it waits for the earliest expiry with
  `min(remaining, 5000ms)` per wait, then re-probes — i.e. at most 5s per wait as specified.
- Safety valve: after 30s of cumulative waiting it hands back the key whose cooldown ends
  first instead of hanging the request forever. Waits honour the caller's `AbortSignal`.
- `markLimited(index, retryAfterSeconds)` — cooldown = provider `retry-after` in seconds,
  default 60s, capped at 600s.
- `poolStats()` / `resetPool()` for observability and tests.

### `server/groqClient.js` (new)

`groqChat(params, { signal, apiKey })`:

- Same params shape as `client.chat.completions.create(params)` (`model`, `messages`,
  `temperature`, `max_tokens`, `tools`, `tool_choice`, `response_format`, `reasoning_effort`).
- Picks a key from the pool, performs the POST, returns the `Response`.
- On **429**: `markLimited(index, retry-after)` then immediately retries with the next key.
- Any other error (network failure, abort) is thrown normally, so `groq.js`'s existing
  connection-retry and cancellation handling still runs unchanged.
- Gives up after `number of keys * 2` attempts and returns the **last 429 response**, so the
  caller's existing quota handling (daily allowance, request-size fallback, user-facing limit
  notice, retry delay) still executes on the real body and headers.
- Attaches `response.keyIndex` so callers/logs can see which key served the call.

### `scripts/key-rotation-check.mjs` (new)

Verification script:

```
node scripts/key-rotation-check.mjs            # 20 real parallel requests, logs key index per request
node scripts/key-rotation-check.mjs --simulate # no network: keys 0 and 1 answer 429
node scripts/key-rotation-check.mjs --calls=40
```

Prints `request N → key K · HTTP status`, distinct keys used, per-key use counts and remaining
cooldowns. It drives the same `groqChat()` path as the agents.

---

## 2. Files modified

### `server/groq.js` — 3 hunks, the only Groq call site

All five agents reach Groq through `completion()` → `request()`, so replacing that one `fetch`
with `groqChat(...)` converts every direct Groq call in all five agents. Params, prompts,
messages, retries, metrics and error text are untouched.

```diff
-const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
+import {groqChat} from './groqClient.js';
+import {poolSize} from './keyPool.js';
 ...
-export const liveReady = () => ['mira','arjun','nova','sage','leo'].every(id => !!agentKey(id));
+export const liveReady = () => poolSize() > 0 || ['mira','arjun','nova','sage','leo'].every(id => !!agentKey(id));
 ...
-      response = await fetch(BASE_URL, { method: 'POST', signal: AbortSignal.any([...]), headers: {..., Authorization: `Bearer ${agentKey(agent)}` }, body: JSON.stringify({ ... }) });
+      response = await groqChat({ ...same body object... }, { signal: AbortSignal.any([...]), apiKey: agentKey(agent) });
```

### `.env.example`

Adds a documented, empty `GROQ_KEYS=` entry.

### `tests/students-api.test.js` — one word

That fixture deliberately blanks every Groq key to force guided-preview mode; it now blanks
`GROQ_KEYS` too. Without it, `liveReady()` (which now accepts a pool) would switch the fixture
to live mode and make real API calls during tests.

### `.env` (gitignored, not part of the diff)

`GROQ_KEYS=` appended with the 10 supplied keys. No key appears in any tracked file.

**Untouched:** frontend (`src/`, `public/`), Express routes in `server/index.js`, response
shapes, agent prompts and control flow in `server/agents.js` / `server/research.js`.

---

## 3. Decisions a reviewer should check

1. **`fetch` instead of `groq-ai-sdk`.** The repo has no Groq/OpenAI SDK; it uses plain
   `fetch`, and `tests/provider-recovery.test.js` asserts on `globalThis.fetch` options such as
   `options.headers.Authorization`. An SDK would break those tests and add a dependency.
   `groqChat()` keeps the SDK's params shape so a later swap is mechanical.
2. **429 responses are returned, not swallowed**, after attempts are exhausted, because
   `groq.js` derives daily-allowance fallback, request-size fallback, user notices and retry
   delays from `status`, `retry-after` and `error.message`.
3. **`liveReady()` now accepts a pool**, otherwise configuring only `GROQ_KEYS` would leave
   the app stuck in guided-preview mode and the pool would never be used. `/api/status` keeps
   the same shape; note its `agents` map still reports per-role keys and can be all-false while
   `live` is true (nothing in the frontend reads it today — worth confirming).
4. **No-pool path is bit-identical to the old behaviour**: `acquireKey()` returns `null`, one
   fetch happens with the agent's own key, no rotation, no cooldown.
5. **Pacing keys unchanged.** `provider-budget` / the per-key request queue still key off
   `agentKey(agent)` rather than the pool index (the index isn't known before the request).
   Round-robin headers therefore feed a per-agent budget. Left as-is to avoid restructuring —
   flag if you disagree.

### Requirement not applied: parallel agents

Parallelising with `Promise.all` was conditional on the agents being sequential **and**
independent. They are not: `planTurn` returns exactly one speaker per turn, the loop at
`server/agents.js:118` feeds each agent's reply into the next agent's `teammates_this_turn`
context, and the research stages (profile → discovery → verification → ranking → draft) each
consume the previous stage's output. `server/research.js:272` already uses `Promise.allSettled`
where calls are genuinely independent. Parallelising the rest would change agent logic.

---

## 4. Verification performed

| Check | Result |
| --- | --- |
| `npm test` | 148/148 pass, exit 0 |
| `node scripts/key-rotation-check.mjs --simulate` | 20 parallel requests in 51ms; keys 0 and 1 took the 429s, cooldown `1967ms` shown, 8/10 distinct keys served, spread `2,3,3,3,3,3,2,2,2,2` |
| Inline `completion()` check with a 3-key pool | `Bearer pool-key-0 → 429 (retry-after 60) → Bearer pool-key-1 → 200` in 11ms; `poolStats().coolingDownMs[0] = 59999` |
| Inline no-pool check | exactly 1 fetch, `Bearer <agent key>`, rotation inactive |
| Real 20-request run against Groq | not executed (spends quota) — run `node scripts/key-rotation-check.mjs` when ready |

## 5. Questions for the reviewer

1. Is returning the exhausted 429 response (rather than throwing) the right seam between
   `groqClient.js` and the existing quota logic in `groq.js`?
2. Should `liveReady()` accept a pool, and should `/api/status.agents` reflect pool membership?
3. Should the per-key request queue and token budget be keyed by the pool index instead of
   `agentKey(agent)` now that the bearer token is pooled?
4. Is the 30s cumulative wait cap before best-effort key selection acceptable, or should the
   caller receive a typed "all keys limited" error?
5. Should `tests/provider-recovery.test.js` gain a case with `GROQ_KEYS` set, asserting
   rotation and cooldown, rather than relying on the standalone script?
