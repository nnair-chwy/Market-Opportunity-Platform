import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { googleAdsObservationSchema, snapshotQueryRequestSchema } from "../lib/evidence-snapshot/contracts.ts";
import { ingestSnapshot, snapshotReadiness, validateManifest } from "../lib/evidence-snapshot/ingest.ts";
import { querySnapshot, rejectArbitrarySql } from "../lib/evidence-snapshot/queries.ts";
import { sourceDatasetIds, sourceDatasetRegistry } from "../lib/evidence-snapshot/source-registry.ts";

const fixture = join(process.cwd(), "data/approved/snowflake/2026-08-11");
const snapshotVersion = "approved-snowflake-2026-08-11-v1";

test("loads the approved snapshot and reports governed readiness", async () => {
  const databasePath = join(await mkdtemp(join(tmpdir(), "evidence-db-")), "snapshot.duckdb");
  await ingestSnapshot({ snapshotDir: fixture, databasePath });
  const readiness = await snapshotReadiness({ snapshotDir: fixture, databasePath });
  assert.equal(readiness.manifestValid, true);
  assert.equal(readiness.snapshotVersion, snapshotVersion);
  assert.equal(readiness.status, "ready_with_warnings");
  assert.equal(readiness.tables.find((table) => table.tableName === "regional_demand")?.actualRowCount, 272208);
  assert.ok(readiness.restrictedDatasetsExcluded.includes("regional_demand"));
});

test("rejects malformed, missing, unexpected, and hash-invalid snapshots", async () => {
  const dir = await mkdtemp(join(tmpdir(), "evidence-fixture-")); await cp(fixture, dir, { recursive: true });
  await writeFile(join(dir, "manifest.json"), "{}"); await assert.rejects(() => validateManifest(dir));
  await rm(join(dir, "zip-market.json")); await assert.rejects(() => validateManifest(dir));
});

test("rejects an unexpected row schema", async () => {
  const dir = await mkdtemp(join(tmpdir(), "evidence-schema-")); await cp(fixture, dir, { recursive: true });
  const path = join(dir, "candidate-sites.json"); const rows = JSON.parse(await readFile(path, "utf8")) as Array<Record<string, unknown>>; rows[0]!.unexpected = "blocked"; await writeFile(path, `${JSON.stringify(rows, null, 2)}\n`);
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")) as { outputs: Array<{ path: string; sha256: string }> }; const output = manifest.outputs.find((item) => item.path.endsWith("candidate-sites.json")); if (output) output.sha256 = createHash("sha256").update(`${JSON.stringify(rows, null, 2)}\n`).digest("hex"); await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await assert.rejects(() => validateManifest(dir), /Unexpected schema/);
});

test("validates typed queries, rejects arbitrary SQL, and preserves reproducible results", async () => {
  assert.equal(snapshotQueryRequestSchema.safeParse({ query: "market_context_by_cbsa", snapshotVersion, cbsaCode: "10180" }).success, true);
  assert.equal(snapshotQueryRequestSchema.safeParse({ query: "market_context_by_cbsa", snapshotVersion, cbsaCode: "bad" }).success, false);
  assert.throws(() => rejectArbitrarySql("select * from anything"), /Arbitrary SQL/);
  const databasePath = join(await mkdtemp(join(tmpdir(), "evidence-query-")), "snapshot.duckdb");
  const first = await querySnapshot({ query: "market_context_by_cbsa", snapshotVersion, cbsaCode: "10180" }, { snapshotDir: fixture, databasePath });
  const second = await querySnapshot({ query: "market_context_by_cbsa", snapshotVersion, cbsaCode: "10180" }, { snapshotDir: fixture, databasePath });
  assert.deepEqual(first.rows, second.rows);
  await assert.rejects(() => querySnapshot({ query: "regional_demand_by_zip_year", snapshotVersion, zip: "10001", year: 2026 }, { snapshotDir: fixture, databasePath }), /confidential or restricted/);
  assert.equal(snapshotQueryRequestSchema.safeParse({ query: "regional_demand_by_cbsa_year", snapshotVersion, cbsaName: "Abilene, TX", year: 2026 }).success, true);
});

test("requires an explicit Google Ads contract and never treats missing conversions as zero", () => {
  const valid = googleAdsObservationSchema.parse({ sourceId: "ADS-001", snapshotId: "ads-v1", campaignOrAccountScope: "account-aggregate", geographyType: "market", geographyId: "cbsa:10180", observationStart: "2026-01-01", observationEnd: "2026-01-31", spend: 10, impressions: 100, clicks: 4, conversions: null, coveragePresent: false, currency: "USD", spendUnit: "USD", sensitivity: "internal", allowedUse: "approved_internal_decision_support", qualityStatus: "warning", evidenceStatus: "Reported", provenance: "registered export" });
  assert.equal(valid.conversions, null);
  assert.equal(googleAdsObservationSchema.safeParse({ ...valid, observationEnd: "2025-01-01" }).success, false);
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
