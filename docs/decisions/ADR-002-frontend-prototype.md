# ADR-002: Interactive frontend prototype

## Status

Proposed

## Date

2026-07-24

## Context

The user workflow needs a national map, separate current and candidate views, a candidate evidence workspace, a transparent deterministic score, source inspection, and a constrained AI question interface. The existing architecture recommended Streamlit for speed but allowed a production web path when required.

Important uncertainties remain:

- ownership and status of the internal site-selection MVP are unresolved;
- production data and Esri access are not confirmed;
- scoring criteria and weights are not approved; and
- audit, access, and durable-result requirements are not defined.

Evidence: `CLM-001`, `CLM-008`, `CLM-015`, `CLM-017`, `CLM-020`, `CLM-021`, `CLM-022`, and `CLM-023`.

## Decision

Create a React and TypeScript frontend prototype using Vinext and Vite.

The prototype will:

- use public clinic names and markets from `SRC-009`;
- use synthetic candidate, metric, source, and score data;
- calculate demonstration scores deterministically without AI;
- expose raw values, weights, contributions, coverage, warnings, and versions;
- constrain AI responses to the visible structured result and evidence metadata; and
- store newly evaluated results only for the active interface session.

The prototype will not connect to Esri, Snowflake, Tableau, Smartsheet, or other internal source systems. It will not persist shared decisions or claim production readiness.

## Alternatives

### Streamlit

Fast for a quantitative prototype but less suitable for the map-first product workflow and polished interaction model requested for stakeholder review.

### Static design only

Lower implementation effort but unable to validate evaluation, map-state, source-inspection, and assistant interactions.

### Production service and integrations now

Rejected for this phase because ownership, data access, governance, scoring approval, and audit requirements are unresolved.

## Consequences

- The team can review the user workflow in a working interface.
- Product behavior remains clearly synthetic and reversible.
- The client-side score is not a production implementation.
- Durable storage, authentication, integrations, and a quantitative backend remain future decisions.
- User review is required before this ADR is accepted or committed.
