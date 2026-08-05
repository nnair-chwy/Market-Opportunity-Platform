# Implementation prompt 3: Candidate evidence brief and comparison

You are working in:

`/Users/nnair/Documents/Retail and Clinic Location Evaluator`

Implement an analyst-facing, non-scored candidate evidence brief and side-by-side comparison using the portfolio readiness and market/trade-area capabilities created by implementation prompts 1 and 2.

This is the third capability in the sequence. It must reuse the shared fixture package, site identities, crosswalks, field catalog, source metadata, readiness states, trade-area observations, validation rules, and existing evidence components.

Do not commit changes. Preserve all unrelated work in the repository.

## Fixed product decisions

- Modify the current repository and deliver a complete working implementation.
- The intended user is a clinic real-estate or site-selection analyst.
- Use the supplied Esri-derived records where safe and interpretable.
- Use synthetic fallback evidence when required prerequisites are missing.
- Keep supplied and synthetic evidence visibly distinct.
- The brief is evidence organization and comparison, not scoring.
- Do not rank candidates, declare a winner, recommend a lease, or recommend opening a clinic.
- Do not connect this capability to the existing scoring sandbox.
- Do not convert qualitative evidence into a number.
- Implement contracts, deterministic brief generation, UI, print behavior, tests, documentation, decision-log updates, and visual verification.

## Sequential prerequisites

Before editing, verify that prompts 1 and 2 have produced:

- a valid Esri-derived fixture manifest;
- safe site identities;
- portfolio readiness records;
- a field catalog;
- a reviewed or explicitly synthetic site-to-trade-area crosswalk;
- non-scored trade-area observations;
- source and quality metadata;
- synthetic fallback records;
- navigation between readiness, market, and location views.

If either prior capability is missing or incompatible:

1. Document the gap.
2. Do not create a third evidence model.
3. Repair or complete the shared prerequisite using the earlier prompt contracts.
4. Use a clearly isolated synthetic fallback only when the real path remains blocked.

## Mandatory reading before editing

Read completely:

1. `AGENTS.md`
2. all mandatory project files listed in `AGENTS.md`;
3. `docs/product/user-workflows.md`;
4. `docs/product/requirements.md`;
5. `docs/evaluation/evaluation-plan.md`;
6. `docs/evaluation/success-metrics.md`;
7. `docs/technical/architecture.md`;
8. `docs/technical/security-and-governance.md`;
9. `docs/research/selection-criteria.md`;
10. `docs/research/site-selection-process.md`;
11. `docs/research/source-registry.md`;
12. the ADRs and contracts created by prompts 1 and 2;
13. the existing evidence components, location workspace, Ask AI boundary, fixtures, scoring sandbox, and tests.

The existing scoring sandbox is out of scope for this capability. Inspect it only to avoid accidental coupling or duplicated concepts.

Reuse the existing evidence, navigation, fixture, and print-capable browser patterns. If implementation requires a new dependency or a material architecture change, present the proposed change and pause for explicit user approval before proceeding.

## Prerequisite audit

Before implementation, determine and record:

1. Which three to five sites are safe for the demo.
2. Whether their names and coordinates are supplied, public, de-identified, or synthetic.
3. Which sites have an approved or synthetic parent-market relationship.
4. Which sites have an approved, provisional, or synthetic trade-area relationship.
5. Which physical-site fields are safe and sufficiently defined.
6. Which lease, landlord, employee, or account fields must remain excluded.
7. Which clinic-landscape observations are physical locations versus source account rows.
8. Which trade-area metrics are comparable across candidates.
9. Which observations have unknown dates, units, geography methods, or definitions.
10. Which sections must use synthetic fallback evidence.
11. Whether any qualitative notes are approved for inclusion.
12. Whether the brief can be printed without exposing restricted values.

Do not infer that a missing field is unfavorable. Do not infer that a present field is favorable.

## Candidate evidence model

Create or extend a structured, non-scored candidate-evidence contract.

At minimum, preserve:

- brief ID and version;
- site ID and safe display label;
- parent market assignment and evidence status;
- trade-area relationship and role;
- source snapshot versions;
- generated-at timestamp;
- supplied, derived, and synthetic evidence sections;
- field-level provenance;
- observation dates or explicit unknown state;
- units or explicit unknown state;
- geographic grain and method;
- quality status;
- sensitivity;
- allowed use;
- missing information;
- conflicting information;
- restrictions;
- analyst follow-up questions;
- human review state;
- scoring eligibility fixed to `none`.

The deterministic brief must not contain:

