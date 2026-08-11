# Data contracts

## Proposed location

Address confirmation creates a proposed-location record before it creates a
scoring candidate. The prototype record is session-only.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `site_id` | string | Yes | Stable identifier for the active session |
| `site_name` | string | Yes | Reviewer-entered label or a derived city label |
| `input_address` | string | Yes | Address entered by the reviewer |
| `matched_address` | string | Yes | Standardized match returned by the provider |
| `latitude` | number | Yes | Provider-derived latitude |
| `longitude` | number | Yes | Provider-derived longitude |
| `city` | string | Yes | Provider-returned city |
| `state` | string | Yes | Provider-returned state code |
| `zip` | string | Yes | Provider-returned ZIP code |
| `provider` | string | Yes | Address-resolution provider |
| `provider_version` | string | Yes | Provider benchmark or version |
| `source_id` | string | Yes | Approved source-registry ID |
| `evidence_status` | enum | Yes | `Derived` for the provider match |
| `resolved_at` | timestamp | Yes | Time the provider returned the match |
| `confirmed_at` | timestamp | Yes | Time the reviewer selected the intended match |
| `evaluation_state` | enum | Yes | Begins as `Needs data` |

Reviewer confirmation means the match represents the intended proposed
location. It does not confirm postal deliverability, building existence, lease
availability, or clinic suitability. A proposed location is promoted into the
candidate-site evaluation path only after approved evidence is assembled.

## Candidate site

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `site_id` | string | Yes | Stable synthetic or approved candidate identifier |
| `market_id` | string or null | Yes | Stable parent market ID; null remains visibly unassigned and cannot be evaluated |
| `market_assignment` | object | Yes | Assignment method, source, evidence status, geography version, and assignment time |
| `site_name` | string | Yes | Human-readable candidate label |
| `latitude` | number | Prototype only | Synthetic or approved latitude |
| `longitude` | number | Prototype only | Synthetic or approved longitude |
| `evaluation_date` | date | Yes | Date the evidence represents |
| `metrics` | object | Yes | Metric observations keyed by approved metric ID |
| `qualitative_evidence` | array | No | Source-linked, non-scored observations |
| `constraints` | array | No | Screening rules and their status |

## Market workflow

Market workflow state is stored separately from the public CBSA reference
record and every location result.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `market_id` | string | Yes | Stable ID that resolves to the approved market universe |
| `category` | enum | Yes | `current`, `potential`, or `evaluated` |
| `review_state` | enum | Yes | `not_started`, `needs_evidence`, `in_review`, or `complete` |
| `evidence_status` | enum | Yes | Evidence status for the workflow classification |
| `source_id` | string | Yes | Approved or explicitly synthetic source ID |
| `updated_at` | timestamp | Yes | Time represented by the workflow record |
| `review_note` | string | No | Visible rationale or prototype limitation |

`unclassified` is a presentation state for markets that exist in the public
universe without a workflow record. It is not written as inferred evidence.

Market category precedence is `current`, then `evaluated`, then `potential`,
then `unclassified`. A market with a Current location is Current even if it
also contains Potential or Evaluated candidates.

## Location market assignment

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `market_id` | string or null | Yes | Stable parent market or explicit unassigned state |
| `assignment_method` | enum | Yes | `source_provided`, `derived`, `reviewer_confirmed`, or `unassigned` |
| `source_id` | string or null | Yes | Source for the relationship |
| `evidence_status` | enum | Yes | Evidence status for the relationship |
| `geography_version` | string or null | Yes | Market-geography version used |
| `assigned_at` | timestamp or null | No | Time the relationship was recorded |

An Evaluated location requires a Current or Evaluated parent market. A Current
location requires a Current parent market. Invalid or missing relationships
are rejected visibly and are never silently repaired.

