# ADR-008: Unified MapTiler evaluator map

## Status

Proposed for user review

## Date

2026-07-30

## Context

The main evaluator rendered separate maps for clinic and candidate views and
for public Census market context. Changing the top-level view either remounted
the SVG clinic map or replaced it with a separate MapLibre market map. That
made geographic context discontinuous and prevented current, potential,
evaluated, and public-market evidence from appearing together.

ADR-007 established MapLibre as the provider-neutral renderer for public
market context. This decision extends that renderer across the primary
evaluator without changing any evidence, scoring, or decision authority.

## Decision

Mount one persistent `UnifiedEvaluatorMap` immediately after the page heading
and primary actions.

The map:

- uses the existing MapLibre GL JS 6.0.0 renderer;
- loads the approved MapTiler style from `NEXT_PUBLIC_MAP_STYLE_URL`;
- uses `NEXT_PUBLIC_MAPTILER_KEY` for an origin-restricted browser key, while
  allowing an untracked local style URL that already contains a browser key;
- keeps MapTiler provider configuration separate from Census and location
  records;
- keeps current, potential, and evaluated locations in separate map sources;
- replaces the potential presentation with the evaluated presentation when a
  stable candidate ID has a structured evaluation;
- differentiates location categories by color, shape, label, and evidence
  text;
- retains the checked-in Census CBSA GeoJSON conversion, metric missingness,
  evidence metadata, selected boundary, and maximum market-fit zoom;
- keeps the map mounted while view tabs, category filters, searches, and
  market metrics change;
- fits a selected CBSA, eases to a selected location, and resets to explicit
  mainland bounds;
- constrains panning and minimum zoom to a buffered mainland United States
  extent so edge states remain fully visible while wheel gestures cannot
  escape to a wrapped world view;
- preserves an integrated SVG fallback with selectable CBSA boundaries and
  location markers when MapTiler is missing, invalid, or unavailable; and
- leaves all searchable lists and evidence panels available during provider
  failure.

MapTiler supplies streets, labels, and visual orientation only. It is not an
evidence source for demand, suitability, performance, market ownership,
scores, recommendations, or decisions. The application sends no customer,
medical, restricted, or precise customer-location records to MapTiler.

The Census overlay remains `public`, `market_context_only`, and ineligible for
scoring. Missing ACS values remain distinct from observed zero. Evaluated
means that the deterministic structured evaluation ran. It does not mean that
a site is approved or recommended.

County boundaries remain deferred until an approved, versioned source,
license, transformation, display threshold, and source-registry entry exist.

## Consequences

- One MapTiler initialization supports the page instead of initialization per
  view change.
- Current, potential, evaluated, and Census context can be reviewed together.
- View tabs control the side panel without replacing the map.
- Category checkboxes independently control marker visibility.
- A browser-facing MapTiler key is visible by design and must be restricted by
  allowed HTTP origin and monitored through the approved account.
- Provider terms, attribution, billing, production capacity, and account
  approval remain deployment responsibilities.
- ADR-007 remains the origin of the provider-neutral MapLibre boundary. This
  ADR supersedes its separate Public market context rendering path.

## Approval

The user approved implementation, use of MapTiler Streets, environment
placeholders, and retirement of the active legacy map renderers on 2026-07-30.
No commit or push is authorized.