- total score;
- normalized contribution;
- attractiveness band;
- rank;
- predicted performance;
- causal claim;
- recommended site;
- investment recommendation;
- lease recommendation.

## Evidence sections

Organize each brief into the following analyst-facing sections.

### 1. Identity and workflow

- site label;
- brand or entity type when approved;
- current, potential, evaluated, comparison, or unknown source state;
- parent market;
- trade-area relationship;
- source snapshot;
- data readiness state;
- visible limitations.

Do not treat workflow status as attractiveness.

### 2. Market and trade-area context

Reuse prompt 2 observations:

- population;
- households;
- pet households;
- income context;
- Chewy demand context when approved;
- veterinary supply context;
- risk or labor context only when definitions are known;
- missingness and quality warnings.

### 3. Clinic landscape

Use the supplied clinic layer only through a safe, deterministic adapter.

Requirements:

- preserve source clinic rows;
- distinguish source account count from physical-location count;
- apply an explicit lifecycle filter;
- document corporate versus independent classification;
- do not automatically delete repeated coordinates;
- do not expose phone, account owner, contact preferences, prescriptions, or other excluded operational fields;
- do not calculate distance or trade-area inclusion through hidden AI reasoning;
- if a geospatial calculation is added, it must be deterministic, versioned, unit-tested, documented, and based on an approved geography method;
- otherwise use synthetic clinic-landscape summaries.

### 4. Physical-site evidence

Evaluate safe fields from the master-site export:

- site square feet;
- usable square feet;
- design room count;
- center name and type;
- site position;
- site frontage;
- parking type and dedicated spaces;
- main-street visibility;
- ingress and egress;
- green space and location;
- traffic volume;
- co-tenants;
- multi-story indicator;
- closest competitor and stated distance only when definitions and units are known.

Do not display a field without its definition, unit, source, quality state, and sensitivity. Use synthetic fallback evidence where necessary.

### 5. Constraints and diligence

- missing required evidence;
- unresolved identity or crosswalk issues;
- unknown units or dates;
- restricted evidence;
- stale or rejected observations;
- physical diligence still requiring human inspection;
- functional constraints that remain unknown;
- named expected source or owner.

Do not turn an unknown constraint into a pass or fail.

### 6. Analyst follow-up questions

Generate deterministic follow-up questions from missing and conflicting evidence.

Questions must:

- be open ended;
- focus on the analyst's information need;
- identify the expected source or owner when known;
- avoid implying a preferred site;
- avoid proposing a lease or opening decision;
- be derived from visible structured evidence.

An optional AI draft may rephrase approved deterministic questions only if it follows `docs/technical/ai-boundaries.md`. The deterministic template must remain the baseline and must work without AI.

## Side-by-side comparison

Implement comparison for two to five candidates.

The comparison must:

- use the same section and field order for every candidate;
- show raw values, units, dates, sources, quality, and missingness;
- distinguish non-comparable dates or geography methods;
- display unknown and restricted values clearly;
- show readiness state without treating it as site quality;
- let the analyst open source details;
- let the analyst move between the comparison and each full brief;
- avoid composite values;
- avoid rank ordering;
- avoid winner language;
- avoid favorable or unfavorable colors unless directionality has been explicitly approved for that individual field;
- keep qualitative evidence non-scored.

Default ordering must be stable and neutral, such as site label or analyst selection order.

## Deterministic brief generation

Build a pure, testable transformation from validated evidence to the brief model.

It must:

- preserve source IDs and versions;
- include only approved or explicitly synthetic inputs;
- preserve nulls and restrictions;
- expose conflicts and warnings;
- generate consistent section ordering;
- generate follow-up questions from rules;
- produce identical output for identical input;
- not call an AI model;
- not calculate a score;
- not infer causation;
- not silently omit rejected evidence.

If an AI explanation or Ask AI integration is included, it must receive only the structured brief, approved source metadata, visible warnings, and allowed comparison language. It must be visibly labeled as a draft for human review.

## UI requirements

Integrate with the existing Locations workspace and evidence system.

Provide:

- `Evidence brief` entry point for a selected demo site;
- brief header with data version, generated date, evidence status, and non-scored label;
- six evidence sections;
- source-detail actions;
- visible restricted, unknown, synthetic, and missing states;
- a `Compare candidates` flow for two to five sites;
- persistent selected-candidate state during comparison;
- navigation back to market context and portfolio readiness;
- print-friendly layout;
- browser print action or equivalent without adding a new PDF dependency;
- accessible headings, tables, lists, controls, and focus behavior;
- clear empty and malformed-data states.

