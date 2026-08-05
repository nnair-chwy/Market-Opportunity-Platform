# ADR-017: Bounded Seattle market deep-dive demo

- Status: Proposed
- Date: 2026-08-03

## Context

The prototype needs to demonstrate how a selected parent market could be split
into reviewable submarkets and followed by broker research without claiming
that approved boundaries, production data, or licensed broker information are
available.

## Decision

Implement one Seattle-only, process-local workflow for CBSA `42660` using seven
synthetic analyst-defined submarkets and four fictional broker profiles. Render
the submarkets as overlapping deterministic geodesic areas around approximate
public city-center hubs on the existing persistent map. Pause for explicit
analyst confirmation of the illustrative segmentation before any
comparison. After confirmation, use deterministic, versioned code to expose
raw indexes, effective weights, contributions, missingness, coverage, stable
ranking, and sensitivity. Describe outputs only as priorities under demo
criteria.

The model selects a next action from an application-calculated allowlist. It
does not calculate scores, define geography, invent brokers, or make a market,
property, broker, outreach, or lease decision.

## Alternatives considered

1. Use real neighborhood boundaries and broker search results. Rejected because
   governance, boundary methods, licensing, verification, and outreach rights
   are unresolved.
2. Let the model create submarkets or scores. Rejected because geography and
   scoring must be deterministic, reviewable, versioned, and testable.
3. Run comparison before analyst review. Rejected because the segmentation is
   a hypothesis that materially determines the comparison unit.

## Consequences

- The feature is useful for a workflow demo but has no production authority.
- Missing synthetic values remain visible and trigger explicit reweighting.
- Illustrative geometry has scoring eligibility `none` and cannot influence
  calculations.
- The areas are not clipped into mutually exclusive boundaries and may overlap.
- A restart or runtime change can remove run state.
- Production use requires decisions in `OQ-029` through `OQ-032`.
- This proposed ADR and associated scope changes require user review before
  acceptance or commit.

## Evidence references

- `SRC-014`, `SRC-015`, `SRC-016`
- `SYN-SEATTLE-SUBMARKET-001`
- `SYN-SEATTLE-BROKER-001`
- `docs/product/open-questions.md`
- `docs/technical/ai-boundaries.md`
