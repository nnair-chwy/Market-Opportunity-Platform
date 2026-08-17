# SEO keyword evidence contract

This contract maps the generic Semrush exports received on 2026-08-14 to
stable, descriptive filenames under the ignored local directory:

```text
data/approved/seo/2026-08-14/raw/
```

Filename pattern:

```text
semrush-keyword-demand_<cohort-type>-<cohort>_us_<export-date>.csv
```

Every file has the same source schema: keyword, intent, national U.S. volume,
keyword difficulty, CPC in USD, and SERP features. Treat keywords as text and
CPC/volume as source observations rather than Chewy performance.

## Appropriate uses

- Discover category, service, brand, and competitor demand vocabulary.
- Build national topic clusters and identify high-volume or high-CPC themes.
- Compare search-intent composition across the supplied cohorts.
- Enrich recommendation explanations with national search context.

## Prohibited interpretations

- Do not infer state, DMA, CBSA, ZIP, trade-area, or store-level demand.
- Do not treat volume as Chewy traffic, conversion, revenue, or market share.
- Do not infer trend from a single dated snapshot.
- Do not interpret a 50,000-row capped export as complete coverage.
- Do not sum duplicated keywords across cohorts without an explicit
  deduplication and cohort-overlap rule.

`manifest.json` records original names, canonical names, valid row counts,
subscription-cap status, and SHA-256 hashes.
