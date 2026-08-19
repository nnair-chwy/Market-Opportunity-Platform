# Golden-question data gap matrix — 2026-08-20 review

This matrix is Nik-side evidence/computation work. It does not change product
copy, interaction design, agent behavior, metric meaning, or action authority.

Capability notation: **Y** = supports the capability within the stated allowed
use; **C** = conditional after listed controls/joins; **N** = does not support
it. `Act` means direct support for a material business action, not permission to
perform a safe data-validation step.

## Pricing — where observed competitor conditions and Chewy economics warrant investigation

| Required metric/evidence | Current source | Grain | Time period | Join key | Availability | Allowed use | Missingness/coverage | Describe | Compare | Prioritize | Act |
| --- | --- | --- | --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| Competitor price, equalized price, availability, coupon, freshness | Snowflake Bungee history; `pricing_competitor_geo_offer` | competitor × ZIP × SKU × offer time; checked-in map aggregate is CBSA | 2026-07-18–2026-08-17 | `PRODUCT_PART_NUMBER`, ZIP text, competitor; map uses `zip-zcta-centroid-cbsa-v1` | Workspace export + aggregate snapshot connected | Internal shadow evaluation only | 831,917 latest ZIP/SKU rows; map input 276 ZIPs, 250 mapped, 99.26% offer value mapped; rotating/representative ZIP coverage | Y | C | C | N |
| Current SKU price architecture, PSE cost/margin, MAP, driver, demand/materiality | Zeus product snapshot (`SRC-036`) | current snapshot × SKU | 2026-08-18 | exact `SKU`, validate against Snowflake `PRODUCT_PART_NUMBER` | Workspace-only sanitized local export | Internal source discovery and shadow evaluation | 250,000 rows vs 313,351 UI entries: 63,351 not exported (20.2%); `Category Owner` removed | Y | C | C | N |
| Current regular exception queue and suggested review context | Zeus regular-exception snapshot | current exception × SKU | 2026-08-18 | exact SKU | Workspace-only sanitized local export | Internal source discovery and shadow evaluation | Five rows; completeness is only the filtered `REGULAR` current view; no history | Y | C | C | N |
| Chewy current economics by SKU/category | PSE dashboard + checked-in `pricing-economics/current.json` | activity date × SKU; checked-in aggregate is date × MC1 | 2026-08-17 | `PRODUCT_PART_NUMBER`; MC1 only after coverage check | Workspace export; minimized category aggregate connected | Internal shadow commercial-materiality context only | 238,692 U.S. SKU rows; bounded 1,000-row sample had 12.8% null PSE cost, 51.2% null min competitor price, 2.5% null elasticity; checked-in current-day sales/units are all zero | Y | C | C | N |
| Chewy price and price-driver history | `CHEWYBI.PRICE_CHEWY_HISTORY` | SKU × price-change timestamp | rolling 90 days ending 2026-08-17 | `PRODUCT_PART_NUMBER` + effective timestamp | Workspace export | Internal shadow evaluation | 216,380 rows; price-driver/effective-time definitions need owner confirmation | Y | C | C | N |
| Override history / current override state | `DREAM_WEAVER_OVERRIDES`, `DREAM_WEAVER_LATEST_OVERRIDES` | override replication/event record | observed 2026-08-18; effective period unresolved | `OVERRIDE_ID`; payload join keys unresolved | Schema + aggregate profile visible | Source discovery only until payload contract approved | 1,623,421 history rows, ~11,137 IDs; 12 latest rows; VARIANT semantics unresolved; `CREATED_BY` prohibited | C | N | N | N |
| Competitor-match state/reliability | `CHEWYBI.COMPETITOR_MATCH_BUNGEE` | match ID × match event | latest `MATCH_TIME` 2026-02-03 12:28 | part number, competitor, competitor part number, match ID | Schema + aggregate profile visible | Source discovery and match-configuration review | 24,095,886 rows, ~487,753 IDs; active state/timestamps exist, but no observed reliability, reviewer outcome, or false-match label | C | C | N | N |
| Prior decision/evaluation outcomes | Pricing Labs and Offer Pulsing | experiment × cohort × period; experiment × round × SKU | 730-day profiles; latest starts 2026-08-12 and 2026-08-17 | SKU + experiment/cohort/round + start/end | Visible and profiled, not exported to repo | Internal shadow evaluation | 1,317,316 Pricing Labs rows/88,117 SKUs; 44,991 pulsing rows/21,124 SKUs; causal interpretation limited to design | Y | C | C | N |
| Promotion/inventory/intervention exclusions | `PDM.PROMOTION`, CDM promotion usage, Zeus inventory, Dream Weaver overrides | promotion/order/SKU/current state | objects visible 2026-08-17–18; aligned history not built | promotion ID, order/SKU, effective dates | Visible or current-state only | Discovery/shadow only | No governed joined exclusion panel; timing alignment and base-price vs promotion treatment unresolved | C | N | N | N |
| Privacy-safe realized regional outcomes: orders, units, net sales, discounts, returns, costs, contribution | Candidate `ECOM.ORDER_LINE` aggregate | required week × destination geography × MC1; optional SKU if allowed | aggregate join checked for 2026-08-16 | internal address ID only inside Snowflake; output needs geography ID and category | Blocked | Aggregate-only after governance approval and suppression | Structural join covered 952,017 lines, but role returned one masked postal value and null state; no usable regional breadth | N | N | N | N |
| Versioned ZIP→CBSA bridge | 2025 Census ZCTA representative point → 2024 CBSA polygon | ZIP/ZCTA → CBSA | 2025/2024 vintages | five-character ZIP/ZCTA + five-digit CBSA | Connected as deterministic approximation | Internal shadow/map context only | 26 of 276 Pricing ZIPs unmapped; method is not an approved operational crosswalk | Y | C | C | N |

