# CVC Clinic Market and Location Discovery

## Presentation Q&A prep

### 1. What problem is this actually solving?

It connects the decisions that happen between national market discovery, sub-area analysis, property availability, feasibility, Finance review, and portfolio sequencing. Today, those questions can be answered in different tools, but the evidence and rationale can fragment at the handoffs.

### 2. How is this different from Esri?

Esri remains the mapping and geospatial analysis system. This product does not try to recreate drive-time analysis, overlays, or customer calculations. It adds a scenario and decision layer across Esri, broker evidence, Finance assumptions, property feasibility, and execution constraints.

### 3. How is this different from the existing Excel model?

Excel can remain the source of approved rules and weights. This product adds hierarchy, evidence status, scenario history, constraints, cross-functional inputs, and an explainable portfolio sequence. It also separates market attractiveness from property feasibility and execution priority.

### 4. Is this just another dashboard?

No. A dashboard mainly displays current information. This platform models a decision funnel, compares named scenarios, preserves assumptions and evidence, applies deterministic constraints, and records why the sequence changed.

### 5. Why is the product called CVC Clinic Market and Location Discovery?

The name reflects the expanded scope. It starts with systematic market discovery, then moves into sub-areas and real locations. It is not limited to scoring a set of candidate addresses that someone has already chosen.

### 6. What is the most important product insight?

The most attractive opportunity is not always the next opportunity CVC should pursue. Property availability, buildout requirements, delivery timing, staffing readiness, capital, and dependencies can change the execution order.

### 7. Why keep attractiveness, feasibility, and execution priority separate?

They answer different questions. Attractiveness describes strategic fit. Feasibility describes whether a real property can work. Execution priority describes what should move first under current portfolio constraints. Combining them into one score would hide important tradeoffs.

### 8. How does this work at national scale?

The platform evaluates a complete, approved market universe on a schedule using versioned rules. It refreshes results when approved data changes and flags new opportunities, missing inputs, and stale evidence for review. An analyst does not need to initiate each market one at a time.

### 9. What data can support the first version?

Public sources can establish the market universe and basic context, including Census CBSA definitions and boundaries, ACS context, tract and block-group geography, and public provider or labor context. Synthetic or approved de-identified data can represent internal demand, properties, Finance scenarios, and execution readiness for the first validation.

### 10. What internal data is eventually needed?

Bounded and governed inputs for demand and access, available properties and economics, versioned Finance scenarios, staffing readiness, capital constraints, timing, dependencies, and the active site pipeline.

### 11. Where will property information come from?

From approved broker feeds, exports, or governed manual entry. The first pilot can use a bounded property set. Public commercial listing sites should not be scraped without explicit permission and licensing review.

### 12. Does this replace the detailed Finance forecast?

No. The existing Finance model remains the source of truth. The platform should consume bounded, versioned base, downside, and upside outputs with definitions and dates, then show how those scenarios affect the portfolio sequence.

### 13. Who controls the rules and weights?

The accountable business owners do. Rules, thresholds, and weights must be approved, versioned, and visible. The system calculates them deterministically and records which version produced each result.

### 14. Why use AI at all?

AI can make the structured outputs easier to review. It can explain why two scenarios differ, summarize evidence, identify missing or conflicting inputs, extract broker facts for confirmation, and draft a source-linked brief.

### 15. What prevents AI from hallucinating or making the decision?

AI is downstream of deterministic calculations. It cannot choose weights, invent missing data, calculate authoritative geography, create unsupported Finance forecasts, or approve a lease or opening. Its output must cite the structured evidence it is explaining.

### 16. What impact can we defend now?

We can measure national coverage, consistency of evaluation, scenario turnaround time, evidence gaps found before review, time required to explain a sequencing change, and reproducibility of the decision record. Financial impact should wait for an approved baseline and Finance methodology.

### 17. How will we know whether the product is working?

Run one bounded portfolio decision through the current process and the proposed workflow. Compare coverage, scenario speed, evidence readiness, explainability, handoff quality, and whether another reviewer can reproduce the result and rationale.

### 18. Is this a predictive model?

Not initially. The first version is transparent decision support based on approved evidence, scenarios, and constraints. Predictive claims would require mature outcome data, a validated target, and prospective testing.

### 19. What will you show in the current demo?

The current demo starts in the Markets workspace with public CBSA context and an explicitly synthetic attractiveness layer. It shows selection on the national map, comparison of two to five same-cohort markets, score details, missingness, sensitivity, and bounded Ask AI. It then shows the Seattle-only synthetic deep dive, which pauses for analyst confirmation before deterministic comparison. In Locations, it shows candidate briefs, a human-gated review agent, raw comparison without a winner, and an isolated scoring sandbox. It does not show a real national ranking, automated property availability, Finance scenarios, or an execution queue.

### 20. What would make us stop or narrow the idea?

We should stop or narrow it if CVC already has a trusted cross-stage scenario and decision trace, if the required inputs cannot be governed, if the workflow does not improve a real decision, or if the platform duplicates existing tools without reducing fragmentation.

### 21. What are the biggest risks?

The main risks are inaccessible or poorly defined inputs, unclear ownership of rules, confusing strategic attractiveness with execution readiness, and building a polished interface before validating the cross-functional workflow gap.

### 22. Which capabilities exist today, and which are future direction?

Today, the prototype can navigate public market context, display and decompose synthetic market scores, compare same-cohort markets, explain supplied structured results, prepare source-linked candidate briefs, pause a review workflow on ambiguous evidence, compare audited locations without a composite, test synthetic scoring configurations, and run one Seattle-only synthetic deep dive.

The proposed future platform would add scheduled nationwide screening using approved criteria, deeper analysis only for promising markets, an approved submarket method, governed property availability and feasibility screening, and a separate human-reviewed execution queue.

### 22. What is the immediate ask?

Select one real portfolio decision, one accountable primary user, and a bounded set of approved inputs. Use that pilot to validate whether the shared scenario and evidence trace creates enough value to pursue.

## Short answers to keep in your pocket

- **One-sentence pitch:** A transparent scenario layer that connects national market discovery to real-property feasibility and an explainable clinic-opening sequence.
- **Primary differentiation:** It connects the stages and preserves why the portfolio changed.
- **Key principle:** Attractiveness is not feasibility, and feasibility is not execution priority.
- **Role of AI:** Explain the evidence and tradeoffs, never create the decision.
- **Pilot goal:** Prove the workflow gap with one bounded portfolio decision.
- **Current demo boundary:** Synthetic scores and descriptive evidence demonstrate the workflow, not real opportunity rankings or an execution queue.
