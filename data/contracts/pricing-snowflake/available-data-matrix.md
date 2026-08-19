# Snowflake Pricing data: available evidence and remaining needs

Validated on 2026-08-17 with role `DBT_DEMO_DEVELOPER`, warehouse `OTH_WH`,
and database `EDLDB`. Raw CSVs are local, ignored by Git, and limited to
internal shadow evaluation and source validation.

## Exported datasets

| Dataset | Rows | What it helps answer | What it cannot answer alone |
| --- | ---: | --- | --- |
| Latest competitor offer by ZIP, competitor, and SKU (30 days) | 831,917 | Which competitors carry a SKU in a monitored ZIP; observed price, in-cart price, coupon, equalized price, availability, and freshness | Total market demand, complete national coverage, causal price response, or Chewy profitability |
| Competitor pricing by ZIP, competitor, and category (30 days) | 5,586 | Which markets/categories have broad competitor assortment, price pressure, coupons, or availability gaps | A site score without geographic crosswalks, first-party outcomes, and coverage controls |
| Current U.S. PSE pricing economics by SKU | 238,692 | Chewy price position, cost alternatives, sales, units, discounts, shipping revenue, elasticity, strategy, and price driver | Destination-specific cost-to-serve or local demand |
| Current U.S. PSE pricing economics by category/manufacturer | 13,359 | Category-level price/cost pressure and business materiality for triage | Local market opportunity unless joined to ZIP-level competitor and market evidence |
| Active U.S. product catalog spine | 365,398 | Stable SKU joins; category, brand/manufacturer, pet type, lifecycle, ratings, package, Rx/food, and CVC flags | Performance or market demand |
| Chewy price history by SKU (90 days) | 216,380 | Price movement, current price, suggested/MAP/list context, price drivers, and MAP-break history | Local competitor conditions or realized demand response |
| Pharmacy merchandising performance by SKU (90 days) | 546,987 | Sales, units, autoship mix, discounts, returns, PDP funnel, margins, contribution, and new-customer materiality | Customer geography; never allocate these national SKU totals to ZIPs |
| Zeus current product state (2026-08-18) | 250,000 | Current SKU hierarchy, national demand/materiality, inventory, price architecture, PSE cost/margin, MAP, and driver context | Complete catalog coverage (313,351 UI entries), local demand/profit, history, or action authority |
| Zeus current regular exception queue (2026-08-18) | 5 | Current review reason, suggested-versus-current price, driver, MAP and margin context | Exception history, decision outcome, reviewer history, or a pricing instruction |

## How the evaluator should join them

1. Use `PRODUCT_PART_NUMBER` to join competitor offers, PSE economics, product
   catalog, Chewy price history, and merchandising performance.
2. Preserve the competitor `ZIP_CODE` as text. A crosswalk is optional while a
   pilot stays at ZIP grain; add one only when comparing the same evidence with
   Google Ads DMA, CBSA, or trade-area data.
3. Aggregate SKU evidence to a reviewed product category only after measuring
   competitor and PSE join coverage.
4. Use Google Ads matched DMA/postal evidence as a separate market-response
   signal. Do not treat advertising response as organic demand.
5. Use SEO keywords for national intent/category discovery until a geographic
   rank or search-volume export is supplied.
6. Produce recommendations as investigations or controlled tests with margin,
   availability, volume, and rollback guardrails—not automatic price changes.

## Exact access and permission status

