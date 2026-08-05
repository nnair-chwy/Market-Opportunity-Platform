/**
 * Deterministic scoring for synthetic or explicitly approved structured inputs.
 *
 * This module contains no AI behavior. Qualitative evidence is retained only as
 * source references and never enters a calculation.
 */

export const CONFIGURATION_SCHEMA_VERSION = "1.0.0" as const;
export const CALCULATION_VERSION = "1.0.0" as const;
export const LINEAR_NORMALIZATION_VERSION = "linear-v1" as const;

export type MetricDirection = "higher-is-better" | "lower-is-better";
export type MissingDataPolicy = "exclude-and-renormalize" | "fail-evaluation";
export type QualityStatus = "accepted" | "warning" | "rejected";
export type Sensitivity = "public" | "internal" | "confidential" | "restricted";
export type ConfigurationStatus = "synthetic" | "approved";

export type SourceReference = {
  sourceId: string;
  observationId?: string;
};

export type LinearNormalization = {
  function: "linear";
  version: typeof LINEAR_NORMALIZATION_VERSION;
  inputMin: number;
  inputMax: number;
  clamp: boolean;
};

export type MetricDefinition = {
  metricId: string;
  name: string;
  description: string;
  unit: string;
  direction: MetricDirection;
  validRange: {
    min: number;
    max: number;
  };
  normalization: LinearNormalization;
  missingDataPolicy: MissingDataPolicy;
  owner: string;
  sourceIds: string[];
};

export type MetricObservation = {
  metricId: string;
  rawValue: number | null;
  unit: string;
  sourceReference: SourceReference;
  observedAt: string;
  geography: string;
  qualityStatus: QualityStatus;
  sensitivity: Sensitivity;
};

export type MetricWeight = {
  metricId: string;
  included: boolean;
  weight: number;
  exclusionReason?: string;
};

export type ConstraintOperator = "gte" | "gt" | "lte" | "lt" | "eq";

export type ConstraintDefinition = {
  constraintId: string;
  name: string;
  description: string;
  unit: string;
  operator: ConstraintOperator;
  threshold: number;
  missingPolicy: "fail" | "report";
  owner: string;
  sourceIds: string[];
};

export type ConstraintObservation = {
  constraintId: string;
  rawValue: number | null;
  unit: string;
  sourceReference: SourceReference;
  observedAt: string;
  qualityStatus: QualityStatus;
  sensitivity: Sensitivity;
};

export type ScoringConfiguration = {
  configurationSchemaVersion: typeof CONFIGURATION_SCHEMA_VERSION;
  scoringVersion: string;
  calculationVersion: typeof CALCULATION_VERSION;
  status: ConfigurationStatus;
  label: string;
  approvedBy?: string;
  approvedAt?: string;
  metricDefinitions: MetricDefinition[];
  metricWeights: MetricWeight[];
  constraints: ConstraintDefinition[];
  expectedWeightTotal: number;
  notes: string;
};

export type QualitativeEvidenceReference = {
  evidenceId: string;
  sourceReference: SourceReference;
};

export type EvaluationInput = {
  siteId: string;
  inputDataVersion: string;
  metricObservations: MetricObservation[];
  constraintObservations: ConstraintObservation[];
  qualitativeEvidence: QualitativeEvidenceReference[];
};

export type ConstraintResult = {
  constraintId: string;
  name: string;
  status: "passed" | "failed" | "missing" | "rejected";
  rawValue: number | null;
  unit: string;
  operator: ConstraintOperator;
  threshold: number;
  sourceReference: SourceReference | null;
  warning: string | null;
};

export type MetricContribution = {
  metricId: string;
  metricName: string;
  status: "scored" | "missing" | "excluded" | "rejected";
  rawValue: number | null;
  unit: string;
  normalizedValue: number | null;
  normalizationFunction: LinearNormalization;
  direction: MetricDirection;
  weight: number;
  contribution: number | null;
  missingDataPolicy: MissingDataPolicy;
  sourceReference: SourceReference | null;
  warnings: string[];
};

export type RejectedInput = {
  inputType: "metric" | "constraint";
  inputId: string;
  reasons: string[];
  sourceReferences: SourceReference[];
};

