# User workflows

These workflows are provisional until `OQ-001` through `OQ-007` are resolved.
The frontend uses synthetic and approved minimized prototype evidence. It does
not imply that source-system access, criteria, or production use are approved.

## Primary workflow: Explore and compare markets

### 1. Orient on the market map

1. Analyst opens Markets.
2. The map colors exact-linked CBSA boundaries from lower to higher synthetic
   attractiveness score using one fixed scale.
3. A neutral Not scored state identifies synthetic results that do not have an
   exact, unique link to the versioned `SRC-014` universe.
4. Analyst may filter All, Current, Potential, and Evaluated workflow states.
   Workflow state remains status metadata and does not control score color.
5. Public CBSA geometry and ACS values remain `market_context_only` with no
   scoring eligibility.

### 2. Select a market

1. Analyst selects a market boundary or keyboard-activates it.
2. The system updates the one selected CBSA code and the map-adjacent comparison
   tray, then scrolls the selected row only within the market browser.
3. Analyst selects a market-list row.
4. The same state updates and the existing map fits the versioned CBSA boundary.
5. If the active market falls outside the current search or workflow filter,
   the system preserves both the active market and the analyst's search, then
   shows a visible notice that the market is outside the browser results.
6. Map selection scrolls the market row only inside the independently
   scrollable result list; market controls and search remain visible.

### 3. Compare markets

1. The active market appears with its exact-linked synthetic score or a visible
   Not scored state.
2. A persistent map-adjacent tray shows the active market and the current
   ordered comparison selection.
3. Analyst explicitly selects `Add to comparison` from the map context or the
   comparison workspace; ordinary map exploration does not silently change the
   comparison.
4. Analyst adds two to five results in selection order. Numbered outlines on
   the map match the ordered tray and comparison columns.
5. The first selected result fixes the cohort. A result from the other cohort
   is blocked because metropolitan and micropolitan normalization is separate.
6. The system shows overall score, cohort rank and percentile, four subscores,
   sensitivity, missing and excluded inputs, warnings, versions, fingerprint,
   evidence status, and allowed use.
7. The system does not declare a winner or recommend market entry.
8. `Save comparison` is a visible future affordance. Activating it states that
   nothing was stored and performs no persistence.

### 3a. Review optional linked site evidence

1. After market comparison, the analyst may inspect `Linked site evidence`
   when an approved fixture relationship exists for the selected market.
2. The panel keeps site-level trade-area records separate from public CBSA
   context and market scores.
3. Missing relationships appear as a compact prototype coverage notice, not an
   application error.
4. Linked records retain raw values, provenance, unknown-date and
   unknown-method warnings, and a descriptive comparison without a composite
   or winner.

### 4. Ask AI about selected markets

1. Ask AI becomes available after one scored market is selected.
2. Its context contains only the selected structured results and, once at least
   two same-cohort markets are selected, deterministic differences supplied by
   the application.
3. AI may explain score differences, sensitivity, missing evidence, and review
   questions.
4. AI does not calculate scores or ranks, change weights, fill missing values,
   choose a market, or make a real-estate decision.

## Primary Locations workflow: Candidate briefs

### 1. Choose a potential location

1. Analyst opens Locations.
2. Candidate briefs is the default view.
3. The system shows the audited potential locations, deterministic readiness
   state, and visible missing or conflicting evidence counts.
4. Readiness describes data availability, not site quality.

### 2. Run the bounded candidate-review agent

1. Analyst selects `Prepare candidate brief` for one potential location.
2. The process-local Candidate Review Agent displays its plan, current step,
   tool activity, evidence receipts, blockers, and packet status.
3. Application policy supplies fixed tool arguments and validates evidence
   status, missingness, provenance, allowed use, and redaction.
4. An ambiguous trade-area relationship pauses for explicit analyst review.
5. The analyst may confirm one supplied relationship, reject it, or leave it
   unresolved.
6. The agent does not modify source evidence, choose scoring settings, approve
   a prerequisite, or make a location decision.

### 3. Review the evidence document

1. A completed or reviewable run opens a source-linked draft evidence brief.
2. The document preserves source, snapshot, evidence status, observation date
   or unknown date, method or unknown method, quality, sensitivity, missingness,
   conflicts, restrictions, and scoring eligibility.
3. Browser print uses the minimized presentation model and keeps excluded
   restricted values out of the document.
4. The analyst may return to the review run or the list of potential locations.

### 4. Compare locations

1. Analyst selects Compare locations.
2. Analyst chooses two to five audited candidates in selection order.
3. The same raw evidence fields appear in the same order with source details,
   missingness, and comparability warnings.
4. The comparison produces no composite, rank, winner, lease recommendation,
   or opening recommendation.

## Retained technical capabilities outside visible navigation

The repository retains governed map, address-confirmation, and standalone
readiness components for testing and potential future reuse. They are not
primary Locations destinations in the current prototype. Reintroducing them
requires a reviewed scope decision and updated evaluation cases.

## Roles

- **Analyst:** assembles evidence and comparisons
- **Reviewer:** interprets results and requests diligence
- **Decision owner:** makes and records the business decision
- **Data steward:** approves fields, definitions, access, and allowed use
- **System administrator:** manages integrations and permissions

## Human decision boundary

The product prepares evidence, deterministic calculations, comparisons, and
draft explanations. It does not approve a market or site, authorize a lease,
determine clinical strategy, or replace physical inspection and expert
judgment. This boundary is supported by `CLM-017` and the provisional interface
opportunity in `CLM-020`.
