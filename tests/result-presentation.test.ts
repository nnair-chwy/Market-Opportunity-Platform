import assert from "node:assert/strict";
import test from "node:test";
import { planEvaluation, resolveFinalPresentationMode } from "../lib/planning/index.ts";

test("descriptive, comparative, and exploratory questions end as results", () => {
  const cases = [
    ["Describe the population of the Dallas metro.", "marketing"],
    ["Compare household demand in Atlanta and Phoenix.", "marketing"],
    ["Which clinic footprint patterns are worth investigating?", "cvc"],
    ["Why is clinic performance lower in Atlanta?", "cvc"],
  ] as const;

  for (const [question, perspective] of cases) {
    const plan = planEvaluation(question, perspective);
    assert.equal(resolveFinalPresentationMode(plan), "result_only", question);
  }
});

test("questions asking for a material lever end with an action package", () => {
  const cases = [
    ["Where should we increase paid search spend?", "marketing"],
    ["Where should we open a clinic?", "cvc"],
    ["Should we approve a new clinic site in Atlanta?", "cvc"],
  ] as const;

  for (const [question, perspective] of cases) {
    const plan = planEvaluation(question, perspective);
    assert.equal(resolveFinalPresentationMode(plan), "action_package", question);
  }
});

test("a material question that still needs clarification shows clarification before a package", () => {
  const plan = planEvaluation("Where can we raise the price?", "pricing");
  assert.equal(plan.answerContract.answerMode, "clarification");
  assert.equal(resolveFinalPresentationMode(plan), "result_only");
});

test("an explicit public measure is not replaced by the active business-view dataset", () => {
  const plan = planEvaluation("Describe the population of the Dallas metro.", "marketing", [], "paid_search_response");
  assert.equal(plan.intent.requestedMeasure, "total_population");
  assert.equal(plan.evidenceSelection.datasetId, null);
  assert.deepEqual(plan.evidenceSelection.sourceIds, ["SRC-016"]);
  assert.equal(plan.evidenceSelection.selectionReason, "question_inference");
});

test("a national highest-population question remains a descriptive Census result", () => {
  const plan = planEvaluation("Which U.S. markets have the highest population?", "marketing");
  assert.equal(plan.intent.topic, "market_context");
  assert.equal(plan.intent.requestedMeasure, "total_population");
  assert.equal(plan.capabilityId, "census_market_context");
  assert.equal(plan.evidenceSelection.datasetId, null);
  assert.equal(resolveFinalPresentationMode(plan), "result_only");
});

test("a natural source-coverage question keeps the registered coverage workflow", () => {
  const plan = planEvaluation("Which markets have regional, clinic, and Google Ads evidence?", "marketing");
  assert.equal(plan.intent.topic, "source_coverage");
  assert.equal(plan.intent.requestedAction, "describe");
  assert.deepEqual(plan.intent.selectedQueries, ["supported_regions"]);
  assert.equal(resolveFinalPresentationMode(plan), "result_only");
});

test("a Pricing comparison across Atlanta and Phoenix produces a descriptive result plan", () => {
  const plan = planEvaluation("Compare observed prices in Atlanta and Phoenix.", "pricing");
  assert.equal(plan.intent.topic, "multi_market_comparison");
  assert.equal(plan.answerContract.answerMode, "comparison");
  assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, ["12060", "38060"]);
  assert.ok(plan.actions[0]?.evidence.length);
  assert.doesNotMatch(plan.actions[0]?.title ?? "", /clinic/i);
  assert.equal(resolveFinalPresentationMode(plan), "result_only");
});
