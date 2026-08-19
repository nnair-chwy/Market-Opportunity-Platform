# Golden-question evidence snapshot

This package governs the smallest checked-in aggregate needed to reproduce the
Thursday evidence review. It does not add a runtime recommendation, UI route,
score, or action authority.

`data/approved/golden-question-evidence/current.json` contains four
deterministically screened investigation leads:

- two Marketing CBSA response leads;
- one Pricing CBSA monitoring lead; and
- one CVC supplied-trade-area contrast lead.

The Pricing response also carries national Zeus current-state context: exported
product coverage and the current REGULAR exception count. Those fields help
review operational relevance and data coverage, but have no destination
geography, decision history, scoring eligibility, or price-action authority.

The build reads only checked-in aggregate artifacts. It never reads customer,
address, order, employee, or raw postal records. Candidate selection rules,
cohort diagnostics, dates, geography methods, source snapshot IDs, null-related
limitations, and allowed-use limits are embedded in the output.

Reproduce the checked-in bytes with:

```bash
GOLDEN_QUESTION_EVIDENCE_GENERATED_AT=2026-08-18T20:57:36.861Z \
  node --experimental-strip-types scripts/build-golden-question-evidence.ts
```

Run without the environment variable for a newly timestamped local build. The
output remains `internal_shadow_evaluation_only`, has no scoring eligibility,
and supports an investigation packet only.
