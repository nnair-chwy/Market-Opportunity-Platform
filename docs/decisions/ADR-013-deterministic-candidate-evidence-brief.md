# ADR-013: Deterministic candidate evidence brief and safe print model

- Status: Accepted
- Date: 2026-07-30

## Context

The portfolio-readiness and trade-area capabilities organize bounded
`SRC-017` evidence but do not provide one analyst handoff that combines
identity, local context, clinic landscape, physical-site evidence, diligence,
and follow-up questions. The supplied clinic layer contains account rows,
repeated coordinates, and restricted operational fields without an approved
physical-location or geography rule. Browser print could also expose values if
it rendered directly from raw source records.

## Decision

Build a deterministic candidate-evidence projection over the shared fixture,
readiness, field catalog, crosswalk, and trade-area profile contracts. Keep a
fixed six-section order and generate open-ended follow-up questions through
rules. Accept two to five candidates in analyst selection order and show raw
values with date, method, unit, source, quality, and missingness warnings.

Use a separate, explicit `SYN-CLINIC-LANDSCAPE-001` fallback for five audited
demo records. It distinguishes source-account rows from estimated physical
locations but performs no geospatial calculation. Mark the synthetic snapshot
stale and preserve its hypothesis status.

Represent restricted and rejected source areas with labels and `null` values.
Never admit supplied clinic rows, lease terms, rent, landlord identity, direct
identifiers, customer, prescription, or other prohibited values. Print only
the minimized brief object through browser print CSS. Keep the brief and
comparison outside the scoring sandbox with `scoring_eligibility: none`.

## Alternatives considered

- Build a second evidence store: rejected because it would duplicate and drift
  from the shared Esri contracts.
- Deduplicate clinic rows into physical locations: rejected because no approved
  identity, lifecycle, or geography rule exists.
- Display competitor distance: rejected because its unit and calculation
  method are not confirmed.
- Generate the brief with AI: rejected for the baseline because evidence
  organization and questions must remain reproducible without a model.
- Export a PDF file: rejected because browser print meets the demo need without
  adding a dependency or another sensitive artifact.

## Consequences

- Analysts can inspect and print a source-linked brief and compare three demo
  candidates without scoring or winner language.
- Synthetic clinic values are visibly separate and cannot be mistaken for the
  supplied clinic layer.
- Missing, unknown, restricted, rejected, stale, and conflicting evidence
  remains visible.
- Production clinic-landscape summaries, physical-site definitions, print
  permissions, and sharing controls remain open prerequisites.

## Evidence

- `SRC-017`
- `SYN-CLINIC-LANDSCAPE-001`
- `CLM-017`
- `CLM-028`
- `CLM-029`
- `CLM-030`
- `CLM-031`
