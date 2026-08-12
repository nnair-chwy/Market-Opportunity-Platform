# Collaboration model: geographic AI analyst + trusted evidence engine

**Demo goal:** By Wednesday, August 19, 2026, a stakeholder can ask a broad geographic business question—including exploratory, diagnostic, decision, or test-design questions—and receive one of three honest outcomes:

1. a clarified, measurable question and a grounded action packet;
2. a useful answer with visible assumptions and limitations; or
3. a precise request for the evidence or human decision still needed.

The goal is **not** to prebuild one workflow per department or question. The product should behave like a strong geographic data scientist: understand business context, investigate how places differ, find potentially useful patterns, challenge those patterns, and turn supported findings into market-specific hypotheses or bounded actions. The LLM supplies breadth by planning investigations dynamically. The engineered system supplies trust by controlling data meaning, geographic compatibility, calculations, statistical safeguards, and evidence receipts.

## The product in one flow

| Stage | What the user sees | What the LLM decides | What the system must guarantee |
| --- | --- | --- | --- |
| 1. Understand | “Here is the investigation or decision I think you want.” | Analysis intent, outcome, entity, geography, period, ambiguities | Exploration is not silently converted into a ranking or decision |
| 2. Find evidence | “Here is the ideal evidence and what is currently available.” | Relevant measures, sources, and acceptable substitutes | Meaning, grain, freshness, quality, provenance, and permitted use are known |
| 3. Plan analysis | “Here is how I will investigate or compare the locations.” | Baseline, peers, controls, exclusions, hypotheses, and analysis method | The plan is validated before any calculation runs |
| 4. Calculate | Patterns, comparisons, ranked locations, or question-specific map views | Which approved tools to call | SQL/code performs reproducible calculations; the LLM does not invent numbers or correlations |
| 5. Interpret | Findings, confidence, constraints, and alternatives | What the evidence suggests and what remains uncertain | Fact, inference, and recommendation remain distinguishable |
| 6. Act | Stakeholder action packet | Bounded next step and follow-up questions | Owner, KPI, guardrails, approvals, limitations, and evidence receipts are included |

The system should answer unfamiliar questions when the available evidence supports them. It should not force every question through a prewritten Marketing, CVC, or Pricing template. Pricing is the first discovery-oriented proof; comparable treatment/control geographies are a reusable capability rather than the whole product.

## Ownership: two independently engineered products

| Workstream | Human owner | Complete responsibility | Does not own |
| --- | --- | --- | --- |
| **Decision agent and experience** | **Sheila** | Question clarification, agent prompts and orchestration, evidence-plan experience, maps, progress, location detail, action packet, human-input workflow, browser tests | Source SQL, raw-data cleanup, geographic crosswalk implementation, numeric engine correctness |
| **Evidence and computation platform** | **Nik** | Snapshot ingestion, source adapters, semantic catalog, normalized records, identity/geography, quality and freshness checks, deterministic calculation tools, reference results, technical tests | Product wording, page behavior, agent conversation, recommendation presentation |
| **Business meaning** | **Both** | Interviews, decision definition, KPI meaning, fair comparison, usable action, golden questions, review of final results | Neither person decides these alone |

This is a better split than “Sheila does marketing, Nik does clinics.” Both domains use the same agent and data engine, so dividing by domain would duplicate work and create incompatible behavior.

## How both people work simultaneously

The shared contracts are frozen first. After that, neither person waits for the other.

| Sheila works against | Nik works against | Integration behavior |
| --- | --- | --- |
| Contract-valid fixture catalog and results | Real snapshot packages using the same contracts | Real packages replace fixtures without UI changes |
| Simulated available, stale, missing, and restricted sources | Actual source metadata and quality states | Actual states replace simulations |
| Handwritten example analysis plans | Plan validator and deterministic calculation tools | Agent-generated plans call the validated tools |
| Mock ranked locations and action packets | Hand-checked reference calculations | Integrated output must reconcile to reference results |

Both people can use coding agents. Each human owns review and merge responsibility for their workstream. Agents receive a specific output, file boundary, and test—not a general instruction to “work on the platform.”

## The four shared contracts

