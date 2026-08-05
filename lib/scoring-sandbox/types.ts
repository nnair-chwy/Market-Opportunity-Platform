import type {
  ConstraintOperator,
  EvaluationInput,
  MetricDirection,
  StructuredEvaluationResult,
} from "../scoring.ts";

export type SandboxMetricControl = {
  metricId: string;
  label: string;
  direction: MetricDirection;
  minWeight: number;
  maxWeight: number;
  step: number;
};

export type SandboxThresholdControl = {
  constraintId: string;
  label: string;
  operator: ConstraintOperator;
  unit: string;
  min: number;
  max: number;
  step: number;
};

export type SandboxDraft = {
  weights: Record<string, number>;
  thresholds: Record<string, number>;
};

export type SandboxCandidate = {
  siteId: string;
  name: string;
  input: EvaluationInput;
};

export type SandboxValidationIssue = {
  code:
    | "invalid-weight"
    | "invalid-weight-total"
    | "weight-out-of-bounds"
    | "invalid-threshold"
    | "threshold-out-of-bounds";
  fieldId: string;
  message: string;
};

export type MetricContributionChange = {
  metricId: string;
  label: string;
  original: number | null;
  adjusted: number | null;
  delta: number | null;
};

export type CandidateComparison = {
  siteId: string;
  name: string;
  originalResult: StructuredEvaluationResult;
  adjustedResult: StructuredEvaluationResult;
  originalRank: number | null;
  adjustedRank: number | null;
  rankChange: number | null;
  contributionChanges: MetricContributionChange[];
  rankingSensitive: boolean;
  constraintSensitive: boolean;
};

export type SandboxAnalysis = {
  configurationFingerprint: string;
  configurationVersion: string;
  configurationLabel: "Synthetic and unapproved";
  weightTotal: number;
  comparisons: CandidateComparison[];
  sensitivityScenarioCount: number;
};

