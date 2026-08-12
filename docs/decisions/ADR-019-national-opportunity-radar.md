# ADR-019: National Opportunity Radar operational projection

- Status: Proposed
- Date: 2026-08-06

## Context

The Seattle Opportunity Inbox demonstrates qualification and review, but a
single-market register does not show how the same controlled process could
operate across a national portfolio. The repository already contains a
versioned 917-market public CBSA universe and complete boundary geometry. It
does not contain approved nationwide opportunity signals or rules.

## Decision

Render the existing public CBSA boundaries as a provider-neutral national
operational map. Add a deterministic synthetic monitoring projection that
assigns a visible scan receipt to every registered market. Seattle is the only
qualifying market. Four named synthetic examples show stale evidence, missing
evidence, duplicate suppression, and quarantine. All other markets show a
completed scan with no qualifying signal.

Derive portfolio metrics, pipeline-stage counts, activity events, and register
filtering from the same snapshot. Treat every map state as workflow status with
scoring eligibility `none`. Do not create a heatmap, national score, ranking,
or visual animation that implies unrecorded model activity.

## Alternatives considered

1. Show only Seattle. Rejected because it does not communicate the intended
   national operating model.
2. Generate a synthetic opportunity score for every market. Rejected because
   no approved national evidence or cross-sector scoring model exists.
3. Require the configured street basemap. Rejected because national workflow
   visibility should remain available without a provider credential.

## Consequences

- Users can see portfolio scale, pipeline receipts, and exception paths in one
  connected view.
- Clicking the map or activity ledger filters the same opportunity register.
- National status outside Seattle remains fictional and cannot support a real
  business decision.
- A production implementation requires approved sources, schedules, operating
  ownership, durable storage, and market-specific playbooks.
- This proposed ADR and related documentation require user review before commit.

## Evidence references

- `SRC-014` versioned public CBSA universe
- `SRC-015` public CBSA geometry
- `docs/strategy/opportunity-inbox-implementation-plan.md`
- `docs/technical/ai-boundaries.md`
