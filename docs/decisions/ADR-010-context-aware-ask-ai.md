# ADR-010: Context-aware Ask AI workspace

- Status: Accepted for the synthetic and approved public-data prototype
- Date: July 30, 2026

## Context

The evaluator had a candidate-only Ask AI tab with a small set of canned
responses. It was disconnected from market selection, current locations, and
the scoring sandbox. Reviewers could not use it as a consistent way to explore
the evidence currently in view.

The product still has strict boundaries: scoring and geospatial calculations
must remain deterministic, public Census data is market context only, missing
values cannot be imputed, and the system cannot make a final real-estate
decision.

## Decision

Use one shared Ask AI presentation component across the evaluator:

- place it beside the unified map on the front page;
- bind its context to the selected market or location;
- include it in the scoring sandbox for the selected candidate and current
  configuration fingerprint;
- provide source-linked insight starters, evidence status, review warnings,
  limitations, and diligence prompts;
- reset the conversation whenever the selected entity or structured result
  changes; and
- generate explanations only from structured values already available to the
  page.

Deterministic code continues to calculate market-relative percentiles, scores,
contributions, constraints, ranks, and sensitivity results. Ask AI receives and
explains those outputs. It cannot mutate weights, thresholds, workflow state,
source data, or evaluation results.

The prototype uses a server-only OpenAI Responses API route for questions about
the current structured context. The route uses `gpt-5.6-terra` with low
reasoning effort and Structured Outputs. It validates the request and response,
rejects unsupported source IDs and numeric values, blocks final-decision
language, deterministically labels uncited observations as `Unknown`, and
records the model, prompt, template, response, and result versions.

The prompt is question-first. It selects only the evidence needed for the
user's question instead of automatically recapping every context field.
Diligence questions and limitations are returned only when they materially
help answer the question.

### August 4, 2026 amendment: open-ended analyst questions

The explanation contract accepts ordinary analyst language without a separate
intent-classification model call. The model selects one response mode from
`direct`, `qa_list`, `comparison`, or `unknown` and returns one to five typed
answer items. A question-and-answer item keeps the analyst question, answer,
evidence status, and supplied source IDs together. The application, rather than
the model, renders list numbering.

Market comparison context now includes a bounded deterministic projection of
the three largest and three weakest supplied metric contributions for each
selected result. Application code selects and formats these existing results.
The model does not calculate contributions or choose which markets enter the
comparison.

Validation applies to each answer item. Unsupported sources, numeric values,
evidence upgrades, causal claims, or final-decision language replace only the
affected item with an `Unknown` explanation. Supported items remain visible,
and the response records validation issue codes. An unusable response
structure still fails closed. The service records input, cached-input,
cache-write, output, reasoning, and total token usage when the provider returns
it. Provider timeouts and unavailable-service failures have separate safe error
codes, while logs exclude the question and evidence payload.

The versioned contract is `ask-ai-open-ended-v3` with template
`ask-ai-flexible-items-v3` and result version `1.1.0`. A repair call is not part
of this amendment. Normal questions continue to use one model request.

The browser never receives the OpenAI credential. Local development reads
`OPENAI_API_KEY` from an ignored `.env.local` file, while a deployment must use
an approved secret manager. The route sets `store: false`, but that setting does
not replace organizational review of the provider's retention controls.

Only synthetic data and explicitly approved public aggregate context may be
sent until the model endpoint and data classifications are approved for
internal evidence. The service must continue to follow
`docs/technical/ai-boundaries.md`, validate numeric claims, retain source IDs,
and label every response as a draft for human review.

## Alternatives

### Keep Ask AI only in candidate details

Rejected because it makes AI hard to discover and prevents market-first and
sandbox exploration.

### Let AI calculate comparisons directly

Rejected because calculations would be hidden, difficult to reproduce, and
inconsistent with the deterministic decision-support boundary.

### Keep the bounded local response layer

Rejected after API access became available because it could not provide
generative follow-up responses. The deterministic response layer remains useful
as a test baseline but no longer answers user questions in the product.

## Consequences

- Ask AI is visible during the primary map workflow and in the sandbox.
- Markets, current clinics, proposed locations, and sandbox candidates expose
  different evidence-appropriate insights.
- Unsupported conclusions remain blocked or explicitly labeled as unknown.
- The shared component calls a model-backed explanation service without
  changing deterministic calculation ownership.
- Failed validation or unavailable model access returns a visible error and
  does not fall back to an uncited model answer.
- A partially unsupported structured answer preserves supported items and
  replaces unsupported items with an explicit `Unknown` result.
- Open-ended analyst phrasing does not require an additional classifier call.
- Internal or restricted evidence remains blocked until governance approves
  the endpoint and data path.

## Evidence references

- `docs/technical/ai-boundaries.md`
- `docs/technical/data-contracts.md`
- `docs/product/mvp-scope.md`
- `CLM-001`
- `CLM-017`
- `CLM-020`
- `CLM-025`
- `CLM-026`
- `CLM-027`
