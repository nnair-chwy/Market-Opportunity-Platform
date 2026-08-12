# ADR-020: Deterministic ecosystem ActionPacket

- Status: Proposed
- Date: 2026-08-06

## Context

The initial synthetic ecosystem playbook detected four threshold conditions and
then told a human to open an investigation. The fixture did not represent the
event identity, location, verification record, operational readiness, explicit
conditions, ordered work, deadline, or measurable outcome. Generated copy
restated the trigger instead of preparing the analysis.

The demonstration now needs to show how a sector playbook can turn validated
fictional evidence into a specific prepared course of action. The user does not
want a human validation or approval stage in this synthetic ecosystem workflow.

## Decision

Add typed ecosystem context observations alongside numeric signal events.
Separate a reported closure from verification and permanence. Deterministic
application code assembles a versioned ActionPacket with one of three
dispositions: `advance`, `stop`, or `blocked`.

The packet owns the fictional situation, synthetic accountable owner,
calculated deadline, completed analysis, blockers, ordered actions, advance and
stop conditions, measurable outcome, guardrails, assumptions, provenance, and
versions. Known contradictions stop the plan; missing required evidence blocks
it; all configured conditions passing advances it.

The ecosystem path does not call the human-review endpoint. It may create
simulated Outlook and Slack previews directly from the packet without changing
the prepared disposition. This exception does not apply to Marketing, Pet
Health, clinic evaluation, real-estate decisions, or any production action.

OpenAI may convert the validated packet into concise wording through structured
output with `store: false`. It cannot alter packet policy. Missing configuration,
timeouts, provider failures, invalid structures, changed sources, altered
actions, or invented numeric values fail softly to deterministic wording.

## Alternatives considered

1. Add more hardcoded prose to the existing opportunity draft. Rejected because
   prose would continue to duplicate the trigger without representing analysis.
2. Let the model assemble the packet. Rejected because evidence classification,
   conditions, deadlines, and dispositions must remain deterministic and
   testable.
3. Require a human validation approval before creating the packet. Rejected for
   this bounded synthetic ecosystem workflow at the user's direction.
4. Automatically execute the course of action. Rejected because the prototype
   has no production data, authority, connectors, or approved operating policy.

## Consequences

- The ecosystem card delivers a prepared, source-linked course of action rather
  than an open-ended investigation request.
- Fictional strings, dates, booleans, and numeric checks retain typed provenance
  instead of being forced into numeric metrics.
- The demonstration exposes blockers and contradictions without imputation.
- AI failure cannot remove or change the deterministic packet.
- Simulated communication does not imply that a message or business action ran.
- Production use still requires approved sources, thresholds, owners,
  persistence, access controls, monitoring, execution authority, and evaluation.
- This proposed ADR and related documentation require user review before commit.

## Evidence references

- `docs/strategy/opportunity-inbox-implementation-plan.md`
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `docs/product/open-questions.md`
