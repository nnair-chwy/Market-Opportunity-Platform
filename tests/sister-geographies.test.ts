import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildSisterFollowUpQuestion,
  focusPlaceLabelsForRewrite,
  planEvaluation,
  suggestSisterGeographiesFromPlan,
} from "../lib/planning/index.ts";

test("sister geographies are shown when validated candidates exist", () => {
  const plan = planEvaluation(
    "Which Seattle-area markets should we investigate for a future Chewy Vet Care clinic?",
  );
  const suggestions = suggestSisterGeographiesFromPlan(plan);
  assert.equal(plan.geographyResolution.mode, "single");
  assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, ["42660"]);
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.length <= 3);
  assert.equal(suggestions.some((item) => item.cbsaCode === "42660"), false);
  assert.equal(suggestions.every((item) => item.evidenceStatus === "Confirmed"), true);
  assert.equal(suggestions.every((item) => item.scoringEligibility === "none"), true);
  assert.equal(suggestions.every((item) => item.signals.length >= 2), true);
  assert.equal(
    suggestions.every((item) => item.signals.every((signal) => signal.value !== null)),
    true,
  );
  for (let index = 1; index < suggestions.length; index += 1) {
    assert.ok(
      suggestions[index - 1].cbsaName.localeCompare(suggestions[index].cbsaName) <= 0,
      "sister geographies must stay alphabetical without a composite score",
    );
  }
});

test("no sister-geography section appears when there are no eligible candidates", () => {
  const plan = planEvaluation("Which U.S. markets have the highest population density?");
  const suggestions = suggestSisterGeographiesFromPlan(plan);
  assert.equal(plan.geographyResolution.selectedCbsaCodes.length, 0);
  assert.deepEqual(suggestions, []);

  const unavailable = suggestSisterGeographiesFromPlan(plan, 3, []);
  assert.deepEqual(unavailable, []);

  const section = fs.readFileSync(
    new URL("../components/decision-workflow/SisterGeographiesSection.tsx", import.meta.url),
    "utf8",
  );
  assert.match(section, /if \(!suggestions\.length\) return null;/);
  assert.match(section, /Suggested follow-up geographies/);
  assert.doesNotMatch(section, /No sister geographies are listed/);
});

test("evaluation-result focus can supply sister candidates without inventing scores", () => {
  const plan = planEvaluation("Which U.S. markets have the highest population density?");
  const suggestions = suggestSisterGeographiesFromPlan(plan, 3, ["42660"]);
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.length <= 3);
  assert.equal(suggestions.some((item) => item.cbsaCode === "42660"), false);
  assert.equal(suggestions.every((item) => item.signals.every((signal) => signal.id !== "opportunity_score")), true);
  assert.match(suggestions[0].uncertainty, /do not establish similar demand/i);
});

test("selecting a geography starts a new question without mutating the current packet", () => {
  const plan = planEvaluation(
    "Which Seattle-area markets should we investigate for a future Chewy Vet Care clinic?",
  );
  const suggestions = suggestSisterGeographiesFromPlan(plan);
  assert.ok(suggestions.length > 0);
  const sister = suggestions[0];
  const followUp = buildSisterFollowUpQuestion(
    plan.originalQuestion,
    focusPlaceLabelsForRewrite(plan),
    sister,
  );
  assert.match(followUp, new RegExp(sister.principalCityLabel, "i"));
  assert.notEqual(followUp, plan.originalQuestion);

  const workflow = fs.readFileSync(
    new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /function askAboutSisterGeography/);
  assert.match(workflow, /setPhase\("question"\)/);
  assert.match(workflow, /setQuestion\(followUp\)/);
  assert.match(workflow, /Create a new action packet/);
  assert.match(workflow, /was not changed/);
  assert.match(workflow, /was not saved or overwritten/);
  assert.doesNotMatch(
    workflow,
    /function askAboutSisterGeography[\s\S]*setSavedPackets\(/,
  );
  assert.doesNotMatch(
    workflow,
    /function askAboutSisterGeography[\s\S]*localStorage\.setItem\("market-intelligence-action-packets"/,
  );
});
