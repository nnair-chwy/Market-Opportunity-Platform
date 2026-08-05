# Architecture

## Principle

The quantitative core is deterministic. AI operates only on structured, validated outputs.

```text
Approved source adapters
        |
        v
Validation and provenance
        |
        v
Geospatial and metric calculations
        |
        v
Normalization and versioned scoring
        |
        +--------------------+
        |                    |
        v                    v
Comparison interface   Structured result
                             |
                             v
                     AI draft explanation
                             |
                             v
                       Human review
```

## Logical components

1. **Source adapters:** use local synthetic candidate data and versioned, explicitly authorized public market-context snapshots; later adapters may target approved aggregates.
2. **Validation:** checks schema, units, ranges, freshness, lineage, missingness, and sensitivity.
3. **Metric engine:** performs geospatial or business calculations using explicit functions.
4. **Scoring engine:** applies named normalization and weight versions.
5. **Scenario engine:** creates temporary comparison scenarios without changing the approved baseline.
6. **Result store:** records input, calculation, configuration, and output versions.
7. **Review interface:** shows maps, metrics, contributions, warnings, sensitivity, and notes.
8. **Explanation service:** drafts prose from structured results and citation metadata.
9. **Candidate review orchestrator:** selects among policy-allowlisted evidence
   tools, pauses for human confirmation, and assembles a draft packet without
   changing deterministic policy.

## Prototype implementation

- TypeScript and React for the interactive review interface
- Vinext and Vite for the deployable frontend prototype
- Local synthetic fixtures for current workflow demonstration
- A deterministic offline `SRC-017` adapter that builds a minimized,
  versioned Esri internal-demo fixture without checking in raw exports
- Deterministic client-side score calculation for the first interface prototype
- Session-only evaluated-result state until audit, access, and persistence requirements are approved
- Server-side Census address matching for synthetic, public, or otherwise approved demonstration addresses
- Session-only proposed-location state with reviewer confirmation and no automatic evaluation
- Versioned 2024 Census CBSA TopoJSON built offline and joined to the July 2023 market universe
- Versioned 2024 ACS 5-year CBSA context built through one authenticated server-side request
- MapLibre GL JS as a provider-neutral renderer for an approved, client-facing street-basemap style
- One persistent unified map with a deterministic single-metric Census choropleth, separate current, potential, and evaluated location sources, accessible selection, and a no-provider SVG fallback

The public market-context controls and shared map overlay form an
evidence-exploration surface. The browser imports the repository artifacts at
build time and makes no browser request to Census. Census metrics remain
isolated from candidate metrics, hard constraints, score calculation, rankings,
and evaluated results. CBSA geometry represents Census statistical areas and
is not a trade-area, drive-time, or service-area calculation.

The primary interface is market-first. Markets and Locations are separate
workspaces. Markets retains All, Current, Potential, and Evaluated workflow
filters. Its map and browser share one selected CBSA code, while map fill uses
only exact-linked synthetic attractiveness results. Locations exposes only
Candidate briefs and Compare locations. A separate market-workflow overlay
supplies synthetic prototype states without mutating the public market
universe.

The location-evaluation action checks a deterministic prerequisite before
scoring: the location must have a stable parent market and that market must be
Current or Evaluated. Potential, Unclassified, and unassigned parent states
fail closed. The check does not calculate a market score or change market
state. Market review, location evaluation, and human decision remain separate
records.

Portfolio data readiness is embedded in the candidate-review flow rather than
presented as a separate primary workspace. Its input is the checked-in
minimized Esri fixture, not the raw source exports. The offline builder validates exact demo projections, source
hashes, stable master-site identities, site-to-trade-area relationships,
prohibited-field exclusion, and manifest reconciliation before replacing the
fixture directory. Readiness is calculated as available required evidence
divided by expected required evidence for the workflow stage. It is isolated
from market status, scoring, ranking, and human approval.

The shared Esri contracts and fixture are intended to support later descriptive
market profiles and evidence briefs. Those capabilities may consume only
approved fixture fields and must preserve the source, evidence status,
synthetic state, missingness, and `scoring_eligibility: none` boundaries.

The market trade-area adapter joins only through the checked-in crosswalk and
emits context observations at application build time. Public Census metrics and
geometry remain in `PublicMarketContext`; internal local observations render in
a separate panel and are never added to the CBSA GeoJSON or sent to the
basemap provider. No trade-area polygon is drawn because the export provides
neither an approved geometry nor a construction method.

One-to-many source relationships produce multiple selectable variants. The
adapter validates non-finite values and percentage ranges, preserves nulls,
labels synthetic records, and emits unknown-date, unknown-unit, unknown-method,
and unconfirmed-formula warnings. Its bounded comparison displays raw values
only and does not share code with the scoring engine.