export type DataCoverage = {
  configuredMetricCount: number;
  scoredMetricCount: number;
  missingMetricCount: number;
  excludedMetricCount: number;
  rejectedMetricCount: number;
  configuredWeight: number;
  scoredWeight: number;
  missingWeight: number;
  rejectedWeight: number;
  coveragePercentByWeight: number;
  coveragePercentByMetric: number;
};

export type SensitivityScenario = {
  scenarioId: string;
  scenarioVersion: string;
  label: string;
  weightOverrides: Record<string, number>;
};

export type SensitivityResult = {
  scenarioId: string;
  scenarioVersion: string;
  label: string;
  scoreStatus: StructuredEvaluationResult["scoreStatus"];
  systemScore: number | null;
  deltaFromBaseline: number | null;
  metricContributions: MetricContribution[];
  warnings: string[];
};

export type StructuredEvaluationResult = {
  siteId: string;
  inputDataVersion: string;
  scoringVersion: string;
  configurationSchemaVersion: typeof CONFIGURATION_SCHEMA_VERSION;
  calculationVersion: typeof CALCULATION_VERSION;
  configurationStatus: ConfigurationStatus;
  scoreStatus: "calculated" | "not-calculated";
  systemScore: number | null;
  constraintOutcome: "passed" | "failed" | "incomplete";
  eligibleForConsideration: boolean | null;
  constraintResults: ConstraintResult[];
  metricContributions: MetricContribution[];
  dataCoverage: DataCoverage;
  missingInputs: string[];
  excludedInputs: string[];
  rejectedInputs: RejectedInput[];
  warnings: string[];
  sourceReferences: SourceReference[];
  qualitativeEvidence: QualitativeEvidenceReference[];
  sensitivityResults: SensitivityResult[];
};

export type ScoringValidationIssue = {
  code:
    | "unsupported-configuration-version"
    | "unsupported-calculation-version"
    | "invalid-version"
    | "invalid-weight"
    | "invalid-weight-total"
    | "invalid-range"
    | "invalid-normalization"
    | "invalid-unit"
    | "duplicate-id"
    | "unknown-metric"
    | "metric-constraint-overlap"
    | "invalid-exclusion"
    | "invalid-approval"
    | "invalid-input";
  path: string;
  message: string;
};

export class ScoringValidationError extends Error {
  readonly issues: ScoringValidationIssue[];

  constructor(issues: ScoringValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "ScoringValidationError";
    this.issues = issues;
  }
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function round(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function uniqueIds(
  values: string[],
  path: string,
  issues: ScoringValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      issues.push({
        code: "duplicate-id",
        path,
        message: `Duplicate identifier "${value}".`,
      });
    }
    seen.add(value);
  }
}

