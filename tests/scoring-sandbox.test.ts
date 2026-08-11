import assert from "node:assert/strict";
import test from "node:test";
import {
  SandboxValidationError,
  analyzeSandbox,
  createInitialSandboxDraft,
  fingerprintSandboxDraft,
  resetSandboxDraft,
  validateSandboxDraft,
} from "../lib/scoring-sandbox/index.ts";

test("rejects preference weights that do not total 100 percent", () => {
  const draft = createInitialSandboxDraft();
  draft.weights.demand = 30;

  assert.deepEqual(
    validateSandboxDraft(draft)
      .filter(({ code }) => code === "invalid-weight-total")
      .map(({ message }) => message),
    ["Preference weights total 95%. They must total 100%."],
  );
  assert.throws(
    () => analyzeSandbox(draft),
    (error: unknown) =>
      error instanceof SandboxValidationError &&
      error.issues.some(({ code }) => code === "invalid-weight-total"),
  );
});

test("rejects negative weights without calculating results", () => {
  const draft = createInitialSandboxDraft();
  draft.weights.foot = -5;
  draft.weights.demand = 50;

  const issues = validateSandboxDraft(draft);
  assert.equal(
    issues.some(
      ({ code, fieldId }) => code === "invalid-weight" && fieldId === "foot",
    ),
    true,
  );
  assert.throws(() => analyzeSandbox(draft), SandboxValidationError);
});

test("one-click reset restores an independent baseline draft", () => {
  const changed = createInitialSandboxDraft();
  changed.weights.demand = 40;
  changed.weights.competition = 15;
  changed.thresholds.staffing_feasibility = 80;

  const reset = resetSandboxDraft();
  assert.deepEqual(reset, createInitialSandboxDraft());
  assert.notEqual(reset, changed);
  assert.notEqual(reset.weights, changed.weights);
  assert.notEqual(reset.thresholds, changed.thresholds);

  reset.weights.demand = 20;
  assert.equal(createInitialSandboxDraft().weights.demand, 35);
});

test("fingerprints and sensitivity analysis are reproducible", () => {
  const draft = createInitialSandboxDraft();
  draft.weights.demand = 40;
  draft.weights.competition = 15;

  const first = analyzeSandbox(draft);
  const second = analyzeSandbox(draft);

  assert.equal(fingerprintSandboxDraft(draft), first.configurationFingerprint);
  assert.equal(first.configurationVersion, `synthetic-unapproved-${first.configurationFingerprint}`);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.configurationLabel, "Synthetic and unapproved");
});

test("existing clinic fixture remains identical behind typed operators", () => {
  const analysis = analyzeSandbox(createInitialSandboxDraft());

  assert.deepEqual(
    analysis.comparisons.map(({ siteId, adjustedResult }) => ({
      siteId,
      systemScore: adjustedResult.systemScore,
      constraintOutcome: adjustedResult.constraintOutcome,
      eligibleForConsideration: adjustedResult.eligibleForConsideration,
      contributions: adjustedResult.metricContributions.map(
        ({ metricId, contribution }) => [metricId, contribution],
      ),
    })),
    [
      {
        siteId: "nashville",
        systemScore: 82.5,
        constraintOutcome: "passed",
        eligibleForConsideration: true,
        contributions: [
          ["demand", 31.5],
          ["competition", 14],
          ["population", 12],
          ["drive", 17],
          ["foot", 8],
        ],
      },
      {
        siteId: "raleigh",
        systemScore: 71.611111111111,
        constraintOutcome: "passed",
        eligibleForConsideration: true,
        contributions: [
          ["demand", 31.5],
          ["competition", 10.222222222222],
          ["population", 13],
          ["drive", 16.888888888889],
          ["foot", null],
        ],
      },
      {
        siteId: "sacramento",
        systemScore: 70.4,
        constraintOutcome: "failed",
        eligibleForConsideration: false,
        contributions: [
          ["demand", 31.15],
          ["competition", 6.2],
          ["population", 12.45],
          ["drive", 12.8],
          ["foot", 7.8],
        ],
      },
      {
        siteId: "tampa",
        systemScore: 73.9,
        constraintOutcome: "passed",
        eligibleForConsideration: true,
        contributions: [
          ["demand", 29.4],
          ["competition", 9.8],
          ["population", 10.8],
          ["drive", 17],
          ["foot", 6.9],
        ],
      },
    ],
  );
});

test("hard constraints remain separate from preference scoring", () => {
  const baseline = analyzeSandbox(createInitialSandboxDraft());
  const adjustedDraft = createInitialSandboxDraft();
  adjustedDraft.thresholds.staffing_feasibility = 75;
  const adjusted = analyzeSandbox(adjustedDraft);

  const baselineRaleigh = baseline.comparisons.find(
    ({ siteId }) => siteId === "raleigh",
  );
  const adjustedRaleigh = adjusted.comparisons.find(
    ({ siteId }) => siteId === "raleigh",
  );

  assert.equal(baselineRaleigh?.adjustedResult.constraintOutcome, "passed");
  assert.equal(adjustedRaleigh?.adjustedResult.constraintOutcome, "failed");
  assert.equal(
    baselineRaleigh?.adjustedResult.systemScore,
    adjustedRaleigh?.adjustedResult.systemScore,
  );
  assert.equal(
    adjustedRaleigh?.adjustedResult.metricContributions.some(
      ({ metricId }) => metricId === "staffing_feasibility",
    ),
    false,
  );
});

test("calculates contribution, rank, and bounded sensitivity changes", () => {
  const draft = createInitialSandboxDraft();
  draft.weights.demand = 40;
  draft.weights.competition = 15;
  const analysis = analyzeSandbox(draft);

  assert.equal(analysis.weightTotal, 100);
  assert.equal(analysis.sensitivityScenarioCount > 0, true);

  const nashville = analysis.comparisons.find(
    ({ siteId }) => siteId === "nashville",
  );
  const demand = nashville?.contributionChanges.find(
    ({ metricId }) => metricId === "demand",
  );
  const competition = nashville?.contributionChanges.find(
    ({ metricId }) => metricId === "competition",
  );

  assert.equal(nashville?.originalResult.systemScore, 82.5);
  assert.equal(nashville?.adjustedResult.systemScore, 83.5);
  assert.deepEqual(
    {
      demandOriginal: demand?.original,
      demandAdjusted: demand?.adjusted,
      demandDelta: demand?.delta,
      competitionOriginal: competition?.original,
      competitionAdjusted: competition?.adjusted,
      competitionDelta: competition?.delta,
    },
    {
      demandOriginal: 31.5,
      demandAdjusted: 36,
      demandDelta: 4.5,
      competitionOriginal: 14,
      competitionAdjusted: 10.5,
      competitionDelta: -3.5,
    },
  );
  assert.equal(
    analysis.comparisons.some(({ rankingSensitive }) => rankingSensitive),
    true,
  );
});

