# ADR-005: Public CBSA geometry and market-context UI

## Status

Proposed

## Date

2026-07-29

## Context

The phase 1 public-data build establishes a validated mainland market universe,
but it does not include display boundaries. An accessible exploration mode
needs stable geometry without relying on browser-time network requests or
internal and licensed providers.

The official 2024 Census national CBSA cartographic boundary file provides
1:5,000,000 geometry, five-digit CBSA codes, and source land and water area
observations.

Evidence: `SRC-014`, `SRC-015`, `CLM-025`, and `CLM-026`.

## Decision

Add a deterministic public-data build that:

- downloads and validates the exact official Census ZIP;
- records its SHA-256 hash, retrieval time, vintage, scale, and counts;
- reads Polygon and MultiPolygon features using explicit UTF-8 DBF decoding;
- joins to the validated mainland market universe by five-digit CBSA code;
- preserves source `ALAND` and `AWATER` instead of recalculating land area from
  simplified geometry;
- emits quantized and simplified TopoJSON with deterministic feature order;
- retains unmatched, duplicate, rejected, and missing geometry in a separate
  audit artifact; and
- fails when any validated mainland market lacks geometry or a source feature
  is duplicated or rejected.

Add a separate Public market context mode that:

- imports the built artifact instead of fetching geometry at runtime;
- renders neutral CBSA boundaries through the existing Albers USA approach;
- defaults the list and map to metropolitan statistical areas;
- optionally includes micropolitan statistical areas;
- supports search plus pointer and keyboard selection;
- displays name, code, type, principal cities, counties, states, vintages,
  sources, evidence status, sensitivity, and geometry availability; and
- remains isolated from candidate scoring and evaluated results.

## Alternatives

### Fetch Census geometry in the browser

Rejected because runtime responses could drift, fail, or bypass the versioned
manifest and audit trail.

### Use an internal or licensed basemap provider

Rejected because no such provider is authorized for this phase.

### Build a choropleth

Deferred because no validated ACS measure is loaded and neutral geometry avoids
implying a market comparison.

### Derive land area from simplified geometry

Rejected because simplification changes display geometry. The source `ALAND`
field remains the land-area observation.

## Consequences

- The browser gains a 667,059-byte TopoJSON artifact covering all 917 validated
  mainland markets.
- Eighteen non-mainland source features remain visible in the audit result as
  unmatched to the mainland universe.
- The interface can explore Census statistical-area context without implying a
  score, rank, opportunity, attractiveness assessment, or recommendation.
- CBSA polygons must not be described as trade areas, drive-time polygons, or
  service areas.
- New development dependencies support shapefile reading and reproducible
  TopoJSON conversion.
- User review is required before this ADR is accepted or committed.
