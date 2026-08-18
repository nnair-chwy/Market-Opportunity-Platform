# ADR-033: Build evidence-backed answers and durable review packets

## Status

Proposed for repository-owner review.

Date proposed: 2026-08-17.

## Context

Question routing and normalized evidence execution were available, but the
result packet still summarized the plan rather than the executed evidence.
Saved packets retained only enough information to replan the question, so a
later review could silently use changed planning behavior and lose the exact
evidence response.

## Decision

Add a versioned `packet-answer-v1` contract and
`reviewable-action-packet-v2`. Deterministic code builds the answer from the
executed evidence response before optional AI wording. Every fact retains its
metric, geography, value, unit, typed period, report scope, source ID, evidence
status, and warning. The packet also retains explicit limitations and one
query-specific proposed action with owner and approval state.

Add a typed evidence period with `date_range`, `as_of`, `calendar_year`,
`timeframe`, and `not_provided` states. Google Ads facts also retain report
scope and currency. Canonical metric precedence prevents duplicate source
representations from becoming duplicate answers.

The summary API accepts the validated plan, selected action, and executed
evidence response. AI may improve wording only after deterministic packet
assembly. Numeric validation rejects values that are absent from the packet,
and the deterministic answer remains the fallback.

Save `saved-action-packet-v2` with the exact plan, evidence execution,
`PacketAnswer`, packet summary, reviewable packet, and calculation versions.
Opening a v2 packet does not replan or rerun evidence. Legacy packets may be
reconstructed by the current deterministic planner only with an explicit
legacy notice.

## Consequences

- The first result shown is the answer supported by executed evidence.
- Downloaded and reopened packets use the same facts and versions.
- Source coverage reports presence and absence without becoming a quality or
  opportunity score.
- Market comparisons remain descriptive and do not name a winner unless a
  future approved query explicitly defines one.
- Growth screening remains a fixed, complete-case Hypothesis calculation.
- AI cannot create a number, source, action, approval, or geography absent from
  the validated packet.

## Alternatives considered

1. Continue summarizing only the plan. Rejected because the packet could sound
   complete without reporting any executed value.
2. Save only the original question and replan on open. Rejected because routing,
   evidence, and calculation versions can change.
3. Let AI select facts directly from raw rows. Rejected because fact selection,
   duplicate handling, periods, and numeric claims must remain deterministic.

## Evidence references

- `lib/planning/metric-catalog.ts`
- `lib/planning/execute-plan.ts`
- `lib/planning/reviewable-packet.ts`
- `lib/planning/packet-ai-summary.ts`
- `components/evidence/EvidenceBundlePanel.tsx`
- `components/decision-workflow/DecisionWorkflowApp.tsx`
- `tests/normalized-question-routing.test.ts`
- `tests/reviewable-action-packet.test.ts`
- `tests/evidence-bundle-rendered.test.mjs`
