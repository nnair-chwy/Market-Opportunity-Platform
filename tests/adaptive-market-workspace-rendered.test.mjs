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
  assert.doesNotMatch(market, /key=\{`\$\{presentation\.viewId\}/);
  assert.match(market, /marketScores=\{scores\}/);
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

test("Explore, Compare regions, Add view, and Map layers controls are wired on the opening page", () => {
  assert.match(homepage, /data-view-a-control="true"/);
  assert.match(homepage, />\s*Explore\s*</);
  assert.match(homepage, />\s*Compare regions\s*</);
  assert.match(homepage, /Map layers/);
  assert.match(homepage, /Add view/);
  assert.match(homepage, /Compare views/);
  assert.match(homepage, /adaptive-view-b-control/);
  assert.match(homepage, /mapMode=\{activeMapMode\}/);
  assert.match(homepage, /aria-pressed=\{activeMapMode === "compare"\}/);
  assert.match(homepage, /showLayerManager=\{layerManagerOpen\}/);
  assert.match(market, /data-map-mode=\{mapMode\}/);
  assert.match(market, /data-view-a-mode="compare"/);
  assert.match(market, /data-layer-manager="true"/);
  assert.match(market, /data-view-a-mode="single"/);
  assert.match(market, /secondaryMarketScores/);
  assert.match(market, /swipePercent/);
});

test("adaptive homepage transition retains the governed plan and action-packet workflow", () => {
  assert.match(workflow, /evaluationPlanResponseSchema\.safeParse/);
  assert.match(workflow, /setPhase\("interpreting"\)/);
  assert.match(workflow, /setPhase\("running"\)/);
  assert.match(workflow, /setPhase\("packet"\)/);
  assert.match(workflow, /Save action packet/);
  assert.match(workflow, /Download decision brief/);
  assert.match(workflow, /Download audit appendix/);
  assert.match(workflow, /Findings and proposed action/);
  assert.doesNotMatch(workflow, /AskAiPanel/);
  assert.match(workflow, /data-proposal-method/);
  assert.match(workflow, /data-result-workspace/);
});

test("the root cannot import AdaptiveMarketWorkspace without rendering the adaptive homepage", () => {
  assert.match(workflow, /AdaptiveEvaluationWorkspace/);
  assert.match(homepage, /<AdaptiveMarketWorkspace[\s\S]*opening/);
  assert.match(market, /adaptive-map-title/);
  assert.match(homepage, /adaptive-evaluation-goal/);
});
