const configuredOrigin = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

/** Keeps local development same-origin while allowing a Vercel frontend to use a deployed API. */
export function apiUrl(path) {
  if (!path.startsWith('/')) throw new Error('API paths must start with /.');
  return configuredOrigin ? `${configuredOrigin}${path}` : path;
}

export function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}

export function apiEventSource(path) {
  return new EventSource(apiUrl(path));
}
