import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isCompatibleCbsaResponseGeoId,
  parseAllAcsRows,
  transformCbsaAcs,
} from "../lib/data/cbsa-acs/index.ts";
import type { CbsaMarket } from "../lib/data/cbsa-universe/index.ts";
import {
  buildAcsSourceUrl,
  createCbsaAcsManifest,
} from "../scripts/build-cbsa-acs.ts";

function market(code: string, type: "metropolitan" | "micropolitan"): CbsaMarket {
  return {
    market_id: `cbsa:${code}`,
    cbsa_code: code,
    cbsa_name: `${code} ${type}`,
    cbsa_type: type,
    principal_cities: [],
    component_counties: [],
    state_codes: ["TX"],
    delineation_vintage: "2023-07",
    source_id: "SRC-014",
    evidence_status: "Confirmed",
    sensitivity: "public",
    allowed_use: "market_context_only",
    scoring_eligibility: "none",
  };
}

async function payload() {
  return JSON.parse(
    await readFile(
      new URL("../data/fixtures/census/acs5-cbsa-batch.synthetic.json", import.meta.url),
      "utf8",
    ),
  ) as unknown;
}

test("constructs one all-CBSA request without a persisted key", () => {
  const url = buildAcsSourceUrl();
  assert.equal(url.pathname, "/data/2024/acs/acs5");
  assert.equal(
    url.searchParams.get("for"),
    "metropolitan statistical area/micropolitan statistical area:*",
  );
  assert.equal(url.searchParams.has("key"), false);
  assert.match(url.searchParams.get("get") ?? "", /B01003_001E,B01003_001EA/);
});

test("accepts the ACS collection GEO_ID while retaining canonical summary-level 310 IDs", () => {
  assert.equal(isCompatibleCbsaResponseGeoId("310M700US12345", "12345"), true);
  assert.equal(isCompatibleCbsaResponseGeoId("3100000US12345", "12345"), true);
  assert.equal(isCompatibleCbsaResponseGeoId("310M700US99999", "12345"), false);
});

test("parses every batch row and rejects changed table shapes", async () => {
  assert.equal(parseAllAcsRows(await payload()).length, 3);
  assert.throws(() => parseAllAcsRows([["NAME"], ["Alpha"]]), /missing GEO_ID/);
});

test("joins mainland markets, retains nulls, audits unmatched rows, and derives compatible density", async () => {
  const result = transformCbsaAcs(
    await payload(),
    [
      market("23456", "micropolitan"),
      market("34567", "metropolitan"),
      market("12345", "metropolitan"),
    ],
    new Map([
      ["12345", 2_589_988.110336],
      ["23456", 1_000_000],
      ["34567", 1_000_000],
    ]),
  );
  assert.deepEqual(result.snapshot.markets.map(({ cbsa_code }) => cbsa_code), [
    "12345",
    "23456",
    "34567",
  ]);
  assert.deepEqual(result.counts, {
    input_rows: 3,
    matched_rows: 2,
    missing_markets: 1,
    rejected_rows: 1,
    unmatched_rows: 1,
  });
  assert.equal(result.snapshot.markets[0].metrics.population_density.raw_value, 1000000);
  assert.equal(result.snapshot.markets[0].metrics.population_density.evidence_status, "Derived");
  assert.equal(result.snapshot.markets[1].metrics.total_population.raw_value, null);
  assert.equal(result.snapshot.markets[2].metrics.household_count.raw_value, null);
  assert.equal(result.rejected_rows[0].cbsa_code, "99999");
});

test("rejects incompatible ALAND and keeps density null", async () => {
  const result = transformCbsaAcs(
    await payload(),
    [market("12345", "metropolitan")],
    new Map(),
  );
  const density = result.snapshot.markets[0].metrics.population_density;
  assert.equal(density.raw_value, null);
  assert.equal(density.quality_status, "rejected");
});

test("manifest retains public provenance, counts, hashes, and no key", async () => {
  const transformed = transformCbsaAcs(
    await payload(),
    [market("12345", "metropolitan")],
    new Map([["12345", 2_589_988.110336]]),
  );
  const manifest = createCbsaAcsManifest({
    transformed,
    retrievedAt: "2026-07-29T20:00:00.000Z",
    sourceUrl: buildAcsSourceUrl().toString(),
    universePath: "universe.json",
    universeHash: "a".repeat(64),
    universeCount: 1,
    geometryPath: "geometry.json",
    geometryHash: "b".repeat(64),
    geometryCount: 1,
    outputs: [{ path: "snapshot.json", sha256: "c".repeat(64), record_count: 1 }],
  });
  assert.equal(manifest.source_id, "SRC-016");
  assert.equal(manifest.dataset_vintage, 2024);
  assert.equal(manifest.scoring_weight, "none");
  assert.doesNotMatch(JSON.stringify(manifest), /key=/i);
});

test("checked-in ACS outputs match manifest hashes and contain no credential", async () => {
  const base = new URL("../data/public/census/cbsa-acs/2024/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", base), "utf8")) as {
    counts: { matched_rows: number; missing_markets: number; rejected_rows: number };
    outputs: Array<{ path: string; sha256: string; record_count: number }>;
  };
  assert.deepEqual(manifest.counts, {
    input_rows: 935,
    matched_rows: 917,
    missing_markets: 0,
    rejected_rows: 18,
    unmatched_rows: 18,
  });
  for (const output of manifest.outputs) {
    const bytes = await readFile(new URL(output.path.split("/").at(-1)!, base));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), output.sha256);
    assert.doesNotMatch(bytes.toString("utf8"), /CENSUS_API_KEY|[?&]key=/i);
  }
});
