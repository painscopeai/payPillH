# Wellness score catalogue (v2)

High-level behaviour encoded in code under `apps/api/src/health-risk/`. Bump **`ENGINE_VERSION`** when weights change.

## Changelog

| Date | Engine | Notes |
|------|--------|--------|
| 2026-04-30 | 2.1.0 | Dashboard uses **profile-only** normalization (one DB query); snapshot table removed from hot path |
| 2026-04-29 | 2.0.0 | QRISK removed; single wellness score (`WELLNESS_SCORE`) |
| 2026-04-29 | 1.0.0 | Initial composite + chronic burden + preventive hints |

## Primary score (`computeFallbackComposite`)

Weighted blend (see `fallbackComposite.js`) of:

- Age band risk  
- Condition list (normalized phrases)  
- Medication free text heuristics  
- Vitals (BP, BMI, heart rate)  
- Lifestyle / smoking bands from free text  
- Family history coronary flag  

Output: **0–100** (higher = more factors flagged — heuristic only, not a validated clinical risk tool).

## Chronic burden (`computeChronicBurdenIndex`)

Separate 0–100 index from condition keywords + family history.

## Preventive hints (`preventiveHints.js`)

Reminder-style items from age/sex and screening gaps — not automated scheduling.
