# Agent data router — start here

Read this file before opening CSVs, proposing an ingestion, or designing an
evaluation. It tells you which source package to use. Do not scan every raw file
by default.

To see which approved local files are physically present in this worktree, read
`contracts/local-approved-source-inventory.json`. It records exact paths,
bytes, SHA-256 hashes, allowed-use packages, and the applicable source contract.
Local presence does not expand a source's approved use.

## Sixty-second workflow

1. State the decision or recommendation being evaluated.
2. Choose the smallest compatible source package from the table below.
3. Read that package's manifest or catalog before opening a CSV.
4. Confirm grain, geography, time window, join key, missing-value semantics,
   allowed use, and source limitations.
5. Query only the columns and rows needed for the question.
6. Preserve source provenance and distinguish observed facts, derived metrics,
   hypotheses, and missing evidence.

The manifests are the lightweight control plane. The CSVs are already fast to
inspect and aggregate directly; do not create another ingestion/query harness
unless file volume, repeated workflows, or performance measurements show a
real need.

## Decision-to-source routing

| Question or recommendation | Read first | Primary local data | Main keys | Do not infer |
| --- | --- | --- | --- | --- |
| Regional competitor price or availability | `contracts/pricing-snowflake/available-data-matrix.md`, then `export-manifest.json` | `competitor-price-geo_latest-by-zip-competitor-sku-30d_2026-08-17.csv` | `PRODUCT_PART_NUMBER`, `ZIP_CODE`, competitor, offer date | Local Chewy demand, causality, or permission to change price |
| Pricing priority and economic guardrails | Pricing `export-manifest.json` | `pse-pricing-economics_by-us-sku-current-day_2026-08-17.csv`, product spine, Chewy price history, merch performance | `PRODUCT_PART_NUMBER`; preserve dates | Destination-specific profit; PSE cost is not automatically contribution cost |
| Current Zeus price state and exception queue | `contracts/zeus-ui/export-manifest.json` | sanitized 2026-08-18 Zeus product and regular-exception snapshots | exact `SKU` to validated `PRODUCT_PART_NUMBER`; snapshot date | Local demand, complete catalog coverage, history, or authority to change price |
| Prior Pricing actions and observed outcomes | Pricing `source-catalog.json` and Phoenix profile query | Snowflake `PRICING_LABS_RESULTS_SUMMARY` and `OFFER_PULSING_STATS` | SKU, cohort/round, start/end date | Causal lift outside the documented experiment design |
| Pricing override and match-control history | Pricing query `11_pricing-controls-and-match-discovery.sql` | Snowflake Dream Weaver override history and `COMPETITOR_MATCH_BUNGEE` | override ID or match ID; effective timestamps require owner validation | Employee identity, override payload meaning, match reliability, or causal outcome |
| Google Ads market response | `contracts/google-ads/export-catalog.json` | `*_matched-dma-campaign-performance_us.csv` | account cohort, campaign, DMA, report window | Organic demand, incrementality, or complete local coverage |
| Google Ads conversion meaning | Google Ads export catalog | `*_matched-dma-campaign-conversion-action_us.csv` | DMA, campaign, conversion action | Add segmented conversions to total conversions or compare unlike actions blindly |
| Google Ads configured scope | Google Ads export catalog | `*_configured-targets_by-campaign-adgroup_us.csv` | target, campaign, ad group | Physical user location or realized performance |
| Google Ads postal drill-down | Google Ads export catalog | `*_matched-postal*.csv` | postal code, campaign when present | Stable estimates without volume/coverage gates |
| National SEO demand vocabulary | `contracts/seo-keywords/manifest.json` | `semrush-keyword-demand_topic-*_us_2026-08-14.csv` | normalized keyword and supplied cohort | State/DMA/ZIP demand, Chewy traffic, conversion, revenue, trend, or market share |
| Brand/competitor search context | SEO manifest | `semrush-keyword-demand_brand-*` and `semrush-keyword-demand_competitor-*` | normalized keyword and cohort | Complete coverage for capped exports; additive volume across overlapping cohorts |
| Public market context | Versioned Census manifest in the selected package | CBSA universe, ACS context, or geometry package | exact five-digit CBSA code and version | Trade areas, drive times, demand, ranking, or scoring eligibility |
| Clinic/site demo | Esri sample manifest and field catalog | minimized checked-in demo fixture | stable supplied site and trade-area IDs | Production truth, current performance, or approved site decision |
| GIS enrichment discovery | Source registry `SRC-037`; GIS owner review | Esri demographics, Placer.ai visitation, ChainXY location history | no approved project join yet | That catalog visibility authorizes export, licensed reuse, or CVC scoring |

## Pricing join order

For a Pricing recommendation, use this order and stop when the question is
answered:

1. Start with a traceable ZIP × competitor × SKU observation from the
   competitor export.
2. Join the active U.S. product spine on `PRODUCT_PART_NUMBER`.
3. Add current PSE price/economics and Chewy price history on SKU.
4. Add merchandising exposure only for national business materiality; never
   allocate national totals to ZIPs.
5. Use curated competitor state and Pricing Labs/Offer Pulsing history for
   match configuration, active-intervention checks, and historical outcome
   labels.
6. Check Zeus current exception state and Dream Weaver override history before
   treating a condition as untreated; preserve missing effective timestamps.
7. Add promotions only when base-price versus promotion treatment changes the
   recommendation.

Recommended output classes are: `monitor_only`, `investigate_data_quality`,
`review_match_configuration`, `review_median_benchmark`,
`propose_controlled_opportunity_raise`, `propose_offer_pulse`, and
`no_action_guardrail`. Do not emit a regional Chewy price.

## Cross-source joins

- Use exact stable IDs, not fuzzy names.
- Preserve ZIP and other codes as text, including leading zeroes.
- Do not join Pricing ZIP evidence to Google Ads DMA evidence until a versioned
  ZIP-to-DMA crosswalk is intentionally selected.
- SEO is national context and does not become geographic evidence when joined
  to a geographically named campaign or product category.
- Preserve each source's observation date/window before aggregation.
- Report join coverage and unmatched records before interpreting the result.

## Naming contract

Canonical filenames follow:

```text
<source-or-domain>-<signal>_<grain-or-cohort>_<country-if-needed>_<date-or-window>.csv
```

Use the canonical files under `data/approved/`; ignore generic source download
names such as `Untitled`, `Location report`, and `Matched locations report`.
Raw approved snapshots are intentionally ignored by Git. Their tracked
manifests and contracts are the durable inventory.

## When a new harness becomes justified

Add infrastructure only when at least one of these is demonstrated:

- repeated queries require the same expensive normalization or joins;
- CSV volume or latency prevents bounded interactive analysis;
- multiple agents produce inconsistent calculations despite the contracts;
- scheduled refresh, lineage, access control, or production serving is needed;
- a validated model requires reproducible feature materialization.

Until then, prefer direct bounded reads plus small, reviewable SQL or analysis
queries stored with the relevant source contract.

## Deeper references

- `docs/research/agent-data-source-guide.md`: complete source-by-source briefs.
- `docs/research/source-registry.md`: authoritative source identity and status.
- `docs/research/claim-ledger.md`: evidence-backed claim status.
- `docs/product/open-questions.md`: unresolved decisions.
- `docs/technical/data-contracts.md`: application-facing contracts.
