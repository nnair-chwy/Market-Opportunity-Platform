import assert from "node:assert/strict";
import test from "node:test";
import { executionEvidenceItemSchema, type ExecutionEvidenceItem } from "../lib/evidence-snapshot/contracts.ts";
import { buildAdSpendEvidencePlan } from "../lib/planning/ad-spend-evidence-plan.ts";
import { crosswalkMetadataSchema } from "../lib/planning/evidence-compatibility.ts";

function item(overrides: Partial<ExecutionEvidenceItem> & Pick<ExecutionEvidenceItem, "evidenceId" | "metricId" | "geographyId" | "geographyLabel" | "sourceId">) {
  return executionEvidenceItemSchema.parse({
    rawValue: 10,
    structuredValue: { metricDefinitionId: `${overrides.metricId}-v1` },
    unit: "count",
    snapshotId: "ad-spend-plan-fixture-v1",
    evidenceStatus: "Reported",
    qualityStatus: "accepted",
    observationStart: "2026-08-01",
    observationEnd: "2026-08-14",
    period: { kind: "date_range", start: "2026-08-01", end: "2026-08-14", label: "2026-08-01 to 2026-08-14" },
    reportScope: "bounded ad-spend fixture",
    currency: null,
    allowedUse: "internal_shadow_evaluation",
    sensitivity: "internal",
    warning: null,
    origin: "frozen_csv_snapshot",
    ...overrides,
  });
}

test("classifies cross-team ad-spend evidence by decision role", () => {
  const evidence = [
    item({ evidenceId: "spend", metricId: "paid_search_spend", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "MARKETING", unit: "currency_units" }),
    item({ evidenceId: "orders", metricId: "completed_orders", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "FINANCE" }),
    item({ evidenceId: "cohort", metricId: "campaign_cohort_id", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "MARKETING" }),
    item({ evidenceId: "coverage", metricId: "geography_coverage", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "GOVERNANCE", unit: "ratio" }),
    item({ evidenceId: "attribution", metricId: "attribution_lag_window", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "MARKETING" }),
    item({ evidenceId: "experiment", metricId: "test_control_design_power", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "SCIENCE" }),
    item({ evidenceId: "operations", metricId: "operational_guardrails", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "OPS" }),
  ];
  const plan = buildAdSpendEvidencePlan({ question: "Where should we increase paid search spend?", evidence });
  assert.equal(plan.evidence.find((entry) => entry.evidenceId === "orders")?.classification, "recommendation_driver");
  assert.equal(plan.evidence.find((entry) => entry.evidenceId === "cohort")?.classification, "validity_gate");
  assert.equal(plan.evidence.find((entry) => entry.evidenceId === "spend")?.classification, "context");
  assert.ok(plan.missingRequiredFields.some((field) => field.field === "new_customers"));
  assert.ok(plan.missingRequiredFields.some((field) => field.field === "contribution_profit"));
  assert.equal(plan.status, "not_ready");
  assert.match(plan.conclusionBoundary, /no spend or campaign change is authorized/i);
});

test("unlike DMA and CBSA evidence cannot become a joined ad-spend recommendation without a crosswalk", () => {
  const plan = buildAdSpendEvidencePlan({
    question: "Should we change regional ad spend?",
    evidence: [
      item({ evidenceId: "dma-spend", metricId: "paid_search_spend", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "MARKETING", unit: "currency_units" }),
      item({ evidenceId: "cbsa-orders", metricId: "completed_orders", geographyId: "cbsa:12060", geographyLabel: "Atlanta CBSA", sourceId: "FINANCE" }),
    ],
  });
  assert.equal(plan.compatibility.canCombine, false);
  assert.equal(plan.evidence.find((entry) => entry.evidenceId === "cbsa-orders")?.usableForRecommendation, false);
  assert.ok(plan.compatibility.issues.some((issue) => issue.type === "geography_crosswalk_missing"));
  assert.match(plan.readinessReason, /cannot be combined/i);
});

