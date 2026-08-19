import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { DEMO_QUESTIONS, PHOENIX_DEMO_MARKET, planConfiguredDemoQuestion } from "../lib/demo/scenarios.ts";
import { evidenceExecutionResponseSchema } from "../lib/evidence-snapshot/contracts.ts";
import { evaluationPlanSchema } from "../lib/planning/contracts.ts";
import { executeEvaluationPlanEvidence } from "../lib/planning/execute-plan.ts";
import { planEvaluation } from "../lib/planning/planner.ts";

const snapshotDir = resolve(process.env.CLINIC_MARKET_SNAPSHOT_DIR?.trim() || ".local-data/clinic-market-snapshot");
const databasePath = resolve(process.env.DUCKDB_PATH?.trim() || ".local/evidence-snapshot.duckdb");
const actualSnapshotAvailable = existsSync(join(snapshotDir, "manifest.json")) && existsSync(databasePath);
const actualSnapshotTest = actualSnapshotAvailable ? test : test.skip;
const options = { snapshotDir, databasePath, requestedAt: "2026-08-17T00:00:00.000Z" } as const;

function configuredPlan(question: string) {
  const plan = planConfiguredDemoQuestion(question);
  assert.ok(plan, `Expected a configured plan for: ${question}`);
  return plan;
}

test("only the explicit synthetic clinic starter receives a configured demo plan", () => {
  assert.equal(planConfiguredDemoQuestion(DEMO_QUESTIONS.marketContext), null);
  assert.equal(configuredPlan(DEMO_QUESTIONS.clinicPerformance).planId, "plan-demo-clinic-performance-synthetic");
  assert.equal(planConfiguredDemoQuestion(DEMO_QUESTIONS.growthTest), null);
  assert.equal(planConfiguredDemoQuestion("What is another market?"), null);

  for (const question of [
    "What is this market, what public or descriptive evidence exists, and what remains unknown?",
    "Is there a measurable regional opportunity, and what evidence and guardrails are required before testing it?",
  ]) {
    const plan = planEvaluation(question);
    assert.equal(plan.status, "blocked");
    assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, []);
    assert.match(plan.intent.conciseInterpretation, /clarify/i);
  }

  const marketStarter = planEvaluation(DEMO_QUESTIONS.marketContext);
  assert.equal(marketStarter.status, "partially_executable");
  assert.deepEqual(marketStarter.geographyResolution.selectedCbsaCodes, ["12060"]);
  assert.deepEqual(marketStarter.intent.selectedQueries, ["regional_context_by_cbsa", "clinic_context_by_cbsa", "google_ads_context_by_cbsa"]);

  const growthStarter = planEvaluation(DEMO_QUESTIONS.growthTest);
  assert.equal(growthStarter.status, "partially_executable");
  assert.equal(growthStarter.intent.topic, "growth_test_screening");
  assert.deepEqual(growthStarter.geographyResolution.selectedCbsaCodes, []);
});

test("blocked and ambiguous plans do not execute a registered query", async () => {
  for (const question of [DEMO_QUESTIONS.clinicPerformance, "What should we do next?"]) {
    const plan = planEvaluation(question);
    assert.equal(plan.status, "blocked");
    const result = await executeEvaluationPlanEvidence({ requestId: `blocked-${plan.planId}`, plan }, { snapshotDir: join(snapshotDir, "missing-on-purpose"), databasePath });
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.componentQueries, []);
    assert.deepEqual(result.rows, []);
    assert.deepEqual(result.evidenceBundle, []);
    assert.ok(result.qualityWarnings.some((item) => /No registered evidence query was executed/i.test(item)));
  }
});

