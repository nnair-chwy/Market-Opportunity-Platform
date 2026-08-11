# Adaptive evaluation workspace cases

These cases validate the proposed ADR-018 architecture. All business definitions,
thresholds, weights, clinic values, and local-area evidence are synthetic prototype
defaults unless a source contract says otherwise.

## Shared-contract cases

| Case | Input | Expected result |
| --- | --- | --- |
| AEW-001 | Load either saved demo definition | Both parse through the same `EvaluationDefinition` schema and expose the same three human-gate types. |
| AEW-002 | Plan either saved demo | Both produce the same ten-step protocol with goal, purpose, actor, inputs, operator, output, sources, evidence status, warnings, and human-request fields. |
| AEW-003 | Attempt execution before material approval | Run remains at `definition_review`; no deterministic evaluation or action packet is exposed. |
| AEW-004 | Approve a definition with optional rationale | A process-local structured response is retained separately from source evidence. |
| AEW-005 | Repeat identical definition, rows, and source versions | Reproducibility key and deterministic outputs are identical. |

## Seattle site-diligence cases

| Case | Input | Expected result |
| --- | --- | --- |
| AEW-101 | Approve Seattle prototype definition | Existing Seattle scoring produces seven ranked entity rows with raw values, contributions, coverage, missingness, and fixed weight sensitivity. |
| AEW-102 | Build zones twice | Output is byte-equivalent with seven stable zone IDs and method `clipped-nearest-hub-partition-v1`. |
| AEW-103 | Inspect emitted zone vertices and deterministic grid | All zones remain inside CBSA `42660`; no tested interior point belongs to more than one zone. |
| AEW-104 | Select a zone on the map | Entity list, selected evidence, metric comparison, and action context use the same selected ID. |
| AEW-105 | Review leading zone | Packet uses only advance, defer, or stop-review language and explicitly does not authorize market entry, property selection, lease, or opening. |

## Clinic-performance cases

| Case | Input | Expected result |
| --- | --- | --- |
| AEW-201 | Parse checked-in aggregate CVC CSV | Existing adapter validates clinic grain, comparable windows, opening dates, units, quality, and the three candidate outcome fields. |
| AEW-202 | Approve primary outcome, 26–52 week maturity, same-window cohort, and 10-appointment materiality | Generic operators establish eligibility, calculate three peer medians and differences, and apply the declared boundary. |
| AEW-203 | Review strongest signal | Result includes the primary peer difference, two supporting metrics, a moderating signal, source-quality state, missing cause evidence, and no causal claim. |
| AEW-204 | Review draft action | The common packet proposes a bounded cross-functional review and follow-up metric; receiver remains a prototype hypothesis. |

## Safe-failure and adaptability cases

| Case | Input | Expected result |
| --- | --- | --- |
| AEW-301 | “How should Chewy change dog-food prices by region?” | Structured `Needs evidence`; understood decision, required evidence, absent catalog capabilities, requested human inputs, and explicit statement that no evaluation ran. |
| AEW-302 | Register prepared demand/coverage fixture and test definition | Core engine ranks `market-b` first using the shared operator registry; no new orchestration path or page. |
| AEW-303 | Open Verified Evaluation Library | Entries show question, interpretation, sources, metrics, comparison, boundary, expected fixture, verifier label/date, version, and prototype-only verification status. |
| AEW-304 | “Which U.S. markets have the highest population density?” | Compiler selects `market_density`; the shared Census map, ranking, drawer, source summary, and report update without a question-specific view. |
| AEW-305 | Ask a campaign or national clinic-location question | Workspace runs only the public Census context stage, names the missing business evidence and partner request, and does not expose the synthetic campaign or attractiveness score as an answer. |

## Demo sequence

1. Open the Evaluation Workspace.
2. Use the Seattle site-diligence starter.
3. Inspect decision, entities, evidence, formulas, comparison, assumptions, boundary,
   receiver, and gates.
4. Approve the prototype definition and segmentation for this run.
5. Expand plan steps to inspect inputs, operators, outputs, source versions, and
   warnings.
6. Select a map zone and verify synchronized list, evidence, and comparison state.
7. Review supporting and contrary evidence and the draft action packet.
8. Start a new evaluation in the same workspace using the clinic-performance starter.
9. Inspect and approve the primary outcome, maturity, peer, and materiality defaults.
10. Expand the same plan structure as it runs on aggregate clinic evidence.
11. Review the peer-adjusted finding, supporting metrics, moderating evidence, missing
    causal inputs, bounded next step, and follow-up metric.
12. Enter the unsupported regional dog-food pricing question.
13. Show the structured `Needs evidence` response and confirm that no evaluation or
    action packet was produced.
