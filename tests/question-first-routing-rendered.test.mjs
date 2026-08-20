import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url), "utf8");
assert.match(workflow, /plan\.intent\.topic !== "clinic_location"/);
const market = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveMarketWorkspace.tsx", import.meta.url), "utf8");
const focusMap = fs.readFileSync(new URL("../components/decision-workflow/GeographicFocusMap.tsx", import.meta.url), "utf8");
const questionMap = fs.readFileSync(new URL("../components/decision-workflow/QuestionMap.tsx", import.meta.url), "utf8");
const analysisBriefPanel = fs.readFileSync(new URL("../components/decision-workflow/AnalysisBriefPanel.tsx", import.meta.url), "utf8");
const investigationPanel = fs.readFileSync(new URL("../components/decision-workflow/MarketInvestigationPanel.tsx", import.meta.url), "utf8");
const revisionBar = fs.readFileSync(new URL("../components/decision-workflow/RecommendationRevisionBar.tsx", import.meta.url), "utf8");
const outputBuilder = fs.readFileSync(new URL("../components/decision-workflow/ResultOutputBuilder.tsx", import.meta.url), "utf8");
const globalStyles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const questionWorkspace = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveEvaluationWorkspace.tsx", import.meta.url), "utf8");
const questionRegistry = fs.readFileSync(new URL("../lib/questions/registry.ts", import.meta.url), "utf8");
const sister = fs.readFileSync(new URL("../components/decision-workflow/SisterGeographiesSection.tsx", import.meta.url), "utf8");
const sisterLib = fs.readFileSync(new URL("../lib/planning/sister-geographies.ts", import.meta.url), "utf8");
const discoveryWorkspace = fs.readFileSync(new URL("../components/insight-discovery/AutonomousDiscoveryWorkspace.tsx", import.meta.url), "utf8");
const openingFindings = fs.readFileSync(new URL("../components/insight-discovery/OpeningFindingsControl.tsx", import.meta.url), "utf8");

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
  assert.match(workflow, /perspectiveId: nextPerspectiveId/);
  assert.match(workflow, /activeViewId,/);
});

