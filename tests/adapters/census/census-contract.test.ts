import assert from "node:assert/strict";
import test from "node:test";
import {
  CENSUS_METRIC_IDS,
  CENSUS_VARIABLE_CATALOG,
  censusGeoId,
  geographyFips,
} from "../../../lib/adapters/census/index.ts";

test("catalog exposes only the approved non-sensitive direct variables", () => {
  assert.deepEqual(Object.keys(CENSUS_VARIABLE_CATALOG), [
    "census.total_population",
    "census.household_count",
    "census.median_household_income",
    "census.housing_unit_count",
  ]);
  assert.deepEqual(
    Object.values(CENSUS_VARIABLE_CATALOG).map(
      ({ variableId }) => variableId,
    ),
    ["B01003_001E", "B11001_001E", "B19013_001E", "B25001_001E"],
  );
  assert.deepEqual(CENSUS_METRIC_IDS, [
    "census.total_population",
    "census.household_count",
    "census.median_household_income",
    "census.housing_unit_count",
    "census.population_density",
  ]);
});

test("constructs stable FIPS and Census GEOIDs for every supported geography", () => {
  const cases = [
    [
      { type: "cbsa", cbsa: "34980" } as const,
      "34980",
      "3100000US34980",
    ],
    [
      { type: "state", state: "47" } as const,
      "47",
      "0400000US47",
    ],
    [
      { type: "county", state: "47", county: "037" } as const,
      "47037",
      "0500000US47037",
    ],
    [
      { type: "place", state: "47", place: "52006" } as const,
      "4752006",
      "1600000US4752006",
    ],
    [
      {
        type: "tract",
        state: "47",
        county: "037",
        tract: "010100",
      } as const,
      "47037010100",
      "1400000US47037010100",
    ],
    [
      {
        type: "block_group",
        state: "47",
        county: "037",
        tract: "010100",
        blockGroup: "1",
      } as const,
      "470370101001",
      "1500000US470370101001",
    ],
  ] as const;

  for (const [geography, fips, geoId] of cases) {
    assert.equal(geographyFips(geography), fips);
    assert.equal(censusGeoId(geography), geoId);
  }
});
