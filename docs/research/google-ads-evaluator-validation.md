# Google Ads evaluator validation

## Outcome

The current evaluation system is safe for Google Ads question routing after a
small contract update, but it is not yet a Google Ads numerical evaluator. It
now recognizes explicit Google Ads and paid-search language, routes those
questions to the Marketing `local_growth_test` capability, and stops before
scoring or recommending a spend change.

The validation used the local 30-day `SRC-018` matched-location exports only as
workspace evidence. No raw account rows or values were copied into Git.

## Data characteristics exercised

The validation cases reflect the observed export shapes documented in
`google-ads-export-manifest.md`:

- Main retail and Pharmacy DMA-by-campaign exports have broad DMA coverage and
  are suitable for descriptive cohort and concentration checks.
- Postal exports provide finer drill-down, but outcome density varies sharply
  by account. Thin health, telehealth, and subscription rows cannot support
  ZIP ranking merely because they are more granular.
- Conversion-action segmented downloads lose most base performance fields, so
  they can describe outcome vocabulary or distribution but cannot supply
  efficiency denominators alone.
- The UI files do not establish physical presence, customer residence, a
  stable geo-target ID, or a licensed DMA-to-CBSA relationship.
- A single 30-day snapshot does not establish persistence, seasonality,
  incrementality, or a valid test/control pre-period.

## Regression scenarios

| Scenario | Expected evaluator behavior | Result |
| --- | --- | --- |
| Ask which U.S. DMAs show promising Google Ads demand or efficiency | Route to Marketing local growth; keep the result blocked | Pass |
| Ask where to increase spend from matched-location conversions | Do not emit a spend recommendation or score | Pass |
| Compare Phoenix and Seattle as Google Ads geo-test markets | Resolve the named CBSA context, but keep evaluation blocked because DMA and CBSA are not equivalent | Pass |
| Supply only an asserted campaign-aggregate evidence ID | Keep first-party outcome, taxonomy, geography, attribution/lag, experiment design, and approval gaps visible | Pass |
| Assert every evidence and approval ID while the capability remains planned | Return unsupported rather than silently creating a connection | Pass |

## Defects found and corrected

1. `Google Ads` and `paid search` did not reliably trigger the Marketing route
   unless the question also contained words such as `campaign` or `marketing`.
2. A planned or unavailable capability collected missing evidence but skipped
   its approval blockers. Supplying an evidence ID could therefore produce an
   incomplete explanation.
3. National Marketing cohort inference could retain an irrelevant default
   Census population measure. It now uses `none` until a governed Marketing
   measure is selected.
4. Marketing perspective metadata still pointed mainly to the launch playbook.
   It now references the Google validation exports, documented DMA path,
   first-party outcome analysis, and campaign taxonomy while remaining
   evidence-needed and non-scored.

## What the evaluator correctly does now

- It treats the raw Google UI exports as workspace validation evidence, not an
  approved production input.
- It separates a useful exploratory market lead from an executable growth-test
  measurement.
- It exposes the required weekly DMA aggregate, first-party regional outcome,
  campaign taxonomy and cohort, versioned DMA-to-market relationship,
  conversion/attribution/lag contract, geo-experiment design, and accountable
  measurement approval.
- It does not calculate a universal Marketing score, infer causal lift, or
  recommend increasing or decreasing spend.

## Remaining validation gap

This pass validates routing, evidence gates, approval gates, and recommendation
boundaries. It does **not** validate numerical signal quality because the
product has no typed Google Ads adapter, approved weekly DMA panel, source
refresh contract, or first-party outcome join.

The next useful validation should be a three-to-five-case shadow evaluation at
DMA grain after OQ-033 through OQ-040 are resolved. For each historical case,
compare a deterministic descriptive baseline against the decision that was
actually made and the lag-complete first-party outcome. Postal evidence should
be shown only as a gated drill-down, with unresolved geography and minimum
volume visible. Only after that should the team test recommendation wording,
confidence bands, or learned models.

## Automated coverage

The regression coverage lives in:

- `tests/capability-registry.test.ts`
- `tests/evaluation-planning.test.ts`
- `tests/perspectives.test.ts`

The tests verify that evidence assertions cannot activate a planned capability
and that Google Ads questions never fall through to a scored Census-only plan.
