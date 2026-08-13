# Google Ads geographic signal export discovery

**Status:** Research proposal for review  
**Observed:** 2026-08-13  
**Account scope:** Authorized Chewy MCC, with U.S. evaluator focus  
**Production approval:** Not established

For agent planning across all known sources, read
`docs/research/agent-data-source-guide.md` first. Sixteen U.S. 30-day exports
and one Canada diagnostic are profiled under `SRC-018` and in
`google-ads-export-manifest.md`; all raw files remain outside Git. The Canada
export is a diagnostic artifact, not an input to the U.S. evaluator.

## Executive conclusion

Google Ads can provide useful **ad-mediated geographic demand and efficiency
evidence**, especially for Marketing. It should not be treated as total market
demand, customer penetration, causal incrementality, willingness to pay, or a
site-selection score.

Chewy already has a documented DMA-level path for Google and other media:
`vw_spend_by_dma`, a maintained platform-to-Nielsen DMA mapping, first-party
session and order measures, and campaign taxonomy. That governed internal path
should be evaluated before building a new Google Ads API ingestion. Google Ads
UI/API location reports remain useful for semantic validation, account
coverage checks, and fine-grained CVC campaign-scope evidence.

The export should preserve three different geographic concepts as separate
datasets:

1. **Physical user location** — the best candidate for a bounded regional
   delivery-and-response signal.
2. **Matched location of interest** — a distinct intent signal about places a
   user searched for or showed interest in.
3. **Configured target performance** — a control describing how campaigns were
   targeted and performed, not an unbiased observation of regional demand.

