# ADR-018: Adaptable evaluation workspace

- Status: **Accepted for the architecture baseline**
- Date proposed: 2026-08-06
- Date accepted: 2026-08-10
- Decision owners: Unresolved; see `OQ-033` through `OQ-038`

## Context

The prototype has working deterministic market, Seattle-area, evidence-readiness,
candidate-review, and aggregate clinic-performance capabilities. Candidate review
and Seattle deep dive currently expose separate orchestrators and product surfaces.
That shape does not demonstrate that a structurally different evaluation can reuse
one governed evaluation process.

The proposed product claim is intentionally narrow: a second evaluation can reuse
evidence planning, validation, deterministic comparison, human review, conditional
mapping, and bounded action output without creating a second product. The prototype
does not claim to answer arbitrary business questions or make Chewy decisions.

## Proposed decision

Make one Evaluation Workspace the primary prototype entry point. Represent each
supported evaluation as versioned data using a shared `EvaluationDefinition`,
`EvaluationRun`, `EvaluationStep`, three human-gate types, governed catalog entries,
registered deterministic operators, generic artifacts, and one action-packet
contract.

Question interpretation is split into two bounded layers. A model may propose a
small `AnalysisIntent` containing only declared question classes, topic, entity
grain, geography, measures, and requested action. Deterministic application code
then compiles that intent into an `AnalysisPlan`, rejects unsupported combinations,
and selects the compatible visualization and fixed calculation. The model never
supplies weights, source identifiers, formulas, thresholds, joins, or approval.
When model planning is unavailable or invalid, the same compiler receives a
deterministic prototype intent and the UI labels that fallback explicitly.

The core orchestrator executes the operator plan declared by a valid definition. It
contains no site-selection or clinic-performance workflow branch. The Seattle and
clinic demonstrations differ in their definition, catalog sources, and prepared
rows, not in their orchestration protocol or results page.

The Evaluation Workspace uses this stable sequence:

1. Goal composer.
2. Inspectable evaluation contract.
3. Material run-local approval gate.
4. Visible ten-step evaluation protocol.
5. Generic evidence and result artifacts, including a map only when geography is
   present.
6. Finding, contrary evidence, uncertainty, and missing diligence.
7. Bounded action packet and final human review.

Add a Verified Evaluation Library that binds a verified question to an
interpretation, source and metric set, comparison rule, boundary, fixture result,
verifier label, date, and version. `prototype_test_verified` means regression-tested;
it does not mean business-approved.

## Boundaries retained

- Evidence statuses and allowed-use restrictions remain attached to definitions,
  artifacts, steps, and actions.
- AI may draft and explain, but deterministic application code calculates and
  classifies.
- AI-proposed analysis intents are schema-validated and capability-compiled before
  they can select a result view; unsupported intents stop at `needs_evidence`.
- No missing value is imputed and no evidence status is upgraded.
- Material assumptions require a process-local human response before execution.
- Action packets are drafts. They do not approve a site, market entry, property,
  lease, clinic opening, clinic intervention, pricing change, or causal claim.
- Public CBSA and minimized Esri context retain their existing non-scoring limits.
- The default national map is public-first: it renders a declared Census measure and
  deterministic percentile, never the synthetic market-attractiveness or campaign
  proxy. Synthetic national, Seattle, and clinic data are retained only as labeled
  regression/demo fixtures.
- Aggregate CVC evidence remains synthetic prototype evidence until metric,
  governance, and ownership questions are resolved.
- Process-local receipts do not rewrite source evidence or establish production
  authority.

## Geographic method

Replace presentation-only Seattle circles in the primary workspace with a
deterministic nearest-hub partition clipped to parent CBSA `42660`. The implementation
triangulates the checked-in parent geometry and clips each triangle by declared hub
bisectors. This keeps every emitted part inside the parent, produces non-overlapping
zones, and avoids hand-drawn polygons. Stable submarket IDs remain the zone IDs.

Method version: `clipped-nearest-hub-partition-v1`.

The zones remain `Hypothesis`, `synthetic_prototype_only`, and explicitly are not
official neighborhoods, trade areas, or real-estate submarkets. Geometry remains
separate from metric evidence and has no scoring eligibility.

## Consequences

### Positive

- The site and clinic examples exercise one contract, engine, step canvas, human
  gate, artifact renderer, and action packet.
- A third automated demand-to-coverage-gap fixture registers a source and definition
  without changing core orchestration.
- Unsupported pricing questions stop with a structured evidence-gap plan.
- Dog ownership, cat ownership, ownership-income crossover, public CBSA context,
  campaign evidence planning, clinic location, Seattle submarket, and clinic-performance
  questions now enter through one analysis-intent contract rather than independent
  UI keyword branches.
- Population, households, median income, housing units, and density use one declared
  public-measure catalog, generic map, ranking, market drawer, source summary, and
  evidence boundary. Adding a compatible public measure does not require a new view.
- Definitions expose formulas, inputs, sources, rules, restrictions, and versions
  before execution.

### Risks and limitations

- Definitions and run history are process-local and not production persistence.
- User edits beyond the included prototype defaults need a future versioning and
  recomputation interaction contract.
- The verified library is prototype test evidence, not approval of business meaning.
- The existing legacy workflows remain available in code during development but are
  not the primary entry point.

## Alternatives considered

1. Add a clinic-performance dashboard and orchestrator. Rejected because it would
   reproduce the current per-use-case product pattern.
2. Put a shared chat box over the existing workflows. Rejected because shared intake
   alone does not prove shared planning, calculation, artifacts, or action output.
3. Replace deterministic modules with model prompts. Rejected because it would weaken
   reproducibility, evidence lineage, and governance.
4. Build a universal ontology or natural-language SQL layer. Rejected as broader than
   the prototype claim and current governed source contracts.

## Acceptance record

The user accepted this architecture direction for the
`feature/adaptive-evaluation-workspace` baseline on 2026-08-10 and explicitly
requested that it be committed after the readiness gate. Acceptance authorizes the
prototype architecture and documentation baseline; it does not resolve business
ownership, production data permission, human-gate authority, verified-library
governance, or production interpretation. Those remain tracked in `OQ-033` through
`OQ-038` and require the named business and governance approvals before production
use.
