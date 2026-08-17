# ADR-028: Register Google Ads as matched-location context only

## Status

Proposed for repository-owner review.

Date proposed: 2026-08-17.

## Context

Two user-supplied Google Ads Matched Locations CSV exports are available for the
local demo. They contain aggregate delivery, cost, and conversion metrics for
2026-07-18 through 2026-08-16. They do not contain a Google location ID, CBSA
code, ZIP code, DMA code, or another approved stable geography key. Their only
location field is a human-readable matched-location label.

The platform needs useful marketing evidence without presenting a display label
as a safe cross-source key or inventing regional results.

## Decision

Register `SRC-018` through a deterministic matched-locations adapter and store
the transformed observations in a separate Parquet table. Preserve exact source
labels, source hashes, source row numbers, observation dates, reported metrics,
quality checks, and warnings. Do not copy the raw CSV exports into the snapshot
or Git.

Every observation is internal, Reported evidence with
`matched_location_descriptive_context_only` use. Stable geography ID remains
`null`. Market joins, fuzzy matching, cross-source regional comparison, scoring,
ranking, recommendations, campaign mutation, and external writes are blocked.

The canonical market evidence table remains keyed only by approved market IDs.
Google Ads observations may enter a response only through an explicit
matched-location context query. A future keyed market query requires stable
Google location IDs and an approved deterministic bridge.

## Consequences

The local snapshot can truthfully show what the supplied Google Ads reports say
about their own matched-location labels. It cannot claim that those labels are
the same as the platform's CBSA markets or use them to rank opportunities.

The data-quality layer can validate source structure, dates, uniqueness,
nonnegative measures, CTR, average CPC, and cost per conversion. It cannot
recompute the reported conversion rate because the required interaction
denominator is absent from the export.

## Alternatives considered

1. Treat matched-location text as a CBSA or DMA key. Rejected because labels are
   not stable identifiers and may use different geographic definitions.
2. Fuzzy-match labels to the CBSA registry. Rejected because silent entity
   resolution would create unreviewed geography claims.
3. Leave Google Ads completely unavailable. Rejected because the reports are
   still valid descriptive evidence within their source-defined grain.

## Evidence references

- `SRC-018` in `docs/research/source-registry.md`
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `docs/product/open-questions.md`
- `lib/adapters/google-ads/matched-locations.ts`
- `tests/adapters/google-ads/google-ads-matched-locations.test.ts`