export function validateScoringConfiguration(
  configuration: ScoringConfiguration,
): void {
  const issues: ScoringValidationIssue[] = [];

  if (
    configuration.configurationSchemaVersion !== CONFIGURATION_SCHEMA_VERSION
  ) {
    issues.push({
      code: "unsupported-configuration-version",
      path: "configurationSchemaVersion",
      message: `Expected "${CONFIGURATION_SCHEMA_VERSION}", received "${String(configuration.configurationSchemaVersion)}".`,
    });
  }
  if (configuration.calculationVersion !== CALCULATION_VERSION) {
    issues.push({
      code: "unsupported-calculation-version",
      path: "calculationVersion",
      message: `Expected "${CALCULATION_VERSION}", received "${String(configuration.calculationVersion)}".`,
    });
  }
  if (configuration.scoringVersion.trim() === "") {
    issues.push({
      code: "invalid-version",
      path: "scoringVersion",
      message: "A non-empty scoring version is required.",
    });
  }
  if (
    configuration.status === "approved" &&
    (!configuration.approvedBy?.trim() || !configuration.approvedAt?.trim())
  ) {
    issues.push({
      code: "invalid-approval",
      path: "status",
      message:
        "Approved configurations require approvedBy and approvedAt metadata.",
    });
  }

  uniqueIds(
    configuration.metricDefinitions.map((definition) => definition.metricId),
    "metricDefinitions",
    issues,
  );
  uniqueIds(
    configuration.metricWeights.map((weight) => weight.metricId),
    "metricWeights",
    issues,
  );
  uniqueIds(
    configuration.constraints.map((constraint) => constraint.constraintId),
    "constraints",
    issues,
  );

  const definitions = new Map(
    configuration.metricDefinitions.map((definition) => [
      definition.metricId,
      definition,
    ]),
  );
  const constraintIds = new Set(
    configuration.constraints.map((constraint) => constraint.constraintId),
  );

  configuration.metricDefinitions.forEach((definition, index) => {
    const path = `metricDefinitions[${index}]`;
    if (
      !finite(definition.validRange.min) ||
      !finite(definition.validRange.max) ||
      definition.validRange.min >= definition.validRange.max
    ) {
      issues.push({
        code: "invalid-range",
        path: `${path}.validRange`,
        message: "The valid range must contain finite min < max values.",
      });
    }
    if (definition.unit.trim() === "") {
      issues.push({
        code: "invalid-unit",
        path: `${path}.unit`,
        message: "A non-empty unit is required.",
      });
    }
    const normalization = definition.normalization;
    if (
      normalization.version !== LINEAR_NORMALIZATION_VERSION ||
      !finite(normalization.inputMin) ||
      !finite(normalization.inputMax) ||
      normalization.inputMin >= normalization.inputMax ||
      normalization.inputMin < definition.validRange.min ||
      normalization.inputMax > definition.validRange.max
    ) {
      issues.push({
        code: "invalid-normalization",
        path: `${path}.normalization`,
        message:
          "Linear normalization must use linear-v1, finite inputMin < inputMax, and bounds within the valid range.",
      });
    }
    if (constraintIds.has(definition.metricId)) {
      issues.push({
        code: "metric-constraint-overlap",
        path: `${path}.metricId`,
        message:
          "A hard constraint cannot also be configured as a weighted metric.",
      });
    }
  });

  let includedWeight = 0;
  configuration.metricWeights.forEach((metricWeight, index) => {
    const path = `metricWeights[${index}]`;
    if (!definitions.has(metricWeight.metricId)) {
      issues.push({
        code: "unknown-metric",
        path: `${path}.metricId`,
        message: `No metric definition exists for "${metricWeight.metricId}".`,
      });
    }
    if (!finite(metricWeight.weight) || metricWeight.weight < 0) {
      issues.push({
        code: "invalid-weight",
        path: `${path}.weight`,
        message: "Weights must be finite and non-negative.",
      });
    }
    if (metricWeight.included) {
      if (metricWeight.weight <= 0) {
        issues.push({
          code: "invalid-weight",
          path: `${path}.weight`,
          message: "Included metrics require a weight greater than zero.",
        });
      }
      includedWeight += metricWeight.weight;
    } else if (
      metricWeight.weight !== 0 ||
      !metricWeight.exclusionReason?.trim()
    ) {
      issues.push({
        code: "invalid-exclusion",
        path,
        message:
          "Excluded metrics require weight 0 and a non-empty exclusion reason.",
      });
    }
  });

  const weightedIds = new Set(
    configuration.metricWeights.map((weight) => weight.metricId),
  );
  for (const definition of configuration.metricDefinitions) {
    if (!weightedIds.has(definition.metricId)) {
      issues.push({
        code: "unknown-metric",
        path: "metricWeights",
        message: `Metric "${definition.metricId}" has no weight or explicit exclusion entry.`,
      });
    }
  }

  if (
    !finite(configuration.expectedWeightTotal) ||
    configuration.expectedWeightTotal <= 0 ||
    Math.abs(includedWeight - configuration.expectedWeightTotal) > 1e-9
  ) {
    issues.push({
      code: "invalid-weight-total",
      path: "metricWeights",
      message: `Included weights total ${round(includedWeight)}; expected ${configuration.expectedWeightTotal}.`,
    });
  }

  configuration.constraints.forEach((constraint, index) => {
    if (!finite(constraint.threshold)) {
      issues.push({
        code: "invalid-range",
        path: `constraints[${index}].threshold`,
        message: "Constraint thresholds must be finite.",
      });
    }
    if (constraint.unit.trim() === "") {
      issues.push({
        code: "invalid-unit",
        path: `constraints[${index}].unit`,
        message: "A non-empty unit is required.",
      });
    }
  });

  if (issues.length > 0) {
    throw new ScoringValidationError(issues);
  }
}

