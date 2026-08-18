# Answer-contract evaluation cases

These cases validate that a useful answer is defined before investigation and
that the shared structure retains the correct domain boundary. They are
versioned `synthetic_regression` fixtures, not analyst-approved historical
cases.

| Case | Question | Expected answer contract |
| --- | --- | --- |
| AC-001 | Describe Dallas population context | `description`; public context only; all seven answer sections; no opportunity recommendation |
| AC-002 | Compare two named metros for CVC investigation | `comparison` or `investigation`; demand/outcome, access/capacity, veterinary supply/feasibility, and human-review requirements |
| AC-003 | Which DMA should receive more paid-search spend? | `research_needed` while the capability is planned; campaign cohort, geography semantics, first-party outcome, and incrementality requirements; no spend authorization |
| AC-004 | Where should Chewy change regional prices? | Pricing requirements for competitor condition, Chewy economics, geographic customer outcome, and test authority; no price authorization |
| AC-005 | What should we do next? | `clarification`; request the decision, geography, cohort, timeframe, or output before investigation |

For every case:

- `documented_not_approved` must not be presented as `connected`;
- factual claims require source IDs;
- numeric claims must resolve to permitted structured evidence;
- contrary evidence, uncertainty, and missing evidence remain required;
- the strongest permitted conclusion must match capability and approval state;
- the packet must retain the same answer-contract version and content; and
- no contract may create a score, approval receipt, source connection, or
  external action.
- post-investigation coverage must classify every required section and domain
  requirement as `covered`, `unsupported`, `blocked`, or `not_applicable`;
- the final composer must emit all seven sections and explicitly label
  unsupported or blocked portions; and
- a fixture may be relabeled `analyst_approved_historical` only after an
  accountable analyst approves the question, expected contract, and expected
  conclusion.