The candidate-evidence adapter is a second deterministic projection over the
same readiness, crosswalk, field catalog, and trade-area profile objects. It
does not create a parallel evidence model or import the scoring engine. A
separate, explicitly synthetic clinic-landscape fixture demonstrates the
difference between source account rows and estimated physical locations
because supplied clinic rows are not approved for use. Restricted commercial
and clinic fields are represented only as redacted evidence states.

The Locations workspace owns the evidence-brief and two-to-five-candidate
comparison views. The brief keeps a stable six-section order, generates
follow-up questions through rules, and prints through browser print CSS without
a PDF dependency. Print receives the already minimized presentation model, so
hidden restricted values are never mounted in the page. The comparison uses
raw observations in analyst selection order and remains isolated from the
scoring sandbox.

The Markets comparison workspace owns a separate two-to-five-result selection.
It enforces one scoring cohort, preserves analyst order, and exposes the
application-supplied scores, subscores, sensitivity, missingness, warnings, and
versions. Its Ask AI context is rebuilt from only those selected results. Save
comparison is an explicit future affordance and performs no storage operation.

The Candidate Review Agent is one bounded server-side orchestrator over these
existing projections. `POST /api/agent-runs` creates a process-local run and
advances it until analyst review, completion, a blocker, or a controlled
failure. `GET` and `POST /api/agent-runs/[runId]` retrieve the current process
record or submit one explicit review response. The module-level store is a
prototype mechanism only and may be lost on restart or across runtime
instances.

The model receives a minimized run summary and the policy-calculated set of
permitted tools. It does not receive authority to choose tool arguments or
workflow state. Tools reuse readiness, candidate-evidence, public-market,
market-workflow, and scoring functions. Public context stays non-scored,
restricted values stay outside tool results, and a run-local relationship
confirmation never mutates `SRC-017`. The existing `evaluateSite` function is
called only when a separate valid scoring input and configuration pass the
prerequisite tool. The checked-in Esri evidence does not meet that contract.
The browser imports checked-in ACS and geometry snapshots and never calls the
Census API. The API key exists only in the local build environment.

The MapTiler street basemap is a rendering dependency, not an evidence source.
Its style URL is supplied through `NEXT_PUBLIC_MAP_STYLE_URL` and its
browser-facing key through `NEXT_PUBLIC_MAPTILER_KEY`; no provider credential
is checked into the repository. The key must be approved for client use and
restricted to allowed HTTP origins. Provider-hosted roads, cities,
neighborhoods, buildings, and labels remain separate from checked-in Census
geometry, ACS properties, and location records. The configured style receives
ordinary viewport tile requests, but the application does not send candidate,
customer, medical, or restricted records to the provider.

The checked-in Census TopoJSON is converted to GeoJSON in memory for MapLibre
without changing its evidence status, sensitivity, allowed use, or scoring
eligibility. Current, potential, and evaluated records remain separate map
sources. A candidate with a completed structured evaluation is rendered once
as evaluated, without implying approval or recommendation. If the MapTiler
configuration is missing, invalid, or fails before loading, the integrated SVG
map remains available with Census and location selection. County boundaries
are deferred until an approved, versioned Census county layer and its source
metadata are added.

The client-side calculation is a demonstration implementation, not the production scoring boundary. Before production use, validation, geospatial calculations, scoring, and evaluation should move behind a tested service using the approved data contracts.

## Recommended quantitative service after approval

- Python for validation, geospatial calculations, scoring, and evaluation
- Pydantic or JSON Schema for contracts
- GeoPandas and Shapely for approved local geospatial operations
- SQLite or versioned files for a local prototype result store, or an approved managed store for shared use
- Pytest for deterministic behavior and regression cases

See `ADR-002-frontend-prototype.md`.

## Seattle market deep-dive demo

The Seattle Market Deep Dive is a separate bounded orchestrator at
`POST /api/market-deep-dive-runs` and
`GET|POST /api/market-deep-dive-runs/[runId]`. It reuses the public CBSA
context boundary but not candidate scoring. Checked-in Seattle fixtures feed a
versioned deterministic submarket engine. The model can only choose the next
policy-permitted tool. The existing persistent `UnifiedEvaluatorMap` adds one
optional synthetic GeoJSON source containing deterministic geodesic polygons
and city-center hubs. Map, legend, priority cards, and ranking rows share one
selected submarket ID. The browser also renders the transparent comparison,
fictional broker profiles, activity trail, evidence receipts, and draft packet
from validated application state. The process-local store is not durable and
may be lost across runtime instances.
