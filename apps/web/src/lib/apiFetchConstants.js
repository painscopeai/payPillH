/**
 * Browser-side ceiling for `fetch` to the Express API on Vercel.
 * Keep a few seconds below `functions.*.maxDuration` in vercel.json (300s on Pro)
 * so the client rarely aborts before the function returns (504 JSON vs AbortError).
 */
export const API_FETCH_DEADLINE_MS = 290_000;

/** Reuse Authorization across burst admin calls (mount + analytics) to avoid stacked getSession latency. */
export const API_AUTH_BEARER_CACHE_MS = 10_000;
