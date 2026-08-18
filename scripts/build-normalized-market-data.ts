import { resolve } from "node:path";
import { buildNormalizedMarketData } from "../lib/data-normalization/build.ts";

const sourceDir = process.env.MARKET_DATA_DIR?.trim();
if (!sourceDir) throw new Error("Set MARKET_DATA_DIR to the folder containing General Regional, Clinic, and Google Ads.");

const result = await buildNormalizedMarketData({
  sourceDir: resolve(sourceDir),
  outputDir: process.env.NORMALIZED_MARKET_DATA_DIR?.trim(),
  snapshotVersion: process.env.NORMALIZED_MARKET_DATA_VERSION?.trim(),
});

console.log(JSON.stringify({
  snapshotVersion: result.manifest.snapshotVersion,
  outputDir: result.outputDir,
  sourceFiles: result.manifest.sourceFiles.length,
  outputs: result.manifest.outputs.length,
  coverage: result.manifest.coverage.map((item) => ({ datasetId: item.datasetId, sourceRows: item.sourceRowCount, coverageRate: item.coverageRate, inferred: item.inferredCount, reviewRequired: item.reviewRequiredCount })),
}, null, 2));
