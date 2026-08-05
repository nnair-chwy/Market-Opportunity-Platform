# Integration options

## Phase 0: Local synthetic files

Use versioned JSON or CSV fixtures for candidate and scoring behavior. This
remains the only approved integration for the initial scoring implementation.

Benefits:

- no production access dependency;
- deterministic tests;
- easy schema iteration; and
- safe demonstrations.

## Public market-context foundation

Use explicitly authorized public sources to build versioned reference snapshots
when their contracts and allowed uses are documented. The first source is the
July 2023 Census CBSA delineation and principal-city release in `SRC-014`.

The CBSA snapshot:

- is fetched through a repeatable, fail-closed data build;
- retains public provenance and rejected-input audit details;
- includes the complete eligible metropolitan and micropolitan universe;
- uses an explicit mainland state FIPS allowlist; and
- has `allowed_use: market_context_only` and `scoring_eligibility: none`.

The second public-data build uses the official 2024 national 1:5,000,000 CBSA
cartographic boundary file in `SRC-015`. It:

- validates and hashes the source ZIP;
- preserves source `ALAND` and `AWATER` observations;
- joins by exact five-digit CBSA code;
- emits only features in the validated mainland market universe;
- retains unmatched, duplicate, rejected, and missing geometry in a separate
  audit artifact; and
- produces compact TopoJSON that is imported at build time.

The Public market context UI renders these boundaries neutrally because ACS
measures are not loaded. It does not call a geometry service at runtime and is
not connected to scoring. CBSA polygons are Census statistical areas, not trade
areas, drive-time polygons, or service areas.

This foundation does not change the provisional product scope or approve public
data as a scoring input.

## Phase 1: Authorized manual aggregates

Allow an analyst to export an approved aggregate template and load it manually. Validate source, date, geography, and sensitivity.

## Phase 2: Read-only governed adapters

Possible adapters, subject to approval:

- Esri or ArcGIS services for approved geospatial layers;
- Snowflake views for approved historical features and outcomes;
- Tableau-derived datasets where governed access exists;
- Site Pipeline records for approved future-site metadata.

## Adapter interface

Every adapter should return the same canonical metric observations and expose:

- source version;
- refresh time;
- row or feature count;
- geographic grain;
- quality warnings;
- allowed-use metadata; and
- lineage.

## Explicitly deferred

- Production write-back
- Esri map editing
- Automated clinic creation
- Rhapsody configuration
- Lease, staffing, or opening approvals
