# Evaluation plan

## Stage 1: Contract and calculation validation

- Validate schema and invalid-input behavior.
- Unit-test every normalization and contribution function.
- Confirm exact reproducibility.
- Confirm missing data never receives a hidden favorable value.
- Confirm candidate evidence briefs reproduce byte-equivalent output for
  identical inputs and preserve the fixed section and field order.
- Confirm missing, unknown, restricted, rejected, stale, and conflicting states
  remain distinct.
- Confirm supplied clinic rows and restricted commercial values are absent from
  render and print models.
- Confirm two-to-five-candidate limits, selection order, provenance, and
  comparability warnings.
- Validate candidate-review run schemas, allowed state transitions, tool
  allowlisting, maximum-step enforcement, evidence receipts, and activity
  traces.
- Confirm restricted values stay outside tool results, `null` stays missing,
  and public context remains non-scored.
- Confirm ambiguity pauses for review and confirm, reject, and leave-unresolved
  responses change only the process-local run.
- Confirm unsupported tools, invented output fields or numbers, and final-site
  decision language fail closed.
- Confirm `evaluateSite` is invoked only after deterministic prerequisites pass.

## Stage 2: Scenario validation

- Run the synthetic cases in `test-sites.md`.
- Review rank changes under bounded weight adjustments.
- Confirm hard constraints are separate from weighted preferences.
- Confirm qualitative evidence remains source-linked and unscored.

## Stage 3: Explanation validation

- Compare the AI brief with a deterministic template.
- Check every number and factual claim against the structured result.
- Measure unsupported claims and required edits.
- Test refusal behavior when evidence is missing.
- Compare model-selected tool actions with the deterministic permitted-tool
  baseline and record invalid-action and controlled-failure rates.

## Stage 4: Expert workflow review

With an authorized real-estate analyst:

- verify that the interface answers a real decision question;
- identify missing criteria and misleading comparisons;
- complete a three-candidate evidence comparison and locate the source behind
  one difference;
- distinguish missing evidence from unfavorable evidence;
- identify the unresolved owner for a trade-area and physical-site definition;
- print a brief and verify that restriction labels remain while restricted
  values remain absent;
- measure preparation and review time; and
- determine whether the workflow complements the existing internal plan.

## Stage 5: Retrospective data test

Only after approval:

- define the outcome and maturity window;
- create time-correct historical features;
- split by time or market to limit leakage;
- compare with current analyst or rules baselines; and
- document where historical performance is not comparable.

## Release gate

No production-data pilot until stages 1 through 4 pass and data governance approves the source path.