## Metric observation

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `metric_id` | string | Yes | Identifier from the metric catalog |
| `raw_value` | number or null | Yes | Observed value; null means missing |
| `unit` | string | Yes | Explicit unit |
| `source_id` | string | Yes | Source-registry or approved dataset ID |
| `observed_at` | date | Yes | Data observation date |
| `geography` | string | Yes | Point, radius, drive time, market, or other grain |
| `quality_status` | enum | Yes | `accepted`, `warning`, or `rejected` |
| `sensitivity` | enum | Yes | `public`, `internal`, `confidential`, or `restricted` |

## Metric definition

Each metric must specify:

- name and business meaning;
- direction of preference;
- valid range and unit;
- aggregation and geographic grain;
- normalization function;
- missing-data treatment;
- freshness threshold;
- owner and source;
- whether it is a hard constraint or weighted preference.

## Scoring configuration

A configuration contains:

- immutable version;
- approved-by and approved-at fields;
- metric weights;
- screening thresholds;
- normalization versions;
- exclusions;
- total-weight validation; and
- notes explaining the business rationale.

## Structured result

The result must preserve:

- input-data version;
- scoring version;
- calculation version;
- raw and normalized values;
- metric contributions;
- excluded and missing metrics;
- warnings;
- sensitivity results;
- source references; and
- human decision separately from system output.

See `data/schemas/site-input.schema.json` for the synthetic starting contract.

## Public CBSA market universe

The July 2023 CBSA build creates a versioned mainland market-universe snapshot
from `SRC-014`. "Mainland" is determined only through an explicit component
state FIPS allowlist for the contiguous 48 states and Washington, DC. The
stored universe retains eligible metropolitan and micropolitan CBSAs.

Each market contains:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `market_id` | string | Yes | Stable `cbsa:<five-digit-code>` identifier |
| `cbsa_code` | string | Yes | Five-digit Census CBSA code |
| `cbsa_name` | string | Yes | Census CBSA title |
| `cbsa_type` | enum | Yes | `metropolitan` or `micropolitan` |
| `principal_cities` | array | Yes | Sorted city name, state code, state FIPS, and place FIPS values |
| `component_counties` | array | Yes | Sorted county name, five-digit county FIPS, state name, state code, and state FIPS values |
| `state_codes` | array | Yes | Unique sorted postal state codes represented by component counties |
| `delineation_vintage` | string | Yes | `2023-07` for this snapshot |
| `source_id` | string | Yes | `SRC-014` |
| `evidence_status` | enum | Yes | `Confirmed` |
| `sensitivity` | enum | Yes | `public` |
| `allowed_use` | enum | Yes | `market_context_only` |
| `scoring_eligibility` | enum | Yes | `none` |

The build aggregates repeated county and principal-city rows only after
validation. Malformed, duplicate, inconsistent, or orphaned rows are rejected
and retained in a separate audit artifact. A CBSA touched by a rejected row is
not emitted. Missing values are never converted to observed zero.

The manifest records the exact input URLs, retrieval timestamp, input SHA-256
hashes, transformation version, output hashes, record counts, type counts,
geographic exclusions, and rejected-row counts. This contract establishes a
public reference universe only. It does not approve population, growth,
boundaries, ranking, or scoring use.

## Public CBSA boundary geometry

The 2024 geometry build joins `SRC-015` to the validated July 2023 market
universe by exact five-digit CBSA code. Only features present in that mainland
universe are emitted. Every geometry feature contains:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `cbsa_code` | string | Yes | Five-digit join key |
| `cbsa_name` | string | Yes | Name from the validated market universe |
| `cbsa_type` | enum | Yes | `metropolitan` or `micropolitan` |
| `aland` | integer | Yes | Source shapefile `ALAND` observation in square meters |
| `awater` | integer | Yes | Source shapefile `AWATER` observation in square meters |
| `geometry_type` | enum | Yes | `Polygon` or `MultiPolygon` |
| `boundary_vintage` | string | Yes | `2024` |

The browser artifact is quantized and simplified TopoJSON. Simplified display
geometry must not be used to calculate authoritative land area. The source
`ALAND` value remains the land-area observation.

