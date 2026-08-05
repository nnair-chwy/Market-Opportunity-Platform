import assert from "node:assert/strict";
import test from "node:test";
import {
  CALCULATION_VERSION,
  CONFIGURATION_SCHEMA_VERSION,
  calculateScore,
  evaluateSite,
  normalizeMetric,
  ScoringValidationError,
  type EvaluationInput,
  type MetricDefinition,
  type ScoringConfiguration,
  type SensitivityScenario,
} from "../lib/scoring.ts";

const demandDefinition: MetricDefinition = {
  metricId: "synthetic_demand",
  name: "Synthetic demand index",
  description: "Synthetic demonstration input only.",
  unit: "index",
  direction: "higher-is-better",
  validRange: { min: 0, max: 100 },
  normalization: {
    function: "linear",
    version: "linear-v1",
    inputMin: 0,
    inputMax: 100,
    clamp: false,
  },
  missingDataPolicy: "fail-evaluation",
  owner: "Synthetic fixture owner",
  sourceIds: ["SYNTHETIC-SRC-001"],
};

const competitionDefinition: MetricDefinition = {
  metricId: "synthetic_competition",
  name: "Synthetic competitor count",
  description: "Synthetic demonstration input only.",
  unit: "count",
  direction: "lower-is-better",
  validRange: { min: 0, max: 20 },
  normalization: {
    function: "linear",
    version: "linear-v1",
    inputMin: 0,
    inputMax: 20,
    clamp: true,
  },
  missingDataPolicy: "exclude-and-renormalize",
  owner: "Synthetic fixture owner",
  sourceIds: ["SYNTHETIC-SRC-002"],
};

const footTrafficDefinition: MetricDefinition = {
  metricId: "synthetic_foot_traffic",
  name: "Synthetic foot-traffic proxy",
  description: "Synthetic demonstration input only.",
  unit: "index",
  direction: "higher-is-better",
  validRange: { min: 0, max: 100 },
  normalization: {
    function: "linear",
    version: "linear-v1",
    inputMin: 0,
    inputMax: 100,
    clamp: false,
  },
  missingDataPolicy: "exclude-and-renormalize",
  owner: "Synthetic fixture owner",
  sourceIds: ["SYNTHETIC-SRC-003"],
};

function syntheticConfiguration(): ScoringConfiguration {
  return {
    configurationSchemaVersion: CONFIGURATION_SCHEMA_VERSION,
    scoringVersion: "synthetic-scoring-v1",
    calculationVersion: CALCULATION_VERSION,
    status: "synthetic",
    label: "Synthetic scoring test configuration",
    metricDefinitions: [
      demandDefinition,
      competitionDefinition,
      footTrafficDefinition,
    ],
    metricWeights: [
      { metricId: "synthetic_demand", included: true, weight: 50 },
      { metricId: "synthetic_competition", included: true, weight: 30 },
      { metricId: "synthetic_foot_traffic", included: true, weight: 20 },
    ],
    constraints: [
      {
        constraintId: "synthetic_staffing_feasible",
        name: "Synthetic staffing feasibility",
        description: "Synthetic hard constraint, not a weighted preference.",
        unit: "flag",
        operator: "eq",
        threshold: 1,
        missingPolicy: "fail",
        owner: "Synthetic fixture owner",
        sourceIds: ["SYNTHETIC-SRC-004"],
      },
    ],
    expectedWeightTotal: 100,
    notes:
      "Synthetic configuration. Thresholds and weights are not approved for production.",
  };
}

function observation(
  metricId: string,
  rawValue: number | null,
  unit: string,
  qualityStatus: "accepted" | "warning" | "rejected" = "accepted",
) {
  return {
    metricId,
    rawValue,
    unit,
    sourceReference: {
      sourceId: `SYNTHETIC-${metricId}`,
      observationId: `${metricId}-observation`,
    },
    observedAt: "2026-07-01",
    geography: "synthetic-market",
    qualityStatus,
    sensitivity: "internal" as const,
  };
}

