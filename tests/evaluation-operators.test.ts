import assert from "node:assert/strict";
import test from "node:test";
import {
  DETERMINISTIC_OPERATOR_VERSION,
  calculate_weighted_result,
  compare_cohort,
  filter_eligible_entities,
  join_geography,
  normalize_metric,
  render_artifact,
  run_sensitivity,
} from "../lib/evaluation-operators.ts";

const provenance = {
  sourceIds: ["SYN-OPERATOR-TEST"],
  inputVersion: "fixture-v1",
  transformationVersion: "test-v1",
};

test("operators reject unvalidated natural-language-shaped instructions", () => {
  assert.throws(
    () => normalize_metric("make this metric look good" as never),
    /expected object/i,
  );
  assert.throws(
    () =>
      calculate_weighted_result({
        instruction: "rank the best clinic",
      } as never),
    /operatorVersion|expected/i,
  );
});

test("normalize_metric validates and applies the versioned direction", () => {
  const result = normalize_metric({
    operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
    decisionLayer: "property_feasibility",
    metricId: "competition",
    rawValue: 5,
    direction: "lower_is_better",
    validRange: { min: 0, max: 20 },
    normalization: {
      function: "linear",
      version: "linear-v1",
      inputMin: 0,
      inputMax: 20,
      clamp: true,
    },
    provenance,
  });

  assert.equal(result.normalizedValue, 75);
  assert.equal(result.normalizationVersion, "linear-v1");
});

test("join_geography uses exact keys and visibly retains unmatched entities", () => {
  const result = join_geography({
    operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
    decisionLayer: "market_attractiveness",
    joinVersion: "exact-cbsa-v1",
    unmatchedPolicy: "retain",
    entities: [
      {
        entityId: "market-a",
        joinKey: "12345",
        payload: { label: "A" },
        provenance,
      },
      {
        entityId: "market-b",
        joinKey: null,
        payload: { label: "B" },
        provenance,
      },
    ],
    geographies: [{
      geographyId: "cbsa:12345",
      joinKey: "12345",
      payload: { vintage: "2024" },
      provenance,
    }],
  });

  assert.deepEqual(
    result.map(({ entityId, joinStatus, geographyId }) => ({
      entityId,
      joinStatus,
      geographyId,
    })),
    [
      {
        entityId: "market-a",
        joinStatus: "matched",
        geographyId: "cbsa:12345",
      },
      {
        entityId: "market-b",
        joinStatus: "unmatched",
        geographyId: null,
      },
    ],
  );
});

test("filter_eligible_entities keeps hard screens separate from weighted results", () => {
  const result = filter_eligible_entities({
    operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
    decisionLayer: "property_feasibility",
    policyVersion: "clinic-constraints-v1",
    entities: [
      {
        entityId: "passed",
        criteria: [{
          criterionId: "staffing",
          state: "passed",
          required: true,
          provenance,
        }],
      },
      {
        entityId: "unknown",
        criteria: [{
          criterionId: "staffing",
          state: "missing",
          required: true,
          provenance,
        }],
      },
    ],
  });

  assert.deepEqual(
    result.map(({ entityId, eligibility }) => ({ entityId, eligibility })),
    [
      { entityId: "passed", eligibility: "eligible" },
      { entityId: "unknown", eligibility: "unknown" },
    ],
  );
});

test("compare_cohort rejects mixed cohorts and deterministically ranks ties", () => {
  const ranked = compare_cohort({
    operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
    decisionLayer: "submarket_opportunity",
    comparisonVersion: "comparison-v1",
    cohortId: "seattle-demo",
    direction: "higher_is_better",
    entities: [
      { entityId: "b", cohortId: "seattle-demo", value: 80, provenance },
      { entityId: "a", cohortId: "seattle-demo", value: 80, provenance },
      { entityId: "c", cohortId: "seattle-demo", value: 70, provenance },
    ],
  });
  assert.deepEqual(
    ranked.map(({ entityId, rank }) => ({ entityId, rank })),
    [
      { entityId: "a", rank: 1 },
      { entityId: "b", rank: 2 },
      { entityId: "c", rank: 3 },
    ],
  );
});

test("weighted and sensitivity operators preserve missing-data rules and versions", () => {
  const baseline = {
    operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
    decisionLayer: "property_feasibility" as const,
    formulaVersion: "clinic-formula-v1",
    expectedWeightTotal: 100,
    metrics: [
      {
        metricId: "demand",
        normalizedValue: 80,
        weight: 60,
        included: true,
        state: "available" as const,
        missingDataRule: "fail_evaluation" as const,
        provenance,
      },
      {
        metricId: "competition",
        normalizedValue: 50,
        weight: 40,
        included: true,
        state: "available" as const,
        missingDataRule: "exclude_and_renormalize" as const,
        provenance,
      },
    ],
  };
  const weighted = calculate_weighted_result(baseline);
  assert.equal(weighted.value, 68);

  const sensitivity = run_sensitivity({
    operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
    decisionLayer: "property_feasibility",
    sensitivityVersion: "clinic-sensitivity-v1",
    baseline,
    scenarios: [{
      scenarioId: "demand-emphasis",
      scenarioVersion: "clinic-formula-v1-demand-emphasis",
      weightOverrides: { demand: 70, competition: 30 },
    }],
  });
  assert.equal(sensitivity[0]?.result.value, 71);
  assert.equal(sensitivity[0]?.deltaFromBaseline, 3);

  const missingRequired = calculate_weighted_result({
    ...baseline,
    metrics: baseline.metrics.map((metric) =>
      metric.metricId === "demand"
        ? { ...metric, normalizedValue: null, state: "missing" as const }
        : metric,
    ),
  });
  assert.equal(missingRequired.status, "not_calculated");
  assert.equal(missingRequired.value, null);
});

test("render_artifact accepts only a typed renderer and structured payload", () => {
  const artifact = render_artifact({
    operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
    decisionLayer: "execution_priority",
    artifactId: "clinic-review-packet",
    artifactVersion: "packet-v1",
    renderer: "action_packet",
    allowedUse: "synthetic_prototype_only",
    sensitivity: "internal",
    payload: {
      status: "draft_for_review",
      qualitativeEvidenceScored: false,
    },
    provenance,
  });

  assert.equal(artifact.renderer, "action_packet");
  assert.equal(artifact.decisionLayer, "execution_priority");
});
