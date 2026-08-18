import assert from "node:assert/strict";
import test from "node:test";
import {
  answerEvaluationFixtures,
  checkInvestigationCoverage,
  composeFinalAnswer,
  listAnswerDomainPacks,
  planEvaluation,
  runAnswerEvaluationFixture,
  validateAiDecisionFramingProposal,
  validateAnswerContract,
} from "../lib/planning/index.ts";
import { runMarketInvestigation } from "../lib/planning/market-investigation.ts";

test("domain packs preserve reviewed vocabulary, requirements, and bounded examples", () => {
  const packs = listAnswerDomainPacks();
  assert.deepEqual(packs.map((pack) => pack.perspectiveId), ["cvc", "marketing", "pricing"]);
  for (const pack of packs) {
    assert.ok(pack.requirements.length >= 3);
    assert.ok(pack.requirements.every((item) => item.sourceIds.length > 0));
    assert.ok(pack.exampleQuestions.length >= 2);
    assert.ok(pack.exampleBoundedConclusions.length >= 2);
    assert.match(pack.decisionOwner, /owner/i);
  }
});

test("semantic validator checks plan identity, owner, decision, unit, evidence, and authorization", () => {
  const plan = planEvaluation("Which comparable markets differ most in CVC footprint?", "cvc");
  const valid = validateAnswerContract(plan.answerContract, {
    planId: plan.planId,
    perspectiveId: plan.perspectiveId,
  });
  assert.equal(valid.valid, true);

  const wrongPlan = validateAnswerContract(plan.answerContract, { planId: "another-plan" });
  assert.equal(wrongPlan.valid, false);
  assert.ok(wrongPlan.issues.some((item) => item.code === "plan_mismatch"));

  const missingUnit = validateAnswerContract({
    ...plan.answerContract,
    decisionFrame: { ...plan.answerContract.decisionFrame, unitOfAnalysis: "" },
  });
  assert.equal(missingUnit.valid, false);
  assert.ok(missingUnit.issues.some((item) => item.path.includes("unitOfAnalysis")));

  const unauthorized = validateAnswerContract({
    ...plan.answerContract,
    strongestPermittedConclusion: "Approve the clinic opening.",
  });
  assert.equal(unauthorized.valid, false);
  assert.ok(unauthorized.issues.some((item) => item.code === "unauthorized_conclusion"));
});

test("AI decision framing remains advisory and cannot introduce domain requirements", () => {
  const plan = planEvaluation("Which DMAs could support a paid-search test?", "marketing");
  const framing = validateAiDecisionFramingProposal({
    proposal: {
      decisionRestatement: "Authorize a national paid-search budget change.",
      emphasizedRequirementIds: ["marketing_incrementality", "invented_requirement"],
      unresolvedQuestions: ["Which approved first-party outcome and test guardrails are available?"],
    },
    modelVersion: "test-model",
    allowedRequirementIds: plan.answerContract.domainRequirements.map((item) => item.requirementId),
    deterministicDecisionRestatement: plan.intent.conciseInterpretation,
  });
  assert.equal(framing.origin, "ai_proposed");
  assert.equal(framing.decisionRestatement, plan.intent.conciseInterpretation);
  assert.deepEqual(framing.emphasizedRequirementIds, ["marketing_incrementality"]);
  assert.equal(framing.emphasizedRequirementIds.includes("invented_requirement"), false);
});

test("coverage checker distinguishes completed answer sections from blocked domain promises", () => {
  const plan = planEvaluation("Which comparable markets differ most in CVC footprint?", "cvc");
  const investigation = runMarketInvestigation(plan);
  const coverage = checkInvestigationCoverage(plan, investigation);
  assert.equal(coverage.overallStatus, "partial");
  assert.ok(coverage.sectionCoverage.some((item) => item.itemId === "evidence_findings" && item.status === "unsupported"));
  assert.ok(coverage.sectionCoverage.some((item) => item.itemId === "contrary_evidence" && item.status === "covered"));
  assert.ok(coverage.domainCoverage.some((item) => item.itemId === "cvc_access_capacity" && item.status === "blocked"));
  assert.ok(coverage.unmetRequiredItemIds.includes("cvc_demand_outcome"));
});

test("coverage remains blocked before a confirmed investigation is attached", () => {
  const plan = planEvaluation("Which DMAs should receive more paid-search spend?", "marketing");
  const coverage = checkInvestigationCoverage(plan, undefined);
  assert.equal(coverage.overallStatus, "blocked");
  assert.ok(coverage.sectionCoverage.some((item) => item.itemId === "direct_answer" && item.status === "blocked"));
});

test("final composer fills all required sections and marks unsupported promises explicitly", () => {
  const plan = planEvaluation("Which DMAs should receive more paid-search spend?", "marketing");
  const investigation = runMarketInvestigation(plan);
  const coverage = checkInvestigationCoverage(plan, investigation);
  const answer = composeFinalAnswer(plan, investigation, plan.actions[0], coverage);
  assert.equal(answer.sections.length, 7);
  assert.equal(answer.status, "research_needed");
  assert.ok(answer.unsupportedRequirementIds.includes("marketing_incrementality"));
  assert.match(answer.sections.find((item) => item.sectionId === "direct_answer")?.content ?? "", /does not support|does not/i);
  assert.match(answer.sections.find((item) => item.sectionId === "missing_evidence")?.content ?? "", /documented but not approved|Missing|gap/i);
  assert.match(answer.disclaimer, /human review/i);
});

test("versioned answer fixtures compare generated contracts and conclusions without claiming historical approval", () => {
  assert.ok(answerEvaluationFixtures.every((fixture) => fixture.reviewStatus === "synthetic_regression"));
  const results = answerEvaluationFixtures.map(runAnswerEvaluationFixture);
  assert.deepEqual(results.filter((result) => !result.passed), []);
});
