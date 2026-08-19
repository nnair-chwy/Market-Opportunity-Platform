import assert from "node:assert/strict";
import test from "node:test";
import { evidenceExecutionResponseSchema, type EvidenceExecutionResponse } from "../lib/evidence-snapshot/contracts.ts";
import { executeAgenticEvidenceLoop, rankCompatibleResearchQueries, vettedDynamicResearchPassSchema, type VettedDynamicResearchPass } from "../lib/planning/agentic-evidence-loop.ts";
import type { EvaluationPlan } from "../lib/planning/contracts.ts";
import { marketInvestigationFromEvidence } from "../lib/planning/evidence-market-investigation.ts";
import { planEvaluation } from "../lib/planning/planner.ts";
import { assembleReviewableActionPacket, formatReviewableActionPacketDocument, proposedActionFromPlan, reviewableActionPacketSchema } from "../lib/planning/reviewable-packet.ts";

function responseFor(plan: EvaluationPlan, requestId: string, withEvidence = true): EvidenceExecutionResponse {
  const query = plan.intent.selectedQueries[0] ?? "regional_context_by_cbsa";
  const sourceId = `TEST-${query.toUpperCase()}`;
  return evidenceExecutionResponseSchema.parse({
    requestId,
    status: "partial",
    snapshotVersion: "agentic-test-snapshot-v1",
    queryVersion: "agentic-test-query-v1",
    calculationVersion: "agentic-test-calculation-v1",
    query: "normalized_evidence_bundle",
    componentQueries: [query],
    capability: plan.capabilityId,
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    geographyIds: ["cbsa:12060"],
    missingApprovals: [],
    guardrails: ["No material action may be executed."],
    rows: withEvidence ? [{ query, value: 1 }] : [],
    evidenceBundle: withEvidence ? [{
      evidenceId: `evidence-${query}`,
      metricId: `normalized.${query}`,
      geographyId: "cbsa:12060",
      geographyLabel: "Atlanta-Sandy Springs-Roswell, GA",
      rawValue: 1,
      structuredValue: null,
      unit: "observations",
      sourceId,
      snapshotId: "agentic-test-snapshot-v1",
      evidenceStatus: "Reported",
      qualityStatus: "accepted",
      observationStart: "2026-08-01",
      observationEnd: "2026-08-17",
      period: { kind: "date_range", start: "2026-08-01", end: "2026-08-17", label: "2026-08-01 to 2026-08-17" },
      reportScope: "bounded agentic loop test",
      currency: null,
      allowedUse: "local_demo_aggregate_decision_support",
      sensitivity: "internal",
      warning: null,
      origin: "frozen_csv_snapshot",
    }] : [],
    sourceIds: withEvidence ? [sourceId] : [],
    qualityWarnings: [],
    missingEvidence: withEvidence ? [] : ["No rows matched this compatible source."],
    unknowns: [],
    allowedUse: "local_demo_aggregate_decision_support",
    sensitivity: "internal",
    executionMode: "frozen_snapshot_demo",
    errorCode: null,
    errorMessage: null,
  });
}

function dynamicResponse(plan: EvaluationPlan, requestId: string, candidate: VettedDynamicResearchPass): EvidenceExecutionResponse {
  const base = responseFor(plan, requestId);
  const sourceId = candidate.sourceIds[0];
  return evidenceExecutionResponseSchema.parse({
    ...base,
    componentQueries: [],
    rows: [{ candidateId: candidate.id, value: 1 }],
    evidenceBundle: base.evidenceBundle.map((item) => ({
      ...item,
      evidenceId: `dynamic-evidence-${candidate.id}`,
      metricId: `dynamic.${candidate.id}`,
      sourceId,
    })),
    sourceIds: [sourceId],
  });
}

function candidate(overrides: Partial<VettedDynamicResearchPass> & Pick<VettedDynamicResearchPass, "id" | "sourceIds" | "relevanceScore" | "dedupeKey">): VettedDynamicResearchPass {
  return vettedDynamicResearchPassSchema.parse({
    label: `Vetted pass ${overrides.id}`,
    sourceFamily: "regional",
    addressesCriterionIds: ["covers_domain_requirements"],
    compatibilityStatus: "compatible_with_limits",
    allowedUse: "internal_shadow_evaluation",
    vetted: true,
    browserSafeAggregateOnly: true,
    executesMaterialAction: false,
    ...overrides,
  });
}

