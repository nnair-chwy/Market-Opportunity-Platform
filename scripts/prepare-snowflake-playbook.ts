import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  adaptClinicIdentity,
  adaptClinicPerformance,
  adaptMarketContext,
  adaptZipSales,
} from "../lib/adapters/snowflake-csv/index.ts";
import { prepareClinicSiteReview } from "../lib/playbooks/clinic-site-evaluation.ts";

const inputDir = process.env.SNOWFLAKE_EXPORT_DIR?.trim();
if (!inputDir) {
  throw new Error("Set SNOWFLAKE_EXPORT_DIR to the directory containing the approved CSV exports.");
}
const files = {
  market: resolve(inputDir, process.env.SNOWFLAKE_MARKET_FILE ?? "cbsa_market_attractiveness.csv"),
  clinicIdentity: resolve(inputDir, process.env.SNOWFLAKE_CLINIC_PROFILE_FILE ?? "clinic_profile.csv"),
  clinicPerformance: resolve(inputDir, process.env.SNOWFLAKE_CLINIC_ACTIVITY_FILE ?? "clinic_activity.csv"),
  demand: resolve(inputDir, process.env.SNOWFLAKE_ZIP_SALES_FILE ?? "zip_sales.csv"),
};

const market = adaptMarketContext(await readFile(files.market, "utf8"));
const identity = adaptClinicIdentity(await readFile(files.clinicIdentity, "utf8"));
const performance = adaptClinicPerformance(await readFile(files.clinicPerformance, "utf8"));
const demand = adaptZipSales(await readFile(files.demand, "utf8"));
const firstMarket = market.records[0];
const review = prepareClinicSiteReview({
  marketId: firstMarket?.marketId ?? "unassigned:1",
  marketContext: market,
  demand,
  clinicIdentity: identity,
  clinicPerformance: performance,
});

const output = {
  generatedAt: new Date().toISOString(),
  rawExportsRemainOutsideRepository: true,
  status: review.status,
  blockers: review.blockers,
  counts: {
    marketContextRecords: market.records.length,
    clinicIdentityRecords: identity.records.length,
    clinicPerformanceRecords: performance.records.length,
    demandRecords: demand.records.length,
  },
  warningCounts: {
    market: market.warnings.length,
    clinicIdentity: identity.warnings.length,
    clinicPerformance: performance.warnings.length,
    demand: demand.warnings.length,
  },
  note: "This is a readiness receipt, not a scoring result. No raw rows are written.",
};

const outputDir = resolve(process.env.SNOWFLAKE_REPORT_DIR ?? "reports/snowflake-latest");
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "clinic-review-readiness.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
