import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { evidenceExecutionRequestSchema, evidenceExecutionResponseSchema } from "../lib/evidence-snapshot/contracts.ts";
import { executeEvidenceRequest } from "../lib/evidence-snapshot/execute.ts";
import { closeDuckDb, openDuckDb } from "../lib/evidence-snapshot/duckdb.ts";

const snapshotDir = resolve(process.env.CLINIC_MARKET_SNAPSHOT_DIR?.trim() || ".local-data/clinic-market-snapshot");
const databasePath = resolve(process.env.DUCKDB_PATH?.trim() || ".local/evidence-snapshot.duckdb");
const actualSnapshotAvailable = existsSync(join(snapshotDir, "manifest.json")) && existsSync(databasePath);
const actualSnapshotTest = actualSnapshotAvailable ? test : test.skip;

const requestBase = {
  snapshotVersion: "clinic-market-demo-2026-08-17-v1",
  requestedAt: "2026-08-17T00:00:00.000Z",
  executionMode: "frozen_snapshot_demo",
  questionId: "question-demo",
  planId: "plan-demo",
} as const;

function response(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "request-demo",
    status: "complete",
    snapshotVersion: requestBase.snapshotVersion,
    queryVersion: "canonical-evidence-query-v1",
    calculationVersion: "canonical-evidence-projection-v1",
    query: "canonical_market_evidence",
    componentQueries: ["canonical_market_evidence"],
    capability: null,
    planId: "plan-demo",
    originalQuestion: null,
    geographyIds: ["cbsa:38060"],
    missingApprovals: [],
    guardrails: [],
    rows: [{ metricId: "market.active_customer_count", value: 10 }],
    evidenceBundle: [{
      evidenceId: "evidence-1",
      metricId: "market.active_customer_count",
      geographyId: "cbsa:38060",
      geographyLabel: "Phoenix-Mesa-Chandler, AZ",
      rawValue: 10,
      structuredValue: null,
      unit: "customers",
      sourceId: "SOURCE-1",
      snapshotId: requestBase.snapshotVersion,
      evidenceStatus: "Reported",
      qualityStatus: "accepted",
      observationStart: null,
      observationEnd: "2026-07-31",
      allowedUse: "approved_internal_decision_support",
      sensitivity: "internal",
      warning: null,
      origin: "frozen_csv_snapshot",
    }],
    sourceIds: ["SOURCE-1"],
    qualityWarnings: [],
    missingEvidence: [],
    unknowns: [],
    allowedUse: "approved_internal_decision_support",
    sensitivity: "internal",
    executionMode: "frozen_snapshot_demo",
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

test("response contract distinguishes complete, partial, blocked, and failed results", () => {
  assert.equal(evidenceExecutionResponseSchema.parse(response()).status, "complete");
  assert.equal(evidenceExecutionResponseSchema.parse(response({ status: "partial", missingEvidence: ["One metric is missing."] })).status, "partial");
  assert.equal(evidenceExecutionResponseSchema.parse(response({ status: "blocked", rows: [], evidenceBundle: [], sourceIds: [], missingEvidence: ["Approval is missing."] })).status, "blocked");
  assert.equal(evidenceExecutionResponseSchema.parse(response({ status: "failed", rows: [], evidenceBundle: [], sourceIds: [], errorCode: "QUERY_FAILED", errorMessage: "Registered query failed." })).status, "failed");
});

test("response contract preserves null metrics inside structured evidence", () => {
  const parsed = evidenceExecutionResponseSchema.parse(response({
    query: "google_ads_matched_location_context",
    status: "partial",
    rows: [{ conversions: null }],
    evidenceBundle: [{ ...response().evidenceBundle[0], metricId: "google_ads.matched_location_context", geographyId: null, rawValue: null, structuredValue: { conversions: null }, unit: null }],
    missingEvidence: ["Conversions are unavailable."],
  }));
  assert.equal((parsed.evidenceBundle[0]!.structuredValue as { conversions: null }).conversions, null);
});

test("response contract rejects mislabeled synthetic, confidential, restricted, or unprovenanced evidence", () => {
  const item = response().evidenceBundle[0] as Record<string, unknown>;
  assert.equal(evidenceExecutionResponseSchema.safeParse(response({ evidenceBundle: [{ ...item, origin: "synthetic_demo_fixture", evidenceStatus: "Confirmed" }] })).success, false);
  assert.equal(evidenceExecutionResponseSchema.safeParse(response({ evidenceBundle: [{ ...item, sensitivity: "confidential" }], sensitivity: "confidential" })).success, false);
  assert.equal(evidenceExecutionResponseSchema.safeParse(response({ evidenceBundle: [{ ...item, sensitivity: "restricted" }], sensitivity: "restricted" })).success, false);
  const { sourceId: _sourceId, ...withoutSource } = item;
  void _sourceId;
  assert.equal(evidenceExecutionResponseSchema.safeParse(response({ evidenceBundle: [withoutSource] })).success, false);
  const { snapshotId: _snapshotId, ...withoutSnapshot } = item;
  void _snapshotId;
  assert.equal(evidenceExecutionResponseSchema.safeParse(response({ evidenceBundle: [withoutSnapshot] })).success, false);
});

test("execution request rejects unknown queries and invalid exact geography keys", () => {
  assert.equal(evidenceExecutionRequestSchema.safeParse({ ...requestBase, requestId: "bad-query", query: "arbitrary_sql", parameters: { sql: "select 1" } }).success, false);
  assert.equal(evidenceExecutionRequestSchema.safeParse({ ...requestBase, requestId: "bad-market", query: "canonical_market_evidence", parameters: { marketId: "Phoenix" } }).success, false);
});

actualSnapshotTest("executes a valid canonical Parquet query with stable ordering and provenance", async () => {
  const request = { ...requestBase, requestId: "market-request", query: "canonical_market_evidence", parameters: { marketId: "cbsa:38060" } } as const;
  const first = await executeEvidenceRequest(request, { snapshotDir, databasePath });
  const second = await executeEvidenceRequest(request, { snapshotDir, databasePath });
  assert.equal(first.status, "complete");
  assert.equal(first.rows.length, 5);
  assert.equal(first.evidenceBundle.length, 5);
  assert.ok(first.evidenceBundle.some((item) => item.metricId === "market.active_customer_yoy_growth"));
  assert.equal(first.evidenceBundle.every((item) => item.snapshotId === requestBase.snapshotVersion && item.sourceId.length > 0), true);
  assert.deepEqual(first, second);
  assert.deepEqual(first.evidenceBundle.map((item) => item.evidenceId), [...first.evidenceBundle.map((item) => item.evidenceId)].sort());
});

actualSnapshotTest("returns Google Ads matched-location context without claiming market geography", async () => {
  const result = await executeEvidenceRequest({ ...requestBase, requestId: "ads-request", query: "google_ads_matched_location_context", parameters: { reportScope: "chewy-vet-clinic-seach" } }, { snapshotDir, databasePath });
  assert.equal(result.status, "partial");
  assert.equal(result.rows.length, 175);
  assert.equal(result.evidenceBundle.every((item) => item.geographyId === null && item.allowedUse === "matched_location_descriptive_context_only"), true);
  assert.ok(result.missingEvidence.some((item) => /stable Google Ads geography IDs/i.test(item)));
  assert.ok(result.unknowns.some((item) => /CBSA geography is unknown/i.test(item)));
});

actualSnapshotTest("surfaces a stale frozen-source warning without changing values", async () => {
  const result = await executeEvidenceRequest({ ...requestBase, requestedAt: "2030-08-17T00:00:00.000Z", requestId: "stale-market", query: "canonical_market_evidence", parameters: { marketId: "cbsa:38060" } }, { snapshotDir, databasePath });
  assert.equal(result.status, "complete");
  assert.equal(result.evidenceBundle.length, 5);
  assert.ok(result.qualityWarnings.some((item) => /exceeding the 400-day demo freshness threshold/i.test(item)));
});

actualSnapshotTest("returns approved internal clinic aggregates at the response boundary", async () => {
  const result = await executeEvidenceRequest({ ...requestBase, requestId: "clinic-request", query: "canonical_clinic_performance", parameters: { marketId: "cbsa:38060" } }, { snapshotDir, databasePath });
  assert.ok(["complete", "partial"].includes(result.status));
  assert.equal(result.sensitivity, "internal");
  assert.ok(result.rows.length > 0);
  assert.ok(result.evidenceBundle.length > 0);
  assert.ok(result.evidenceBundle.every((item) => item.sensitivity === "internal" && item.allowedUse !== "none"));
});

actualSnapshotTest("returns structured failure for missing snapshots without opening DuckDB", async () => {
  let opened = 0;
  const result = await executeEvidenceRequest({ ...requestBase, requestId: "missing-snapshot", query: "canonical_market_evidence", parameters: { marketId: "cbsa:38060" } }, { snapshotDir: join(tmpdir(), "does-not-exist-evidence-snapshot"), databasePath, openDatabase: async (...args) => { opened += 1; return openDuckDb(...args); } });
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "SNAPSHOT_VALIDATION_FAILED");
  assert.equal(opened, 0);
});