The separate audit result retains unmatched source features, duplicate source
features, rejected features, and validated market records with missing
geometry. Missing geometry is never represented as zero and the market remains
visible in the market list. The build's documented missing-geometry tolerance
is zero.

Boundary geometry is `Confirmed`, `public`, and `market_context_only`, with no
scoring eligibility. CBSAs are Census statistical areas. Their polygons do not
represent trade areas, drive times, or service areas.

## Public CBSA ACS market context

The 2024 ACS 5-year build joins `SRC-016` to the validated mainland universe
and compatible 2024 `SRC-015` `ALAND` by exact five-digit CBSA code. It retains
total population, household count, median household income, and housing units
as `Confirmed` direct estimates. Population density is `Derived` from total
population and source land area. Every metric retains `null` for missing or
suppressed values, `observed_at: 2024-12-31`, `public` sensitivity,
`market_context_only` use, and no scoring weight.

The label is `2020–2024 ACS 5-year estimate`. These are period estimates, not
current point-in-time counts. The snapshot includes all 917 mainland markets;
the default UI list is a reversible population-sorted view of 50 metropolitan
areas. Population growth is not calculated because comparing vintages requires
an approved rule for boundary compatibility.

## Minimized Esri internal-demo snapshot

The `SRC-017` snapshot has stable ID `esri-demo-2026-07-30`, transformation
version `esri-demo-2026-07-30-v1`, `internal` sensitivity,
`internal_demo_evidence_only` use, and no scoring eligibility. Its manifest
records source filenames, source hashes, row and field counts, output hashes,
retained and excluded fields, limitations, and unresolved prerequisites.

### Field catalog

Each source field is inventoried even when its values are excluded. A field
record contains a canonical field ID, dataset, source field, business label,
definition status, unit or `null`, observation date or `null`, geographic
grain and method, applicable workflow stages, sensitivity, allowed use,
evidence status, quality rules, retention decision, exclusion reason, and
scoring eligibility fixed to `none`.

### Site identity and trade-area relationship

Each approved site uses a stable ID derived from the source master-site
`GlobalID`. The fixture retains the approved real site name, brand, site
coordinate, market labels, source workflow fields, and selected physical-site
evidence. Missing values remain `null`.

The crosswalk retains every source Esri-ID relationship without silently
selecting a primary record. Link state is `source_provided`, `needs_review`,
`synthetic_fallback`, or `unassigned`. Four sites use explicit synthetic
fallback records because their master rows have no source trade-area match.
One source ID links a site to two records and remains `needs_review`.

### Portfolio site readiness

Readiness contains stable site identity, workflow stage, source and trade-area
link states, expected and available evidence counts, missingness counts,
readiness percentage, readiness state, evidence-state map, issues, follow-up
items, provenance, and source IDs.

The percentage is:

```text
available required evidence / expected required evidence
```

Requiredness is stage-specific. Evidence states distinguish `available`,
`unavailable`, `missing`, `not_required`, `rejected`, `restricted`, `stale`,
and `unresolved_link`. Missing observation dates and unknown trade-area
methods remain visible warnings. `Reported` source evidence, `Derived`
readiness, and synthetic `Hypothesis` values are never collapsed into one
status.

## Trade-area context observation

The market profile extends the shared Esri contract rather than the stricter
scoring `MetricObservation`, because the supplied export has no metric
observation date. A context observation contains:

- site and trade-area IDs;
- trade-area role and relationship review state;
- source field, canonical metric ID, display label, raw value or `null`, and
  unit or `null`;
- source ID, source snapshot ID, received date, observation date or `null`,
  geographic grain, and geography method or `null`;
- evidence, quality, sensitivity, allowed-use, and transformation labels;
- supplied or synthetic state;
- limitations and warnings; and
- `scoring_eligibility: none`.

Relationship review state is `provisional`, `review_required`, `synthetic`, or
`unassigned`. `source_provided` remains provisional because an exact source ID
match does not prove the intended trade-area role or method.