These are the only data boundary between the workstreams. The executable Zod/JSON schema—not prose in this document—is authoritative. Before cross-workstream integration, every payload must include `schema_version`; every persisted run must record all consumed schema and snapshot versions. A breaking change requires a new version and paired producer/consumer fixtures.

| Contract | Purpose | Mechanical editor | Current implementation |
| --- | --- | --- | --- |
| `QuestionIntent` | Human-editable interpretation of the requested investigation or decision | Sheila | `lib/decision-agent/question-intent.ts` |
| `EvidenceCatalog` | Governed description of evidence the agent may select | Nik | Evidence/catalog modules; contract fixture must be exported before integration |
| `EvaluationDefinition` | Validated analysis plan produced from confirmed intent and catalog | Sheila authors request; Nik owns validation semantics | `lib/evaluation/contracts.ts` |
| `EvaluationRun` | Reproducible engine response, artifacts, warnings, gates, and action packet | Nik | `lib/evaluation/contracts.ts` |

The earlier names `EvaluationRequest` and `EvaluationResult` refer conceptually to `EvaluationDefinition` and `EvaluationRun`. Agents must use the implemented names and schemas. Neither person may maintain a parallel private version.

The field lists below define the required v0.2 handshake. They are not runtime fields until merged into the executable schema with fixtures and producer/consumer tests. Current v0.1 gaps are explicit: `QuestionIntent` lacks `schema_version` and `analysis_intent`; `EvidenceCatalog` lacks an exported integration schema; `EvaluationDefinition` lacks several discovery fields; and `EvaluationRun` is currently a TypeScript type rather than a fully parsed response schema.

### 1. `QuestionIntent`

What investigation or decision the user is trying to perform.

```text
schema_version, analysis_intent,
decision, stakeholder, entity, geography, period,
outcome, denominator, action, constraints,
assumptions[], ambiguities[], ideal_evidence[],
evaluation_metrics[], comparison_rules[], proposed_weights[],
research_plan[], confirmation_status
```

`analysis_intent` is one of `exploration`, `diagnosis`, `decision_support`, `test_design`, or `causal_evaluation`.

The planning fields make the confirmed intent actionable for the evidence planner. They are human-editable proposals, not claims that a source is available or a metric is approved. Proposed weights apply only to multi-criteria preference screening, must total 100%, and remain separate from eligibility rules and guardrails.

### 2. `EvidenceCatalog`

What the agent is allowed to know about each dataset, snapshot, model output, or uploaded file.

```text
schema_version, source_id, snapshot_version, owner,
metric_id, business_definition, numerator, denominator,
unit, aggregation, direction, entity, geography_contract,
period, extraction_time, freshness, quality, sampling_method,
missingness, uncertainty, join_keys, allowed_use, availability,
evidence_status, caveats[], substitute_for[]
```

The catalog describes evidence; it does not contain an analyst's recommendation. Source access alone does not mean the metric is approved for every use.

### 3. `EvaluationDefinition`

The agent's proposed analysis plan after confirmation, before execution.

```text
schema_version, evaluation_id, question_intent,
required_evidence[], selected_evidence[], required_fields[],
outcome, eligibility_rules[], baseline, cohort_rules[], controls[],
exclusions[], metrics[], hypotheses[], method, operator_plan[],
geography_contract, temporal_scope, validation_rules[],
requested_outputs[], decision_boundary, permitted_actions[],
required_human_gates[], unresolved_blockers[]
```

Nik's validator either accepts the exact definition or returns structured, fixable errors. It never silently changes a method, source, metric, geography, weight, threshold, or missing-data policy.

### 4. `EvaluationRun`

The numeric engine's reproducible response.

```text
schema_version, run_id, evaluation_id, definition_version,
status, steps[], artifacts[], entity_results[], raw_values,
baseline_values, adjusted_differences, reason_codes[],
confidence_inputs, statistical_checks[], quality_warnings[],
evidence_receipts[], source_snapshot_versions[],
calculation_version, reproducibility_key, blockers[], action_packet
```

Every numeric field displayed by Sheila must resolve to an entity result or artifact plus an evidence receipt. The LLM may propose an `EvaluationDefinition`; it may not manufacture or modify an `EvaluationRun`.

## Exact boundary between flexible AI and engineered rules

