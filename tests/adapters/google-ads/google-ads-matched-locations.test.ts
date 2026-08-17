import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { parseGoogleAdsMatchedLocationsReport } from "../../../lib/adapters/google-ads/index.ts";

const titleFirst = `Matched locations report,,,,,,,,,
"July 18, 2026 - August 16, 2026",,,,,,,,,
Matched location,Clicks,Impr.,CTR,Currency code,Avg. CPC,Cost,Conv. rate,Conversions,Cost / conv.
"Example DMA, State, United States","100","1,000",10.00%,USD,2.00,200.00,5.00%,5,40.00
Total: Account,"100","1,000",10.00%,USD,2.00,200.00,5.00%,5,40.00`;

const footerDate = `Matched location,Clicks,Impr.,CTR,Currency code,Avg. CPC,Cost,Conv. rate,Conversions,Cost / conv.
Total: Account,"100","1,000",10.00%,USD,2.00,200.00,5.00%,5,40.00
"Example DMA, State, United States","100","1,000",10.00%,USD,2.00,200.00,5.00%,5,40.00
Matched locations report,,,,,,,,,
"July 18, 2026 - August 16, 2026",,,,,,,,,`;

test("parses both Google Ads report layouts and excludes total rows", () => {
  for (const [fileName, text] of [["title-first.csv", titleFirst], ["footer-date.csv", footerDate]] as const) {
    const report = parseGoogleAdsMatchedLocationsReport({ text, fileName, snapshotId: "test-v1" });
    assert.equal(report.observations.length, 1);
    assert.equal(report.totalRowsExcluded, 1);
    assert.equal(report.observationStart, "2026-07-18");
    assert.equal(report.observationEnd, "2026-08-16");
    assert.equal(report.observations[0]!.matchedLocationLabel, "Example DMA, State, United States");
  }
});

test("registers Google Ads as matched-location context and prohibits keyed or ranked use", () => {
  const observation = parseGoogleAdsMatchedLocationsReport({ text: titleFirst, fileName: "example.csv", snapshotId: "test-v1" }).observations[0]!;
  assert.equal(observation.geographyType, "matched_location_label");
  assert.equal(observation.stableGeographyId, null);
  assert.equal(observation.allowedUse, "matched_location_descriptive_context_only");
  assert.equal(observation.marketJoinEligibility, "blocked_missing_stable_geography_id");
  assert.equal(observation.scoringEligibility, "none");
  assert.equal(observation.rankingEligibility, "none");
  assert.equal(observation.qualityStatus, "valid");
  assert.deepEqual(observation.warnings, []);
});

test("preserves reported metrics and attaches deterministic quality warnings", () => {
  const mismatched = titleFirst.replace("10.00%,USD,2.00", "20.00%,USD,9.00");
  const observation = parseGoogleAdsMatchedLocationsReport({ text: mismatched, fileName: "warning.csv", snapshotId: "test-v1" }).observations[0]!;
  assert.equal(observation.ctr, 0.2);
  assert.equal(observation.averageCpc, 9);
  assert.equal(observation.qualityStatus, "warning");
  assert.ok(observation.warnings.some((warning) => warning.includes("CTR")));
  assert.ok(observation.warnings.some((warning) => warning.includes("average CPC")));
});

test("does not invent the missing Google Ads interaction denominator", () => {
  const interactionRateCannotBeRecomputed = titleFirst.replace("5.00%,5,40.00", "1.00%,5,40.00");
  const observation = parseGoogleAdsMatchedLocationsReport({ text: interactionRateCannotBeRecomputed, fileName: "conversion-rate.csv", snapshotId: "test-v1" }).observations[0]!;
  assert.equal(observation.conversionRate, 0.01);
  assert.equal(observation.qualityStatus, "valid");
  assert.equal(observation.warnings.some((warning) => warning.includes("conversion rate")), false);
});

test("rejects duplicate labels within one report without inventing a geography key", () => {
  const duplicate = titleFirst.replace("\nTotal: Account", "\n\"Example DMA, State, United States\",\"100\",\"1,000\",10.00%,USD,2.00,200.00,5.00%,5,40.00\nTotal: Account");
  const report = parseGoogleAdsMatchedLocationsReport({ text: duplicate, fileName: "duplicate.csv", snapshotId: "test-v1" });
  assert.equal(report.observations.length, 2);
  assert.equal(report.observations.every((row) => row.qualityStatus === "rejected"), true);
  assert.equal(report.observations.every((row) => row.stableGeographyId === null), true);
});

test("blocks reports without a header, date range, or location observations", () => {
  assert.throws(() => parseGoogleAdsMatchedLocationsReport({ text: "no header", fileName: "bad.csv", snapshotId: "test-v1" }), /header/);
  assert.throws(() => parseGoogleAdsMatchedLocationsReport({ text: "Matched location,Clicks", fileName: "bad.csv", snapshotId: "test-v1" }), /date range/);
  assert.throws(() => parseGoogleAdsMatchedLocationsReport({ text: titleFirst.replace("Example DMA, State, United States", "Total: Locations"), fileName: "bad.csv", snapshotId: "test-v1" }), /no location observations/);
});

const marketDataDir = process.env.MARKET_DATA_DIR?.trim();
const actualDataAvailable = Boolean(marketDataDir && existsSync(join(marketDataDir, "Google Ads/Chewy Seach_Shopping.csv")) && existsSync(join(marketDataDir, "Google Ads/Chewy Vet Clinic Seach.csv")));
const actualDataTest = actualDataAvailable ? test : test.skip;

actualDataTest("registers the supplied Google Ads files at their exact source grain", async () => {
  const files = ["Google Ads/Chewy Seach_Shopping.csv", "Google Ads/Chewy Vet Clinic Seach.csv"] as const;
  const reports = [];
  for (const file of files) reports.push(parseGoogleAdsMatchedLocationsReport({ text: await readFile(join(marketDataDir!, file), "utf8"), fileName: file, snapshotId: "actual-data-test-v1" }));
  assert.deepEqual(reports.map((report) => report.observations.length), [210, 175]);
  assert.equal(reports.flatMap((report) => report.observations).length, 385);
  assert.equal(reports.every((report) => report.observationStart === "2026-07-18" && report.observationEnd === "2026-08-16"), true);
  assert.equal(reports.flatMap((report) => report.observations).every((row) => row.currency === "USD" && row.stableGeographyId === null), true);
  assert.equal(reports.flatMap((report) => report.observations).some((row) => row.qualityStatus === "rejected"), false);
});
