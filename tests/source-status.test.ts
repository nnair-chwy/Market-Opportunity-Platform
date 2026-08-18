import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { sourceFamily, sourceStatusManifestSchema, loadSourceStatus } from "../lib/evidence-snapshot/source-status.ts";

const snapshotDir = resolve(process.env.CLINIC_MARKET_SNAPSHOT_DIR?.trim() || ".local-data/clinic-market-snapshot");
const actualSnapshotAvailable = existsSync(join(snapshotDir, "source-status.json")) && existsSync(join(snapshotDir, "manifest.json"));
const actualSnapshotTest = actualSnapshotAvailable ? test : test.skip;

test("source-status contract requires all six unique source families", () => {
  const baseFamily = {
    status: "unavailable",
    evidenceStatus: "Unknown",
    qualityStatus: "blocked",
    geographyStatus: "unavailable",
    allowedUse: "unavailable",
    files: [],
    limitations: ["Unavailable in test fixture."],
  } as const;
  const valid = sourceStatusManifestSchema.parse({
    manifestVersion: "demo-source-status-v1",
    snapshotVersion: "test-v1",
    builtAt: "2026-08-17T00:00:00.000Z",
    rawExportsCopied: false,
    families: ["general_regional", "clinic", "google_ads", "seo", "pricing", "competitor"].map((sourceFamilyName) => ({ ...baseFamily, sourceFamily: sourceFamilyName })),
  });
  assert.equal(valid.families.length, 6);
  assert.equal(sourceStatusManifestSchema.safeParse({ ...valid, families: valid.families.map((family) => ({ ...family, sourceFamily: "seo" })) }).success, false);
});

actualSnapshotTest("represents every supplied source family and exact loaded row counts", async () => {
  const status = await loadSourceStatus(snapshotDir);
  const general = sourceFamily(status, "general_regional");
  const clinic = sourceFamily(status, "clinic");
  const ads = sourceFamily(status, "google_ads");
  const seo = sourceFamily(status, "seo");
  const pricing = sourceFamily(status, "pricing");
  const competitor = sourceFamily(status, "competitor");

  assert.equal(status.snapshotVersion, "clinic-market-demo-2026-08-17-v1");
  assert.equal(status.rawExportsCopied, false);
  assert.equal(general.status, "loaded");
  assert.equal(clinic.status, "loaded");
  assert.equal(ads.status, "registered_context_only");
  assert.equal(ads.geographyStatus, "matched_location_label_only");
  assert.equal(ads.allowedUse, "matched_location_descriptive_context_only");
  assert.equal(seo.status, "present_unregistered");
  assert.equal(seo.geographyStatus, "national_no_geography");
  assert.equal(seo.files.length, 15);
  assert.equal(pricing.status, "unavailable");
  assert.equal(pricing.files.length, 0);
  assert.equal(competitor.status, "unavailable");
  assert.equal(competitor.files.length, 0);

  const files = new Map([...general.files, ...clinic.files, ...ads.files].map((file) => [file.file, file]));
  assert.equal(files.get("General Regional/cbsa_market_attractiveness_2026-07-31-1246 (1).csv")?.rowCount, 920);
  assert.equal(files.get("Clinic/clinic_market_profile_ownership_demographics.csv")?.rowCount, 44035);
  assert.equal(files.get("Clinic/clinic_level_pre_post_ph_orders_prescriptions_sales.csv")?.rowCount, 37614);
  assert.equal(files.get("General Regional/zip_code_to_cbsa_csa_statistical_area_mapping.csv")?.rowCount, 32309);
  assert.equal(files.get("General Regional/annual_net_sales_by_customer_zip.csv")?.rowCount, 272208);
  assert.equal(files.get("Clinic/monthly_appointment_counts_by_geography_type_state_reason.csv")?.rowCount, 26549);
  assert.equal(files.get("Clinic/weekly_customer_lifecycle_retention_metrics_by_channel.csv")?.rowCount, 756);
  assert.equal(ads.files.reduce((sum, file) => sum + file.rowCount, 0), 385);
});

actualSnapshotTest("records source hashes, quality states, and browser or AI boundaries", async () => {
  const status = await loadSourceStatus(snapshotDir);
  const presentFiles = status.families.flatMap((family) => family.files);
  assert.equal(presentFiles.length, 27);
  assert.equal(presentFiles.every((file) => /^[a-f0-9]{64}$/.test(file.sha256) && file.rowCount > 0), true);
  assert.equal(presentFiles.every((file) => !file.file.startsWith("/") && !file.file.includes("..")), true);

  const clinicFiles = sourceFamily(status, "clinic").files;
  assert.equal(clinicFiles.every((file) => file.sensitivity === "internal"), true);
  assert.equal(clinicFiles.every((file) => file.browserAiExposure === "aggregate_only"), true);
  assert.equal(presentFiles.filter((file) => file.sensitivity === "confidential").length, 0);
  assert.equal(sourceFamily(status, "seo").files.every((file) => file.browserAiExposure === "none"), true);
  assert.equal(sourceFamily(status, "google_ads").files.every((file) => file.browserAiExposure === "aggregate_only"), true);
});

actualSnapshotTest("canonical manifest hashes the source-status and quality artifacts", async () => {
  const manifest = JSON.parse(await readFile(join(snapshotDir, "manifest.json"), "utf8")) as { outputs: Array<{ path: string; sha256: string; bytes: number }>; knownIssues: string[] };
  for (const requiredPath of ["source-status.json", "quality-report.json", "google_ads_matched_location_context.parquet"]) {
    const output = manifest.outputs.find((candidate) => basename(candidate.path) === requiredPath);
    assert.ok(output, `${requiredPath} is absent from the canonical manifest.`);
    const content = await readFile(join(snapshotDir, requiredPath));
    assert.equal(content.byteLength, output!.bytes);
    assert.equal(createHash("sha256").update(content).digest("hex"), output!.sha256);
  }
  const qualityReport = JSON.parse(await readFile(join(snapshotDir, "quality-report.json"), "utf8")) as { status: string; observationCount: number };
  assert.equal(qualityReport.status, "ready_with_warnings");
  assert.equal(qualityReport.observationCount, 5615);
  assert.ok(manifest.knownIssues.some((issue) => issue.includes("stable geography IDs")));
});
