# Knowledge base — concepts and UK alignment

## 1. Ten-year cardiovascular disease (CVD) risk

**Definition:** In UK primary care, **QRISK3** estimates the **10-year risk of cardiovascular events** (heart attack or stroke) for adults in **primary prevention** (typically without existing CVD), using population-derived coefficients (QResearch).

**UK alignment:** NICE guideline **NG238** (Cardiovascular disease: risk assessment and reduction, including lipid modification) references risk assessment with validated tools appropriate to the population. QRISK3 is widely used in NHS England contexts for primary-prevention risk discussion.

**Important limitation:** QRISK is **not** intended for people with **existing cardiovascular disease** (secondary prevention); management follows different pathways.

## 2. Chronic condition burden index

**Definition (PayPill):** A **0–100 index** summarising **count and severity** of self-reported long-term conditions and family history tokens parsed from free text. It is **not** the same as epidemiological “probability of developing chronic disease” and must **not** be labelled as a validated disease incidence model.

## 3. Medication adherence

**Definition (clinical):** Adherence is typically measured against **prescribed regimens** (e.g. proportion of days covered, self-report scales).

**PayPill status:** Without structured prescription/refill data or validated adherence instruments in the app, we expose **no numeric adherence score** (`insufficient_data`). Future integration may include pharmacy feeds or PRO questionnaires.

## 4. Preventive care reminders

**Definition:** Age/sex-based **non-diagnostic reminders** aligned with common UK **population screening** themes (e.g. NHS Health Check age band, seasonal immunisation messaging). These are **not** individual clinical schedules and may differ from what a GP recommends.

## 5. Data sources in PayPill

| Source | Content |
|--------|---------|
| `patient_profiles.payload` | Onboarding steps `step1`–`step14` JSON |
| `profiles` | Demographics, `onboarding_draft`, `date_of_birth` |
| `vitals` | Time series `metrics` JSON (e.g. systolic BP) |

## 6. Confidence and imputation

When cholesterol, deprivation (Townsend), or BP variability are **missing**, the engine applies **documented defaults** (see `INFERENCE_ENGINE.md`) and lists them in **`imputedFields`**. Outputs should be interpreted as **lower confidence** when many fields are imputed.

## 7. Regulatory note (UK)

Embedding QRISK-style algorithms in software used for **individual clinical decisions** may trigger **medical device** obligations (MHRA). PayPill must display **disclaimers** and avoid presenting outputs as statutory NHS/QOF scores unless using a **validated, registered** integration path. See ClinRisk additional terms shipped with `sisuwellness-qrisk3`.
