import assert from "node:assert/strict";
import test from "node:test";
import {
  compileEvaluationPlan,
  evaluationPlanSchema,
  inferPlanningIntent,
  planEvaluation,
} from "../lib/planning/index.ts";

test("public market questions compile to governed Census context", () => {
  const plan = planEvaluation("Which U.S. markets have the highest population density?");
  assert.equal(plan.capabilityId, "census_market_context");
  assert.equal(plan.intent.requestedMeasure, "population_density");
  assert.equal(plan.status, "executable");
  assert.equal(plan.resultWorkspaceType, "adaptive_market_workspace");
  assert.ok(["national", "needs_selection"].includes(plan.geographyResolution.mode));
  assert.equal(plan.geographyResolution.selectedCbsaCodes.includes("42660"), false);
  assert.match(plan.evidenceBoundary, /does not rank business opportunity/i);
  assert.equal(plan.findings.some((finding) => /Three governed/i.test(finding.title)), false);
  assert.match(plan.findings.find((finding) => finding.kind === "actions")?.title ?? "", /Proposed action/);
  evaluationPlanSchema.parse(plan);
});

test("clinic approval requests preserve the human approval gate", () => {
  const plan = planEvaluation("Where should Chewy approve opening a new clinic?");
  assert.equal(plan.capabilityId, "clinic_site_evaluation");
  assert.equal(plan.resultWorkspaceType, "clinic_evaluation_surface");
  assert.equal(plan.actions.some((action) => action.requiresApproval), true);
  assert.match(plan.missingApprovals.join(" "), /material site decision approval/i);
  assert.ok(plan.steps.some((step) => /permitted evaluation|accountable review|evidence gates/i.test(step.label)));
});

test("campaign requests stop at unavailable governed evidence", () => {
  const plan = planEvaluation("Which markets should receive a new awareness campaign?");
  assert.equal(plan.capabilityId, "local_growth_test");
  assert.equal(plan.status, "blocked");
  assert.equal(plan.resultWorkspaceType, "evidence_readiness");
  assert.ok(plan.missingEvidence.length > 0);
  assert.ok(plan.steps.every((step) => !/Run deterministic operators/i.test(step.label)));
});

test("two materially different questions produce different plans and routes", () => {
  const density = planEvaluation("Compare Austin and Denver by population density.");
  const performance = planEvaluation("Why are operating clinics underperforming their peers?");
  assert.equal(density.capabilityId, "census_market_context");
  assert.equal(density.resultWorkspaceType, "adaptive_market_workspace");
  assert.equal(density.geographyResolution.mode, "compare");
  assert.deepEqual(density.geographyResolution.selectedCbsaCodes, ["12420", "19740"]);
  assert.equal(performance.capabilityId, "clinic_performance");
  assert.equal(performance.resultWorkspaceType, "evidence_readiness");
  assert.notEqual(density.steps.map((step) => step.id).join(","), performance.steps.map((step) => step.id).join(","));
});

test("Seattle is selected only when the question resolves it", () => {
  const seattle = planEvaluation("Which Seattle-area markets should we investigate for a future Chewy Vet Care clinic?");
  const national = planEvaluation("Which U.S. markets have the highest population density?");
  assert.equal(seattle.geographyResolution.mode, "single");
  assert.deepEqual(seattle.geographyResolution.selectedCbsaCodes, ["42660"]);
  assert.equal(national.geographyResolution.selectedCbsaCodes.includes("42660"), false);
});

test("named non-Seattle markets resolve and compare in question order", () => {
  const phoenix = planEvaluation("Should we approve a new campaign in Phoenix?");
  assert.equal(phoenix.capabilityId, "local_growth_test");
  assert.equal(phoenix.geographyResolution.mode, "single");
  assert.deepEqual(phoenix.geographyResolution.selectedCbsaCodes, ["38060"]);
  assert.equal(phoenix.resultWorkspaceType, "evidence_readiness");

  const compare = planEvaluation("Compare Austin and Denver by population density.");
  assert.deepEqual(compare.geographyResolution.selectedCbsaCodes, ["12420", "19740"]);
  assert.equal(compare.intent.requestedMeasure, "population_density");
});

test("ambiguous and unsupported questions show clarification or evidence readiness", () => {
  const vague = planEvaluation("What should we do next?");
  assert.equal(vague.resultWorkspaceType, "clarification");
  assert.equal(vague.intent.clarificationRequired, true);
  assert.equal(vague.status, "blocked");
  assert.match(vague.findings.map((finding) => finding.title).join(" "), /clarification|Interpreted|Capability/i);
  assert.equal(/actionable at the market and evidence level/i.test(vague.findings.map((f) => f.detail).join(" ")), false);

  const portland = inferPlanningIntent("Compare Portland markets by population.");
  const compiled = compileEvaluationPlan("Compare Portland markets by population.", {
    ...portland,
    requestedPlaces: [{ name: "Portland", stateHint: null }],
  });
  assert.equal(compiled.geographyResolution.mode, "clarification");
  assert.equal(compiled.resultWorkspaceType, "clarification");
});

test("AI-proposed and deterministic-fallback modes remain visible on compiled plans", () => {
  const fallback = planEvaluation("Compare Austin and Denver by population density.");
  const ai = compileEvaluationPlan(
    "Compare Austin and Denver by population density.",
    fallback.intent,
    "ai_proposed",
  );
  assert.equal(fallback.proposalMethod, "deterministic_fallback");
  assert.equal(ai.proposalMethod, "ai_proposed");
  assert.match(ai.findings.find((finding) => finding.kind === "capability")?.detail ?? "", /AI-proposed intent/);
  assert.match(fallback.findings.find((finding) => finding.kind === "capability")?.detail ?? "", /deterministic fallback/);
});

test("clinic performance, clinic location, local growth, and Census context use different workflows", () => {
  const plans = [
    planEvaluation("Which Seattle-area markets should we investigate for a future Chewy Vet Care clinic?"),
    planEvaluation("Compare Austin and Denver by population density."),
    planEvaluation("Why are operating clinics underperforming their peers?"),
    planEvaluation("Should we approve a new campaign in Phoenix?"),
  ];
  const signatures = plans.map((plan) => `${plan.capabilityId}|${plan.resultWorkspaceType}|${plan.steps.map((step) => step.id).join(">")}`);
  assert.equal(new Set(signatures).size, signatures.length);
  assert.ok(plans.every((plan) => plan.findings.some((finding) => finding.kind === "actions" && finding.title === "Proposed action")));
  assert.ok(plans.some((plan) => plan.missingEvidence.length > 0 || plan.missingApprovals.length > 0));
});
