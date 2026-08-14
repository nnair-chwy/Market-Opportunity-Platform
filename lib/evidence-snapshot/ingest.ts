import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { snapshotManifestSchema, type SnapshotManifest, type SnapshotReadiness, SNAPSHOT_CALCULATION_VERSION, SNAPSHOT_QUERY_VERSION } from "./contracts.ts";
import { closeDuckDb, duckDbPath, openDuckDb, snapshotDirectory, sqlString } from "./duckdb.ts";
import { csvReadSql, inspectSourceFiles, sourceDirectory } from "./source-registry.ts";

export const TABLE_FILES = {
  "market-context.json": "market_context", "zip-market.json": "zip_market", "cbsa-population.json": "cbsa_population", "zip-context.json": "zip_context", "regional-demand.json": "regional_demand", "clinic-market-summary.json": "clinic_market_summary", "clinic-performance-market-summary.json": "clinic_performance_market_summary", "candidate-sites.json": "candidate_sites", "appointment-context.json": "appointment_context", "retention-baseline.json": "retention_baseline", "zip-metro.json": "zip_metro",
} as const;

const KEY_COLUMNS: Record<string, string[]> = {
  market_context: ["marketId", "reportingDate"], zip_market: ["zip"], cbsa_population: ["cbsaCode"], zip_context: ["zip"], regional_demand: ["zip", "year"], clinic_market_summary: ["cbsaName"], clinic_performance_market_summary: ["cbsaName"], candidate_sites: ["siteId"], appointment_context: ["geography", "reportingMonth", "appointmentType", "appointmentState", "reason"], retention_baseline: ["reportingYear", "reportingWeek", "aggregationLevel", "businessChannel"], zip_metro: ["zip", "metro", "state"],
};
const DATE_COLUMNS: Record<string, string> = { market_context: "reportingDate", regional_demand: "year", appointment_context: "reportingMonth", retention_baseline: "weekStartDate" };
const ALLOWED_ROW_KEYS: Record<string, string[]> = {
  market_context: ["marketId", "cbsaCode", "cbsaName", "reportingDate", "priorYearReportingDate", "activeCustomerCount", "priorYearActiveCustomerCount", "activeCustomerYoyGrowth", "totalHouseholds", "activeCustomersPer1000Households", "qualityStatus", "censusContext", "source"],
  zip_market: ["zip", "cbsaName", "csaName", "statisticalAreaType", "source"], cbsa_population: ["cbsaCode", "statisticalAreaType", "populationEstimate", "source"], zip_context: ["zip", "households", "medianHouseholdIncome", "families", "source"], regional_demand: ["zip", "year", "netSalesExcludingRefunds", "netSales", "source"],
  clinic_market_summary: ["cbsaName", "marketId", "clinicCount", "totalOrders", "totalVetsCapped", "corporateClinicCount", "practiceHubClinicCount", "pharmacyBusinessClinicCount", "rowsWithHouseholdContext", "cbsaCode", "censusHouseholdCount", "clinicDensityPer10000Households", "clinicDensityStatus", "source", "status"], clinic_performance_market_summary: ["cbsaName", "marketId", "clinicCount", "totalCustomers", "totalOrders", "rxOrders", "netSales", "rxNetSales", "netSalesChange", "timeframes", "cbsaCode", "source", "status"], candidate_sites: ["siteId", "siteName", "brand", "latitude", "longitude", "state", "marketName", "marketId", "cbsaName", "workflowStage", "sourceId", "evidenceStatus", "sensitivity", "allowedUse", "scoringEligibility"], appointment_context: ["geography", "reportingMonth", "appointmentType", "appointmentState", "reason", "appointmentCount", "source"], retention_baseline: ["loadDate", "reportingYear", "reportingPeriod", "reportingWeek", "weekStartDate", "weekEndDate", "aggregationLevel", "businessChannel", "totalCustomers", "potentialCount", "recentCount", "lapsedCount", "inactiveCount", "churnedCount", "newlyAcquired", "source"], zip_metro: ["zip", "metro", "state", "source"],
};

function hash(content: string) { return createHash("sha256").update(content).digest("hex"); }
function rowKeys(table: string, row: Record<string, unknown>): string | null { const columns = KEY_COLUMNS[table]; if (!columns || columns.some((column) => row[column] === null || row[column] === undefined)) return null; return columns.map((column) => String(row[column])).join("|"); }