test("opening experience exposes the approved perspective-specific evidence questions", () => {
  const approved = [
    "What clinic footprint patterns are worth investigating?",
    "Which comparable metros have different CVC footprints, and what should we validate next?",
    "Where is paid search response concentrated, and which regions need validation?",
    "Which comparable metros have different paid search response percentiles?",
    "Where does monitored competitor availability differ by region?",
    "Which comparable metros have different competitor-availability percentiles?",
  ];
  for (const question of approved) assert.match(questionRegistry, new RegExp(question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(questionWorkspace, /listStarterQuestions/);
  assert.match(questionWorkspace, /What works now/);
  assert.match(questionWorkspace, /Product vision/);
  assert.match(workflow, /\/api\/evaluation-plans\/execute/);
  assert.match(workflow, /EvidenceBundlePanel/);
  assert.ok(questionWorkspace.indexOf('className="adaptive-question-composer"') < questionWorkspace.indexOf('<AdaptiveMarketWorkspace'));
});

test("opening experience offers a question-free autonomous insight path", () => {
  assert.match(questionWorkspace, /OpeningFindingsControl/);
  assert.match(openingFindings, /Evidence inbox/);
  assert.match(openingFindings, /Run discovery/);
  assert.match(workflow, /phase === "discovery"/);
  assert.match(workflow, /AutonomousDiscoveryWorkspace/);
  assert.match(discoveryWorkspace, /\/api\/insight-discovery/);
  assert.match(discoveryWorkspace, /generated decision hypotheses from the data/i);
  assert.match(discoveryWorkspace, /cohort, contradiction, channel-mix, quality, and matched-SKU operators/i);
  assert.match(discoveryWorkspace, /Cross-source signals that change a decision/);
  assert.match(discoveryWorkspace, /Incomplete cross-source questions/);
  assert.match(discoveryWorkspace, /These are not findings/);
  assert.match(discoveryWorkspace, /Evidence needed next/);
  assert.match(discoveryWorkspace, /Analyses completed/);
  assert.match(discoveryWorkspace, /Open in Ask AI/);
  assert.match(discoveryWorkspace, /Continue the investigation/);
  assert.match(discoveryWorkspace, /attributed efficiency remain after joining new-customer and contribution outcomes/);
  assert.match(discoveryWorkspace, /click-through rate, attributed conversion rate, and cost per conversion/);
  assert.match(discoveryWorkspace, /setFollowUpQuestion\(finding\.question\)/);
  assert.match(workflow, /Hide autonomous workflow panel/);
  assert.match(workflow, /Show workflow/);
  assert.match(discoveryWorkspace, /Find next signals/);
  assert.match(discoveryWorkspace, /Same snapshots · next qualified findings/);
  assert.match(discoveryWorkspace, /no data refresh is claimed/i);
  assert.match(discoveryWorkspace, /generated hypotheses ·.*evidence-backed/i);
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
  assert.match(workflow, /onUpdatePlan=\{updateAnalysisPlan\}/);
  assert.match(workflow, /onConfirm=\{confirmAndRun\}/);
  assert.match(workflow, /canRun onUpdatePlan/);
  assert.match(workflow, /setPhase\("confirming"\)/);
  assert.match(workflow, /buildAnalysisPlanRequest/);
  assert.match(workflow, /perspectiveId: plan\.perspectiveId/);
  assert.match(workflow, /activeViewId: plan\.evidenceSelection\.viewId/);
  assert.match(workflow, /selectedCbsaCodes: selectedGeographicContexts/);
  assert.match(workflow, /Regenerating the intent, metrics, geography, capability, and registered queries/);
  assert.match(workflow, /Review the changed interpretation and confirm again before any query runs/);
  assert.match(workflow, /validateAnalysisBriefConsistency/);
  assert.match(workflow, /Execution was stopped before any query ran/);
});

test("analysis-plan review follows question, method, boundary, then action", () => {
  const questionIndex = analysisBriefPanel.indexOf('className="analysis-brief-question"');
  const methodIndex = analysisBriefPanel.indexOf('className="analysis-brief-considerations"');
  const boundaryIndex = analysisBriefPanel.indexOf('className="answer-contract-preview"');
  const actionIndex = analysisBriefPanel.indexOf('className="analysis-brief-footer"');
  assert.ok(questionIndex >= 0 && questionIndex < methodIndex);
  assert.ok(methodIndex < boundaryIndex);
  assert.ok(boundaryIndex < actionIndex);
  assert.match(analysisBriefPanel, /See required answer sections, completion tests, and limits/);
});

test("nonfatal map errors do not replace an already loaded basemap", () => {
  for (const source of [questionMap, focusMap]) {
    assert.match(source, /let styleReady = false/);
    assert.match(source, /styleReady = true/);
    assert.match(source, /if \(!styleReady && !disposed\)/);
  }
});

test("confirmed analysis keeps evidence lineage and decision boundaries visible", () => {
  assert.match(workflow, /analysisBrief/);
  assert.match(workflow, /evidencePlan/);
  assert.match(workflow, /reviewablePacket/);
  assert.match(workflow, /Draft for accountable review/);
  assert.match(workflow, /downloadReviewableActionPacket/);
  assert.match(workflow, /saved-action-packet-v2/);
  assert.match(workflow, /evidenceExecution,/);
  assert.match(workflow, /packetAnswer: reviewablePacket\.packetAnswer/);
  assert.match(workflow, /packetSummary,/);
  assert.match(workflow, /reviewablePacket,/);
  assert.match(workflow, /packet\.plan \? evaluationPlanSchema\.safeParse/);
  assert.match(workflow, /No replanning or query execution occurred/);
  assert.match(workflow, /setPersistedReviewablePacket/);
});

test("result signals retain the user's exact question beside the investigation", () => {
  assert.match(workflow, /<span>Your question<\/span>/);
  assert.match(workflow, /<strong>\{plan\.originalQuestion\}<\/strong>/);
  assert.match(workflow, /Investigation framing/);
  assert.match(investigationPanel, /Question being answered/);
  assert.match(investigationPanel, /investigation\.originalQuestion/);
});

test("used reviewed sources update the effective client plan before investigation and packet composition", () => {
  assert.match(workflow, /effectivePlanForSourceAdaptation/);
  assert.match(workflow, /marketInvestigationFromEvidence\(executedPlan, parsed\.data\)/);
  assert.match(workflow, /assembleReviewableActionPacket\(\s*effectivePlan,/);
  assert.match(workflow, /AnswerEvidenceTrail plan=\{effectivePlan \?\? plan\}/);
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
  assert.match(workflow, /Download Word decision brief/);
  assert.match(workflow, /Download Word audit appendix/);
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

test("result exports confirm a visible CSV or Word structure before download", () => {
  assert.match(workflow, /ResultOutputBuilder packet=\{reviewablePacket\}/);
  assert.match(outputBuilder, /Word report/);
  assert.match(outputBuilder, /CSV by market/);
  assert.match(outputBuilder, /Sample · first/);
  assert.match(outputBuilder, /Confirm output structure/);
  assert.match(outputBuilder, /Blank—unsupported/);
  assert.match(outputBuilder, /downloadDecisionBrief/);
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

test("results lead with the answer and map before structured evidence", () => {
  const answerIndex = workflow.indexOf('data-result-priority="answer-to-goal"');
  const evidenceIndex = workflow.indexOf('<EvidenceBundlePanel');
  const mapIndex = workflow.indexOf('<GeographicFocusMap');
  assert.ok(answerIndex >= 0 && answerIndex < mapIndex);
  assert.ok(mapIndex < evidenceIndex);
  assert.match(workflow, /<span>Recommendation<\/span>/);
  assert.match(workflow, /decision-map-answer-layout/);
  assert.match(globalStyles, /\.decision-map-answer-layout \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(workflow, /Selected finding and action readiness/);
  assert.match(workflow, /owned-action-plan/);
  assert.match(workflow, /How this answer was built/);
  assert.match(workflow, /answer-contract-details/);
});

test("the opening map keeps findings and saved work in the map-help toolbar", () => {
  assert.match(questionWorkspace, /aria-label={`Open \$\{savedPackets\.length\} saved action/);
  assert.match(questionWorkspace, /<strong>Saved<\/strong>/);
  assert.doesNotMatch(questionWorkspace, /<strong>Recent action packets<\/strong>/);
  assert.match(market, /adaptive-opening-toolbar/);
  assert.match(globalStyles, /\.adaptive-opening-toolbar \{[^}]*display: flex/);
});

test("review action packet uses the full result width", () => {
  assert.match(
    globalStyles,
    /\.result-page-layout \.decision-review-primary\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
  );
  assert.doesNotMatch(
    globalStyles,
    /\.result-page-layout \.decision-review-primary\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)\s+minmax\(0, 1fr\);/s,
  );
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

test("saved packets preserve lead-specific metadata and restore stored registered-evidence investigations", () => {
  assert.match(workflow, /title: packetAction\.title/);
  assert.match(workflow, /actionId: packetAction\.id/);
  assert.match(workflow, /planActionId: selectedAction\.id/);
  assert.match(workflow, /restoreSavedInvestigation\(restoredPlan, packet\.investigation, fallbackInvestigation\)/);
  assert.match(workflow, /const restoredDrafts = restoredInvestigation/);
  assert.doesNotMatch(workflow, /setInvestigation\(usesRegisteredEvidence \? null : restoredInvestigation\)/);
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