test("agentic loop investigates ordinary registered sources in perspective order and records each goal check", async () => {
  const plan = planEvaluation("Show regional, clinic, and Google Ads evidence for Atlanta.", "marketing");
  assert.deepEqual(rankCompatibleResearchQueries(plan), [
    "google_ads_context_by_cbsa",
    "regional_context_by_cbsa",
    "clinic_context_by_cbsa",
  ]);
  const calls: string[][] = [];
  const result = await executeAgenticEvidenceLoop({ requestId: "loop-multi-source", plan }, {
    maxIterations: 3,
    now: () => "2026-08-18T12:00:00.000Z",
    executePass: async ({ requestId, plan: passPlan }) => {
      calls.push(passPlan.intent.selectedQueries);
      return responseFor(passPlan, requestId);
    },
  });

  assert.deepEqual(calls, [
    ["google_ads_context_by_cbsa"],
    ["regional_context_by_cbsa"],
    ["clinic_context_by_cbsa"],
  ]);
  assert.equal(result.evidenceBundle.length, 3);
  assert.equal(result.agenticLifecycle?.passes.length, 3);
  assert.equal(result.agenticLifecycle?.status, "best_available_answer");
  assert.notEqual(result.agenticLifecycle?.finalAnswerStatus, "pass");
  assert.ok(result.agenticLifecycle?.passes.every((pass) => pass.addedEvidenceCount === 1));
  assert.ok(result.agenticLifecycle?.passes.every((pass) => pass.unmetCriterionIds.length > 0));
  assert.equal(result.snowflakeEscalation?.status, "snowflake_escalation_required");
  assert.equal(result.snowflakeEscalation?.accessRequest?.executionPolicy.arbitrarySqlAllowed, false);

  const investigation = marketInvestigationFromEvidence(plan, result);
  assert.ok(investigation);
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
    result,
  );
  const restoredPacket = reviewableActionPacketSchema.parse(JSON.parse(JSON.stringify(packet)));
  assert.deepEqual(restoredPacket.evidenceExecution?.agenticLifecycle, result.agenticLifecycle);
  const auditDocument = formatReviewableActionPacketDocument(restoredPacket);
  assert.match(auditDocument, /Investigation lifecycle/);
  assert.match(auditDocument, /Pass 1: google_ads_context_by_cbsa/);
  assert.match(auditDocument, new RegExp(result.agenticLifecycle?.stopReason ?? "missing-stop-reason"));
});

test("agentic loop stops when a compatible next pass contributes no new evidence", async () => {
  const plan = planEvaluation("Show regional, clinic, and Google Ads evidence for Atlanta.", "marketing");
  let calls = 0;
  const result = await executeAgenticEvidenceLoop({ requestId: "loop-no-new-evidence", plan }, {
    now: () => "2026-08-18T12:00:00.000Z",
    executePass: async ({ requestId, plan: passPlan }) => responseFor(passPlan, requestId, calls++ === 0),
  });

  assert.equal(calls, 2);
  assert.equal(result.evidenceBundle.length, 1);
  assert.equal(result.agenticLifecycle?.status, "no_useful_source");
  assert.equal(result.agenticLifecycle?.passes[1].addedEvidenceCount, 0);
  assert.match(result.agenticLifecycle?.stopReason ?? "", /added no new evidence/i);
});

test("agentic loop enforces its bounded pass limit", async () => {
  const plan = planEvaluation("Show regional, clinic, and Google Ads evidence for Atlanta.", "marketing");
  const result = await executeAgenticEvidenceLoop({ requestId: "loop-bounded", plan }, {
    maxIterations: 2,
    now: () => "2026-08-18T12:00:00.000Z",
    executePass: async ({ requestId, plan: passPlan }) => responseFor(passPlan, requestId),
  });

  assert.equal(result.agenticLifecycle?.passes.length, 2);
  assert.equal(result.agenticLifecycle?.status, "max_iterations");
  assert.match(result.agenticLifecycle?.stopReason ?? "", /2-pass safety limit/i);
});

