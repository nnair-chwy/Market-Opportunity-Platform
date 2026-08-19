import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_DATA_HYPOTHESES,
  runCurrentDataInsightDiscovery,
} from "../lib/insight-discovery/current-data-discovery.ts";

const fixed = { runId: "discovery:test", now: () => "2026-08-19T12:00:00.000Z" };

test("autonomous discovery runs every reviewed hypothesis and returns a five-item digest plus every additional qualified finding", () => {
  const run = runCurrentDataInsightDiscovery(fixed);
  assert.equal(run.status, "completed");
  assert.equal(run.generationMethod, "reviewed_hypothesis_registry");
  assert.equal(run.analysesRun, 9);
  assert.equal(run.traces.length, CURRENT_DATA_HYPOTHESES.length);
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
  assert.equal(run.findingSelection.counts.global.investigated, 30);
  assert.equal(run.dataAccessSummary.status, "additional_access_recommended");
  assert.ok(run.dataAccessSummary.uniqueTemplateCount >= 3);
  assert.ok(run.snowflakeEscalations.some((assessment) => assessment.status === "snowflake_escalation_required"));
  assert.ok(run.snowflakeEscalations.every((assessment) => assessment.accessRequest?.executionPolicy.credentialsRequested === false));
});

test("repeated market appearances become higher-priority multi-signal leads without a blended opportunity score", () => {
  const run = runCurrentDataInsightDiscovery(fixed);
  const marketing = run.findings.filter((finding) => finding.department === "marketing");
  assert.ok(marketing.some((finding) => finding.signalCount >= 3 && finding.priority === "multi-signal lead"));
  assert.ok(marketing.every((finding) => finding.sourceIds.length && finding.snapshotVersions.length));
  assert.ok(run.findings.every((finding) => finding.nextValidation && finding.evidenceDetail));
  assert.ok(run.findings.every((finding) => finding.applicability.primaryTeamLabel && finding.applicability.approvalBoundary));
  assert.ok(run.findings.every((finding) => finding.applicability.partnerTeams.some((team) => team.teamId === "measurement_analytics")));
  assert.equal(new Set(run.findings.map((finding) => finding.insightId)).size, run.findings.length);
  assert.doesNotMatch(JSON.stringify(run), /opportunityScore|universalScore|synthetic_prototype/);
});

test("the same approved snapshots produce a deterministic discovery result", () => {
  const first = runCurrentDataInsightDiscovery(fixed);
  const second = runCurrentDataInsightDiscovery(fixed);
  assert.deepEqual(second, first);
});
