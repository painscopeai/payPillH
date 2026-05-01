/**
 * Browser-side ceiling for `fetch` to the Express API on Vercel.
 * Keep below or equal to `functions.*.maxDuration` in vercel.json (60s) so the
 * client can surface HTTP error bodies (504/503) instead of AbortError first.
 */
export const API_FETCH_DEADLINE_MS = 58_000;

/** Reuse Authorization across burst admin calls (mount + analytics) to avoid stacked getSession latency. */
export const API_AUTH_BEARER_CACHE_MS = 10_000;
