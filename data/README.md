# Data directory

Only synthetic, de-identified, or explicitly approved data belongs here.

## Intended layout

```text
data/
├── README.md
├── public/
│   └── census/
│       ├── cbsa-universe/
│       │   └── 2023-07/
│       │       ├── manifest.json
│       │       ├── markets.json
│       │       └── rejected-rows.json
│       └── cbsa-geometry/
│           └── 2024/
│               ├── manifest.json
│               ├── markets.topo.json
│               └── geometry-audit.json
├── sample/
│   ├── synthetic-sites.json
│   └── esri/
│       └── 2026-07-30/
│           ├── manifest.json
│           ├── field-catalog.json
│           ├── portfolio-readiness.json
│           ├── site-identities.json
│           ├── site-trade-area-crosswalk.json
│           ├── trade-areas.json
│           └── rejected-or-review-records.json
└── schemas/
    └── site-input.schema.json
```

## Public Census CBSA snapshot

Run:

```sh
pnpm run data:build:cbsa-universe
```

The command downloads the two official July 2023 Census XLSX files linked by
`SRC-014`, validates their worksheet and column structure, and writes the
versioned transformed files shown above. Downloaded XLSX files are cached under
the ignored `.cache/public-data/` directory and are not committed.

`markets.json` retains all eligible metropolitan and micropolitan CBSAs for the
contiguous 48 states and Washington, DC. `rejected-rows.json` is an audit
artifact and never supplies market records. `manifest.json` provides hashes,
counts, retrieval metadata, and transformation provenance.

This dataset is public `market_context_only` evidence with
`scoring_eligibility: none`. It does not establish approved scoring criteria,
weights, rankings, population measures, growth measures, or CBSA boundaries.

## Public Census CBSA geometry

Run:

```sh
pnpm run data:build:cbsa-geometry
```

The command downloads the official 2024 national CBSA cartographic boundary
ZIP from `SRC-015`, validates the archive and shapefile fields, joins features
to the phase 1 universe by five-digit CBSA code, and writes compact TopoJSON.
The build retains unmatched, duplicate, rejected, and missing-geometry records
in `geometry-audit.json`. It fails before replacing outputs if any validated
mainland market lacks geometry or if a duplicate or rejected feature is found.

The artifact preserves the source `ALAND` and `AWATER` observations. `ALAND` is
not recalculated from simplified browser geometry. The 2024 CBSA polygons are
Census statistical areas, not trade areas, drive-time polygons, or service
areas. They are neutral display context with no scoring eligibility. The live
browser imports the built artifact and does not fetch boundary geometry at
runtime.

## Prohibited content

- Precise customer coordinates
- Customer or pet identifiers
- Medical records
- Employee data
- Restricted clinic financial rows
- Credentials or tokens
- Raw exports copied from internal dashboards without approval

## Agent data-contract entry points

Agents must inspect the relevant contract before opening a local export or
proposing an ingestion/modeling plan:

- `contracts/google-ads/` maps Google's ambiguous download names to stable,
  descriptive names and explains which files are valid for DMA comparison,
  postal drill-down, reconciliation, conversion semantics, or configured
  scope. Local raw files live under ignored `approved/google-ads/`.
- `contracts/pricing-snowflake/` catalogs documented Pricing and adjacent
  Snowflake sources, their grains and limitations, intended export names, and
  minimal extraction queries. Local sanitized exports belong under ignored
  `approved/snowflake/pricing/`.

Neither contract grants production use or scoring eligibility. Each preserves
source status, geography, grain, limitations, and unresolved approvals so an
agent can distinguish available evidence from a data gap.

## Local Google Ads evidence snapshot

Run:

```sh
pnpm data:organize:google-ads
```

The command verifies all sixteen U.S. downloads against the cataloged hashes
and report headers, then copies them into
`data/approved/google-ads/2026-07-14_2026-08-12/raw/` with descriptive names.
The directory is ignored by Git. The initial Canada diagnostic is excluded.

Use the two `*_matched-dma-campaign-performance_us.csv` files as the primary
manual performance fixtures. Conversion-action exports are semantics-only;
configured-target exports describe intended scope; postal exports are local
drill-down subject to coverage and volume gates.

## Local Snowflake evidence snapshot

`data/approved/snowflake/<snapshot-version>/` is an ignored local destination
for a sanitized, versioned snapshot built from explicitly authorized internal
Snowflake CSV exports. Rebuild it with:

