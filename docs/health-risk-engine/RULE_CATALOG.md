# Rule catalogue

Rules are implemented in code and YAML under `apps/api/src/health-risk/rules/`. Each rule has a stable ID for logs and API `appliedRules[]`.

## Changelog

| Date | Engine | Change |
|------|--------|--------|
| 2026-04-29 | 1.0.0 | Initial catalogue: QRISK3 path, fallback composite, chronic burden, preventive hints |
| 2026-04-29 | 1.0.0 | Trend delta uses last snapshot even when throttling skips insert; added `npm test` + unit tests |

---

### RULE-FB-001 — Fallback cardiovascular composite

**Statement:** If QRISK3 cannot run (missing sex/age, out of age range 25–84, or existing CVD exclusion), compute a weighted composite from age bands, condition severity, medication burden, vitals thresholds, lifestyle tokens, and family history (inherits logic aligned with `health.js` heuristics).

**Inputs:** `PatientFacts`  
**Outputs:** `fallbackCvdIndex` (0–100), `riskFactors[]`  
**Citation:** Internal heuristic; not equivalent to QRISK3.

---

### RULE-QRISK-001 — QRISK3 primary path

**Statement:** When mandatory inputs are present after imputation, call **QRISK3-2017** via `sisuwellness-qrisk3` (`calculateScore`). Sex must be `male` or `female`; ethnicity encoded per ClinRisk nine-category mapping.

**Inputs:** Imputed biometric/clinical mapping  
**Outputs:** `cvd10yPercent` (algorithm output), `method: QRISK3`  
**Citation:** Hippisley-Cox et al., BMJ 2017; QRISK3-2017 implementation per ClinRisk LGPL release.

---

### RULE-COND-001 — Chronic burden scoring

**Statement:** Map condition phrases to high/moderate/default buckets; cap contribution per catalogue; include family history keywords.

**Outputs:** `chronicBurdenIndex` 0–100  

---

### RULE-PREV-001 — Preventive hints (UK-themed)

**Statement:**  
- Ages **40–74**: suggest discussing **NHS Health Check** (England) — wording as reminder only.  
- **Annual flu vaccine**: seasonal reminder (not patient-specific contraindications).  
- **Lipid assessment**: reminder if no structured lipid data (heuristic).

**Outputs:** `preventiveGaps[]` with status `due` | `overdue` | `scheduled`

---

### RULE-VITAL-001 — Vitals series

**Statement:** Prefer last **14** `vitals` rows with systolic BP in `metrics`; else single point from onboarding step3.

**Outputs:** `vitalsSeries` for charting  

---

### RULE-ADH-001 — Adherence

**Statement:** Do not infer adherence from free-text medications alone.

**Outputs:** `adherence.score = null`, `reason = insufficient_data`