The adapter rejects non-finite values and flags percentage values outside the
documented negative-100 to positive-100 range. It validates a complete
distribution only when every band is present, with an explicit expected total
and tolerance. It does not recalculate pet households per clinic because the
source formula and denominator are unconfirmed. It does not calculate
population density from square miles.

Age and income bands and sparse crime, environmental, and labor ranks remain
unavailable until definitions, denominators, direction, dates, and owners are
approved. Missing values are rendered as unavailable and never as zero.

## Candidate evidence brief

The candidate evidence brief is a deterministic, non-scored projection of the
shared Esri fixture and trade-area profile. It does not extend the scoring
result contract.

Each brief preserves:

- stable brief, site, market, and selected trade-area IDs;
- brief, source snapshot, and transformation versions;
- a fixed generated timestamp for reproducible fixture output;
- supplied, derived, and synthetic origins;
- raw value or `null`, unit state, definition state, source field, source ID,
  observation date, geography, method, quality, sensitivity, and allowed use;
- explicit `available`, `missing`, `unknown`, `restricted`, `rejected`,
  `stale`, and `conflicting` evidence states;
- identity and workflow, market and trade-area, clinic landscape,
  physical-site, constraints and diligence, and analyst follow-up sections;
- missing information, conflicts, restrictions, expected owners, and
  deterministic follow-up questions;
- human review state; and
- `scoring_eligibility: none`.

Restricted observations contain no source value and set `is_redacted: true`.
The supplied clinic layer is not admitted. The isolated
`SYN-CLINIC-LANDSCAPE-001` fixture distinguishes synthetic source-account rows
from estimated physical locations and never represents a geospatial
calculation.

The comparison accepts two to five unique site IDs in analyst selection order.
It uses a fixed field order, preserves each cell's raw evidence metadata, and
emits date, method, and unit comparability warnings. It contains no composite,
normalization, weight, contribution, rank, winner, or recommendation field.

## Candidate review agent run

The prototype candidate review run is process-local and non-durable. It is a
workflow record over approved minimized evidence, not a source-system record or
site decision.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `runId` | string | Yes | Unique process-local run identifier |
| `siteId` | string | Yes | Stable candidate identifier from the approved fixture |
| `status` | enum | Yes | `planned`, `collecting`, `validating`, `waiting_for_review`, `ready_for_evaluation`, `completed`, `blocked`, or `failed` |
| `currentStep` | string | Yes | Concise visible action, never hidden reasoning |
| `plannedSteps` | array | Yes | Typed checklist with pending, active, completed, waiting, or blocked state |
| `completedSteps` | array | Yes | Stable step IDs completed by policy-approved tools |
| `toolInvocations` | array | Yes | Allowlisted tool name, status, summary, source IDs, and timestamps |
| `evidenceReceipts` | array | Yes | Evidence, provenance, allowed use, sensitivity, and snapshot receipt |
| `unresolvedBlockers` | array | Yes | Explicit conditions preventing further preparation or evaluation |
| `requestedHumanDecisions` | array | Yes | Pending or answered approval contracts |
| `reviewerResponses` | array | Yes | Confirm, reject, or leave-unresolved receipts |
| `sourceSnapshotVersions` | array | Yes | Versions actually attached to the run |
| `modelVersion` | string | Yes | Model that selected bounded next actions |
| `promptVersion` | string | Yes | Orchestration instruction version |
| `toolContractVersion` | string | Yes | Allowlisted tool-contract version |
| `generatedArtifactId` | string or null | Yes | Draft review-packet ID when assembled |
| `evaluationStatus` | enum | Yes | Separate `not_checked`, `blocked`, `ready`, or `completed` prerequisite state |
| `maxSteps` | integer | Yes | Hard orchestration ceiling, currently eight |
| `stepCount` | integer | Yes | Number of tool invocations attempted |
| `createdAt`, `updatedAt` | timestamp | Yes | Process-local audit timestamps |
| `persistence` | literal | Yes | `process_local_prototype` |