actualSnapshotTest("replays an explicitly named Phoenix market-context question through Parquet and public Census evidence", async () => {
  const plan = planEvaluation("What is the population of Phoenix?");
  const first = await executeEvaluationPlanEvidence({ requestId: "replay-market", plan }, options);
  const second = await executeEvaluationPlanEvidence({ requestId: "replay-market", plan }, options);
  evidenceExecutionResponseSchema.parse(first);
  assert.deepEqual(first, second);
  assert.equal(first.status, "partial");
  assert.equal(first.capability, "census_market_context");
  assert.equal(first.query, "market_context_bundle");
  assert.deepEqual(first.componentQueries, ["canonical_market_evidence"]);
  assert.deepEqual(first.geographyIds, [PHOENIX_DEMO_MARKET.marketId]);
  assert.ok(first.evidenceBundle.some((item) => item.metricId === "market.active_customer_yoy_growth" && item.geographyId === PHOENIX_DEMO_MARKET.marketId));
  assert.ok(first.evidenceBundle.some((item) => item.sourceId === "SRC-016" && item.origin === "public_context"));
  assert.ok(first.missingEvidence.some((item) => /SEO is present_unregistered/i.test(item)));
  assert.ok(first.missingEvidence.some((item) => /Pricing data is unavailable/i.test(item)));
  assert.ok(first.missingEvidence.some((item) => /Competitor data is unavailable/i.test(item)));
});

actualSnapshotTest("replays the clinic-performance question as an explicitly synthetic three-clinic rank", async () => {
  const plan = configuredPlan(DEMO_QUESTIONS.clinicPerformance);
  const result = await executeEvaluationPlanEvidence({ requestId: "replay-clinic", plan }, options);
  evidenceExecutionResponseSchema.parse(result);
  assert.equal(result.status, "partial");
  assert.equal(result.capability, "clinic_performance");
  assert.equal(result.query, "clinic_performance_bundle");
  assert.equal(result.executionMode, "synthetic_demo");
  assert.deepEqual(result.geographyIds, ["SYN-CVC-001", "SYN-CVC-002", "SYN-CVC-003"]);
  assert.equal(result.rows.length, 3);
  const selected = result.rows.find((row) => row.clinicId === "SYN-CVC-003");
  assert.equal(selected?.selected, true);
  assert.equal(selected?.rank, 2);
  assert.equal(selected?.value, 812);
  assert.ok(result.evidenceBundle.every((item) => item.origin === "synthetic_demo_fixture" && item.evidenceStatus === "Hypothesis"));
  assert.ok(result.missingApprovals.includes("Production peer-group approval"));
  assert.ok(result.guardrails.some((item) => /Do not use this illustrative rank/i.test(item)));
});

test("an explicitly named Phoenix growth question resolves Phoenix and permits bounded exploration while remaining gated", () => {
  const plan = planEvaluation("Should we test a growth campaign in Phoenix?");
  assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, [PHOENIX_DEMO_MARKET.cbsaCode]);
  assert.equal(plan.capabilityId, "local_growth_test");
  assert.equal(plan.status, "partially_executable");
  assert.ok(plan.missingEvidence.length > 0);
});

actualSnapshotTest("routes a permitted clinic-site plan to an internal aggregate response", async () => {
  const marketPlan = planEvaluation("What is the population of Phoenix?");
  const clinicSitePlan = evaluationPlanSchema.parse({
    ...marketPlan,
    planId: "plan-test-clinic-site-phoenix",
    capabilityId: "clinic_site_evaluation",
    status: "partially_executable",
    missingEvidence: ["Approved declassified clinic-site aggregate"],
    evidenceBoundary: "Clinic evidence must remain inside the registered aggregate query boundary.",
  });
  const result = await executeEvaluationPlanEvidence({ requestId: "replay-clinic-site", plan: clinicSitePlan }, options);
  assert.equal(result.status, "partial");
  assert.equal(result.query, "clinic_site_evidence_bundle");
  assert.deepEqual(result.componentQueries, ["canonical_clinic_performance"]);
  assert.ok(result.rows.length > 0);
  assert.ok(result.evidenceBundle.length > 0);
  assert.equal(result.sensitivity, "internal");
  assert.equal(result.allowedUse, "local_demo_aggregate_decision_support");
  assert.ok(result.qualityWarnings.some((item) => /internal aggregate/i.test(item)));
});
