# ADR-034: Keep clinic-location interpretation aligned with the executable query contract

## Status

Proposed for repository-owner review.

Date proposed: 2026-08-18.

## Context

The primary planner resolved named clinic-location questions to the correct
CBSA, but the analysis-brief layer replaced every question containing opening
or location language with one hard-coded national three-to-five-market
screening question. The displayed interpretation, method, executed geography,
and final packet could therefore describe different analytical targets.

The normalized snapshot already exposes registered exact-CBSA regional and
aggregate clinic queries. Capacity, workforce, competitive access, property,
trade-area feasibility, economics, and opening authority remain unavailable.

## Decision

Named-market clinic-location questions compile to a query-aware evidence
review. The plan preserves the resolved CBSA and deterministically selects
`regional_context_by_cbsa` and `clinic_context_by_cbsa`. Google Ads context is
added only when the question requests advertising or media evidence. The
response query is labeled `clinic_location_evidence_bundle` and composes only
registered normalized queries.

The analysis brief derives its question, geography IDs, sources, metrics,
registered queries, method, and missing-data rule from the validated plan. A
structured consistency validator stops browser execution when the brief and
plan differ in topic, perspective, geography IDs, source families, requested
metrics, registered queries, or scoring mode. Free-form ranking language is
also rejected when the plan has no registered ranking mode.

Named-market packets lead with connected public, regional, and aggregate
clinic evidence. Capacity, workforce, competitive access, property,
trade-area feasibility, economics, cannibalization, mature outcomes, and an
approved opening rule remain explicit missing evidence.

National clinic-opening questions do not receive a fabricated three-to-five
market shortlist. Without a registered clinic-location ranking contract they
remain an evidence-readiness investigation using footprint and public context
only, with no score, shortlist, or opening recommendation.

## Consequences

- The visible analyst question and executed Phoenix query use the same CBSA.
- Clinic-location evidence review reuses registered normalized queries and
  does not introduce arbitrary SQL.
- Existing clinic-performance routing remains separate.
- Missing opening-decision evidence stays visible rather than being inferred.
- National clinic-location exploration remains useful as evidence readiness,
  but it cannot claim a ranked market screen.

## Alternatives considered

1. Add a Phoenix-specific rewrite. Rejected because another named market would
   reproduce the same mismatch.
2. Keep the hard-coded question as display text only. Rejected because the
   displayed analysis contract would still disagree with execution.
3. Add a universal clinic-attractiveness score. Rejected because no approved
   clinic-location objective, weights, cohort, or decision rule exists.
4. Let AI select queries or SQL. Rejected because query choice, geography, and
   calculations must remain deterministic and testable.

## Evidence references

- `docs/decisions/ADR-032-question-faithful-normalized-evidence-routing.md`
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `lib/planning/planner.ts`
- `lib/planning/analysis-brief.ts`
- `lib/planning/execute-plan.ts`
- `lib/planning/reviewable-packet.ts`
- `tests/analysis-brief.test.ts`
- `tests/normalized-question-routing.test.ts`
