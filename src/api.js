const configuredOrigin = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
// This is deliberately public configuration, not a secret. It lets the UI
// distinguish a sleeping/unreachable API from a Vercel deployment that was
// built without its server URL.
export const apiOriginConfigured = Boolean(configuredOrigin);
const wakingEvent = 'scholarx:api-waking';
const responsiveEvent = 'scholarx:api-responsive';
const coldStartDelayMs = 900;
let requestSequence = 0;

function trackApiRequest(path, request) {
  // Render's free instances can take a short time to wake. Keep ordinary
  // requests invisible, but tell the interface when a request is genuinely slow.
  if (typeof window === 'undefined') return request;
  const id = ++requestSequence;
  let settled = false;
  const timer = window.setTimeout(() => {
    if (!settled) window.dispatchEvent(new CustomEvent(wakingEvent, {detail: {id, path}}));
  }, coldStartDelayMs);

  return request.finally(() => {
    settled = true;
    window.clearTimeout(timer);
    window.dispatchEvent(new CustomEvent(responsiveEvent, {detail: {id, path}}));
  });
}

/** Keeps local development same-origin while allowing a Vercel frontend to use a deployed API. */
export function apiUrl(path) {
  if (!path.startsWith('/')) throw new Error('API paths must start with /.');
  return configuredOrigin ? `${configuredOrigin}${path}` : path;
}

export function apiFetch(path, options) {
  return trackApiRequest(path, fetch(apiUrl(path), options));
}

export function apiEventSource(path) {
  return new EventSource(apiUrl(path));
}
