# PayPill health risk engine — documentation index

## Purpose

This folder holds the **expert-system knowledge artefacts** for patient-facing **wellness metrics** computed server-side from onboarding payloads, profiles, and vitals. It is the canonical reference for clinicians and engineers when extending rules or validating outputs.

## Intended use (non-clinical device disclaimer)

Scores produced by this engine are **decision-support for wellness and discussion with a clinician**. They are **not** a substitute for diagnosis, prescribing, or emergency care unless the product is separately validated and registered as appropriate for your jurisdiction (e.g. UK MHRA).

## Contents

| Document | Description |
|----------|-------------|
| [KNOWLEDGE_BASE.md](./KNOWLEDGE_BASE.md) | Concepts, UK references (NICE, NHS), limitations |
| [RULE_CATALOG.md](./RULE_CATALOG.md) | Rule IDs, statements, inputs/outputs, citations |
| [INFERENCE_ENGINE.md](./INFERENCE_ENGINE.md) | Normalization, forward chaining order, QRISK imputation |
| [SOURCES.bib](./SOURCES.bib) | References for citations |
| [OPERATIONS.md](./OPERATIONS.md) | Endpoint, env vars, tests, snapshots |

### Running tests

```bash
cd apps/api && npm test
```

## Versioning

When rule weights or QRISK imputation defaults change, bump **`ENGINE_VERSION`** in `apps/api/src/health-risk/engineVersion.js` and record the change in `RULE_CATALOG.md` (changelog section).

## Updating expert knowledge

1. Propose change in `RULE_CATALOG.md` with citation.
2. Update YAML/JSON under `apps/api/src/health-risk/rules/` if needed.
3. Add or adjust tests in `apps/api/src/health-risk/__tests__/`.
4. Never change QRISK coefficients; only inputs and mapping.
