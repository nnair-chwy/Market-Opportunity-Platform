import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const map = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveMarketWorkspace.tsx", import.meta.url), "utf8");
const workflow = fs.readFileSync(new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url), "utf8");

test("adaptive market workspace keeps filters, scale, selection, and comparison in one map", () => {
  assert.match(map, /UnifiedEvaluatorMap/);
  assert.match(map, /Measure<select/);
  assert.match(map, /Workflow<select/);
  assert.match(map, /Include micropolitan/);
  assert.match(map, /compare_cohort/);
  assert.match(map, /marketScoreLabel=.*percentile/);
  assert.match(map, /onChooseMarket=\{setSelectedCode\}/);
  assert.match(map, /Add to comparison/);
  assert.match(map, /comparisonCodes\.length >= 5/);
  assert.match(map, /not an opportunity score or recommendation/i);
});

test("question workflow uses validated plans and preserves the saved packet path", () => {
  assert.match(workflow, /evaluationPlanResponseSchema\.safeParse/);
  assert.match(workflow, /planEvaluation\(normalizedQuestion\)/);
  assert.match(workflow, /AdaptiveMarketWorkspace/);
  assert.match(workflow, /window\.localStorage\.getItem/);
  assert.match(workflow, /Save action packet/);
  assert.match(workflow, /AskAiPanel/);
});
