import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url), "utf8");
const market = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveMarketWorkspace.tsx", import.meta.url), "utf8");
const focusMap = fs.readFileSync(new URL("../components/decision-workflow/GeographicFocusMap.tsx", import.meta.url), "utf8");
const investigationPanel = fs.readFileSync(new URL("../components/decision-workflow/MarketInvestigationPanel.tsx", import.meta.url), "utf8");
const revisionBar = fs.readFileSync(new URL("../components/decision-workflow/RecommendationRevisionBar.tsx", import.meta.url), "utf8");
const globalStyles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
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
  assert.match(questionWorkspace, /perspectiveExplicitlySelected \? activeView\.viewId : undefined/);
  assert.match(workflow, /\.\.\.\(nextPerspectiveId \? \{ perspectiveId: nextPerspectiveId \} : \{\}\)/);
  assert.match(workflow, /\.\.\.\(activeViewId \? \{ activeViewId \} : \{\}\)/);
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
  assert.match(workflow, /answerContract=\{plan\.answerContract\}/);
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

test("result signals retain the user's exact question beside the investigation", () => {
  assert.match(workflow, /<span>Your question<\/span>/);
  assert.match(workflow, /<strong>\{plan\.originalQuestion\}<\/strong>/);
  assert.match(workflow, /Investigation framing/);
  assert.match(investigationPanel, /Question being answered/);
  assert.match(investigationPanel, /investigation\.originalQuestion/);
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
  assert.match(workflow, /Download decision brief/);
  assert.match(workflow, /Download audit appendix/);
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
  assert.match(focusMap, /Confirmed question measure/);
  assert.match(focusMap, /Blue intensity shows the active measure/);
  assert.match(focusMap, /Region analysis/);
  assert.match(focusMap, /selectedRegionFinding/);
  assert.match(focusMap, /Markets are labeled A\/B/);
  assert.match(focusMap, /Evaluation score/);
  assert.match(focusMap, /This investigation is not authorized to score market attractiveness/);
  assert.match(focusMap, /measureRange/);
  assert.match(focusMap, /Tell me more/);
  assert.match(focusMap, /\/api\/ai\/insights/);
  assert.match(focusMap, /Do not convert the active-measure percentile into an attractiveness score/);
  assert.match(workflow, /questionContext=\{`Original question: \$\{plan\.originalQuestion\} Analyst-framed question:/);
  assert.match(sisterLib, /suggestSisterGeographiesFromPlan/);
  assert.match(sisterLib, /SISTER_GEOGRAPHY_RULE_ID/);
  assert.match(sister, /Ask about this geography/);
  assert.match(sister, /if \(!suggestions\.length\) return null;/);
});

test("selected analyst leads expose fixture values and drive the map context measure", () => {
  assert.match(investigationPanel, /Joined measures behind the highlighted market/);
  assert.match(investigationPanel, /Transparent measures—not a blended score/);
  assert.match(investigationPanel, /SRC-009 · snapshot footprint only/);
  assert.match(investigationPanel, /onContextMetricChange/);
  assert.match(investigationPanel, /dataSnapshotLabel/);
  assert.match(investigationPanel, /dataSnapshotVersion/);
  assert.match(workflow, /selectedContextMetric/);
  assert.match(workflow, /contextMetric=\{selectedContextMetric\}/);
  assert.match(workflow, /defaultLeadForQuestion/);
  assert.match(workflow, /patternByMeasure/);
});

test("opening-map selections explain the active measure instead of repeating only a boundary", () => {
  assert.match(market, /marketDetailByCode/);
  assert.match(market, /What this measure says/);
  assert.match(market, /same-SKU Chewy benchmark is not joined here/);
  assert.match(market, /use click-through rate to judge response independent of impressions/i);
});

test("final results lead with portfolio patterns and keep analysis mechanics collapsed", () => {
  assert.match(investigationPanel, /Portfolio pattern/);
  assert.match(investigationPanel, /portfolioPattern\.segments/);
  assert.match(investigationPanel, /<details className="analysis-behind-scenes">/);
  assert.doesNotMatch(investigationPanel, /<details className="analysis-behind-scenes" open/);
  assert.match(investigationPanel, /How the analysis worked/);
});

test("recommendations expose channel scope and preserve numbered analyst revisions", () => {
  assert.match(investigationPanel, /Advertising channel scope/);
  assert.match(investigationPanel, /No cross-channel bundling|mediaScope\.bundlingRule/);
  assert.match(revisionBar, /What should the agent reconsider/);
  assert.match(revisionBar, /Recommended follow-up/);
  assert.match(workflow, /Recommendation drafts/);
  assert.match(workflow, /Draft \{draft\.number\}/);
  assert.match(workflow, /reviseMarketInvestigation/);
  assert.match(workflow, /openRecommendationDraft/);
});

test("analyst review stays docked to the viewport without covering result content", () => {
  assert.match(revisionBar, /createPortal/);
  assert.match(revisionBar, /document\.body/);
  assert.match(globalStyles, /\.recommendation-revision \{[^}]*bottom: max\(16px, env\(safe-area-inset-bottom\)\)[^}]*position: fixed[^}]*z-index: 50/s);
  assert.match(globalStyles, /\.result-page-layout \.decision-content\.result-page \{\s*padding-bottom: 210px;/);
});

test("finding colors stay synchronized between the map and finding cards", () => {
  assert.match(workflow, /findings=\{investigation\?\.leads \?\? \[\]\}/);
  assert.match(workflow, /selectedLeadId=\{selectedLeadId\}/);
  assert.match(workflow, /onSelectFinding=/);
  assert.match(focusMap, /CBSA_FINDING_LAYER_ID/);
  assert.match(focusMap, /finding_color/);
  assert.match(focusMap, /filteredFindingId/);
  assert.match(focusMap, /aria-pressed/);
  assert.match(focusMap, /Select one to turn it into the active visual answer/);
  assert.match(investigationPanel, /--lead-color/);
  assert.match(investigationPanel, /investigationLeadColor/);
});
