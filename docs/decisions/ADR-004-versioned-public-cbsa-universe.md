# ADR-004: Versioned public CBSA market universe

## Status

Proposed

## Date

2026-07-29

## Context

The evaluator needs a stable market universe before later public market
evidence can be joined or reviewed. The official July 2023 Census release
provides both CBSA county delineations and principal cities for metropolitan and
micropolitan statistical areas.

The product scope and production scoring inputs remain provisional. A market
universe is reference data, not a population measure, ranking, model feature,
or real-estate recommendation.

Evidence: `SRC-014` and `CLM-025`.

## Decision

Add a deterministic public-data build that:

- downloads the exact July 2023 Census delineation and principal-city files;
- validates HTTP responses, XLSX structure, required columns, codes,
  relationships, and duplicates;
- uses an explicit state FIPS allowlist for the contiguous 48 states and
  Washington, DC;
- retains both metropolitan and micropolitan CBSAs;
- aggregates counties, states, and principal cities deterministically;
- writes a versioned JSON market snapshot, rejected-row audit, and manifest;
- records input and output SHA-256 hashes plus retrieval and count metadata; and
- labels every market `Confirmed`, `public`, `market_context_only`, with
  `scoring_eligibility: none`.

The build fails closed when the source structure changes or an input row is
malformed, duplicated, inconsistent, or orphaned. Rejected rows never become
markets. Downloaded XLSX files remain in an ignored cache.

## Alternatives

### Maintain a hand-authored CBSA list

Rejected because manual updates would be difficult to reproduce, validate, and
audit.

### Keep metropolitan areas only

Rejected because the transformed source snapshot should preserve the complete
eligible CBSA universe. A later interface may apply a reversible display
default without discarding reference data.

### Infer mainland scope from names, coordinates, or bounding boxes

Rejected because component state FIPS codes provide a more explicit and
testable eligibility rule.

### Treat the universe as a scoring input

Rejected because a geography reference does not establish an approved metric,
direction, threshold, weight, or outcome relationship.

## Consequences

- Later public datasets can join to a stable, versioned `cbsa:<code>` identity.
- Builds remain sensitive to upstream workbook changes by design.
- The repository gains one development dependency for robust XLSX parsing.
- Retrieval timestamps can differ across builds while transformed market
  ordering and content remain deterministic for identical inputs.
- Source vintage, hashes, exclusions, missingness, and rejected inputs remain
  inspectable.
- Product ownership, scoring criteria, outcomes, and internal-data access remain
  unresolved.
- User review is required before this ADR is accepted or committed.
