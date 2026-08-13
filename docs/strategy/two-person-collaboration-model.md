# Sheila + Nik collaboration model

## Shared objective

Build a geographic AI analyst that understands a business question, proposes a specific and editable analysis contract, finds and evaluates compatible evidence, surfaces market-specific insights, and produces a traceable action packet for human review.

The product must distinguish exploration, decision support, test design, and causal evaluation. It must never turn public context, missing evidence, or synthetic fixtures into an unsupported recommendation.

## Ownership boundary

| Workstream | Owner | Owns | Does not own |
| --- | --- | --- | --- |
| Decision agent and experience | Sheila | Question interpretation, analysis-contract UI, agent orchestration, evidence-plan experience, results and maps, follow-up conversation, action packet, export, browser tests | Raw extraction SQL, source cleanup, canonical geography crosswalks, numeric-engine correctness |
| Evidence and computation platform | Nik | Source packages, semantic catalog, geography and identity, quality and freshness checks, deterministic operators, calculation receipts, reference results, engine tests | Product copy, interaction design, agent conversation, recommendation presentation |
| Business meaning | Sheila + Nik | Use-case definition, decision boundary, KPI meaning, fair comparison, allowed action, golden questions, result review | Neither person changes these alone |

This is a system-layer split, not a department split. Pricing, Marketing, and CVC should all use the same contracts and orchestration.

## Current shared contract

The UI may propose a question, assumptions, considerations, weights, evidence, and method. The calculation layer decides whether those inputs are valid and executable.

| Boundary | Sheila produces or consumes | Nik produces or consumes |
| --- | --- | --- |
| Question → analysis contract | Editable decision, analysis intent, geography, period, assumptions, comparison rules, proposed weights, requested outputs | Validation requirements for geography, metrics, method, and evidence |
| Analysis contract → run | A versioned confirmed request; no hidden fallback | Accepted, needs revision, needs evidence, blocked, or executed response |
| Run → results | Renders returned artifacts without recalculating them | Reproducible values, entity IDs, evidence receipts, warnings, blockers, and versions |
| User-added evidence | Explicit upload/correction intent and consent | Quarantine, parse, quality-check, register, and permit or reject use |

Every displayed number must resolve to a returned artifact or entity result and an evidence receipt. Sheila may improve labels but not metric meaning. Nik may improve calculation mechanics but not change the business decision silently.

## Weight semantics

- Weights describe the intended relative influence on a final recommendation and must total 100%.
- Eligibility rules and must-pass gates remain separate from weights. A high-weight item cannot override a failed gate.
- Missing evidence receives no invented value. The product may show the intended weight and the amount of the model currently covered by connected evidence.
- Confirmed human edits must be preserved in the run request, saved packet, and export.
- A current connected-evidence screen may remain exploratory even when the intended future decision model has weights.

## Geography handshake

No component joins places by display name. A geographic payload must include a canonical ID, display name, grain, boundary version, crosswalk version, period, allocation method, coverage, unmatched count, and excluded geographies.

Nik owns canonical IDs, crosswalks, allocation, and coverage. Sheila renders these fields and asks for correction when the user intends a different decision geography.

## Metric and evidence handshake

Every selectable metric needs a stable ID, business definition, numerator, denominator, unit, aggregation, direction, geography, period, source, snapshot, freshness, missing-value rule, evidence status, allowed use, and caveats.

Source access alone does not make a metric approved for scoring or recommendation. Public Census data remains market context. Published clinic points remain footprint context unless capacity and access are validated.

## Independent work protocol

1. Each person works on a separate `agent/*` branch created from the latest agreed integration branch.
2. Each branch has one owner and a written file boundary. Do not edit the other owner’s modules without an explicit handoff.
3. Before starting, record the base commit in the branch notes or PR description.
4. Before integration, fetch the latest integration branch and compare changed files.
5. Shared-contract changes require an example payload, compatibility note, paired producer/consumer tests, and review from both Sheila and Nik.
6. Commit only files belonging to the branch’s stated task. Keep raw exports, credentials, browser parameters, and unapproved business data out of Git.
7. Push the branch to GitHub and open a draft PR before asking the other person to integrate it.
8. Integration happens by merge or targeted cherry-pick after tests pass; do not copy files manually between worktrees.

## GitHub layout