export function normalizeMetric(
  rawValue: number,
  definition: MetricDefinition,
): number {
  if (
    !finite(rawValue) ||
    rawValue < definition.validRange.min ||
    rawValue > definition.validRange.max
  ) {
    throw new ScoringValidationError([
      {
        code: "invalid-range",
        path: `metricObservations.${definition.metricId}.rawValue`,
        message: `Value ${rawValue} is outside valid range ${definition.validRange.min} to ${definition.validRange.max}.`,
      },
    ]);
  }
  const normalization = definition.normalization;
  let value = rawValue;
  if (normalization.clamp) {
    value = Math.min(
      normalization.inputMax,
      Math.max(normalization.inputMin, value),
    );
  } else if (
    value < normalization.inputMin ||
    value > normalization.inputMax
  ) {
    throw new ScoringValidationError([
      {
        code: "invalid-range",
        path: `metricObservations.${definition.metricId}.rawValue`,
        message: `Value ${value} is outside normalization range ${normalization.inputMin} to ${normalization.inputMax}.`,
      },
    ]);
  }

  const ratio =
    (value - normalization.inputMin) /
    (normalization.inputMax - normalization.inputMin);
  const normalized =
    definition.direction === "higher-is-better"
      ? ratio * 100
      : (1 - ratio) * 100;
  return round(normalized);
}

function compareConstraint(
  value: number,
  operator: ConstraintOperator,
  threshold: number,
): boolean {
  switch (operator) {
    case "gte":
      return value >= threshold;
    case "gt":
      return value > threshold;
    case "lte":
      return value <= threshold;
    case "lt":
      return value < threshold;
    case "eq":
      return value === threshold;
  }
}

function sourceKey(reference: SourceReference): string {
  return `${reference.sourceId}\u0000${reference.observationId ?? ""}`;
}

function sortedUniqueSources(
  references: SourceReference[],
): SourceReference[] {
  const byKey = new Map<string, SourceReference>();
  for (const reference of references) {
    byKey.set(sourceKey(reference), { ...reference });
  }
  return [...byKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, reference]) => reference);
}

function groupById<T>(
  items: T[],
  getId: (item: T) => string,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const id = getId(item);
    const current = result.get(id) ?? [];
    current.push(item);
    result.set(id, current);
  }
  return result;
}

