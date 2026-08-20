import assert from "node:assert/strict";
import test from "node:test";
import { runCurrentDataInsightDiscovery } from "../lib/insight-discovery/current-data-discovery.ts";
import { findingPresentation, recommendationTypeForFinding } from "../lib/insight-discovery/finding-presentation.ts";

test("stakeholder presentation separates recommendation type, confidence, value, and urgency", () => {
  const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T00:00:00.000Z", runId: "presentation-test" });
  const finding = run.findings[0]!;
  const presentation = findingPresentation(finding);

  assert.ok(["act_now", "controlled_test", "investigate", "monitor", "data_quality"].includes(presentation.recommendationType));
  assert.match(presentation.signalConfidence, /Google Ads|Tableau|clinic footprint|competitor offers/i);
  assert.ok(presentation.decisionReadiness.length > 0);
  assert.ok(presentation.recommendedMove.length > 0);
  assert.ok(presentation.expectedResult.length > 0);
  assert.ok(presentation.valueStatus.length > 0);
  assert.ok(presentation.analystRecommendation.length > 0);
  assert.ok(presentation.analystRead.length > 0);
  assert.ok(presentation.evidenceSummary.length > 0);
  assert.ok(presentation.nextAction.length > 0);
  assert.ok(presentation.urgency.length > 0);
  assert.equal(recommendationTypeForFinding(finding), presentation.recommendationType);
  assert.equal("score" in presentation, false);
});

test("marketing presentation distinguishes a performance signal from comparison context", () => {
  const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T00:00:00.000Z", runId: "marketing-presentation-test" });
  const finding = run.findings.find((candidate) => candidate.marketName === "McAllen-Edinburg-Mission, TX" && candidate.department === "marketing");
  assert.ok(finding);
  const presentation = findingPresentation(finding!);

  assert.match(presentation.analystRecommendation, /^Growth Marketing should build a bounded paid-search geo test/i);
  assert.match(presentation.analystRecommendation, /Keep total national spend flat.*matched control.*launch only after/i);
  assert.match(presentation.analystRead, /CTR 1\.2%.*attributed conversion rate 20\.0%.*attributed CPA \$3\.86/i);
  assert.match(presentation.evidenceSummary, /Google Ads regional performance.*Census CBSA market context/i);
  assert.match(presentation.evidenceSummary, /not an independent outcome/i);
  assert.match(presentation.valueStatus, /Incremental sales, new customers, and contribution are not connected/i);
});

test("coverage-risk findings are presented as data quality issues instead of opportunities", () => {
  const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T00:00:00.000Z", runId: "coverage-test" });
  const finding = run.findings.find((candidate) => candidate.decisionValue.flags.includes("coverage_risk"));
  assert.ok(finding);
  assert.equal(findingPresentation(finding!).recommendationType, "data_quality");
});