Do not place the evidence brief inside the scoring sandbox. Do not show existing synthetic scores next to the brief in a way that implies these Esri fields contributed to them.

## Print and sharing behavior

The print view must:

- include the brief version and generated timestamp;
- include source IDs and evidence labels;
- include missing and conflicting evidence;
- include the non-scored and human-review disclaimer;
- exclude hidden restricted details;
- avoid truncating long site names, warnings, or follow-up questions;
- remain readable in portrait or a deliberately chosen landscape format;
- not claim to be an approved investment or lease document.

Do not create a downloadable file containing sensitive evidence unless repository governance explicitly allows it.

## Demo behavior

The completed demo must let an analyst:

1. Open the Locations workspace.
2. Select three demo candidates.
3. Open a source-linked evidence brief for one candidate.
4. Review market, trade-area, clinic-landscape, physical-site, and diligence evidence.
5. See supplied and synthetic evidence separately.
6. See unknown, restricted, missing, stale, and conflicting states.
7. Compare the three candidates side by side using raw evidence.
8. Open the source and quality details supporting a difference.
9. See deterministic follow-up questions.
10. Print the brief without exposing restricted values.
11. Navigate back to portfolio readiness or market context.
12. Confirm that no candidate is scored, ranked, or recommended.

## Documentation and decision records

Update:

- `docs/technical/data-contracts.md`;
- `docs/technical/architecture.md`;
- `docs/technical/ai-boundaries.md` only if an AI draft integration is added;
- `docs/product/user-workflows.md`;
- `docs/product/requirements.md`;
- `docs/evaluation/evaluation-plan.md`;
- `docs/evaluation/success-metrics.md`;
- `docs/research/source-registry.md`;
- `docs/research/claim-ledger.md` only for directly supported bounded claims;
- `docs/product/open-questions.md`;
- `data/README.md`;
- a new ADR if the deterministic brief, print behavior, or non-scored comparison changes architecture or product scope materially.

Define demo success in measurable workflow terms, such as:

- time to identify missing evidence;
- percentage of displayed facts with visible provenance;
- analyst ability to distinguish missing from unfavorable;
- number of unresolved crosswalk or definition issues surfaced;
- successful completion of a standardized comparison.

Do not claim improved site outcomes, reduced cost, reduced site visits, faster openings, or financial impact without a measured baseline.

## Tests

Add focused tests for:

- deterministic brief generation;
- stable section and candidate ordering;
- source and version preservation;
- supplied versus synthetic labels;
- missing, rejected, stale, restricted, unknown, and conflicting evidence;
- physical-site field inclusion and prohibited-field exclusion;
- source-account versus physical-clinic distinction;
- deterministic follow-up questions;
- no score, rank, recommendation, causal language, or winner language;
- candidate selection limits;
- comparison comparability warnings;
- source-detail navigation;
- print redaction and disclaimers;
- malformed fixture handling;
- accessibility and keyboard behavior;
- regression protection for existing market, location, evidence, Ask AI, map, and scoring-sandbox behavior.

Run:

- focused tests;
- `pnpm lint`;
- the full repository test command;
- `pnpm build`.

## Visual verification

Inspect at desktop, narrow, and print-preview sizes.

Verify:

- all six sections are easy to scan;
- side-by-side comparison remains readable;
- long values and follow-up questions wrap correctly;
- source, date, unit, evidence, quality, and synthetic labels are visible;
- restricted values remain redacted;
- missing values are not presented as zero;
- no color or layout implies a winner;
- print output includes disclaimers and provenance;
- no restricted data appears in page source, logs, screenshots, or external requests;
- existing navigation and workflows remain intact.

## Completion criteria

Complete only when:

- the evidence brief uses the shared prompt 1 and prompt 2 foundation;
- two to five candidates can be compared;
- every factual value is source-linked or explicitly synthetic;
- missing, conflicting, unknown, stale, rejected, and restricted evidence remain visible;
- the brief is deterministic and works without AI;
- print output is safe and readable;
- no score, rank, recommendation, or hidden qualitative scoring exists;
- tests, lint, build, and visual verification pass;
- documentation and any required ADR are updated;
- no unrelated changes are modified or committed.

## Final response

Report:

- what was implemented;
- exact contract, adapter, fixture, UI, test, and documentation locations;
- which candidates and evidence sections are supplied versus synthetic;
- which sensitive fields were excluded;
- unresolved prerequisites and owner questions;
- tests, lint, build, and visual verification results;
- confirmation that the brief is non-scored and deterministic;
- confirmation that no commit was created.
