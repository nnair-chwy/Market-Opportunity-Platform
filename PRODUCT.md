# Market Intelligence Evaluation Workspace

This repository document mirrors the current Confluence product source of truth:
[Market Intelligence Evaluation Workspace — Product Source of Truth](https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5414978880/Market+Intelligence+Evaluation+Workspace+Product+Source+of+Truth).

Confluence owns collaborative product decisions. This file keeps implementation,
tests, and architecture aligned with those decisions. Research notes, outreach,
implementation detail, and user instructions belong in their dedicated documents.

## Product outcome

**A market-intelligence decision agent that can evaluate questions whose answers
vary by geography, visualize evidence from national to local levels, explain the
comparison, and produce a verifiable recommendation or next-action packet.**

The product combines approved internal and public evidence. It identifies
unsupported parts of a question and requests specific missing evidence instead of
fabricating a result.

## Product decisions

| Decision | Product position |
| --- | --- |
| One adaptable workspace | Every use case uses the same intake, decision decomposition, evaluation contract, orchestration, artifact renderer, human gates, and action packet. |
| Question-first experience | The user starts with a business question; the agent identifies the decision, entity, geography, comparison, evidence, and currently executable stage. |
| Map-first geographic result | The map and synchronized ranking are the first computed artifact and update as soon as the geographic calculation completes. |
| National-to-local continuity | The same contracts support country → state/region/DMA/CBSA → market/submarket → ZIP/trade area → site when those levels apply. |
| Decision levels are not evaluation steps | A level changes the evaluated entity. Each level uses the recurring protocol: scope → gather → validate → compare → explain → propose action. |
| AI proposes; application validates | AI may interpret a goal and propose a `DecisionGraph`; deterministic code validates sources, geography, operators, calculations, permissions, and capability. |
| Deterministic comparison | Scores, rankings, cohorts, thresholds, formulas, and joins are visible, versioned, and testable. |
| Evidence before confidence | Results expose source, date, grain, missingness, limitations, and evidence status. |
| Bounded autonomy | Supported analysis runs without unnecessary pauses. Human input is requested only for material information, judgment, authority, conflicting evidence, or approval. |
| Human decision authority | The product drafts recommendations and action packets; it does not approve spend, campaigns, pricing changes, leases, hiring, or clinic openings. |
| Reusable verified knowledge | Reviewed questions and decompositions become versioned Verified Evaluations and Verified Decision Blueprints. |

## Required workspace sections

### 1. Goal composer

- One prominent question box with representative runnable examples.
- Optional context, intended decision, receiving team, and time scope.
- Detection of entity, geography, time range, and question class.
- Immediate executable, partially executable, or unsupported status.
- A precise evidence request when blocked.
- Follow-up questions that preserve the evaluation and selected geography.

### 2. Decision decomposition

- A concise “How I broke down this decision” artifact without chain-of-thought.
- Ultimate decision, proposed owner, question class, stages, and receiving roles.
- Entity, parent entity, geographic grain, comparison set, output, and capability
  status for each stage.
- Current, next, and blocked stages with explanations.
- Human correction of material scope or interpretation.

### 3. Evaluation contract

- Decision, receiving function, entity, parent, eligibility, geography, and time.
- Evidence requirements, source rules, metrics, formulas, weights, and units.
- Cohort, comparison rule, boundary, thresholds, and validation rules.
- Permitted draft actions, human gates, follow-up outcome, version, and approval.

### 4. Geographic evidence map and ranking

- Colors driven by the active measure or approved composite calculation.
- Matching legend, measure, unit, period, and evidence state.
- National view at the question-appropriate grain and supported local drill-down.
- Map and ranked alternatives synchronized from one result.
- Layer switching, visible formulas, progress state, and honest unsupported state.
- A new question must never retain a stale map or ranking.

### 5. Selected-place detail

- Side panel opened from either map or ranking.
- Rank, observed values, percentile, cohort, components, and missing values.
- Supporting and contrary evidence, freshness, comparable places, and benchmarks.
- Grounded “Ask about this place” and compare/request-data/advance actions.

### 6. Evaluation canvas

Every visible step shows what is happening, why it is necessary, actor, input,
operator, output, source status, validation, blocker, and concise operational
rationale. A reviewer can correct one step without restarting the evaluation.

### 7. Evidence and lineage

- Source, owner, period, retrieval time, entity, join key, metric, version, value,
  unit, permission, allowed use, missingness, caveat, and evidence type.
- Lineage from question → contract → evidence → operator → result → correction →
  action.
- Contrary evidence beside supporting evidence.

### 8. Findings and comparison artifacts

- Primary finding, alternatives, drivers, contrary evidence, and sensitivity.
- Clear distinction among correlation, prediction, and causal evidence.
- Maps, rankings, tables, and diagnostics rendered from a generic artifact contract.
- A short explanation of the calculation and the evidence that would improve it.

