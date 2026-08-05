# From Retail and Clinic Location Evaluator to Market Opportunity Platform

## Transition brief and new-project foundation

**Prepared:** August 5, 2026  
**Status:** Working proposal for review  
**Purpose:** Preserve the useful product, research, data, technical, and governance context from the current repository while defining a clean pivot into a broader market opportunity platform.

## Executive summary

The current Retail and Clinic Location Evaluator began as a clinic-first prototype for assembling location evidence, comparing markets and candidate sites, and preparing a reviewable brief for human decision makers. It has grown into a credible demonstration of a broader capability: a governed way to identify, compare, and investigate market opportunities without hiding evidence quality, missing data, scoring assumptions, or decision ownership.

The most reusable part of the work is not a clinic ranking or a single map. It is the operating model underneath the prototype:

- define the decision before collecting data;
- separate market attractiveness, submarket opportunity, property feasibility, and execution readiness;
- preserve source, date, geography, sensitivity, allowed use, and missingness for every observation;
- calculate screening, normalization, scoring, and sensitivity deterministically;
- keep public context, internal descriptive evidence, synthetic demonstration data, and approved scoring inputs separate;
- use AI to explain validated evidence and prepare review artifacts, not to invent inputs or make the final decision; and
- record the human decision separately from system output.

The recommended pivot is to start a new project called the **Market Opportunity Platform** as a working name. Its purpose would be to help analysts and business leaders answer a broader question:

> Where should we focus, for which opportunity, based on what evidence, with what uncertainty, and what should happen next?

The new platform should not begin as a universal enterprise system. It should begin with one clearly named market opportunity decision and one accountable user. The clinic location workflow should remain the first reference vertical and a source of reusable components, contracts, and evaluation cases. Clinic-specific logic should become a module, not the identity of the whole platform.

The current repository is a strong prototype foundation, but it is not production-ready. The market ranking and Seattle submarket results are synthetic hypotheses. Public Census sources are approved only as context. The minimized Esri snapshot is internal-demo evidence only and is not eligible for scoring. Production criteria, weights, persistence, access, ownership, performance outcomes, and decision rights remain unresolved.

## 1. Why the original project exists

Clinic location evaluation combines geospatial, market, customer, competitor, operational, staffing, and real-estate evidence. The available research indicates that parts of the process can be standardized, but final decisions still require expert judgment and sometimes physical site visits (`CLM-017`, `SRC-003`).

The original opportunity was to create a repeatable workflow that:

1. assembles approved evidence for a candidate site;
2. calculates transparent location metrics;
3. compares candidates using approved and versioned criteria;
4. explains strengths, risks, missing data, and sensitivity to assumptions; and
5. preserves provenance for human review.

An important overlap was identified early. An internal `Vet Clinic Site Selection` plan already proposes historical validation, predictive modeling, feature importance, weighting, and candidate ranking using data for approximately 30 to 50 clinics (`CLM-001`, `CLM-002`, `SRC-001`). Its current ownership, staffing, implementation status, and relationship to this prototype remain unknown (`CLM-021`, `OQ-001`, `OQ-002`).

That overlap shaped the current product wedge. Rather than claiming to replace the site-selection model, the prototype focuses on transparent evidence assembly, deterministic comparison, review workflows, and source-linked briefs. This is a useful distinction to retain in the new project.

## 2. What has been learned

### 2.1 The decision hierarchy matters

The work has clarified four related but different questions:

| Decision layer | Question | Appropriate output | What it must not imply |
| --- | --- | --- | --- |
| Market attractiveness | Which markets deserve further review under an approved opportunity thesis? | Comparable market evidence, screening results, scores or tiers, sensitivity, and gaps | A market-entry decision |
| Submarket opportunity | Where inside a selected market should diligence focus? | Reviewed submarket definitions, relative opportunity evidence, and research priorities | An authoritative boundary or property recommendation |
| Property feasibility | Which candidate properties satisfy physical, commercial, operational, and regulatory requirements? | Constraint results, evidence briefs, comparable facts, and missing information | Lease approval or replacement of a site visit |
| Execution priority | In what sequence could approved opportunities be pursued? | Scenario comparison, dependencies, resource constraints, and human-approved sequencing | A self-executing expansion plan |