test("an approved complete crosswalk permits compatibility but does not fabricate missing validity gates", () => {
  const crosswalk = crosswalkMetadataSchema.parse({
    crosswalkId: "approved-dma-cbsa-v1",
    version: "1.0.0",
    fromGeography: "dma",
    toGeography: "cbsa",
    approvalStatus: "approved",
    approvedBy: "GIS governance",
    approvedAt: "2026-08-18T12:00:00.000Z",
    method: "weighted_allocation",
    coverage: { inputCount: 1, matchedCount: 1, unmatchedCount: 0, coverageRate: 1 },
    unmatchedIds: [],
    allocation: { mode: "many_to_one", weightBasis: "reviewed household allocation", weightsValidated: true },
    notes: ["Fixture only."],
  });
  const plan = buildAdSpendEvidencePlan({
    question: "Where should paid search spend change?",
    crosswalks: [crosswalk],
    evidence: [
      item({ evidenceId: "dma-spend", metricId: "paid_search_spend", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "MARKETING", unit: "currency_units" }),
      item({ evidenceId: "cbsa-orders", metricId: "completed_orders", geographyId: "cbsa:12060", geographyLabel: "Atlanta CBSA", sourceId: "FINANCE" }),
    ],
  });
  assert.equal(plan.compatibility.canCombine, true);
  assert.equal(plan.evidence.find((entry) => entry.evidenceId === "cbsa-orders")?.usableForRecommendation, true);
  assert.equal(plan.status, "not_ready");
  assert.ok(plan.missingRequiredFields.some((field) => field.field === "test_control_design"));
});

test("contradictory observations and unavailable values cannot act as recommendation drivers", () => {
  const plan = buildAdSpendEvidencePlan({
    question: "Where should we adjust media spend?",
    evidence: [
      item({ evidenceId: "orders-a", metricId: "completed_orders", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "FINANCE-A", rawValue: 100 }),
      item({ evidenceId: "orders-b", metricId: "completed_orders", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "FINANCE-B", rawValue: 120 }),
      item({ evidenceId: "profit-missing", metricId: "contribution_profit", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "FINANCE", rawValue: null, structuredValue: { state: "suppressed" } }),
    ],
  });
  assert.equal(plan.evidence.find((entry) => entry.evidenceId === "orders-a")?.classification, "contradiction");
  assert.equal(plan.evidence.find((entry) => entry.evidenceId === "orders-b")?.classification, "contradiction");
  assert.equal(plan.evidence.find((entry) => entry.evidenceId === "profit-missing")?.classification, "unavailable");
  assert.equal(plan.counts.contradictions, 2);
  assert.equal(plan.counts.unavailable, 1);
  assert.equal(plan.status, "not_ready");
});

test("non-overlapping spend and outcome periods remain a visible validity warning", () => {
  const plan = buildAdSpendEvidencePlan({
    question: "Where should paid search spend change?",
    evidence: [
      item({ evidenceId: "january-spend", metricId: "paid_search_spend", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "MARKETING", unit: "currency_units", observationStart: "2026-01-01", observationEnd: "2026-01-31", period: { kind: "date_range", start: "2026-01-01", end: "2026-01-31", label: "January 2026" } }),
      item({ evidenceId: "august-orders", metricId: "completed_orders", geographyId: "dma:524", geographyLabel: "Atlanta DMA", sourceId: "FINANCE", observationStart: "2026-08-01", observationEnd: "2026-08-14", period: { kind: "date_range", start: "2026-08-01", end: "2026-08-14", label: "August 2026" } }),
    ],
  });
  assert.ok(plan.compatibility.issues.some((issue) => issue.type === "time_period_nonoverlap" && issue.evidenceIds.includes("january-spend") && issue.evidenceIds.includes("august-orders")));
  assert.equal(plan.evidence.find((entry) => entry.evidenceId === "august-orders")?.usableForRecommendation, false);
  assert.equal(plan.status, "not_ready");
});

test("rejects non-ad-spend decisions", () => {
  assert.throws(() => buildAdSpendEvidencePlan({ question: "Where should a clinic open?", evidence: [] }), /ad-spend decisions only/i);
});

test("accepts plain-language requests to spend more on ads", () => {
  const result = buildAdSpendEvidencePlan({ question: "where should we spend more on ads", evidence: [] });
  assert.equal(result.status, "not_ready");
  assert.ok(result.missingRequiredFields.some((item) => item.field === "completed_orders"));
});
