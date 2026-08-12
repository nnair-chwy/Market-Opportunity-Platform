import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const workflow = fs.readFileSync(new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url), "utf8");
const homepage = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveEvaluationWorkspace.tsx", import.meta.url), "utf8");
const market = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveMarketWorkspace.tsx", import.meta.url), "utf8");

test("the root route renders the adaptive workspace as its initial experience", () => {
  assert.match(root, /DecisionWorkflowApp/);
  assert.match(workflow, /<AdaptiveEvaluationWorkspace/);
  assert.match(homepage, /<AdaptiveMarketWorkspace[\s\S]*opening/);
  assert.match(homepage, /adaptive-question-composer/);
  assert.match(homepage, /onSubmit/);
});

test("the adaptive workspace keeps the map controls and deterministic comparison boundary", () => {
  assert.match(market, /<UnifiedEvaluatorMap/);
  assert.match(market, /Measure/);
  assert.match(market, /<select/);
  assert.match(market, /Workflow/);
  assert.match(market, /Include micropolitan/);
  assert.match(market, /compare_cohort/);
  assert.match(market, /marketScoreLabel=\{scoreLabel\}/);
  assert.match(market, /onChooseMarket=\{setSelectedCode\}/);
  assert.match(market, /MAX_COMPARISON_REGIONS/);
  assert.match(market, /not an opportunity score or recommendation/i);
  assert.match(market, /setSelectedCode\(market\.cbsa_code\)/);
});

test("View A Single Compare and Layer controls are wired on the opening page", () => {
  assert.match(homepage, /data-view-a-control="true"/);
  assert.match(homepage, />\s*Single\s*</);
  assert.match(homepage, />\s*Compare\s*</);
  assert.match(homepage, />\s*Layer\s*</);
  assert.match(homepage, /mapMode=\{activeMapMode\}/);
  assert.match(homepage, /aria-pressed=\{activeMapMode === "compare"\}/);
  assert.match(homepage, /aria-pressed=\{activeMapMode === "layer"\}/);
  assert.match(market, /data-map-mode=\{mapMode\}/);
  assert.match(market, /data-view-a-mode="compare"/);
  assert.match(market, /data-view-a-mode="layer"/);
  assert.match(market, /data-view-a-mode="single"/);
});

test("adaptive homepage transition retains the governed plan and action-packet workflow", () => {
  assert.match(workflow, /evaluationPlanResponseSchema\.safeParse/);
  assert.match(workflow, /planEvaluation\(normalizedQuestion\)/);
  assert.match(workflow, /setPhase\("running"\)/);
  assert.match(workflow, /setPhase\("packet"\)/);
  assert.match(workflow, /Save action packet/);
  assert.match(workflow, /AskAiPanel/);
});

test("the root cannot import AdaptiveMarketWorkspace without rendering the adaptive homepage", () => {
  assert.match(workflow, /AdaptiveEvaluationWorkspace/);
  assert.match(homepage, /<AdaptiveMarketWorkspace[\s\S]*opening/);
  assert.match(market, /adaptive-map-title/);
  assert.match(homepage, /adaptive-evaluation-goal/);
});
