import assert from "node:assert/strict";
import test from "node:test";
import {
  checkInvestigationCoverage,
  evaluateActionDirection,
  evaluateAnswerCompletion,
  planEvaluation,
  requestedActionDirection,
} from "../lib/planning/index.ts";
import { runMarketInvestigation } from "../lib/planning/market-investigation.ts";

test("spend-more wording resolves to an increase goal", () => {
  const plan = planEvaluation("Where should we spend more on ads?", "marketing");
  assert.equal(requestedActionDirection(plan), "increase");
  assert.equal(
    evaluateActionDirection(plan, "Prepare a bounded paid-search spend-increase test in the strongest candidate market.").status,
    "matched",
  );
});

test("protective caveats do not look like an opposite recommendation", () => {
  const plan = planEvaluation("Where should we spend more on ads?", "marketing");
  const result = evaluateActionDirection(
    plan,
    "Do not reduce spend from cost pressure alone. Prepare a bounded paid-search spend-increase test before changing live budget.",
  );
  assert.equal(result.status, "matched");
});

test("opposite-looking evidence can remain supporting detail when the recommendation follows the goal", () => {
  const plan = planEvaluation("Where should we spend more on ads?", "marketing");
  const investigation = runMarketInvestigation(plan);
  const alignedAction = {
    ...plan.actions[0],
    title: "Prepare a bounded spend-increase test",
    summary: "Test an increase in paid-search spend in the strongest candidate market.",
    nextStep: "Pre-register a reversible treatment and stable control before changing live spend.",
  };
  const costPressureInvestigation = {
    ...investigation,
    leads: investigation.leads.map((lead, index) => index === 0
      ? { ...lead, businessMeaning: "High CPC may indicate overpayment and should remain supporting evidence." }
      : lead),
  };
  const coverage = checkInvestigationCoverage(plan, costPressureInvestigation, alignedAction);
  const report = evaluateAnswerCompletion(plan, costPressureInvestigation, coverage, alignedAction);
  const goalCriterion = report.criteria.find((criterion) => criterion.criterionId === "answers_confirmed_question");

  assert.equal(goalCriterion?.status, "pass");
});

test("an increase goal cannot pass with a reduce-spend or overpayment answer", () => {
  const plan = planEvaluation("Where should we spend more on ads?", "marketing");
  const investigation = runMarketInvestigation(plan);
  const opposingAction = {
    ...plan.actions[0],
    title: "Reduce paid-search spend",
    summary: "These markets are overpaying, so decrease paid-search spend.",
    nextStep: "Cut the budget in the highest-CPC market.",
  };
  const coverage = checkInvestigationCoverage(plan, investigation, opposingAction);
  const report = evaluateAnswerCompletion(plan, investigation, coverage, opposingAction);
  const goalCriterion = report.criteria.find((criterion) => criterion.criterionId === "answers_confirmed_question");

  assert.equal(goalCriterion?.status, "fail");
  assert.match(goalCriterion?.explanation ?? "", /opposite lever direction|overpayment/i);
});
