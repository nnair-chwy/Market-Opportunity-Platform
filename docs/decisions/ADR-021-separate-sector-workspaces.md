# ADR-021: Separate sector workspaces

- Status: Proposed
- Date: 2026-08-06

## Context

The national Opportunity Inbox presents three materially different sectors in
one register. A shared list is useful for portfolio triage, but it does not give
each sector enough space to explain its mandate, opportunity patterns, evidence
needs, or operating guardrails. The three playbooks should not appear to be one
universal scoring model.

## Decision

Keep the national radar and register as the cross-sector portfolio home. Add a
dedicated route for Growth and Marketing, Pet Health, and Market Ecosystem.
Drive the three pages from a typed catalog that defines sector-specific
mandates, current playbooks, candidate opportunity patterns, outcomes,
guardrails, prototype inputs, and planned data dependencies.

Separate each sector workspace into two views. The Sector profile view contains
the mandate, accountable function, playbook, future patterns, input roadmap,
outcomes, workflow, and guardrails. The Opportunities and blockers view contains
only that sector's active synthetic findings, evidence blockers, and separately
labeled production activation dependencies.

The sector opportunity view owns the complete opportunity workflow for its
findings. It reuses the shared evidence detail, human-review controls,
ActionPacket presentation, audit history, and simulated communication preview.
The national register remains a portfolio context view, not a required detour
for sector work.

Label current inputs as synthetic or public context. Label all future inputs as
planned, unconnected, and approval-required. Refer to source-registry IDs only
as documented evidence or candidate context, never as proof of access or
production approval.

## Alternatives considered

1. Continue using only filters in one register. Rejected because the sectors
   have different users, evidence, qualification logic, outcomes, and risks.
2. Build three independent applications. Rejected because the sectors still
   benefit from one national monitoring model, shared evidence primitives, and
   portfolio navigation.
3. Present planned data alongside current data without maturity labels.
   Rejected because it would imply integrations and authority that do not exist.

## Consequences

- Each sector can evolve its own playbooks without creating a universal score.
- Users can understand the intended opportunity and evidence model before
  entering the shared register.
- Active findings remain separated by sector while the national register
  continues to provide cross-sector portfolio visibility.
- Reviewers can inspect and progress an opportunity inside its accountable
  sector workspace using the same API and policy controls as the register.
- The typed catalog becomes the reviewed presentation source for sector scope.
- Production integrations remain blocked by the existing ownership, access,
  governance, metric-definition, and threshold questions.
- This proposed ADR and related scope documentation require user review before
  commit.

## Evidence references

- `docs/strategy/opportunity-inbox-implementation-plan.md`
- `SRC-002`, `SRC-004`, `SRC-007`, `SRC-008`, `SRC-011`
- `docs/product/open-questions.md`
