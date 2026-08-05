import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createCensusAdapter,
  type CensusFetch,
} from "../../../lib/adapters/census/index.ts";

const FIXTURE_BASE = new URL(
  "../../../data/fixtures/census/",
  import.meta.url,
);

async function fixture(name: string) {
  return JSON.parse(
    await readFile(new URL(name, FIXTURE_BASE), "utf8"),
  ) as unknown;
}

function fixtureFetch(payload: unknown, capture?: (url: URL) => void) {
  return (async (input: string | URL) => {
    capture?.(new URL(input));
    return {
      ok: true,
      status: 200,
      async json() {
        return payload;
      },
    };
  }) satisfies CensusFetch;
}

const county = { type: "county", state: "47", county: "037" } as const;
const now = () => new Date("2026-07-24T12:00:00.000Z");

test("builds a Census query and maps direct estimates with full provenance", async () => {
  const payload = await fixture("acs5-county-complete.synthetic.json");
  let requestedUrl: URL | undefined;
  const adapter = createCensusAdapter({
    fetch: fixtureFetch(payload, (url) => {
      requestedUrl = url;
    }),
    now,
  });

  const result = await adapter.retrieve({
    vintage: 2024,
    geography: county,
  });

  assert.equal(result.rowCount, 1);
  assert.equal(result.refreshTime, "2026-07-24");
  assert.deepEqual(result.allowedUse, {
    sensitivity: "public",
    purpose: "market_context_only",
    scoringWeight: "none",
  });
  assert.equal(requestedUrl?.pathname, "/data/2024/acs/acs5");
  assert.equal(requestedUrl?.searchParams.get("for"), "county:037");
  assert.equal(requestedUrl?.searchParams.get("in"), "state:47");
  assert.match(
    requestedUrl?.searchParams.get("get") ?? "",
    /B01003_001E,B01003_001EA/,
  );

  assert.deepEqual(result.observations[0], {
    metric_id: "census.total_population",
    raw_value: 715884,
    unit: "people",
    source_id: "census:acs/acs5:2024",
    observed_at: "2024-12-31",
    geography: "county",
    quality_status: "accepted",
    sensitivity: "public",
  });
  assert.deepEqual(
    Object.keys(result.observations[0]).sort(),
    [
      "geography",
      "metric_id",
      "observed_at",
      "quality_status",
      "raw_value",
      "sensitivity",
      "source_id",
      "unit",
    ],
  );
  assert.deepEqual(result.provenance[0], {
    metricId: "census.total_population",
    variableId: "B01003_001E",
    dataset: "acs/acs5",
    datasetVintage: 2024,
    geographyType: "county",
    fips: "47037",
    censusGeoId: "0500000US47037",
    retrievedAt: "2026-07-24",
    unit: "people",
    transformation: "identity",
    evidenceStatus: "Confirmed",
    sourceUrl: requestedUrl?.toString(),
    inputs: [],
  });
  assert.deepEqual(result.warnings, []);
});

test("keeps suppressed and missing estimates explicit", async () => {
  const adapter = createCensusAdapter({
    fetch: fixtureFetch(
      await fixture("acs5-county-suppressed-missing.synthetic.json"),
    ),
    now,
  });

  const result = await adapter.retrieve({
    vintage: 2024,
    geography: county,
  });
  const income = result.observations.find(
    ({ metric_id }) => metric_id === "census.median_household_income",
  );
  const housing = result.observations.find(
    ({ metric_id }) => metric_id === "census.housing_unit_count",
  );

  assert.equal(income?.raw_value, null);
  assert.equal(income?.quality_status, "warning");
  assert.equal(housing?.raw_value, null);
  assert.equal(housing?.quality_status, "warning");
  assert.ok(
    result.warnings.some(
      ({ code, metricId }) =>
        code === "suppressed" &&
        metricId === "census.median_household_income",
    ),
  );
  assert.ok(
    result.warnings.some(
      ({ code, metricId }) =>
        code === "missing" && metricId === "census.housing_unit_count",
    ),
  );
});

test("derives reproducible density only from compatible retained inputs", async () => {
  const adapter = createCensusAdapter({
    fetch: fixtureFetch(await fixture("acs5-county-complete.synthetic.json")),
    now,
  });

  const result = await adapter.retrieve({
    vintage: 2024,
    geography: county,
    metricIds: ["census.population_density"],
    densityArea: {
      squareMeters: 1_300_000_000,
      sourceId: "census:tiger-line:2024:ALAND",
      observedAt: "2024-01-01",
      geographyType: "county",
      fips: "47037",
      transformation: "ALAND identity",
    },
  });

  assert.equal(result.observations.length, 1);
  assert.deepEqual(result.observations[0], {
    metric_id: "census.population_density",
    raw_value: 1426.254653,
    unit: "people_per_square_mile",
    source_id: "census:acs/acs5:2024:derived",
    observed_at: "2024-12-31",
    geography: "county",
    quality_status: "accepted",
    sensitivity: "public",
  });
  assert.equal(result.provenance[0].evidenceStatus, "Derived");
  assert.equal(result.provenance[0].variableId, null);
  assert.equal(result.provenance[0].inputs.length, 2);
  assert.deepEqual(result.provenance[0].inputs[1], {
    metricId: "census.land_area",
    rawValue: 1_300_000_000,
    unit: "square_meters",
    sourceId: "census:tiger-line:2024:ALAND",
    observedAt: "2024-01-01",
    transformation: "ALAND identity",
  });
});