### 9. Final report and action packet

- Decision, scope, recommendation strength, national and selected-local findings.
- Comparison and cited artifacts generated from the execution record.
- Assumptions, limitations, contrary evidence, and assigned data requests.
- Bounded next action, receiving role, approvals, versioned export, and final human
  approve/revise/reject state.

### 10. Verified Decision and Evaluation Library

- Verified question, interpretation and decomposition.
- Sources, permitted uses, metrics, formulas, comparison, and boundary.
- Expected fixture result, regression tests, verifier/date, version/history,
  applicability, and known unsupported variants.

`prototype_test_verified` means regression-tested; it does not mean the business
interpretation or production use is approved.

## Product capability status

Status meanings: **Connected** = working with real evidence; **Partial** = present
but incomplete, synthetic, or narrowly routed; **Planned** = defined but not
implemented; **Blocked** = waiting for data, definition, permission, or an owner.

| Capability | Current status | Next requirement |
| --- | --- | --- |
| Plain-language goal intake | **Partial** | Replace remaining keyword/rule routing with validated planning and safe unsupported behavior. |
| DecisionGraph proposal | **Partial** | Validate proposals against source, metric, geography, and operator catalogs; retain human corrections. |
| Capability-aware execution | **Partial** | Compile and run only verified executable stages; identify precise blockers. |
| Evaluation contract | **Partial** | Complete required fields, approval state, editing, and version validation. |
| Material human gates | **Partial** | Make gates resumable and request only choices that materially change the result. |
| National geographic map | **Connected for limited Census measures** | Produce a fresh artifact for every supported question and prevent stale results. |
| Synchronized market ranking | **Connected for limited Census measures** | Add validated composites and question-specific cohorts. |
| Multi-measure crossover | **Partial** | Validate compatibility, normalization, weights, missingness, and sensitivity. |
| National-to-local drill-down | **Partial; local evidence is synthetic** | Connect governed ZIP, trade-area, and site data with valid hierarchy joins. |
| Selected-place panel | **Partial** | Ground follow-up AI and actions in the active evaluation and entity. |
| Evaluation step canvas | **Partial** | Improve hierarchy and add step-level correction. |
| Generic artifact renderer | **Partial** | Remove remaining use-case assumptions and finish one artifact schema. |
| Evidence lineage | **Partial** | Persist source/operator versions, corrections, approvals, and actions. |
| Contrary evidence and sensitivity | **Planned** | Add missingness-impact and scenario/sensitivity operators. |
| Ask AI about a selected place | **Partial / unreliable** | Bind the exchange to evaluation ID, selected entity, evidence, and artifacts. |
| Cited final report | **Partial** | Generate all claims from the execution record instead of example copy. |
| Draft action packet | **Partial** | Add owner, approval, diligence/test steps, export, and final review state. |
| Verified Evaluation Library | **Planned** | Define storage, review, versioning, and initial fixtures. |
| Verified Decision Blueprints | **Planned** | Store corrected graphs with applicability and capability requirements. |
| Identity-aware permissions | **Planned** | Add governed source and action authorization aligned with the user. |

## How geography must matter

The workspace distinguishes:

1. **Direct geographic decision:** place changes the action, such as audience,
   pricing investigation, EDD padding, or site advancement.
2. **Geographic evidence:** place changes cohorting or diagnosis and may lead to a
   local intervention, such as clinic performance or awareness.
3. **Geography as experimental design:** markets are treatment/control units for
   causal measurement while the final action may be national or channel-level.

A geo test is an enabling measurement capability unless its result changes a
business action by place.

## Priority evaluation use cases

| Priority | Recurring question | Decision output | Current evidence status |
| --- | --- | --- | --- |
| 1. Local growth campaign | Which competitor trade areas or markets should receive an acquisition, repeat-purchase, or win-back test? | Ranked markets, audience readiness, controls, KPIs, and Local Growth Test Packet. | Documented internal precedent; governed fixture not connected. |
| 2. Regional pricing | Which competitor/SKU/ZIP differences require monitoring, investigation, or controlled action? | Regional price distribution, outliers, exposure, constraints, and approval request. | Internal workflows documented; narrow extract not connected. |
| 3. Delivery/EDD intervention | Which ZIPs require temporary padding for weather, carrier, or network risk? | Risk map, affected ZIPs, scenarios, guardrails, duration, and approval packet. | Workflow documented; historical fixture and authority map not connected. |
| 4. Clinic performance | Which comparable clinics require review and what local factor may explain the gap? | Peer cohort, ranking, diagnostic drivers, contrary evidence, and review packet. | Tableau route exists; privacy-safe fixture and cohort rules needed. |
| 5. Clinic market/site selection | Which markets and sites should advance into diligence? | National screen, local comparison, site scorecard, and diligence packet. | Public context connected; governed Esri/Asana layers and approved rules needed. |
| 6. Local awareness/message | Where is awareness weak and where should a message test run? | Awareness map with uncertainty and test-versus-launch recommendation. | Consumer Insights route exists; compatible aggregates and confidence metadata needed. |
| 7. Local search demand | Which needs and wording vary by city, DMA, or ZIP? | Location-keyword map, demand/visibility gaps, and reviewed next action. | SEO tools documented; reusable geographic export unconfirmed. |
| Enabling. Geo-test design | Can markets support valid treatment/control measurement and did the campaign cause lift? | Powered design, controls, contamination checks, and causal readout. | Process documented; governed completed fixture not connected. |

