# Collaboration model: flexible decision agent + trusted data engine

**Demo goal:** By Wednesday, August 19, 2026, a stakeholder can ask a broad marketing or clinic question and receive one of three honest outcomes:

1. a clarified, measurable question and a grounded action packet;
2. a useful answer with visible assumptions and limitations; or
3. a precise request for the evidence or human decision still needed.

The goal is **not** to prebuild one workflow per question. The LLM supplies breadth by planning an analysis dynamically. The engineered system supplies trust by controlling what data and calculations the LLM can use.

## The product in one flow

| Stage | What the user sees | What the LLM decides | What the system must guarantee |
| --- | --- | --- | --- |
| 1. Understand | “Here is the decision I think you are making.” | Intent, outcome, entity, geography, period, ambiguities | Material assumptions are visible and editable |
| 2. Find evidence | “Here is the ideal evidence and what is currently available.” | Relevant measures, sources, and acceptable substitutes | Meaning, grain, freshness, quality, provenance, and permitted use are known |
| 3. Plan analysis | “Here is how I will compare the locations.” | Baseline, controls, exclusions, and analysis method | The plan is validated before any calculation runs |
| 4. Calculate | Ranked locations and question-specific map views | Which approved tools to call | SQL/code performs reproducible calculations; the LLM does not invent numbers |
| 5. Interpret | Findings, confidence, constraints, and alternatives | What the evidence suggests and what remains uncertain | Fact, inference, and recommendation remain distinguishable |
| 6. Act | Stakeholder action packet | Bounded next step and follow-up questions | Owner, KPI, guardrails, approvals, limitations, and evidence receipts are included |

The system should answer unfamiliar questions when the available evidence supports them. It should not force every question through a prewritten marketing or clinic template.

## Ownership: two independently engineered products

| Workstream | Human owner | Complete responsibility | Does not own |
| --- | --- | --- | --- |
| **Decision agent and experience** | **You** | Question clarification, agent prompts and orchestration, evidence-plan experience, maps, progress, location detail, action packet, human-input workflow, browser tests | Source SQL, raw-data cleanup, geographic crosswalk implementation, numeric engine correctness |
| **Evidence and computation platform** | **Partner** | Snapshot ingestion, source adapters, semantic catalog, normalized records, identity/geography, quality and freshness checks, deterministic calculation tools, reference results, technical tests | Product wording, page behavior, agent conversation, recommendation presentation |
| **Business meaning** | **Both** | Interviews, decision definition, KPI meaning, fair comparison, usable action, golden questions, review of final results | Neither person decides these alone |

This is a better split than “you do marketing, partner does clinics.” Both domains use the same agent and data engine, so dividing by domain would duplicate work and create incompatible behavior.

## How both people work simultaneously

The shared contracts are frozen first. After that, neither person waits for the other.

| You work against | Partner works against | Integration behavior |
| --- | --- | --- |
| Contract-valid fixture catalog and results | Real snapshot packages using the same contracts | Real packages replace fixtures without UI changes |
| Simulated available, stale, missing, and restricted sources | Actual source metadata and quality states | Actual states replace simulations |
| Handwritten example analysis plans | Plan validator and deterministic calculation tools | Agent-generated plans call the validated tools |
| Mock ranked locations and action packets | Hand-checked reference calculations | Integrated output must reconcile to reference results |

Both people can use coding agents. Each human owns review and merge responsibility for their workstream. Agents receive a specific output, file boundary, and test—not a general instruction to “work on the platform.”

## The four shared contracts

These are the only integration boundary. Keep them small, versioned, and readable as JSON.

### 1. `QuestionIntent`

What decision the user is trying to make.

```text
decision, stakeholder, entity, geography, period,
outcome, denominator, action, constraints,
assumptions[], ambiguities[], confirmation_status
```

### 2. `EvidenceCatalog`

What the agent is allowed to know about each available dataset or uploaded file.

```text
source, metric, business_definition, entity, grain,
geography, period, freshness, quality, join_keys,
allowed_use, availability, caveats, substitute_for[]
```

### 3. `EvaluationRequest`

The LLM's proposed analysis plan, before execution.

```text
question_intent, required_evidence[], selected_evidence[],
outcome, baseline, controls[], exclusions[], method,
geography, requested_outputs[], unresolved_blockers[]
```

### 4. `EvaluationResult`

The numeric engine's reproducible response.

```text
request_id, ranked_entities[], raw_values, baseline_values,
adjusted_differences, reason_codes[], confidence_inputs,
quality_warnings[], evidence_receipts[], calculation_version
```

The LLM may propose an `EvaluationRequest`; it may not manufacture an `EvaluationResult`.

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

