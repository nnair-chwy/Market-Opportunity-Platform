# ADR-018: Versioned shared evaluation contracts

- Status: Accepted
- Date: 2026-08-10

## Context

The repository now supports clinic candidate review, market evaluation, and a
bounded market deep-dive, but their workflow records use separate types. The
Market Intelligence Evaluation Workspace needs a shared contract that can
describe a question, evidence requirements, deterministic rules, review gates,
and draft actions without weakening the existing clinic-first controls.

Missing values, unknown geography or time scope, synthetic-only eligibility,
and unresolved human decisions must remain explicit. AI-generated text also
must not be represented as an approved business interpretation.

## Decision

Add strict Zod contracts for `QuestionSpec`, `DecisionGraph`,
`EvaluationContract`, `Capability`, `EvidenceRecord`, `ArtifactSpec`, and
`ActionPacket`, versioned as `1.0.0`.

The shared evaluation contract records geography grain, time scope,
eligibility, required evidence, deterministic formulas, thresholds, weights,
missing-data rules, permitted actions, approval gates, and source-linked
provenance. Missing and unknown evidence retains a `null` value and cannot be
filled by schema parsing. AI-proposed and human-approved interpretations use
separate strict receipt types.

Material decisions remain outside the permitted action vocabulary. Action
packets cannot become approved while a required gate is unsatisfied. Synthetic
clinic scoring configurations map to synthetic-only shared contracts, while
approved configurations require their existing approver receipt. The current
clinic scoring engine remains deterministic and is adapted into the shared
contract instead of being replaced.

## Alternatives considered

- Replace each vertical contract immediately: rejected because it would mix a
  shared workflow vocabulary with unrelated UI and orchestration changes.
- Use TypeScript interfaces without runtime schemas: rejected because external
  and AI-assisted workflow boundaries require runtime validation.
- Let AI populate missing evidence or approval fields: rejected because this
  violates the evidence and decision boundaries.
- Add persistence for contracts and packets: deferred until governance,
  retention, and access-control questions are resolved.

## Consequences

- New verticals can share one versioned workflow vocabulary.
- Clinic evaluation remains compatible through an explicit adapter.
- Incomplete and synthetic-only evaluations remain valid records, but do not
  become production approvals.
- Contract evolution requires a new version and migration decision.
- No UI or database behavior changes as part of this decision.

## Evidence

- `SRC-001`
- `SRC-003`
- `SRC-014`
- `SRC-015`
- `SRC-016`
- `SRC-017`
- `CLM-001`
- `CLM-004`
- `CLM-017`
- `CLM-020`
- `CLM-022`
