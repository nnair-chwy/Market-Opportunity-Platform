# Thursday geo-signals delivery plan

**Target:** Thursday, August 20, 2026
**Objective:** Demonstrate that the Market Opportunity Platform can find non-obvious, evidence-backed geographic signals, explain why they matter, state what could invalidate them, and route a safe next action to a named owner.

## Current delivery status — August 18

The core evidence-backed workflow is implemented on the integrated local
`main` worktree and is ready for final browser validation. The application can
route each golden-question family to the frozen
`golden-question-evidence-2026-08-18-v1` snapshot and return a partial,
source-linked answer rather than a fixed narrative or an empty refusal.

| Workstream | Current state | Thursday implication |
| --- | --- | --- |
| Question intake and planning | Implemented: free-form entry, deterministic routing, editable pre-run brief, recommended-question typeahead, and saved-question recall | Confirm all three exact golden prompts from a clean browser session |
| Marketing evidence | Implemented: Philadelphia and San Antonio response leads from the same 198-CBSA volume-gated cohort | Strongest live-demo path; still requires first-party outcome and campaign-mix validation |
| Pricing evidence | Implemented: Kankakee monitoring lead plus national Zeus SKU/exception context | Demonstrates safe downgrading; Zeus must remain visibly national and must not be presented as Kankakee economics |
| CVC evidence | Implemented: Santa Clara supplied trade-area contrast | Demonstrates a research-needed result; observation date, trade-area method, clinic definition, capacity, appointments, and economics remain unresolved |
| Answer packaging | Implemented: best-available draft, source/version notes, contrary evidence, missing evidence, and review boundary | Hand-check that the downloaded brief preserves the same conclusion authority and limitations |
| Material business recommendations | Intentionally not delivered | No current evidence supports changing price, spend, clinic footprint, lease, or another material lever |
| Production data operations | Not delivered | Recurring ingestion, approved crosswalks, production identity/access, and durable approvals remain post-Thursday work |

The implementation is not release-complete until the manual checks in
`docs/evaluation/thursday-manual-demo-checklist.md` pass and the selected report
findings are reviewed by the accountable business and data owners.

## Product promise for Thursday

The platform will answer supported geographic questions from a governed snapshot. It will resolve the geography, choose compatible evidence, calculate reproducible comparisons, surface contrary and missing evidence, and produce a reviewable finding with an owner, KPI, validation step, and stop condition.

It will not claim causal lift, approve a price or spend change, select a clinic site, or turn incomplete evidence into a production recommendation.

## Golden questions

| Perspective | Golden question | Minimum credible Thursday result | Safe action class |
| --- | --- | --- | --- |
| Pricing | Where do observed competitor conditions and Chewy economics warrant investigation? | Identify a region/category or region/SKU cohort with a material competitor-condition contrast; separate observation quality, prior intervention, promotion, inventory, and timing explanations; show whether Chewy economics/outcomes corroborate it | Investigate data quality or match configuration; review a monitored condition; propose a controlled analysis or test design |
| Marketing | Which comparable geographies show paid-search response worth validating with first-party outcomes? | Compare compatible markets on delivery and response; show cohort, volume, coverage, and CPC/CTR tradeoffs; do not equate clicks with demand or incrementality | Validate first-party outcome and attribution; design a geo test; review taxonomy or coverage |
| CVC | Which markets show demand/footprint contrasts worth deeper clinic-access investigation? | Identify markets where public/approved demand context and clinic footprint differ; keep access, capacity, veterinary supply, workforce, property, and economics visibly unresolved | Assign a market deep dive; obtain capacity/access evidence; validate a candidate hypothesis |

The strongest evidence-complete question becomes the live demo. The other two must either produce a bounded finding or an honest research-needed result with a specific data acquisition path.

## Finding contract

Every displayed finding must contain:

1. Stable geography ID, display name, grain, and boundary/crosswalk version.
2. Comparison cohort and why it is compatible.
3. Observation window and source snapshot versions.
4. Signal definition, magnitude, numerator, denominator, unit, and calculation version.
5. Corroborating evidence and at least one plausible contrary explanation.
6. Coverage, missingness, freshness, unmatched geography, and other quality warnings.
7. Evidence status and strongest permitted conclusion.
8. Named next action, accountable role, KPI, validation threshold, and stop condition.
9. Claim-level source references and a reproducible calculation receipt.