export async function validateManifest(dir = snapshotDirectory()): Promise<{ manifest: SnapshotManifest; files: Record<string, string>; rows: Record<string, unknown[]> }> {
  const manifestPath = join(dir, "manifest.json");
  const manifest = snapshotManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  const expected = new Set(["manifest.json", "README.md", ...manifest.outputs.map((output) => basename(output.path))]);
  const filesInDir = await readdir(dir);
  const unexpected = filesInDir.filter((file) => !expected.has(file));
  if (unexpected.length) throw new Error(`Unexpected snapshot files: ${unexpected.join(", ")}`);
  const files: Record<string, string> = {};
  const rows: Record<string, unknown[]> = {};
  for (const output of manifest.outputs) {
    const file = basename(output.path);
    if (!(file in TABLE_FILES)) throw new Error(`Unexpected manifest output: ${output.path}`);
    const content = await readFile(join(dir, file), "utf8");
    if (hash(content) !== output.sha256) throw new Error(`Hash mismatch for ${file}`);
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error(`Expected an array in ${file}`);
    if (parsed.length !== output.rowCount) throw new Error(`Row-count mismatch for ${file}: expected ${output.rowCount}, got ${parsed.length}`);
    const table = TABLE_FILES[file as keyof typeof TABLE_FILES];
    rows[table] = parsed;
    files[table] = join(dir, file);
    for (const row of parsed.slice(0, 1)) {
      if (!row || typeof row !== "object") throw new Error(`Malformed row in ${file}`);
      const actualKeys = Object.keys(row).sort(); const expectedKeys = [...(ALLOWED_ROW_KEYS[TABLE_FILES[file as keyof typeof TABLE_FILES]] ?? [])].sort();
      if (actualKeys.join("|") !== expectedKeys.join("|")) throw new Error(`Unexpected schema for ${file}`);
    }
  }
  if (Object.keys(rows).length !== Object.keys(TABLE_FILES).length) throw new Error("Snapshot output set is incomplete");
  return { manifest, files, rows };
}