These layers can share evidence and interface patterns, but they should not share one hidden score. A strong market can contain weak properties. A feasible property can exist in a lower-priority market. A promising opportunity may be impossible to execute in the required window.

### 2.2 Readiness is not attractiveness

The current repository distinguishes data readiness from site quality. A readiness percentage describes whether expected evidence is available for a workflow stage. It does not say whether a market or property is desirable. This boundary should become a platform-wide rule.

### 2.3 Public context is useful without becoming a score

The versioned Census market universe, boundaries, and ACS estimates provide consistent public context (`SRC-014`, `SRC-015`, `SRC-016`). They are valuable for navigation, orientation, and evidence display. Their current contract is `market_context_only` with no scoring eligibility. The platform should preserve that allowed-use concept rather than treating every available variable as a feature.

### 2.4 Missingness is decision information

The prototype preserves `null` as missing and distinguishes unavailable, rejected, stale, restricted, conflicting, and unresolved evidence. It does not silently substitute zero, infer a relationship, or redistribute weights unless the configured policy explicitly permits it. This is one of the strongest reusable principles in the project.

### 2.5 AI is most useful after the evidence is structured

The project supports a bounded role for AI. AI may summarize structured results, explain deterministic differences, identify gaps, draft diligence questions, and prepare source-linked review artifacts. It must not invent data, choose production weights, perform hidden calculations, score qualitative evidence without an approved rubric, resolve ambiguous relationships, or make the final market, site, lease, or opening decision.

## 3. Current project inventory

### 3.1 Product experience

The current prototype includes:

- separate **Markets** and **Locations** workspaces;
- a persistent MapLibre map with an accessible SVG fallback;
- synchronized market selection between map and browser list;
- versioned public CBSA boundaries and aggregate ACS context;
- a synthetic market-attractiveness map and ranking;
- ordered comparison of two to five same-cohort markets;
- deterministic score details, contributions, missing inputs, warnings, versions, fingerprints, and sensitivity;
- a non-persistent `Save comparison` affordance that clearly states nothing was stored;
- context-aware Ask AI behavior limited to selected structured results;
- candidate evidence briefs built from minimized, approved demo fields;
- raw location comparison without a composite, winner, or recommendation;
- a bounded Candidate Review Agent that pauses on ambiguous evidence relationships;
- session-only proposed-location handling after Census address confirmation;
- an isolated scoring sandbox for testing weights, constraints, contributions, and sensitivity; and
- a Seattle-only market deep-dive demonstration with synthetic submarkets, deterministic scoring, an analyst confirmation gate, and fictional broker records.

### 3.2 Data and evidence assets

The repository contains several distinct evidence classes:

**Confirmed public context**

- a versioned July 2023 mainland CBSA universe derived from Census delineation and principal-city files (`SRC-014`);
- 917 mainland markets in the checked-in snapshot, including 383 metropolitan and 534 micropolitan areas;
- versioned 2024 Census CBSA display geometry (`SRC-015`); and
- 2020-2024 ACS 5-year estimates for population, households, median household income, housing units, and derived population density (`SRC-016`).

These assets are public, versioned, and reproducible, but remain non-scored market context.

**Reported internal-demo evidence**

- a minimized snapshot derived from user-supplied Esri clinic, master-site, and trade-area exports (`SRC-017`);
- 71 stable master-site identities;
- 67 source-linked site relationships, four explicit synthetic fallbacks, and one one-to-many relationship retained for review;
- selected aggregate trade-area and physical-site fields; and
- explicit exclusion of clinic-level operational, lease, landlord, employee, customer, contact, prescription, and other restricted values.

The source snapshot lacks approved observation vintages, trade-area methods, production access, ownership, and governance. It is internal-demo evidence only and is not eligible for scoring.

**Synthetic hypothesis data**

- a versioned market-attractiveness snapshot and scoring configuration;
- candidate location and scoring fixtures;
- a synthetic clinic-landscape comparison fixture;
- seven Seattle-area submarket hypotheses; and
- four fictional Seattle broker profiles.

Synthetic records are useful for testing workflows and calculations. They are not evidence about real opportunity quality.

### 3.3 Deterministic analytical capabilities

The current implementation includes reusable patterns for:

- schema, range, unit, geography, freshness, provenance, and sensitivity validation;
- explicit rejection and audit retention;
- higher-is-better and lower-is-better normalization;
- separate hard constraints and weighted preferences;
- versioned weight configurations and fingerprints;
- metric contributions and score reconciliation;
- deterministic tie handling;
- fail-closed behavior for missing configured inputs;
- bounded sensitivity analysis that does not mutate the baseline;
- separate metropolitan and micropolitan normalization cohorts; and
- byte-equivalent or reproducible outputs for fixed inputs and versions.

The synthetic market-attractiveness implementation uses cohort-specific 2nd and 98th percentile winsorization, empirical percentile normalization, explicit direction reversal, and fixed weight-shift scenarios. These are prototype design choices, not approved production methodology.

### 3.4 Technical foundation

The application is implemented with TypeScript, React, Vinext, Vite, MapLibre GL JS, Zod, and the OpenAI SDK. It uses build-time public data artifacts, local fixtures, server-side API routes, deterministic domain libraries, and process-local agent-run stores.

The current architecture follows this pattern:

1. approved or synthetic source adapters;
2. validation and provenance;
3. deterministic geography and metric calculations;
4. versioned screening, normalization, and scoring;
5. structured comparison results;
6. optional AI explanation or packet preparation; and
7. human review and a separately recorded decision.

As of August 5, 2026, the repository build and complete automated test command pass. The run completed 168 TypeScript tests and 36 rendered or API tests, for 204 passing tests and no failures. The build emitted a non-blocking warning about a client chunk larger than 500 kB.

### 3.5 Documentation and governance foundation

The repository already contains:

- project context, MVP scope, requirements, workflows, and non-goals;
- a source registry and claim ledger;
- explicit evidence labels: `Confirmed`, `Reported`, `Derived`, `Hypothesis`, and `Unknown`;
- data contracts for markets, assignments, observations, scoring configurations, results, briefs, and agent runs;
- AI boundaries and security rules;
- architecture and integration options;
- evaluation plans, success metrics, and test cases; and
- 17 architecture decision records covering the major prototype choices.

This documentation discipline should be copied into the new project before feature development begins.

## 4. What is demonstrated, proposed, and unresolved

### Demonstrated in the local prototype

- A reviewer can navigate a market universe and inspect versioned public context.
- A synthetic market score can be mapped and decomposed transparently.
- Two to five same-cohort market results can be compared in analyst-selected order.
- Public context can remain isolated from scoring.
- Candidate evidence can be minimized, validated, and rendered without exposing excluded restricted fields.
- Ambiguous relationships can pause an agent workflow for human review.
- AI can be restricted to supplied structured results and source identifiers.
- Deterministic calculations can be tested for reproducibility, missingness, and policy boundaries.

### Proposed, but not validated as a production workflow

- The current Markets and Locations information architecture.
- The synthetic market-attractiveness dimensions, metrics, directions, and weights.
- The Candidate Review Agent as an operating workflow.
- The Seattle submarket deep-dive pattern.
- A persistent market comparison record.
- A portfolio scenario and sequencing layer.
- Integration of an approved predictive model with the evidence platform.

### Unresolved and blocking for production use

- product ownership and overlap with the existing internal site-selection plan;
- the first production user and precise decision point;
- approved opportunity outcome, observation window, and maturity rule;
- availability of comparable historical features and outcomes;
- approved source systems, fields, refresh paths, and aggregation levels;
- approved geography definitions and market-to-location assignments;
- scoring criteria, directions, thresholds, weights, and missing-data rules;
- persistence, audit, access, retention, and sharing requirements;
- authority to approve relationships, segmentation, and completion states;
- licensed broker data, verification, retention, and outreach rights; and
- ownership of model, prompt, tool-contract, monitoring, and incident response.

## 5. The proposed pivot

### 5.1 Working product definition

The **Market Opportunity Platform** is a human-reviewed decision-support system that assembles governed evidence, compares markets and opportunity theses, identifies gaps and sensitivities, and prepares the next diligence step.

It should answer five questions clearly:

1. **What opportunity are we evaluating?** The concept, objective, target customer, operating model, and decision horizon.
2. **What is the comparison universe?** The governed set of markets and geographic units eligible for review.
3. **What does the evidence say?** Validated demand, supply, competitive, operational, financial, real-estate, and qualitative observations with provenance.
4. **How robust is the result?** Missingness, quality, recency, sensitivity, conflicts, and assumptions.
5. **What happens next?** Advance to deeper diligence, hold for evidence, reject under a named rule, or hand off to a vertical-specific workflow.

### 5.2 Why a new project is appropriate

A new project creates a clean domain boundary. The current repository is clinic-first in naming, data contracts, navigation, and fixtures. A broader platform needs opportunity definitions and market evidence to be primary objects, while clinic location evaluation becomes one vertical implementation.

The new project should reuse proven ideas and selected code, but it should not rename the current application and carry every clinic-specific assumption forward. Starting clean makes it easier to:

- define a general opportunity model;
- keep vertical-specific criteria in modules;
- separate platform services from one business workflow;
- establish new ownership and success measures;
- avoid treating synthetic clinic logic as a production default; and
- preserve the original repository as an auditable reference implementation.

### 5.3 Provisional users and decisions

The following are hypotheses to validate, not confirmed ownership claims:

- **Strategy or expansion analyst:** identifies markets worth deeper review for a defined concept.
- **Real-estate or development analyst:** connects an approved market thesis to submarket and property diligence.
- **Business or finance reviewer:** evaluates assumptions, constraints, scenario tradeoffs, and expected outcomes.
- **Data steward:** approves sources, definitions, sensitivity, allowed use, and refresh rules.
- **Decision owner:** records the final advance, hold, reject, or sequence decision outside the score.

The first MVP should select one of these users and one decision. It should not attempt to satisfy all roles at once.

## 6. Proposed platform workflow

### Step 1: Define the opportunity thesis

Capture the concept, decision, decision owner, target customer or demand, geography level, time horizon, required outcomes, exclusions, and evidence policy. No ranking should start before this definition is approved.

### Step 2: Establish the comparison universe

Select a versioned market universe and geography. Record membership rules, vintage, exclusions, and join keys. Do not infer geography from names when stable identifiers are absent.

### Step 3: Assemble and validate evidence

Use approved adapters or governed uploads. Preserve raw observations and produce a validated analytical projection. Record source, date, unit, grain, method, quality, sensitivity, allowed use, and scoring eligibility.

### Step 4: Apply deterministic screening

Evaluate hard constraints separately from preferences. A failed or missing constraint should remain explicit and should not be hidden inside an average score.

### Step 5: Compare opportunities

Apply an approved versioned configuration. Show raw values, transformations, normalized values, contributions, overall result, exclusions, warnings, and sensitivity. Support unscored evidence alongside the calculation.

### Step 6: Deep dive selected markets

Move from market to submarket only after an analyst confirms the segmentation method and the data is appropriate at that grain. Attach research leads and diligence questions without pretending that a proposed boundary is authoritative.

### Step 7: Handoff to a vertical workflow

For clinics, the handoff may begin candidate-property evidence assembly. Another vertical could have a different next step. The platform should pass a versioned opportunity packet, not force every vertical into the same site-scoring flow.

### Step 8: Record the human decision and later outcome

Store the decision, rationale, approver, timestamp, and referenced evidence separately from system results. When an outcome becomes observable, attach it under an approved definition and maturity window so the process can be evaluated without leakage.

## 7. Proposed core domain model

| Object | Purpose | Minimum controls |
| --- | --- | --- |
| `OpportunityDefinition` | Defines the concept, decision, user, outcome, horizon, and exclusions | Owner, approval state, version, effective date |
| `MarketUniverse` | Defines which geographic units may be compared | Source, vintage, membership rule, stable IDs, exclusions |
| `GeographyUnit` | Represents a market, submarket, trade area, or other approved unit | Type, method, source, version, geometry allowed use |
| `EvidenceObservation` | Stores one observed or derived fact | Raw value, unit, date, grain, source, method, quality, sensitivity, allowed use |
| `MetricDefinition` | Defines business meaning and analytical treatment | Direction, valid range, aggregation, freshness, owner, scoring eligibility |
| `ScreeningPolicy` | Applies mandatory rules before comparison | Version, thresholds, missing-data behavior, approver |
| `ScoringPolicy` | Applies optional weighted preferences | Version, weights, normalization, exclusions, sensitivity rules, approver |
| `OpportunityAssessment` | Preserves a deterministic result | Input and policy versions, contributions, warnings, coverage, fingerprint |
| `Scenario` | Compares a bounded set or sequence without changing the baseline | Selection order, assumptions, constraints, non-persistent or durable state |
| `EvidencePacket` | Prepares a source-linked review artifact | Included and excluded evidence, restrictions, gaps, review status |
| `DecisionRecord` | Captures the human decision | Decision, owner, rationale, timestamp, referenced assessment |
| `OutcomeObservation` | Measures later results under an approved rule | Outcome definition, maturity, cohort, source, observation window |