function evaluateConstraints(
  configuration: ScoringConfiguration,
  input: EvaluationInput,
  rejectedInputs: RejectedInput[],
  warnings: string[],
): ConstraintResult[] {
  const grouped = groupById(
    input.constraintObservations,
    (observation) => observation.constraintId,
  );
  const knownIds = new Set(
    configuration.constraints.map((constraint) => constraint.constraintId),
  );

  for (const [constraintId, observations] of grouped) {
    if (!knownIds.has(constraintId)) {
      rejectedInputs.push({
        inputType: "constraint",
        inputId: constraintId,
        reasons: ["No configured hard constraint has this identifier."],
        sourceReferences: sortedUniqueSources(
          observations.map((observation) => observation.sourceReference),
        ),
      });
    }
  }

  return configuration.constraints.map((definition) => {
    const observations = grouped.get(definition.constraintId) ?? [];
    if (observations.length > 1) {
      const warning = `Constraint "${definition.constraintId}" has duplicate observations; none were used.`;
      warnings.push(warning);
      rejectedInputs.push({
        inputType: "constraint",
        inputId: definition.constraintId,
        reasons: ["Duplicate constraint observations."],
        sourceReferences: sortedUniqueSources(
          observations.map((observation) => observation.sourceReference),
        ),
      });
      return {
        constraintId: definition.constraintId,
        name: definition.name,
        status: "rejected",
        rawValue: null,
        unit: definition.unit,
        operator: definition.operator,
        threshold: definition.threshold,
        sourceReference: null,
        warning,
      };
    }

    const observation = observations[0];
    if (!observation || observation.rawValue === null) {
      const warning = `Constraint "${definition.constraintId}" is missing.`;
      warnings.push(warning);
      return {
        constraintId: definition.constraintId,
        name: definition.name,
        status: "missing",
        rawValue: null,
        unit: definition.unit,
        operator: definition.operator,
        threshold: definition.threshold,
        sourceReference: observation?.sourceReference ?? null,
        warning,
      };
    }

    const reasons: string[] = [];
    if (observation.qualityStatus === "rejected") {
      reasons.push("Observation quality status is rejected.");
    }
    if (observation.unit !== definition.unit) {
      reasons.push(
        `Unit "${observation.unit}" does not match configured unit "${definition.unit}".`,
      );
    }
    if (!finite(observation.rawValue)) {
      reasons.push("Constraint value must be finite.");
    }
    if (reasons.length > 0) {
      const warning = `Constraint "${definition.constraintId}" was rejected: ${reasons.join(" ")}`;
      warnings.push(warning);
      rejectedInputs.push({
        inputType: "constraint",
        inputId: definition.constraintId,
        reasons,
        sourceReferences: [observation.sourceReference],
      });
      return {
        constraintId: definition.constraintId,
        name: definition.name,
        status: "rejected",
        rawValue: observation.rawValue,
        unit: observation.unit,
        operator: definition.operator,
        threshold: definition.threshold,
        sourceReference: observation.sourceReference,
        warning,
      };
    }

    const passed = compareConstraint(
      observation.rawValue,
      definition.operator,
      definition.threshold,
    );
    const warning =
      observation.qualityStatus === "warning"
        ? `Constraint "${definition.constraintId}" passed input validation with a quality warning.`
        : null;
    if (warning) warnings.push(warning);
    return {
      constraintId: definition.constraintId,
      name: definition.name,
      status: passed ? "passed" : "failed",
      rawValue: observation.rawValue,
      unit: observation.unit,
      operator: definition.operator,
      threshold: definition.threshold,
      sourceReference: observation.sourceReference,
      warning,
    };
  });
}

