# Inference overview (v2)

The dashboard uses a **single lightweight wellness score (0–100)** derived in `apps/api/src/health-risk/inferDashboardMetrics.js`.

## Data flow

1. Load the latest `health_dashboard_metrics` snapshot (if any) for **caching** and **trend deltas**.
2. If a snapshot is **under 20 minutes** old, same `ENGINE_VERSION`, and `cvd.method === 'WELLNESS_SCORE'`, return that summary immediately (fast path).
3. Otherwise: **normalize** profile, onboarding, and vitals from Supabase (`normalizeFromSupabase.js`).
4. **Cardiovascular / general wellness score:** `computeFallbackComposite` in `fallbackComposite.js` (weighted mix of age, conditions, medications, vitals, lifestyle, family history).
5. **Chronic burden, vitals series, preventive hints** use the same normalized facts.
6. Optionally **persist** a new snapshot (throttled, e.g. every 6 hours) to `health_dashboard_metrics`.

## Trends

`cvdDeltaPercent` is the change in the primary score vs the last stored snapshot when a prior numeric value exists. Not a clinical risk algorithm — informational only.