function syntheticInput(): EvaluationInput {
  return {
    siteId: "synthetic-site-balanced",
    inputDataVersion: "synthetic-input-v1",
    metricObservations: [
      observation("synthetic_demand", 80, "index"),
      observation("synthetic_competition", 5, "count"),
      observation("synthetic_foot_traffic", 60, "index", "warning"),
    ],
    constraintObservations: [
      {
        constraintId: "synthetic_staffing_feasible",
        rawValue: 1,
        unit: "flag",
        sourceReference: {
          sourceId: "SYNTHETIC-CONSTRAINT",
          observationId: "staffing-observation",
        },
        observedAt: "2026-07-01",
        qualityStatus: "accepted",
        sensitivity: "internal",
      },
    ],
    qualitativeEvidence: [
      {
        evidenceId: "synthetic-local-note",
        sourceReference: {
          sourceId: "SYNTHETIC-QUALITATIVE",
          observationId: "local-note",
        },
      },
    ],
  };
}

test("preserves the legacy synthetic frontend score", () => {
  const score = calculateScore([
    { value: 90, weight: 30, direction: "higher" },
    { value: 30, weight: 20, direction: "lower" },
    { value: 80, weight: 15, direction: "higher" },
    { value: 85, weight: 20, direction: "higher" },
    { value: 80, weight: 10, direction: "higher" },
    { value: 80, weight: 5, direction: "higher" },
  ]);

  assert.equal(score, 82);
});

test("normalizes higher-is-better and lower-is-better boundaries explicitly", () => {
  assert.equal(normalizeMetric(0, demandDefinition), 0);
  assert.equal(normalizeMetric(100, demandDefinition), 100);
  assert.equal(normalizeMetric(0, competitionDefinition), 100);
  assert.equal(normalizeMetric(20, competitionDefinition), 0);
  assert.equal(normalizeMetric(10, competitionDefinition), 50);
  assert.throws(
    () => normalizeMetric(21, competitionDefinition),
    /outside valid range 0 to 20/,
  );
});

test("returns a versioned, traceable structured result", () => {
  const result = evaluateSite(syntheticInput(), syntheticConfiguration());

  assert.equal(result.systemScore, 74.5);
  assert.equal(result.scoreStatus, "calculated");
  assert.equal(result.constraintOutcome, "passed");
  assert.equal(result.eligibleForConsideration, true);
  assert.equal(result.inputDataVersion, "synthetic-input-v1");
  assert.equal(result.scoringVersion, "synthetic-scoring-v1");
  assert.equal(result.calculationVersion, CALCULATION_VERSION);
  assert.deepEqual(
    result.metricContributions.map(
      ({ metricId, rawValue, normalizedValue, weight, contribution }) => ({
        metricId,
        rawValue,
        normalizedValue,
        weight,
        contribution,
      }),
    ),
    [
      {
        metricId: "synthetic_demand",
        rawValue: 80,
        normalizedValue: 80,
        weight: 50,
        contribution: 40,
      },
      {
        metricId: "synthetic_competition",
        rawValue: 5,
        normalizedValue: 75,
        weight: 30,
        contribution: 22.5,
      },
      {
        metricId: "synthetic_foot_traffic",
        rawValue: 60,
        normalizedValue: 60,
        weight: 20,
        contribution: 12,
      },
    ],
  );
  assert.equal(result.qualitativeEvidence.length, 1);
  assert.equal(
    result.metricContributions.some(
      (contribution) =>
        contribution.metricId === result.qualitativeEvidence[0]?.evidenceId,
    ),
    false,
  );
});

test("identical inputs and versions produce byte-equivalent results", () => {
  const first = JSON.stringify(
    evaluateSite(syntheticInput(), syntheticConfiguration()),
  );
  const second = JSON.stringify(
    evaluateSite(syntheticInput(), syntheticConfiguration()),
  );

  assert.equal(first, second);
});

test("reports missing data and renormalizes only for the configured policy", () => {
  const input = syntheticInput();
  input.metricObservations = input.metricObservations.filter(
    (item) => item.metricId !== "synthetic_foot_traffic",
  );

  const result = evaluateSite(input, syntheticConfiguration());

  assert.equal(result.systemScore, 78.125);
  assert.deepEqual(result.missingInputs, ["synthetic_foot_traffic"]);
  assert.equal(result.dataCoverage.scoredWeight, 80);
  assert.equal(result.dataCoverage.missingWeight, 20);
  assert.equal(result.dataCoverage.coveragePercentByWeight, 80);
  assert.equal(
    result.metricContributions.find(
      (item) => item.metricId === "synthetic_foot_traffic",
    )?.contribution,
    null,
  );
});

