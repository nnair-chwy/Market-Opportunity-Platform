import assert from "node:assert/strict";
import test from "node:test";
import { getAdaptiveDecisionFindings, getAdaptiveDiscoveryAudit } from "../lib/insight-discovery/adaptive-decision-insights.ts";

test("adaptive discovery generates evidence-backed questions beyond the fixed registry", () => {
  const audit = getAdaptiveDiscoveryAudit();
  const findings = getAdaptiveDecisionFindings();

  assert.equal(audit.method, "data_generated_decision_hypotheses");
  assert.ok(audit.sourceCount >= 5);
  assert.ok(audit.generatedCount >= 10);
  assert.equal(audit.testedCount, audit.generatedCount);
  assert.ok(findings.some((finding) => finding.type === "joint_opportunity"));
  assert.ok(findings.some((finding) => finding.type === "contradiction"));
  assert.ok(findings.some((finding) => finding.findingKind === "price_test"));
  assert.ok(findings.some((finding) => finding.findingKind === "competitive_risk"));
  assert.ok(findings.some((finding) => finding.departments.length > 1));
  assert.ok(findings.every((finding) => finding.metrics.length && finding.proposedAction && finding.decisionBoundary));
});

test("adaptive findings preserve quantified benchmarks and explicit scope", () => {
  const findings = getAdaptiveDecisionFindings();
  const crossAccount = findings.find((finding) => finding.type === "joint_opportunity");
  const cvcMix = findings.find((finding) => finding.departments.includes("cvc") && finding.departments.includes("marketing"));
  const pricing = findings.find((finding) => finding.findingKind === "price_test");

  assert.ok(crossAccount?.metrics.some((metric) => metric.id.includes("cpa")));
  assert.match(crossAccount?.decisionBoundary ?? "", /not|does not|cannot/i);
  assert.ok(cvcMix);
  assert.ok((pricing?.sourceIds.length ?? 0) >= 2);
  assert.ok(findings.every((finding) => finding.confidence.reason && finding.limits.length));
});