test("agentic loop deterministically interleaves vetted dynamic candidates with registered passes", async () => {
  const plan = planEvaluation("Show regional, clinic, and Google Ads evidence for Atlanta.", "marketing");
  const candidates = [
    candidate({ id: "lower-duplicate", sourceIds: ["DYNAMIC-LOW"], relevanceScore: 91, dedupeKey: "shared-outcome" }),
    candidate({ id: "highest-vetted", sourceIds: ["DYNAMIC-HIGH"], relevanceScore: 99, dedupeKey: "shared-outcome" }),
    candidate({ id: "second-vetted", sourceIds: ["DYNAMIC-SECOND"], relevanceScore: 81, dedupeKey: "second-outcome" }),
  ];
  const calls: string[] = [];
  const result = await executeAgenticEvidenceLoop({ requestId: "loop-dynamic", plan }, {
    maxIterations: 3,
    candidateResearchPasses: candidates,
    now: () => "2026-08-18T12:00:00.000Z",
    executePass: async ({ requestId, plan: passPlan }) => {
      calls.push(`registered:${passPlan.intent.selectedQueries[0]}`);
      return responseFor(passPlan, requestId);
    },
    executeCandidatePass: async (selected, { requestId, plan: passPlan }) => {
      calls.push(`dynamic:${selected.id}`);
      return dynamicResponse(passPlan, requestId, selected);
    },
  });

  assert.deepEqual(calls, [
    "dynamic:highest-vetted",
    "dynamic:second-vetted",
    "registered:google_ads_context_by_cbsa",
  ]);
  assert.equal(result.agenticLifecycle?.status, "max_iterations");
  assert.deepEqual(result.agenticLifecycle?.candidateQueries.slice(0, 4), [
    "dynamic:highest-vetted",
    "dynamic:second-vetted",
    "google_ads_context_by_cbsa",
    "regional_context_by_cbsa",
  ]);
  assert.deepEqual(result.agenticLifecycle?.exhaustedQueries, [
    "dynamic:highest-vetted",
    "dynamic:second-vetted",
    "google_ads_context_by_cbsa",
  ]);
  assert.equal(result.evidenceBundle.length, 3);
  assert.ok(!JSON.stringify(result).includes("lower-duplicate"));
});

test("dynamic candidates must be vetted aggregate-only non-material passes", () => {
  const unsafe = {
    ...candidate({ id: "unsafe-pass", sourceIds: ["UNSAFE"], relevanceScore: 100, dedupeKey: "unsafe" }),
    executesMaterialAction: true,
  };
  assert.equal(vettedDynamicResearchPassSchema.safeParse(unsafe).success, false);
});

test("dynamic pass execution cannot introduce an undeclared source", async () => {
  const plan = planEvaluation("Show regional, clinic, and Google Ads evidence for Atlanta.", "marketing");
  const vetted = candidate({ id: "declared-only", sourceIds: ["DECLARED"], relevanceScore: 99, dedupeKey: "declared-only" });
  await assert.rejects(
    executeAgenticEvidenceLoop({ requestId: "loop-source-boundary", plan }, {
      candidateResearchPasses: [vetted],
      now: () => "2026-08-18T12:00:00.000Z",
      executeCandidatePass: async (_selected, { requestId, plan: passPlan }) => responseFor(passPlan, requestId),
    }),
    /returned an undeclared source/,
  );
});

test("an incompatible reviewed source is recorded but does not alter the answer", async () => {
  const plan = planEvaluation("Show regional evidence for Atlanta.", "marketing");
  const executePass = async ({ requestId, plan: passPlan }: { requestId: string; plan: EvaluationPlan }) => responseFor(passPlan, requestId);
  const baseline = await executeAgenticEvidenceLoop({ requestId: "baseline-compatible-answer", plan }, {
    maxIterations: 1,
    now: () => "2026-08-18T12:00:00.000Z",
    executePass,
  });
  const adapted = await executeAgenticEvidenceLoop({ requestId: "incompatible-source-answer", plan }, {
    maxIterations: 1,
    now: () => "2026-08-18T12:00:00.000Z",
    executePass,
    sourceConsiderations: [{
      candidateId: "pricing-only-source",
      label: "Reviewed pricing-only source",
      sourceIds: ["PRICING-ONLY"],
      status: "incompatible",
      reason: "Not used: registered for pricing rather than marketing.",
      addressesRequirementIds: [],
    }],
    dynamicRegistryVersion: "vetted-dynamic-source-registry-v1",
    dynamicRegistryFingerprint: "a".repeat(64),
  });

  assert.deepEqual(adapted.evidenceBundle, baseline.evidenceBundle);
  assert.deepEqual(adapted.sourceIds, baseline.sourceIds);
  assert.equal(adapted.agenticLifecycle?.finalAnswerStatus, baseline.agenticLifecycle?.finalAnswerStatus);
  assert.equal(adapted.sourceAdaptation?.sources[0].decision, "incompatible");
  assert.match(adapted.sourceAdaptation?.sources[0].reason ?? "", /pricing rather than marketing/i);
  assert.ok(!JSON.stringify(adapted.evidenceBundle).includes("PRICING-ONLY"));
  assert.ok((adapted.sourceAdaptation?.nextRequiredDataset.fields.length ?? 0) > 0);
});
