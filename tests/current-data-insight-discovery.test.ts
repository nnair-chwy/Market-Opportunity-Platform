import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_DATA_HYPOTHESES,
  decodeInsightDiscoveryCursor,
  runCurrentDataInsightDiscovery,
} from "../lib/insight-discovery/index.ts";

const fixed = { runId: "discovery:test", now: () => "2026-08-19T12:00:00.000Z" };

test("autonomous discovery runs every reviewed hypothesis and returns a five-item digest plus every additional qualified finding", () => {
  const run = runCurrentDataInsightDiscovery(fixed);
  assert.equal(run.status, "completed");
  assert.equal(run.generationMethod, "reviewed_hypothesis_registry");
  assert.equal(run.analysesRun, CURRENT_DATA_HYPOTHESES.length + 3);
  assert.equal(run.traces.length, CURRENT_DATA_HYPOTHESES.length + 3);
  assert.equal(run.marketUniverse, 383);
  assert.ok(run.measuresExamined >= 15);
  assert.ok(run.sourceIds.includes("SRC-018"));
  assert.ok(run.sourceIds.includes("SRC-025"));
  assert.ok(run.sourceIds.includes("SRC-009"));
  assert.equal(run.primaryFindings.length, 5);
  assert.ok(run.additionalFindings.length > 0);
  assert.equal(run.findings.length, run.findingSelection.counts.global.qualified);
  assert.equal(run.findings.length, run.primaryFindings.length + run.additionalFindings.length);
  assert.deepEqual(new Set(run.primaryFindings.map((finding) => finding.department)), new Set(["marketing", "pricing", "cvc"]));
  assert.ok(run.primaryFindings.every((finding) => finding.opportunity?.recommendation.type !== "data_quality"));
  assert.ok(run.additionalFindings.some((finding) => finding.department === "pricing" && finding.opportunity?.recommendation.type === "data_quality"));
  assert.ok(["marketing", "pricing", "cvc"].every((department) => run.primaryFindings.some((finding) => finding.department === department)));
  assert.ok(["marketing", "pricing", "cvc"].every((department) => run.primaryFindings.filter((finding) => finding.department === department).length <= 3));
  assert.ok(run.findingSelection.counts.global.investigated >= 30);
  assert.equal(run.dataAccessSummary.status, "additional_access_recommended");
  assert.ok(run.dataAccessSummary.uniqueTemplateCount >= 3);
  assert.ok(run.snowflakeEscalations.some((assessment) => assessment.status === "snowflake_escalation_required"));
  assert.ok(run.snowflakeEscalations.every((assessment) => assessment.accessRequest?.executionPolicy.credentialsRequested === false));
});

test("the discovery run challenges regional hypotheses and assigns explicit recommendation types", () => {
  const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T00:00:00.000Z", runId: "opportunity-loop" });
  assert.deepEqual(run.opportunityRun.iterations.map((item) => item.stage), ["generate_hypotheses", "challenge_with_evidence", "classify_recommendations"]);
  assert.ok(run.opportunityRun.opportunities.length > 0);
  assert.ok(run.findings.every((finding) => finding.opportunity));
  assert.ok(run.opportunityRun.opportunities.every((opportunity) => ["act_now", "controlled_test", "investigate", "monitor", "data_quality"].includes(opportunity.recommendation.type)));
});

test("repeated market appearances become higher-priority multi-signal leads without a blended opportunity score", () => {
  const run = runCurrentDataInsightDiscovery(fixed);
  const marketing = run.findings.filter((finding) => finding.department === "marketing");
  assert.ok(marketing.some((finding) => finding.signalCount >= 2 && finding.priority === "multi-signal lead"));
  assert.ok(marketing.every((finding) => finding.sourceIds.length && finding.snapshotVersions.length));
  assert.ok(run.findings.every((finding) => finding.nextValidation && finding.evidenceDetail));
  assert.ok(run.findings.every((finding) => finding.applicability.primaryTeamLabel && finding.applicability.approvalBoundary));
  assert.ok(run.findings.every((finding) => finding.analystInterpretation?.actionabilityLevel === "investigation_ready"));
  assert.ok(run.findings.every((finding) => finding.analystInterpretation?.exactMissingEvidence.length));
  assert.ok(run.findings.every((finding) => finding.applicability.partnerTeams.some((team) => team.teamId === "measurement_analytics")));
  assert.equal(new Set(run.findings.map((finding) => finding.insightId)).size, run.findings.length);
  assert.doesNotMatch(JSON.stringify(run), /opportunityScore|universalScore|synthetic_prototype/);
});

test("the first digest favors stakeholder decisions over raw market scale", () => {
  const run = runCurrentDataInsightDiscovery(fixed);
  assert.equal(run.primaryFindings[0]?.marketName, "McAllen-Edinburg-Mission, TX");
  assert.ok(run.primaryFindings[0]?.decisionValue.flags.includes("cross_measure_contradiction"));
  assert.ok(run.primaryFindings.some((finding) => finding.marketName === "Phoenix-Mesa-Chandler, AZ" && finding.applicability.primaryTeamId === "clinic_operations"));
  assert.ok(run.primaryFindings.every((finding) => !finding.decisionValue.flags.includes("coverage_risk")));
  assert.ok(run.additionalFindings.some((finding) => finding.department === "pricing" && finding.decisionValue.flags.includes("coverage_risk")));
});

