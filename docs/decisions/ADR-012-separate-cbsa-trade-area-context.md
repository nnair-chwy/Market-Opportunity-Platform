# ADR-012: Separate public CBSA and internal trade-area context

- Status: Accepted
- Date: 2026-07-30

## Context

The existing market view uses public Census CBSA definitions, geometry, and
ACS evidence. `SRC-017` contains local aggregate values labeled by source Esri
IDs, but it does not define a trade-area role, construction method, observation
date, or safe polygon. Combining these sources on one boundary would imply a
geographic equivalence the evidence does not support.

## Decision

Keep Public CBSA context and internal Esri local evidence in separate panels
and contracts. Present the internal panel to analysts as optional `Linked site
evidence`, after the market comparison, and use a compact coverage notice when
the selected market has no linked records. Join Esri records only through the
prompt-one fixture crosswalk.
Do not add internal values to CBSA GeoJSON, draw a trade-area polygon, derive
density, or transmit them to the basemap provider.

Allow explicit site and variant selection, including all one-to-many records.
Display safe raw values and provenance with unknown-date, unknown-method,
unknown-role, and synthetic warnings. Permit a bounded comparison of up to
three raw profiles with comparability warnings and no composite or winner.

## Alternatives considered

- Add Esri values to the CBSA panel: rejected because their geography is not
  established as a CBSA.
- Draw a radius or drive-time polygon: rejected because the source supplies no
  approved method or geometry.
- Select one source variant automatically: rejected because no primary-role
  rule is documented.
- Replace unknown dates with the receipt date: rejected because receipt does
  not establish observation vintage.

## Consequences

- Analysts can inspect richer local evidence without confusing its boundary
  with Census geography.
- Comparisons remain descriptive and may be non-comparable.
- Age, income-band, risk, and labor sections remain unavailable until their
  definitions and direction are approved.
- All internal local evidence remains non-scored and internal-demo only.

## Evidence

- `SRC-015`
- `SRC-016`
- `SRC-017`
- `CLM-026`
- `CLM-027`
- `CLM-029`
- `CLM-030`