## Human decisions the LLM must not invent

Interviews are done together. The two of you must record these decisions in a short use-case brief for marketing and clinics:

| Required human answer | Concrete output |
| --- | --- |
| What decision is being made? | “Choose DMAs for a bounded paid-search test,” not “find opportunity” |
| What action can the stakeholder take? | A specific allowed action and approval owner |
| What outcome defines success? | Metric, denominator, observation period, and decision horizon |
| What is a fair comparison? | Baseline, eligible peers, controls, exclusions, and minimum sample |
| What geography is actionable? | DMA, clinic trade area, ZIP, CBSA, or another explicit unit |
| What must the product never decide? | Final budget, campaign launch, clinic closure, staffing change, etc. |
| What proves or stops the action? | KPI, guardrail, duration, success threshold, stop/revise rule |

If an answer is missing, the agent can propose a default, but it must label it as an assumption and ask for confirmation before presenting a ranking as decision-ready.

## Workboards

### You — decision agent and experience

| Build | Concrete implementation | Done when |
| --- | --- | --- |
| Question interpreter | Prompt + structured `QuestionIntent` output + edit/confirm UI | “Which clinics need help?” becomes a specific, editable decision question |
| Evidence planner | Compare ideal evidence to `EvidenceCatalog` | User sees available, missing, stale, incompatible, and substitute evidence with reasons |
| Agent planner | Produce an `EvaluationRequest` from the confirmed intent and catalog | Every plan names outcome, baseline, controls, geography, sources, method, and blockers |
| Human-input loop | Allow evidence or guidance at the question, plan, and analysis steps | User can add a document/file or correct an assumption without restarting |
| Results experience | Render returned rankings, maps, comparisons, progress, and location detail | Views are generated from the question and result—not fixed demo cards |
| Action packet | Turn `EvaluationResult` into a traceable stakeholder handoff | Packet includes finding, comparison, drivers, action, owner, KPI, constraints, confidence, and asks |
| Product tests | Golden questions plus missing-data and unsupported-question flows | Marketing and clinic paths are repeatable from a clean start |

**Primary folders:** `components/evaluation-workspace/**`, evaluation APIs, agent orchestration, action-packet presentation, browser tests.

### Partner — evidence and computation platform

| Build | Concrete implementation | Done when |
| --- | --- | --- |
| Source packages | Load daily Snowflake/Tableau/Google Ads/Conductor exports and uploaded files | Every package has version, source, extraction time, period, owner, rows, and allowed use |
| Semantic catalog | Map source fields to stable business metrics and definitions | The agent can discover data without reading raw schemas or guessing meaning |
| Quality service | Validate units, duplicates, missingness, freshness, coverage, and grain | Bad evidence receives an explicit state and cannot silently enter analysis |
| Geography and identity | Stable entity IDs plus explicit crosswalks and coverage | No UI or LLM performs fuzzy geographic joins |
| Plan validator | Accept or reject an `EvaluationRequest` with actionable reasons | Unsupported methods, joins, controls, or sources fail before execution |
| Calculation tools | Approved descriptive, comparison, normalization, ranking, and sensitivity operators | Same request and package version produce the same result |
| Reference tests | Hand-check at least three markets and three clinics | Engine output matches expected calculations within agreed tolerance |

**Primary folders:** source adapters, extraction/normalization scripts, demo snapshots, catalog, geography, analysis engine, data-quality and engine tests.

## Suggested repository separation

Use logical module boundaries this week; do not spend the demo week creating microservices.

```text
lib/decision-agent/        # You: intent, evidence planning, prompts, orchestration
lib/contracts/             # Jointly approved; one designated editor
lib/evidence-platform/     # Partner: catalog, packages, quality, geography
lib/analysis-engine/       # Partner: validation and deterministic operators
components/evaluation-workspace/  # You: product experience
data/demo-snapshots/       # Partner: versioned offline data packages
```

Existing code can remain where it is until after the demo. Apply these as ownership rules now; move folders only when it reduces an active merge conflict.

## Five concrete integration tests

| Checkpoint | Literal test | Pass condition | Owner if it fails |
| --- | --- | --- | --- |
| **1. Better question** | Enter “Where should we spend more?” and “Which clinics need help?” | Each returns a specific editable question, visible assumptions, and Continue | You: agent/UI; both: unclear business meaning |
| **2. Evidence match** | Confirm the question against a mixed catalog | Ideal and available evidence are separate; missing/stale/incompatible sources have reasons | You: selection display; partner: catalog state |
| **3. Valid plan** | Submit the proposed `EvaluationRequest` | Validator accepts it or returns exact fixable blockers; no hidden fallback | You: malformed plan; partner: validator behavior |
| **4. Reconciled result** | Run one marketing and one clinic request | Rankings and differences match the hand-checked samples | Partner: engine/source parity; you: result rendering |
| **5. Action packet** | Click a ranked location | Every number is traceable; action, owner, KPI, guardrails, confidence, limits, and human asks appear | You: interpretation/UI; both: action meaning |

