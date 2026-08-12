import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const base = process.env.SNOWFLAKE_APPROVED_SNAPSHOT_DIR?.trim();
const snapshotAvailable = Boolean(base && existsSync(`${base}/manifest.json`));
const snapshotTest = snapshotAvailable ? test : test.skip;

snapshotTest("approved Snowflake snapshot has reproducible manifest hashes and no raw clinic IDs", async () => {
  const manifest = JSON.parse(await readFile(`${base!}/manifest.json`, "utf8")) as {
    outputs: Array<{ path: string; sha256: string; rowCount: number }>;
    rawExportsCopied: boolean;
  };
  assert.equal(manifest.rawExportsCopied, false);
  for (const output of manifest.outputs) {
    const relative = output.path.replace(`${base}/`, "");
    const content = await readFile(relative ? `${base!}/${relative}` : output.path, "utf8");
    assert.equal(createHash("sha256").update(content).digest("hex"), output.sha256);
    assert.ok(output.rowCount > 0);
  }
  const clinicIdentity = await readFile(`${base!}/clinic-market-summary.json`, "utf8");
  const clinicPerformance = await readFile(`${base!}/clinic-performance-market-summary.json`, "utf8");
  assert.equal(/"clinicId"/.test(clinicIdentity), false);
  assert.equal(/"clinicId"/.test(clinicPerformance), false);
  assert.equal(/PRESCRIPTION|RX_ORDERS/.test(clinicPerformance), false);
});

snapshotTest("approved market snapshot preserves reported quality issues instead of silently repairing them", async () => {
  const rows = JSON.parse(await readFile(`${base!}/market-context.json`, "utf8")) as Array<{ cbsaCode: string | null; qualityStatus: string }>;
  assert.equal(rows.length, 920);
  assert.equal(rows.filter((row) => row.cbsaCode !== null).length, 802);
  assert.equal(rows.filter((row) => row.cbsaCode === null).length, 118);
  assert.equal(rows.filter((row) => row.qualityStatus === "MISSING_HOUSEHOLD_DATA").length, 4);
});

snapshotTest("approved snapshot exposes derived market context, clinic density inputs, and candidate coordinates", async () => {
  const markets = JSON.parse(await readFile(`${base!}/market-context.json`, "utf8")) as Array<{ censusContext: { medianHouseholdIncome: number | null; populationDensity: number | null } | null }>;
  const clinics = JSON.parse(await readFile(`${base!}/clinic-market-summary.json`, "utf8")) as Array<{ clinicDensityPer10000Households: number | null; marketId: string | null }>;
  const sites = JSON.parse(await readFile(`${base!}/candidate-sites.json`, "utf8")) as Array<{ latitude: number; longitude: number }>;
  assert.equal(markets.filter((row) => row.censusContext?.medianHouseholdIncome != null).length, 802);
  assert.equal(markets.filter((row) => row.censusContext?.populationDensity != null).length, 802);
  assert.equal(clinics.filter((row) => row.clinicDensityPer10000Households != null).length, 801);
  assert.equal(sites.length, 71);
  assert.equal(sites.every((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude)), true);
});
