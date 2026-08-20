import assert from "node:assert/strict";
import test from "node:test";
import { runCurrentDataInsightDiscovery } from "../lib/insight-discovery/current-data-discovery.ts";
import { findingPresentation, recommendationTypeForFinding } from "../lib/insight-discovery/finding-presentation.ts";

test("stakeholder presentation separates recommendation type, confidence, value, and urgency", () => {
  const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T00:00:00.000Z", runId: "presentation-test" });
  const finding = run.findings[0]!;
  const presentation = findingPresentation(finding);

  assert.ok(["act_now", "controlled_test", "investigate", "monitor", "data_quality"].includes(presentation.recommendationType));
  assert.ok(["High", "Medium", "Low"].includes(presentation.confidence));
  assert.ok(presentation.valueStatus.length > 0);
  assert.ok(presentation.urgency.length > 0);
  assert.equal(recommendationTypeForFinding(finding), presentation.recommendationType);
  assert.equal("score" in presentation, false);
});

test("coverage-risk findings are presented as data quality issues instead of opportunities", () => {
  const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T00:00:00.000Z", runId: "coverage-test" });
  const finding = run.findings.find((candidate) => candidate.decisionValue.flags.includes("coverage_risk"));
  assert.ok(finding);
  assert.equal(findingPresentation(finding!).recommendationType, "data_quality");
});
