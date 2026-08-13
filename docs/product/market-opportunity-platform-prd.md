# Market Opportunity Platform PRD

## Document status

- Status: Draft for user review
- Date: 2026-08-13
- Product stage: Localhost demonstration
- First vertical: Clinic and regional market evaluation

This PRD proposes product and architecture changes. It does not supersede the
current scope, AI boundaries, data contracts, or decision records until the
repository owner reviews and accepts it.

## Product summary

The Market Opportunity Platform helps clinic strategy, real-estate, and
site-selection analysts ask a regional business question, review how the system
interpreted it, and receive a source-linked action packet.

The first release should answer one question reliably:

> Which markets and clinics have enough trustworthy evidence to warrant further
> review, and what is blocking the rest?

The first technical vertical slice may demonstrate the related question:

> Which regional markets show increasing consumer demand, underused clinic
> capacity, and weak Google Ads coverage?

The product recommends a next operational action, such as further research, a
site visit, a regional survey, or investigation of ad spend. It does not execute
that action or make the final business decision.

## Problem

Regional decisions depend on evidence spread across different sources,
geographies, time windows, and owners. Analysts must manually determine which
data is relevant, reconcile conflicting signals, calculate comparisons, and
turn the result into a useful next step. Missing provenance and inconsistent
geography make the process difficult to trust or repeat.

## First users

- Clinic strategy analysts
- Real-estate and site-selection analysts
- Accountable business reviewers

The analyst asks the question and reviews the evidence. The accountable
business owner decides whether to act on the recommendation outside the
platform.

## Product goals

1. Let an analyst ask a regional question in natural language.
2. Interpret the question into a visible geography, time window, evidence need,
   analysis method, and requested output.
3. Require one user confirmation of that interpretation before execution.
4. Retrieve only evidence available in the approved local snapshot.
5. Run reproducible calculations and preserve missing or conflicting evidence.
6. Produce a concise, downloadable, source-linked action packet within 90
   seconds.
7. Return a clear no-action or research-needed result when the evidence cannot
   support a recommendation.

## Success measures

The 30, 60, and 90-day targets are not yet defined. Before evaluating the demo,
the owner must choose measures such as:

- percentage of supported questions completed without manual data assembly;
- time from question confirmation to packet;
- percentage of packet claims with valid source references;
- reviewer agreement that the packet identifies a useful next step; and
- number of unsupported or misleading recommendations found in review.

## First-release scope

### Included

- One local user and synchronous execution
- One configured market and one selected time window
- CBSA and ZIP-level questions
- Natural-language question interpretation
- One confirmation screen before execution
- Versioned local evidence snapshots
- Google Ads regional aggregates
- Aggregate clinic-performance evidence
- Structured consumer-insight claims
- Public Census CBSA geography and context
- Deterministic joins, aggregations, comparisons, and scores
- AI-assisted evidence selection from an allowlisted snapshot
- AI-generated explanation, confidence label, and recommended next action
- Contrary evidence, missingness, warnings, and claim-level source references
- Local download of a versioned action packet
- User-relevant progress while the synchronous run is active

### Later playbooks

- Plan an on-site visit
- Plan a regional marketing campaign
- Operate a regional survey
- Investigate changing regional ad spend
- Compare multiple markets or candidate sites using sector-specific scoring
- Reuse a prior evidence snapshot in follow-up questions

### Excluded

- Production hosting, authentication, or multiple concurrent users
- Recurring ingestion or near-real-time updates
- External writes to Google Ads, Jira, Slack, Outlook, Esri, or other systems
- Durable packet workflow inside the application
- A universal market score across clinic, growth, and pricing decisions
- Arbitrary model-generated SQL
- Automatic lease, market-entry, spend, campaign, or clinic-opening decisions
- Customer-level data, precise customer coordinates, medical records,
  credentials, or unapproved raw exports

## User experience

1. The analyst enters a regional question.
2. AI proposes an interpretation containing:
   - decision type;
   - geography and time window;
   - evidence categories and source snapshots;
   - metrics and scoring approach;
   - expected output and recommended-action types.
3. The system resolves geography to stable CBSA or ZIP identifiers. An
   ambiguous place name triggers clarification.
4. The analyst confirms the complete interpretation. This is the final
   in-product approval step for the demo.
5. The application runs synchronously and shows only useful progress.
6. Deterministic code validates, joins, aggregates, and calculates the evidence.
7. AI explains the structured result, identifies contrary evidence, assigns a
   clearly labeled interpretive confidence, and recommends a permitted next
   action.
