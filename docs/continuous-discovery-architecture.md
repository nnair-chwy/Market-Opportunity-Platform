# Continuous cross-source discovery

## Product decision

The discovery experience must become a persistent research service, not a button that reruns a fixed list of screens. A cycle should publish useful intermediate outputs as soon as they pass evidence checks, keep working while new hypotheses remain valuable, and resume when data changes.

The current implementation is a bounded synchronous scan. It runs registered analyses, groups the resulting regional leads, challenges them with compatible evidence, and ranks them. It does not yet invent arbitrary queries, persist a server-side research queue, or run after the request ends.

## Target loop

1. **Observe** — detect new snapshots, material metric movements, missing joins, and prior hypotheses whose evidence changed.
2. **Propose** — generate a backlog of cross-source hypotheses with a decision owner, controllable lever, expected business outcome, required evidence, and explicit falsification rule.
3. **Prioritize** — rank by expected decision value, novelty, source diversity, statistical power, cost to test, and overlap with active work.
4. **Compile** — translate the selected hypothesis into governed query plans using the semantic catalog, approved grains, time windows, and geography crosswalk.
5. **Test** — execute descriptive, peer, temporal, robustness, and counterfactual checks. Preserve contrary and excluded evidence.
6. **Critique** — ask a separate analyst/critic pass to identify confounding, leakage, coverage artifacts, alternative explanations, and unsupported value claims.
7. **Update belief** — mark the hypothesis strengthened, weakened, rejected, waiting for data, or promoted to a recommendation/test design.
8. **Publish** — stream the evidence-backed update to the findings feed immediately. Notify a team only when its configured materiality and evidence threshold is met.
9. **Continue or pause** — choose the next hypothesis until marginal expected value is below the configured cost, the run budget is reached, required data is unavailable, or the queue is exhausted.

## Durable objects

- `DiscoveryProgram`: scope, teams, cadence, source permissions, run budget, and notification policy.
- `Hypothesis`: stable ID, lineage, novelty fingerprint, business outcome, lever, owner, status, and parent hypothesis.
- `TestPlan`: query plans, required joins, geography/time grain, falsification rule, robustness checks, and approval state.
- `EvidenceEvent`: append-only observation with source/snapshot IDs, query receipt, result summary, exclusions, and quality verdict.
- `BeliefUpdate`: prior/posterior status, analyst rationale, contrary evidence, confidence calibration, and next action.
- `Opportunity`: stakeholder-facing recommendation with expected value or an explicit unsized boundary, owner, success/stop rules, and source lineage.

## Streaming contract

The UI should subscribe to append-only events rather than wait for one final response:

- `cycle_started`
- `hypothesis_proposed`
- `hypothesis_queued`
- `test_started`
- `evidence_observed`
- `hypothesis_strengthened`
- `hypothesis_weakened`
- `hypothesis_rejected`
- `opportunity_published`
- `data_requested`
- `cycle_paused`

Every published finding must be revisable without disappearing. A later cycle creates a belief update and retains the previous evidence and recommendation history.

## Required platform changes

1. Move discovery history from browser local storage to a durable server-side event store.
2. Add a scheduler or queue worker triggered by approved snapshot refreshes and team cadence.
3. Add a governed semantic catalog and query compiler so generated hypotheses can use more than registered UI views.
4. Add model-generated hypothesis proposals constrained to available metrics, joins, time grains, geography, and permitted actions.
5. Add a novelty ledger so the agent does not repeatedly ask equivalent questions.
6. Add sequential stopping rules: queue exhausted, evidence unavailable, marginal value below cost, compute budget reached, or approval required.
7. Add streaming delivery (SSE or WebSocket) for intermediate evidence and opportunity updates.
8. Add analyst-quality evaluation: factuality, join validity, causal overreach, action specificity, value sizing, novelty, and stakeholder usefulness.
9. Add outcome feedback so launched tests and rejected recommendations improve future ranking.
10. Keep material actions human-approved even when investigation and reporting are autonomous.

## Near-term release sequence

- **Now:** expose the cross-source hypothesis backlog and its falsification rules; include the PetSmart/Petco Dog Food cross-team handoff in Pricing exports.
- **Next:** persist hypotheses/evidence as server events and stream cycle progress to the page.
- **Then:** add constrained model-generated hypotheses plus a query compiler over approved DuckDB/Snowflake semantic views.
- **Finally:** schedule refresh-triggered cycles, learn from test results, and notify teams based on materiality rather than a fixed finding count.
