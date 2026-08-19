import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceExecutionResponse, ExecutionEvidenceItem } from "../lib/evidence-snapshot/contracts.ts";
import { marketInvestigationFromEvidence } from "../lib/planning/evidence-market-investigation.ts";
import { planEvaluation } from "../lib/planning/planner.ts";
import { assembleReviewableActionPacket, proposedActionFromPlan } from "../lib/planning/reviewable-packet.ts";

function item(overrides: Partial<ExecutionEvidenceItem> & Pick<ExecutionEvidenceItem, "evidenceId" | "metricId" | "rawValue" | "unit" | "sourceId">): ExecutionEvidenceItem {
  return {
    geographyId: "cbsa:12060",
    geographyLabel: "Atlanta-Sandy Springs-Roswell, GA",
    structuredValue: null,
    snapshotId: "ordinary-multi-source-v1",
    evidenceStatus: "Reported",
    qualityStatus: "accepted",
    observationStart: "2026-07-01",
    observationEnd: "2026-07-31",
    period: { kind: "date_range", start: "2026-07-01", end: "2026-07-31", label: "2026-07-01 to 2026-07-31" },
    reportScope: "ordinary multi-source regression",
    currency: null,
    allowedUse: "local_demo_aggregate_decision_support",
    sensitivity: "internal",
    warning: null,
    origin: "frozen_csv_snapshot",
    ...overrides,
  };
}

test("ordinary multi-source evidence reaches investigation, completion evaluation, and bounded next pass", () => {
  const question = "Show regional, clinic, and Google Ads evidence for Atlanta.";
  const plan = planEvaluation(question, "marketing");
  assert.equal(plan.intent.topic, "multi_source_evidence");
  const evidenceBundle = [
    item({ evidenceId: "regional-atlanta", metricId: "normalized.active_customer_count", rawValue: 1200, unit: "customers", sourceId: "SRC-REGIONAL" }),
    item({ evidenceId: "clinic-atlanta", metricId: "normalized.total_orders", rawValue: 420, unit: "orders", sourceId: "SRC-CLINIC" }),
    item({ evidenceId: "ads-atlanta", metricId: "normalized.google_ads_spend", rawValue: 2500, unit: "USD", sourceId: "SRC-ADS", currency: "USD", qualityStatus: "warning", warning: "Ads geography remains an inferred local-demo join." }),
  ];
  const response: EvidenceExecutionResponse = {
    requestId: "ordinary-multi-source",
    status: "partial",
    snapshotVersion: "ordinary-multi-source-v1",
    queryVersion: "registered-query-v1",
    calculationVersion: "bundle-v1",
    query: "normalized_evidence_bundle",
    componentQueries: ["regional_context_by_cbsa", "clinic_context_by_cbsa", "google_ads_context_by_cbsa"],
    capability: plan.capabilityId,
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    geographyIds: ["cbsa:12060"],
    rows: [],
    evidenceBundle,
    sourceIds: ["SRC-REGIONAL", "SRC-CLINIC", "SRC-ADS"],
    qualityWarnings: ["Source periods and grains require compatibility review."],
    missingEvidence: ["Approved regional contribution and incrementality evidence is not connected."],
    missingApprovals: [],
    unknowns: ["The Ads geography join is not provider-stable."],
    allowedUse: "local_demo_aggregate_decision_support",
    sensitivity: "internal",
    guardrails: ["Do not authorize spend from descriptive evidence."],
    executionMode: "frozen_snapshot_demo",
    errorCode: null,
    errorMessage: null,
  };

  const investigation = marketInvestigationFromEvidence(plan, response);
  assert.ok(investigation);
  assert.equal(investigation.originalQuestion, question);
  assert.deepEqual(investigation.sourceIds, response.sourceIds);
  assert.equal(investigation.leads.length, 1);
  assert.ok(investigation.reconciliation);
  assert.equal(investigation.reconciliation.observationCount, evidenceBundle.length);
  assert.match(investigation.leads[0].observation, /active customer count.*total orders.*google ads spend/i);
  assert.equal(investigation.nextPass.status, "waiting_for_evidence");

  const packet = assembleReviewableActionPacket(
    plan,
    proposedActionFromPlan(plan),
    "2026-08-18T12:00:00.000Z",
    investigation,
    [],
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    null,
    undefined,
    response,
  );
  assert.notEqual(packet.answerCoverage.overallStatus, "blocked");
  assert.equal(packet.answerEvaluation?.criterionCount, plan.answerContract.completionCriteria.length);
  assert.equal(packet.answerEvaluation?.criteria.length, plan.answerContract.completionCriteria.length);
  assert.ok(packet.answerEvaluation?.criteria.every((criterion) => ["pass", "partial", "fail"].includes(criterion.status)));
  assert.ok(packet.answerEvaluation?.criteria.find((criterion) => criterion.criterionId === "cites_claims")?.evidenceIds.includes("SRC-ADS"));
  assert.notEqual(packet.answerEvaluation?.overallStatus, "pass");
  assert.equal(packet.answerEvaluation?.nextPass.status, "research_needed");
  assert.deepEqual(packet.analysisAppendix?.nextPass.evidenceNeeded, packet.answerEvaluation?.nextPass.evidenceNeeded);
  assert.equal(packet.analysisAppendix?.reconciliation?.version, "evidence-compatibility-v1");
  assert.equal(packet.analysisAppendix?.reconciliation?.observationCount, evidenceBundle.length);
  assert.match(packet.finalAnswer.sections.find((section) => section.sectionId === "direct_answer")?.content ?? "", /Best available answer/i);
});
