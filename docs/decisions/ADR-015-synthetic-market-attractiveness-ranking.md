# ADR-015: Synthetic market attractiveness ranking

- Status: Proposed
- Date: 2026-07-31

## Context

The prototype needs a reviewable way to rank the supplied synthetic market
records without implying that public Census context, unapproved veterinary
directions, or incomplete source definitions are production scoring inputs.
Market attractiveness must remain separate from candidate-site feasibility and
execution readiness.

## Decision

Add a deterministic, versioned market-attractiveness engine and ranking view
for records labeled `Hypothesis` and `synthetic_prototype_only`.

The engine:

- uses ten explicitly configured metrics across four dimensions;
- normalizes and ranks metropolitan and micropolitan markets separately;
- applies cohort-specific 2nd and 98th percentile winsorization;
- uses empirical percentile normalization and configured direction reversal;
- exposes each metric's raw value, normalization, weight, and contribution;
- fails closed on missing configured inputs;
- runs fixed five-point dimension-weight sensitivity scenarios; and
- keeps the synthetic ranking separate from public CBSA market context.
- permits an exact, unique name crosswalk to `SRC-014` solely to attach stable
  CBSA identifiers for map presentation, while leaving unmatched records null.

The implementation and assumptions are documented in
`docs/technical/market-attractiveness-scoring.md`.

## Alternatives considered

1. Rank all markets in one cohort. Rejected because scale and structural
   differences make metropolitan and micropolitan percentiles misleading.
2. Use raw min-max normalization. Rejected because extreme scale values would
   dominate and make results unstable.
3. Let missing values score as zero or reweight automatically. Rejected because
   either approach hides missingness and silently changes the model.
4. Blend public Census context into the rank. Rejected because that dataset is
   currently approved only as `market_context_only`.
5. Ask AI to infer weights or final rankings. Rejected because scoring must be
   deterministic, configurable, versioned, and testable.

## Consequences

- Analysts can inspect and challenge every contribution and assumption.
- Rankings are reproducible for a fixed snapshot and configuration.
- The UI must keep synthetic labels and non-recommendation language visible.
- A configuration change requires a new version and updated evaluation cases.
- Business owners must approve definitions, directions, weights, and data
  governance before a production interpretation is possible.

## Evidence references

- `PROJECT_CONTEXT.md`
- `docs/product/mvp-scope.md`
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `docs/research/claim-ledger.md`
- `docs/product/open-questions.md`
