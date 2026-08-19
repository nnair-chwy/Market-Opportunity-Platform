import assert from "node:assert/strict";
import test from "node:test";
import { executionEvidenceItemSchema, type ExecutionEvidenceItem } from "../lib/evidence-snapshot/contracts.ts";
import {
  crosswalkMetadataSchema,
  reconcileEvidenceCompatibility,
  type CrosswalkMetadata,
} from "../lib/planning/evidence-compatibility.ts";

function item(overrides: Partial<ExecutionEvidenceItem> & Pick<ExecutionEvidenceItem, "evidenceId" | "metricId" | "geographyId" | "geographyLabel" | "sourceId">) {
  return executionEvidenceItemSchema.parse({
    rawValue: 10,
    structuredValue: null,
    unit: "count",
    snapshotId: "snapshot-v1",
    evidenceStatus: "Reported",
    qualityStatus: "accepted",
    observationStart: "2026-01-01",
    observationEnd: "2026-01-31",
    period: { kind: "date_range", start: "2026-01-01", end: "2026-01-31", label: "January 2026" },
    reportScope: null,
    currency: null,
    allowedUse: "internal_shadow_evaluation_only",
    sensitivity: "internal",
    warning: null,
    origin: "frozen_csv_snapshot",
    ...overrides,
  });
}

function approvedCrosswalk(overrides: Partial<CrosswalkMetadata> = {}) {
  return crosswalkMetadataSchema.parse({
    crosswalkId: "approved-zip-dma-2026",
    version: "2026.1",
    fromGeography: "zip",
    toGeography: "dma",
    approvalStatus: "approved",
    approvedBy: "GIS governance",
    approvedAt: "2026-08-18T12:00:00.000Z",
    method: "weighted_allocation",
    coverage: { inputCount: 100, matchedCount: 100, unmatchedCount: 0, coverageRate: 1 },
    unmatchedIds: [],
    allocation: { mode: "many_to_one", weightBasis: "reviewed population allocation", weightsValidated: true },
    notes: ["Test fixture only."],
    ...overrides,
  });
}

test("unlike geographic grains remain separate without an approved crosswalk", () => {
  const report = reconcileEvidenceCompatibility([
    item({ evidenceId: "zip-spend", metricId: "spend", geographyId: "zip:98101", geographyLabel: "ZIP 98101", sourceId: "ADS" }),
    item({ evidenceId: "dma-orders", metricId: "orders", geographyId: "dma:819", geographyLabel: "Seattle DMA", sourceId: "ORDERS" }),
  ], { operation: "join" });

  assert.equal(report.status, "not_combinable");
  assert.equal(report.canCombine, false);
  assert.deepEqual(report.geographyTypes, ["dma", "zip"]);
  assert.ok(report.issues.some((issue) => issue.type === "geography_crosswalk_missing" && issue.severity === "error"));
  assert.match(report.conclusionBoundary, /investigation may continue/i);
});

test("provisional crosswalk metadata is fail-visible and cannot masquerade as production approval", () => {
  const provisional = approvedCrosswalk({
    crosswalkId: "candidate-zip-dma",
    version: "draft-1",
    approvalStatus: "provisional",
    approvedBy: null,
    approvedAt: null,
  });
  const report = reconcileEvidenceCompatibility([
    item({ evidenceId: "zip", metricId: "spend", geographyId: "zip:98101", geographyLabel: "ZIP 98101", sourceId: "ADS" }),
    item({ evidenceId: "dma", metricId: "orders", geographyId: "dma:819", geographyLabel: "Seattle DMA", sourceId: "ORDERS" }),
  ], { operation: "join", crosswalks: [provisional] });

  assert.equal(report.canCombine, false);
  assert.ok(report.issues.some((issue) => issue.type === "geography_crosswalk_provisional"));
});

test("approved complete crosswalk metadata permits a bounded join", () => {
  const report = reconcileEvidenceCompatibility([
    item({ evidenceId: "zip", metricId: "spend", geographyId: "zip:98101", geographyLabel: "ZIP 98101", sourceId: "ADS" }),
    item({ evidenceId: "dma", metricId: "orders", geographyId: "dma:819", geographyLabel: "Seattle DMA", sourceId: "ORDERS" }),
  ], { operation: "join", crosswalks: [approvedCrosswalk()] });

  assert.equal(report.status, "compatible");
  assert.equal(report.canCombine, true);
  assert.equal(report.issues.length, 0);
});

