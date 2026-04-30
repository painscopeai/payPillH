# PayPill dashboard wellness metrics — documentation index

## Purpose

This folder describes how **server-side wellness summaries** are built from onboarding, profiles, and vitals. Code lives under `apps/api/src/health-risk/`.

## Intended use

Scores are **informational** and support discussion with a clinician. They are **not** a diagnosis or emergency tool unless the product is validated separately for your jurisdiction.

## Contents

| Document | Description |
|----------|-------------|
| [KNOWLEDGE_BASE.md](./KNOWLEDGE_BASE.md) | Product stance, UK references, disclaimers |
| [RULE_CATALOG.md](./RULE_CATALOG.md) | What each scoring helper does (changelog) |
| [INFERENCE_ENGINE.md](./INFERENCE_ENGINE.md) | Request flow, caching, snapshots |
| [SOURCES.bib](./SOURCES.bib) | Optional bibliographic notes |
| [OPERATIONS.md](./OPERATIONS.md) | Endpoint, env vars, tests |

### Running tests

```bash
cd apps/api && npm test
```

## Versioning

When weights or normalization change, bump **`ENGINE_VERSION`** in `apps/api/src/health-risk/engineVersion.js` and add a row to **`RULE_CATALOG.md`** changelog.

## Updating behaviour

1. Change code under `apps/api/src/health-risk/`.
2. Update `RULE_CATALOG.md` if user-visible meaning changes.
3. Add or adjust tests in `apps/api/src/health-risk/__tests__/`.
