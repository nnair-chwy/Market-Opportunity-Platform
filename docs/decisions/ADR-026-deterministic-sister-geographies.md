# ADR-026: Deterministic sister geographies on decision review

## Status

Proposed. Pending repository owner review.

Date proposed: 2026-08-12.

## Context

After a geographic question produces a reviewable action packet, analysts often
want nearby or analogous markets to investigate with the same intent. Earlier
review UI listed same-state markets without evidence status, uncertainty, or a
safe handoff into a new question, which risked looking like ranked
recommendations or silently replacing the active packet.

## Decision

Add a bounded sister-geography suggestion path in `lib/planning/` that:

1. uses only the validated plan’s selected CBSA codes or the review-map geographic
   focus codes already derived from the evaluation result, plus SRC-014
   delineation facts;
2. requires shared state coverage and matching CBSA type;
3. shows those signals separately with Confirmed/Unknown status and uncertainty
   copy that rejects similarity, demand, population, performance, and
   opportunity claims;
4. limits the list to three alphabetically ordered suggestions with no
   composite score; and
5. exposes “Ask about this geography,” which rewrites the original question for
   the selected market, returns to the question phase, prompts creation of a
   new action packet, and leaves saved packets unchanged.

The review section renders only when eligible candidates exist.

## Consequences

- National, clarification, and unresolved geography results show no sister
  section unless the review map already carries a focused evaluation-result or
  action-plan CBSA.
- Sister suggestions remain `market_context_only` with scoring eligibility
  `none`.
- Follow-up investigation stays question-first and does not invent evidence.

## Alternatives considered

1. ACS percentile or population similarity ranking. Rejected because it would
   fabricate opportunity-like ordering beyond the validated plan boundary.
2. Auto-running the follow-up evaluation and replacing the packet. Rejected
   because it would mutate or overwrite the current review without consent.
3. Showing an empty-state sister section for every packet. Rejected because
   absence of eligible candidates should hide the section.

## Evidence references

- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `docs/research/source-registry.md` (`SRC-014`)
- `tests/sister-geographies.test.ts`
