# ADR-011: Minimized Esri internal-demo fixture and portfolio readiness

- Status: Accepted
- Date: 2026-07-30

## Context

Five user-supplied Esri exports provide clinic, master-site, and aggregate
trade-area evidence, but the raw files contain direct identifiers,
commercially sensitive terms, unapproved clinic-level fields, and unresolved
definitions. The application needs a safe shared foundation for three
analyst-facing demo capabilities without implying production access or scoring
approval.

## Decision

Build a deterministic, versioned, minimized fixture from `SRC-017`. Retain the
71 user-approved master-site names and coordinates, approved identity and
physical-site fields, and selected aggregate trade-area values. Exclude clinic
row values and prohibited commercial, direct-identifier, employee, and
customer-level fields.

Use stable IDs derived from master `GlobalID`, preserve source relationships
without automatic repair, and create explicitly synthetic `Hypothesis`
trade-area records only for the four sites without a source match. Calculate
workflow-stage readiness as deterministic evidence completeness. Expose it as
a separate Locations view and keep all outputs at `scoring_eligibility: none`.

## Alternatives considered

- Check in raw exports: rejected because it violates data minimization and
  repository handling rules.
- Use only synthetic sites: rejected because the user approved a bounded,
  more realistic internal demonstration using the supplied master records.
- Treat completeness as a site-quality score: rejected because data
  availability does not establish attractiveness or suitability.
- Infer missing and ambiguous trade-area links: rejected because the source
  does not define a safe repair rule.

## Consequences

- Later descriptive capabilities can reuse one governed fixture and provenance
  contract.
- The fixture is suitable only for this internal prototype.
- All source observation dates and trade-area construction methods remain
  unknown, so source-linked records require review.
- Four sites remain blocked for real-data research despite synthetic contract
  fallbacks.
- Production ingestion, refresh, retention, access, and ownership remain open.

## Evidence

- `SRC-017`
- `CLM-017`
- `CLM-028`
- `CLM-029`