test("does not calculate a score when a fail-evaluation metric is missing", () => {
  const input = syntheticInput();
  input.metricObservations = input.metricObservations.filter(
    (item) => item.metricId !== "synthetic_demand",
  );

  const result = evaluateSite(input, syntheticConfiguration());

  assert.equal(result.scoreStatus, "not-calculated");
  assert.equal(result.systemScore, null);
  assert.deepEqual(result.missingInputs, ["synthetic_demand"]);
  assert.equal(
    result.metricContributions.every(
      (contribution) => contribution.contribution === null,
    ),
    true,
  );
});

test("represents excluded, rejected, and missing inputs separately", () => {
  const configuration = syntheticConfiguration();
  configuration.metricWeights[2] = {
    metricId: "synthetic_foot_traffic",
    included: false,
    weight: 0,
    exclusionReason: "Excluded from this synthetic configuration.",
  };
  configuration.metricWeights[0].weight = 70;
  const input = syntheticInput();
  input.metricObservations[1] = observation(
    "synthetic_competition",
    5,
    "percent",
  );
  input.metricObservations.push(
    observation("unconfigured_metric", 12, "index"),
  );

  const result = evaluateSite(input, configuration);

  assert.deepEqual(result.excludedInputs, ["synthetic_foot_traffic"]);
  assert.deepEqual(result.missingInputs, []);
  assert.equal(
    result.metricContributions.find(
      (item) => item.metricId === "synthetic_competition",
    )?.status,
    "rejected",
  );
  assert.deepEqual(
    result.rejectedInputs.map(({ inputType, inputId }) => ({
      inputType,
      inputId,
    })),
    [
      { inputType: "metric", inputId: "unconfigured_metric" },
      { inputType: "metric", inputId: "synthetic_competition" },
    ],
  );
  assert.equal(result.dataCoverage.excludedMetricCount, 1);
  assert.equal(result.dataCoverage.rejectedMetricCount, 1);
});

test("rejects out-of-range values instead of silently clamping outside the valid range", () => {
  const input = syntheticInput();
  input.metricObservations[1] = observation(
    "synthetic_competition",
    21,
    "count",
  );

  const result = evaluateSite(input, syntheticConfiguration());

  assert.equal(
    result.metricContributions.find(
      (item) => item.metricId === "synthetic_competition",
    )?.status,
    "rejected",
  );
  assert.match(
    result.rejectedInputs[0]?.reasons.join(" ") ?? "",
    /outside valid range 0 to 20/,
  );
});

test("hard-constraint failure remains separate from the weighted score", () => {
  const input = syntheticInput();
  input.constraintObservations[0].rawValue = 0;

  const result = evaluateSite(input, syntheticConfiguration());

  assert.equal(result.systemScore, 74.5);
  assert.equal(result.constraintOutcome, "failed");
  assert.equal(result.eligibleForConsideration, false);
  assert.equal(result.constraintResults[0]?.status, "failed");
  assert.equal(
    result.metricContributions.some(
      (item) => item.metricId === "synthetic_staffing_feasible",
    ),
    false,
  );
});

test("missing hard constraints produce an incomplete outcome, not an assumed pass", () => {
  const input = syntheticInput();
  input.constraintObservations = [];

  const result = evaluateSite(input, syntheticConfiguration());

  assert.equal(result.constraintOutcome, "incomplete");
  assert.equal(result.eligibleForConsideration, null);
  assert.equal(result.constraintResults[0]?.status, "missing");
});

