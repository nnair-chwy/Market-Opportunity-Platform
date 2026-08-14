import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url), "utf8");
const market = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveMarketWorkspace.tsx", import.meta.url), "utf8");
const focusMap = fs.readFileSync(new URL("../components/decision-workflow/GeographicFocusMap.tsx", import.meta.url), "utf8");
const investigationPanel = fs.readFileSync(new URL("../components/decision-workflow/MarketInvestigationPanel.tsx", import.meta.url), "utf8");
const questionWorkspace = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveEvaluationWorkspace.tsx", import.meta.url), "utf8");
const sister = fs.readFileSync(new URL("../components/decision-workflow/SisterGeographiesSection.tsx", import.meta.url), "utf8");
const sisterLib = fs.readFileSync(new URL("../lib/planning/sister-geographies.ts", import.meta.url), "utf8");

test("question results do not hard-code Seattle or fixed findings", () => {
  assert.doesNotMatch(market, /useState\("42660"\)/);
  assert.match(market, /initialSelectedCode/);
  assert.match(market, /initialComparisonCodes/);
  assert.doesNotMatch(workflow, /The question is actionable at the market and evidence level/);
  assert.doesNotMatch(workflow, /Three governed action paths/);
  assert.match(workflow, /deterministicFindingsAndProposalSummary/);
  assert.match(workflow, /proposedActionFromPlan/);
});

test("the default CVC perspective does not override question inference", () => {
  assert.match(questionWorkspace, /perspectiveExplicitlySelected/);
  assert.match(questionWorkspace, /onSubmit\(perspectiveExplicitlySelected \? perspectiveId : undefined\)/);
  assert.match(workflow, /\.\.\.\(nextPerspectiveId \? \{ perspectiveId: nextPerspectiveId \} : \{\}\)/);
});

test("request state is transparent before a plan is treated as final", () => {
  assert.match(workflow, /setPhase\("interpreting"\)/);
  assert.match(workflow, /data-plan-request-state=\{phase === "interpreting" \? "pending" : "ready"\}/);
  assert.match(workflow, /data-plan-request-state="error"/);
  assert.match(workflow, /Retry/);
  assert.match(workflow, /Edit question/);
  assert.match(workflow, /data-proposal-method/);
  assert.match(workflow, /analysis-contract-page/);
  assert.match(workflow, /Human checkpoint · before analysis/);
  assert.match(workflow, /AnalysisBriefPanel/);
  assert.match(workflow, /onConfirm=\{confirmAndRun\}/);
  assert.match(workflow, /setPhase\("confirming"\)/);
});

test("confirmed analysis keeps evidence lineage and decision boundaries visible", () => {
  assert.match(workflow, /analysisBrief/);
  assert.match(workflow, /evidencePlan/);
  assert.match(workflow, /reviewablePacket/);
  assert.match(workflow, /Draft for accountable review/);
  assert.match(workflow, /downloadReviewableActionPacket/);
});

test("review page routes result workspace types without interactive comparison", () => {
  assert.match(workflow, /adaptive_market_workspace/);
  assert.match(workflow, /clinic_evaluation_surface/);
  assert.match(workflow, /clarification/);
  assert.match(workflow, /evidence_readiness/);
  assert.match(workflow, /data-result-workspace=\{plan\.resultWorkspaceType\}/);
  assert.match(workflow, /GeographicFocusMap/);
  assert.match(workflow, /DecisionGraphAnimation/);
  assert.match(workflow, /isAnimationPage/);
  assert.match(workflow, /isResultPage/);
  assert.match(workflow, /resolveGeographicFocus/);
  assert.match(workflow, /decision-review-primary/);
  assert.match(workflow, /Action packet/);
  assert.match(workflow, /Download full report/);
  assert.match(workflow, /Findings and proposed action/);
  assert.match(workflow, /packet-action-details/);
  assert.match(workflow, /Action details/);
  assert.match(workflow, /action-packet-governance-note/);
  assert.match(workflow, /downloadReviewableActionPacket/);
  assert.doesNotMatch(workflow, /review-evidence-strip/);
  assert.doesNotMatch(workflow, /Compare possible actions/);
  assert.doesNotMatch(workflow, /AskAiPanel/);
  assert.doesNotMatch(workflow, /AdaptiveMarketWorkspace/);
  assert.doesNotMatch(workflow, /plan-boundary/);
  assert.match(focusMap, /data-focus-state/);
  assert.match(focusMap, /No reliable geographic focus/);
  assert.match(focusMap, /Evidence status/);
  assert.match(focusMap, /Geographic context map/);
  assert.match(focusMap, /Public CBSA context only/);
  assert.match(sisterLib, /suggestSisterGeographiesFromPlan/);
  assert.match(sisterLib, /SISTER_GEOGRAPHY_RULE_ID/);
  assert.match(sister, /Ask about this geography/);
  assert.match(sister, /if \(!suggestions\.length\) return null;/);
});

test("selected analyst leads expose fixture values and drive the map context measure", () => {
  assert.match(investigationPanel, /Source values behind the highlighted markets/);
  assert.match(investigationPanel, /Public context—not a score/);
  assert.match(investigationPanel, /SRC-009 · snapshot footprint only/);
  assert.match(investigationPanel, /onContextMetricChange/);
  assert.match(investigationPanel, /dataSnapshotLabel/);
  assert.match(investigationPanel, /dataSnapshotVersion/);
  assert.match(workflow, /selectedContextMetric/);
  assert.match(workflow, /contextMetric=\{selectedContextMetric\}/);
});

test("finding colors stay synchronized between the map and finding cards", () => {
  assert.match(workflow, /findings=\{investigation\?\.leads \?\? \[\]\}/);
  assert.match(workflow, /selectedLeadId=\{selectedLeadId\}/);
  assert.match(workflow, /onSelectFinding=/);
  assert.match(focusMap, /CBSA_FINDING_LAYER_ID/);
  assert.match(focusMap, /finding_color/);
  assert.match(focusMap, /filteredFindingId/);
  assert.match(focusMap, /aria-pressed/);
  assert.match(focusMap, /Select a finding pill to isolate its market or pair/);
  assert.match(investigationPanel, /--lead-color/);
  assert.match(investigationPanel, /investigationLeadColor/);
});