8. If required evidence is complete, the analyst receives a downloadable action
   packet. If required evidence is incomplete, the analyst receives a blocked,
   no-action, or research-needed result instead of a full action packet.

The recommendation is advisory. The system does not perform the action, and
the business owner remains responsible for deciding whether to act.

## Question and AI behavior

The interface accepts flexible natural language, but execution remains bounded.
AI may:

- interpret intent and geography;
- select relevant evidence from sources available to the approved snapshot;
- propose existing or new metrics and a scoring configuration;
- identify patterns, gaps, and contrary evidence;
- generate a confidence label with a written rationale; and
- recommend one permitted operational next action.

AI may not:

- access an undocumented source;
- generate or execute arbitrary SQL;
- invent, impute, or silently repair evidence;
- change source values or geography mappings;
- calculate the final numeric result outside versioned application code;
- hide missing or contradictory evidence; or
- execute an external or material business action.

An AI-proposed metric, direction, weight, or threshold becomes executable only
when it is included in the visible interpretation confirmed by the user and can
be compiled into a supported deterministic operator. Unsupported proposals
produce a research-needed result.

## Geography

- Primary market geography: CBSA
- Smallest demo geography: ZIP code
- Largest geography: National CBSA universe for public context
- Geography input: Freely interpreted by AI, then resolved deterministically
- Ambiguity handling: Ask the user to clarify
- Candidate sites: Assign to geography with an approved deterministic method
- Boundary treatment: Static for the one-time demo snapshot
- Drive-time areas: Excluded until an approved provider and method exist

The demo may use precise coordinates already approved and present in the
repository. It must not use precise customer coordinates or infer permission
from the mere presence of restricted data in a local folder.

## Evidence and source policy

### Confirmed repository sources

- `SRC-014`: July 2023 CBSA delineation
- `SRC-015`: 2024 CBSA boundary geometry
- `SRC-016`: 2024 ACS aggregate context
- Approved minimized fields from `SRC-017`
- Explicit synthetic fixtures

### User-reported demo sources requiring registration

- Google Ads export data
- SEO keyword search trends
- Aggregate clinic-performance data
- Consumer-insight documents or structured claims

Before ingestion, each user-reported source needs a source ID, snapshot ID,
owner if known, grain, observation window, allowed use, sensitivity, and fields
permitted in AI prompts and packet output. Their mention in this PRD is not a
claim of production approval.

Snowflake exports are the preferred authority when two structured internal
sources disagree. A conflict affecting required geography, joins, metrics, or
eligibility blocks the calculation. Other conflicts remain visible and lower
the interpretive confidence.

## Data and architecture

The demo runs inside the existing Next application on localhost:

```text
Local raw files outside Git
  -> source adapters
  -> TypeScript and Zod validation
  -> versioned Parquet snapshot
  -> DuckDB analytical queries
  -> deterministic calculations
  -> evidence bundle
  -> AI explanation and recommendation
  -> local action-packet download
```

Raw CSV, XLSX, and source documents live under ignored local storage. Normalized
tables use Parquet. DuckDB reads the snapshot without a separate database
server. TypeScript functions own the supported SQL and calculations. The model
never receives database credentials or a general SQL execution tool.

The snapshot should contain:

- source metadata and manifest;
- geography mappings;
- Google Ads observations;
- clinic-performance observations;
- structured consumer-insight records;
- canonical evidence observations;
- rejected rows and quality results; and
- calculation and packet artifacts for the current run.

The demo uses a one-time, non-recurring batch. It does not need Postgres. Packet
state exists only during the process and in the user's downloaded file.

## Canonical evidence model

The canonical unit is one observation for one metric, geography, observation
window, source snapshot, and version. Each observation includes:

- stable evidence and metric IDs;
- geography type and stable geography ID;
- observation start and end;
- raw value and unit, or an explicit null state;
- source and snapshot IDs;
- evidence status: `Confirmed`, `Reported`, `Derived`, `Hypothesis`, or
  `Unknown`;
- quality status;
- sensitivity and allowed use; and
- extraction, ingestion, and publication timestamps when available.

Invalid records are rejected or quarantined. One-to-many joins and row
multiplication block calculation. Exact stable-ID joins are required. No fixed
missingness or join-coverage threshold is defined yet, so the first playbook
must set and test those values explicitly.

## Deterministic analysis boundary

Versioned application functions own:

- geography joins;
- eligibility and cohort filters;
- aggregation;
- metric formulas;
- normalization;
- weights and thresholds confirmed in the interpretation;
- scoring and ranking;
- missing-data rules; and
- sensitivity checks.

Every calculation must preserve its formula, inputs, source IDs, snapshot ID,
and code or configuration version. The same inputs and confirmed interpretation
must reproduce the same numeric result.

## Action packet

A complete packet contains:

- original question;
- confirmed interpretation;
- geographic scope and time window;
- executive finding;
- evidence used and unavailable;
- data-quality warnings;
- analysis and formulas;
- key and contrary findings;
- recommended next action and rationale;
- accountable owner;
- success measure;
- open questions and required external approvals;
- source, snapshot, calculation, prompt, and model versions; and
- human-review status.

The packet is immutable once downloaded, is not versioned inside the platform,
and does not expire. The static demo data means automatic staleness and
regeneration are out of scope.

## Functional requirements

- `FR-PRD-001`: Accept a natural-language regional question.
- `FR-PRD-002`: Produce a structured interpretation and request one user
  confirmation before execution.
- `FR-PRD-003`: Resolve CBSA and ZIP geography to stable IDs and clarify
  ambiguous names.
- `FR-PRD-004`: Retrieve evidence only from a registered local snapshot.
- `FR-PRD-005`: Validate schemas, ranges, provenance, geography, duplicates,
  missingness, joins, and allowed use before calculation.
- `FR-PRD-006`: Execute only versioned query and calculation functions.
- `FR-PRD-007`: Support AI-selected evidence and proposed metrics within the
  confirmed interpretation and available deterministic operators.
- `FR-PRD-008`: Preserve contrary evidence, nulls, conflicts, and rejected-row
  reasons.
- `FR-PRD-009`: Complete a supported synchronous run within 90 seconds.
- `FR-PRD-010`: Show only user-relevant progress during execution.
- `FR-PRD-011`: Generate claim-level source references where feasible.
- `FR-PRD-012`: Produce one recommended operational next action when evidence
  supports it.
- `FR-PRD-013`: Return no action, blocked, or research needed when required
  evidence is insufficient.
- `FR-PRD-014`: Download a complete packet locally without creating external
  tasks or messages.
- `FR-PRD-015`: Keep separate clinic, growth, and future pricing playbooks and
  scores.

## Non-functional requirements

- Localhost-only and single-user
- Synchronous response target of 90 seconds
- Reproducible numeric outputs
- Explicit source and calculation lineage
- No sensitive raw inputs in Git, prompts, logs, or packet output
- Fail closed on invalid geography, row-multiplying joins, and unsupported
  calculations
- Visible distinction between deterministic facts and AI interpretation
- Controlled failure when the model or a source is unavailable

## Acceptance criteria for the first vertical slice

The slice is complete when:

1. One approved local snapshot contains registered Google Ads, aggregate clinic
   performance, consumer-insight, and geography evidence.
2. One natural-language question compiles into a visible interpretation that
   the user can confirm.
3. The system resolves one market and time window, then runs without arbitrary
   model-generated SQL.
4. Every numeric output is reproduced from a versioned deterministic function.
5. Missing and contrary evidence appears in the result.
6. Every factual packet claim links to a source or is labeled as interpretation.
7. A complete result downloads as an action packet, while incomplete required
   evidence returns a blocked or research-needed result.
8. The supported run finishes within 90 seconds on the demo machine.
9. No external action occurs and no prohibited data appears in Git, prompts,
   logs, or output.

## Open decisions

These items must remain configurable or blocked until answered:

- Named first market and time window
- Exact clinic outcome, capacity definition, and maturity window
- Exact Google Ads and SEO fields allowed for the demo
- Owners and source IDs for user-reported inputs
- Canonical timezone
- Missingness and join-coverage thresholds
- Metric formulas, directions, weights, and thresholds for the first question
- Expected input volume and available secrets
- Named packet owner and success metric
- 30, 60, and 90-day success targets
- Whether the existing internal site-selection project owns overlapping work

## Recommended build order

1. Register and inspect the three demo sources.
2. Build the validated Parquet snapshot and quality report.
3. Add DuckDB and one versioned evidence query.
4. Add the interpretation confirmation contract.
5. Implement the deterministic analysis for one question.
6. Generate and download the action packet.
7. Add AI evidence selection, explanation, confidence, and recommendation.
8. Test failures, missing data, conflicting evidence, citations, and the
   90-second target.
9. Review the vertical slice before adding another playbook.
