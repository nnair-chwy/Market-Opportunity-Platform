import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildNormalizedMarketData, normalizeUsZip } from "../lib/data-normalization/build.ts";
import { DEFAULT_NORMALIZED_SNAPSHOT_VERSION } from "../lib/data-normalization/contracts.ts";
import { createCbsaResolver, loadCbsaMarkets } from "../lib/data-normalization/geography.ts";
import { queryNormalizedMarketData } from "../lib/data-normalization/query.ts";
import { assertNoSeoSources, normalizationSourceCatalog } from "../lib/data-normalization/source-catalog.ts";

async function writeFixture(root: string) {
  const files: Record<string, string> = {
    "General Regional/cbsa_market_attractiveness_2026-07-31-1246 (1).csv": "CBSA_CODE,CBSA_NAME,REPORTING_DATE,ACTIVE_CUSTOMER_COUNT,PRIOR_YEAR_REPORTING_DATE,ACTIVE_CUSTOMER_COUNT_PRIOR_YEAR,ACTIVE_CUSTOMER_YOY_GROWTH,TOTAL_HOUSEHOLDS,ACTIVE_CUSTOMERS_PER_1000_HOUSEHOLDS,QUALITY_STATUS\n,\"Phoenix-Mesa-Chandler, AZ\",2026-07-31,1000,2025-07-31,900,0.111,500,2,OK\n",
    "General Regional/cbsa_population_estimates.csv": "CBSA,LSAD,POP_ESTIMATE\n38060,Metropolitan Statistical Area,5000000\n",
    "General Regional/zip_code_to_cbsa_csa_statistical_area_mapping.csv": "ZIP_CODE,CBSA_TITLE,CSA_TITLE,METRO_MICRO_STATISTICAL_AREA\n85001,\"Phoenix-Mesa-Chandler, AZ\",,Metropolitan Statistical Area\n",
    "General Regional/customer_zip_to_metro_state_mapping.csv": "CUSTOMER_ADDRESS_ZIP,METRO,STATE\n85001,Phoenix,AZ\n",
    "General Regional/zcta5_household_income_and_family_estimates_2026-08-10.csv": "GEO_ZIPCODE,ESTIMATED_HOUSEHOLDS,ESTIMATED_MEDIAN_HOUSEHOLD_INCOME,ESTIMATED_NUMBER_OF_FAMILIES\n85001,100,75000,60\n",
    "General Regional/annual_net_sales_by_customer_zip.csv": "YEAR,CUSTOMER_ADDRESS_ZIP,NET_SALES_EXCLUDING_REFUNDS,NET_SALES\n2026,85001,1000,1100\n2026,M5E1R4,50,60\n",
    "Clinic/clinic_market_profile_ownership_demographics.csv": "CLINIC_ID,ZIP_CODE,CBSA_NAME,CLINIC_STATE,TOTAL_ORDERS,TOTAL_VETS_CAPPED,CORPORATE_CLINIC_FLAG,PH_CLINIC_FLAG,PBC_CLINIC_FLAG\nC1,85001,\"Phoenix-Mesa-Chandler, AZ\",AZ,100,2,TRUE,FALSE,FALSE\n",
    "Clinic/clinic_level_pre_post_ph_orders_prescriptions_sales.csv": "CLINIC_ID,ZIP_CODE,TIMEFRAME,TOTAL_CUSTOMER,TOTAL_ORDERS,RX_ORDERS,NET_SALES,RX_NET_SALES,NET_SALES_CHANGE\nC1,85001,Pre-PH,80,100,20,1000,200,100\n",
    "Clinic/monthly_appointment_counts_by_geography_type_state_reason.csv": "GEOGRAPHY,REPORTING_MONTH,APPOINTMENT_TYPE,APPOINTMENT_STATE,REASON,APPOINTMENT_COUNT\nAZ,2026-07,General,Completed,Wellness,50\n",
    "Clinic/weekly_customer_lifecycle_retention_metrics_by_channel.csv": "LOAD_DATE,FINANCIAL_CALENDAR_REPORTING_YEAR,FINANCIAL_CALENDAR_REPORTING_PERIOD,FINANCIAL_CALENDAR_REPORTING_WEEK,WEEK_START_DATE,WEEK_END_DATE,AGGREGATION_LEVEL,BUSINESS_CHANNEL,TOTAL_CUSTOMERS,POTENTIAL_COUNT,RECENT_COUNT,LAPSED_COUNT,INACTIVE_COUNT,CHURNED_COUNT\n2026-08-17,2026,8,32,2026-08-10,2026-08-16,Total,Total,100,10,70,5,5,10\n",
    "Google Ads/Chewy Seach_Shopping.csv": "Matched locations report,,,,,,,,,\nJuly 18, 2026 - August 16, 2026,,,,,,,,,\nMatched location,Clicks,Impr.,CTR,Currency code,Avg. CPC,Cost,Conv. rate,Conversions,Cost / conv.\n\"Phoenix AZ, Arizona, United States\",100,1000,10%,USD,2,200,5%,50,4\n",
    "Google Ads/Chewy Vet Clinic Seach.csv": "Matched locations report,,,,,,,,,\nJuly 18, 2026 - August 16, 2026,,,,,,,,,\nMatched location,Clicks,Impr.,CTR,Currency code,Avg. CPC,Cost,Conv. rate,Conversions,Cost / conv.\n\"Phoenix AZ, Arizona, United States\",10,100,10%,USD,5,50,2%,2,25\n",
  };
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(root, relativePath);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, content);
  }
}