The evidence model should remain general. Vertical modules may add fields and rules, but they should not weaken platform-level provenance, allowed-use, missingness, and decision-separation requirements.

## 8. What to reuse, refactor, and leave behind

### Reuse directly or with minimal adaptation

- evidence labels and presentation rules;
- source registry and claim ledger pattern;
- `null` and evidence-state handling;
- versioned public geography build pattern;
- deterministic scoring and sensitivity primitives;
- configuration fingerprints and structured result contracts;
- stable map selection and comparison behavior;
- source-linked brief and comparison presentation models;
- bounded AI tool selection with application-enforced policy;
- evaluation cases for reproducibility, restricted-field exclusion, and fail-closed behavior; and
- human decision boundary language.

### Refactor into platform capabilities

- rename clinic-specific `CandidateSite` concepts into general opportunity and geography objects;
- separate platform market comparison from vertical property comparison;
- make opportunity thesis and allowed-use policy first-class inputs;
- move metric catalogs and scoring policies into vertical or use-case packages;
- replace process-local stores only after audit and access requirements are approved;
- generalize evidence packets so each vertical can define sections without changing provenance controls; and
- make outcome observation a formal contract for later evaluation.

### Keep as reference, not platform default

- synthetic market metrics, directions, weights, ranks, and fingerprints;
- Seattle's seven illustrative submarkets and geodesic rings;
- fictional broker profiles;
- clinic-specific staffing, trade-area, physical-site, and opening assumptions;
- supplied Esri field names and relationships that lack approved definitions;
- current workflow category fixtures;
- session-only save behavior; and
- any unverified integration or source-access assumption.

## 9. Recommended MVP for the new project

### Product wedge

Build a transparent market opportunity comparison for one approved opportunity thesis. Let an analyst review a governed market universe, inspect evidence coverage, compare a small set of markets under an approved policy, and produce a source-linked opportunity brief for human review.

### In scope

- one named user and one decision;
- one versioned market universe;
- five to eight approved metrics across a small number of dimensions;
- separate hard constraints and preferences;
- validated source adapters or governed file uploads;
- evidence coverage, missingness, freshness, and provenance;
- deterministic comparison of two to five markets;
- sensitivity to bounded policy changes;
- unscored qualitative and contextual evidence;
- a draft opportunity brief;
- a human review and decision record; and
- one vertical handoff, with clinic location evaluation as the reference candidate.

### Explicit non-goals for the first release

- automatic selection of markets or sites;
- a universal ranking for every Chewy initiative;
- learned prediction without approved historical outcomes and leakage-safe validation;
- automatic scraping of commercial listings;
- authoritative submarket generation by AI;
- lease, capital, staffing, or opening approval;
- unrestricted data exploration across sensitive sources;
- hidden score changes or model-generated weights; and
- replacement of local expertise, broker diligence, or physical inspection.

### Exit criteria before implementation

- the first user, decision, and decision owner are named;
- the opportunity thesis and intended outcome are defined;
- the market universe and geography are approved;
- each initial metric has a definition, source, owner, unit, grain, date, and allowed use;
- screening and scoring policies are approved or explicitly synthetic;
- persistence and audit requirements are decided;
- the vertical handoff is defined; and
- the evaluation plan has an owner and a non-AI baseline.

## 10. Measurement plan

The platform should not claim business impact before a baseline exists. Initial measurement should focus on workflow quality and decision transparency.

### Workflow measures

