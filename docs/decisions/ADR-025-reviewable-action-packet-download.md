# ADR-025: Review-page draft action packet download and AI summary

## Status

Proposed. Pending repository owner review.

Date proposed: 2026-08-12.

## Context

The decision-review panel needed a single reviewable next-action packet rather
than competing packet choices, plus a browser-local handoff and a bounded AI
restatement of the validated structured result.

## Decision

Present one draft action packet on the review page: header, downloadable packet,
then an AI findings and proposal summary. The download uses the structured
`reviewable-action-packet-v1` shape rendered as local markdown through a
browser object URL. It includes provenance metadata and states that download is
not approval or execution and that no external message is sent.

AI may summarize only the validated plan and packet context into four draft
points. Deterministic fallback summary remains available when the model is
absent or fails validation. AI cannot invent facts, alter scores or weights,
add geographies, or make a final real-estate decision.

## Consequences

- Packet-scoped Ask AI chat is removed from the review right panel in favor of
  the structured findings summary.
- Findings language names one proposed action instead of counting competing
  action paths.
- Saved browser-local packets remain unchanged.

## Alternatives considered

1. Keep competing action selection on the review panel. Rejected because the
   handoff should present one accountable draft packet.
2. Email or Slack the packet. Rejected because this prototype must not send
   external messages or imply execution.
3. Rely only on interactive Ask AI. Rejected because the review handoff needs a
   fixed, reviewable summary shape with deterministic fallback.

## Evidence references

- `docs/technical/ai-boundaries.md`
- `docs/technical/data-contracts.md`
- `lib/planning/reviewable-packet.ts`
- `tests/reviewable-action-packet.test.ts`
- `tests/question-first-routing-rendered.test.mjs`