export async function ingestSnapshot(options: { snapshotDir?: string; databasePath?: string } = {}) {
  const dir = options.snapshotDir ?? snapshotDirectory();
  const { manifest, files, rows } = await validateManifest(dir);
  const configuredSourceDirectory = sourceDirectory();
  const sourceRecords = configuredSourceDirectory ? await inspectSourceFiles(configuredSourceDirectory) : [];
  const handle = await openDuckDb(options.databasePath ?? duckDbPath());
  const { connection } = handle;
  await connection.run("DROP TABLE IF EXISTS snapshot_registry; DROP TABLE IF EXISTS snapshot_table_registry;");
  if (sourceRecords.length) await connection.run("DROP TABLE IF EXISTS source_registry;");
  await connection.run("CREATE TABLE snapshot_registry (snapshot_version VARCHAR PRIMARY KEY, manifest_version VARCHAR, built_at TIMESTAMP, source_type VARCHAR, evidence_status VARCHAR, allowed_use VARCHAR, scoring_status VARCHAR, manifest_valid BOOLEAN, known_issues JSON);");
  await connection.run("CREATE TABLE snapshot_table_registry (snapshot_version VARCHAR, table_name VARCHAR, file_name VARCHAR, expected_row_count BIGINT, actual_row_count BIGINT, sha256 VARCHAR, grain VARCHAR, sensitivity VARCHAR, allowed_use VARCHAR, source_ids JSON, date_min VARCHAR, date_max VARCHAR, duplicate_key_count BIGINT, quality_warning_count BIGINT);");
  await connection.run("CREATE TABLE IF NOT EXISTS source_registry (snapshot_version VARCHAR, dataset_id VARCHAR, table_name VARCHAR, source_id VARCHAR, file_name VARCHAR, file_path VARCHAR, sha256 VARCHAR, expected_grain VARCHAR, sensitivity VARCHAR, allowed_use VARCHAR, ai_exposure VARCHAR, row_count BIGINT, column_names JSON);");
  for (const [table, path] of Object.entries(files)) {
    await connection.run(`DROP TABLE IF EXISTS ${table}; CREATE TABLE ${table} AS SELECT * FROM read_json_auto(${sqlString(path)}, records=true, format='array');`);
    const tableRows = rows[table] as Record<string, unknown>[];
    const output = manifest.outputs.find((item) => basename(item.path) === Object.keys(TABLE_FILES).find((file) => TABLE_FILES[file as keyof typeof TABLE_FILES] === table));
    const sourceIds = [...new Set(tableRows.map((row) => typeof row.sourceId === "string" ? row.sourceId : typeof row.source === "object" && row.source !== null && typeof (row.source as Record<string, unknown>).sourceId === "string" ? (row.source as Record<string, unknown>).sourceId : null).filter(Boolean))];
    const keys = tableRows.map((row) => rowKeys(table, row)).filter((key): key is string => Boolean(key));
    const duplicateKeyCount = keys.length - new Set(keys).size;
    const dateColumn = DATE_COLUMNS[table];
    const dates = tableRows.map((row) => row[dateColumn]).filter((value) => value !== null && value !== undefined).map(String).sort();
    const warningCount = tableRows.filter((row) => row.qualityStatus === "warning" || (typeof row.source === "object" && row.source !== null && (row.source as Record<string, unknown>).qualityStatus === "warning")).length;
    const sensitivity = tableRows.find((row) => typeof row.sensitivity === "string" || (typeof row.source === "object" && row.source !== null))?.sensitivity as string ?? ((tableRows[0]?.source as Record<string, unknown> | undefined)?.sensitivity as string ?? "unknown");
    const allowedUse = tableRows[0]?.allowedUse as string ?? ((tableRows[0]?.source as Record<string, unknown> | undefined)?.allowedUse as string ?? "unknown");
    await connection.run("INSERT INTO snapshot_table_registry VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [manifest.snapshotVersion, table, basename(path), output?.rowCount ?? tableRows.length, tableRows.length, output?.sha256 ?? "", output?.grain ?? "", sensitivity, allowedUse, JSON.stringify(sourceIds), dates[0] ?? null, dates.at(-1) ?? null, duplicateKeyCount, warningCount]);
  }
  await connection.run("INSERT INTO snapshot_registry VALUES (?, ?, ?, ?, ?, ?, ?, true, ?)", [manifest.snapshotVersion, manifest.manifestVersion, manifest.builtAt, manifest.sourceType, manifest.evidenceStatus, manifest.allowedUse, manifest.scoringStatus, JSON.stringify(manifest.knownIssues)]);
  for (const record of sourceRecords) {
    await connection.run(`DROP TABLE IF EXISTS ${record.tableName}; CREATE TABLE ${record.tableName} AS SELECT * FROM ${csvReadSql(record.filePath)};`);
    await connection.run("INSERT INTO source_registry VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [manifest.snapshotVersion, record.datasetId, record.tableName, record.sourceId, record.fileName, record.filePath, record.sha256, record.expectedGrain, record.sensitivity, record.allowedUse, record.aiExposure, record.rowCount, JSON.stringify(record.columnNames)]);
  }
  if (!sourceRecords.length) {
    try {
      const existing = await connection.runAndReadAll("SELECT DISTINCT dataset_id FROM source_registry ORDER BY dataset_id");
      const existingRows = existing.getRowObjectsJson();
      await closeDuckDb(handle);
      return { snapshotVersion: manifest.snapshotVersion, databasePath: options.databasePath ?? duckDbPath(), manifest, sourceDatasetsLoaded: existingRows.map((row) => String(row.dataset_id)) };
    } catch {
      // The database may be a first-time snapshot-only database without raw source tables.
    }
  }
  await closeDuckDb(handle);
  return { snapshotVersion: manifest.snapshotVersion, databasePath: options.databasePath ?? duckDbPath(), manifest, sourceDatasetsLoaded: sourceRecords.length };
}

export async function snapshotReadiness(options: { snapshotDir?: string; databasePath?: string } = {}): Promise<SnapshotReadiness> {
  let validated: Awaited<ReturnType<typeof validateManifest>>;
  try { validated = await validateManifest(options.snapshotDir ?? snapshotDirectory()); } catch (error) { return { snapshotVersion: "unknown", manifestValid: false, tables: [], unmatchedGeographyCounts: {}, qualityWarningCount: 0, sensitivitySummary: {}, allowedUseSummary: {}, restrictedDatasetsExcluded: [], sourceDatasetsLoaded: [], knownIssues: [error instanceof Error ? error.message : "Manifest validation failed."], status: "blocked", queryVersion: SNAPSHOT_QUERY_VERSION, calculationVersion: SNAPSHOT_CALCULATION_VERSION }; }
  const { manifest, rows } = validated;
  const tables = manifest.outputs.map((output) => {
    const table = TABLE_FILES[basename(output.path) as keyof typeof TABLE_FILES];
    const tableRows = rows[table] as Record<string, unknown>[];
    const keys = tableRows.map((row) => rowKeys(table, row)).filter((key): key is string => Boolean(key));
    const nullCounts: Record<string, number> = {};
    for (const row of tableRows.slice(0, 1)) for (const key of Object.keys(row)) nullCounts[key] = tableRows.filter((candidate) => candidate[key] === null || candidate[key] === undefined).length;
    const dateColumn = DATE_COLUMNS[table]; const dates = tableRows.map((row) => row[dateColumn]).filter((value) => value != null).map(String).sort();
    const source = tableRows[0]?.source as Record<string, unknown> | undefined;
    return { tableName: table, expectedRowCount: output.rowCount, actualRowCount: tableRows.length, hashValid: true, dateRange: { min: dates[0] ?? null, max: dates.at(-1) ?? null }, duplicateKeyCount: keys.length - new Set(keys).size, nullCounts, sensitivity: String(tableRows[0]?.sensitivity ?? source?.sensitivity ?? "unknown"), allowedUse: String(tableRows[0]?.allowedUse ?? source?.allowedUse ?? output.allowedUse) };
  });
  const marketRows = rows.market_context as Record<string, unknown>[];
  const zipMarketRows = rows.zip_market as Record<string, unknown>[];
  const zipContext = new Set((rows.zip_context as Record<string, unknown>[]).map((row) => row.zip));
  const unmatched = { unmatchedCbsaNames: marketRows.filter((row) => row.marketId == null).length, zipBridgeWithoutContext: zipMarketRows.filter((row) => !zipContext.has(row.zip)).length, marketRowsWithoutZipBridge: 0, unresolvedClinicPhysicalLocationIdentity: 1, unresolvedClinicPerformanceOutcomeRules: 1 };
  const qualityWarningCount = tables.reduce((sum, table) => sum + table.duplicateKeyCount, 0) + unmatched.unmatchedCbsaNames + unmatched.zipBridgeWithoutContext;
  const sensitivitySummary = Object.groupBy(tables, (table) => table.sensitivity); const allowedUseSummary = Object.groupBy(tables, (table) => table.allowedUse);
  const status = unmatched.unmatchedCbsaNames || unmatched.zipBridgeWithoutContext || manifest.knownIssues.length ? "ready_with_warnings" : "ready";
  let sourceDatasetsLoaded: string[] = [];
  try { sourceDatasetsLoaded = (await inspectSourceFiles(sourceDirectory() ?? undefined)).map((record) => record.datasetId); } catch (error) { sourceDatasetsLoaded = []; manifest.knownIssues.push(`Source CSV registry unavailable: ${error instanceof Error ? error.message : "unknown error"}`); }
  if (!sourceDatasetsLoaded.length) {
    try {
      const handle = await openDuckDb(options.databasePath ?? duckDbPath(), true);
      const reader = await handle.connection.runAndReadAll("SELECT DISTINCT dataset_id FROM source_registry ORDER BY dataset_id");
      sourceDatasetsLoaded = reader.getRowObjectsJson().map((row) => String(row.dataset_id));
      await closeDuckDb(handle);
    } catch {
      // A snapshot-only database has no raw source registry yet.
    }
  }
  return { snapshotVersion: manifest.snapshotVersion, manifestValid: true, tables, unmatchedGeographyCounts: unmatched, qualityWarningCount, sensitivitySummary: Object.fromEntries(Object.entries(sensitivitySummary).map(([key, value]) => [key, value?.length ?? 0])), allowedUseSummary: Object.fromEntries(Object.entries(allowedUseSummary).map(([key, value]) => [key, value?.length ?? 0])), restrictedDatasetsExcluded: tables.filter((table) => ["confidential", "restricted"].includes(table.sensitivity)).map((table) => table.tableName), sourceDatasetsLoaded, knownIssues: [...manifest.knownIssues, "No universal score authorization."], status, queryVersion: SNAPSHOT_QUERY_VERSION, calculationVersion: SNAPSHOT_CALCULATION_VERSION };
}