function evaluateBaseline(
  input: EvaluationInput,
  configuration: ScoringConfiguration,
): StructuredEvaluationResult {
  validateScoringConfiguration(configuration);

  const inputIssues: ScoringValidationIssue[] = [];
  if (!input.siteId.trim()) {
    inputIssues.push({
      code: "invalid-input",
      path: "siteId",
      message: "A non-empty site ID is required.",
    });
  }
  if (!input.inputDataVersion.trim()) {
    inputIssues.push({
      code: "invalid-version",
      path: "inputDataVersion",
      message: "A non-empty input-data version is required.",
    });
  }
  if (inputIssues.length > 0) {
    throw new ScoringValidationError(inputIssues);
  }

  const warnings: string[] = [];
  const rejectedInputs: RejectedInput[] = [];
  const constraintResults = evaluateConstraints(
    configuration,
    input,
    rejectedInputs,
    warnings,
  );
  const grouped = groupById(
    input.metricObservations,
    (observation) => observation.metricId,
  );
  const definitions = new Map(
    configuration.metricDefinitions.map((definition) => [
      definition.metricId,
      definition,
    ]),
  );
  const configuredIds = new Set(definitions.keys());

  for (const [metricId, observations] of grouped) {
    if (!configuredIds.has(metricId)) {
      rejectedInputs.push({
        inputType: "metric",
        inputId: metricId,
        reasons: ["No configured metric has this identifier."],
        sourceReferences: sortedUniqueSources(
          observations.map((observation) => observation.sourceReference),
        ),
      });
    }
  }

  const preliminary = configuration.metricWeights.map(
    (metricWeight): MetricContribution => {
      const definition = definitions.get(metricWeight.metricId);
      if (!definition) {
        throw new Error("Configuration validation did not reject an unknown metric.");
      }
      const observations = grouped.get(metricWeight.metricId) ?? [];
      const base = {
        metricId: definition.metricId,
        metricName: definition.name,
        unit: definition.unit,
        normalizationFunction: { ...definition.normalization },
        direction: definition.direction,
        weight: metricWeight.weight,
        missingDataPolicy: definition.missingDataPolicy,
      };

      if (!metricWeight.included) {
        return {
          ...base,
          status: "excluded",
          rawValue: observations[0]?.rawValue ?? null,
          normalizedValue: null,
          contribution: null,
          sourceReference: observations[0]?.sourceReference ?? null,
          warnings: [metricWeight.exclusionReason ?? "Excluded by configuration."],
        };
      }

      if (observations.length > 1) {
        const reason = "Duplicate metric observations.";
        rejectedInputs.push({
          inputType: "metric",
          inputId: definition.metricId,
          reasons: [reason],
          sourceReferences: sortedUniqueSources(
            observations.map((observation) => observation.sourceReference),
          ),
        });
        return {
          ...base,
          status: "rejected",
          rawValue: null,
          normalizedValue: null,
          contribution: null,
          sourceReference: null,
          warnings: [reason],
        };
      }

      const observation = observations[0];
      if (!observation || observation.rawValue === null) {
        return {
          ...base,
          status: "missing",
          rawValue: null,
          normalizedValue: null,
          contribution: null,
          sourceReference: observation?.sourceReference ?? null,
          warnings: [
            definition.missingDataPolicy === "fail-evaluation"
              ? "Required metric is missing; the system score was not calculated."
              : "Metric is missing and was excluded from the available-weight denominator.",
          ],
        };
      }

      const reasons: string[] = [];
      if (observation.qualityStatus === "rejected") {
        reasons.push("Observation quality status is rejected.");
      }
      if (observation.unit !== definition.unit) {
        reasons.push(
          `Unit "${observation.unit}" does not match configured unit "${definition.unit}".`,
        );
      }
      if (!finite(observation.rawValue)) {
        reasons.push("Metric value must be finite.");
      } else if (
        observation.rawValue < definition.validRange.min ||
        observation.rawValue > definition.validRange.max
      ) {
        reasons.push(
          `Value ${observation.rawValue} is outside valid range ${definition.validRange.min} to ${definition.validRange.max}.`,
        );
      } else if (
        !definition.normalization.clamp &&
        (observation.rawValue < definition.normalization.inputMin ||
          observation.rawValue > definition.normalization.inputMax)
      ) {
        reasons.push(
          `Value ${observation.rawValue} is outside normalization range ${definition.normalization.inputMin} to ${definition.normalization.inputMax}.`,
        );
      }
      if (reasons.length > 0) {
        rejectedInputs.push({
          inputType: "metric",
          inputId: definition.metricId,
          reasons,
          sourceReferences: [observation.sourceReference],
        });
        return {
          ...base,
          status: "rejected",
          rawValue: observation.rawValue,
          unit: observation.unit,
          normalizedValue: null,
          contribution: null,
          sourceReference: observation.sourceReference,
          warnings: reasons,
        };
      }

      const metricWarnings =
        observation.qualityStatus === "warning"
          ? ["Observation was scored with a visible quality warning."]
          : [];
      return {
        ...base,
        status: "scored",
        rawValue: observation.rawValue,
        normalizedValue: normalizeMetric(observation.rawValue, definition),
        contribution: 0,
        sourceReference: observation.sourceReference,
        warnings: metricWarnings,
      };
    },
  );

  const scoredWeight = preliminary.reduce(
    (sum, contribution) =>
      contribution.status === "scored" ? sum + contribution.weight : sum,
    0,
  );
  const blocksScore = preliminary.some(
    (contribution) =>
      contribution.missingDataPolicy === "fail-evaluation" &&
      contribution.status !== "scored" &&
      contribution.status !== "excluded",
  );
  const scoreStatus =
    scoredWeight > 0 && !blocksScore ? "calculated" : "not-calculated";
  const metricContributions = preliminary.map((contribution) => {
    if (
      scoreStatus === "calculated" &&
      contribution.status === "scored" &&
      contribution.normalizedValue !== null
    ) {
      return {
        ...contribution,
        contribution: round(
          (contribution.normalizedValue * contribution.weight) / scoredWeight,
        ),
      };
    }
    return { ...contribution, contribution: null };
  });
  const systemScore =
    scoreStatus === "calculated"
      ? round(
          metricContributions.reduce(
            (sum, contribution) => sum + (contribution.contribution ?? 0),
            0,
          ),
        )
      : null;

  const missingInputs = metricContributions
    .filter((contribution) => contribution.status === "missing")
    .map((contribution) => contribution.metricId);
  const excludedInputs = metricContributions
    .filter((contribution) => contribution.status === "excluded")
    .map((contribution) => contribution.metricId);
  const configuredContributions = metricContributions.filter(
    (contribution) => contribution.status !== "excluded",
  );
  const missingWeight = metricContributions.reduce(
    (sum, contribution) =>
      contribution.status === "missing" ? sum + contribution.weight : sum,
    0,
  );
  const rejectedWeight = metricContributions.reduce(
    (sum, contribution) =>
      contribution.status === "rejected" ? sum + contribution.weight : sum,
    0,
  );
  const configuredWeight = configuration.expectedWeightTotal;
  const dataCoverage: DataCoverage = {
    configuredMetricCount: configuredContributions.length,
    scoredMetricCount: metricContributions.filter(
      (contribution) => contribution.status === "scored",
    ).length,
    missingMetricCount: missingInputs.length,
    excludedMetricCount: excludedInputs.length,
    rejectedMetricCount: metricContributions.filter(
      (contribution) => contribution.status === "rejected",
    ).length,
    configuredWeight,
    scoredWeight: round(scoredWeight),
    missingWeight: round(missingWeight),
    rejectedWeight: round(rejectedWeight),
    coveragePercentByWeight: round((scoredWeight / configuredWeight) * 100),
    coveragePercentByMetric:
      configuredContributions.length === 0
        ? 0
        : round(
            (metricContributions.filter(
              (contribution) => contribution.status === "scored",
            ).length /
              configuredContributions.length) *
              100,
          ),
  };

  for (const contribution of metricContributions) {
    for (const warning of contribution.warnings) {
      warnings.push(`Metric "${contribution.metricId}": ${warning}`);
    }
  }
  if (scoreStatus === "not-calculated") {
    warnings.push(
      scoredWeight === 0
        ? "The system score was not calculated because no weighted metric was scoreable."
        : "The system score was not calculated because a required metric was unavailable.",
    );
  }

  const failedConstraint = constraintResults.some(
    (result) => result.status === "failed",
  );
  const incompleteConstraint = constraintResults.some(
    (result) => result.status === "missing" || result.status === "rejected",
  );
  const constraintOutcome = failedConstraint
    ? "failed"
    : incompleteConstraint
      ? "incomplete"
      : "passed";

  const allSources = [
    ...input.metricObservations.map(
      (observation) => observation.sourceReference,
    ),
    ...input.constraintObservations.map(
      (observation) => observation.sourceReference,
    ),
    ...input.qualitativeEvidence.map((evidence) => evidence.sourceReference),
  ];

  return {
    siteId: input.siteId,
    inputDataVersion: input.inputDataVersion,
    scoringVersion: configuration.scoringVersion,
    configurationSchemaVersion: configuration.configurationSchemaVersion,
    calculationVersion: configuration.calculationVersion,
    configurationStatus: configuration.status,
    scoreStatus,
    systemScore,
    constraintOutcome,
    eligibleForConsideration:
      constraintOutcome === "passed"
        ? true
        : constraintOutcome === "failed"
          ? false
          : null,
    constraintResults,
    metricContributions,
    dataCoverage,
    missingInputs,
    excludedInputs,
    rejectedInputs,
    warnings,
    sourceReferences: sortedUniqueSources(allSources),
    qualitativeEvidence: input.qualitativeEvidence.map((evidence) => ({
      evidenceId: evidence.evidenceId,
      sourceReference: { ...evidence.sourceReference },
    })),
    sensitivityResults: [],
  };
}

