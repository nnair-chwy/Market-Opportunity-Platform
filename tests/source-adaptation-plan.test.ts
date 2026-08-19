import assert from "node:assert/strict";
import test from "node:test";
import { evidenceExecutionResponseSchema, sourceAdaptationReadinessSchema } from "../lib/evidence-snapshot/contracts.ts";
import { marketInvestigationFromEvidence } from "../lib/planning/evidence-market-investigation.ts";
import { checkInvestigationCoverage } from "../lib/planning/investigation-coverage.ts";
import { planEvaluation } from "../lib/planning/planner.ts";
import { effectivePlanForSourceAdaptation } from "../lib/planning/source-adaptation-plan.ts";

function adaptation(decision: "used" | "incompatible") {
  return sourceAdaptationReadinessSchema.parse({
    version: "source-adaptation-readiness-v1",
    originalGoal: "Where should we increase paid search spend?",
    registryVersion: "vetted-dynamic-source-registry-v1",
    registryFingerprint: "a".repeat(64),
    status: decision === "used" ? "adapted_with_new_evidence" : "reviewed_sources_considered",
    sources: [{
      candidateId: "reviewed-regional-orders",
      label: "Reviewed regional orders",
      sourceIds: ["NEW-REGIONAL-ORDERS"],
      decision,
      reason: decision === "used" ? "Added regional order evidence." : "Not compatible with this question.",
      addressesRequirementIds: ["marketing_business_outcome"],
      evidenceIds: decision === "used" ? ["orders-atlanta"] : [],
    }],
    goalCheck: { status: "partial", explanation: "The original goal was re-checked.", unmetCriterionIds: ["covers_domain_requirements"] },
    nextRequiredDataset: { reason: "More evidence is required.", fields: [] },
  });
}

test("used reviewed evidence updates client-side packet coverage while incompatible evidence does not", () => {
  const plan = planEvaluation("Where should we increase paid search spend?", "marketing");
  const usedAdaptation = adaptation("used");
  const response = evidenceExecutionResponseSchema.parse({
    requestId: "adaptation-client-integration",
    status: "complete",
    snapshotVersion: "reviewed-orders-sha",
    queryVersion: "discovered-evidence-query-v1",
    calculationVersion: null,
    query: "normalized_evidence_bundle",
    componentQueries: [],
    capability: plan.capabilityId,
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    geographyIds: ["cbsa:12060"],
    missingApprovals: [],
    guardrails: ["No material action."],
    rows: [{ geography: "12060", orders: 30 }],
    evidenceBundle: [{
      evidenceId: "orders-atlanta",
      metricId: "first_party.regional_orders",
      geographyId: "cbsa:12060",
      geographyLabel: "Atlanta-Sandy Springs-Roswell, GA",
      rawValue: 30,
      structuredValue: { aggregation: "sum" },
      unit: "count",
      sourceId: "NEW-REGIONAL-ORDERS",
      snapshotId: "reviewed-orders-sha",
      evidenceStatus: "Reported",
      qualityStatus: "accepted",
      observationStart: "2026-08-03",
      observationEnd: "2026-08-03",
      period: { kind: "as_of", start: "2026-08-03", end: "2026-08-03", label: "2026-08-03" },
      reportScope: "Reviewed regional orders",
      currency: null,
      allowedUse: "internal_shadow_evaluation",
      sensitivity: "internal",
      warning: null,
      origin: "frozen_csv_snapshot",
    }],
    sourceIds: ["NEW-REGIONAL-ORDERS"],
    qualityWarnings: [],
    missingEvidence: [],
    unknowns: [],
    allowedUse: "internal_shadow_evaluation",
    sensitivity: "internal",
    executionMode: "frozen_snapshot_demo",
    errorCode: null,
    errorMessage: null,
    sourceAdaptation: usedAdaptation,
  });

  const usedPlan = effectivePlanForSourceAdaptation(plan, usedAdaptation);
  const investigation = marketInvestigationFromEvidence(usedPlan, response);
  assert.ok(investigation);
  const usedCoverage = checkInvestigationCoverage(usedPlan, investigation);
  assert.equal(usedCoverage.domainCoverage.find((item) => item.itemId === "marketing_business_outcome")?.status, "covered");
  assert.equal(usedPlan.planId, plan.planId);
  assert.equal(usedPlan.originalQuestion, plan.originalQuestion);
  assert.deepEqual(usedPlan.intent, plan.intent);

  const incompatiblePlan = effectivePlanForSourceAdaptation(plan, adaptation("incompatible"));
  const incompatibleCoverage = checkInvestigationCoverage(incompatiblePlan, investigation);
  assert.equal(incompatibleCoverage.domainCoverage.find((item) => item.itemId === "marketing_business_outcome")?.status, "unsupported");
  assert.equal(incompatiblePlan, plan);
});
