# ADR-009: Market-first workspaces and location prerequisite

## Status

Proposed for user review

## Date

2026-07-30

## Context

The evaluator previously presented Current locations, Potential locations,
Evaluated locations, and Public market context as peer views. That hierarchy
mixed two entity levels. A market is the parent decision context, while a
location is a candidate or operating site within a market.

The revised workflow requires a market review before a candidate location can
be evaluated. Public Census evidence can support that review, but it remains
non-scored market context and cannot establish an approval or recommendation.

## Decision

The primary interface has two persistent workspaces:

- Markets
- Locations

Each workspace has All, Current, Potential, and Evaluated filters. One
`UnifiedEvaluatorMap` remains mounted while the workspace and filters change.

Market and location categories use the same visual vocabulary:

- Current is teal.
- Potential is purple.
- Evaluated is orange.
- Unclassified markets and unassigned locations are neutral gray.

Market category precedence is Current, then Evaluated, then Potential, then
Unclassified. A Current market contains at least one Current clinic. An
Evaluated market has a separately recorded completed market review. A
Potential market is under consideration but its market review is incomplete.
An Unclassified market exists in the public reference universe without
workflow status.

A location evaluation is permitted only when:

1. the location has a stable parent market ID;
2. the parent market exists in the market universe;
3. the parent market is Current or Evaluated; and
4. the location has validated evidence available for scoring.

Evaluating a location never creates or changes its market status. Invalid
parent-child states remain visible validation issues and are not silently
repaired.

Market workflow state remains separate from:

- immutable Census market identity and geometry;
- public ACS context;
- location evidence;
- location score and result; and
- human approval or final real-estate decisions.

Because approved market-evaluation criteria are not yet documented, the
prototype uses explicitly synthetic, `Hypothesis` workflow records to
demonstrate Potential and Evaluated market states. A session-only action may
mark a synthetic Potential market review complete. That action creates no
numeric score, rank, approval, or recommendation.

## Alternatives

### Keep four peer views

Rejected because it mixes market entities with location lifecycle states and
does not express the prerequisite relationship.

### Derive an Evaluated market from an Evaluated location

Rejected because the market review must occur first. Retroactive derivation
would hide an invalid workflow transition.

### Create a market score from ACS context

Rejected because the public data contracts allow market context only and no
market criteria, weights, or thresholds have been approved.

## Consequences

- Market review becomes the default orientation.
- Current, Potential, and Evaluated become filters within each entity level.
- Every evaluable location needs a stable parent market relationship.
- Current clinics deterministically make their assigned markets Current.
- Candidate evaluation is visibly blocked for Potential, Unclassified, or
  unassigned parent markets.
- The selected market persists during the handoff to its locations.
- Status coloring replaces the default ACS choropleth fill. ACS values remain
  available in market details.
- Synthetic workflow assignments must stay visibly separate from confirmed
  public context.
- Production market review states, evidence requirements, decision rights,
  audit records, and persistence remain unresolved.

## Evidence

- `CLM-020` supports a transparent evidence and comparison interface.
- `CLM-025` through `CLM-027` support public CBSA and ACS context with no
  scoring eligibility.
- `SRC-014`, `SRC-015`, and `SRC-016` provide the public market reference
  artifacts.

## Approval

The user requested implementation of the market-first workflow on 2026-07-30.
This record remains Proposed until the resulting product and documentation
changes are reviewed.
