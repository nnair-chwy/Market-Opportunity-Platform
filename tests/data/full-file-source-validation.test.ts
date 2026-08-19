import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { discoverApprovedSources, validateDiscoveredOutcomeSource, type FirstPartyOutcomeId, type LocalApprovedSourceInventory } from "../../lib/data-discovery/index.ts";
import { closeDuckDb, openDuckDb, sqlString } from "../../lib/evidence-snapshot/duckdb.ts";

async function discoveredFixture(name: string, write: (file: string) => Promise<void>, sensitivity: "internal" | "restricted" = "internal") {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "full-source-validation-"));
  const approvedRoot = "data/approved/outcomes";
  const directory = path.join(workspaceRoot, approvedRoot);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, name);
  await write(file);
  const content = await readFile(file);
  const inventory: LocalApprovedSourceInventory = {
    version: "test-v1",
    workspace: "test",
    packages: [{
      id: "outcomes",
      root: approvedRoot,
      sensitivity,
      allowedUse: "internal_shadow_regional_outcome_validation_only",
      files: [{ file: `${approvedRoot}/${name}`, bytes: content.length, sha256: createHash("sha256").update(content).digest("hex"), agentUse: "approved_local_source_file" }],
    }],
  };
  const registry = await discoverApprovedSources({ workspaceRoot, inventory, generatedAt: "2026-08-18T00:00:00.000Z" });
  return { workspaceRoot, approvedRoot, file, profile: registry.profiles[0]! };
}

async function validate(name: string, write: (file: string) => Promise<void>, outcomeIds: FirstPartyOutcomeId[]) {
  const fixture = await discoveredFixture(name, write);
  return validateDiscoveredOutcomeSource({ workspaceRoot: fixture.workspaceRoot, approvedRoot: fixture.approvedRoot, profile: fixture.profile, outcomeIds });
}

test("validates every CSV row and emits a no-row semantic contract pending owner review", async () => {
  const report = await validate("regional.csv", async (file) => writeFile(file, "CBSA_CODE,WEEK_START_DATE,DISTINCT_ORDERS,NEW_CUSTOMER_COUNT,CONTRIBUTION\n38060,2026-08-03,75,12,1820.55\n42660,2026-08-03,81,15,2120.10\n"), ["regional_orders", "new_customers", "contribution_profit"]);
  assert.equal(report.status, "structurally_valid_candidate");
  assert.equal(report.rowsValidated, 2);
  assert.equal(report.distinctGrainKeys, 2);
  assert.equal(report.semanticContract?.queryEligibility, "none_pending_semantic_approval");
  assert.equal(report.semanticContract?.metrics.length, 3);
  assert.equal(report.rawRowsStored, false);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("1820.55"), false);
  assert.equal(serialized.includes("38060"), false);
});

test("fails closed on duplicate grain keys and invalid full-file values missed by a sample", async () => {
  const rows = ["CBSA_CODE,WEEK_START_DATE,DISTINCT_ORDERS", "38060,2026-08-03,75"];
  for (let index = 0; index < 205; index += 1) rows.push(`${40000 + index},2026-08-03,${index + 1}`);
  rows.push("38060,2026-08-03,76");
  rows.push("49999,not-a-date,not-a-number");
  const report = await validate("bad-tail.csv", async (file) => writeFile(file, rows.join("\n")), ["regional_orders"]);
  assert.equal(report.status, "failed_closed");
  assert.ok(report.duplicateRowCount > 0);
  assert.match(report.failures.join(" "), /duplicate.*invalid/i);
  assert.equal(report.semanticContract, null);
});

test("fails before reading when geography is ambiguous or sensitivity is restricted", async () => {
  const ambiguous = await discoveredFixture("ambiguous.csv", async (file) => writeFile(file, "CBSA_CODE,STATE,REPORTING_DATE,TOTAL_ORDERS\n38060,AZ,2026-08-18,10\n"));
  const ambiguousReport = await validateDiscoveredOutcomeSource({ workspaceRoot: ambiguous.workspaceRoot, approvedRoot: ambiguous.approvedRoot, profile: ambiguous.profile, outcomeIds: ["regional_orders"] });
  assert.equal(ambiguousReport.status, "failed_closed");
  assert.match(ambiguousReport.failures.join(" "), /geography is ambiguous/i);

  const sensitive = await discoveredFixture("sensitive.csv", async (file) => writeFile(file, "CUSTOMER_ID,ZIP_CODE,ORDER_DATE,ORDER_COUNT\nC-1,02110,2026-08-18,1\n"), "restricted");
  const sensitiveReport = await validateDiscoveredOutcomeSource({ workspaceRoot: sensitive.workspaceRoot, approvedRoot: sensitive.approvedRoot, profile: sensitive.profile, outcomeIds: ["regional_orders"] });
  assert.equal(sensitiveReport.status, "failed_closed");
  assert.match(sensitiveReport.failures.join(" "), /sensitivity|identifier/i);
  assert.equal(sensitiveReport.semanticContract, null);
});

test("full validation supports TSV, bounded XLSX, and Parquet candidates", async () => {
  const tsv = await validate("regional.tsv", async (file) => writeFile(file, "CBSA_CODE\tWEEK_START_DATE\tTOTAL_ORDERS\n38060\t2026-08-03\t75\n"), ["regional_orders"]);
  assert.equal(tsv.status, "structurally_valid_candidate");

  const xlsx = await validate("regional.xlsx", async (file) => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("outcomes").addRows([["CBSA_CODE", "WEEK_START_DATE", "TOTAL_ORDERS"], ["38060", "2026-08-03", 75]]);
    await workbook.xlsx.writeFile(file);
  }, ["regional_orders"]);
  assert.equal(xlsx.status, "structurally_valid_candidate");

  const parquet = await validate("regional.parquet", async (file) => {
    const handle = await openDuckDb(":memory:");
    try { await handle.connection.run(`COPY (SELECT '38060' AS CBSA_CODE, '2026-08-03' AS WEEK_START_DATE, 75 AS TOTAL_ORDERS) TO ${sqlString(file)} (FORMAT PARQUET)`); }
    finally { await closeDuckDb(handle); }
  }, ["regional_orders"]);
  assert.equal(parquet.status, "structurally_valid_candidate");
});

test("fails closed when bytes no longer match the approved inventory hash", async () => {
  const fixture = await discoveredFixture("changed.csv", async (file) => writeFile(file, "CBSA_CODE,WEEK_START_DATE,TOTAL_ORDERS\n38060,2026-08-03,75\n"));
  await writeFile(fixture.file, "CBSA_CODE,WEEK_START_DATE,TOTAL_ORDERS\n38060,2026-08-03,999\n");
  const report = await validateDiscoveredOutcomeSource({ workspaceRoot: fixture.workspaceRoot, approvedRoot: fixture.approvedRoot, profile: fixture.profile, outcomeIds: ["regional_orders"] });
  assert.equal(report.status, "failed_closed");
  assert.match(report.failures.join(" "), /SHA-256/i);
});
