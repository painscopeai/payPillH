# Inference overview (v2.1)

## Dashboard `GET` path (production)

1. **Vercel:** `GET /api/health/patient-dashboard-metrics` is implemented by a **dedicated** serverless file (`api/health/patient-dashboard-metrics.mjs`), **not** the full Express app (`api/index.mjs`), so cold starts do not load every API route.  
2. **Single query:** `profiles` for the current user (`id, onboarding_draft, date_of_birth, …`).  
3. **Facts** are built only from **`onboarding_draft`** step payloads (no `patients`, `patient_profiles`, or `vitals` table reads on this path).  
4. **Scores:** `computeFallbackComposite`, `computeChronicBurdenIndex`, `buildVitalsSeries`, `buildPreventiveGaps`.  
5. **No** `health_dashboard_metrics` on this request path.

## Optional full normalization

`normalizeFromSupabase()` in `normalizeFromSupabase.js` still loads patient payload + vitals for other use cases; the patient dashboard **does not** call it.
