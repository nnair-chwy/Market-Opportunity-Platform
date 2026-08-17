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

## Shared evaluation workflow

The versioned TypeScript and Zod contracts in `lib/evaluation-contracts.ts`
define the cross-vertical workflow boundary:

- `QuestionSpec` records the decision question, geography and time scope,
  eligibility, required evidence, permitted actions, and approval gates.
- `DecisionGraph` links evidence, deterministic rules, review, artifacts, and
  permitted draft actions without embedding hidden reasoning.
- `EvidenceRecord` preserves source IDs, provenance, evidence status,
  sensitivity, geography, time scope, allowed use, and explicit availability.
  Missing and unknown evidence retains `null`; schema parsing never imputes a
  value.
- `EvaluationContract` contains formulas, thresholds, weights, missing-data
  rules, capabilities, artifact specifications, and contract approval.
- `ActionPacket` keeps an AI-proposed interpretation separate from a
  human-approved interpretation and cannot approve an action while a required
  gate remains unsatisfied.

Contract version `1.0.0` supports synthetic, draft, and approved states.
Synthetic records remain limited to `synthetic_prototype_only`. The clinic
scoring adapter maps the existing deterministic `EvaluationInput` and
`ScoringConfiguration` into the shared contract without changing scoring
behavior. These contracts add no persistence and do not authorize a final
real-estate decision.

### Evaluation plan

`lib/planning/contracts.ts` defines a strict `EvaluationPlan` between the
question UI and canonical execution boundary. It records the original question,
proposal method, constrained intent, registry capability, geography grain,
execution status, evidence boundary, missing evidence and approvals, visible
steps, and permitted draft actions. The API response must parse this contract
before it enters application state.

An AI-proposed intent and deterministic fallback both compile through the same
registry assessment. The plan does not contain executable formulas, source
credentials, gate receipts, or authority to modify an `EvaluationContract`.

Public map percentiles use `compare_cohort` with one compatible `SRC-016`
measure and an explicit metro/micro and workflow cohort. Missing values remain
unranked. The output is `market_context_only` and has no scoring eligibility.

### Review-page geographic focus

`lib/planning/map-focus.ts` resolves a deterministic review-map focus from the
validated evaluation plan and approved public CBSA fixtures:

1. Named question geography with available CBSA geometry (`Confirmed`).
2. Otherwise, for executable national Census-context questions, the top
   metropolitan market from a deterministic `compare_cohort` on the requested
   `SRC-016` measure (`Derived`), or an action-packet CBSA identifier when
   present.
3. Otherwise a labeled `fallback` state with empty CBSA codes and `Unknown`
   evidence status. The UI must not invent a substitute location.

The focus contract records `state`, `source`, `cbsaCodes`, `label`,
`evidenceStatus`, and `message`. The map remains geographic context only and
has no scoring eligibility.

### Reviewable draft action packet

The decision-review panel presents one proposed draft action packet assembled
from the validated `EvaluationPlan` and its primary planned action. The browser
may download that packet as a local markdown document that includes the
structured packet JSON, original question, geographic focus, evidence boundary,
missing evidence and approvals, packet version, and calculation or evidence
versions. The download is review-only: it does not send email, Slack, or any
external message, and it does not imply approval or execution.

An AI findings summary may restate the validated packet into four draft points:
what the evidence indicates, why the proposed action is relevant, what the
accountable owner should do next, and what remains unknown or unapproved. When
the model is unavailable or fails validation, the application uses a
deterministic summary of the same structured inputs.

### Sister geographies

`lib/planning/sister-geographies.ts` derives up to three suggested follow-up
geographies from a validated `EvaluationPlan` and the review-map geographic
focus already derived from that result, using only the checked-in SRC-014 CBSA
universe. Eligibility requires a focused CBSA, shared state coverage, and
matching CBSA type. Suggestions are alphabetical and carry separate
`shared_state` and `matching_cbsa_type` signals with evidence status and
explicit uncertainty. The rule creates no composite score and does not claim
similar demand, population, performance, or opportunity. Selecting “Ask about
this geography” returns to the question state with a rewritten follow-up
question and does not auto-save or overwrite the current packet. The section is
omitted when no eligible candidates exist.

### Opening-page perspectives and regional views

`lib/perspectives/` defines a versioned catalog for Pricing, Marketing, and CVC
opening perspectives. Each view records perspective ID, view ID, display label,
namespaced active measure, geography grain, source IDs, evidence status,
evidence availability, allowed use, scoring eligibility, legend configuration,
empty or unavailable state, supported question types, comparison and layer
support, and a deterministic map binding.

Perspective measures remain isolated by namespace. Public Census bindings stay
`market_context_only` with scoring eligibility `none`. Unavailable views expose
an explicit empty state and do not impute values or create a universal score.

### Deterministic operator boundary

The strict contracts in `lib/evaluation-operators.ts` expose versioned
`normalize_metric`, `join_geography`, `filter_eligible_entities`,
`compare_cohort`, `calculate_weighted_result`, `run_sensitivity`, and
`render_artifact` operators. Inputs must parse as structured Zod contracts;
natural-language instructions and unknown fields are rejected.

Every invocation belongs to exactly one decision layer: market
attractiveness, submarket opportunity, property feasibility, or execution
priority. Operators do not combine layers. Numeric inputs retain source, input,
transformation, formula, normalization, and sensitivity versions. Missing
values remain explicit and qualitative evidence has no accepted path into
weighted calculations.

## Workspace capability registry

Registry version `1.1.0` in `lib/capability-registry.ts` declares the executable
boundary for `census_market_context`, `clinic_performance`,
`clinic_site_evaluation`, and `local_growth_test`. Each entry records its
version and status, supported geography grains and outputs, required evidence,
permitted deterministic operators, approval requirements, and known
limitations.

Question assessment returns `supported`, `unsupported`, `partially_supported`,
or `blocked`, plus supported and unsupported outputs and explicit missing
evidence or approvals. A synthetic capability may execute only for its stated
prototype use. Planned and unavailable capabilities do not become executable
because a caller supplies an identifier.

The initial registry marks only public Census market context as connected.
Clinic performance evidence is available for descriptive review from approved
aggregate exports. Outcome definitions, maturity rules, and owner approvals
remain separate requirements for comparison and scoring. Clinic site evaluation is synthetic.
Local growth testing is planned and requires approved, privacy-safe aggregate
inputs. The registry does not establish a Snowflake, Tableau, Esri, campaign,
or customer-data connection.

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