test("returns structured failure for an invalid snapshot hash", async () => {
  const dir = await mkdtemp(join(tmpdir(), "invalid-canonical-snapshot-"));
  await mkdir(dir, { recursive: true });
  const sourceStatus = JSON.stringify({ manifestVersion: "demo-source-status-v1", snapshotVersion: requestBase.snapshotVersion, builtAt: "2026-08-17T00:00:00.000Z", rawExportsCopied: false, families: ["general_regional", "clinic", "google_ads", "seo", "pricing", "competitor"].map((sourceFamily) => ({ sourceFamily, status: "unavailable", evidenceStatus: "Unknown", qualityStatus: "blocked", geographyStatus: "unavailable", allowedUse: "unavailable", files: [], limitations: ["Unavailable in test."] })) }, null, 2);
  await writeFile(join(dir, "evidence_observations.parquet"), "not parquet");
  await writeFile(join(dir, "source-status.json"), sourceStatus);
  await writeFile(join(dir, "manifest.json"), JSON.stringify({ manifestVersion: "test-v1", snapshotVersion: requestBase.snapshotVersion, builtAt: "2026-08-17T00:00:00.000Z", sourceType: "test", rawExportsCopied: false, outputs: [{ path: "evidence_observations.parquet", sha256: "0".repeat(64), bytes: 11 }, { path: "source-status.json", sha256: createHash("sha256").update(sourceStatus).digest("hex"), bytes: Buffer.byteLength(sourceStatus) }], knownIssues: [], queryVersion: "test-query-v1", calculationVersion: "test-calculation-v1" }));
  const result = await executeEvidenceRequest({ ...requestBase, requestId: "bad-hash", query: "canonical_market_evidence", parameters: { marketId: "cbsa:38060" } }, { snapshotDir: dir, databasePath });
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "SNAPSHOT_VALIDATION_FAILED");
  assert.match(result.errorMessage ?? "", /Hash mismatch/);
});

actualSnapshotTest("closes DuckDB after success and registered-query failure", async () => {
  let successfulCloses = 0;
  const success = await executeEvidenceRequest({ ...requestBase, requestId: "cleanup-success", query: "canonical_market_evidence", parameters: { marketId: "cbsa:38060" } }, { snapshotDir, databasePath, closeDatabase: async (handle) => { successfulCloses += 1; await closeDuckDb(handle); } });
  assert.equal(success.status, "complete");
  assert.equal(successfulCloses, 1);

  let failureCloses = 0;
  const realHandle = await openDuckDb(databasePath, true);
  const failed = await executeEvidenceRequest({ ...requestBase, requestId: "cleanup-failure", query: "canonical_market_evidence", parameters: { marketId: "cbsa:38060" } }, {
    snapshotDir,
    databasePath,
    openDatabase: async () => ({ ...realHandle, connection: { runAndReadAll: async () => { throw new Error("Injected DuckDB failure"); } } } as unknown as typeof realHandle),
    closeDatabase: async () => { failureCloses += 1; await closeDuckDb(realHandle); },
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.errorCode, "REGISTERED_QUERY_FAILED");
  assert.equal(failureCloses, 1);
});