test("rejects density when area geography is incompatible", async () => {
  const adapter = createCensusAdapter({
    fetch: fixtureFetch(await fixture("acs5-county-complete.synthetic.json")),
    now,
  });

  const result = await adapter.retrieve({
    vintage: 2024,
    geography: county,
    metricIds: ["census.population_density"],
    densityArea: {
      squareMeters: 1_300_000_000,
      sourceId: "census:tiger-line:2024:ALAND",
      observedAt: "2024-01-01",
      geographyType: "county",
      fips: "47035",
      transformation: "ALAND identity",
    },
  });

  assert.equal(result.observations[0].raw_value, null);
  assert.equal(result.observations[0].quality_status, "rejected");
  assert.equal(result.warnings[0].code, "incompatible");
});

test("returns stale warnings using the configured threshold", async () => {
  const adapter = createCensusAdapter({
    fetch: fixtureFetch(await fixture("acs5-county-complete.synthetic.json")),
    now,
    maxVintageAgeYears: 3,
  });

  const result = await adapter.retrieve({
    vintage: 2020,
    geography: county,
    metricIds: ["census.total_population"],
  });

  assert.equal(result.observations[0].raw_value, 715884);
  assert.equal(result.observations[0].quality_status, "warning");
  assert.equal(result.warnings[0].code, "stale");
});

test("rejects a response whose Census geography does not match the request", async () => {
  const adapter = createCensusAdapter({
    fetch: fixtureFetch(
      await fixture("acs5-county-incompatible.synthetic.json"),
    ),
    now,
  });

  const result = await adapter.retrieve({
    vintage: 2024,
    geography: county,
    metricIds: ["census.total_population"],
  });

  assert.equal(result.observations[0].raw_value, null);
  assert.equal(result.observations[0].quality_status, "rejected");
  assert.equal(result.warnings[0].code, "incompatible");
});

test("returns unavailable observations instead of throwing on network failure", async () => {
  const adapter = createCensusAdapter({
    fetch: async () => {
      throw new Error("Network access must not be required in tests.");
    },
    now,
  });

  const result = await adapter.retrieve({
    vintage: 2024,
    geography: county,
    metricIds: ["census.total_population"],
  });

  assert.equal(result.rowCount, 0);
  assert.equal(result.observations[0].raw_value, null);
  assert.equal(result.observations[0].quality_status, "warning");
  assert.equal(result.warnings[0].code, "unavailable");
});

test("validates fixed-width FIPS components before calling fetch", async () => {
  let called = false;
  const adapter = createCensusAdapter({
    fetch: async () => {
      called = true;
      throw new Error("unexpected");
    },
    now,
  });

  await assert.rejects(
    adapter.retrieve({
      vintage: 2024,
      geography: { type: "county", state: "47", county: "37" },
    }),
    /Invalid Census county code/,
  );
  assert.equal(called, false);
});

test("supports one summary-level 310 CBSA and validates its response", async () => {
  const payload = [
    [
      "NAME", "GEO_ID", "B01003_001E", "B01003_001EA",
      "metropolitan statistical area/micropolitan statistical area",
    ],
    ["Nashville-Davidson--Murfreesboro--Franklin, TN Metro Area", "3100000US34980", "2150000", null, "34980"],
  ];
  let requested: URL | undefined;
  const adapter = createCensusAdapter({
    fetch: fixtureFetch(payload, (url) => { requested = url; }),
    now,
  });
  const result = await adapter.retrieve({
    vintage: 2024,
    geography: { type: "cbsa", cbsa: "34980" },
    metricIds: ["census.total_population"],
  });
  assert.equal(requested?.searchParams.get("for"), "metropolitan statistical area/micropolitan statistical area:34980");
  assert.equal(result.observations[0].raw_value, 2150000);
  assert.equal(result.provenance[0].censusGeoId, "3100000US34980");

  await assert.rejects(
    adapter.retrieve({
      vintage: 2024,
      geography: { type: "cbsa", cbsa: "3498" },
    }),
    /Invalid Census cbsa code/,
  );
});
