import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  EXPLORATORY_QUERY_VERSION,
  compileExploratoryQuery,
  executeExploratoryQuery,
  exploratoryQuerySpecSchema,
} from "../lib/insight-discovery/exploratory-query.ts";
import { closeDuckDb, openDuckDb } from "../lib/evidence-snapshot/duckdb.ts";
import {
  DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
  NORMALIZATION_VERSION,
  NORMALIZED_CALCULATION_VERSION,
  NORMALIZED_QUERY_VERSION,
} from "../lib/data-normalization/contracts.ts";

const usefulJoin = {
  version: EXPLORATORY_QUERY_VERSION,
  tables: ["demand", "ads"],
  joins: [{ leftTableId: "demand", rightTableId: "ads", on: "cbsaCode" }],
  groupBy: ["cbsaCode", "cbsaName"],
  measures: [
    { tableId: "demand", column: "netSales", aggregation: "sum" },
    { tableId: "ads", column: "spend", aggregation: "sum" },
    { tableId: "ads", column: "conversions", aggregation: "sum" },
  ],
  filters: [
    { tableId: "demand", column: "year", operator: "eq", value: 2025 },
    { tableId: "ads", column: "reportScope", operator: "eq", value: "Vet Clinic Search" },
  ],
  orderBy: [{ kind: "measure", measureIndex: 0, direction: "desc" }],
  limit: 20,
} as const;

test("the app compiles a useful cross-source aggregate with parameterized values and CBSA equality only", () => {
  const compiled = compileExploratoryQuery(usefulJoin);
  assert.match(compiled.sql, /normalized_regional_demand_by_cbsa_year/);
  assert.match(compiled.sql, /normalized_google_ads_by_cbsa/);
  assert.match(compiled.sql, /INNER JOIN/);
  assert.match(compiled.sql, /"source_0"\."cbsaCode" = "source_1"\."cbsaCode"/);
  assert.match(compiled.sql, /LIMIT 20$/);
  assert.deepEqual(compiled.parameters, [2025, "Vet Clinic Search"]);
  assert.doesNotMatch(compiled.sql, /Vet Clinic Search|2025/);
  assert.deepEqual(compiled.selectedColumns, ["demand.netSales", "ads.spend", "ads.conversions"]);
});

test("raw SQL, unknown columns, non-CBSA joins, and excessive bounds are rejected before execution", () => {
  assert.equal(exploratoryQuerySpecSchema.safeParse({ ...usefulJoin, sql: "SELECT * FROM secrets" }).success, false);
  assert.equal(exploratoryQuerySpecSchema.safeParse({
    ...usefulJoin,
    measures: [{ tableId: "demand", column: "customerEmail", aggregation: "count_distinct" }],
  }).success, false);
  assert.equal(exploratoryQuerySpecSchema.safeParse({
    ...usefulJoin,
    joins: [{ leftTableId: "demand", rightTableId: "ads", on: "year" }],
  }).success, false);
  assert.equal(exploratoryQuerySpecSchema.safeParse({ ...usefulJoin, tables: ["demand", "ads", "market", "census"] }).success, false);
  assert.equal(exploratoryQuerySpecSchema.safeParse({ ...usefulJoin, limit: 51 }).success, false);
});

test("the executor performs the cross-source query against read-only DuckDB and returns full lineage", async (t) => {
  const snapshotDir = await mkdtemp(path.join(tmpdir(), "exploratory-query-"));
  const databasePath = path.join(snapshotDir, "normalized-market-data.duckdb");
  const handle = await openDuckDb(databasePath);
  await handle.connection.run(`
    CREATE TABLE normalized_regional_demand_by_cbsa_year (
      cbsaCode VARCHAR, cbsaName VARCHAR, year INTEGER, netSales DOUBLE, sourceId VARCHAR
    );
    INSERT INTO normalized_regional_demand_by_cbsa_year VALUES
      ('12060', 'Atlanta-Sandy Springs-Roswell, GA', 2025, 1200, 'SNOWFLAKE-CSV-REGIONAL-DEMAND'),
      ('19740', 'Denver-Aurora-Centennial, CO', 2025, 900, 'SNOWFLAKE-CSV-REGIONAL-DEMAND'),
      ('12060', 'Atlanta-Sandy Springs-Roswell, GA', 2024, 800, 'SNOWFLAKE-CSV-REGIONAL-DEMAND');
    CREATE TABLE normalized_google_ads_by_cbsa (
      cbsaCode VARCHAR, cbsaName VARCHAR, reportScope VARCHAR, spend DOUBLE, conversions DOUBLE, sourceId VARCHAR
    );
    INSERT INTO normalized_google_ads_by_cbsa VALUES
      ('12060', 'Atlanta-Sandy Springs-Roswell, GA', 'Vet Clinic Search', 100, 25, 'GOOGLE-ADS-CVC'),
      ('19740', 'Denver-Aurora-Centennial, CO', 'Vet Clinic Search', 150, 30, 'GOOGLE-ADS-CVC'),
      ('12060', 'Atlanta-Sandy Springs-Roswell, GA', 'Retail Search', 500, 80, 'GOOGLE-ADS-RETAIL');
  `);
  await closeDuckDb(handle);
  const database = await readFile(databasePath);
  const details = await stat(databasePath);
  await writeFile(path.join(snapshotDir, "manifest.json"), `${JSON.stringify({
    manifestVersion: "normalized-market-snapshot-v1",
    snapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
    queryVersion: NORMALIZED_QUERY_VERSION,
    calculationVersion: NORMALIZED_CALCULATION_VERSION,
    builtAt: "2026-08-20T12:00:00.000Z",
    censusUniverseVersion: "2023-07",
    censusSourceId: "SRC-014",
    sourceRootStored: false,
    rawExportsCopied: false,
    seoIncluded: false,
    purpose: "local_demo_geography_normalization",
    sourceFiles: [],
    outputs: [{ tableName: "normalized_database", path: path.basename(databasePath), rowCount: 6, bytes: details.size, sha256: createHash("sha256").update(database).digest("hex"), grain: "registered normalized tables" }],
    coverage: [],
    warnings: [],
    exclusions: [],
  }, null, 2)}\n`);
  t.after(async () => { /* Temporary fixture is removed by the operating system. */ });

  const response = await executeExploratoryQuery(usefulJoin, { snapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION, snapshotDir });
  assert.equal(response.rows.length, 2);
  assert.equal(response.rows[0]?.cbsaCode, "12060");
  assert.equal(response.rows[0]?.measure_0, 1200);
  assert.equal(response.rows[0]?.measure_1, 100);
  assert.equal(response.rows[0]?.measure_2, 25);
  assert.equal(response.lineage.readOnly, true);
  assert.equal(response.lineage.joinRule, "cbsaCode_equality_only");
  assert.equal(response.lineage.parametersBound, 2);
  assert.deepEqual(response.lineage.tableIds, ["demand", "ads"]);
  assert.deepEqual(response.lineage.tables[0]?.sourceIds, ["SNOWFLAKE-CSV-REGIONAL-DEMAND"]);
  assert.deepEqual(response.lineage.tables[1]?.sourceIds, ["GOOGLE-ADS-CVC"]);
  assert.equal(response.lineage.queryFingerprint.length, 64);
});
