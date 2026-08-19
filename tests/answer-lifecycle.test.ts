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

test("coverage checker treats signal-level findings as supported while preserving unmet domain limits", () => {
  const plan = planEvaluation("Which comparable markets differ most in CVC footprint?", "cvc");
  const investigation = runMarketInvestigation(plan);
  const coverage = checkInvestigationCoverage(plan, investigation);
  assert.equal(coverage.overallStatus, "partial");
  assert.ok(coverage.sectionCoverage.some((item) => item.itemId === "evidence_findings" && item.status === "covered"));
  assert.ok(coverage.sectionCoverage.some((item) => item.itemId === "contrary_evidence" && item.status === "covered"));
  assert.ok(coverage.domainCoverage.some((item) => item.itemId === "cvc_access_capacity" && item.status === "unsupported"));
  assert.ok(coverage.unmetRequiredItemIds.includes("cvc_demand_outcome"));
});

test("coverage remains blocked before a confirmed investigation is attached", () => {
  const plan = planEvaluation("Which DMAs should receive more paid-search spend?", "marketing");
  const coverage = checkInvestigationCoverage(plan, undefined);
  assert.equal(coverage.overallStatus, "blocked");
  assert.ok(coverage.sectionCoverage.some((item) => item.itemId === "direct_answer" && item.status === "blocked"));
});

test("final composer returns the best available draft and marks unsupported promises explicitly", () => {
  const plan = planEvaluation("Which DMAs should receive more paid-search spend?", "marketing");
  const investigation = runMarketInvestigation(plan);
  const coverage = checkInvestigationCoverage(plan, investigation);
  const answer = composeFinalAnswer(plan, investigation, plan.actions[0], coverage);
  assert.equal(answer.sections.length, 7);
  assert.equal(answer.status, "draft_for_review");
  assert.ok(answer.unsupportedRequirementIds.includes("marketing_incrementality"));
  assert.match(answer.sections.find((item) => item.sectionId === "direct_answer")?.content ?? "", /Best available answer|Supported scope/i);
  assert.match(answer.sections.find((item) => item.sectionId === "evidence_findings")?.content ?? "", /Next evidence needed/i);
  assert.match(answer.sections.find((item) => item.sectionId === "missing_evidence")?.content ?? "", /documented but not approved|Missing|gap/i);
  assert.match(answer.disclaimer, /human review/i);
});

test("material action requests remain hard blocked", () => {
  const plan = planEvaluation("Approve a new CVC clinic site in Phoenix.", "cvc");
  assert.equal(plan.status, "blocked");
  const coverage = checkInvestigationCoverage(plan, undefined);
  assert.equal(coverage.overallStatus, "blocked");
});

test("missing decision-grade growth evidence still permits bounded exploratory analysis", () => {
  const plan = planEvaluation("Should we test a growth campaign in Phoenix?", "marketing");
  assert.equal(plan.status, "partially_executable");
  assert.ok(plan.missingEvidence.length > 0);
  assert.equal(plan.actions[0]?.requiresApproval, false);
});

test("the national Marketing golden question is partially executable from available aggregate evidence", () => {
  const plan = planEvaluation(
    "Which comparable geographies show paid-search response worth validating with first-party outcomes?",
    "marketing",
  );
  assert.equal(plan.status, "partially_executable");
  assert.equal(plan.geographyResolution.mode, "national");
  assert.ok(plan.evidenceSelection.datasetId?.startsWith("marketing_"));
  assert.equal(plan.actions.some((action) => action.requiresApproval), false);
});

test("the national Marketing golden question routes without an explicit perspective", () => {
  const plan = planEvaluation(
    "Which comparable geographies show paid-search response worth validating with first-party outcomes?",
  );
  assert.equal(plan.perspectiveId, "marketing");
  assert.equal(plan.status, "partially_executable");
  assert.equal(plan.geographyResolution.mode, "national");
  assert.equal(plan.answerContract.answerMode, "investigation");
});

test("recognized Pricing investigation wording reaches snapshot analysis without authorizing price action", () => {
  const plan = planEvaluation(
    "Where do observed competitor conditions and Chewy economics warrant investigation?",
    "pricing",
  );
  assert.equal(plan.status, "partially_executable");
  assert.equal(plan.perspectiveId, "pricing");
  assert.ok(plan.evidenceSelection.datasetId?.startsWith("pricing_"));
  assert.match(plan.missingEvidence.join(" "), /regional Chewy commercial outcome/i);
  assert.equal(plan.actions[0]?.requiresApproval, false);
  assert.doesNotMatch(plan.actions[0]?.title ?? "", /change price|approve/i);
});

test("Pricing change requests remain clarification or approval-gated instead of using the investigation route", () => {
  const plan = planEvaluation("Where should Chewy change regional prices?", "pricing");
  assert.equal(plan.status, "blocked");
  assert.equal(plan.answerContract.answerMode, "clarification");
});

test("material-action questions run as bounded investigations when an internal evidence view is available", () => {
  assert.equal(
    planEvaluation("Where should Chewy change regional prices?", "pricing", [], "competitor_availability").status,
    "partially_executable",
  );
  const marketing = planEvaluation("Where should we increase paid search spend?", "marketing", [], "paid_search_response");
  assert.equal(marketing.status, "partially_executable");
  assert.equal(marketing.actions[0]?.requiresApproval, false);
  assert.match(marketing.evidenceBoundary, /investigation goal only/i);
  assert.match(marketing.answerContract.prohibitedConclusions.join(" "), /spend change/i);
});

test("versioned answer fixtures compare generated contracts and conclusions without claiming historical approval", () => {
  assert.ok(answerEvaluationFixtures.every((fixture) => fixture.reviewStatus === "synthetic_regression"));
  const results = answerEvaluationFixtures.map(runAnswerEvaluationFixture);
  assert.deepEqual(results.filter((result) => !result.passed), []);
});
