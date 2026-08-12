# ADR-024: Perspective-scoped regional views on the opening map

## Status

Proposed. Pending repository owner review.

Date proposed: 2026-08-12.

## Context

The opening page used a full-viewport CBSA map with a static CVC-labeled
control strip. Pricing, Marketing, and CVC stakeholders need distinct regional
views without collapsing those measures into one opportunity score or letting
public Census context become a clinic, pricing, or marketing recommendation.

## Decision

Introduce a typed perspective and view catalog in `lib/perspectives/` that
defines Pricing, Marketing, and CVC perspectives. Each view declares its
measure namespace, geography grain, source IDs, evidence status, allowed use,
scoring eligibility, legend, empty state, supported question types, and whether
comparison or layer modes are allowed.

The opening page keeps the existing full-viewport map, floating perspective
dropdown, view pills, and question composer. Active view state is stored per
perspective. View changes update the map title, measure binding, legend, source
label, and evidence boundary through deterministic presentation resolution.

Unavailable or evidence-needed views render an explicit empty state. They do
not invent synthetic values. Available CVC public measures remain
`market_context_only` with scoring eligibility `none`. Perspective measure IDs
are namespaced and cannot enter another perspective’s calculations. No
universal cross-perspective score is created.

Canonical planning and execution stay in `lib/evaluation-contracts.ts`,
`lib/evaluation-operators.ts`, `lib/capability-registry.ts`, and
`lib/planning/*`. AI may propose only a validated question intent or view
selection.

## Consequences

- Pricing and Marketing opening views fail safely until approved sources exist.
- Household demand and market expansion context use `SRC-016` as public context
  only.
- Clinic footprint uses confirmed public clinic locations without choropleth
  scoring.
- Question-to-plan-to-action-packet, saved packets, packet-scoped Ask AI, sector
  routes, and governed adapters remain unchanged.

## Alternatives considered

1. One shared opportunity score across perspectives. Rejected because it mixes
   decision layers and invents unsupported authority.
2. Reusing Census measures as Marketing or Pricing values. Rejected because
   public context cannot become a recommendation in those domains.
3. Hard-coding view labels only in React state. Rejected because tests and
   planning need a typed, versioned configuration model.

## Evidence references

- `docs/technical/ai-boundaries.md`
- `docs/technical/data-contracts.md`
- `docs/research/source-registry.md` (`SRC-009`, `SRC-014`, `SRC-015`, `SRC-016`)
- `tests/perspectives.test.ts`
- `tests/adaptive-market-workspace-rendered.test.mjs`
