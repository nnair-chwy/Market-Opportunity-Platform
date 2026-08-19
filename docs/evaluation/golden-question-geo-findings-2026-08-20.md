# Candidate geographic findings — 2026-08-20 review

All four findings are **investigation leads only**. There are zero findings
eligible for a price change, campaign-spend change, market selection, clinic
decision, or other material action. The concrete next actions below are safe
validation work.

## Evidence-strength ranking

1. **Marketing — strongest.** A common 30-day retail paid-search panel yields
   198 volume-gated metropolitan CBSAs and two response leads. It still lacks
   first-party outcomes and causal controls.
2. **Pricing — second.** Competitor monitoring, national Chewy economics,
   current Zeus context, price history, experiment sources, override history,
   and match state are discoverable. The Kankakee lead maps only one ZIP and no
   local Chewy outcome is connected.
3. **CVC — third.** A supplied trade-area contrast exists, but its observation
   date, construction method, clinic definition, and production reuse authority
   are unresolved.

## 1. Philadelphia paid-search response

- **Status:** Investigation lead only; not actionable as a spend decision.
- **Geography/cohort:** Philadelphia-Camden-Wilmington CBSA `37980` versus 198
  metropolitan CBSAs with at least 10,000 clicks, 500 configured conversions,
  and 10 mapped postal geographies.
- **Window:** 2026-07-14 through 2026-08-12.
- **Signal:** 301,307 clicks, 43,143.8 configured conversions, 14.32% configured
  conversion rate, and $0.87 CPC. Conversion rate is 1.16 percentage points
  above the 13.16% cohort median; CPC is $0.01 below the $0.88 median.
- **Corroborating evidence:** 322 mapped postal geographies and the largest
  configured-conversion count among candidates passing the same fixed screen.
- **Contrary evidence:** CTR is 1.55%, equal to the cohort median, so stronger
  downstream platform response is not corroborated by stronger click response.
- **Quality caveats:** Google conversion semantics, campaign/query/device mix,
  attribution lag, inventory, promotions, bids, budgets and auction conditions
  are uncontrolled. Postal-to-CBSA is an approximation; the snapshot captures
  93.6–93.9% of value depending on metric. No first-party order, new-customer,
  contribution or incremental outcome is attached.
- **Strongest permitted conclusion:** Philadelphia is worth validating against
  comparable first-party outcomes; the snapshot does not show incrementality or
  a reason to change spend.
- **Safe next action:** MSO / Marketing Measurement should build a frozen weekly
  DMA panel for the same campaigns with stable DMA IDs, governed taxonomy,
  first-party orders/new customers (or the approved outcome), lag/finality, and
  unresolved-geography counts.
- **KPI and stop rule:** Validate only if at least the owner-approved geography
  coverage threshold is met (proposed diagnostic: >=90%), outcome definitions
  are approved, and the above-median response persists in at least three of
  four weekly cuts after comparable-campaign controls. Stop if coverage fails,
  the first-party difference is absent, or auction/budget/promotion/inventory
  controls explain the gap.
- **Evidence needed for one higher authority level:** An approved weekly
  DMA × comparable campaign cohort first-party outcome snapshot, stable DMA and
  campaign IDs, taxonomy exclusions, attribution/lag/finality definitions,
  unmatched coverage, and intervention/auction controls. This would promote the
  statement from a platform-response lead to a first-party validation candidate,
  not to a spend recommendation.

## 2. San Antonio paid-search response

- **Status:** Investigation lead only; not actionable as a spend decision.
- **Geography/cohort:** San Antonio-New Braunfels CBSA `41700` versus the same
  198-CBSA metropolitan cohort.
- **Window:** 2026-07-14 through 2026-08-12.
- **Signal:** 78,949 clicks, 11,722.81 configured conversions, 14.85% configured
  conversion rate, and $0.86 CPC. Conversion rate is 1.69 percentage points
  above the cohort median; CPC is $0.02 below median.
- **Corroborating evidence:** 112 mapped postal geographies and a configured
  conversion rate above the eligible-cohort 75th percentile of 14.23%.
- **Contrary evidence:** CTR is 1.43%, 0.12 percentage points below the 1.55%
  cohort median.
- **Quality caveats:** Same as Philadelphia; the lower CTR particularly raises
  the possibility that campaign/conversion mix explains the signal.
- **Strongest permitted conclusion:** San Antonio merits first-party outcome and
  mix validation, not a spend or demand conclusion.
- **Safe next action:** Marketing Science / MSO should run the same weekly,
  taxonomy-controlled first-party outcome join used for Philadelphia and report
  conversion-action and campaign-mix decomposition.
- **KPI and stop rule:** Require the same coverage/finality gate and persistence
  in three of four weeks. Stop if the signal disappears after conversion-action
  or campaign-mix standardization, or if the first-party outcome is not above
  its reviewed cohort expectation.
- **Evidence needed for one higher authority level:** The same governed weekly
  DMA panel plus a conversion-action dictionary and mix-standardized comparison.

## 3. Kankakee competitor-availability condition

- **Status:** Monitoring/data-quality lead only; not actionable as a price or
  commercial-priority decision.
