# ADR-031: Normalize non-SEO demo data with visible Census-assisted inference

## Status

Accepted for the local demo on 2026-08-17.

## Context

The supplied `Market_Data` directory contains General Regional, Clinic,
Google Ads, and national SEO CSV files. The regional files use a mixture of
CBSA names, blank CBSA codes, U.S. ZIP codes, state codes, clinic IDs, and
Google Ads display labels. The SEO files are national and cannot support the
regional workflow.

The repository previously treated clinic profile and activity aggregates as
confidential at the browser boundary and prohibited any inferred Google Ads
geography. The repository owner clarified that the supplied aggregate clinic
files are permitted in this local demo and explicitly requested intuitive
geography assignment even when stable provider identifiers are absent.

## Decision

Build a separate, versioned normalization layer from all supplied non-SEO
files. Use the checked-in July 2023 Census CBSA universe as the canonical
regional registry and the following ordered resolution methods:

1. supplied five-digit CBSA code;
2. exact normalized Census CBSA name;
3. supplied ZIP-to-CBSA bridge;
4. clinic-ID-to-profile geography bridge;
5. principal city and state inference;
6. Census name, principal-city, county, state, and token-similarity inference;
7. state-only or national retention when a CBSA is not supportable; and
8. explicit unresolved state when no plausible geography exists.

Every inferred assignment preserves the original value, method, confidence,
candidate alternatives, evidence status, warning, and review status. Medium-
and low-confidence assignments are `Hypothesis` evidence. They may be used for
the local demo but not silently represented as provider-confirmed geography.

Clinic profile and activity files are `internal`, with
`local_demo_aggregate_decision_support` use and aggregate-only browser
exposure. Raw clinic rows and clinic IDs do not cross the registered aggregate
query boundary. The supplied clinic files still do not establish completed
appointments by clinic at a shared 38-week maturity point, so the configured
clinic-ranking question remains synthetic until that metric and cohort exist.

Google Ads remains label-grain Reported evidence in its source adapter. The
normalization layer may produce a separate Derived or Hypothesis CBSA mapping
for the local demo. Scoring, ranking, causal claims, spend authorization, and
external writes remain prohibited.

National SEO files are excluded from this regional normalization snapshot.

## Consequences

- More regional questions can use one reusable CBSA-keyed query contract.
- New CSV files can be registered through the source catalog with required
  columns, grain, geographic strategy, sensitivity, allowed use, and browser
  exposure.
- The local snapshot contains Parquet tables, a DuckDB database, a manifest,
  and a source-level coverage report. Raw exports remain outside Git.
- Demonstration coverage increases, but inferred coverage must not be confused
  with accuracy or production approval.
- Canadian postal codes and non-mainland geographies remain outside the U.S.
  Census CBSA registry and are retained as unresolved or state-level evidence.

## Rejected alternatives

1. Require stable identifiers before any demonstration mapping. Rejected for
   this local demo because the owner explicitly prioritized breadth and visible
   intuition over production-grade accuracy.
2. Silently coerce every label to a CBSA. Rejected because the original value,
   uncertainty, and alternatives would be lost.
3. Include national SEO files in regional queries. Rejected because the files
   do not contain a regional geography.
4. Expose raw clinic rows in browser responses. Rejected because aggregate
   regional evidence is sufficient for the demo and minimizes unnecessary
   detail.