| Flexible LLM responsibility | Engineered responsibility |
| --- | --- |
| Rewrite a vague question into a measurable decision | Validate required fields and expose assumptions for confirmation |
| Search the evidence catalog and choose relevant sources | Reject incompatible grain, geography, freshness, or use |
| Propose a baseline, controls, exclusions, and method | Permit only supported operators and execute them deterministically |
| Switch to a documented substitute | Verify that the substitute relationship is explicitly allowed |
| Explain patterns and propose a bounded action | Attach every numeric claim to a result and evidence receipt |
| Ask the human for the highest-value missing input | Never silently fill a missing business definition or value |

Question rewriting does **not** require the final data package. The agent first produces the best decision formulation from user intent and business knowledge, then refines or limits it after checking available evidence.

## Required semantic handshakes

### Geography contract

No component may join or compare places using display names. Every geographic payload must state:

```text
canonical_geography_id, display_name, grain,
boundary_version, crosswalk_version, effective_period,
allocation_method, coverage_percent, unmatched_count,
excluded_geographies[], parent_geographies[]
```

Nik owns canonical IDs, crosswalks, allocation logic, coverage, and unmatched records. Sheila renders those fields and asks for correction when the intended decision geography differs; the UI and LLM never perform fuzzy geographic joins. Many-to-many conversions such as ZIP-to-DMA or ZIP-to-CBSA must disclose the allocation method and resulting coverage.

### Metric contract

Every selectable or displayed metric must state its business definition, numerator, denominator, unit, aggregation rule, interpretation direction, observation period, sampling method, missing-value policy, uncertainty, source/snapshot, evidence status, and allowed use. Sheila may improve the label for readability but may not alter the definition. Nik may improve calculation mechanics but may not redefine the business meaning without joint approval.

### Evidence receipt

An evidence receipt identifies the exact source, snapshot, fields, filters, geography/crosswalk versions, period, operator/calculation version, and quality state behind a numeric claim. Result-level source IDs alone are insufficient. The same receipt must support the map, rank, detail popup, explanation, and exported action packet.

## Discovery and statistical safeguards

Exploration is a first-class path, not an excuse to scan unlimited variables and narrate coincidences. For pattern or correlation discovery, the `EvaluationDefinition` must specify candidate measures or a governed search space, and the `EvaluationRun` must report:

- number of relationships examined and any multiple-comparison correction;
- eligible sample, minimum sample rule, missingness, and geographic coverage;
- effect size and uncertainty—not significance alone;
- temporal stability and sensitivity to alternate periods, peers, and exclusions;
- spatial dependence or clustering considerations when relevant;
- known confounders, contrary evidence, and plausible alternative explanations;
- whether the result is `descriptive`, `correlational`, `quasi_experimental`, or `causal`; and
- the validation or test required before a business action.

The agent chooses what is worth investigating and explains why it may matter. Approved deterministic tools compute the relationships and safeguards. Correlation can create a hypothesis or bounded test recommendation; it cannot authorize a causal claim or business action.

## Runtime handoff protocol

The workstreams integrate through contract-valid function/API calls and fixtures, not by importing each other's internal helpers.

| Boundary | Sheila owns | Nik owns |
| --- | --- | --- |
| Intent → definition | Orchestration, user edits, request construction | Validation rules exposed through the contract |
| Definition → run | Calling the validator/executor, displaying progress and structured errors | Deterministic validation, execution, status, and result payload |
| Run → experience | Rendering artifacts without recalculation; interpretation and human gates | Complete artifacts, receipts, warnings, blockers, and reproducibility data |
| Uploaded evidence | Intake experience and visible user consent | Parsing, quarantine, quality checks, catalog registration, and permitted use |

All calls must define `accepted`, `needs_revision`, `needs_evidence`, `blocked`, and `executed` outcomes; structured error codes; idempotency/reproducibility keys; timeout and partial-result behavior; and whether a human revision creates a new definition/run version. Sheila never parses engine log strings to infer state. Nik never emits UI copy as the only representation of a failure.

The integration adapter is owned by Sheila on the caller/UI side and Nik on the validator/executor side. If either side needs a new field, it follows the contract-change procedure below rather than editing the other side's module.

## Human decisions the LLM must not invent

Interviews are done together. Sheila and Nik must record these decisions in a short use-case brief for each accepted Pricing, Marketing, or CVC path:

