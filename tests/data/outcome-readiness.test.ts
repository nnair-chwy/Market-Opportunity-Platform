import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFirstPartyOutcomeReadiness, discoverApprovedSources, outcomeReadinessMissingEvidence, type LocalApprovedSourceInventory } from "../../lib/data-discovery/index.ts";
import { GET as getSourceReadiness } from "../../app/api/source-readiness/route.ts";

async function reportFor(files: Record<string, string>) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "outcome-readiness-"));
  const approvedRoot = path.join(workspaceRoot, "data", "approved", "outcomes");
  await mkdir(approvedRoot, { recursive: true });
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(approvedRoot, name), content);
  const inventory: LocalApprovedSourceInventory = {
    version: "test-v1",
    workspace: "test",
    packages: [{
      id: "outcomes",
      root: "data/approved/outcomes",
      sensitivity: "internal",
      allowedUse: "internal_shadow_regional_outcome_validation_only",
      files: Object.keys(files).map((name) => ({ file: `data/approved/outcomes/${name}`, bytes: 1, sha256: "b".repeat(64), agentUse: "approved_local_source_file" })),
    }],
  };
  const registry = await discoverApprovedSources({ workspaceRoot, inventory, generatedAt: "2026-08-18T00:00:00.000Z" });
  return buildFirstPartyOutcomeReadiness(registry);
}

test("nominates an aggregate regional outcome file for typed adapters without making a query executable", async () => {
  const report = await reportFor({
    "regional-outcomes.csv": "CBSA_CODE,WEEK_START_DATE,DISTINCT_ORDERS,NEW_CUSTOMER_COUNT,CONTRIBUTION\n38060,2026-08-03,75,12,1820.55\n",
  });
  for (const outcomeId of ["regional_orders", "new_customers", "contribution_profit"] as const) {
    const outcome = report.outcomes.find((item) => item.outcomeId === outcomeId);
    assert.equal(outcome?.status, "ready");
    assert.equal(outcome?.candidateCount, 1);
  }
  assert.equal(report.adapterCandidates.length, 1);
  assert.equal(report.adapterCandidates[0]?.allowedQuery, "none_until_contract_review");
  assert.equal(report.summary.executableQueryCount, 0);
});

test("reports an outcome metric with incompatible geography and missing time instead of promoting it", async () => {
  const report = await reportFor({ "national-orders.csv": "COUNTRY,TOTAL_ORDERS\nUS,1000\n" });
  const orders = report.outcomes.find((item) => item.outcomeId === "regional_orders");
  assert.equal(orders?.status, "gap");
  const assessment = orders?.assessments[0];
  assert.equal(assessment?.status, "incompatible");
  assert.ok(assessment?.missingRequirements.some((item) => item.includes("geography")));
  assert.ok(assessment?.missingRequirements.includes("bounded observation period"));
});

test("blocks raw customer rows even when outcome, geography, and time columns are present", async () => {
  const report = await reportFor({
    "raw-customer-orders.csv": "CUSTOMER_ID,ZIP_CODE,ORDER_DATE,ORDER_COUNT\nC-1,02110,2026-08-18,1\n",
  });
  const orders = report.outcomes.find((item) => item.outcomeId === "regional_orders");
  assert.equal(orders?.status, "gap");
  assert.equal(orders?.assessments[0]?.status, "blocked_sensitive");
  assert.match(orders?.assessments[0]?.warnings.join(" ") ?? "", /identifier|restricted/i);
  assert.equal(report.adapterCandidates.length, 0);
});

test("keeps all six first-party outcomes as explicit gaps when no approved file satisfies the contracts", async () => {
  const report = await reportFor({ "context.csv": "CBSA_CODE,REPORTING_DATE,POPULATION\n38060,2026-08-18,1000\n" });
  assert.equal(report.summary.gapOutcomeCount, 6);
  assert.equal(outcomeReadinessMissingEvidence(report).length, 6);
  assert.match(outcomeReadinessMissingEvidence(report).join(" "), /regional orders.*new customers.*contribution.*clinic capacity.*appointments.*mature-clinic/i);
});

test("exposes a compact product summary without source paths or column metadata", async () => {
  const response = await getSourceReadiness();
  assert.equal(response.status, 200);
  const body = await response.json() as { outcomes: unknown[]; summary: { gapOutcomeCount: number } };
  assert.equal(body.outcomes.length, 6);
  assert.equal(body.summary.gapOutcomeCount, 6);
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("relativePath"), false);
  assert.equal(serialized.includes("columns"), false);
  assert.equal(serialized.includes("sha256"), false);
});
