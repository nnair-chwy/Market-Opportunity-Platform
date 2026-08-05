import assert from "node:assert/strict";
import test from "node:test";
import {
  CHOROPLETH_MISSING_COLOR,
  choroplethBreaks,
  choroplethColor,
  createPublicMarketRecords,
  defaultPublicMarketList,
  filterPublicMarkets,
  isKeyboardSelectionKey,
  publicMarketAriaLabel,
  selectPublicMarket,
} from "../lib/data/cbsa-market-context.ts";
import type { CbsaAcsMarket } from "../lib/data/cbsa-acs/index.ts";
import type { CbsaMarket } from "../lib/data/cbsa-universe/index.ts";

function market(
  code: string,
  name: string,
  type: "metropolitan" | "micropolitan",
): CbsaMarket {
  return {
    market_id: `cbsa:${code}`,
    cbsa_code: code,
    cbsa_name: name,
    cbsa_type: type,
    principal_cities: [
      { name: name.split(",")[0], state_code: "TX", state_fips: "48", place_fips: "00001" },
    ],
    component_counties: [
      {
        county_name: `${name.split(",")[0]} County`,
        county_fips: "48001",
        state_name: "Texas",
        state_code: "TX",
        state_fips: "48",
      },
    ],
    state_codes: ["TX"],
    delineation_vintage: "2023-07",
    source_id: "SRC-014",
    evidence_status: "Confirmed",
    sensitivity: "public",
    allowed_use: "market_context_only",
    scoring_eligibility: "none",
  };
}

const records = createPublicMarketRecords(
  [
    market("23456", "Small, TX", "micropolitan"),
    market("12345", "Large, TX", "metropolitan"),
    market("34567", "Missing, TX", "metropolitan"),
  ],
  new Set(["12345", "23456"]),
);

function acs(code: string, population: number | null): CbsaAcsMarket {
  const base = {
    source_id: "SRC-016" as const,
    observed_at: "2024-12-31" as const,
    geography: "cbsa" as const,
    quality_status: population === null ? ("warning" as const) : ("accepted" as const),
    evidence_status: "Confirmed" as const,
    sensitivity: "public" as const,
    allowed_use: "market_context_only" as const,
    scoring_weight: "none" as const,
    warning: population === null ? "missing" : null,
  };
  return {
    market_id: `cbsa:${code}`,
    cbsa_code: code,
    cbsa_name: code,
    cbsa_type: code === "23456" ? "micropolitan" : "metropolitan",
    census_geo_id: `3100000US${code}`,
    metrics: {
      total_population: { ...base, metric_id: "census.total_population", raw_value: population, unit: "people" },
      household_count: { ...base, metric_id: "census.household_count", raw_value: population, unit: "households" },
      median_household_income: { ...base, metric_id: "census.median_household_income", raw_value: population, unit: "usd" },
      housing_unit_count: { ...base, metric_id: "census.housing_unit_count", raw_value: population, unit: "housing_units" },
      population_density: { ...base, metric_id: "census.population_density", raw_value: population, unit: "people_per_square_mile", evidence_status: "Derived" },
    },
  };
}

test("defaults filtering to metropolitan areas and can include micropolitan areas", () => {
  assert.deepEqual(
    filterPublicMarkets(records, {
      query: "",
      includeMicropolitan: false,
    }).map((item) => item.cbsa_code),
    ["12345", "34567"],
  );
  assert.equal(
    filterPublicMarkets(records, {
      query: "",
      includeMicropolitan: true,
    }).length,
    3,
  );
});

test("search covers market name, code, principal city, county, and state", () => {
  assert.equal(
    filterPublicMarkets(records, {
      query: "small county",
      includeMicropolitan: true,
    })[0].cbsa_code,
    "23456",
  );
  assert.equal(
    filterPublicMarkets(records, {
      query: "12345",
      includeMicropolitan: false,
    })[0].cbsa_name,
    "Large, TX",
  );
});

test("selection, keyboard activation, labels, and missing geometry remain explicit", () => {
  assert.equal(selectPublicMarket(records, "23456")?.cbsa_name, "Small, TX");
  assert.equal(selectPublicMarket(records, "99999"), null);
  assert.equal(isKeyboardSelectionKey("Enter"), true);
  assert.equal(isKeyboardSelectionKey(" "), true);
  assert.equal(isKeyboardSelectionKey("Escape"), false);

  const missing = selectPublicMarket(records, "34567")!;
  assert.equal(missing.geometry_status, "missing");
  assert.match(publicMarketAriaLabel(missing), /boundary unavailable/);
  assert.match(publicMarketAriaLabel(missing), /CBSA 34567/);
});

test("defaults to population-sorted metropolitan markets while retaining micro search", () => {
  const withAcs = createPublicMarketRecords(
    [
      market("12345", "Alpha, TX", "metropolitan"),
      market("23456", "Beta, TX", "micropolitan"),
      market("34567", "Gamma, TX", "metropolitan"),
    ],
    new Set(["12345", "23456", "34567"]),
    new Map([
      ["12345", acs("12345", 100)],
      ["23456", acs("23456", 1000)],
      ["34567", acs("34567", 500)],
    ]),
  );
  assert.deepEqual(defaultPublicMarketList(withAcs).map(({ cbsa_code }) => cbsa_code), [
    "34567",
    "12345",
  ]);
  assert.equal(
    filterPublicMarkets(withAcs, { query: "Beta", includeMicropolitan: true })[0].cbsa_code,
    "23456",
  );
});

test("choropleth uses deterministic blue bins and a neutral missing style", () => {
  const withAcs = createPublicMarketRecords(
    [
      market("12345", "Alpha, TX", "metropolitan"),
      market("34567", "Gamma, TX", "metropolitan"),
    ],
    new Set(["12345", "34567"]),
    new Map([
      ["12345", acs("12345", 100)],
      ["34567", acs("34567", 500)],
    ]),
  );
  const breaks = choroplethBreaks(withAcs, "total_population");
  assert.equal(choroplethColor(null, breaks), CHOROPLETH_MISSING_COLOR);
  assert.match(choroplethColor(500, breaks), /^#/);
});
