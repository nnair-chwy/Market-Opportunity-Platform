# Pricing and Marketing evidence connection

Status: implemented for descriptive regional investigation; decision-level outcomes remain gated.

## Connected now

The evaluation plan persists an `evidenceSelection` receipt with the selected view, measure, derived dataset, upstream source IDs, selection reason, and evidence boundary. The investigator resolves that receipt against `data/approved/derived-map-signals/current.json` and records the snapshot and transformation version used.

Four Marketing views now run against the approved matched-postal Google Ads snapshot: clicks, impressions, click-through rate, and average cost per click. Four Pricing views now run against the approved monitored-offer snapshot: competitor availability, observed equalized offer price, offer-observation volume, and observed assortment breadth.

Each operator returns exact values, within-snapshot percentile ranges, source IDs, limitations, rejected interpretations, and the evidence needed next. Percentiles describe the selected measure; they are not attractiveness or opportunity scores. The result map fetches the same selected dataset, and the final-answer composer and downloadable audit appendix retain its receipts.

## Chewy economics now registered

`pricing_chewy_economics_daily_v1` is now a checked-in, checksum-verified national category snapshot derived from the approved PSE export. It compresses 13,359 manufacturer/category rows to eight top-level categories and retains no SKU, manufacturer, customer, order, address, or postal identifiers. It preserves Chewy price, competitor price, PSE/raw/modeled cost, discounts, shipping revenue, and elasticity as separate fields.

The current-day source contains no non-zero net-sales or units rows. The runtime contract therefore permits price/cost materiality context only and explicitly rejects calling it sales or outcome evidence.

They do not by themselves establish local profitability. A regional answer still needs a privacy-safe geography × time × category/SKU outcome aggregate with compatible orders, units, net sales, discounts, returns, fulfillment cost, and contribution definitions.

## Required next connections

1. Replace or augment the current-day national economics snapshot with a governed observation window that contains complete sales and units before drawing commercial-materiality conclusions.
2. Produce `pricing_chewy_geo_outcome_weekly_v1` before concluding that a competitor condition is locally material or recommending a regional price action. Its checked-in contract requires week × CBSA × category, 50-order minimum cells, suppression before export, no retained identifiers or postal codes, and explicit cost/contribution completeness.
3. Connect the other governed Google Ads exports—campaign/DMA performance, CVC postal rows, configured scope, and conversion semantics—rather than treating the retail matched-postal account as universal Marketing evidence.
4. Add a compatible Marketing business-outcome aggregate with orders, new customers, net sales, contribution, attribution window, and incrementality guardrails.
5. Register a versioned ZIP–DMA–CBSA relationship with coverage and ambiguity rules.
6. Move snapshot execution behind a server-side registry before adding larger datasets, so approved CSV-derived evidence does not inflate the browser bundle.

## Operating boundary

PricePulse is the precedent for question → reviewed SQL example → governed schema → Snowflake query → rendered/exported answer. This platform should add regional visualization, comparison, answer-contract coverage, and a reviewable action packet without duplicating PricePulse or autonomously changing price, campaign, or budget.
