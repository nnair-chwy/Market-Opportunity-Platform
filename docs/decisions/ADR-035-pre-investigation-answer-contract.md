# ADR-035: Define the final-answer contract before investigation

- Status: Proposed
- Date: 2026-08-17

## Context

The question-first workflow validates intent, geography, capability, evidence
gates, and an analyst-confirmed analysis brief. It does not yet define the
acceptance criteria for the final answer before investigation begins. Without
that boundary, an agent can retrieve relevant evidence while still producing
an answer that omits contrary evidence, hides an unmet domain question, cites
the wrong grain, or overstates what the available evidence permits.

PR #5 documents Clinic, Marketing, and Pricing evidence readiness. Documented
or workspace-visible evidence is not automatically approved or connected.
The next layer must use that domain knowledge without weakening the capability
registry, evidence-status, scoring, or human-approval boundaries.

## Decision

Every validated `EvaluationPlan` includes a deterministic, versioned
`AnswerContract` before investigation. The contract defines:

- the intended decision, users, geography, timeframe, and comparison cohort;
- the strongest permitted conclusion and fallback outcome;
- seven required answer sections: direct answer, evidence-backed findings,
  contrary evidence, uncertainty, missing evidence and approvals, sources and
  versions, and one permitted next action;
- shared claim rules for citations, structured numeric evidence, evidence
  status, nulls, conflicts, suppression, causality, and recommendation language;
- domain requirements for Clinic, Marketing, or Pricing; and
- deterministic completion criteria and prohibited conclusions.

The compiler distinguishes `connected`, `documented_not_approved`, `missing`,
and `not_applicable`. Reference documents and observed workspace access may
shape a research-needed answer but cannot satisfy an approved evidence gate.

The answer contract is visible at the existing human checkpoint and is
retained in the downloaded reviewable packet. It does not add an execution
operator, retrieve evidence, approve a source, or authorize an action.

## Consequences

- The agent knows what a useful answer must contain before selecting evidence
  or running analysis.
- Clinic, Marketing, and Pricing share one answer structure without sharing a
  universal score or collapsing their domain-specific validity questions.
- Blocked questions produce a useful research-needed or clarification answer
  instead of an unsupported recommendation.
- Changing answer requirements becomes a reviewable contract and test change,
  not an untracked prompt edit.
- Evaluation plan version advances from `1.0.0` to `1.1.0`.

## Alternatives considered

1. Add answer instructions only to the model prompt. Rejected because the
   requirements would be difficult to validate, version, display, and retain.
2. Treat the existing analysis brief as the final-answer contract. Rejected
   because it defines question, method, and considerations but not answer
   sections, claim rules, completion tests, or domain-specific failure modes.
3. Build separate Clinic, Marketing, and Pricing answer schemas. Rejected
   because shared safety and review behavior would drift across verticals.
4. Wait until after investigation to choose an answer format. Rejected because
   evidence selection and stopping behavior should be guided by the intended
   deliverable.

## Evidence references

- `SRC-001` through `SRC-032` as bounded in the source registry and agent
  data-source guide
- `CLM-001` through `CLM-048`
- `OQ-001` through `OQ-047`
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- PR #5, `Add governed Marketing and Pricing evidence-readiness contracts`
