import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { googleAdsObservationSchema, snapshotQueryRequestSchema } from "../lib/evidence-snapshot/contracts.ts";
import { ingestSnapshot, snapshotReadiness, validateManifest } from "../lib/evidence-snapshot/ingest.ts";
import { querySnapshot, rejectArbitrarySql } from "../lib/evidence-snapshot/queries.ts";
import { sourceDatasetIds, sourceDatasetRegistry } from "../lib/evidence-snapshot/source-registry.ts";

const fixture = process.env.SNOWFLAKE_APPROVED_SNAPSHOT_DIR?.trim()
  || join(process.cwd(), "data/approved/snowflake/2026-08-11");
const snapshotAvailable = existsSync(join(fixture, "manifest.json"));
const snapshotTest = snapshotAvailable ? test : test.skip;
const snapshotVersion = "approved-snowflake-2026-08-11-v1";

snapshotTest("loads the approved snapshot and reports governed readiness", async () => {
  const databasePath = join(await mkdtemp(join(tmpdir(), "evidence-db-")), "snapshot.duckdb");
  await ingestSnapshot({ snapshotDir: fixture, databasePath });
  const readiness = await snapshotReadiness({ snapshotDir: fixture, databasePath });
  assert.equal(readiness.manifestValid, true);
  assert.equal(readiness.snapshotVersion, snapshotVersion);
  assert.equal(readiness.status, "ready_with_warnings");
  assert.equal(readiness.tables.find((table) => table.tableName === "regional_demand")?.actualRowCount, 272208);
  assert.ok(readiness.restrictedDatasetsExcluded.includes("regional_demand"));
});

snapshotTest("rejects malformed, missing, unexpected, and hash-invalid snapshots", async () => {
  const dir = await mkdtemp(join(tmpdir(), "evidence-fixture-")); await cp(fixture, dir, { recursive: true });
  await writeFile(join(dir, "manifest.json"), "{}"); await assert.rejects(() => validateManifest(dir));
  await rm(join(dir, "zip-market.json")); await assert.rejects(() => validateManifest(dir));
});

snapshotTest("rejects an unexpected row schema", async () => {
  const dir = await mkdtemp(join(tmpdir(), "evidence-schema-")); await cp(fixture, dir, { recursive: true });
  const path = join(dir, "candidate-sites.json"); const rows = JSON.parse(await readFile(path, "utf8")) as Array<Record<string, unknown>>; rows[0]!.unexpected = "blocked"; await writeFile(path, `${JSON.stringify(rows, null, 2)}\n`);
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")) as { outputs: Array<{ path: string; sha256: string }> }; const output = manifest.outputs.find((item) => item.path.endsWith("candidate-sites.json")); if (output) output.sha256 = createHash("sha256").update(`${JSON.stringify(rows, null, 2)}\n`).digest("hex"); await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await assert.rejects(() => validateManifest(dir), /Unexpected schema/);
});

test("validates typed snapshot query contracts and rejects arbitrary SQL without local approved data", () => {
  assert.equal(snapshotQueryRequestSchema.safeParse({ query: "market_context_by_cbsa", snapshotVersion, cbsaCode: "10180" }).success, true);
  assert.equal(snapshotQueryRequestSchema.safeParse({ query: "market_context_by_cbsa", snapshotVersion, cbsaCode: "bad" }).success, false);
  assert.throws(() => rejectArbitrarySql("select * from anything"), /Arbitrary SQL/);
  assert.equal(snapshotQueryRequestSchema.safeParse({ query: "regional_demand_by_cbsa_year", snapshotVersion, cbsaName: "Abilene, TX", year: 2026 }).success, true);
});

