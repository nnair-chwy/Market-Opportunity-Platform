# ADR-016: Score map and focused comparison workspaces

- Status: Proposed
- Date: 2026-07-31

## Context

The Markets map used workflow-category colors even though a deterministic
synthetic attractiveness result was available. Map, market-browser, and detail
interactions felt disconnected. The Locations workspace also exposed map,
readiness, brief, and agent destinations as parallel workflows, which obscured
the intended candidate-review path.

## Decision

Use one accessible sequential scale for exact-linked synthetic market scores
on both MapLibre and the SVG fallback. The build attaches a CBSA code only for
an exact, unique name match to the versioned `SRC-014` universe. Unmatched
records remain neutral and Not scored.

Use one selected CBSA code for map and market-browser interactions. A map click
updates the active market and synchronizes its row inside the independently
scrollable browser list without moving the search controls; a list click fits
the map to the versioned boundary. The comparison tray provides an explicit
Open comparison action when the analyst wants to move to the comparison area.

Keep one session-only comparison selection in the Markets workspace so the map,
market browser, and comparison table cannot diverge. A persistent map-adjacent
tray shows selection order and provides explicit add, remove, clear, and open
actions. Ordinary map selection does not add a market. Comparison markets use a
numbered outline on MapLibre and the SVG fallback without replacing score fill.

Replace the selected-market review card with a two-to-five-market comparison.
The comparison preserves analyst order and accepts only one normalization
cohort. Ask AI receives only the selected structured results and may explain,
not recalculate or recommend. The visible Save comparison control stores
nothing in this prototype.

Reduce visible Locations navigation to Candidate briefs and Compare locations.
The candidate path is potential location, bounded agent review, draft evidence
document, and raw location comparison. Readiness remains a deterministic input
to that flow rather than a separate primary destination.

## Alternatives considered

1. Continue coloring by workflow category. Rejected because it does not reflect
   the requested scoring view and conflates status with attractiveness.
2. Fuzzy-match every synthetic name to a current CBSA. Rejected because renamed
   or changed areas could be silently assigned to the wrong geometry.
3. Compare metropolitan and micropolitan scores together. Rejected because the
   engine normalizes and ranks those cohorts independently.
4. Keep every Locations prototype surface visible. Rejected because it creates
   parallel paths instead of the intended candidate-brief workflow.
5. Simulate saved comparisons in browser storage. Rejected because the product
   does not yet have an approved persistence, audit, or access contract.

## Consequences

- Some public market boundaries remain visibly unscored.
- Workflow category remains available as status and filtering metadata but no
  longer controls Markets polygon fill.
- Analysts must explicitly add an active market to a comparison.
- Map and browser additions update the same ordered, session-only selection.
- Existing readiness and map components may remain in code for governed reuse,
  but they are not primary Locations destinations.
- Product documentation and evaluation cases must preserve the synthetic,
  same-cohort, non-persistent, and human-decision boundaries.

## Evidence references

- `PROJECT_CONTEXT.md`
- `docs/product/mvp-scope.md`
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `docs/research/claim-ledger.md`
- `docs/product/open-questions.md`
- `SRC-014`