| Required human answer | Concrete output |
| --- | --- |
| What decision is being made? | “Choose DMAs for a bounded paid-search test,” not “find opportunity” |
| Is this exploration or a decision? | Explicit analysis intent and the strongest conclusion the evidence may support |
| What action can the stakeholder take? | A specific allowed action and approval owner |
| What outcome defines success? | Metric, denominator, observation period, and decision horizon |
| What is a fair comparison? | Baseline, eligible peers, controls, exclusions, and minimum sample |
| What geography is actionable? | DMA, clinic trade area, ZIP, CBSA, or another explicit unit |
| What must the product never decide? | Final budget, campaign launch, clinic closure, staffing change, etc. |
| What proves or stops the action? | KPI, guardrail, duration, success threshold, stop/revise rule |
| What makes a discovered pattern credible? | Search space, minimum sample, stability, uncertainty, confounders, contrary evidence, and validation path |

If an answer is missing, the agent can propose a default, but it must label it as an assumption and ask for confirmation before presenting a ranking as decision-ready.

## Workboards

### Sheila — decision agent and experience

| Build | Concrete implementation | Done when |
| --- | --- | --- |
| Question interpreter | Prompt + structured `QuestionIntent` output + edit/confirm UI | “Which clinics need help?” becomes a specific, editable decision question |
| Analysis-intent routing | Distinguish exploration, diagnosis, decision support, test design, and causal evaluation | An exploratory question remains an investigation and does not silently become a ranking |
| Evidence planner | Compare ideal evidence to `EvidenceCatalog` | User sees available, missing, stale, incompatible, and substitute evidence with reasons |
| Agent planner | Produce an `EvaluationDefinition` from the confirmed intent and catalog | Every plan names outcome, baseline, controls, geography, sources, method, and blockers |
| Human-input loop | Allow evidence or guidance at the question, plan, and analysis steps | User can add a document/file or correct an assumption without restarting |
| Results experience | Render returned rankings, maps, comparisons, progress, and location detail | Views are generated from the question and result—not fixed demo cards |
| Discovery experience | Render patterns, peer comparisons, effect sizes, uncertainty, contrary evidence, and validation asks | A user can understand why a pattern is interesting and why it may still be non-causal |
| Action packet | Turn `EvaluationRun` into a traceable stakeholder handoff | Packet includes finding, comparison, drivers, action, owner, KPI, constraints, confidence, and asks |
| Product tests | Golden questions plus missing-data and unsupported-question flows | Pricing discovery and decision/test paths are repeatable from a clean start |

**Primary folders:** `components/evaluation-workspace/**`, evaluation APIs, agent orchestration, action-packet presentation, browser tests.

### Nik — evidence and computation platform

| Build | Concrete implementation | Done when |
| --- | --- | --- |
| Source packages | Load daily Snowflake/Tableau/Google Ads/Conductor exports and uploaded files | Every package has version, source, extraction time, period, owner, rows, and allowed use |
| Semantic catalog | Map source fields to stable business metrics and definitions | The agent can discover data without reading raw schemas or guessing meaning |
| Quality service | Validate units, duplicates, missingness, freshness, coverage, and grain | Bad evidence receives an explicit state and cannot silently enter analysis |
| Geography and identity | Stable entity IDs plus explicit crosswalks and coverage | No UI or LLM performs fuzzy geographic joins |
| Plan validator | Accept or reject an `EvaluationDefinition` with actionable reasons | Unsupported methods, joins, controls, or sources fail before execution |
| Calculation tools | Approved descriptive, comparison, normalization, ranking, correlation, matching, and sensitivity operators | Same request and package version produce the same result |
| Statistical safeguards | Minimum sample, uncertainty, multiple-testing, stability, spatial, confounder, and sensitivity checks | Discovery output cannot bypass the safeguards required by its declared analysis intent |
| Reference tests | Hand-check at least three markets and three clinics | Engine output matches expected calculations within agreed tolerance |

**Primary folders:** source adapters, extraction/normalization scripts, demo snapshots, catalog, geography, analysis engine, data-quality and engine tests.

## Suggested repository separation

Use logical module boundaries this week; do not spend the demo week creating microservices.

