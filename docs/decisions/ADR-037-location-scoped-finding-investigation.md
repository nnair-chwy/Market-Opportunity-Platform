# ADR-037: Preserve finding intent through location-scoped investigation

- Status: Proposed
- Date: 2026-08-20

## Context

Autonomous Discovery findings identify a perspective, evidence view, and one or
more exact CBSA markets. The compact Findings inbox and the full Discovery page
previously handed only a generic question string to the question workflow.
That handoff could lose the named market or select a different perspective,
view, analysis objective, and result lead.

## Decision

Represent a selected finding as a versioned `DiscoveryInvestigationIntent`.
The contract carries the source insight ID, perspective, evidence view, exact
CBSA codes, canonical market names, selected geographic contexts, and a
location-specific investigation question.

Both Findings entry points submit the full finding and use the same validated
handoff. The question workspace hydrates its perspective, active view, map
mode, question, and selected geography from the intent. The URL stores only
stable identifiers so reload and browser history can reconstruct canonical
display labels from the approved CBSA registry.

The planner and analysis brief retain the exact selected CBSA and name. Result
selection keeps only leads that intersect the requested CBSA set. If compatible
evidence for the requested geography is unavailable, the investigation returns
an explicit gap and does not substitute a national lead or another market.
Malformed geography, unsupported perspective-view combinations, and invalid
finding URLs fail closed before analysis can run.

## Consequences

- Finding investigations preserve the source perspective, view, geography, and
  analytical objective across the question, plan, and result pages.
- Compact and full Discovery entry points follow one contract.
- Reload and forward navigation restore the selected finding context.
- Back navigation clears finding-derived question and geography state.
- Manual question, perspective, or geography edits detach the finding intent so
  the edited workflow is not represented as the original finding.
- National exploration remains available when the user starts with a normal
  question rather than a selected finding.
- Exact-geography gaps remain visible and cannot silently fall back to another
  region.

## Alternatives considered

1. Continue passing only the generated question. Rejected because prose is not
   a reliable carrier for stable perspective, view, or geography identifiers.
2. Copy the separate persistent-agent route architecture. Rejected because the
   current main workflow already supports the required question, plan, and
   result phases and only needs a validated handoff contract.
3. Fall back to a national or nearby-market result when the selected market has
   no compatible evidence. Rejected because the result would answer a different
   geographic question.

## Evidence references

- `lib/insight-discovery/investigation-intent.ts`
- `lib/planning/analysis-brief.ts`
- `lib/planning/market-investigation.ts`
- `lib/planning/evidence-market-investigation.ts`
- `tests/discovery-investigation-intent.test.ts`
- ADR-023
- ADR-025
- ADR-032
- ADR-035