- **Geography/cohort:** Kankakee, IL CBSA `28100` versus 66 metropolitan CBSAs
  with monitored offer rows at or above the metropolitan median.
- **Window:** competitor observations from 2026-07-18 through 2026-08-17.
- **Signal:** 74.99% documented competitor availability, 3.08 percentage points
  below the 78.07% eligible-cohort median, across 4,835 offer rows versus a
  3,923 metropolitan median. The aggregate contains 4,455 summed distinct-SKU
  observations and $25.90 offer-row-weighted equalized price.
- **Corroborating evidence:** Observation volume is above the fixed cohort gate;
  Snowflake exposes match-state, override, price-history, Pricing Labs, Offer
  Pulsing, promotion and inventory sources that could test alternative causes.
- **Contrary evidence:** The CBSA maps from only **one ZIP**. Category, competitor,
  SKU, package and crawl mix can produce the gap; there is no matched-basket
  price-gap benchmark or local Chewy outcome.
- **Quality caveats:** Representative/rotating ZIP rules, scrape lag, active
  match state, override/promotion/inventory overlap and timing alignment have
  not been applied. Zeus adds national SKU context only; it does **not** localize
  demand, margin, profitability, inventory or an outcome to Kankakee.
- **Strongest permitted conclusion:** Recheck monitoring coverage and input
  quality. Do not interpret the value as local price pressure, unmet demand, or
  Chewy economics.
- **Safe next action:** Pricing Analytics and the competitor-data owner should
  reproduce the category/SKU condition across four weekly snapshots, require
  reviewed representative ZIP coverage, and attach active match, scrape
  freshness, price-history, override, promotion and inventory exclusions.
- **KPI and stop rule:** Proposed diagnostic gate: at least three approved
  representative ZIPs, >=95% active/reviewed match coverage for the retained
  basket, freshness within the owner SLA, and a same-direction availability gap
  in three of four weeks. Stop if the ZIP gate fails, the adjusted gap is under
  2 percentage points, or configuration/intervention/timing explains it.
- **Evidence needed for one higher authority level:** Repeated ZIP × category/SKU
  snapshots with the approved representative-ZIP design; active/reviewed match
  labels; matched-basket composition; scrape/config timestamps; effective
  override, promotion, inventory and Chewy-price history; and a governed weekly
  destination-geography outcome with orders/units/net sales/discounts/returns
  and approved cost/contribution completeness. This would promote the lead to a
  bounded commercial investigation, not a price recommendation.

## 4. Santa Clara CVC demand/footprint contrast

- **Status:** Research lead only; not actionable as clinic-access, market, site,
  or real-estate prioritization.
- **Geography/cohort:** Supplied trade area linked to Modern Animal Santa Clara
  versus seven complete source-linked records carrying the `San Jose` market
  label.
- **Window:** observation date unknown; snapshot received 2026-07-30.
- **Signal:** 121,788 reported pet households, 49 reported veterinary clinics,
  2,485 pet households per clinic, and 40,899.91 reported Chewy online
  customers. Pet households per clinic are 1.43× the seven-record cohort median
  of 1,739; online customers exceed the cohort median of 22,862.59.
- **Corroborating evidence:** Both the supplied demand measure and reported
  supply-normalized ratio point in the same direction within this limited
  labeled cohort.
- **Contrary evidence:** A reported count of 49 clinics indicates a substantial
  existing footprint; the ratio depends directly on the unresolved clinic
  definition and trade-area method.
- **Quality caveats:** Observation date, trade-area construction, clinic
  lifecycle/deduplication/corporate taxonomy, customer metric definition/unit,
  market-label meaning and production reuse approval are unresolved. Placer.ai
  visitation and ChainXY opening/closure data are catalog leads only.
- **Strongest permitted conclusion:** GIS and CVC owners should validate whether
  the apparent demand/footprint contrast is real and current. It cannot rank a
  market or justify clinic access.
- **Safe next action:** GIS / Real Estate Analytics and CVC Analytics should
  document the trade-area method/vintage, reconcile physical clinics and
  lifecycle, confirm the online-customer definition, and request a privacy-safe
  current visitation/clinic-access aggregate if licensed and approved.
- **KPI and stop rule:** Proceed only if the exact site/trade-area link is
  owner-confirmed, all metric definitions and dates are supplied, physical
  clinic deduplication passes review, and the ratio remains at least 1.25× under
  the approved method. Stop if the relationship remains unresolved, the metric
  vintage is not comparable, or the reconciled ratio falls below that diagnostic
  threshold.
- **Evidence needed for one higher authority level:** Owner-approved trade-area
  geometry/method/vintage, stable site and physical-clinic IDs, lifecycle and
  deduplication rules, metric definitions/units/dates, current pipeline/maturity,
  and an approved privacy-safe access/outcome measure such as appointments,
  booking availability or reviewed visitation. This would promote the statement
  to a clinic-access investigation candidate, not a market/site recommendation.

## Reproduction

The exact structured values and fixed selection rules are in
`data/approved/golden-question-evidence/current.json`. Rebuild them with the
command in `data/contracts/golden-question-evidence/README.md`.