test("catalog registers every non-SEO file and supports future source validation", () => {
  assertNoSeoSources();
  assert.equal(normalizationSourceCatalog.length, 12);
  assert.equal(normalizationSourceCatalog.some((source) => source.relativePath.startsWith("SEO Keywords/")), false);
  assert.ok(normalizationSourceCatalog.every((source) => source.requiredColumns.length > 0));
  assert.ok(normalizationSourceCatalog.every((source) => source.geographyStrategy));
});

test("strict U.S. ZIP normalization never converts Canadian postal codes into U.S. ZIPs", () => {
  assert.equal(normalizeUsZip("85001"), "85001");
  assert.equal(normalizeUsZip("85001-1234"), "85001");
  assert.equal(normalizeUsZip("8600000US85001"), "85001");
  assert.equal(normalizeUsZip("M5E1R4"), null);
  assert.equal(normalizeUsZip("1234"), null);
});

test("Census-backed resolver distinguishes exact, intuitive, and unsupported geography", async () => {
  const resolver = createCbsaResolver(await loadCbsaMarkets());
  const exact = resolver.resolveCode("38060");
  assert.equal(exact?.cbsaName, "Phoenix-Mesa-Chandler, AZ");
  assert.equal(exact?.confidence, "exact");
  const inferred = resolver.resolveLabel("Phoenix AZ, Arizona, United States", null, "matched_location_label");
  assert.equal(inferred.cbsaCode, "38060");
  assert.equal(inferred.demoUsable, true);
  assert.ok(["Derived", "Hypothesis"].includes(inferred.evidenceStatus));
  const unsupported = resolver.resolveLabel("Not A Real Place ZZ", null, "matched_location_label");
  assert.equal(unsupported.demoUsable, false);
  assert.equal(unsupported.cbsaCode, null);
});

test("builds reusable Parquet and DuckDB tables and serves registered aggregate queries", async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "normalized-source-fixture-"));
  const outputDir = await mkdtemp(join(tmpdir(), "normalized-output-fixture-"));
  t.after(async () => { await rm(fixtureRoot, { recursive: true, force: true }); await rm(outputDir, { recursive: true, force: true }); });
  await writeFixture(fixtureRoot);
  const { manifest } = await buildNormalizedMarketData({ sourceDir: fixtureRoot, outputDir, builtAt: "2026-08-17T00:00:00.000Z" });
  assert.equal(manifest.sourceFiles.length, 12);
  assert.equal(manifest.seoIncluded, false);
  assert.ok(manifest.outputs.some((output) => output.path.endsWith(".parquet")));
  assert.ok(manifest.outputs.some((output) => output.path.endsWith(".duckdb")));
  assert.equal(manifest.sourceFiles.find((source) => source.datasetId === "clinic_profile")?.sensitivity, "internal");
  assert.equal(manifest.sourceFiles.find((source) => source.datasetId === "clinic_profile")?.browserExposure, "aggregate_only");
  assert.equal(manifest.coverage.find((item) => item.datasetId === "google_ads_search_shopping")?.coverageRate, 1);
  assert.equal(manifest.coverage.find((item) => item.datasetId === "regional_demand")?.unresolvedCount, 1);

  const regional = await queryNormalizedMarketData({ requestId: "regional", snapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION, query: "regional_context_by_cbsa", cbsaCode: "38060" }, { snapshotDir: outputDir });
  assert.ok(regional.rows.some((row) => row.evidenceType === "census_market_context"));
  assert.ok(regional.rows.some((row) => row.evidenceType === "regional_demand"));
  const clinic = await queryNormalizedMarketData({ requestId: "clinic", snapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION, query: "clinic_context_by_cbsa", cbsaCode: "38060" }, { snapshotDir: outputDir });
  assert.ok(clinic.rows.some((row) => row.evidenceType === "clinic_profile"));
  assert.ok(clinic.warnings.some((warning) => /completed appointments/i.test(warning)));
  const ads = await queryNormalizedMarketData({ requestId: "ads", snapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION, query: "google_ads_context_by_cbsa", cbsaCode: "38060" }, { snapshotDir: outputDir });
  assert.equal(ads.rows.length, 2);
  assert.ok(ads.rows.every((row) => row.evidenceStatus === "Hypothesis" || row.evidenceStatus === "Derived"));
  assert.equal(ads.scoringEligibility, "none");
});

const actualSnapshotDir = resolve(".local-data/normalized-market-data");
test("actual supplied snapshot preserves observed coverage and demo boundaries", { skip: !existsSync(join(actualSnapshotDir, "manifest.json")) }, async () => {
  const manifest = JSON.parse(await readFile(join(actualSnapshotDir, "manifest.json"), "utf8")) as { sourceFiles: unknown[]; seoIncluded: boolean; coverage: Array<{ datasetId: string; sourceRowCount: number; coverageRate: number }> };
  assert.equal(manifest.sourceFiles.length, 12);
  assert.equal(manifest.seoIncluded, false);
  assert.equal(manifest.coverage.find((item) => item.datasetId === "google_ads_search_shopping")?.sourceRowCount, 210);
  assert.equal(manifest.coverage.find((item) => item.datasetId === "google_ads_vet_clinic_search")?.sourceRowCount, 175);
  assert.ok((manifest.coverage.find((item) => item.datasetId === "clinic_profile")?.coverageRate ?? 0) > 0.99);
});
