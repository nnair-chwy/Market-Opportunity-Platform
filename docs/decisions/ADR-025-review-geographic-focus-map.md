# ADR-025: Deterministic geographic focus on the decision review map

## Status

Proposed. Pending repository owner review.

Date proposed: 2026-08-12.

## Context

The post-question review page replaced the interactive AdaptiveMarketWorkspace
evidence panel with a two-column layout. The left column needs a zoomed
geographic context map that stays subordinate to the action packet, preserves
uncertainty, and never invents a market when resolution is unreliable.

## Decision

Add `resolveGeographicFocus` in `lib/planning/map-focus.ts` and render it with
`GeographicFocusMap` on the review page.

Focus selection is deterministic and ordered:

1. Question-resolved CBSA codes with available public geometry.
2. For national executable Census-context questions, the top metropolitan
   market from `compare_cohort` on the requested `SRC-016` measure, or a CBSA
   already present in the action packet.
3. Otherwise a clearly labeled fallback state with no selected CBSA.

Evidence status is `Confirmed` for question geography, `Derived` for evaluation
or action-plan focus, and `Unknown` for fallback. The map communicates context
only and does not present a recommendation or opportunity score.

## Consequences

- National screening questions zoom to a derived focus market without treating
  that market as approved.
- Ambiguous or unsupported questions show the fallback banner instead of a
  fabricated location.
- Sister-geography suggestions can reuse the same focus CBSA codes.
- AdaptiveMarketWorkspace remains off the review page.

## Alternatives considered

1. Always show the national mainland extent. Rejected because geographically
   specific questions need a zoomed region.
2. Invent a default demo market such as Seattle for national questions.
   Rejected because it invents geography and violates evidence boundaries.
3. Restore Interactive AdaptiveMarketWorkspace on the review page. Rejected by
   the review-page composition decision.

## Evidence references

- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `tests/geographic-focus.test.ts`
- `components/decision-workflow/GeographicFocusMap.tsx`