snapshotTest("preserves reproducible results for the local approved snapshot", async () => {
  const databasePath = join(await mkdtemp(join(tmpdir(), "evidence-query-")), "snapshot.duckdb");
  const first = await querySnapshot({ query: "market_context_by_cbsa", snapshotVersion, cbsaCode: "10180" }, { snapshotDir: fixture, databasePath });
  const second = await querySnapshot({ query: "market_context_by_cbsa", snapshotVersion, cbsaCode: "10180" }, { snapshotDir: fixture, databasePath });
  assert.deepEqual(first.rows, second.rows);
  await assert.rejects(() => querySnapshot({ query: "regional_demand_by_zip_year", snapshotVersion, zip: "10001", year: 2026 }, { snapshotDir: fixture, databasePath }), /CBSA aggregate/);
  const cbsaAggregate = await querySnapshot({ query: "regional_demand_by_cbsa_year", snapshotVersion, cbsaName: "Abilene, TX", year: 2026 }, { snapshotDir: fixture, databasePath });
  assert.equal(cbsaAggregate.query, "regional_demand_by_cbsa_year");
  assert.ok(cbsaAggregate.rows.length > 0);
});

test("requires an explicit Google Ads contract and never treats missing conversions as zero", () => {
  const valid = googleAdsObservationSchema.parse({ observationId: "ADS-001:row-1", sourceId: "ADS-001", snapshotId: "ads-v1", reportScope: "example-report", geographyType: "matched_location_label", matchedLocationLabel: "Example location, United States", stableGeographyId: null, observationStart: "2026-01-01", observationEnd: "2026-01-31", spend: 10, impressions: 100, clicks: 4, conversions: null, ctr: 0.04, averageCpc: 2.5, conversionRate: null, costPerConversion: null, conversionsCoveragePresent: false, currency: "USD", spendUnit: "currency_units", sensitivity: "internal", allowedUse: "matched_location_descriptive_context_only", qualityStatus: "warning", evidenceStatus: "Reported", scoringEligibility: "none", rankingEligibility: "none", marketJoinEligibility: "blocked_missing_stable_geography_id", warnings: ["Conversions are unavailable."], provenance: { sourceFile: "example.csv", sourceSha256: "a".repeat(64), sourceRowNumber: 2, transformationVersion: "test-v1" } });
  assert.equal(valid.conversions, null);
  assert.equal(valid.stableGeographyId, null);
  assert.equal(valid.rankingEligibility, "none");
  assert.equal(googleAdsObservationSchema.safeParse({ ...valid, observationEnd: "2025-01-01" }).success, false);
  assert.equal(googleAdsObservationSchema.safeParse({ ...valid, geographyType: "market", stableGeographyId: "cbsa:10180" }).success, false);
});

test("registers all current CSV datasets with aggregate-only AI exposure", () => {
  assert.deepEqual(sourceDatasetIds, ["market_context", "clinic_profile", "clinic_activity", "zip_market", "cbsa_population", "zip_context", "regional_demand", "zip_metro", "retention", "appointments"]);
  for (const datasetId of sourceDatasetIds) {
    assert.equal(sourceDatasetRegistry[datasetId].aiExposure, "aggregate_only");
    assert.ok(sourceDatasetRegistry[datasetId].tableName.startsWith("source_"));
    assert.ok(sourceDatasetRegistry[datasetId].grain.length > 0);
  }
});

test("supports typed retrieval contracts for every registered dataset", () => {
  const inputs = [
    { query: "clinic_profile_by_market", snapshotVersion, cbsaName: "Atlanta-Sandy Springs-Alpharetta, GA" },
    { query: "clinic_activity_by_market", snapshotVersion, cbsaName: "Atlanta-Sandy Springs-Alpharetta, GA" },
    { query: "cbsa_population_by_cbsa", snapshotVersion, cbsaCode: "10180" },
    { query: "zip_context_by_zip", snapshotVersion, zip: "00601" },
    { query: "zip_metro_by_zip", snapshotVersion, zip: "10001" },
  ] as const;
  for (const input of inputs) assert.equal(snapshotQueryRequestSchema.safeParse(input).success, true);
});