test("autonomous findings translate statistical signals into quantified value or decision-risk language", () => {
  const run = runCurrentDataInsightDiscovery(fixed);
  const mcAllen = run.findings.find((finding) => finding.marketName === "McAllen-Edinburg-Mission, TX" && finding.department === "marketing");
  assert.match(mcAllen?.headline ?? "", /Test whether.*1\.8×.*attributed spend efficiency can scale/i);
  assert.equal(mcAllen?.valueTranslation.kind, "modeled_scenario");
  assert.match(mcAllen?.valueTranslation.statement ?? "", /\$1,000.*259 attributed conversions.*1\.8×.*median/i);
  assert.match(mcAllen?.valueTranslation.caveat ?? "", /not marginal lift.*forecast/i);
  assert.match(mcAllen?.analystInterpretation?.recommendedNextDecisionOrAction ?? "", /pre-register a bounded geo test/i);
  assert.equal(mcAllen?.businessValue.status, "proxy_only");
  assert.match(mcAllen?.businessValue.headline ?? "", /cannot yet estimate incremental CCP or sales lift/i);
  assert.match(mcAllen?.businessValue.formula ?? "", /incremental CCP efficiency/i);
  assert.equal(mcAllen?.importance.tier, "validate_next");
  assert.equal(mcAllen?.importance.score, 69);
  assert.equal(mcAllen?.importance.notificationCandidate, false);
  assert.deepEqual([...new Set(mcAllen?.opportunity?.evidence.corroborating.map((item) => item.sourceFamily))], ["marketing_delivery"]);
  assert.ok(mcAllen?.opportunity?.evidence.context.some((item) => item.sourceFamily === "market_context"));
  assert.ok(mcAllen?.opportunity?.evidence.corroborating.some((item) => /not across independent sources/i.test(item.statement)));

  const eaglePass = run.findings.find((finding) => finding.marketName === "Eagle Pass, TX" && finding.department === "pricing");
  assert.match(eaglePass?.headline ?? "", /monitoring is too thin.*local price decision/i);
  assert.equal(eaglePass?.valueTranslation.kind, "decision_boundary");
  assert.match(eaglePass?.valueTranslation.statement ?? "", /221 monitored offer rows.*93% below.*183 observed SKUs.*94% below/i);
  assert.match(eaglePass?.analystInterpretation?.recommendedNextDecisionOrAction ?? "", /Repair.*mapped ZIP.*SKU.*coverage/i);
  assert.equal(eaglePass?.importance.tier, "validate_next");
  assert.equal(eaglePass?.importance.notificationCandidate, false);

  const phoenix = run.findings.find((finding) => finding.marketName === "Phoenix-Mesa-Chandler, AZ" && finding.department === "cvc");
  assert.match(phoenix?.headline ?? "", /Prioritize.*appointment and capacity validation/i);
  assert.match(phoenix?.valueTranslation.statement ?? "", /2\.9 times the median/i);
  assert.equal(phoenix?.businessValue.status, "export_available");
  assert.ok(phoenix?.opportunity?.evidence.corroborating.some((item) => item.metricId === "derived_households_per_published_clinic"));
  assert.match(phoenix?.businessValue.headline ?? "", /appointments.*completed visits.*net sales/i);
  assert.equal(phoenix?.importance.tier, "validate_next");
  assert.ok(run.findings.every((finding, index, findings) => index === 0 || findings[index - 1]!.importance.score >= finding.importance.score));
});

test("the same approved snapshots produce a deterministic discovery result", () => {
  const first = runCurrentDataInsightDiscovery(fixed);
  const second = runCurrentDataInsightDiscovery(fixed);
  assert.deepEqual(second, first);
});

test("a rerun executes every hypothesis and surfaces the next qualified same-snapshot digest", () => {
  const first = runCurrentDataInsightDiscovery(fixed);
  const cursor = decodeInsightDiscoveryCursor(first.explorationCursor);
  const second = runCurrentDataInsightDiscovery({
    runId: "discovery:test:rerun",
    now: () => "2026-08-19T12:05:00.000Z",
    previousRunId: first.runId,
    previousPrimaryFindingIds: first.primaryFindings.map((finding) => finding.insightId),
    previousSnapshotFingerprint: cursor.snapshotFingerprint,
    previousRunSequence: cursor.runSequence,
    previouslyExcludedPrimaryFindingIds: cursor.excludedPrimaryFindingIds,
  });

  assert.notEqual(second.runId, first.runId);
  assert.equal(second.runSequence, 2);
  assert.equal(second.analysesRun, CURRENT_DATA_HYPOTHESES.length + 3);
  assert.equal(second.traces.length, CURRENT_DATA_HYPOTHESES.length + 3);
  assert.equal(second.runAudit.reranHypothesisCount, CURRENT_DATA_HYPOTHESES.length + 3);
  assert.equal(second.runAudit.mode, "same_snapshot_reprioritization");
  assert.equal(second.runAudit.snapshotFingerprint, first.runAudit.snapshotFingerprint);
  assert.deepEqual(second.runAudit.repeatedPrimaryFindingIds, []);
  assert.ok(second.primaryFindings.every((finding) => !first.findingSelection.primaryFindingIds.includes(finding.insightId)));
  assert.ok(second.primaryFindings.every((finding) => finding.sourceIds.length && finding.snapshotVersions.length));
  assert.match(second.limitations.join(" "), /same approved snapshot set.*did not refresh/i);
});