### Agent step and tool result

Every model-produced next action is parsed against a strict schema and checked
against the policy-derived permitted tool set. The application supplies the
site and review context. The model cannot supply raw evidence, scoring inputs,
weights, thresholds, source-system write targets, or hidden geospatial inputs.

Tool results contain a concise summary, approved source IDs, an optional
evidence receipt, explicit blockers, an optional human-decision request, and an
optional draft artifact. Tool outputs preserve `null`, evidence status,
sensitivity, allowed use, scoring eligibility, and provenance. Restricted
source values never enter a tool result.

### Approval and reviewer response

A trade-area approval identifies the ambiguity, possible source-linked
variants, consequences, and three allowed responses: `confirm`, `reject`, or
`leave_unresolved`. Confirm requires one supplied variant. The receipt applies
only to the process-local run and does not change `SRC-017`, assign a production
trade-area role, or approve scoring use.

### Evidence receipt and draft artifact

An evidence receipt records the tool, source IDs, evidence statuses,
sensitivity, allowed use, scoring eligibility, snapshot versions, and time.
Public CBSA receipts remain `market_context_only` with scoring eligibility
`none`. A draft artifact records its source IDs and remaining items and is
`draft_for_review`, `draft_blocked`, or `ready_for_evaluation`. It never records
a final site decision.

## Synthetic market attractiveness snapshot and result

The versioned input snapshot contains only `Hypothesis` records with
`allowed_use: synthetic_prototype_only`. Each record preserves a stable
prototype market ID, nullable official CBSA code, market name, cohort,
reporting date, synthetic method version, synthetic-field list, configured
metric values, retained source values, and source labels. Source-prefixed
values are provenance only and cannot enter the scoring configuration.

The build attaches `cbsa_code` only when the synthetic name exactly and
uniquely matches the July 2023 `SRC-014` universe. It also records
`cbsa_join_status`, `cbsa_join_source_id`, and `cbsa_join_vintage`. Unmatched or
renamed areas retain `null`; no runtime name match, fuzzy match, or inferred
geography is allowed. Map rendering joins results to geometry only by the
explicit five-digit code.

The deterministic result preserves the data, configuration, calculation, and
normalization versions plus a configuration fingerprint. It returns each
metric's raw, transformed, winsorized, normalized, weighted, and contributed
value; dimension subscores; overall score; cohort rank and percentile; missing
and excluded inputs; warnings; and fixed-scenario sensitivity summary.

A market comparison contains two to five unique exact-linked results in
analyst selection order. Ask AI becomes available with one selected exact-linked
result and continues to use the selected set as additional markets are added.
Every multi-market result set must use the same scoring cohort because
metropolitan and micropolitan normalization is separate. The selection is
session-only and does not create a saved record. Ask AI receives only the
selected structured results and, when two or more are selected, deterministic
differences supplied by the application.

Missing configured inputs fail validation. They are not converted to zero and
their weights are not redistributed. Metropolitan and micropolitan records are
normalized and ranked independently. Full definitions and assumptions are in
`docs/technical/market-attractiveness-scoring.md`.

## Seattle market deep-dive demo

The fixture manifest fixes parent CBSA `42660`, source IDs
`SYN-SEATTLE-SUBMARKET-001` and `SYN-SEATTLE-BROKER-001`, evidence status
`Hypothesis`, allowed use `synthetic_prototype_only`, and fixture version. A
submarket record contains a stable ID, label, description, nullable metric
values, limitations, display number and color, approximate public city-center
hub, illustrative radius, and geometry method version. Deterministic code
generates a closed geodesic polygon from each hub. The areas may overlap, are
not clipped into a partition, are not approved geography, and have geometry
scoring eligibility `none`.