## Data and integration status

| Evidence or platform | Status | What it unlocks | Next bounded step |
| --- | --- | --- | --- |
| Census ACS and CBSA boundaries | **Connected** | National context, map, cohorts, rankings, and denominators. | Add versioned ZIP/county crosswalks and refresh regression. |
| Synthetic Seattle and clinic fixtures | **Synthetic only** | Orchestration, drill-down, human-gate, and regression demonstrations. | Retain explicit labels; never use for production recommendations. |
| Snowflake/dbt/Alation/CDL | **Platform path available; not connected** | Governed internal metrics, definitions, lineage, and read-only execution. | Approve one narrow aggregate view with stable geography and permitted use. |
| Local growth campaign evidence | **Partially confirmed internally** | A real geography-to-audience-to-campaign decision. | Obtain one approved historical aggregate fixture and outcome. |
| Campaign audience/consent evidence | **Internally available; owner unconfirmed** | Governed audience sizing and activation readiness. | Confirm keys, aggregation, consent/suppression rules, and estimate interface. |
| Regional pricing | **Workflow documented; not connected** | ZIP/SKU monitoring, investigation, and bounded action requests. | Obtain a narrow historical extract and operator/authority contract. |
| EDD/padding | **Workflow documented; not connected** | High-frequency ZIP service-risk evaluation. | Obtain one historical decision fixture, override, and outcome. |
| CVC reporting | **Available with approval; not connected** | Clinic-period comparison and review. | Obtain a privacy-safe aggregate fixture, dictionary, keys, and cohort rules. |
| Real Estate Esri/Asana | **Partially confirmed internally** | Trade areas, candidates, stages, and national-to-local site diligence. | Obtain an approved redacted historical packet and field/stage definitions. |
| Consumer Insights | **Available through intake; not connected** | Awareness and message-test comparisons with uncertainty. | Obtain reviewed aggregates, field dates, samples, and tested variants. |
| Conductor/SEMrush/GSC/Botify/RioSEO | **Tools documented; extract unconfirmed** | Local demand, rank, wording, and listing completeness. | Confirm one supported location-keyword export and extraction owner. |

Every connected source must declare a stable entity/geography ID, observation
period, metric and unit, source/version, owner, evidence status, freshness,
missingness, privacy rule, and permitted use. Platform access alone does not approve
a business interpretation.

## Product decisions still required

- First production decision and receiving business team.
- First governed internal geographic view or approved historical fixture.
- Default geography hierarchy and crosswalk rules.
- Approved composite-score, normalization, and sensitivity policy.
- Minimum evidence required to move from exploration to recommendation.
- Storage, retention, permissions, and audit requirements.
- Final action and approval boundaries for each use case.

## Near-term build sequence

1. Make every supported question produce a fresh map, ranking, and selected-place
   panel from the same artifact specification.
2. Complete capability validation and precise evidence requests.
3. Connect one narrow, governed internal geographic view or fixture.
4. Add deterministic multi-measure evaluation with visible compatibility, formula,
   missingness, and sensitivity.
5. Replace synthetic local drill-down with governed ZIP/trade-area evidence.
6. Generate the cited report and action packet entirely from the execution record.
7. Store the first reviewed evaluation and decomposition as versioned fixtures.

## Demo acceptance criteria

1. Different supported questions produce different correct map layers and rankings.
2. Map, ranking, selected-place detail, explanation, and report share one result.
3. A user can move from national pattern to a place and understand its position.
4. Multi-measure evaluation exposes formula, components, missingness, and sensitivity.
5. The agent distinguishes executable work from missing data, definition, judgment,
   and approval.
6. Broad clinic-opening and recurring clinic-performance questions decompose
   differently and appropriately.
7. Public, synthetic, and internal evidence are visibly distinct.
8. A human can correct a material assumption without restarting.
9. The report cites actual evidence and records the next action and approval.
10. No invented metric, unsupported recommendation, or stale visualization is
    presented as fact.

## Product boundary

The product may interpret goals, propose decompositions, gather permitted evidence,
run validated calculations, compare alternatives, explain results, and draft next
actions.

It may not invent evidence, silently mix incompatible geographies, disguise
synthetic data, claim causation without an appropriate design, or authorize spend,
leases, campaigns, pricing changes, hiring, or clinic openings.