Strongest permitted Pricing conclusion today: **prioritize repeatability and
data-quality investigation of observed competitor conditions**, not a regional
price, margin, demand, or causal conclusion.

## Marketing — which comparable geographies show paid-search response worth validating with first-party outcomes

| Required metric/evidence | Current source | Grain | Time period | Join key | Availability | Allowed use | Missingness/coverage | Describe | Compare | Prioritize | Act |
| --- | --- | --- | --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| Paid-search delivery/response: impressions, clicks, CTR, cost, CPC, configured conversions/rate | Retail matched-location exports; aggregate CBSA snapshot | source postal geography; derived CBSA | 2026-07-14–2026-08-12 | source postal label; derived ZCTA/CBSA | Workspace export + aggregate snapshot connected | Internal shadow evaluation only | 25,862 input rows/25,854 source geographies; 20,093 mapped; 93.6–93.9% value coverage by metric | Y | C | C | N |
| Comparable campaign taxonomy | Campaign taxonomy documentation (`SRC-023`) | campaign ID | current definition reference observed 2026-08-13 | campaign ID | Documented, not connected to checked-in aggregate | Reference/discovery only | Entity/funnel/channel/network/tactic/category controls exist conceptually; no joined frozen taxonomy snapshot | Y | C | N | N |
| First-party sessions, orders, new customers, contribution, or approved CVC outcome | Existing DMA phase-one documentation / Snowflake candidate | required week × DMA × campaign cohort | freshness and finality unresolved | campaign ID + week + stable DMA ID | Documented, not connected | Discovery only | Web DMA incomplete; app DMA nearly blank in documentation; outcome definition/lag/attribution unresolved | N | N | N | N |
| Stable platform geography ID and DMA/ZIP bridge | MSO DMA/ZIP mapping candidate | DMA/ZIP | version/currentness unresolved | Google location ID, Nielsen DMA ID, ZIP | Documented, not approved for this workspace | Discovery only | Current CBSA snapshot uses Census-assisted approximation; DMA and CBSA must not be treated as equivalent | C | N | N | N |
| Prior intervention / auction / budget / creative / promotion / inventory controls | Geo-test plan, taxonomy, campaign data; Pricing promotion/inventory candidates | week × DMA × comparable campaign cohort | same 30-day window required | campaign ID + week + geography + category | Fragmented | Experiment-design/shadow only | No joined control panel; impression share, budget constraint, auction condition, organic/direct substitution, inventory and promo not attached | C | N | N | N |

