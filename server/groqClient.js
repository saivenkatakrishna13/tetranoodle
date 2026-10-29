// The one Groq call used by all five agents. Same params shape as
// client.chat.completions.create(params), sent with the project's plain fetch
// so no new dependency is introduced.
// - draws a key from the shared pool (server/keyPool.js)
// - on 429: marks that key limited and immediately retries with the next key
// - any other error is thrown normally
// - gives up after (number of keys * 2) attempts and returns the last 429 response,
//   so the caller's existing quota/fallback handling still runs
import { acquireKey, markLimited, poolSize, POOL_WAIT_BUDGET_MS } from './keyPool.js';

const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function groqChat(params, { signal, apiKey } = {}) {
  const attempts = Math.max(1, poolSize()) * 2;
  // One wait budget for the whole call: cooldown waiting must never stack per attempt.
  const waitDeadline = Date.now() + POOL_WAIT_BUDGET_MS;
  let lastResponse = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    // With no GROQ_KEYS pool the caller's own key is used and nothing is rotated.
    const chosen = await acquireKey({ signal, deadline: waitDeadline });
    const response = await fetch(BASE_URL, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chosen ? chosen.key : apiKey}` },
      body: JSON.stringify(params),
    });
    response.keyIndex = chosen ? chosen.index : null;
    if (response.status === 429 && chosen) {
      markLimited(chosen.index, response.headers.get('retry-after'));
      lastResponse = response;
      if (attempt < attempts - 1) continue; // rotate to the next available key right away
    }
    return response;
  }
  return lastResponse;
}