## Work split

### Sheila — decision agent and experience

- Lock the three golden question prompts and expected answer modes.
- Ensure the pre-run contract shows geography, period, cohort, evidence, method, assumptions, and unsupported requirements.
- Route each question to the correct perspective and evidence bundle without fixed-answer behavior.
- Render the finding contract consistently in map, detail, follow-up, and downloaded report.
- Make unsupported, blocked, and research-needed outcomes as clear as successful findings.
- Add browser smoke coverage for the strongest live demo and deterministic regressions for all three golden questions.

### Nik — evidence and computation

- Complete the data-gap matrix for all required golden-question metrics.
- Prioritize the smallest governed exports that close actionability gaps rather than adding redundant context.
- Produce versioned source packages, geography coverage reports, semantic definitions, quality results, deterministic operators, and calculation receipts.
- Hand-check at least three market results and reconcile them to application output.
- Add safeguards for low volume, missingness, stale periods, incompatible cohorts, row multiplication, spatial allocation, and confounding/intervention history.
- Return a candidate finding set with supporting and contrary evidence; do not change presentation or business meaning silently.

### Joint review

- Approve cohort fairness, metric meaning, thresholds, and strongest permitted conclusion.
- Select three to five findings for the report, including at least one that is surprising but reproducible and one that is withheld or downgraded because of contrary evidence.
- Assign a real accountable role, KPI, validation step, and stop condition to every action.
- Reject any finding whose wording is stronger than its evidence.

## Sequence

### Tuesday — evidence lock and reference results

- Inventory current sources against the three golden questions.
- Freeze snapshot IDs, periods, geography versions, and allowed use for the Thursday candidate build.
- Select the strongest question based on evidence completeness, not visual appeal.
- Produce the first hand-checked reference result and identify the top blocking gap for each remaining question.

### Wednesday — end-to-end findings and challenge review

- Run all three golden questions from a clean start.
- Reconcile application values to hand calculations.
- Review every candidate finding for cohort mismatch, data leakage, intervention history, geography error, small samples, stale evidence, and unsupported causality.
- Finalize three to five findings and the research-needed fallbacks.
- Complete automated contract/regression tests and one browser smoke path per perspective where dependencies permit.

### Thursday — release gate and report

- Run the strongest question live from intake through downloadable packet.
- Confirm identical inputs reproduce identical numbers and conclusion authority.
- Confirm each factual claim resolves to a source and each action has an owner, KPI, validation threshold, and stop condition.
- Publish a concise report containing findings, maps/comparisons, contrary evidence, limitations, recommended next analyses, and remaining data gaps.

## Release gates

The Thursday demonstration is ready only if:

- At least one golden question produces a real, non-synthetic geographic finding from approved or explicitly bounded internal-demo evidence.
- At least three findings across the available perspectives are reproducible and reviewed; no more than one may rely only on public context.
- At least one finding demonstrates multi-source corroboration.
- At least one tempting signal is visibly downgraded or withheld because of contrary, missing, or incompatible evidence.
- Every number has a source/snapshot and calculation receipt.
- Every geography reports coverage and unmatched records.
- Every suggested action is reversible or investigative and includes an owner, KPI, validation step, and stop condition.
- No prohibited customer identifiers, credentials, raw exports, or autonomous material actions appear in Git, prompts, logs, or reports.
- Golden-question regressions pass and the live demo path completes without a fixed answer.

## Thursday report outline

1. Executive finding: what geographic pattern was discovered and why it matters.
2. Evidence and method: sources, periods, geography, cohort, and calculation.
3. Findings: three to five ranked by evidentiary strength, not business excitement.
4. Contrary evidence and withheld conclusions.
5. Actions: owner, next step, KPI, validation threshold, and stop condition.
6. Data coverage and remaining gaps.
7. Reproducibility appendix: snapshot, query, calculation, prompt, and application versions.

## Explicit deferrals

- Universal opportunity scoring across Pricing, Marketing, and CVC.
- Causal claims from observational geographic differences.
- Automated price, campaign, clinic, lease, or market-entry actions.
- Production authentication, recurring ingestion, multi-user workflow, and durable enterprise approvals.
- Arbitrary model-generated SQL or unrestricted live-source research.
