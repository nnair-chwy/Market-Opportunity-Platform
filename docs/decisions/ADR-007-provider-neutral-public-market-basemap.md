# ADR-007: Provider-neutral street basemap for public market context

## Status

Proposed

## Date

2026-07-29

## Context

The Public market context view already presents versioned Census CBSA
boundaries and ACS period estimates. Its Albers USA SVG supports deterministic
selection and a safe offline view, but it does not show the roads, cities, and
surrounding geographic context needed to orient a reviewer after selecting a
market.

No tile provider, provider account, style URL, credential, or county-boundary
source is approved in this repository. Public CBSA evidence remains governed by
`SRC-014`, `SRC-015`, `SRC-016`, `CLM-025`, `CLM-026`, and `CLM-027`.

## Decision

Add MapLibre GL JS 6.0.0 as the provider-neutral client renderer and:

- read an approved style only from `NEXT_PUBLIC_MAP_STYLE_URL`;
- keep provider configuration separate from checked-in Census and ACS data;
- commit no real style URL, provider token, API key, or restricted URL;
- treat the client-facing environment value as public and allow only HTTPS or
  local-development HTTP URLs without URL-embedded basic credentials;
- convert the versioned CBSA TopoJSON to MapLibre-compatible GeoJSON in memory;
- retain `Confirmed`, `Derived`, missing, public sensitivity,
  `market_context_only`, and no-scoring metadata;
- render semi-transparent metric fills, boundary outlines, and a strong
  selected-market outline above provider roads and below provider labels;
- use one selection path for Browse controls and map clicks;
- fit selected geometry with padding and a maximum zoom of 8;
- reset to explicit mainland bounds;
- retain the SVG map when the style is absent, invalid, or fails before loading;
- preserve Browse controls as the visible keyboard-accessible market-selection
  path; and
- show provider style attribution together with explicit Census attribution.

The basemap provider supplies only its configured cartography. It does not
define Census geometry, ACS values, market eligibility, trade areas, service
areas, drive times, scores, weights, or recommendations. The application sends
no candidate, customer, medical, or restricted record to the provider.

County boundaries are not included. The existing `us-atlas` dependency does
not provide the approved versioned Census source contract required for this
evidence view. A later change may add counties only after its source, vintage,
license, manifest, display threshold, and provider responsibility are approved.

## Alternatives

### Replace the SVG map unconditionally

Rejected because the view must remain usable when no provider is approved or
configured, and because provider failures must not hide checked-in Census
evidence.

### Commit a provider style or token

Rejected because provider approval is unresolved and client-side tokens are
visible to browser users. Configuration belongs in the deployment environment.

### Use OpenStreetMap community tile servers

Rejected as an unreviewed production backend. MapLibre is only the renderer;
the tile service remains an explicit provider decision.

### Reuse `us-atlas` county geometry

Rejected for this view because its current repository use does not establish
the versioned Census evidence and source metadata required here.

## Consequences

- The browser requests a configured style and its tiles from the approved
  provider while never requesting CBSA or ACS data from Census at runtime.
- Provider labels and street context can remain visible around a selected CBSA.
- A style URL that requires a browser token must use a provider-approved public
  token with suitable domain and usage restrictions.
- Provider availability, terms, attribution, privacy, and production capacity
  remain approval items outside this renderer integration.
- The SVG fallback remains part of the supported architecture and test suite.
- This ADR requires user review before it is accepted or committed.
