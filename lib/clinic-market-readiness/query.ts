import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { closeDuckDb, openDuckDb, sqlString } from "../evidence-snapshot/duckdb.ts";
import { readinessRequestSchema, type QualityReport } from "./contracts.ts";
import { buildReadinessPacket } from "./readiness.ts";

export async function queryClinicMarketReadiness(input: unknown, options: { snapshotDir: string; databasePath: string }) {
  const request = readinessRequestSchema.parse(input);
  const manifest = JSON.parse(await readFile(join(options.snapshotDir, "manifest.json"), "utf8")) as { snapshotVersion: string };
  if (manifest.snapshotVersion !== request.snapshotVersion) throw new Error(`Snapshot ${request.snapshotVersion} is unavailable.`);
  const qualityReport = JSON.parse(await readFile(join(options.snapshotDir, "quality-report.json"), "utf8")) as QualityReport;
  const handle = await openDuckDb(options.databasePath, true);
  try {
    const path = join(options.snapshotDir, "evidence_observations.parquet");
    const reader = await handle.connection.runAndReadAll(`SELECT * FROM read_parquet(${sqlString(path)}) WHERE market_id = ? ORDER BY observation_id`, [request.marketId]);
    return buildReadinessPacket({ snapshotVersion: request.snapshotVersion, marketId: request.marketId, observations: reader.getRowObjectsJson(), qualityReport });
  } finally {
    await closeDuckDb(handle);
  }
}
