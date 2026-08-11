# ADR-018: Synthetic Opportunity Inbox foundation

- Status: Proposed
- Date: 2026-08-05

## Context

The platform transition proposes a multi-sector Opportunity Inbox demonstration
without approved production data, thresholds, integrations, scheduling, or
decision authority. The repository already has reusable evidence and governance
patterns, but the new workflow needs its own contracts and lifecycle rather than
coupling opportunity discovery to clinic scoring.

## Decision

Implement an isolated Seattle CBSA `42660` proof of concept using versioned
synthetic fixtures, Zod contracts, deterministic playbook definitions, explicit
evidence states, stable opportunity identities, and a process-local store behind
a replaceable interface. Inject effective time into freshness, cooldown, and
expiration rules. Generate only deterministic fallback copy during the initial
foundation phase.

Keep reviewer decisions and simulated delivery receipts separate from generated
opportunities. Do not connect to real sources, send messages, infer geography,
impute missing values, or treat synthetic thresholds as production policy.

## Alternatives considered

1. Extend clinic scoring contracts for opportunity discovery. Rejected because
   opportunity evidence, lifecycle, and permitted actions are distinct from site
   evaluation and scoring.
2. Begin with live integrations. Rejected because source access, governance,
   metric definitions, and operating ownership are unresolved.
3. Let a model detect and qualify opportunities. Rejected because validation,
   thresholds, geography, deduplication, and workflow state must remain
   deterministic and testable.

## Consequences

- The demonstration is reproducible and traceable but has no production authority.
- Source observations remain `Hypothesis`; deterministic calculations may be `Derived`.
- Missing, stale, contradicting, rejected, and quarantined evidence stays visible.
- Process-local state may disappear on restart or differ across runtime instances.
- Production use requires approved sources, rules, roles, persistence, access,
  monitoring, and decision rights.
- This proposed ADR and related documentation require user review before commit.

## Evidence references

- `docs/strategy/opportunity-inbox-implementation-plan.md`
- `docs/product/open-questions.md`
- `docs/technical/ai-boundaries.md`
