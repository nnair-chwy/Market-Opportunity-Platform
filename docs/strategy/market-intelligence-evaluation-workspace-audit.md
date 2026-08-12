# Market Intelligence Evaluation Workspace Audit

**Branch:** `Market_Intell_Platform`  
**Date:** August 10, 2026  
**Status:** Completed before the first framing change

## Audit basis

This audit uses:

- the repository instructions in `AGENTS.md`;
- `PROJECT_CONTEXT.md`;
- `docs/product/mvp-scope.md`;
- `docs/technical/data-contracts.md`;
- `docs/technical/ai-boundaries.md`;
- `docs/research/claim-ledger.md`;
- `docs/product/open-questions.md`;
- `docs/strategy/market-opportunity-platform-transition-brief.md`; and
- the internal Confluence page, **Market Intelligence Evaluation Workspace — Product Source of Truth**, page `5414978880`.

## Executive finding

The repository already demonstrates much of the reusable operating model. It has not yet become a generic evaluation workspace because the active page still presents the product as a clinic location evaluator and the application state is organized around `Markets` and `Locations` rather than a question, contract, evidence run, and action packet.

The safest transition is an incremental generalization:

1. preserve the clinic workflow, synthetic fixtures, deterministic calculations, map, evidence contracts, and regression tests;
2. remove clinic wording from the shared product identity;
3. introduce a question-first framing and generic evaluation vocabulary;
4. move clinic-specific flows behind a supported evaluation type; and
5. add the shared contracts and second fixture before attempting production integrations.

## What is reusable now

### Product and UI foundation

- market-first navigation and national-to-local drill-down;
- synchronized map and list selection;
- selected-market detail and comparison behavior;
- candidate evidence briefs and human-review language;
- bounded Ask AI behavior grounded in application-supplied evidence;
- Seattle synthetic deep-dive as a regression fixture;
- scoring sandbox for deterministic configuration checks; and
- synthetic prototype labeling.

### Data and evidence foundation

- evidence statuses: `Confirmed`, `Reported`, `Derived`, `Hypothesis`, and `Unknown`;
- source IDs and provenance fields;
- public Census CBSA and ACS context with `market_context_only` boundaries;
- explicit missingness and rejected-record behavior;
- synthetic market-attractiveness results and versioned configuration;
- market-to-location assignment contracts; and
- restrictions against customer-level, clinical, lease, and other sensitive fields.

### Technical foundation

- TypeScript, React, Vinext, MapLibre, Zod, and server-side API routes;
- deterministic normalization, scoring, cohort, geography, and sensitivity utilities;
- schema and rendered tests for the existing workflows;
- process-local agent state with controlled failure behavior; and
- source-linked structured results that can become generic artifacts.

## Clinic-specific assumptions to move out of the shared core

- the global product name and home-page language;
- `WorkspaceMode` as only `markets | locations`;
- candidate-site scoring as the default evaluation;
- hard-coded clinic metrics in the main page state;
- the assumption that every question has a candidate site;
- location-specific tabs as the primary workspace model;
- clinic-opening language in shared headings and action labels; and
- the implicit assumption that every evaluation ends with a score.

These should be generalized, not deleted wholesale. The current clinic experience remains the first vertical and regression fixture.

## Capabilities to retain but isolate

The following are useful but should not define the product identity:

- `CandidateReviewAgent`;
- `CandidateEvidenceWorkspace`;
- `PortfolioReadinessPanel`;
- the scoring sandbox;
- Seattle market deep-dive orchestration;
- Esri trade-area and candidate-brief projections; and
- current clinic candidate fixtures.

They should be reachable through a supported evaluation type or fixture path after the question-first shell exists.

## Items not needed in the active product shift

The following untracked files are presentation-generation residue, not application source, contracts, fixtures, or required regression assets:

- `.codex-ppt-checkpoint/`;
- `.codex-script-fit/`;
- `CVC_Clinic_Market_and_Location_Discovery_Chewy_Brand_Checkpoint.pptx`;
- `CVC_Clinic_Market_and_Location_Discovery_Chewy_Brand_Checkpoint.pptx.inspect.ndjson`;
- `CVC_Clinic_Market_and_Location_Discovery_Chewy_Brand_Checkpoint/`;
- `Market_Opportunity_Evaluator_Revised_Presentation_Script.txt`; and
- `Presentation Slides.pptx`.

They were not used by the application and should not be included in the new branch. They are intentionally left untouched during this audit because untracked files are shared across branches and deleting them here could remove presentation material needed by the clinic-demo branch.

Tracked presentation artifacts and the existing clinic demo remain historical project assets. They are not part of the application runtime and should not be pulled into the new product core.

## Source-of-truth alignment

The Confluence source of truth requires:

- one adaptable workspace rather than separate hard-coded applications;
- question-first intake;
- map-first geographic results;
- national-to-local continuity;
- AI proposing while application code validates;
- deterministic, visible comparison;
- evidence before confidence;
- human-controlled material decisions and actions; and
- reusable verified evaluations and decision blueprints.

The current repository already supports the evidence, map, deterministic calculation, and human-boundary portions. The immediate gap is the shared product shell and contracts that connect them.

## Recommended implementation boundary

### Do now

- update product identity and UI language;
- retain the clinic route as a clearly labeled vertical fixture;
- document the generic workflow and source-of-truth alignment;
- define `QuestionSpec`, `DecisionGraph`, `EvaluationContract`, `Capability`, `EvidenceRecord`, `ArtifactSpec`, and `ActionPacket`; and
- add one local-growth synthetic fixture only after the shared contract exists.

### Defer

- graph databases;
- vector databases;
- broad Snowflake, Tableau, Esri, SEO, audience, and campaign integrations;
- durable evaluation history;
- production scoring policy;
- automatic activation or business actions; and
- deletion of clinic fixtures or deterministic regression coverage.

## Blocking questions carried forward

- Who owns the first production decision and receiving team?
- Which narrow read-only internal geographic view or approved historical fixture is first?
- What geography hierarchy and crosswalks are approved?
- Which metrics, formulas, weights, thresholds, and missing-data rules are approved?
- What minimum evidence supports a recommendation or action packet?
- What storage, retention, correction, and approval history is required?

## Audit conclusion

The branch should become a generic Market Intelligence Evaluation Workspace while keeping the clinic evaluator intact as the first vertical. The transition should remove obsolete identity and presentation residue, not remove the evidence contracts, deterministic engine, map, fixtures, or tests that make the existing demo credible.