- time from opportunity definition to reviewable evidence packet;
- analyst time spent locating, reconciling, and reformatting evidence;
- percentage of required evidence with valid source, date, unit, grain, and owner;
- number and age of unresolved evidence gaps;
- rate of assessments reproduced from the same input and configuration;
- number of manual corrections after review; and
- time from initial comparison to an advance, hold, or reject decision.

### Decision-support measures

- reviewer agreement that the result is understandable and traceable;
- frequency with which sensitivity changes the interpretation;
- frequency of advancement blocked by missing or conflicting evidence;
- agreement between structured output and the final recorded rationale; and
- later, only after an approved outcome and maturity rule exist, retrospective calibration against observed results.

### Guardrails

- no unsupported factual or numeric claims in generated briefs;
- no restricted fields in UI, print, prompts, logs, or checked-in fixtures;
- no public-context field entering scoring without an approved policy change;
- no silent imputation, inferred join, or hidden weight redistribution;
- no model-generated final decision; and
- every calculation and artifact traceable to versions and sources.

Targets should be set only after observing the current workflow and confirming what can be measured.

## 11. Governance and AI boundaries for the new platform

The new project should inherit these rules on day one:

- Public availability does not automatically authorize production use.
- Every source needs an owner, purpose, allowed use, sensitivity, and refresh rule.
- Raw restricted data should stay outside Git and outside model prompts.
- Qualitative evidence remains unscored unless an approved rubric exists.
- Screening, preference scoring, prediction, and human approval remain separate outputs.
- AI receives only the evidence and actions allowed for the current workflow state.
- Application code validates AI actions and numeric statements.
- AI cannot change weights, invent missing data, create authoritative geography, or choose a final opportunity.
- Approval receipts do not rewrite source evidence.
- Durable state requires explicit access, retention, audit, and deletion rules.

## 12. Suggested new-project structure

```text
market-opportunity-platform/
  PROJECT_CONTEXT.md
  README.md
  docs/
    product/
      opportunity-definition.md
      mvp-scope.md
      user-workflows.md
      open-questions.md
      non-goals.md
    research/
      source-registry.md
      claim-ledger.md
      decision-process.md
    technical/
      architecture.md
      data-contracts.md
      ai-boundaries.md
      security-and-governance.md
    evaluation/
      evaluation-plan.md
      success-metrics.md
      cases.md
    decisions/
  packages/
    evidence/
    geography/
    scoring/
    comparison/
    ai-policy/
  verticals/
    clinic-location/
  data/
    public/
    synthetic/
    schemas/
  app/
  tests/
```

This is a conceptual structure, not a mandate to create a monorepo. The important boundary is between general platform contracts and vertical-specific rules.

## 13. New-project startup checklist

1. Name the first opportunity decision in one sentence.
2. Identify the primary user, reviewer, data steward, and decision owner.
3. Confirm whether the existing `Vet Clinic Site Selection` effort is a dependency, overlap, or separate vertical.
4. Define the outcome, observation window, maturity rule, and exclusions.
5. Choose the market universe and stable geography identifiers.
6. Create the source registry and claim ledger before importing data.
7. Inventory candidate sources by grain, vintage, missingness, join coverage, sensitivity, and allowed use.
8. Select the smallest approved metric set and separate constraints from preferences.
9. Define the non-AI baseline and evaluation cases.
10. Decide whether results are session-only or durable and document audit rules.
11. Build deterministic evidence and comparison outputs before adding AI.
12. Add AI only for explanation, gap identification, and draft packet preparation.
13. Define the vertical handoff and the evidence contract it receives.
14. Run a retrospective or shadow workflow before any production recommendation language is permitted.

## 14. Decisions required from the new project sponsor

The new project should not start implementation until there is a reviewed answer to these questions:

1. What market opportunity decision is the first release helping someone make?
2. Who makes that decision today and who owns the supporting workflow?
3. What would the analyst do differently after seeing the platform output?
4. What result would demonstrate value without claiming causality?
5. Which evidence is approved for context, screening, scoring, and prediction?
6. Which geography is authoritative at each stage?
7. What is the minimum viable vertical handoff?
8. What must be stored, for how long, and who may see or change it?
9. Which existing tools or teams already own parts of the workflow?
10. What would cause the project to stop or narrow its scope?

## 15. Copy-ready project charter

