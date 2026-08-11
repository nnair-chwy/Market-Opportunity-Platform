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
- turn a validated synthetic ecosystem ActionPacket into concise stakeholder
  language without changing any packet field or policy result.

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
- alter an ecosystem ActionPacket disposition, course of action, owner,
  deadline, condition, outcome, guardrail, value, or source set; or
- send an ecosystem message or execute the prepared synthetic course of action.

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

### Ecosystem ActionPacket explanation

- Deterministic code owns typed evidence validation, analysis, the deadline,
  conditions, `advance`, `stop`, or `blocked` disposition, and packet assembly.
- The model receives only the validated ActionPacket and presentation
  instructions. It returns schema-validated headline, summary, unchanged course
  of action, limitation, and the unchanged complete source-ID set.
- Numeric statements are checked against packet values. Altered actions,
  changed sources, invented numbers, invalid structures, timeouts, and provider
  errors are rejected or downgraded to deterministic fallback language.
- Missing `OPENAI_API_KEY` produces a visible `not_configured` fallback state.
  Automated tests do not require provider access.
- The server-side OpenAI request uses a bounded timeout, one retry, structured
  output, and `store: false`.
- This workflow has no human approval gate because it only prepares fictional
  planning artifacts and simulated previews. It cannot initiate a real action.

## Prompt input

The explanation service receives only:

- structured metrics and contributions;
- visible warnings and missing fields;
- approved qualitative evidence;
- source IDs and titles;
- allowed comparison language; and
- the requested output template.

## Output controls

- Validate all numeric statements against structured input.
- Require source IDs for factual statements.
- Label candidate-review and market-comparison text as a draft for human review;
  label ecosystem ActionPacket language as synthetic prepared wording with no
  execution authority.
- Reject unsupported causal or financial claims.
- Preserve the prompt, model, template, and result versions.
- Preserve the tool-contract, run-schema, source-snapshot, and approval-receipt
  versions for agent runs.
- Evaluate against a deterministic template baseline.
