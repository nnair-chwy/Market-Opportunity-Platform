import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_DATA_HYPOTHESES,
  runCurrentDataInsightDiscovery,
} from "../lib/insight-discovery/current-data-discovery.ts";

const fixed = { runId: "discovery:test", now: () => "2026-08-19T12:00:00.000Z" };

test("autonomous discovery runs every reviewed department hypothesis and returns five findings per department", () => {
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
  for (const department of ["marketing", "pricing", "cvc"] as const) {
    assert.equal(run.findings.filter((finding) => finding.department === department).length, 5);
  }
});

test("repeated market appearances become higher-priority multi-signal leads without a blended opportunity score", () => {
  const run = runCurrentDataInsightDiscovery(fixed);
  const marketing = run.findings.filter((finding) => finding.department === "marketing");
  assert.ok(marketing.some((finding) => finding.signalCount >= 3 && finding.priority === "multi-signal lead"));
  assert.ok(marketing.every((finding) => finding.sourceIds.length && finding.snapshotVersions.length));
  assert.ok(run.findings.every((finding) => finding.nextValidation && finding.evidenceDetail));
  assert.equal(new Set(run.findings.map((finding) => finding.insightId)).size, run.findings.length);
  assert.doesNotMatch(JSON.stringify(run), /opportunityScore|universalScore|synthetic_prototype/);
});

test("the same approved snapshots produce a deterministic discovery result", () => {
  const first = runCurrentDataInsightDiscovery(fixed);
  const second = runCurrentDataInsightDiscovery(fixed);
  assert.deepEqual(second, first);
});
