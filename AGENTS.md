# Project instructions

This repository is a clinic-first, evidence-backed prototype for evaluating candidate Chewy Vet Care locations.

## Required reading

Before changing product behavior, read:

1. `PROJECT_CONTEXT.md`
2. `docs/research/agent-data-source-guide.md`
3. `docs/product/mvp-scope.md`
4. `docs/technical/data-contracts.md`
5. `docs/technical/ai-boundaries.md`
6. `docs/research/claim-ledger.md`
7. `docs/product/open-questions.md`

## Working rules

- Distinguish `Confirmed`, `Reported`, `Derived`, `Hypothesis`, and `Unknown` evidence.
- Cite source IDs from `docs/research/source-registry.md` when converting research into requirements.
- Never assume an Esri layer, Snowflake table, Tableau workbook, API, or export path is accessible unless documented.
- Keep geospatial calculations and site scoring deterministic, configurable, versioned, and testable.
- AI may summarize evidence, compare structured results, and identify missing information.
- AI must not invent data, silently alter weights, or make a final real-estate decision.
- Use synthetic or explicitly approved de-identified data until governance and access are confirmed.
- Do not place credentials, customer-level data, precise customer coordinates, medical records, or copied internal reports in Git.
- Update the decision log when scope, architecture, metrics, or data contracts change.
- Add or update evaluation cases for every change to scoring behavior.
- Treat the existing internal site-selection MVP plan as possible roadmap overlap until ownership and status are confirmed.

## Development sequence

1. Resolve the blocking questions in `docs/product/open-questions.md`.
2. Validate data availability and data quality.
3. Implement deterministic calculations and scoring with synthetic data.
4. Validate the non-AI baseline.
5. Add AI-generated explanations only after structured outputs are reliable.

## Approval

Repository documents and scope changes require user review before they are committed.
