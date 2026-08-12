# ADR-020: Typed deterministic evaluation operators

- Status: Accepted
- Date: 2026-08-10

## Context

Clinic scoring, synthetic market screening, submarket comparison, geography
joins, and evidence artifacts use deterministic logic but expose
vertical-specific entry points. Reusable evaluation workflows need generic
operators without allowing natural-language instructions to become calculation
inputs or weakening existing evidence boundaries.

## Decision

Add versioned, strict Zod inputs for these deterministic operators:

- `normalize_metric`
- `join_geography`
- `filter_eligible_entities`
- `compare_cohort`
- `calculate_weighted_result`
- `run_sensitivity`
- `render_artifact`

Every input records an operator version and exactly one decision layer:
`market_attractiveness`, `submarket_opportunity`, `property_feasibility`, or
`execution_priority`. Operators reject unknown fields and natural-language
instruction shapes. Numeric operators retain formula, normalization,
configuration, missing-data, input, transformation, and source provenance.

Clinic normalization and weighted calculation run through the generic
operators while preserving the existing public result contract, warning order,
constraint behavior, score precision, and sensitivity behavior. Qualitative
evidence cannot enter a weighted operator. Public Census and minimized Esri
context remain ineligible for scoring.

## Alternatives considered

- Replace all vertical scorers at once: rejected because market, clinic, and
  Seattle normalization and sensitivity semantics differ.
- Accept prompts and infer operator arguments: rejected because calculations
  must receive validated structured inputs.
- Collapse the four decision layers into one score: rejected because the
  layers answer different questions and have different evidence requirements.

## Consequences

- New vertical adapters can reuse validated deterministic primitives.
- Existing clinic fixture outputs provide a golden regression boundary.
- Vertical-specific orchestration and presentation remain responsible for
  domain language, warnings, and human-review gates.
- Operator or formula changes require explicit version changes and regression
  updates.
- Production data access and eligibility assumptions do not change.

## Evidence

- `SRC-001`
- `SRC-003`
- `SRC-014`
- `SRC-015`
- `SRC-016`
- `SRC-017`
- `CLM-001`
- `CLM-014`
- `CLM-017`
- `CLM-020`
- `CLM-022`
