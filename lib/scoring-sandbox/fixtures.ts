import {
  CALCULATION_VERSION,
  CONFIGURATION_SCHEMA_VERSION,
  type ConstraintObservation,
  type EvaluationInput,
  type MetricDefinition,
  type MetricObservation,
  type ScoringConfiguration,
} from "../scoring.ts";
import type {
  SandboxCandidate,
  SandboxDraft,
  SandboxMetricControl,
  SandboxThresholdControl,
} from "./types.ts";

export const SANDBOX_EXPECTED_WEIGHT_TOTAL = 100;
export const SANDBOX_SENSITIVITY_STEP = 5;

export const sandboxMetricControls: readonly SandboxMetricControl[] = [
  {
    metricId: "demand",
    label: "Customer demand",
    direction: "higher-is-better",
    minWeight: 20,
    maxWeight: 45,
    step: 5,
  },
  {
    metricId: "competition",
    label: "Competitive intensity",
    direction: "lower-is-better",
    minWeight: 10,
    maxWeight: 30,
    step: 5,
  },
  {
    metricId: "population",
    label: "Population density",
    direction: "higher-is-better",
    minWeight: 5,
    maxWeight: 25,
    step: 5,
  },
  {
    metricId: "drive",
    label: "30-minute drive coverage",
    direction: "higher-is-better",
    minWeight: 10,
    maxWeight: 30,
    step: 5,
  },
  {
    metricId: "foot",
    label: "Foot-traffic proxy",
    direction: "higher-is-better",
    minWeight: 5,
    maxWeight: 20,
    step: 5,
  },
] as const;

export const sandboxThresholdControls: readonly SandboxThresholdControl[] = [
  {
    constraintId: "staffing_feasibility",
    label: "Staffing-feasibility screen",
    operator: "gte",
    unit: "synthetic index",
    min: 60,
    max: 80,
    step: 5,
  },
] as const;

/**
 * The existing demonstration assigned 5 percent to staffing. This isolated
 * baseline removes staffing from weighted preferences and places those 5
 * points on demand so preference weights total 100 percent.
 */
export const initialSandboxDraft: Readonly<SandboxDraft> = {
  weights: {
    demand: 35,
    competition: 20,
    population: 15,
    drive: 20,
    foot: 10,
  },
  thresholds: {
    staffing_feasibility: 70,
  },
};

const metricDefinitions: MetricDefinition[] = sandboxMetricControls.map(
  (control) => ({
    metricId: control.metricId,
    name: control.label,
    description:
      "Synthetic demonstration metric. This is not an approved production criterion.",
    unit: "synthetic index",
    direction: control.direction,
    validRange: { min: 0, max: 100 },
    normalization: {
      function: "linear",
      version: "linear-v1",
      inputMin: 0,
      inputMax: 100,
      clamp: false,
    },
    missingDataPolicy: "exclude-and-renormalize",
    owner: "Unapproved synthetic sandbox",
    sourceIds: [`SYN-${control.metricId.toUpperCase()}`],
  }),
);

export function createSandboxConfiguration(
  draft: SandboxDraft,
  scoringVersion: string,
): ScoringConfiguration {
  return {
    configurationSchemaVersion: CONFIGURATION_SCHEMA_VERSION,
    scoringVersion,
    calculationVersion: CALCULATION_VERSION,
    status: "synthetic",
    label: "Synthetic and unapproved scoring sandbox",
    metricDefinitions: metricDefinitions.map((definition) => ({
      ...definition,
      validRange: { ...definition.validRange },
      normalization: { ...definition.normalization },
      sourceIds: [...definition.sourceIds],
    })),
    metricWeights: sandboxMetricControls.map(({ metricId }) => ({
      metricId,
      included: true,
      weight: draft.weights[metricId],
    })),
    constraints: sandboxThresholdControls.map((control) => ({
      constraintId: control.constraintId,
      name: control.label,
      description:
        "Synthetic hard constraint kept separate from weighted preferences.",
      unit: control.unit,
      operator: control.operator,
      threshold: draft.thresholds[control.constraintId],
      missingPolicy: "fail",
      owner: "Unapproved synthetic sandbox",
      sourceIds: ["SYN-STAFFING"],
    })),
    expectedWeightTotal: SANDBOX_EXPECTED_WEIGHT_TOTAL,
    notes:
      "Synthetic and unapproved. Human-controlled demonstration settings only. A higher score is not a recommendation.",
  };
}

function metricObservation(
  siteId: string,
  metricId: string,
  rawValue: number | null,
): MetricObservation {
  return {
    metricId,
    rawValue,
    unit: "synthetic index",
    sourceReference: {
      sourceId: `SYN-${metricId.toUpperCase()}-${siteId.toUpperCase()}`,
    },
    observedAt: "2026-07-18",
    geography: "synthetic market",
    qualityStatus: rawValue === null ? "warning" : "accepted",
    sensitivity: "internal",
  };
}

function constraintObservation(
  siteId: string,
  rawValue: number,
): ConstraintObservation {
  return {
    constraintId: "staffing_feasibility",
    rawValue,
    unit: "synthetic index",
    sourceReference: {
      sourceId: `SYN-STAFFING-${siteId.toUpperCase()}`,
    },
    observedAt: "2026-07-21",
    qualityStatus: "accepted",
    sensitivity: "internal",
  };
}

function candidate(
  siteId: string,
  name: string,
  values: Record<string, number | null>,
  staffing: number,
): SandboxCandidate {
  const input: EvaluationInput = {
    siteId,
    inputDataVersion: "synthetic-sandbox-candidates-v1",
    metricObservations: sandboxMetricControls.map(({ metricId }) =>
      metricObservation(siteId, metricId, values[metricId] ?? null),
    ),
    constraintObservations: [constraintObservation(siteId, staffing)],
    qualitativeEvidence: [],
  };
  return { siteId, name, input };
}

export const sandboxCandidates: readonly SandboxCandidate[] = [
  candidate(
    "nashville",
    "Nashville East",
    { demand: 90, competition: 30, population: 80, drive: 85, foot: 80 },
    80,
  ),
  candidate(
    "raleigh",
    "Raleigh North",
    { demand: 81, competition: 54, population: 78, drive: 76, foot: null },
    72,
  ),
  candidate(
    "sacramento",
    "Sacramento Central",
    { demand: 89, competition: 69, population: 83, drive: 64, foot: 78 },
    66,
  ),
  candidate(
    "tampa",
    "Tampa Westshore",
    { demand: 84, competition: 51, population: 72, drive: 85, foot: 69 },
    74,
  ),
] as const;

