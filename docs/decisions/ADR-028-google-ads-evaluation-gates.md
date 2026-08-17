# ADR-028: Google Ads evaluation gates

- Status: Proposed
- Date: 2026-08-13

## Context

The workspace now has read-only Google Ads geographic exports, documentation
for an existing DMA spend and first-party outcome path, campaign taxonomy, and
geo-test references. These sources are useful for validating a future Marketing
evaluation, but none establishes an approved product connection or permits an
observational platform metric to become a market recommendation.

## Decision

Advance the capability registry to version `1.1.0` while retaining
`local_growth_test` as `planned`. Growth-test measurement requires an approved
weekly DMA campaign aggregate, first-party regional outcome, campaign taxonomy
and comparison cohort, versioned DMA-to-market relationship,
conversion/attribution/lag contract, geo-experiment design, and measurement
approval.

Manual `SRC-018` UI exports remain validation evidence outside Git. They do not
satisfy an `approved_*` evidence requirement. DMA is the default comparable
Marketing grain; postal evidence is a gated drill-down. Physical presence,
location interest, configured targets, postal geography, DMA, and CBSA remain
distinct.

## Consequences

- Google Ads and paid-search questions route to Marketing evidence readiness.
- Missing approvals remain visible for planned and unavailable capabilities.
- Supplying every evidence identifier cannot activate a capability whose
  registry status is still `planned`.
- The opening Marketing views may reference the new sources, but remain
  evidence-needed, non-scored, and unavailable for map calculation.
- A later status change requires owner review, a governed data path, and shadow
  evaluation rather than only a code or prompt change.

## Evidence

- `SRC-018` through `SRC-024`
- `CLM-032` through `CLM-043`
- `OQ-033` through `OQ-040`