export function runSensitivityScenarios(
  input: EvaluationInput,
  baselineConfiguration: ScoringConfiguration,
  scenarios: SensitivityScenario[],
  baselineResult = evaluateBaseline(input, baselineConfiguration),
): SensitivityResult[] {
  uniqueIds(
    scenarios.map((scenario) => scenario.scenarioId),
    "sensitivityScenarios",
    [],
  );

  const scenarioIds = new Set<string>();
  for (const scenario of scenarios) {
    if (scenarioIds.has(scenario.scenarioId)) {
      throw new ScoringValidationError([
        {
          code: "duplicate-id",
          path: "sensitivityScenarios",
          message: `Duplicate identifier "${scenario.scenarioId}".`,
        },
      ]);
    }
    scenarioIds.add(scenario.scenarioId);
  }

  return scenarios.map((scenario) => {
    if (!scenario.scenarioId.trim() || !scenario.scenarioVersion.trim()) {
      throw new ScoringValidationError([
        {
          code: "invalid-version",
          path: `sensitivityScenarios.${scenario.scenarioId || "<empty>"}`,
          message: "Scenario ID and version must be non-empty.",
        },
      ]);
    }
    const knownMetricIds = new Set(
      baselineConfiguration.metricWeights.map((weight) => weight.metricId),
    );
    for (const metricId of Object.keys(scenario.weightOverrides)) {
      if (!knownMetricIds.has(metricId)) {
        throw new ScoringValidationError([
          {
            code: "unknown-metric",
            path: `sensitivityScenarios.${scenario.scenarioId}.weightOverrides.${metricId}`,
            message: "A sensitivity override references an unknown metric.",
          },
        ]);
      }
    }

    const scenarioConfiguration: ScoringConfiguration = {
      ...baselineConfiguration,
      scoringVersion: scenario.scenarioVersion,
      status: "synthetic",
      approvedBy: undefined,
      approvedAt: undefined,
      metricDefinitions: baselineConfiguration.metricDefinitions.map(
        (definition) => ({
          ...definition,
          validRange: { ...definition.validRange },
          normalization: { ...definition.normalization },
          sourceIds: [...definition.sourceIds],
        }),
      ),
      metricWeights: baselineConfiguration.metricWeights.map((metricWeight) => ({
        ...metricWeight,
        weight:
          scenario.weightOverrides[metricWeight.metricId] ??
          metricWeight.weight,
      })),
      constraints: baselineConfiguration.constraints.map((constraint) => ({
        ...constraint,
        sourceIds: [...constraint.sourceIds],
      })),
      notes: `Synthetic sensitivity scenario "${scenario.scenarioId}" derived from baseline "${baselineConfiguration.scoringVersion}".`,
    };
    const result = evaluateBaseline(input, scenarioConfiguration);
    return {
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      label: scenario.label,
      scoreStatus: result.scoreStatus,
      systemScore: result.systemScore,
      deltaFromBaseline:
        result.systemScore === null || baselineResult.systemScore === null
          ? null
          : round(result.systemScore - baselineResult.systemScore),
      metricContributions: result.metricContributions,
      warnings: result.warnings,
    };
  });
}

