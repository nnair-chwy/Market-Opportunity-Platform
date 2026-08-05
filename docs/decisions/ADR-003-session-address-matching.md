# ADR-003: Session-only proposed-location address matching

## Status

Proposed

## Date

2026-07-27

## Context

The frontend needs a way for a reviewer to enter and confirm an address as a
new proposed location. The existing interface can display coordinates and
evaluate structured candidates, but it has no address-resolution adapter,
confirmation step, or approved durable candidate store.

Precise confidential candidate addresses are not approved for this prototype.
Audit and persistence requirements also remain unresolved in `OQ-006` and
`OQ-011`.

The Census Geocoder can provide a public address match and calculated
coordinates. Its documentation states that coordinates are derived from
address ranges and that a match does not prove that a structure exists.
Evidence: `SRC-013` and `CLM-024`.

## Decision

Add a server-side Census Geocoder adapter for synthetic, public, or otherwise
approved demonstration addresses.

The interface will:

- collect an address and optional candidate label;
- display the standardized match and calculated coordinates;
- require the reviewer to confirm the intended match;
- label the match as `Derived` evidence;
- create a session-only proposed location with status `Needs data`;
- prevent evaluation until validated metric evidence is available; and
- state that confirmation does not establish deliverability, structure
  existence, lease availability, or clinic suitability.

The interface will not persist addresses, submit confidential pipeline
locations, infer missing metrics, or treat address confirmation as a completed
evaluation.

## Alternatives

### Client-side provider call

Rejected because provider access and error handling belong behind an adapter
boundary, and future providers may require credentials or tighter request
controls.

### USPS deliverability validation

Deferred because deliverability is not required to validate the first
interaction and may introduce licensing, access, and workflow questions.

### Durable candidate creation

Deferred until the business owner defines audit, access, retention, duplicate,
and source-system requirements.

## Consequences

- Reviewers can validate the full entry and confirmation interaction with safe
  demonstration addresses.
- Refreshing the page removes reviewer-entered proposed locations.
- Address matches remain distinct from validated scoring inputs.
- A production workflow still needs approved address sensitivity, provider,
  authentication, persistence, audit, and source-system ownership decisions.
- User review is required before this ADR is accepted or committed.
