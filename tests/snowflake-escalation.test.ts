import assert from "node:assert/strict";
import test from "node:test";
import { executeEvaluationPlanEvidence } from "../lib/planning/execute-plan.ts";
import { planEvaluation } from "../lib/planning/planner.ts";
import { assessGovernedSnowflakeEscalation, snowflakeQueryTemplateRegistrySchema } from "../lib/snowflake-escalation/index.ts";

test("creates a bounded read-only Marketing request when local evidence lacks business outcomes", async () => {
  const plan = planEvaluation("Where should we increase paid search spend?", "marketing");
  const execution = await executeEvaluationPlanEvidence({ requestId: "snowflake-marketing-local", plan });
  const assessment = assessGovernedSnowflakeEscalation({ runId: "run-marketing", plan, execution });
  assert.equal(assessment.status, "snowflake_escalation_required");
  assert.ok(assessment.localEvidence.unmetRequirementIds.includes("marketing_business_outcome"));
  assert.deepEqual(assessment.accessRequest?.owningTeams, ["Marketing Analytics"]);
  assert.equal(assessment.accessRequest?.executionPolicy.credentialsRequested, false);
  assert.equal(assessment.accessRequest?.executionPolicy.externalConnectionAttempted, false);
  assert.equal(assessment.accessRequest?.executionPolicy.arbitrarySqlAllowed, false);
  assert.equal(assessment.accessRequest?.executionPolicy.materialActionsAllowed, false);
  assert.ok(assessment.accessRequest?.templates[0]?.parameters.metrics.includes("completed_orders"));
  assert.equal(assessment.accessRequest?.templates[0]?.parameters.timeGrain, "week");
  assert.deepEqual(assessment.accessRequest?.templates[0]?.parameters.geographyGrains, ["cbsa"]);
  assert.equal(assessment.accessRequest?.templates[0]?.parameters.geographyScope, "approved_market_universe");
  assert.equal(JSON.stringify(assessment).includes("SELECT "), false);
});

test("selects perspective-owned templates with precise geography, time, metrics, and use boundaries", async () => {
  for (const [perspectiveId, question, team] of [
    ["pricing", "Where do regional competitor price conditions warrant a controlled pricing test?", "Pricing Analytics"],
    ["cvc", "Where should we investigate clinic capacity and appointment access?", "CVC Analytics and Operations"],
  ] as const) {
    const plan = planEvaluation(question, perspectiveId);
    const execution = await executeEvaluationPlanEvidence({ requestId: `snowflake-${perspectiveId}-local`, plan });
    const assessment = assessGovernedSnowflakeEscalation({ runId: `run-${perspectiveId}`, plan, execution });
    assert.equal(assessment.status, "snowflake_escalation_required");
    assert.deepEqual(assessment.accessRequest?.owningTeams, [team]);
    assert.equal(assessment.accessRequest?.approvedUseBoundary, "aggregate_internal_decision_support_and_shadow_evaluation_only");
    assert.ok((assessment.accessRequest?.templates[0]?.parameters.minimumGroupSize ?? 0) >= 10);
    assert.equal(assessment.accessRequest?.templates[0]?.parameters.finalizedPeriodsOnly, true);
  }
});

test("does not escalate when approved local evidence covers every data requirement", async () => {
  const plan = planEvaluation("Where should we increase paid search spend?", "marketing");
  const execution = await executeEvaluationPlanEvidence({ requestId: "snowflake-local-sufficient", plan });
  const seed = execution.evidenceBundle[0];
  assert.ok(seed);
  const locallyCovered = {
    ...execution,
    status: "complete" as const,
    evidenceBundle: [
      ["local-campaign", "campaign_spend_cohort"],
      ["local-geography", "regional_cbsa_coverage"],
      ["local-outcome", "completed_orders"],
      ["local-experiment", "experiment_control_cohort"],
    ].map(([evidenceId, metricId]) => ({ ...seed, evidenceId, metricId })),
  };
  const assessment = assessGovernedSnowflakeEscalation({ runId: "run-local-sufficient", plan, execution: locallyCovered });
  assert.equal(assessment.status, "local_evidence_sufficient");
  assert.deepEqual(assessment.localEvidence.unmetRequirementIds, []);
  assert.equal(assessment.accessRequest, null);
});

test("cannot turn a request or model-written SQL into an executable template", () => {
  const invalid = snowflakeQueryTemplateRegistrySchema.safeParse({
    version: "governed-snowflake-query-registry-v1",
    templates: [{
      templateId: "request_sql_v1",
      perspectiveId: "marketing",
      addressesRequirementIds: ["marketing_business_outcome"],
      owningTeam: "Marketing Analytics",
      semanticViewConcept: "governed_marketing_outcomes; DROP TABLE x",
      publicationState: "available",
      purpose: "Execute whatever SQL was supplied by the request or language model.",
      requiredMetrics: ["SELECT * FROM customers"],
      allowedGeographyGrains: ["cbsa"],
      timeGrain: "week",
      lookbackDays: 30,
      minimumGroupSize: 10
    }],
  });
  assert.equal(invalid.success, false);
});