export function evaluateSite(
  input: EvaluationInput,
  configuration: ScoringConfiguration,
  sensitivityScenarios: SensitivityScenario[] = [],
): StructuredEvaluationResult {
  const result = evaluateBaseline(input, configuration);
  return {
    ...result,
    sensitivityResults: runSensitivityScenarios(
      input,
      configuration,
      sensitivityScenarios,
      result,
    ),
  };
}

/**
 * Legacy frontend-demo contract. New scoring behavior must use evaluateSite.
 */
export type ScoredMetric = {
  value: number | null;
  weight: number;
  direction: "higher" | "lower";
};

/**
 * Compatibility wrapper for the existing synthetic frontend.
 *
 * Inputs are explicitly treated as already-normalized 0 to 100 values. The
 * structured engine above is the auditable scoring contract.
 */
export function calculateScore(metrics: ScoredMetric[]): number {
  const available = metrics.filter(
    (metric): metric is ScoredMetric & { value: number } =>
      metric.value !== null,
  );
  const availableWeight = available.reduce(
    (sum, metric) => sum + metric.weight,
    0,
  );

  if (availableWeight === 0) {
    throw new Error("Cannot calculate a score without an available metric.");
  }

  const weighted = available.reduce((sum, metric) => {
    if (
      !finite(metric.value) ||
      metric.value < 0 ||
      metric.value > 100 ||
      !finite(metric.weight) ||
      metric.weight < 0
    ) {
      throw new Error(
        "Legacy scoring values must be finite values from 0 to 100 with non-negative finite weights.",
      );
    }
    const normalized =
      metric.direction === "lower" ? 100 - metric.value : metric.value;
    return sum + normalized * metric.weight;
  }, 0);

  return Math.round(weighted / availableWeight);
}