## One-week parallel schedule

No work is planned for Saturday or Sunday.

| Date | You + your agents | Partner + partner's agents | Shared checkpoint |
| --- | --- | --- | --- |
| **Tue Aug 11** | Freeze agent flow and fixture versions | Inventory data and calculation capabilities | Approve contracts and one marketing/clinic use-case brief |
| **Wed Aug 12** | Working question interpreter and confirm UI | Catalog/package skeleton and example records | Checkpoint 1; freeze contract v0.1 |
| **Thu Aug 13** | Evidence planner, upload/correction loop, plan generator | Snapshot v0.1, quality states, geography, plan validator | Checkpoints 2 and 3 |
| **Fri Aug 14** | Results/map UI against fixture results | Minimum operators and hand-checked reference results | Checkpoint 4 for both domains |
| **Mon Aug 17** | Location detail and action packet | Candidate data bundle and reconciled results | Checkpoint 5 for both domains |
| **Tue Aug 18** | Unsupported/missing/stale flows and polish | Preflight, recovery steps, frozen bundle | Full rehearsal; feature freeze at noon |
| **Wed Aug 19** | Smoke test and demonstrate | Support provenance and calculation questions | No new features |

## Realistic demo promise

By Wednesday, the product can accept **any marketing or clinic question**, understand it, and respond intelligently. That does not mean every question receives a computed ranking.

| If the question is… | Product response |
| --- | --- |
| Clear and supported by compatible evidence | Execute, rank, map, and create an action packet |
| Ambiguous | Rewrite it, expose assumptions, and request confirmation |
| Partially supported | Answer the supported portion and disclose what is missing |
| Missing evidence | Recommend the exact data needed and allow upload/request |
| Using stale or incompatible evidence | Show the issue and use only an approved substitute |
| Asking for causation from descriptive data | Explain the limit and propose a bounded test |
| Asking the system to make a final business decision | Provide evidence and a recommendation for human approval |

This is genuine breadth without pretending that connected data automatically makes every conclusion trustworthy.

## Merge and change rules

| Rule | Practical meaning |
| --- | --- |
| One owner per module | The other person requests a contract change instead of editing across the boundary |
| One designated contract editor | Both approve meaning; one person makes the schema edit to avoid collisions |
| Data-only partner commits | Do not merge the entire migration branch into the product branch |
| Fixtures are first-class | Product work continues when a source export is late |
| Contract tests gate integration | A package or request is merged only when the consumer test passes |
| Reconcile before explaining | If a number differs from the reference, stop interpretation until it is resolved |
| No silent fallback | Missing sources, substituted metrics, and changed methods are visible to the user |

## Copyable agent briefs

### Brief for your coding agent

```text
You own the decision-agent and user-experience workstream. Read this collaboration
model and the four shared contracts before editing. Do not edit source adapters,
raw snapshots, geographic crosswalks, or analysis-engine calculations.

For the assigned feature:
1. state the exact user input and observable output;
2. name the shared contract fields consumed or produced;
3. implement only within the assigned files;
4. use contract-valid fixtures when real data is unavailable;
5. show assumptions, evidence state, and limitations rather than inventing them;
6. add a test that proves the observable behavior;
7. report changed files, test results, and any contract change requested.
```

### Brief for partner's coding agent

```text
You own the evidence and computation workstream. Read this collaboration model
and the four shared contracts before editing. Do not edit the evaluation UI,
agent conversation, product wording, or action-packet presentation.

For the assigned source or calculation:
1. name the source, business definition, grain, geography, period, and allowed use;
2. emit only contract-valid catalog, package, or result records;
3. make missingness, freshness, incompatibility, and unresolved mappings explicit;
4. keep calculations deterministic and versioned;
5. add quality tests and a small hand-checkable reference result;
6. report changed files, test results, caveats, and any contract change requested.
```

## Definition of done

The collaboration succeeds when either person's implementation can be replaced independently:

- the decision product works against fixtures or the real evidence platform;
- the evidence platform can validate and execute requests without the UI;
- the four contracts are the only integration boundary;
- one marketing and one clinic path reconcile end to end;
- unfamiliar questions receive a useful answer, clarification, or evidence request;
- every numeric claim is traceable;
- limitations and human decisions are explicit; and
- neither contributor needs to edit the other's owned modules during integration.
