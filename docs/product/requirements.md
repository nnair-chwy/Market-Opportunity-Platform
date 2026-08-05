# Requirements

## Functional requirements

| ID | Requirement | Evidence |
| --- | --- | --- |
| FR-001 | Import multiple candidate sites using the approved data contract. | CLM-020 |
| FR-002 | Reject or flag invalid, stale, missing, or unprovenanced inputs. | CLM-022, CLM-023 |
| FR-003 | Preserve raw metrics and calculate normalized metrics reproducibly. | CLM-001, CLM-020 |
| FR-004 | Apply a named, versioned weight configuration. | CLM-001 |
| FR-005 | Display each metric contribution and total score. | CLM-020 |
| FR-006 | Compare candidates without hiding missing data. | CLM-020 |
| FR-007 | Run bounded weight-sensitivity scenarios. | CLM-005 |
| FR-008 | Produce a structured, source-linked evaluation result. | CLM-020 |
| FR-009 | Generate an optional AI brief from the structured result. | CLM-017, CLM-020 |
| FR-010 | Record human review, decision, and rationale separately from system output. | CLM-017 |
| FR-011 | Display versioned public CBSA geometry without exposing customer-level or unapproved precise coordinates. | CLM-008, CLM-015, CLM-020, CLM-026 |
| FR-012 | Limit visible Locations navigation to Candidate briefs and Compare locations, while embedding readiness checks in the bounded review flow. | CLM-017, CLM-020, CLM-031 |
| FR-013 | Let a reviewer open source metadata and evidence status from the candidate evaluation. | CLM-020, CLM-022, CLM-023 |
| FR-014 | Let a reviewer query a candidate evaluation through an AI assistant constrained to structured results and source metadata. | CLM-017, CLM-020 |
| FR-015 | Let a reviewer enter an approved U.S. address, inspect a provider match, and confirm it as a session-only proposed location without treating the match as an evaluation. | CLM-024 |
| FR-016 | Keep a newly confirmed proposed location in `Needs data` and prevent deterministic evaluation until validated evidence is available. | CLM-020, CLM-022, CLM-024 |
| FR-017 | Present Markets and Locations as separate workspaces. Markets retain workflow filters and synchronized map/list selection; Locations exposes the candidate-brief and location-comparison workflow. | CLM-020, CLM-025, CLM-026, CLM-031 |
| FR-018 | Require a stable parent market and a Current or Evaluated market state before a candidate location may be evaluated. | CLM-020 |
| FR-019 | Keep market workflow state separate from public market context, location scoring, and human approval. | CLM-017, CLM-020, CLM-025, CLM-026, CLM-027 |
| FR-020 | Preserve invalid or unassigned market-location relationships visibly rather than silently inferring or repairing them. | CLM-020, CLM-022 |
| FR-021 | Apply deterministic portfolio-readiness checks inside the candidate-review workflow, with expected owners and source labels, rather than exposing readiness as a separate primary destination. | CLM-028, CLM-029 |
| FR-022 | Keep supplied, derived, and synthetic Esri evidence visibly distinct and prevent all Esri readiness outputs from entering scoring, ranking, recommendation, or lease decisions. | CLM-017, CLM-028, CLM-029 |
| FR-023 | Show linked Esri local trade-area evidence beside, but visually and contractually separate from, public CBSA context for the selected market. | CLM-026, CLM-029, CLM-030 |
| FR-024 | Allow an analyst to select site and trade-area variants, inspect metric provenance and missingness, and compare up to three raw profiles without a composite, winner, rank, or recommendation. | CLM-017, CLM-029, CLM-030 |
| FR-025 | Produce a deterministic, six-section candidate evidence brief from the shared Esri readiness, crosswalk, field-catalog, and trade-area contracts, with scoring eligibility fixed to none. | CLM-017, CLM-028, CLM-029, CLM-030, CLM-031 |
| FR-026 | Let an analyst compare two to five audited demo candidates in selection order using raw evidence, visible provenance, and comparability warnings without ranking or winner language. | CLM-017, CLM-029, CLM-030, CLM-031 |
| FR-027 | Let an analyst print the minimized evidence brief or comparison with provenance, missingness, conflicts, restrictions, and human-review disclaimers while excluded restricted values remain absent. | CLM-017, CLM-031 |
| FR-028 | Color market boundaries by existing synthetic attractiveness results through an exact CBSA-code crosswalk, with a shared accessible scale and a neutral Not scored state for unmatched records. | CLM-020, CLM-025, CLM-026 |
| FR-029 | Let an analyst ask AI about one selected market result, compare two to five same-cohort results, ask AI about only the selected structured evidence, and see a non-persistent Save comparison affordance without winner or recommendation language. | CLM-017, CLM-020 |

## Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-001 | The same inputs and configuration must reproduce the same numeric result. |
| NFR-002 | Every input must record source, observed date, and transformation version. |
| NFR-003 | No customer-level PII or medical information may appear in logs, prompts, fixtures, or Git. |
| NFR-004 | AI-generated text must be traceable to structured fields and visibly labeled as a draft. |
| NFR-005 | Access must follow least privilege and separate viewing from editing. |
| NFR-006 | The system must surface uncertainty and missingness rather than impute silently. |
| NFR-007 | Scoring changes require tests and a decision record. |
| NFR-008 | Esri fixture builds must reconcile source and output hashes, preserve null missingness, fail closed on invalid projections or identity conflicts, and replace outputs only after validation. |
| NFR-009 | Local trade-area observations must preserve unknown dates, units, methods, relationship state, evidence status, sensitivity, and no-scoring eligibility without fabricating geography. |
| NFR-010 | Candidate evidence generation and follow-up questions must be deterministic, preserve nulls and evidence states, exclude prohibited clinic and commercial values before rendering, and reproduce identical output for identical input. |

## Deferred requirements

- Predictive training on historical clinic outcomes
- Automated Esri ingestion
- Time-series forecasting
- Site optimization
- Lease or investment approval
- Opening-readiness automation