The five metric indexes are bounded from zero to one hundred. Missing values
remain `null`. The deterministic result exposes raw and normalized values,
configured and effective weights, contributions, coverage, missing inputs,
stable rank, and fixed five-point weight sensitivity. Available weights are
renormalized visibly within a record; no value is imputed.

Broker profiles are fictional workflow records with `demo://` contact
placeholders, unverified status, coverage and specialty labels, limitations,
and no scoring eligibility. They contain no real personal information.

The process-local run records status, a visible seven-step plan, allowlisted
tool invocations, evidence receipts, the segmentation request and response,
blockers, readiness flags, version metadata, and an optional draft packet. A
comparison-ready state is impossible without a recorded `confirm` response.

## Synthetic Opportunity Inbox

The Opportunity Inbox proof of concept accepts only versioned synthetic events
for Seattle CBSA `42660`. Source observations are `Hypothesis`; values produced
by deterministic application rules may be `Derived`. Every accepted event
retains its source, observation and receipt times, payload version, sensitivity,
allowed use, quality, freshness, and processing state. Missing values remain
`null`.

Malformed, rejected, or prohibited events are excluded from playbook evaluation
and retained as quarantine receipts with stable IDs and explicit reasons.
Duplicates are retained as separate audit identifiers. Supporting,
contradicting, missing, stale, rejected, and quarantined states are not
collapsed.

Each versioned `PlaybookDefinition` declares its synthetic thresholds, required
metrics, evidence coverage, freshness, deduplication window, cooldown,
expiration, permitted actions, stakeholder role, outcome definition, and
guardrails. These definitions have `allowed_use: synthetic_prototype_only` and
do not approve production rules.

The ecosystem closure fixture also carries typed context observations for
fictional retailer identity, synthetic location, event type, verification,
permanence, effective date, source record, geography eligibility, delivery and
CVC coverage, campaign saturation, inventory constraints, and competitor
context. Each context observation has a discriminated string, boolean, number,
or date value plus its own source, evidence status, quality, observation time,
sensitivity, and allowed use. A reported closure and a verified permanent
closure are separate facts. Missing typed values remain `null` and `Unknown`.

For `local-competitor-closure`, deterministic application code assembles a
versioned `ActionPacket`. The packet records the `advance`, `stop`, or `blocked`
system disposition; prepared course of action; synthetic accountable owner;
calculated 48-hour deadline; situation; completed analysis; remaining blockers;
ordered actions; advance and stop conditions; measurable outcome; guardrails;
assumptions; source IDs; and input, evidence, playbook, packet, and calculation
versions. `advance` requires every configured condition to pass. A known
contradiction produces `stop`; absent required evidence produces `blocked`.
No missing value is imputed.

The ecosystem packet has no human validation or approval gate. That exception
applies only to automatically preparing synthetic planning artifacts and
simulated communication previews. It does not authorize a real campaign,
outreach, operational write, market decision, clinic action, or stakeholder
message. Marketing and Pet Health opportunities retain their current separate
human dispositions.

An `Opportunity` preserves stable identity, input and calculation versions,
the triggering rule result, evidence snapshot, expiration, optional ecosystem
ActionPacket and explanation, deterministic fallback draft, and sector-specific
disposition. Process-local storage retains active and historical records but
may be lost on restart or across runtime instances.

The national monitoring projection covers every market in the checked-in
`SRC-014` CBSA universe. A `MarketScanStatus` records the market identity,
operational scan state, opportunity count, explanation, observation time,
evidence status, allowed use, and scoring eligibility. These records describe
workflow state only. They must retain `scoringEligibility: none` and must not be
interpreted as attractiveness, performance, priority, or rank.

`DiscoveryStageReceipt` records deterministic counts for ingest, validation,
market scan, qualification, and review preparation. `DiscoveryActivityEvent`
is a compact projection of retained market exceptions and qualifications. The
portfolio metrics are derived from the same market statuses and active
opportunities, so the map, pipeline, feed, and register reconcile. Outside
Seattle, highlighted states are explicitly synthetic workflow examples and do
not assert real market conditions.
