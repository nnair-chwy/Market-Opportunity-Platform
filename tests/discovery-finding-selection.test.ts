import assert from "node:assert/strict";
import test from "node:test";
import type { AutonomousInsight } from "../lib/insight-discovery/current-data-discovery.ts";
import {
  evaluateDiscoveryFindingQuality,
  selectDiscoveryFindings,
} from "../lib/insight-discovery/finding-selection.ts";

function finding(overrides: Partial<AutonomousInsight> & Pick<AutonomousInsight, "insightId" | "department" | "marketName">): AutonomousInsight {
  return {
    insightId: overrides.insightId,
    department: overrides.department,
    marketIds: overrides.marketIds ?? [overrides.insightId.replace(/\D/g, "").padEnd(5, "0").slice(0, 5)],
    marketName: overrides.marketName,
    headline: overrides.headline ?? `${overrides.marketName} produced a material regional contrast`,
    whyInteresting: overrides.whyInteresting ?? "The repeated regional pattern is strong enough to justify a bounded follow-up investigation.",
    evidenceDetail: overrides.evidenceDetail ?? "The observed measure is in an extreme percentile relative to comparable measured regions.",
    nextValidation: overrides.nextValidation ?? "Validate the signal against a comparable outcome cohort and an explicit counterfactual.",
    sourceIds: overrides.sourceIds ?? ["SRC-A", "SRC-B"],
    snapshotVersions: overrides.snapshotVersions ?? ["snapshot-v1"],
    hypothesisIds: overrides.hypothesisIds ?? ["hypothesis-a"],
    signalCount: overrides.signalCount ?? 1,
    priority: overrides.priority ?? "single-signal lead",
    question: overrides.question ?? "Where is this regional pattern strongest?",
    applicability: overrides.applicability ?? {
      primaryTeamId: "growth_marketing",
      primaryTeamLabel: "Growth Marketing / Customer Growth",
      reason: "The receiving team can evaluate this regional signal.",
      partnerTeams: [{ teamId: "measurement_analytics", label: "Measurement / Analytics", reason: "Validate evidence quality." }],
      approvalBoundary: "The finding may inform review but cannot authorize a material action.",
    },
    decisionValue: overrides.decisionValue ?? { score: 50, reason: "Default review value for this fixture.", flags: [] },
    valueTranslation: overrides.valueTranslation ?? {
      kind: "observed_value",
      label: "Observed regional signal",
      statement: "The reviewed metric differs from its comparison cohort.",
      caveat: "This is descriptive, not causal.",
    },
    importance: overrides.importance ?? {
      score: overrides.decisionValue?.score ?? 50,
      tier: "watch",
      label: "Watch",
      reason: "The test fixture does not yet justify immediate focus.",
      notificationCandidate: false,
    },
  };
}

test("the digest contains at most five qualified findings and retains all additional findings", () => {
  const findings = Array.from({ length: 8 }, (_, index) => finding({
    insightId: `finding-${index + 1}`,
    department: index % 3 === 0 ? "marketing" : index % 3 === 1 ? "pricing" : "cvc",
    marketName: `Market ${index + 1}`,
    signalCount: 8 - index,
    hypothesisIds: Array.from({ length: 8 - index }, (__, hypothesisIndex) => `h-${index}-${hypothesisIndex}`),
  }));

  const selection = selectDiscoveryFindings(findings);
  assert.equal(selection.primaryDigest.length, 5);
  assert.equal(selection.additionalFindings.length, 3);
  assert.deepEqual(selection.primaryDigest.map((item) => item.insightId), ["finding-1", "finding-2", "finding-3", "finding-4", "finding-5"]);
  assert.equal(selection.counts.global.qualified, 8);
  assert.equal(selection.counts.global.primary, 5);
  assert.equal(selection.counts.global.additional, 3);
});

test("the digest is not padded when fewer than five findings qualify", () => {
  const selection = selectDiscoveryFindings([
    finding({ insightId: "one", department: "marketing", marketName: "One" }),
    finding({ insightId: "two", department: "pricing", marketName: "Two" }),
  ]);
  assert.equal(selection.primaryDigest.length, 2);
  assert.equal(selection.additionalFindings.length, 0);
  assert.equal(selection.counts.global.investigated, 2);
});

test("decision relevance outranks repeated correlated screens", () => {
  const selection = selectDiscoveryFindings([
    finding({ insightId: "raw-scale", department: "marketing", marketName: "Raw scale", signalCount: 4, hypothesisIds: ["m1", "m2", "m3", "m4"], decisionValue: { score: 25, reason: "Scale only.", flags: ["scale_only"] } }),
    finding({ insightId: "outcome-conflict", department: "marketing", marketName: "Outcome conflict", decisionValue: { score: 90, reason: "Contradictory funnel evidence.", flags: ["cross_measure_contradiction"] } }),
  ]);
  assert.equal(selection.primaryDigest[0]?.insightId, "outcome-conflict");
});

