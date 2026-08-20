import assert from "node:assert/strict";
import test from "node:test";
import { buildSlackDiscoveryMessages } from "../lib/sharing/slack-discovery.ts";
import type { AutonomousInsight } from "../lib/insight-discovery/current-data-discovery.ts";

function finding(index: number): AutonomousInsight {
  return {
    insightId: `finding-${index}`,
    department: index % 2 ? "marketing" : "pricing",
    marketIds: [String(index)],
    marketName: `Market ${index}`,
    headline: `Finding ${index}`,
    whyInteresting: "Why",
    evidenceDetail: "Evidence",
    nextValidation: `Validate ${index}`,
    sourceIds: ["SRC-001"],
    snapshotVersions: ["v1"],
    hypothesisIds: ["h1"],
    signalCount: 1,
    priority: "single-signal lead",
    question: "Question",
    applicability: { primaryTeamId: "growth_marketing", primaryTeamLabel: "Growth Marketing", reason: "Reason", partnerTeams: [], approvalBoundary: "Review" },
    decisionValue: { score: 80, reason: "Reason", flags: [] },
    valueTranslation: { kind: "modeled_scenario", label: "Value", statement: `Value ${index}`, caveat: "Caveat" },
    businessValue: { status: "proxy_only", label: "Not sized", headline: "Opportunity is not yet validated.", formula: "Incremental value / spend", requiredInputs: ["outcomes"], sourceIds: [] },
    importance: { score: index, tier: "validate_next", label: "Validate next", reason: "Reason", notificationCandidate: false },
  };
}

test("builds ranked Slack batches containing every discovery finding", () => {
  const findings = Array.from({ length: 35 }, (_, index) => finding(index + 1));
  const messages = buildSlackDiscoveryMessages({ runId: "run-1", runSequence: 2, completedAt: "2026-08-19T00:00:00Z", analysesRun: 9, findings });
  assert.equal(messages.length, 2);
  const sections = messages.flatMap((message) => message.blocks.filter((block) => block.type === "section"));
  assert.equal(sections.length, 35);
  assert.match(sections[0].text.text, /Market 35/);
  assert.match(sections.at(-1)!.text.text, /Market 1/);
  assert.match(sections[0].text.text, /Opportunity size:.*not yet validated/i);
  assert.match(sections[0].text.text, /How value will be calculated:.*Incremental value \/ spend/i);
});

test("escapes Slack markup from discovery findings", () => {
  const unsafe = finding(1);
  unsafe.headline = "A <region> & value";
  const [message] = buildSlackDiscoveryMessages({ runId: "run<&>", runSequence: 1, completedAt: "now", analysesRun: 1, findings: [unsafe] });
  const section = message.blocks.find((block) => block.type === "section");
  assert.ok(section && section.type === "section");
  assert.match(section.text.text, /A &lt;region&gt; &amp; value/);
});
