# Inference overview (v2.1)

## Dashboard `GET` path (production)

1. **Single query:** `profiles` for the current user (`id, onboarding_draft, date_of_birth, …`).  
2. **Facts** are built only from **`onboarding_draft`** step payloads (no `patients`, `patient_profiles`, or `vitals` table reads on this path — avoids Vercel timeouts).  
3. **Scores:** `computeFallbackComposite`, `computeChronicBurdenIndex`, `buildVitalsSeries` (BP from draft step3 if present), `buildPreventiveGaps`.  
4. **No** `health_dashboard_metrics` read/write on the request path (that I/O was removed for latency).

## Optional full normalization

`normalizeFromSupabase()` in `normalizeFromSupabase.js` still loads patient payload + vitals for other use cases; the patient dashboard **does not** call it.
