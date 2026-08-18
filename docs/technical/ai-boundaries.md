# AI boundaries

## Appropriate uses

AI may:

- summarize structured site characteristics;
- compare deterministic results;
- draft strengths, risks, and diligence questions;
- explain score differences;
- identify missing or conflicting evidence;
- extract proposed criteria from approved documents for human review; and
- generate a standardized brief with source references.
- select the next action from a policy-provided allowlist of candidate-review
  tools; and
- summarize validated tool results and draft a source-linked review packet.
- explain one selected synthetic market result or application-supplied
  differences among two to five same-cohort results selected by the analyst.
- propose a schema-constrained question intent that deterministic code compiles
  against the versioned capability registry.
- use the validated answer contract to organize permitted evidence into the
  required answer sections and identify which domain requirements remain unmet.
- propose advisory decision framing, reviewed requirement emphasis, and
  unresolved questions through a strict schema; deterministic code retains the
  canonical decision and compiles the final answer contract.

## Prohibited uses

AI must not:

- invent, estimate, or silently impute missing data;
- perform hidden geospatial calculations;
- select or modify production weights;
- convert qualitative comments into scores without an approved rubric;
- claim that correlation explains clinic performance;
- recommend signing a lease or opening a clinic autonomously;
- expose precise customer locations or restricted information;
- write back to Esri, source systems, or clinic records without separately approved controls.
- choose its own tool arguments, bypass application policy, resolve an
  ambiguous relationship without a reviewer, or mark evaluation prerequisites
  as passed;
- treat public market context or `SRC-017` descriptive evidence as a scoring
  input; or
- add or remove markets from a comparison, calculate comparison scores or
  ranks, change weights, or select a preferred market; or
- create durable workflow state in the process-local prototype.
- add a capability, choose an undocumented source, calculate map percentiles,
  change a map comparison set, or provide an approval receipt.
- replace the answer contract, change its canonical decision, add domain
  requirements or source IDs, mark `documented_not_approved` or missing
  evidence as connected, weaken completion criteria, or exceed the strongest
  permitted conclusion.

## Adaptive planning

- The planner returns only the constrained intent schema, not an execution plan
  or hidden reasoning.
- Deterministic code compiles the intent, assesses registry support, identifies
  missing evidence and approvals, and prepares visible steps and draft actions.
- When the model is unavailable or its output fails validation, the application
  uses the deterministic compiler and keeps the same evidence boundaries.
- The planner uses server-only credentials and `store: false`.

## Bounded orchestration

- One server-side orchestrator may call only tools in
  `candidate-review-tools-v1`.
- Every model action and every tool result is schema-validated.
- Application policy calculates the permitted tool set for the current state.
- The run stops after at most eight tool invocations.
- An unresolved one-to-many relationship moves the run to
  `waiting_for_review`; no tool may continue until a reviewer responds.
- Confirm, reject, and leave-unresolved responses are retained as separate
  review receipts and never rewrite source evidence.
- The deterministic evaluation tool is permitted only after application
  prerequisites pass and receives a separately valid `EvaluationInput` and
  `ScoringConfiguration`.
- The OpenAI call uses server-only credentials and `store: false`.
- Model unavailability or an unsupported action produces a controlled failure,
  not canned agent output.
- Activity summaries describe actions and results without displaying hidden
  reasoning.

### Seattle deep-dive orchestration

- The Seattle orchestrator is separate from the candidate-review agent and is
  limited to CBSA `42660` and `seattle-market-deep-dive-tools-v1`.
- It stops after at most seven tool invocations.
- It must pause after loading the proposed illustrative segmentation. Comparison
  is not permitted until the analyst confirms it.
- Rejecting or leaving the segmentation unresolved blocks the run without a
  comparison.
- The model selects only the next application-permitted tool. Deterministic
  code calculates all scores, contributions, missingness, and sensitivity.
- Broker records are checked-in fictional fixtures. The model cannot search
  for, invent, select, contact, or recommend a real broker.
- Public `SRC-014`, `SRC-015`, and `SRC-016` context remains non-scored.
- Deterministic application code generates illustrative areas from checked-in
  approximate public city-center hubs. AI cannot create or modify geometry.
- Server-only credentials, strict schemas, `store: false`, process-local state,
  and controlled failure behavior apply to every model-backed run.

## Prompt input

The explanation service receives only:

- structured metrics and contributions;
- visible warnings and missing fields;
- approved qualitative evidence;
- source IDs and titles;
- allowed comparison language; and
- the requested output template.
- the validated answer contract, including domain requirements, strongest
  permitted conclusion, completion criteria, and prohibited conclusions.

## Output controls

- Validate all numeric statements against structured input.
- Require source IDs for factual statements.
- Label the text as a draft for human review.
- Reject unsupported causal or financial claims.
- Preserve the prompt, model, template, and result versions.
- Preserve the tool-contract, run-schema, source-snapshot, and approval-receipt
  versions for agent runs.
- Evaluate against a deterministic template baseline.
- Run deterministic contract validation and investigation coverage before
  final-answer composition.
- Preserve unsupported and blocked sections in the composed answer instead of
  asking the model to fill them.
