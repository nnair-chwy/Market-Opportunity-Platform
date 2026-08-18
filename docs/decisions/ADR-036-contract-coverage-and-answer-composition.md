# ADR-036: Enforce answer-contract coverage before composition

- Status: Proposed
- Date: 2026-08-17

## Context

ADR-035 defines a useful final answer before investigation. A pre-investigation
contract alone cannot prove that the investigation covered every promised
section or domain requirement. It also cannot prevent a later summary from
silently omitting an unmet requirement.

## Decision

Add a deterministic answer lifecycle after the validated `AnswerContract`:

1. Versioned Clinic, Marketing, and Pricing domain packs provide reviewed
   vocabulary, evidence questions, source candidates, bounded conclusions, and
   examples.
2. A semantic validator checks plan identity, perspective, decision owner,
   decision, unit of analysis, evidence requirements, reviewed domain-pack
   membership, completion tests, and conclusion authority.
3. An investigation-coverage checker maps every required answer section and
   domain requirement to `covered`, `unsupported`, `blocked`, or
   `not_applicable`, with source and investigation-lead references.
4. A deterministic composer fills all seven answer sections. Unsupported and
   blocked content remains explicit; the composer cannot upgrade the strongest
   supported conclusion.
5. A schema-constrained AI framing proposal may emphasize reviewed requirement
   IDs and ask unresolved questions. Deterministic code preserves the canonical
   decision restatement, filters invented IDs, and owns the final contract.
6. Versioned regression fixtures compare generated answer mode, requirements,
   fallback, final status, and prohibited-conclusion boundary. Current fixtures
   are synthetic regressions, not analyst-approved historical evidence.
7. A screening signal does not satisfy the evidence-findings section. It may
   still support a direct answer that says the requested decision conclusion is
   not yet available.
8. The post-confirmation evidence graph renders the actual investigation path,
   including completed, waiting-for-evidence, and not-run stages. A bounded
   synthesis tile may complete even when upstream stages are blocked, but it
   must report that blocked conclusion rather than imply those stages ran.
9. A question may execute a registered multi-source bundle instead of the
   selected map measure alone. The paid-search efficiency bundle joins cost,
   delivery, response, attributed conversion, and public CBSA context with
   explicit numerators, denominators, periods, and geography rules. Candidate
   ordering is lexicographic and visible; no hidden composite score is created.
10. Coarser evidence may be attached only as visibly coarser context. The
    restored state dog-ownership survey is shown for single-state CBSAs, is
    omitted for multi-state CBSAs, and never participates in lead selection or
    a derived metro pet-demand score.

The reviewable packet retains the original contract, coverage report, and
contract-complete draft answer as separate structured artifacts. The decision
brief is a short decision-facing projection of that record; full contract,
method, coverage, and JSON detail stays in the audit appendix.

## Consequences

- A useful finding cannot make an incomplete domain promise appear complete.
- Documented-but-unapproved evidence remains blocked even when its source ID is
  visible to the workspace.
- The final answer always states unsupported portions instead of silently
  dropping them.
- A visible outlier cannot be labeled an evidence-backed finding merely because
  it produced a regional lead.
- The animation cannot visually mark a missing validation stage complete.
- AI can help frame attention but cannot add evidence, requirements, authority,
  or a stronger conclusion.
- Historical effectiveness evaluation remains blocked until analysts supply
  and approve representative cases and expected conclusions.

## Alternatives considered

1. Let the final-answer prompt decide coverage. Rejected because prompt-only
   coverage is not deterministic, independently testable, or auditable.
2. Mark a whole answer supported when any finding exists. Rejected because
   public context can coexist with missing business outcomes and approvals.
3. Allow the model to emit a replacement `AnswerContract`. Rejected because it
   could weaken reviewed requirements or invent authority.
4. Treat synthetic regression cases as historical validation. Rejected because
   analyst approval and observed outcomes have not been supplied.

## Evidence references

- `SRC-001` through `SRC-032` under their registry limitations
- `CLM-001` through `CLM-048`
- `OQ-001` through `OQ-047`
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- ADR-029
