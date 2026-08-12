# ADR-021: Fixture-backed generic evaluation workspace

- Status: Proposed
- Date: 2026-08-10

## Context

The application has reusable evaluation contracts and deterministic operators,
but its visible workflows are organized around market and clinic-specific
views. The Market Intelligence Evaluation Workspace needs a smallest
end-to-end path that begins with a business goal and ends with a reviewable
draft while preserving evidence lineage and human decision rights.

Production ownership, data access, criteria, and approval questions remain
open. The first generic path therefore cannot imply that clinic or local-growth
data and activation systems are connected.

## Decision

Add a default generic evaluation workspace with this visible sequence:

1. goal composer;
2. decision decomposition;
3. evaluation contract;
4. evidence and lineage;
5. map and ranking;
6. selected-entity detail;
7. findings;
8. draft action packet; and
9. human approval state.

Start with checked-in synthetic fixtures for clinic market or site evaluation
and local growth-market selection. Both fixtures are limited to
`synthetic_prototype_only`. The local-growth fixture demonstrates generic
workspace behavior; it does not change the capability registry's
`local_growth_test` status from `planned` or establish an audience, campaign,
customer-data, or activation connection.

An AI-shaped interpretation may be proposed and edited, but the application
parses it into a strict `QuestionSpec` before exposing results. Existing typed
deterministic operators perform normalization, weighted calculations, and
same-cohort ranking. The UI labels the leading entity as “priority under demo
criteria,” never as a recommendation.

The packet remains `draft_for_review` in product language. A session-only
review state may record that changes were requested or that the draft was
reviewed, but neither state approves a material action. Existing Market
questions and Clinic evaluation views remain available as regression paths.

## Alternatives considered

- Replace the clinic workflow: rejected because the established vertical is
  still the primary regression path.
- Make local growth a connected capability: rejected because approved
  aggregate evidence, privacy controls, owners, and activation authority are
  not documented.
- Let AI calculate or rank entities: rejected because calculations must remain
  deterministic, versioned, and testable.
- Hide incomplete stages until data is available: rejected because the
  end-to-end sequence and its gates are part of the prototype being evaluated.

## Consequences

- The application opens on a reusable question-first workflow.
- Both initial types can exercise the same interaction and component model.
- Runtime schemas reject malformed fixture or interpretation structures.
- Unit tests fix the demonstration scores and ranks.
- The generic workflow creates no persistence and authorizes no action.
- Production use remains blocked by the applicable open questions.

## Evidence

- `SRC-001`
- `SRC-003`
- `SRC-004`
- `CLM-001`
- `CLM-017`
- `CLM-020`
- `CLM-022`
- `OQ-001` through `OQ-007`
- `OQ-011`
- `OQ-015`
- `OQ-025` through `OQ-028`
