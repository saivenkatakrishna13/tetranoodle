// Shared Groq API key pool. Every agent draws its key from here so one
// rate-limited key never blocks the whole team.
// Keys are read from GROQ_KEYS (comma-separated) at call time; nothing is hardcoded.
const DEFAULT_COOLDOWN_MS = 60_000; // used when a 429 carries no Retry-After header
const MAX_WAIT_MS = 5_000;          // longest single wait while every key is cooling down
export const POOL_WAIT_BUDGET_MS = 30_000; // whole-request wait budget; a request can never hang on cooldowns

const state = { cursor: 0, cooldowns: new Map(), uses: [] };

export function poolKeys() {
  return String(process.env.GROQ_KEYS || '')
    .split(',')
    .map((key) => key.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}
export const poolSize = () => poolKeys().length;
export const poolEnabled = () => poolSize() > 0;

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Stopped', 'AbortError'));
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Stopped', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Round-robin over the pool, skipping keys that are cooling down.
// Returns null when no shared pool is configured (caller falls back to its own key).
export async function acquireKey({ signal, deadline } = {}) {
  const keys = poolKeys();
  if (!keys.length) return null;
  const limit = deadline || Date.now() + POOL_WAIT_BUDGET_MS;
  let waited = 0;
  for (;;) {
    const now = Date.now();
    for (let probe = 0; probe < keys.length; probe++) {
      const index = (state.cursor + probe) % keys.length;
      const until = state.cooldowns.get(index);
      if (until === undefined || until <= now) {
        if (until !== undefined) state.cooldowns.delete(index);
        state.cursor = (index + 1) % keys.length;
        state.uses[index] = (state.uses[index] || 0) + 1;
        return { key: keys[index], index, count: keys.length };
      }
    }
    // Every key is cooling down: wait for the earliest one, at most MAX_WAIT_MS, then retry.
    const earliest = Math.min(...state.cooldowns.values());
    const wait = Math.min(Math.max(earliest - Date.now(), 1), MAX_WAIT_MS, Math.max(limit - Date.now(), 0) || 1);
    if (Date.now() + wait > limit) {
      const index = [...state.cooldowns.entries()].sort((a, b) => a[1] - b[1])[0][0];
      state.cursor = (index + 1) % keys.length;
      state.uses[index] = (state.uses[index] || 0) + 1;
      return { key: keys[index], index, count: keys.length };
    }
    waited += wait;
    await sleep(wait, signal);
  }
}

// Mark a key as rate-limited until the provider's Retry-After time (default 60s).
export function markLimited(index, retryAfterSeconds) {
  const seconds = Number(retryAfterSeconds);
  const cooldownMs = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 600) * 1000 : DEFAULT_COOLDOWN_MS;
  state.cooldowns.set(index, Date.now() + cooldownMs);
}

// Observability for the rotation check script: uses per key and remaining cooldowns.
export function poolStats() {
  const keys = poolKeys();
  const now = Date.now();
  return {
    size: keys.length,
    cursor: state.cursor,
    uses: keys.map((_, index) => state.uses[index] || 0),
    coolingDownMs: keys.map((_, index) => Math.max(0, (state.cooldowns.get(index) || 0) - now)),
  };
}

export function resetPool() {
  state.cursor = 0;
  state.cooldowns.clear();
  state.uses.length = 0;
}