```text
lib/decision-agent/                    # Sheila: intent, evidence planning, prompts, orchestration
components/evaluation-workspace/       # Sheila: product experience
app/api/question-intents/              # Sheila: intent API boundary
lib/evaluation/contracts.ts            # Shared contract; field owner follows the contract table
lib/evaluation/engine.ts               # Nik: validation and deterministic execution
lib/evaluation/operators.ts            # Nik: approved calculations
lib/evaluation/catalog.ts              # Nik: semantic evidence catalog
lib/data/** and data/demo-snapshots/**  # Nik: packages, quality, geography, fixtures
tests/question-intent*                  # Sheila: producer/UI contract tests
tests/data/** and engine tests          # Nik: evidence/engine contract tests
```

Existing code can remain where it is until after the demo. Apply these as ownership rules now; move folders only when it reduces an active merge conflict.

## Concrete integration tests

| Checkpoint | Literal test | Pass condition | Owner if it fails |
| --- | --- | --- | --- |
| **1. Better question** | Enter “Where should we spend more?” and “Which clinics need help?” | Each returns a specific editable question, visible assumptions, and Continue | Sheila: agent/UI; both: unclear business meaning |
| **2. Evidence match** | Confirm the question against a mixed catalog | Ideal and available evidence are separate; missing/stale/incompatible sources have reasons | Sheila: selection display; Nik: catalog state |
| **3. Valid plan** | Submit the proposed `EvaluationDefinition` | Validator accepts it or returns exact fixable blockers; no hidden fallback | Sheila: malformed plan; Nik: validator behavior |
| **4. Reconciled result** | Run one Pricing discovery and one decision/test definition | Patterns, rankings, and differences match the hand-checked samples | Nik: engine/source parity; Sheila: result rendering |
| **5. Action packet** | Click a ranked location | Every number is traceable; action, owner, KPI, guardrails, confidence, limits, and human asks appear | Sheila: interpretation/UI; both: action meaning |
| **6. Discovery integrity** | Ask “What regional pricing patterns are worth investigating?” | Output reports the governed search space, effect size, uncertainty, stability, contrary evidence, and a non-causal validation ask | Sheila: framing/rendering; Nik: calculations/safeguards |
| **7. Geography mismatch** | Submit ZIP evidence for a DMA request without an approved crosswalk | Validator returns a structured, visible blocker; neither side performs a silent join | Nik: crosswalk/validator; Sheila: error handling |
| **8. Fixture replacement** | Run the same definition against fixture and real packages with identical semantics | UI requires no code change; expected differences are attributable to snapshot versions | Both at the contract boundary |

## One-week parallel schedule

No work is planned for Saturday or Sunday.

| Date | Sheila + Sheila's agents | Nik + Nik's agents | Shared checkpoint |
| --- | --- | --- | --- |
| **Tue Aug 11** | Freeze agent flow and fixture versions | Inventory data and calculation capabilities | Approve contracts, a Pricing discovery brief, and one decision/test brief |
| **Wed Aug 12** | Working question interpreter and confirm UI | Catalog/package skeleton and example records | Checkpoint 1; freeze contract v0.1 |
| **Thu Aug 13** | Evidence planner, upload/correction loop, plan generator | Snapshot v0.1, quality states, geography, plan validator | Checkpoints 2 and 3 |
| **Fri Aug 14** | Results/map UI against fixture results | Minimum operators and hand-checked reference results | Checkpoint 4 for both domains |
| **Mon Aug 17** | Location detail and action packet | Candidate data bundle and reconciled results | Checkpoint 5 for both domains |
| **Tue Aug 18** | Unsupported/missing/stale flows and polish | Preflight, recovery steps, frozen bundle | Full rehearsal; feature freeze at noon |
| **Wed Aug 19** | Smoke test and demonstrate | Support provenance and calculation questions | No new features |

## Realistic demo promise

By Wednesday, the product can accept **any geographic Pricing, Marketing, or CVC question**, understand its analysis intent, and respond intelligently. That does not mean every question receives a computed pattern, correlation, or ranking.