test("the overall digest represents each investigated department before filling remaining slots", () => {
  const selection = selectDiscoveryFindings([
    finding({ insightId: "marketing-strong", department: "marketing", marketName: "Marketing strong", marketIds: ["11111"], signalCount: 3, hypothesisIds: ["m1", "m2", "m3"] }),
    finding({ insightId: "marketing-next", department: "marketing", marketName: "Marketing next", marketIds: ["22222"], signalCount: 2, hypothesisIds: ["m1", "m2"] }),
    finding({ insightId: "pricing", department: "pricing", marketName: "Pricing" }),
    finding({ insightId: "cvc", department: "cvc", marketName: "CVC" }),
  ]);

  assert.deepEqual(selection.primaryDigest.slice(0, 3).map((item) => item.department), ["marketing", "pricing", "cvc"]);
  assert.equal(selection.primaryDigest.length, 4);
});

test("weak and untraceable findings are suppressed with explicit reasons", () => {
  const weak = finding({
    insightId: "weak",
    department: "marketing",
    marketName: "Weak Market",
    sourceIds: ["SRC-A"],
    marketIds: ["12345"],
    headline: "Weak",
    evidenceDetail: "Thin",
    nextValidation: "None",
  });
  const quality = evaluateDiscoveryFindingQuality(weak);
  assert.equal(quality.qualified, false);
  assert.deepEqual(quality.reasons, ["missing_explanation", "missing_validation_step", "weak_uncorroborated_signal"]);

  const selection = selectDiscoveryFindings([weak]);
  assert.equal(selection.primaryDigest.length, 0);
  assert.deepEqual(selection.suppressedFindings[0]?.reasons, quality.reasons);
  assert.equal(selection.counts.global.suppressed, 1);
});

test("duplicates keep the stronger deterministic candidate and are counted by department", () => {
  const weaker = finding({
    insightId: "duplicate-weaker",
    department: "cvc",
    marketName: "Austin comparison",
    marketIds: ["12420", "40900"],
  });
  const stronger = finding({
    insightId: "duplicate-stronger",
    department: "cvc",
    marketName: "Austin comparison",
    marketIds: ["40900", "12420"],
    signalCount: 2,
    hypothesisIds: ["h-1", "h-2"],
  });
  const selection = selectDiscoveryFindings([weaker, stronger]);

  assert.deepEqual(selection.primaryDigest.map((item) => item.insightId), ["duplicate-stronger"]);
  assert.deepEqual(selection.suppressedFindings.map((item) => item.reasons), [["duplicate_finding"]]);
  assert.deepEqual(selection.counts.byDepartment.cvc, {
    investigated: 2,
    qualified: 1,
    primary: 1,
    additional: 0,
    suppressed: 1,
  });
  assert.deepEqual(selection.counts.global, selection.counts.byDepartment.cvc);
});

test("ties resolve deterministically independent of input order", () => {
  const alpha = finding({ insightId: "alpha", department: "pricing", marketName: "Alpha" });
  const beta = finding({ insightId: "beta", department: "marketing", marketName: "Beta" });
  const first = selectDiscoveryFindings([alpha, beta]);
  const second = selectDiscoveryFindings([beta, alpha]);
  assert.deepEqual(first.primaryDigest.map((item) => item.insightId), ["beta", "alpha"]);
  assert.deepEqual(second.primaryDigest.map((item) => item.insightId), ["beta", "alpha"]);
});

test("rerun exclusions move prior digest findings to additional results and promote the next strongest", () => {
  const findings = Array.from({ length: 7 }, (_, index) => finding({
    insightId: `rerun-${index + 1}`,
    department: index % 3 === 0 ? "marketing" : index % 3 === 1 ? "pricing" : "cvc",
    marketName: `Rerun Market ${index + 1}`,
    signalCount: 7 - index,
    hypothesisIds: Array.from({ length: 7 - index }, (__, hypothesisIndex) => `rh-${index}-${hypothesisIndex}`),
  }));
  const first = selectDiscoveryFindings(findings);
  const rerun = selectDiscoveryFindings(findings, { excludedPrimaryFindingIds: first.primaryDigest.map((item) => item.insightId) });
  assert.deepEqual(rerun.primaryDigest.map((item) => item.insightId), ["rerun-7", "rerun-6"]);
  assert.ok(first.primaryDigest.every((item) => rerun.additionalFindings.some((candidate) => candidate.insightId === item.insightId)));
});
