# ADR-022: Snowflake exports enter through canonical evidence adapters

## Status

Proposed. Reviewed by the repository owner on 2026-08-12.

Date proposed: 2026-08-12.

## Context

The migration branch includes aggregate Snowflake export adapters and a local
snapshot builder. Those inputs may contain internal evidence with unresolved
governance, identity, grain, and quality questions. They must not be confused
with checked-in synthetic fixtures or treated as authorized scoring inputs.

## Decision

Snowflake CSV exports are treated as external evidence inputs, not application
fixtures. Raw exports and generated snapshots remain outside Git. Controlled
ingestion produces typed, sanitized evidence records with provenance, grain,
sensitivity, allowed use, quality status, warnings, and rejected-row reasons.

Shared geography and demand context may be reused by multiple sector playbooks.
Clinic, retail, growth, and pricing metrics remain playbook-specific. The
platform does not create a universal market score.

Deterministic application code owns normalization, geography joins, eligibility,
scoring, thresholds, and sensitivity. AI may explain validated evidence and
identify gaps, but it may not repair geography, impute values, alter weights,
or make a final business decision.

## Evidence status of the 2026-08-10 exports

- Market context: Reported, with missing CBSA codes and repeated location-match totals.
- ZIP geography: Derived pending ZIP/ZCTA and CBSA reconciliation.
- Clinic identity: Unknown pending physical-location semantics and owner approval.
- Clinic performance: Unknown pending outcome, maturity, cohort, and approval.
- ZIP sales: Reported aggregate, with governance approval unresolved.
- Retention: Reported national baseline without geography.
- Appointments: Reported state-level context without clinic or market geography.

## Consequences

The current synthetic market and clinic demonstrations remain the executable
baseline until an authorized canonical snapshot passes validation. The adapters
support repeatable ingestion and audit without embedding restricted raw exports
or generated internal snapshots in the repository.

## Alternatives considered

1. Commit sanitized exports as application fixtures. Rejected because local
   sanitization does not establish repository or production authorization.
2. Read raw exports directly in each playbook. Rejected because it would duplicate
   validation and weaken provenance, grain, and allowed-use controls.
3. Normalize all sectors into one market score. Rejected because sector metrics,
   owners, evidence rules, and decisions are not interchangeable.

## Evidence references

- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `docs/research/claim-ledger.md`
- `lib/adapters/snowflake-csv/README.md`
- `tests/snowflake-csv-adapter.test.ts`
- `tests/approved-snowflake-snapshot.test.ts`
