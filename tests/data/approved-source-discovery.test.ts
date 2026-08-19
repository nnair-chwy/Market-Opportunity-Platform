import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { discoverApprovedSources, formatForFile, readTableSample, type LocalApprovedSourceInventory } from "../../lib/data-discovery/index.ts";
import { closeDuckDb, openDuckDb, sqlString } from "../../lib/evidence-snapshot/duckdb.ts";

async function fixture() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "approved-source-discovery-"));
  const approvedRoot = path.join(workspaceRoot, "data", "approved", "incoming");
  await mkdir(approvedRoot, { recursive: true });
  await writeFile(path.join(approvedRoot, "regional-orders.csv"), [
    "DMA_CODE,REPORTING_WEEK,NET_SALES,ORDER_COUNT,CUSTOMER_EMAIL",
    "501,2026-08-03,1250.25,42,hidden@example.test",
    "504,2026-08-03,800.00,29,hidden2@example.test",
  ].join("\n"));
  await writeFile(path.join(approvedRoot, "clinic-capacity.tsv"), "CLINIC_ID\tSTATE\tREPORTING_MONTH\tAPPOINTMENT_COUNT\nC1\tAZ\t2026-07\t120\n");
  await writeFile(path.join(approvedRoot, "context.json"), JSON.stringify([{ CBSA_CODE: "38060", YEAR: 2025, POPULATION: 1000 }]));
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("prices").addRows([["ZIP_CODE", "AS_OF_DATE", "PRICE"], ["85001", "2026-08-18", 22.5]]);
  await workbook.xlsx.writeFile(path.join(approvedRoot, "prices.xlsx"));
  const files = ["regional-orders.csv", "clinic-capacity.tsv", "context.json", "prices.xlsx"].map((name) => ({
    file: `data/approved/incoming/${name}`,
    bytes: 1,
    sha256: "a".repeat(64),
    agentUse: "approved_local_source_file",
  }));
  const inventory: LocalApprovedSourceInventory = {
    version: "test-inventory-v1",
    workspace: "test-workspace",
    packages: [{ id: "incoming-test", root: "data/approved/incoming", sensitivity: "internal", allowedUse: "local_demo_aggregate_only", files }],
  };
  return { workspaceRoot, approvedRoot, inventory };
}

test("discovers supported files under configured approved roots without retaining raw values", async () => {
  const { workspaceRoot, inventory } = await fixture();
  const registry = await discoverApprovedSources({ workspaceRoot, inventory, generatedAt: "2026-08-18T00:00:00.000Z", maxSampleRows: 10 });
  assert.equal(registry.summary.profiledFileCount, 4);
  assert.deepEqual(registry.profiles.map((profile) => profile.format), ["tsv", "json", "xlsx", "csv"]);
  assert.equal(registry.rawRowsStored, false);
  assert.equal(JSON.stringify(registry).includes("hidden@example.test"), false);

  const orders = registry.profiles.find((profile) => profile.relativePath.endsWith("regional-orders.csv"));
  assert.ok(orders);
  assert.equal(orders.geography.grain, "dma");
  assert.equal(orders.time.grain, "week");
  assert.deepEqual(orders.metrics.map((metric) => metric.field), ["NET_SALES", "ORDER_COUNT"]);
  assert.equal(orders.inferredSensitivity, "restricted");
  assert.equal(orders.integration.queryEligibility, "profile_only");
  assert.ok(orders.uncertainties.some((item) => item.field === "sensitivity"));
});

test("new files inside an approved root are discovered but require inventory review", async () => {
  const { workspaceRoot, approvedRoot, inventory } = await fixture();
  await writeFile(path.join(approvedRoot, "new-export.csv"), "ZIP_CODE,ORDERS\n02110,5\n");
  const registry = await discoverApprovedSources({ workspaceRoot, inventory, generatedAt: "2026-08-18T00:00:00.000Z" });
  const profile = registry.profiles.find((item) => item.relativePath.endsWith("new-export.csv"));
  assert.equal(profile?.approvalState, "review_required");
  assert.equal(profile?.evidenceStatus, "Unknown");
  assert.equal(profile?.integration.queryEligibility, "profile_only");
});

test("rejects configured traversal and never follows symbolic links", async () => {
  const { workspaceRoot, approvedRoot, inventory } = await fixture();
  await symlink(path.join(workspaceRoot, "data"), path.join(approvedRoot, "escape"));
  const registry = await discoverApprovedSources({ workspaceRoot, inventory, generatedAt: "2026-08-18T00:00:00.000Z" });
  assert.ok(registry.skipped.some((item) => item.reason.includes("Symbolic links")));

  const invalid = structuredClone(inventory);
  invalid.packages[0].root = "../outside";
  await assert.rejects(() => discoverApprovedSources({ workspaceRoot, inventory: invalid }), /without traversal/);
});

test("recognizes the full approved tabular format allowlist", () => {
  assert.equal(formatForFile("a.csv"), "csv");
  assert.equal(formatForFile("a.tsv"), "tsv");
  assert.equal(formatForFile("a.jsonl"), "json");
  assert.equal(formatForFile("a.xlsx"), "xlsx");
  assert.equal(formatForFile("a.parquet"), "parquet");
  assert.equal(formatForFile("a.pdf"), null);
});

test("profiles Parquet schema and row count through the server-only DuckDB boundary", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "approved-parquet-discovery-"));
  const file = path.join(workspaceRoot, "regional.parquet");
  const handle = await openDuckDb(":memory:");
  try {
    await handle.connection.run(`COPY (SELECT '38060' AS CBSA_CODE, DATE '2026-08-18' AS AS_OF_DATE, 42::INTEGER AS ORDER_COUNT) TO ${sqlString(file)} (FORMAT PARQUET)`);
  } finally {
    await closeDuckDb(handle);
  }
  const sample = await readTableSample(file, "parquet", 10);
  assert.deepEqual(sample.columns, ["CBSA_CODE", "AS_OF_DATE", "ORDER_COUNT"]);
  assert.equal(sample.rowCount, 1);
  assert.equal(sample.rows.length, 1);
});
