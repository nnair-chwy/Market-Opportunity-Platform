# ADR-006: Versioned CBSA ACS market context

## Status

Proposed

## Date

2026-07-29

## Context

The validated CBSA universe and compatible 2024 land-area observations allow
approved aggregate ACS measures to be shown as public context. They do not
establish clinic demand, suitability, scoring criteria, or predictive value.

Evidence: `SRC-014`, `SRC-015`, `SRC-016`, and `CLM-027`.

## Decision

Use one authenticated 2024 ACS 5-year detailed-table request for all CBSAs.
Read the key only from `CENSUS_API_KEY`, validate every row, join by exact
five-digit code, and persist a key-free snapshot, rejected-row audit, and
manifest. Direct measures are `Confirmed`; density is `Derived` only from
matching 2024 CBSA `ALAND`. All outputs are public market context with no
scoring eligibility.

The UI defaults to the 50 largest mainland metropolitan areas sorted by 2024
ACS population, while retaining the full metro and micro universe for search
and filtering. One public metric at a time drives a deterministic blue
choropleth with explicit units and neutral missing styling.

## Consequences

- The checked-in snapshot contains 917 matched mainland markets and audits 18
  non-mainland API rows.
- Runtime UI and normal tests need no Census network access or API key.
- ACS values are labeled `2020–2024 ACS 5-year estimate`, not current counts.
- Growth remains deferred until boundary-compatibility rules are approved.
- No ACS value enters scoring, hard constraints, readiness, or recommendations.
- User review is required before this ADR is accepted or committed.
