# Pricing Snowflake evidence contract

This directory tells an agent where to look before proposing a Pricing
evaluation. `source-catalog.json` separates visible tables from optional gaps,
records grain and limitations, and gives every intended export a stable
descriptive name. `validation-profile.json` records what was actually observed
in bounded Snowflake checks; it is evidence about access and shape, not a
production dataset.

For a concise inventory of exported files, uses, gaps, and exact access asks,
read `available-data-matrix.md`. Machine-readable row counts, hashes, grains,
and query mappings are in `export-manifest.json`.

Actual Snowflake exports belong under the ignored local path:

```text
data/approved/snowflake/pricing/<snapshot-date>/raw/
```

No pricing CSV is checked in. Table documentation and a sample SQL statement do
not establish workspace access or repository approval.

The minimized, checksum-verified national category snapshot is checked in at
`data/approved/pricing-economics/current.json` and registered as
`pricing_chewy_economics_daily_v1`. It retains eight top-level merchandise
categories from 13,359 source rows and removes SKU, manufacturer, customer,
order, address, and postal identifiers. Its current-day export has no non-zero
net-sales rows, so it is price/cost context only—not sales, regional outcome, or
local-profitability evidence.

## Recommended extraction order

1. Competitor price, availability, coupon, and equalized price by ZIP, SKU,
   competitor, and date.
2. U.S. PSE pricing economics by SKU and date, keeping PSE cost, raw product
   cost, modeled product cost, and shipping revenue separate.
3. Product hierarchy and lifecycle by SKU.
4. Chewy price history and price driver by SKU and date after schema validation.
5. SKU exposure and sales for materiality, without pretending national SKU
   performance is local demand.
6. Phoenix's curated competitor snapshot and Pricing experiment-result tables.
7. A privacy-safe order-line profitability aggregate only if the selected use
   case requires local demand/profit claims.
8. Monthly SKU elasticity only as a Pricing Science input; it is not geographic
   evidence and requires owner validation.

Run the schema-discovery queries before expanding any `SELECT`. Never copy
`EDLDB.ECOM.ORDER_LINE.*` into the workspace.

## How an evaluator should bridge the sources

Use `PRODUCT_PART_NUMBER` as the product spine and preserve dates before any
aggregation. The competitor feed adds local price and availability at ZIP
grain. The PSE view adds product economics but is not geographic. Join ZIP to a
versioned ZIP-to-DMA/CBSA/trade-area crosswalk, then aggregate only after the
decision geography is chosen. Google Ads can add market response at DMA or
postal grain; SEO keyword exports remain national unless a location field or a
separate geographic rank export is supplied.

Recommended feature families for shadow evaluation are competitor price index
(prefer `EQUALIZED_PRICE` when valid), competitor availability breadth, coupon
presence, local assortment gaps, Chewy-versus-competitor price gaps, and
economics-weighted opportunity. Do not interpret these as causal demand or
automatically recommend a price change.

## 2026-08-17 validation result

- Snowflake worksheet access is connected under a read-oriented developer role.
- Competitor history, Chewy price history, products, order line, Pharmacy merch
  performance, and the PSE dashboard were visible.
- The competitor schema exposes 53 columns, including ZIP, median/regional
  pricing, package equalization, fulfillment, match type, availability, coupon,
  and offer dates.
- A recent 30-day bounded query returned populated ZIP rows. Its first 1,000
  rows covered 11 ZIPs and 966 SKUs but were overwhelmingly Walmart, so it is a
  connectivity fixture rather than a coverage estimate.
- The PSE schema exposes 151 columns. A current-day 1,000-row check returned
  both U.S. and Canada rows; production extraction must filter `COUNTRY = 'USA'`.
- Phoenix's curated competitor snapshot, Pricing Labs results, Offer Pulsing
  results, general order-line cost measures, singular promotion view, and three
  CDM promotion-usage views were visible to the tested role.
- The 30-day curated BT competitor profile contained 16,587,279 rows across
  177,518 SKUs and was current through 2026-08-17. The 730-day Pricing Labs and
  Offer Pulsing profiles were also current and populated.
- Three earlier lookups failed, but they are not three Pricing permission
  blockers: the Pharmacy source is documented as Vertica, Bidcoin is optional
  Marketing attribution, and Phoenix uses `PDM.PROMOTION` rather than the tested
  plural name.

Local validation and model-preparation files are descriptively named under
`data/approved/snowflake/pricing/2026-08-17/raw/` and remain ignored by Git.

Regional Chewy outcomes must validate against
`regionalPricingOutcomeSnapshotSchema` before use. The contract requires week ×
CBSA × top-level category aggregates, at least 50 distinct orders per retained
cell, no direct identifiers or postal codes, and explicit completeness states
for cost and contribution. No approved regional output is registered yet:
`ORDER_LINE` exposes economics and a sensitive `CUSTOMER_ADDRESS_ID`, but the
current discovery artifacts do not identify an approved destination-geography
join. Local profitability therefore remains blocked instead of being inferred
from national economics or fulfillment `SITE_ID`.