- Integration branch under review: `agent/consolidate-analyst-loop`
- Sheila’s default branch prefix: `agent/experience-*`
- Nik’s default branch prefix: `agent/evidence-*`
- Research-only branches must say so in their PR and must not contain production credentials or raw exports.
- The local checkout in `Market-Opportunity-Platform-readiness` currently points first to a local mirror. Publishing to GitHub must also verify `nnair-chwy/Market-Opportunity-Platform` received the same commit SHA.

## Sheila workboard

| Deliverable | Done when |
| --- | --- |
| Question interpreter | A vague or direct question becomes a specific editable decision without silently changing its intent |
| Human checkpoint | Question, assumptions, considerations, roles, evidence state, and weights are readable and editable before analysis |
| Evidence planner | Available, missing, stale, incompatible, and substitute evidence are visible with reasons |
| Agent harness | The agent can propose a governed investigation plan and show progress beyond a generic loading label |
| Results map | Map content follows the question and result; regions, pairs, filters, and click details stay synchronized |
| Follow-up loop | Selecting a lead adds it as conversation context and answers stay grounded in that lead |
| Action packet | Export contains finding, evidence, drivers, owner, next action, KPI, guardrails, limitations, and human asks |
| Product tests | Golden Pricing, Marketing, and CVC questions plus missing/unsupported paths pass from a clean start |

## Nik workboard

| Deliverable | Done when |
| --- | --- |
| Source packages | Every approved snapshot has source, version, extraction time, owner, grain, period, rows, and allowed use |
| Semantic catalog | The agent can discover metrics without guessing raw-field meaning |
| Quality service | Units, duplicates, missingness, freshness, coverage, and incompatibility are explicit |
| Geography and identity | Stable IDs and versioned crosswalks replace fuzzy joins |
| Plan validator | Unsupported sources, joins, methods, controls, and missing-data rules fail with fixable errors |
| Calculation tools | Descriptive, comparison, ranking, matching, correlation, and sensitivity operations are reproducible |
| Statistical safeguards | Sample, uncertainty, multiple testing, stability, spatial, and confounder checks match the declared analysis intent |
| Reference results | At least three markets and three clinics reconcile to hand-checked results |

## Current integration status

### Implemented in the consolidation branch

- Perspective-aware CVC, Marketing, and Pricing opening views.
- A pre-analysis question and evidence checkpoint.
- Published-clinic and public-Census CVC investigation leads without synthetic market ranking.
- Results map with synchronized finding colors, pair highlighting, click details, and finding filters.
- Lead-scoped follow-up context, saved packets, and downloadable reports.
- Restart and question-specific workflow state.

### Still separate or incomplete

- Google Ads research is in the `Market-Opportunity-Platform-google-ads` worktree and is not integrated into the application.
- No governed Google Ads CSV is connected to the Marketing result path.
- SEO/SEMrush request CSV and intent brief are not present in the consolidation branch.
- Pricing evidence remains unconnected; the current Pricing view is context/readiness only.
- The current investigation runner is deterministic over checked-in public/published data. It is not yet an autonomous live-research agent scanning a semantic catalog.
- Confirmed weights are preserved as the intended decision formula, but unavailable must-pass inputs still prevent a final clinic-opportunity score.
- The evidence planner and correction/upload loop exist in code but need reintegration into the visible pre-run flow.
- Current question/run state is not fully durable across an uncommitted browser refresh; saved packets are durable in local browser storage.

## Integration checklist

- [ ] Both branches point to the agreed base commit.
- [ ] Shared schemas and fixtures have matching versions.
- [ ] No duplicate contract or private adapter was introduced.
- [ ] Geography and metric definitions are unchanged or jointly approved.
- [ ] Human-edited weights and assumptions reach the run payload and export.
- [ ] Map, cards, popups, and report use the same entity IDs and evidence receipts.
- [ ] Missing, restricted, stale, and incompatible evidence remain explicit.
- [ ] Golden questions produce question-specific results rather than a fixed answer.
- [ ] Full automated tests and browser smoke tests pass.
- [ ] The GitHub branch SHA matches the reviewed local commit.

## Stop-and-coordinate conditions

Stop and ask the other owner before changing a shared schema, metric definition, geography rule, allowed-use rule, missing-data policy, calculation method, approval gate, or result meaning. These changes can make both workstreams appear functional while producing incompatible or misleading output.
