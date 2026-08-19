import assert from "node:assert/strict";
import test from "node:test";
import { executeEvaluationPlanEvidence } from "../lib/planning/execute-plan.ts";
import type { EvidenceExecutionResponse } from "../lib/evidence-snapshot/contracts.ts";
import { goldenMarketInvestigationFromEvidence } from "../lib/planning/golden-market-investigation.ts";
import { recommendedInvestigationRevision } from "../lib/planning/market-investigation.ts";
import { planEvaluation } from "../lib/planning/planner.ts";
import { assembleReviewableActionPacket, proposedActionFromPlan } from "../lib/planning/reviewable-packet.ts";

const questions = {
  marketing: "Which comparable geographies show paid-search response worth validating with first-party outcomes?",
  pricing: "Where do observed competitor conditions and Chewy economics warrant investigation?",
  cvc: "Which markets show demand/footprint contrasts worth deeper clinic-access investigation?",
} as const;

async function investigation(family: keyof typeof questions) {
  const view = family === "marketing" ? "paid_search_response" : family === "pricing" ? "competitor_availability" : "market_expansion_context";
  const plan = planEvaluation(questions[family], family, [], view);
  const evidence = await executeEvaluationPlanEvidence({ requestId: `alignment-${family}`, plan });
  const result = goldenMarketInvestigationFromEvidence(plan, evidence);
  assert.ok(result);
  return { evidence, result };
}

test("Marketing shows the same five national leads and cohort as the evidence bundle", async () => {
  const { evidence, result } = await investigation("marketing");
  assert.deepEqual(result.leads.map((lead) => lead.marketIds[0]), ["37980", "41700", "10580", "10900", "47930"]);
  assert.match(result.leads[0].title, /Philadelphia/);
  assert.match(result.leads[1].title, /San Antonio/);
  assert.equal(result.screeningScope.eligibleCohort, (evidence.rows[0] as Record<string, unknown>).cohort);
  assert.match(result.leads[0].challenge, /not first-party commercial outcomes|not first-party/i);
  assert.match(result.limitations.join(" "), /cannot authorize.*spend/i);
});

test("a spend-increase result recommends the matching commercial validation follow-up", async () => {
  const plan = planEvaluation("where should we spend more on ads", "marketing");
  const evidence = await executeEvaluationPlanEvidence({ requestId: "alignment-marketing-increase", plan });
  const result = goldenMarketInvestigationFromEvidence(plan, evidence);
  assert.ok(result);
  assert.match(recommendedInvestigationRevision(result), /orders.*new customers.*contribution.*incrementality.*spend-increase/i);
  assert.doesNotMatch(recommendedInvestigationRevision(result), /clinic economics/i);
});

test("Pricing keeps Kankakee visible as a one-ZIP monitoring lead, not a price action", async () => {
  const { result } = await investigation("pricing");
  assert.deepEqual(result.leads.map((lead) => lead.marketIds[0]), ["28100"]);
  assert.match(result.leads[0].title, /Kankakee/);
  assert.match(result.leads[0].observation, /only 1 ZIP geography/i);
  assert.match(`${result.leads[0].businessMeaning} ${result.limitations.join(" ")}`, /does not establish.*pricing opportunity|cannot authorize.*price/i);
});

test("CVC keeps Santa Clara at supplied-trade-area grain and blocks footprint action", async () => {
  const { result } = await investigation("cvc");
  assert.equal(result.geography, "supplied_trade_area");
  assert.match(result.leads[0].title, /Modern Animal Santa Clara/);
  assert.match(result.screeningScope.eligibleCohort, /San Jose.*7 records/i);
  assert.match(result.leads[0].challenge, /staffed capacity.*appointments.*workforce/i);
  assert.match(result.nextPass.completionRule, /investigation lead/i);
});

test("CVC supplied-trade-area findings remain valid in the saved and downloadable packet", async () => {
  const view = "market_expansion_context";
  const plan = planEvaluation(questions.cvc, "cvc", [], view);
  const evidence = await executeEvaluationPlanEvidence({ requestId: "alignment-cvc-packet", plan });
  const result = goldenMarketInvestigationFromEvidence(plan, evidence);
  assert.ok(result);
  const packet = assembleReviewableActionPacket(
    plan,
    proposedActionFromPlan(plan),
    "2026-08-18T12:00:00.000Z",
    result,
    [],
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    null,
    undefined,
    evidence,
  );
  assert.equal(packet.analysisAppendix?.geography, "supplied_trade_area");
  assert.match(packet.analysisAppendix?.leads[0]?.marketIds[0] ?? "", /^site:/);
});

test("non-golden evidence does not replace the existing investigation path", () => {
  const plan = planEvaluation("Compare household scale across markets", "marketing");
  const response: EvidenceExecutionResponse = {
    requestId: "not-golden",
    status: "partial",
    snapshotVersion: "test",
    queryVersion: "test",
    calculationVersion: "test",
    query: "market_context_bundle",
    componentQueries: [],
    capability: plan.capabilityId,
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    geographyIds: [],
    missingApprovals: [],
    guardrails: [],
    rows: [],
    evidenceBundle: [],
    sourceIds: [],
    qualityWarnings: [],
    missingEvidence: [],
    unknowns: [],
    allowedUse: "market_context_only",
    sensitivity: "internal",
    executionMode: "frozen_snapshot_demo",
    errorCode: null,
    errorMessage: null,
  };
  assert.equal(goldenMarketInvestigationFromEvidence(plan, response), null);
});