| Snowflake object or path | Current status | Why it matters | Exact unblock needed |
| --- | --- | --- | --- |
| `CHEWYBI.PRICE_COMPETITOR_BUNGEE_TECH_HISTORY` | Visible view; queried and exported | Local competitor price, availability, coupon, and assortment evidence | Confirm owner, refresh SLA, representative-ZIP method, availability codes, and approved reuse |
| `PRICING_ANALYTICS_MSS_SANDBOX.PRICING_SELF_SERVICE_DASHBOARD` | Visible base table; queried and exported | SKU price, cost, sales, margin context, and elasticity | Confirm production replacement/ownership, cost definitions, historical restatement, and observed-versus-modeled elasticity |
| `CHEWYBI.PRODUCTS` | Visible view; queried and exported | SKU/category/product spine | Confirm canonical current-row rule and lifecycle semantics |
| `CHEWYBI.PRICE_CHEWY_HISTORY` | Visible view; queried and exported | Chewy price-change and driver history | Confirm price-driver definitions and which timestamps define an effective price |
| `MRCH.MERCH_PERFORMANCE_SNAPSHOT_PHARMACY` | Visible view; queried and exported | SKU business materiality and contribution context | Confirm scope: Pharmacy-only versus broader assortment, currency treatment, and refresh/finality |
| `ECOM.ORDER_LINE` | Visible view; schema only | Contains realized cost, adjustment, margin, and contribution fields | **Later, not a Pricing-pilot blocker.** If local demand/profit becomes a goal, publish a privacy-safe week × geography × category view; never export identifiers |
| `CHEWYBI.ORDER_LINE_COST_MEASURES` | Confirmed in Phoenix MSO SQL | Curated orders and contribution margin by date/category/channel | **Marketing/enterprise outcome source, not required for competitor-price monitoring.** Validate access and definitions only when that use case is selected |
| `CHEWYBI.ORDER_LINE_COST_MEASURES_PHARMACY` | Listed by the Pricing onboarding guide as a Vertica table; failed Snowflake lookup is inconclusive | Possible legacy Pharmacy cost source | **Not needed now.** PSE and merch exports already provide initial economics; ask for a governed replacement only if Pharmacy-specific reconciliation is required |
| `MKT_SOLUTIONS_SANDBOX.BIDCOIN_METRICS_ATTRIBUTION` | Documented CCP/Bidcoin marketing source; not visible in the tested role | Connects media attribution to contribution profit | **Not needed for Pricing.** Request it only for paid-media/local-growth evaluation and document the 2024 coverage bias |
| `PDM.PROMOTION`, `CDM.ORDER_PROMOTION_USAGE`, `CDM.ORDER_LINE_PROMOTION_USAGE`, and `CDM.CUSTOMER_PROMOTION_USAGE` | All four correct objects are visible to the tested role | Promotion definition, eligibility, redemption, and SKU/order usage | **Optional for the first pilot.** Profile and join only when the recommendation needs to distinguish base-price effects from promotion effects |
| Destination geography for orders | No approved field/view found in `ECOM.ORDER_LINE` | Lets us test local customer demand and profit rather than only local competitor conditions | **Later.** Needed only before making regional demand/profit or differentiated-pricing claims; request an aggregate, never customer/address rows |
| ZIP-to-DMA/CBSA/trade-area crosswalk | Documented Marketing sources include Nielsen DMA/ZIP mappings | Translates Pricing ZIPs to Google Ads DMA or other market definitions | **Later.** Not needed for a ZIP-level pilot; use the MSO-maintained mapping when cross-channel analysis begins |
| `PRICING_ANALYTICS_MSS_SANDBOX.DAILY_COMPETITOR_COVERAGE_SNAPSHOT` | Visible and profiled; latest date 2026-08-17; 16,587,279 BT rows and 177,518 SKUs in the last 30 days | Curated current/history competitor coverage, price, availability, coupon, MAP, and buy-box evidence | Use as the agent-facing daily competitor state; retain raw Bungee history for ZIP-level traceability and median reconstruction |
| `PRICING_ANALYTICS_MSS_SANDBOX.PRICING_LABS_RESULTS_SUMMARY` | Visible and profiled; latest experiment start 2026-08-12; 1,317,316 rows and 88,117 SKUs in the last 730 days | Opportunity Raise cohorts, match rate, stickiness, exposure, and historical outcomes | Use as observed evaluation labels; do not interpret association as causal lift outside each experiment design |
| `PRICING_ANALYTICS_MSS_SANDBOX.OFFER_PULSING_STATS` | Visible and profiled; latest start 2026-08-17; 44,991 rows and 21,124 SKUs in the last 730 days | Offer-pulsing rounds, success rate, category, and SKU participation | Use as an alternative-action outcome source and avoid overlapping active interventions |
| `CHEWYBI.DREAM_WEAVER_OVERRIDES` and `CHEWYBI.DREAM_WEAVER_LATEST_OVERRIDES` | Visible; 1,623,421 history rows (~11,137 IDs) and 12 latest rows on 2026-08-18 | Prior/current override screening before treating a condition as untreated | Confirm payload/effective-time/deletion semantics; never export `CREATED_BY` or payload values into the project |
| `CHEWYBI.COMPETITOR_MATCH_BUNGEE` | Visible; 24,095,886 rows (~487,753 match IDs), latest match time 2026-02-03 12:28 | Active-state and timestamp context for match-configuration review | No reliability score or reviewer outcome is visible; active state is not proof of match quality |
| `PRICING_ANALYTICS_SANDBOX.PRODUCTS_UNIT_OF_MEASURE` | Not visible in the tested role | Package/UOM price equalization | Optional. Existing Bungee fields already include equalized price, total size, UOM, and package quantity; request only when those fields fail validation |
| `Chewy-Inc/phoenix-llm` Pricing and adjacent chatbot SQL | Inspected through signed-in GitHub on 2026-08-17 | Shows the curated sources and definitions agents already rely on | Incorporate the sources above; GitHub access is no longer a blocker |

## What must be resolved now versus later

For the first regional competitor-monitoring pilot, do **not** start with a
broad permission request. The exact sources, availability codes, regional ZIP
rotation, median-of-five logic, and historical experiment outcomes are now
documented and observable. Treat a Pricing owner as an approval/escalation path,
not a prerequisite for discovery or shadow evaluation.

The remaining work is empirical: build the joined recommendation mart, measure
coverage and freshness, backtest candidate rules against Pricing Labs/Offer
Pulsing outcomes, and evaluate recommendations with explicit guardrails.

Only if the selected recommendation requires local customer demand or profit,
request a privacy-safe aggregate with these minimum fields:

- week or day;
- destination ZIP, DMA, CBSA, or approved trade-area ID;
- reviewed product category and optional SKU only when allowed;
- orders, units, net sales, discounts, returns/refunds;
- product cost, fulfillment/shipping cost, and contribution margin;
- suppression flag/count threshold;
- source freshness, currency, and finalized-period indicator.

That later aggregate closes a different question: whether a local competitor
signal corresponds to meaningful Chewy demand and profit in the same market.
It is not required to identify and triage competitor price, availability,
coupon, or assortment anomalies.
