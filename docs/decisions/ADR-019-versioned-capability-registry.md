# ADR-019: Versioned workspace capability registry

- Status: Accepted
- Date: 2026-08-10

## Context

The evaluation workspace contains public, synthetic, unavailable, and planned
functions. Without one executable registry, a question router could imply that
a documented dashboard, export, source concept, or adapter is a live data
connection. It also needs to distinguish a fully unsupported question from one
that can be partially executed or is blocked by evidence or approval.

## Decision

Add a strict, versioned capability registry for Census market context, clinic
performance, clinic site evaluation, and local growth tests. Every capability
declares status, geography grains, outputs, evidence, deterministic operators,
approval requirements, and limitations.

Question assessment is deterministic and returns `supported`, `unsupported`,
`partially_supported`, or `blocked`. It reports the executable outputs
separately from missing evidence and approvals. Registry version `1.0.0` marks
only Census market context and descriptive clinic performance as connected,
with clinic performance available from approved aggregate evidence, clinic site evaluation as
synthetic, and local growth tests as planned.

## Alternatives considered

- Infer capability from repository modules: rejected because an adapter or
  fixture does not prove data access or approval.
- Treat every incomplete question as unsupported: rejected because it hides
  useful partial execution and actionable blockers.
- Let AI infer connections or approvals: rejected because availability and
  governance boundaries must be deterministic and auditable.

## Consequences

- Question routing can explain exactly what can run and what is missing.
- Synthetic execution remains visibly separate from connected capability.
- Undocumented Snowflake, Tableau, Esri, campaign, and customer-data
  connections remain unavailable.
- Registry changes require an explicit version change and review.

## Evidence

- `SRC-001`
- `SRC-002`
- `SRC-004`
- `SRC-014`
- `SRC-015`
- `SRC-016`
- `CLM-006`
- `CLM-008`
- `CLM-009`
- `CLM-021`
- `CLM-022`
- `CLM-023`