Strongest permitted Marketing conclusion today: **identify comparable paid-
search response leads to validate with first-party outcomes**. Platform-
configured conversions are not first-party commercial or incremental outcomes.

## CVC — which markets show demand/footprint contrasts worth deeper clinic-access investigation

| Required metric/evidence | Current source | Grain | Time period | Join key | Availability | Allowed use | Missingness/coverage | Describe | Compare | Prioritize | Act |
| --- | --- | --- | --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| Pet households, reported Chewy customers, population/income | Minimized Esri trade-area fixture (`SRC-017`) | supplied trade area | observation date unknown; received 2026-07-30 | supplied site/trade-area IDs | Connected internal-demo aggregate | Internal demo evidence only | 67 source-linked sites, four synthetic fallbacks, one one-to-many relationship; metric dates/methods absent | Y | C | C | N |
| Veterinary footprint/count and pet-households per clinic | Same Esri fixture | supplied trade area | unknown; received 2026-07-30 | supplied trade-area ID | Connected internal-demo aggregate | Internal demo evidence only | Clinic definition, lifecycle, deduplication, corporate classification, unit owner and method unresolved | Y | C | C | N |
| Foot traffic / visitation and dwell | Placer.ai in GIS Data Library (`SRC-037`) | likely point/place/area; contract not inspected | catalog observed 2026-08-18 | no approved join | Catalog lead only | None approved for project | Export, license, retention, geography, currentness, owner and CVC mapping all missing | N | N | N | N |
| Competitor openings/closures and location history | ChainXY in GIS Data Library | retailer location × time; contract not inspected | catalog observed 2026-08-18 | no approved join | Catalog lead only | None approved for project | Category taxonomy, physical-location dedupe, closure/open dates, license and CVC mapping missing | N | N | N | N |
| Site pipeline, physical footprint and opening/maturity | Supplied site fixture + Site Pipeline candidate | site | supplied snapshot 2026-07-30; live pipeline not connected | stable site ID | Fixture connected; pipeline access unconfirmed | Internal demo evidence only | Four missing Esri links, one one-to-many; maturity rule/current opening dates not governed | Y | C | N | N |
| Clinic outcome: appointments, N2Rx, revenue, repeat mix, utilization | CVC dashboards directory | required clinic × week with maturity flags | unresolved | stable clinic/site ID + week | Reference only | None approved for calculation | Exact outcome, denominator, maturity, owner, export and suppression unresolved | N | N | N | N |
| Versioned trade-area/CBSA relationship | Supplied source relationship + public CBSA reference | supplied trade area and CBSA are separate | source method unknown; CBSA 2023/2024 | approved GIS crosswalk required | Blocked | Review only | Do not infer a CBSA, drive-time, service area, or ranking from names/coordinates | N | N | N | N |

Strongest permitted CVC conclusion today: **identify supplied trade-area demand/
footprint contrasts for GIS and metric-owner validation**, not prioritize a
market or clinic.

## Shared meaning requiring Sheila + Nik review

- Whether `market` means Nielsen DMA, Census CBSA, supplied trade area, clinic
  catchment, or another geography for each golden question.
- Whether Google Ads `Conversions`, reported Esri `Chewy Online Customers`,
  Pricing `PSE Cost`, `Current PSE Margin`, and Snowflake contribution fields
  have approved definitions for cross-source evaluation.
- Minimum volume, privacy suppression, freshness/finality, unmatched-geography,
  and intervention-exclusion rules before any lead may be called prioritized.
- The accountable owner and approval gate for moving from `describe` or
  `compare` to `prioritize`. No meaning was changed in code or product copy.
