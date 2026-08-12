# ADR-023: Integrate adaptive planning without a second evaluation engine

## Status

Proposed. Reviewed by the repository owner on 2026-08-12.

Date proposed: 2026-08-12.

## Context

The adaptive branch demonstrates question interpretation, visible planning, and
interactive geographic exploration. The migration branch already has canonical
evaluation contracts, deterministic operators, a capability registry, action
packets, and a question-first saved-packet workflow. Importing a parallel engine
would create conflicting execution and approval boundaries.

## Decision

The question-first workspace may use AI to propose a schema-constrained intent.
Deterministic code compiles that intent against the versioned capability
registry. If model access is absent or invalid, the same compiler runs from a
deterministic fallback.

`lib/evaluation-contracts.ts`, `lib/evaluation-operators.ts`, and
`lib/capability-registry.ts` remain the canonical execution boundary. The
adaptive branch's alternate evaluation engine is not imported.

The packet workspace includes a full-width national CBSA map backed by
`SRC-014`, `SRC-015`, and `SRC-016`. A user may choose one public measure,
filter workflow and metro/micro cohorts, inspect synchronized map and list
selection, and compare up to five markets. Percentiles use the canonical
deterministic cohort-comparison operator. They are market context only and do
not enter clinic scoring.

Approval is a server-side domain transition. An action cannot become approved
unless every referenced gate is present, satisfied by a receipt, and reviewed
by the gate's required role. Client state cannot bypass this check.

## Consequences

- The migration keeps the adaptive branch's large-map interaction model.
- AI classifies questions but cannot select data, calculate percentiles, alter
  policy, satisfy a gate, or make a final decision.
- Saved packets remain browser-local drafts and retain packet-scoped AI context.
- Public context and synthetic scoring remain visibly separate.

## Alternatives considered

1. Cherry-pick the adaptive evaluation engine unchanged. Rejected because it
   duplicates canonical contracts, operators, policy, and gate enforcement.
2. Keep the adaptive map as a separate application. Rejected because map
   exploration belongs inside the shared question-to-packet workflow.
3. Use AI-generated calculations or source selection. Rejected because those
   operations must remain deterministic, versioned, and testable.
4. Remove the adaptive map during migration. Rejected because filtering, scale,
   synchronized inspection, and comparison are required analyst interactions.

## Evidence references

- `docs/research/source-registry.md` (`SRC-014`, `SRC-015`, `SRC-016`)
- `docs/research/claim-ledger.md` (`CLM-025`, `CLM-026`, `CLM-027`)
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `tests/adaptive-market-workspace-rendered.test.mjs`
- `tests/evaluation-planning.test.ts`
- `tests/evaluation-contracts.test.ts`