### Problem

Market opportunity decisions require evidence from multiple sources, grains, and owners. Today, evidence can be difficult to reconcile, assumptions can be hidden inside analysis, and the connection between market prioritization and the next diligence step can be unclear.

### Vision

Create a transparent market opportunity platform that helps analysts define an opportunity, compare governed market evidence, understand uncertainty and sensitivity, and prepare the next human-reviewed decision.

### First principle

The platform prepares evidence and comparisons. It does not make the final investment, market-entry, site, lease, or operating decision.

### Initial product wedge

For one approved opportunity thesis, enable an analyst to compare two to five markets using validated evidence and an approved deterministic policy, then generate a source-linked opportunity brief and handoff packet.

### Foundation to reuse

Reuse the existing evaluator's evidence labels, source registry, claim ledger, validation approach, deterministic scoring primitives, sensitivity analysis, map and comparison patterns, bounded AI policy, and evaluation cases. Treat clinic location evaluation as the first vertical module.

### Key unknowns

Ownership, first user and decision, outcome definition, approved data, geography, scoring policy, persistence, audit requirements, and vertical handoff must be resolved before production implementation.

## Appendix A. Context to carry into the new project

### Required repository documents

- `PROJECT_CONTEXT.md`
- `docs/product/mvp-scope.md`
- `docs/product/requirements.md`
- `docs/product/user-workflows.md`
- `docs/product/open-questions.md`
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `docs/technical/architecture.md`
- `docs/technical/market-attractiveness-scoring.md`
- `docs/research/source-registry.md`
- `docs/research/claim-ledger.md`
- `docs/evaluation/evaluation-plan.md`
- `docs/evaluation/success-metrics.md`
- `docs/decisions/ADR-001` through `ADR-017`

### High-value implementation areas

- `lib/data/` for versioned public market context;
- `lib/market-attractiveness/` for deterministic market comparison;
- `lib/scoring.ts` and `lib/scoring-sandbox/` for transparent scoring primitives;
- `lib/evidence/` for evidence presentation and restrictions;
- `lib/agent/` for bounded candidate-review orchestration;
- `lib/seattle-market-deep-dive/` for a human-gated submarket workflow pattern;
- `components/PublicMarketContext.tsx` and `components/UnifiedEvaluatorMap.tsx` for market navigation;
- `components/market-comparison/` for ordered market comparison;
- `components/esri-candidate-brief/` for deterministic evidence packets; and
- `tests/` for reusable governance and regression cases.

### Source IDs to retain as historical context

- `SRC-001`: existing internal Vet Clinic Site Selection plan and overlap risk;
- `SRC-002`: CVC reporting directory and potential outcome sources;
- `SRC-003`: reported site-selection inputs, Esri use, and human judgment;
- `SRC-007`: qualitative local-market research themes;
- `SRC-013`: Census Geocoder behavior and limitations;
- `SRC-014`: July 2023 CBSA universe;
- `SRC-015`: 2024 CBSA display geometry;
- `SRC-016`: 2024 ACS 5-year aggregate context; and
- `SRC-017`: minimized internal Esri demo snapshot with unresolved governance.

The original source registry remains the source of truth for links, dates, reliability, and allowed use.

## Appendix B. Evidence language

- **Confirmed:** explicitly supported by a current primary source.
- **Reported:** explicitly stated in an interview, meeting note, or supplied file but not validated with the accountable owner or system.
- **Derived:** calculated or reasoned from confirmed or reported evidence using a visible method.
- **Hypothesis:** plausible and testable, but not supported as a current fact.
- **Unknown:** requires access, owner confirmation, definition, or measurement.

Every material conclusion in the new platform should carry one of these states or a more specific data-quality state.

## Appendix C. Immediate next action

Before creating application code, hold one focused project-definition session. The output should be a one-page approved `OpportunityDefinition` containing:

- the first decision;
- the primary user and decision owner;
- the opportunity concept and time horizon;
- the market universe and geography;
- the outcome and maturity rule;
- the initial evidence inventory and allowed-use categories;
- the non-AI baseline;
- the vertical handoff; and
- the stop conditions.

Once that page is approved, create the new repository and port only the general evidence, geography, scoring, comparison, and AI-policy foundations needed for that first slice.
