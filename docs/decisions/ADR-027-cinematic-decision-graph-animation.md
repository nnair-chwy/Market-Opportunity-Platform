# ADR-027: Cinematic decision graph animation in the post-question workflow

## Status

Proposed. Pending repository owner review.

Date proposed: 2026-08-12.

## Context

After a question is submitted, analysts need a visual trace of the validated
decision path before the reviewable action packet appears. An earlier split
layout mounted the animation beside the result page, which compressed the
packet into a sidebar and treated animation and result as simultaneous panels.

## Decision

Use three mutually exclusive full-page phases:

1. Question page
2. Decision graph animation page
3. Result page

State flow is `question → animation → result`. Only one phase renders at a
time.

The animation page:

1. mounts only while interpreting or running the validated plan;
2. occupies the full viewport with the cinematic decision graph;
3. may show a compact status HUD for current steps, but never the result packet;
4. builds progressively from `activeStep`; and
5. is implemented as a self-contained SVG/React animation rather than Mapbox or
   a third-party flow library dependency.

When animation completes, the application transitions to the full-width result
page. The decision graph unmounts; the packet is never rendered beside the
graph.

## Consequences

- Animation and result are sequential pages, not a persistent split-screen.
- Geographic MapLibre context remains on the question page and inside the
  result packet map.
- The compact animation HUD is process feedback only and is not a second source
  of scoring or decision authority.

## Alternatives considered

1. Keep animation and result in one split layout. Rejected because the result
   page becomes a compressed sidebar and violates the exclusive-phase model.
2. Adopt React Flow or Mapbox trip layers as the runtime. Rejected for this
   version to avoid new product branding, Mapbox replacement pressure, and an
   extra dependency for a bounded prototype surface.
3. Make the graph the editable execution engine. Rejected because deterministic
   planning remains authoritative.

## Evidence references

- `docs/technical/ai-boundaries.md`
- `docs/product/mvp-scope.md`
- `tests/decision-graph-animation-rendered.test.mjs`
