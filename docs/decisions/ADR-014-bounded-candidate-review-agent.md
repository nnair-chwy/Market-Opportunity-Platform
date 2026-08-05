# ADR-014: Bounded Candidate Review Agent

- Status: Accepted
- Date: 2026-07-31

## Context

Ask AI can explain selected structured context, but it does not prepare a
candidate through a visible evidence workflow. `SRC-017` also contains one
one-to-many relationship that cannot be resolved safely by choosing the first
record. The candidate evidence brief is deterministic and non-scored, while
the existing scoring engine accepts only its separate validated contracts.

## Decision

Add one server-side Candidate Review Agent with a strict eight-tool limit. The
model selects only from the application-provided permitted-tool set. The
application supplies arguments, validates every action and result, controls
state transitions, and decides whether deterministic evaluation is allowed.

Keep state in a process-local prototype store and label it non-durable. Pause
on ambiguous trade-area relationships and require an explicit Confirm, Reject,
or Leave unresolved response. Store the response as a run-local receipt and do
not modify `SRC-017`.

Reuse the deterministic readiness, evidence brief, raw comparison, public
market context, market prerequisite, and scoring functions. Keep public context
and `SRC-017` evidence non-scored. Call `evaluateSite` only when a separate
validated scoring input and configuration pass prerequisites. Use server-only
OpenAI credentials and `store: false`. Fail closed when model access or a
supported action is unavailable.

## Alternatives considered

- Extend chat with more prompts: rejected because it would not provide visible
  state, tool activity, approval, or prerequisite enforcement.
- Let the model construct scoring inputs: rejected because it could silently
  reinterpret descriptive evidence or change deterministic policy.
- Persist runs in a browser or database now: deferred until retention, access,
  and approval authority in `OQ-026` and `OQ-027` are resolved.
- Create multiple specialized agents: rejected because one bounded workflow is
  sufficient for the prototype.

## Consequences

- Analysts can see how evidence is gathered and where human review is required.
- The one-to-many relationship remains unresolved until an analyst acts.
- Restarting or moving between runtime instances may lose a run.
- Current Esri demo candidates produce a useful draft packet but remain blocked
  from deterministic evaluation without an approved scoring contract.
- Production use still requires ownership, persistence, authorization,
  monitoring, and source-governance decisions.

## Evidence

- `SRC-014`
- `SRC-015`
- `SRC-016`
- `SRC-017`
- `CLM-017`
- `CLM-029`
- `CLM-030`
- `CLM-031`