| If the question is… | Product response |
| --- | --- |
| Clear and supported by compatible evidence | Execute, rank, map, and create an action packet |
| Ambiguous | Rewrite it, expose assumptions, and request confirmation |
| Partially supported | Answer the supported portion and disclose what is missing |
| Missing evidence | Recommend the exact data needed and allow upload/request |
| Using stale or incompatible evidence | Show the issue and use only an approved substitute |
| Asking for causation from descriptive data | Explain the limit and propose a bounded test |
| Asking the system to make a final business decision | Provide evidence and a recommendation for human approval |

## Contract package and change procedure

Every shared-contract version is delivered as a small package containing:

- executable schema and version;
- one minimum valid example and one realistic full example;
- invalid examples for missing geography, incompatible grain, stale evidence, and unsupported method;
- producer and consumer contract tests;
- a versioned fixture plus expected hand-checked result;
- change log, compatibility statement, and effective date; and
- named reviewer from each workstream.

Contract changes follow this sequence:

1. The requesting person opens a short proposal containing the user need, exact field/schema change, example payload, compatibility effect, and affected tests.
2. Sheila approves agent/user meaning; Nik approves evidence/calculation meaning.
3. The mechanical editor named in the contract table changes the schema and fixtures. The other person does not make a competing schema edit.
4. Producer and consumer tests pass on the same fixture before either side depends on the change.
5. Breaking changes increment the schema version. Old versions remain readable until the paired migration or removal date is agreed.

No field is considered available because it appears only in this document, a prompt, a UI type, or an unmerged branch.

This is genuine breadth without pretending that connected data automatically makes every conclusion trustworthy.

## Merge and change rules

| Rule | Practical meaning |
| --- | --- |
| One owner per module | The other person requests a contract change instead of editing across the boundary |
| One mechanical editor per contract | Both approve meaning; the editor listed in the contract table makes the schema and fixture edit |
| Data-only Nik commits | Do not merge the entire migration branch into the product branch |
| Fixtures are first-class | Product work continues when a source export is late |
| Contract tests gate integration | A package or request is merged only when the consumer test passes |
| Reconcile before explaining | If a number differs from the reference, stop interpretation until it is resolved |
| No silent fallback | Missing sources, substituted metrics, and changed methods are visible to the user |
| No cross-boundary hotfix | A consumer does not patch producer internals; it files a contract change with a failing fixture/test |
| Rebase before handoff | The person publishing integrates the latest shared branch and reruns contract tests before asking the other side to consume it |

## Copyable agent briefs

### Brief for Sheila's coding agent

```text
You support Sheila's decision-agent and user-experience workstream. Read this collaboration
model and the executable versions of the four shared contracts before editing. Do not edit source adapters,
raw snapshots, geographic crosswalks, or analysis-engine calculations.

For the assigned feature:
1. state the exact user input and observable output;
2. name the shared contract fields consumed or produced;
3. implement only within the assigned files;
4. use contract-valid fixtures when real data is unavailable;
5. show assumptions, evidence state, and limitations rather than inventing them;
6. add a test that proves the observable behavior;
7. render engine values without recomputing, joining, or redefining them;
8. report changed files, test results, fixture/schema versions, and any contract change requested.
```

### Brief for Nik's coding agent

```text
You support Nik's evidence and computation workstream. Read this collaboration model
and the executable versions of the four shared contracts before editing. Do not edit the evaluation UI,
agent conversation, product wording, or action-packet presentation.

For the assigned source or calculation:
1. name the source, business definition, grain, geography, period, and allowed use;
2. emit only contract-valid catalog, package, or result records;
3. make missingness, freshness, incompatibility, and unresolved mappings explicit;
4. keep calculations deterministic and versioned;
5. apply the safeguards required by the declared analysis intent;
6. add quality tests and a small hand-checkable reference result;
7. report changed files, test results, fixture/schema versions, caveats, and any contract change requested.
```

## Definition of done

The collaboration succeeds when either person's implementation can be replaced independently:

- the decision product works against fixtures or the real evidence platform;
- the evidence platform can validate and execute requests without the UI;
- the four contracts are the only integration boundary;
- one Pricing discovery path and one decision/test path reconcile end to end;
- unfamiliar questions receive a useful answer, clarification, or evidence request;
- every numeric claim is traceable;
- geographic conversions and metric semantics are explicit;
- exploratory relationships carry statistical safeguards and causal boundaries;
- limitations and human decisions are explicit; and
- neither contributor needs to edit the other's owned modules during integration.