test("validates configuration schema, ranges, units, weights, and metric roles", async (t) => {
  await t.test("unsupported configuration version", () => {
    const configuration = syntheticConfiguration();
    Reflect.set(configuration, "configurationSchemaVersion", "2.0.0");
    assert.throws(
      () => evaluateSite(syntheticInput(), configuration),
      (error: unknown) =>
        error instanceof ScoringValidationError &&
        error.issues.some(
          (issue) => issue.code === "unsupported-configuration-version",
        ),
    );
  });

  await t.test("invalid weight total", () => {
    const configuration = syntheticConfiguration();
    configuration.metricWeights[0].weight = 49;
    assert.throws(
      () => evaluateSite(syntheticInput(), configuration),
      /Included weights total 99; expected 100/,
    );
  });

  await t.test("invalid metric range and normalization", () => {
    const configuration = syntheticConfiguration();
    configuration.metricDefinitions[0] = {
      ...demandDefinition,
      validRange: { min: 100, max: 0 },
    };
    assert.throws(
      () => evaluateSite(syntheticInput(), configuration),
      (error: unknown) =>
        error instanceof ScoringValidationError &&
        error.issues.some((issue) => issue.code === "invalid-range") &&
        error.issues.some((issue) => issue.code === "invalid-normalization"),
    );
  });

  await t.test("blank unit", () => {
    const configuration = syntheticConfiguration();
    configuration.metricDefinitions[0] = {
      ...demandDefinition,
      unit: "",
    };
    assert.throws(
      () => evaluateSite(syntheticInput(), configuration),
      (error: unknown) =>
        error instanceof ScoringValidationError &&
        error.issues.some((issue) => issue.code === "invalid-unit"),
    );
  });

  await t.test("constraint cannot also be a weighted metric", () => {
    const configuration = syntheticConfiguration();
    configuration.constraints[0] = {
      ...configuration.constraints[0],
      constraintId: "synthetic_demand",
    };
    assert.throws(
      () => evaluateSite(syntheticInput(), configuration),
      (error: unknown) =>
        error instanceof ScoringValidationError &&
        error.issues.some(
          (issue) => issue.code === "metric-constraint-overlap",
        ),
    );
  });
});

test("sensitivity scenarios are deterministic and do not mutate the baseline", () => {
  const configuration = syntheticConfiguration();
  const snapshot = JSON.stringify(configuration);
  const scenarios: SensitivityScenario[] = [
    {
      scenarioId: "demand-emphasis",
      scenarioVersion: "synthetic-sensitivity-v1",
      label: "Synthetic demand emphasis",
      weightOverrides: {
        synthetic_demand: 60,
        synthetic_competition: 20,
      },
    },
  ];

  const first = evaluateSite(syntheticInput(), configuration, scenarios);
  const second = evaluateSite(syntheticInput(), configuration, scenarios);

  assert.equal(JSON.stringify(configuration), snapshot);
  assert.equal(
    JSON.stringify(first.sensitivityResults),
    JSON.stringify(second.sensitivityResults),
  );
  assert.equal(first.systemScore, 74.5);
  assert.equal(first.sensitivityResults[0]?.systemScore, 75);
  assert.equal(first.sensitivityResults[0]?.deltaFromBaseline, 0.5);
  assert.equal(first.sensitivityResults[0]?.scenarioVersion, "synthetic-sensitivity-v1");
});

test("invalid sensitivity weights fail without changing the approved baseline object", () => {
  const configuration = syntheticConfiguration();
  configuration.status = "approved";
  configuration.approvedBy = "Synthetic approver";
  configuration.approvedAt = "2026-07-01";
  const snapshot = JSON.stringify(configuration);

  assert.throws(
    () =>
      evaluateSite(syntheticInput(), configuration, [
        {
          scenarioId: "invalid-total",
          scenarioVersion: "synthetic-sensitivity-invalid",
          label: "Invalid synthetic total",
          weightOverrides: { synthetic_demand: 70 },
        },
      ]),
    /Included weights total 120; expected 100/,
  );
  assert.equal(JSON.stringify(configuration), snapshot);
});

test("legacy missing observations never silently become zero", () => {
  const score = calculateScore([
    { value: 81, weight: 30, direction: "higher" },
    { value: 54, weight: 20, direction: "lower" },
    { value: 78, weight: 15, direction: "higher" },
    { value: 76, weight: 20, direction: "higher" },
    { value: null, weight: 10, direction: "higher" },
    { value: 72, weight: 5, direction: "higher" },
  ]);

  assert.equal(score, 71);
  assert.throws(
    () =>
      calculateScore([{ value: null, weight: 100, direction: "higher" }]),
    /without an available metric/,
  );
});
