# Census market-context adapter

This ACS adapter is separate from the versioned CBSA market-universe build in
`scripts/build-cbsa-universe.ts`. The CBSA build uses the July 2023 Census
delineation and principal-city workbooks from `SRC-014`, writes a validated
snapshot under `data/public/census/cbsa-universe/2023-07/`, and has no scoring
eligibility.

It is also separate from `scripts/build-cbsa-geometry.ts`. That command uses
the official 2024 1:5,000,000 cartographic boundary file from `SRC-015` and
writes a versioned TopoJSON display artifact. The geometry build preserves the
source shapefile `ALAND` observation, but the ACS adapter does not automatically
consume it. Any later density join must still validate exact geography identity
and vintage through the adapter input contract.

This provider-neutral repository adapter translates public Census American
Community Survey 5-year detail-table responses into the evaluator's canonical
metric-observation contract. It has no Esri dependency and receives its
`fetch` implementation from the caller, so tests and local development can use
recorded synthetic fixtures without network access.

The output keeps canonical observations separate from adapter provenance.
Canonical observations therefore retain the exact fields documented in
`docs/technical/data-contracts.md`, while the parallel provenance records retain
the Census variable, dataset vintage, Census geography, FIPS/GEOID, retrieval
date, unit, transformation, evidence status, source URL, and derived inputs.

## Initial variable catalog

| Metric ID | ACS 5-year variable | Unit | Treatment |
| --- | --- | --- | --- |
| `census.total_population` | `B01003_001E` | people | Direct estimate |
| `census.household_count` | `B11001_001E` | households | Direct estimate |
| `census.median_household_income` | `B19013_001E` | USD | Direct estimate, not inflation-adjusted across vintages |
| `census.housing_unit_count` | `B25001_001E` | housing units | Direct estimate |
| `census.population_density` | no direct variable | people per square mile | Derived from total population and a caller-supplied, provenance-bearing land area |

The adapter also requests each estimate's `EA` annotation variable. Census
special values for insufficient samples, suppression, and unavailability are
never converted into numbers. Open-ended median annotations are rejected
instead of being represented as exact point estimates.

## Supported geography levels

- CBSA: exactly five-digit metropolitan or micropolitan statistical-area code, summary level 310
- State: two-digit state FIPS
- County: state plus three-digit county FIPS
- Place: state plus five-digit place FIPS
- Census tract: state, county, and six-digit tract code
- Block group: state, county, tract, and one-digit block-group code

These are Census-defined statistical or legal geographies. The adapter does not
create radii, trade areas, polygon intersections, or drive-time areas. A radius
must not be described as drive time.

Population density is calculated only when the supplied land area has the same
geography type and FIPS identifier as the ACS population. The calculation is:

`population / (land-area square meters / 2,589,988.110336)`

The result is rounded to six decimal places, labeled `Derived`, and retains both
inputs. The versioned 2024 CBSA geometry artifact now provides a validated
public `ALAND` observation for its exact CBSA geography. Using it in an ACS
density calculation remains a separate integration decision because ACS
geography and vintage compatibility must be checked explicitly.

## Warnings and freshness

The result explicitly returns `suppressed`, `missing`, `stale`, `incompatible`,
and `unavailable` warnings. The default freshness threshold is three years and
can be configured by the caller. Missing data is never silently imputed.
Incompatible response geography is rejected.

ACS 5-year values are period estimates associated with a vintage, not
point-in-time counts. The canonical `observed_at` value uses December 31 of the
dataset vintage as the period-end marker. This convention is recorded in
provenance and must not be interpreted as the date of a single observation.

## Use boundaries

- These metrics are public aggregate market context, not an automatic site
  recommendation.
- The adapter creates no production scoring weights and returns
  `scoringWeight: "none"`.
- It does not include race, ethnicity, age, sex, disability, health,
  citizenship, language, household composition, or other protected or
  sensitive characteristics.
- Median household income is included only as broad market context. It must not
  be used as a proxy for protected characteristics or as an unreviewed site
  preference.
- It does not fetch microdata, customer data, medical data, internal data, or
  credentials.
- The default dataset is ACS 5-year detail tables because the 5-year product
  supports smaller geographies than ACS 1-year data. Availability still varies
  by vintage and geography.

## Authoritative references

- [ACS data via API](https://www.census.gov/programs-surveys/acs/data/data-via-api.html)
- [Census Data API User Guide](https://www.census.gov/data/developers/guidance/api-user-guide.Overview.html)
- [ACS estimate and annotation values](https://www.census.gov/data/developers/data-sets/acs-1year/notes-on-acs-estimate-and-annotation-values.html)
- [TIGER/Line technical documentation](https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/tiger-geo-line.html)

If a Census API key is required, a runtime fetch wrapper may attach it. Keys
must not be written to fixtures, source URLs, logs, or Git.

The 2024 API requires a free key. The nationwide build reads it only from
`CENSUS_API_KEY`; `.env.local` is ignored by Git and loaded by
`data:build:cbsa-acs`. The persisted URL never includes the key. The ACS API
returns collection-style `GEO_ID` values such as `310M700US34980`; the adapter
validates that format and retains the canonical summary-level identifier
`3100000US34980`.
