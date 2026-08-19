# Zeus UI pricing contract

Use this contract before opening a Zeus export. The local CSVs are internal,
sanitized, ignored by Git, and approved only for source discovery and shadow
evaluation. They do not authorize a price change or production scoring.

## Local snapshot

The 2026-08-18 files live under:

```text
data/approved/zeus-ui/2026-08-18/sanitized/
```

Read `export-manifest.json` first. The matching local `manifest.json` records
the same row counts, hashes, sanitization, and limitations beside the files.

## Which file to use

| Question | File | Grain | Appropriate use |
| --- | --- | --- | --- |
| Current product-level pricing and economic context | `zeus-ui_product-pricing-state_by-us-sku-current-day_2026-08-18.csv` | current snapshot × SKU | Shadow prioritization, economic guardrails, catalog segmentation, and comparison with Snowflake pricing evidence |
| Current regular exceptions awaiting review | `zeus-ui_pricing-exceptions_by-us-sku-current-state_2026-08-18.csv` | current exception × SKU | Review-queue context, reason-code analysis, and suggested-versus-current price diagnostics |

The product snapshot adds hierarchy, national business materiality, current
price architecture, PSE cost/margin, driver, and MAP-control context. The
exception snapshot adds price-lock state, current/new prices and margins,
deltas, suggested driver, and suggested reason.

## Join and use rules

1. Join exact `SKU` to the Snowflake `PRODUCT_PART_NUMBER` spine only after
   measuring unmatched rows.
2. Preserve the 2026-08-18 snapshot date; current state is not history.
3. Keep ZIP and competitor observations upstream of Zeus. Zeus is national
   SKU context and does not localize demand or profitability.
4. Treat suggested prices as review inputs. Never emit an automatic action.
5. Report the product export's 250,000-row cap against 313,351 UI entries.
6. Never restore or export `Category Owner`; employee-identifying values are
   outside the project contract.

## What remains missing

- The exception file is a five-row `REGULAR` current-state view, not complete
  exception history, decision history, or reviewer outcome history.
- Zeus does not supply destination geography or a stable experiment
  control/treatment label in these exports.
- Effective policy/guardrail definitions and operating-state timestamps are
  present only as current product fields, not a versioned policy history.
- Data-owner reuse approval remains unresolved.

For prior override state, Snowflake discovery identified
`CHEWYBI.DREAM_WEAVER_OVERRIDES` and `CHEWYBI.DREAM_WEAVER_LATEST_OVERRIDES`.
Use `../pricing-snowflake/queries/11_pricing-controls-and-match-discovery.sql`
to profile them without selecting `CREATED_BY` or payload values.