test("crosswalk coverage and unvalidated allocation remain explicit", () => {
  const report = reconcileEvidenceCompatibility([
    item({ evidenceId: "trade", metricId: "appointments", geographyId: "trade_area:a", geographyLabel: "Trade area A", sourceId: "CVC" }),
    item({ evidenceId: "drive", metricId: "capacity", geographyId: "drive_time:a", geographyLabel: "30-minute drive time", sourceId: "OPS" }),
  ], {
    operation: "join",
    crosswalks: [approvedCrosswalk({
      crosswalkId: "trade-drive-candidate",
      fromGeography: "trade_area",
      toGeography: "drive_time",
      coverage: { inputCount: 10, matchedCount: 8, unmatchedCount: 2, coverageRate: 0.8 },
      unmatchedIds: ["trade-9", "trade-10"],
      allocation: { mode: "many_to_many", weightBasis: "unknown", weightsValidated: false },
    })],
  });

  assert.equal(report.canCombine, false);
  assert.ok(report.issues.some((issue) => issue.type === "geography_coverage_gap"));
  assert.ok(report.issues.some((issue) => issue.type === "geography_allocation_unvalidated"));
});

test("period, metric-definition, unit, duplicates, missingness, and contradictions are reconciled", () => {
  const evidence = [
    item({
      evidenceId: "orders-a",
      metricId: "orders",
      geographyId: "cbsa:42660",
      geographyLabel: "Seattle CBSA",
      sourceId: "SOURCE-A",
      rawValue: 100,
      unit: "count",
      structuredValue: { metricDefinitionId: "orders-v1" },
    }),
    item({
      evidenceId: "orders-b",
      metricId: "orders",
      geographyId: "cbsa:42660",
      geographyLabel: "Seattle CBSA",
      sourceId: "SOURCE-B",
      rawValue: 120,
      unit: "count",
      structuredValue: { metricDefinitionId: "orders-v1" },
    }),
    item({
      evidenceId: "orders-c",
      metricId: "orders",
      geographyId: "cbsa:42660",
      geographyLabel: "Seattle CBSA",
      sourceId: "SOURCE-C",
      rawValue: 0.4,
      unit: "percentage",
      structuredValue: { metricDefinitionId: "orders-v2" },
      period: { kind: "date_range", start: "2025-01-01", end: "2025-01-31", label: "January 2025" },
      observationStart: "2025-01-01",
      observationEnd: "2025-01-31",
    }),
    item({
      evidenceId: "orders-a-duplicate",
      metricId: "orders",
      geographyId: "cbsa:42660",
      geographyLabel: "Seattle CBSA",
      sourceId: "SOURCE-A",
      rawValue: 100,
      unit: "count",
      structuredValue: { metricDefinitionId: "orders-v1" },
    }),
    item({
      evidenceId: "missing-period",
      metricId: "contribution",
      geographyId: "customer:cohort-a",
      geographyLabel: "Customer geography cohort A",
      sourceId: "FINANCE",
      rawValue: null,
      structuredValue: { state: "suppressed" },
      unit: null,
      period: { kind: "not_provided", start: null, end: null, label: "Period not provided" },
      observationStart: null,
      observationEnd: null,
    }),
  ];
  const report = reconcileEvidenceCompatibility(evidence, { operation: "compare" });
  const issueTypes = new Set(report.issues.map((issue) => issue.type));

  assert.ok(issueTypes.has("duplicate_observation"));
  assert.ok(issueTypes.has("missing_value"));
  assert.ok(issueTypes.has("time_period_missing"));
  assert.ok(issueTypes.has("time_period_nonoverlap"));
  assert.ok(issueTypes.has("metric_definition_conflict"));
  assert.ok(issueTypes.has("unit_conflict"));
  assert.ok(issueTypes.has("contradiction"));
  assert.equal(report.status, "not_combinable");
  assert.equal(report.summary.duplicateCount, 1);
  assert.ok(report.summary.contradictionCount >= 1);
});

test("approved crosswalk claims require versioned approval metadata", () => {
  assert.throws(() => approvedCrosswalk({ version: null }), /requires a version, approver, and approval time/i);
});