Google documents these concepts separately in its
[geographic performance guidance](https://support.google.com/google-ads/answer/2453994?hl=en_us_us),
[location-targeting guidance](https://support.google.com/google-ads/answer/2453995?hl=en),
and API resources for
[`user_location_view`](https://developers.google.com/google-ads/api/fields/v25/user_location_view),
[`matched_location_interest_view`](https://developers.google.com/google-ads/api/fields/v25/matched_location_interest_view),
[`geographic_view`](https://developers.google.com/google-ads/api/fields/v25/geographic_view),
and [`location_view`](https://developers.google.com/google-ads/api/fields/v25/location_view).

## What the signed-in view established

The authorized manager exposes multiple U.S. accounts whose funnels and
geographic design differ materially. The configured-target view ranges from a
single `United States` row for nationwide campaigns to state, metro, ZIP, and
radius targets for regional programs. Representative 30-day exports were
captured for Vet Clinic Search, CarePlus, Connect with a Vet, and Get Real. The
earlier Canada Search/Shopping export was retained outside Git only as a file-
shape diagnostic.

For the main nationwide Search/Shopping account, the separate
`Insights and reports > When and where ads showed > Matched locations` report
is available. This establishes that a country target does not restrict
reporting to a country row. Google documents reporting down to finer matched
geography, subject to resolvability and privacy. The matched report can include
physical presence or location interest; use a physical-user report or API
location-type segment when that distinction matters.

This confirms interface access and candidate field availability only. It does
not establish permission to reuse the data, production API access, approved
retention, metric definitions, or suitability for decisioning. No raw account
export or campaign-level data should be checked into Git.

Configured-target rows and matched-location rows are conditioned on campaign
setup, bids, budgets, creative, inventory, and conversion tracking. Neither can
be read directly as a market-demand map.

## U.S. account relevance

| Cohort | Geographic value | Recommended treatment |
| --- | --- | --- |
| Chewy Search/Shopping | Broadest U.S. paid-search and shopping coverage; target table is country-level | Primary Marketing cohort through the existing DMA view; use matched/physical location for validation |
| Pharmacy Search/Shopping | Relevant RX demand, but country-targeted | Separate entity/outcome cohort through DMA reporting |
| Vet Clinic Search | ZIP and radius target detail around clinic markets | Direct CVC scope evidence; pair with total appointments and operational maturity |
| CarePlus and Connect with a Vet | State-level health/insurance and telehealth context | Separate adjacent-health cohorts; do not merge outcomes with retail Search |
| Get Real | Metro and finer regional targeting | Conditional regional evidence after program and outcome definitions are confirmed |
| MAI and Video | App-acquisition and awareness funnels | Context only; never compare directly with Search conversion efficiency |
| Sponsored Ads Offsite and Symbiosys | Vendor-funded category/manufacturer activity | Use only for explicitly sponsored category questions with funding controls |
| EC/test, inactive, Canada, and empty Zoo accounts | Test, inactive, non-U.S., or no observed delivery | Exclude from the default U.S. evaluator cohort |

## Recommended datasets

### Existing Chewy DMA path — evaluate first

| Dataset | Documented role | Required validation |
| --- | --- | --- |
| `vw_spend_by_dma` | Campaign-date-platform-DMA spend, clicks, and impressions | Owner, environment, refresh, history, account coverage, and location semantics |
| `tbl_daily_sessions_summary_web` and `ms_session_metrics` | Web sessions, engagement, add-to-cart, Autoship, and order outcomes | DMA missingness, attribution, app exclusion, lag, and metric ownership |
| `campaign_d` | Campaign taxonomy and comparable-cohort formation | Current field stewardship, coverage, and exclusion rules |
| Nielsen DMA/ZIP mapping and platform parity tables | Normalize platform geography to DMA | Version, license, unmatched handling, and relationship to product-market geography |

Build a weekly DMA panel from these sources only after the validations above.
Keep DMA as the Marketing geography unless an approved, versioned DMA-to-CBSA
relationship is adopted; the two market systems are not interchangeable.

### Google Ads validation and fallback datasets

Create separate weekly tables rather than blending location types.

| Dataset | Primary source | Interpretation | Initial use |
| --- | --- | --- | --- |
| `geo_delivery_presence_weekly` | `user_location_view` or `geographic_view` with `LOCATION_OF_PRESENCE` | Ads delivered to users Google associated with the geography | Marketing demand and efficiency evidence |
| `geo_interest_weekly` | `matched_location_interest_view` or `geographic_view` with `AREA_OF_INTEREST` | Users expressed interest in the named geography | Travel, relocation, gifting, or remote-interest investigation |
| `geo_target_performance_weekly` | `location_view` | Performance of configured location criteria | Targeting controls, exclusions, and campaign-context QA |

Use the Google Ads API reporting path for a durable production integration.
For discovery, a plain CSV with the same columns is sufficient. A scheduled
export can bridge the pilot only if its owner, destination, retention, and
failure handling are approved.

## Fields to request

### Minimum viable export

| Group | Fields | Why |
| --- | --- | --- |
| Snapshot | export ID, extracted timestamp, requested date range, reporting time zone, currency | Makes replay and comparisons auditable |
| Account context | stable customer/account ID, account label | Prevents cross-account mixing; session URL parameters are not identifiers |
| Campaign context | campaign ID and name, channel/type, campaign status | Separates Search, Shopping, Performance Max, and other delivery systems |
| Ad-group context | ad group ID and name when applicable | Supports taxonomy QA without making it a required grain |
| Geography | Google geo target constant or criterion ID, canonical name, country, geo type, parent geo IDs | Enables deterministic crosswalks and avoids fuzzy name joins |
| Location semantics | physical-presence, area-of-interest, or configured-target type; targeted/not-targeted flag | Prevents incompatible geographic evidence from being blended |
| Time | week start and end; daily date only when a specific QA need exists | Weekly grain reduces noise while retaining trend visibility |
| Exposure | impressions, interactions, clicks when available, cost in micros | Provides volume and spend denominators |
| Outcome | conversions, conversion value, all conversions/value only when approved | Supports bounded efficiency analysis |
| Rates | interaction rate, conversion rate, average CPC/CPM, cost per conversion | Useful for QA; recompute from raw totals where definitions permit |

### Strongly preferred enrichment

- Conversion action ID/name and category, so purchases, leads, store actions,
  and other outcomes are not silently combined.
- Device, ad network, and campaign channel/type segments.
- Product category, brand, or approved merchandising hierarchy for Shopping,
  if available at a compatible aggregate grain.
- Search impression share or another eligible-exposure measure where Google
  supports it at the selected report grain. Do not substitute raw impressions
  for total market reach.
- Budget and material bid-strategy change markers for interpretation.
- Order or revenue measures only after reconciliation with the governed source
  of truth and confirmation that Google-attributed values are appropriate.

Avoid exporting user-level identifiers, customer addresses, search-query text,
credentials, browser-session parameters, or precise customer coordinates.

## Geography and time rules

- Keep Google's stable geography ID and hierarchy in the raw governed layer.
- Join to a business market through an explicit, versioned crosswalk. Never
  fuzzy-match a postal name to a CBSA.
- Prefer the existing maintained Nielsen DMA/ZIP mapping for Marketing. Define
  an explicit product rule for presenting DMA evidence beside the repository's
  CBSA market spine; do not equate, fuzzy-match, or silently allocate DMA to
  CBSA.
- Exclude the diagnostic Canada export from the U.S. evaluator.
- Retain source geography and crosswalk status even after aggregation.
- Start with 90 days at weekly grain for profiling; request approximately 13
  months if available for seasonality and year-over-year checks.
- Mark recent weeks provisional or exclude them until the conversion-lag rule
  is approved.
- Preserve `null`, suppressed, and zero as different states.
- Apply governance-approved volume and privacy suppression thresholds before
  displaying fine geography. This document does not invent the threshold.
- Use DMA x campaign as the default comparable Marketing layer. Use postal
  detail for drill-down, contradiction checks, and explicitly regional
  programs only after coverage, volume, stability, and eligibility gates.
- Reconcile postal resolved totals to DMA totals. In the observed snapshot,
  main and Pharmacy postal exports retain approximately 90% of DMA activity;
  never allocate the unresolved remainder to postal rows.

## Candidate derived signals

All derived values need a versioned formula, eligible cohort, input sources,
and visible limitations.

| Signal | Deterministic concept | Recommendation use | Boundary |
| --- | --- | --- | --- |
| Delivered demand volume | Presence-based interactions or approved conversions by market and week | Identify regions worth investigation | Ad-mediated and campaign-conditioned, not total demand |
| Acquisition efficiency | Approved conversions or value relative to interactions and spend | Compare controlled regional test candidates | Requires a conversion-action dictionary and comparable campaign mix |
| Exposure gap | Stable outcome efficiency with relatively low eligible exposure | Find a possible reach-expansion test | Requires an eligible-exposure denominator; impressions alone are insufficient |
| Presence-interest gap | Area-of-interest signal compared with physical-location signal | Investigate gifting, relocation, travel, or geographic mismatch | The two location types must remain visible and separate |
| Momentum | Recent rolling period versus a prior or year-ago period | Detect emerging regional changes | Needs seasonality, lag, and campaign-change controls |
| Stability | Week coverage, volume, variance, and suppression state | Calibrate confidence and block thin-data recommendations | Not a business score |
| Spend leakage | Spend in non-targeted, excluded, or persistently weak-outcome geography | Review exclusions and targeting setup | Human Marketing review required |
| Category affinity | Product/category response mix by physical geography | Investigate local assortment or creative | Does not authorize inventory or pricing action |

## Recommendation enrichment by perspective

### Marketing

This is the primary fit. The evidence can enrich controlled regional
acquisition tests, budget-allocation investigations, local category or creative
tests, targeting/exclusion reviews, and campaign reach monitoring. It aligns
with the existing `customer_demand`, `acquisition_efficiency`, and
`campaign_reach` evidence gaps, but does not fill them until definitions,
approval, and validation are complete.

A recommendation should include supporting evidence, contradictory evidence
such as saturation or weak conversion quality, confidence/stability, campaign
scope, and an experiment outcome with acquisition-cost and service guardrails.

### CVC and site evaluation

Use only as supporting digital-interest or awareness evidence for a defined
clinic campaign and approved clinic geography. It may help prioritize local
awareness tests or diagnose a launch-market gap. It must not become a property
feasibility, trade-area, clinic-demand, or site-selection score.

### Pricing

Engagement and conversion do not establish willingness to pay or elasticity.
The source may identify where a governed price or promotion experiment could
be investigated only when offer, price, margin, and experiment-assignment data
are separately approved.

### Merchandising and inventory

Shopping category signals may prompt an assortment investigation. They do not
support an automated reorder, allocation, or availability decision without
inventory, fulfillment, and profitability constraints.

## Quality and interpretation gates

The source remains evidence-needed until all of these are resolved:

- named business and data owner, approved purpose, access, retention, and
  refresh path;
- campaign taxonomy, including Search, Shopping, Performance Max, brand,
  non-brand, category, prospecting, and remarketing treatment;
- conversion-action dictionary, attribution setting, value definition, and
  conversion-lag policy;
- physical-presence versus area-of-interest versus configured-target separation;
- target and exclusion semantics;
- stable geography IDs, hierarchy coverage, crosswalk version, and suppression;
- currency, reporting time zone, week boundary, and complete-week checks;
- bid, budget, creative, landing-page, promotion, inventory, and delivery
  changes that can confound regional comparisons;
- duplicate aggregation, missingness, zero, suppression, and late-arriving-data
  behavior; and
- reconciliation of any revenue or order metric with its governed system of
  record.

The data cannot by itself establish population penetration, organic demand,
causal lift, competitor activity, total addressable market, customer residence,
or site suitability.

## Proposed pilot

1. Confirm owners, access, allowed use, and refresh behavior for
   `vw_spend_by_dma`, `tbl_daily_sessions_summary_web`, `ms_session_metrics`,
   `campaign_d`, and the maintained DMA mappings.
2. Profile 90 days at weekly grain for account, entity, funnel, platform,
   device, DMA, conversion lag, unmatched geography, and web-versus-app
   coverage. Do not produce recommendations during profiling.
3. Use campaign taxonomy to define comparable cohorts and explicit exclusions;
   reconcile first-party outcomes rather than treating all Google conversions
   as equivalent.
4. Validate nationwide reporting with physical-user and matched-location data,
   and use the U.S. configured-target exports to check CVC/state/metro campaign
   scope.
5. Adopt a minimum reporting grain and an explicit DMA-to-product-market rule.
   Keep Marketing results in DMA if no defensible DMA-to-CBSA relationship is
   approved.
6. Shadow-evaluate the documented 2023/2026 paid-search geo tests and CVC brand-
   search optimization case, including organic/direct substitution, auction
   conditions, total appointments or orders, and operational guardrails.
7. Review interpretation with Marketing, CVC, data, and governance owners
   before defining thresholds or action language.
8. Build a new Google Ads API adapter only if the existing DMA path cannot meet
   the approved contract; otherwise use it for validation or specifically
   approved finer-grain cases.

## Proposed ownership split

- **Product/data intelligence:** evidence contract, cross-perspective boundary,
  derived formulas, confidence and QA rules, shadow evaluation, and workspace
  integration proposal.
- **Nik or the accountable Marketing owner:** campaign taxonomy, conversion
  definitions, attribution and lag interpretation, targeting/bid confounders,
  action thresholds, and business validation.
- **Governance/data steward:** approved purpose, access, aggregation,
  suppression, retention, and production refresh.

Work can proceed now on the schema, QA profile, crosswalk requirements, and
shadow-test design. Actual reuse and recommendation thresholds remain blocked
on owner and governance decisions.

## Branch strategy

This research is isolated on `agent/google-ads-geo-insights`, created from the
latest pushed `agent/consolidate-analyst-loop` commit observed on 2026-08-13.
The other agent remains active on that consolidated branch, so sharing its
working branch would create avoidable collisions. Before integration, compare
the consolidated branch again and rebase or cherry-pick this documentation
work after the other changes stabilize.

## Evidence record

- `SRC-018`: authorized multi-account Google Ads observations, sixteen U.S.
  exports, and one Canada diagnostic; raw account data remains outside Git.
- `SRC-019`: official Google Ads geographic reporting and location-targeting
  documentation.
- `SRC-020` and `SRC-021`: internal DMA data path and first-party/third-party
  performance join.
- `SRC-022` and `SRC-024`: paid-search and CVC geo-test practices.
- `SRC-023`: campaign taxonomy.
- `CLM-032` through `CLM-041`: confirmed, derived, and unknown implications.