```sh
SNOWFLAKE_EXPORT_DIR=/absolute/path/to/authorized/exports \
SNOWFLAKE_SNAPSHOT_DIR=data/approved/snowflake/<snapshot-version> \
pnpm data:build:approved-snowflake-snapshot
```

The raw CSVs and generated snapshot remain outside Git. The snapshot contains market context, ZIP
geography, household context, aggregate regional demand, clinic market and
performance summaries, appointment context, retention baseline, and ZIP metro
mapping. The manifest records input file names, output hashes, grain, sensitivity,
allowed use, and unresolved data-quality issues.

Playbooks must consume these outputs through their own typed evidence contract.
The snapshot does not authorize a universal score or bypass clinic identity,
outcome, maturity, geography, or owner-review requirements.

Data files added later must document owner, source, observation date, geography, sensitivity, allowed use, and retention.

## Minimized Esri demo fixture

`data/sample/esri/2026-07-30/` is a deterministic, minimized internal-demo
fixture derived from the five user-supplied `SRC-017` exports. It contains 71
approved real site names and site coordinates, selected aggregate trade-area
metrics, explicit provenance, deterministic readiness results, and four
clearly labeled synthetic fallback trade-area records. Raw exports and clinic
row values are not stored in Git.

The fixture is `internal`, limited to `internal_demo_evidence_only`, and has
`scoring_eligibility: none`. It does not establish production access,
organizational governance approval, a refresh path, metric observation dates,
or a trade-area construction method.

Run the source audit with explicit input paths:

```sh
pnpm data:audit:esri-sources \
  --clinic-full <clinic-full.csv> \
  --clinic-demo <clinic-demo.csv> \
  --master-full <master-full.csv> \
  --master-demo <master-demo.csv> \
  --trade-areas <trade-areas.xlsx>
```

Rebuild with the same arguments:

```sh
pnpm data:build:esri-demo \
  --clinic-full <clinic-full.csv> \
  --clinic-demo <clinic-demo.csv> \
  --master-full <master-full.csv> \
  --master-demo <master-demo.csv> \
  --trade-areas <trade-areas.xlsx> \
  --built-at <ISO-8601-UTC-timestamp>
```

The builder validates exact demo projections, source relationships, stable
identity keys, prohibited-field exclusion, and output hashes. It stages all
outputs in a temporary directory and replaces the versioned fixture only after
validation succeeds.

The application derives the market and trade-area profile from
`site-identities.json`, `site-trade-area-crosswalk.json`, and
`trade-areas.json` at build time. No browser path reads the external exports.
Displayed supplied fields are population, population growth, households,
households with pets and index, selected income measures, square miles, four
aggregate Chewy or CVC measures, veterinary clinic count, and source
pet-households-per-clinic. Age bands, income bands, and sparse risk and labor
rank fields remain excluded because definitions, denominators, dates, and
direction are not approved.

## Candidate evidence brief inputs

`lib/esri-demo/candidate-evidence.ts` projects the checked-in Esri fixture into
a deterministic six-section brief. The five allowed demo IDs and the isolated
synthetic clinic-landscape fixture are in
`lib/esri-demo/candidate-evidence-fixtures.ts`.

The default three-candidate comparison uses Shops at MacArthur Hills, The Mix,
and London Square in analyst selection order. 212 Miracle Mile and Barkin'
Creek Domain NORTHSIDE are available to demonstrate another supplied candidate
and an explicitly blocked synthetic trade-area path.

The clinic-landscape fixture is `SYN-CLINIC-LANDSCAPE-001`. It is a stale
2025-12-31 `Hypothesis`, not a transformation of the supplied clinic rows. It
exists only to demonstrate source-account versus estimated physical-location
counts, corporate and independent labels, lifecycle filtering, and retained
repeated coordinates. It performs no distance or inclusion calculation.

Candidate briefs and comparisons are internal-demo only, non-scored, and
print from an already minimized presentation object. Lease, landlord, rent,
account, phone, customer, prescription, clinic-row, and other excluded values
remain absent.

## Versioned public CBSA ACS context

`data/public/census/cbsa-acs/2024/` contains the checked-in 2020–2024 ACS
5-year market-context snapshot, rejected-row audit, and manifest from
`SRC-016`. Rebuild with `pnpm data:build:cbsa-acs` after placing the free Census
key in ignored `.env.local` as `CENSUS_API_KEY`. The key is never persisted.
These period estimates have no scoring eligibility, and growth is deferred.
