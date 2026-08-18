# ADR-032: Route question-faithful normalized evidence and isolate growth-test screening

## Status

Proposed for repository-owner review.

Date proposed: 2026-08-17.

## Context

The question planner previously mapped aggregate clinic questions to a generic
CVC market-attraction interpretation. Editing that interpretation changed only
display text, while execution still used the original plan. The normalized
snapshot now contains reusable regional, clinic, and inferred Google Ads
evidence for many CBSAs, but the planner did not expose those registered query
paths.

The local demo also needs a bounded way to screen possible regional growth-test
markets. Ordinary descriptive questions must not silently become a universal
market-attraction score.

## Decision

Extend the constrained planning intent with requested metric IDs, source
families, registered normalized queries, an optional explicit metric sort, and
a separate ranking mode. Deterministic vocabulary routes regional context,
aggregate clinic context, Google Ads context, source coverage, multi-source
evidence, and two-to-five-market comparisons to the normalized snapshot.

Routing precedence keeps growth screening, source coverage, named multi-market
comparison, and explicit multi-source evidence ahead of generic clinic
performance or single-source wording. A named clinic-market performance
comparison defaults to total orders, total customers, Rx orders, net sales, and
Rx net sales and labels them descriptive aggregates rather than an approved
operating KPI. A named source-coverage question returns that market's present
and absent source flags instead of filtering the market out.

Generic “this market,” “this clinic,” and unspecified regional-opportunity
questions require clarification. They never inherit Phoenix or another hidden
geography. The exact synthetic clinic starter names Synthetic South Clinic and
its peer fixture and requires confirmation.

Descriptive and comparison routes never add a composite score. Comparison rows
remain in analyst order unless the question explicitly asks to sort or rank by
one compatible metric. Prescriptions map visibly to the supplied Rx-order and
Rx-sales fields and do not claim a validated prescription metric.

Editing the interpreted question invalidates the current plan. The browser
submits the edited question to the planning API, replaces intent, metrics,
geography, capability, and registered queries, and requires a second human
confirmation before execution.

Add one isolated deterministic screening configuration,
`growth-test-screening-v1`, with these fixed weights:

- 30 percent: 2024 to 2025 regional demand growth
- 25 percent: active customers per 1,000 households
- 20 percent: active-customer year-over-year growth
- 15 percent: veterinary-search Google Ads conversions
- 10 percent: household count

Each metric is converted to a zero-to-100 complete-cohort percentile. Missing
any configured metric excludes a market. Weights are not redistributed. Final
ties use ascending CBSA code. The response preserves metric percentiles,
contributions, the configuration fingerprint, exclusions, source IDs,
warnings, and snapshot and calculation versions.

The screening result is `Hypothesis` evidence for the local demo only. It does
not authorize a campaign, spend, clinic opening, market selection, or causal
claim.

## Consequences

- Question interpretation and execution now share one typed plan.
- Aggregate clinic questions no longer inherit generic footprint language.
- New source files can continue to enter through ADR-031 without adding
  arbitrary SQL or runtime reads from Downloads.
- Coverage means source presence, not quality or opportunity.
- Google Ads geography remains inferred demo context and carries its warning.
- Production scoring, experiment design, and market-selection authority remain
  unresolved.

## Alternatives considered

1. Fix only the displayed interpretation. Rejected because execution could
   still answer a different question.
2. Add one universal market-attraction score to every query. Rejected because
   it mixes decision layers and silently ranks descriptive questions.
3. Renormalize weights for incomplete markets. Rejected because scores would
   represent different formulas across markets.
4. Let AI select SQL or repair geography. Rejected because query selection,
   joins, calculations, and missing-data policy must remain deterministic and
   testable.

## Evidence references

- `docs/decisions/ADR-031-demo-geography-normalization.md`
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `lib/planning/planner.ts`
- `lib/data-normalization/growth-screening.ts`
- `lib/planning/execute-plan.ts`
- `tests/normalized-question-routing.test.ts`
