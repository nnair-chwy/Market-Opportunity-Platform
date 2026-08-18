# ADR-029: One typed service executes canonical frozen snapshots

## Status

Proposed for repository-owner review.

Date proposed: 2026-08-17.

## Context

The repository already has Parquet, DuckDB, public Census execution, and a
legacy approved-snapshot query layer. The local demo needs a reusable path from
an evaluation plan to the newly built canonical clinic-market snapshot without
reading raw CSV files at request time or creating another database abstraction.

## Decision

Use `lib/evidence-snapshot/execute.ts` as the single server-side execution
boundary for the canonical frozen snapshot. Requests use a strict Zod union of
registered query names and exact parameters. SQL remains static application
code and DuckDB is accessed through the existing helper.

The service validates the manifest, snapshot version, output byte counts,
SHA-256 hashes, and source-status manifest before opening DuckDB. It returns one
strict response contract with complete, partial, blocked, and failed states.
Connections are closed after success and failure.

Confidential and restricted rows cannot enter the response evidence bundle.
They produce a structured blocked response. Missing evidence remains missing,
synthetic evidence must remain Hypothesis, and Google Ads matched-location
context retains a null stable geography ID.

## Consequences

The question workflow can now call deterministic Parquet queries through one
versioned contract. The browser and AI layers cannot supply SQL or bypass source
and sensitivity checks. The service does not interpret questions, choose a
workflow, or render UI; those remain separate dispatcher and presentation
responsibilities.

## Alternatives considered

1. Reuse the legacy JSON snapshot query service for canonical Parquet. Rejected
   because its manifest and table assumptions do not represent the new snapshot.
2. Read raw CSV files at request time. Rejected because this bypasses build-time
   validation and makes replay non-deterministic.
3. Permit model-generated SQL. Rejected because it weakens query registration,
   sensitivity controls, reproducibility, and testing.

## Evidence references

- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `lib/evidence-snapshot/execute.ts`
- `lib/evidence-snapshot/contracts.ts`
- `tests/evidence-execution.test.ts`
