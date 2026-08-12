import assert from "node:assert/strict";
import test from "node:test";
import { evaluationPlanSchema, planEvaluation } from "../lib/planning/index.ts";

test("public market questions compile to governed Census context", () => {
  const plan = planEvaluation("Which U.S. markets have the highest population density?");
  assert.equal(plan.capabilityId, "census_market_context");
  assert.equal(plan.intent.requestedMeasure, "population_density");
  assert.equal(plan.status, "executable");
  assert.match(plan.evidenceBoundary, /does not rank business opportunity/i);
  evaluationPlanSchema.parse(plan);
});

test("clinic approval requests preserve the human approval gate", () => {
  const plan = planEvaluation("Where should Chewy approve opening a new clinic?");
  assert.equal(plan.capabilityId, "clinic_site_evaluation");
  assert.equal(plan.actions.some((action) => action.requiresApproval), true);
  assert.match(plan.missingApprovals.join(" "), /material site decision approval/i);
});

test("campaign requests stop at unavailable governed evidence", () => {
  const plan = planEvaluation("Which markets should receive a new awareness campaign?");
  assert.equal(plan.capabilityId, "local_growth_test");
  assert.equal(plan.status, "blocked");
  assert.ok(plan.missingEvidence.length > 0);
});
