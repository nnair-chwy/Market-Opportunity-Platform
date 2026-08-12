import { z } from "zod";

export const DETERMINISTIC_OPERATOR_VERSION = "1.0.0" as const;

export const decisionLayerSchema = z.enum([
  "market_attractiveness",
  "submarket_opportunity",
  "property_feasibility",
  "execution_priority",
]);
export type DecisionLayer = z.infer<typeof decisionLayerSchema>;

const identifierSchema = z.string().trim().min(1).max(180);
const versionSchema = z.string().trim().min(1).max(120);
const sourceIdSchema = z.string().trim().min(1).max(180);
const provenanceSchema = z.object({
  sourceIds: z.array(sourceIdSchema),
  inputVersion: versionSchema,
  transformationVersion: versionSchema,
}).strict();

const operatorEnvelopeSchema = z.object({
  operatorVersion: z.literal(DETERMINISTIC_OPERATOR_VERSION),
  decisionLayer: decisionLayerSchema,
}).strict();

export const normalizeMetricInputSchema = operatorEnvelopeSchema.extend({
  metricId: identifierSchema,
  rawValue: z.number().finite(),
  direction: z.enum(["higher_is_better", "lower_is_better"]),
  validRange: z.object({
    min: z.number().finite(),
    max: z.number().finite(),
  }).strict(),
  normalization: z.object({
    function: z.literal("linear"),
    version: versionSchema,
    inputMin: z.number().finite(),
    inputMax: z.number().finite(),
    clamp: z.boolean(),
  }).strict(),
  provenance: provenanceSchema,
}).strict().superRefine((input, context) => {
  if (input.validRange.min >= input.validRange.max) {
    context.addIssue({
      code: "custom",
      path: ["validRange"],
      message: "The valid range must contain min < max.",
    });
  }
  if (
    input.normalization.inputMin >= input.normalization.inputMax ||
    input.normalization.inputMin < input.validRange.min ||
    input.normalization.inputMax > input.validRange.max
  ) {
    context.addIssue({
      code: "custom",
      path: ["normalization"],
      message: "Normalization bounds must increase within the valid range.",
    });
  }
});
export type NormalizeMetricInput = z.infer<typeof normalizeMetricInputSchema>;

export type NormalizeMetricResult = {
  metricId: string;
  rawValue: number;
  normalizedValue: number;
  normalizationVersion: string;
  decisionLayer: DecisionLayer;
  provenance: z.infer<typeof provenanceSchema>;
};

function round(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function normalize_metric(input: NormalizeMetricInput): NormalizeMetricResult {
  const parsed = normalizeMetricInputSchema.parse(input);
  if (
    parsed.rawValue < parsed.validRange.min ||
    parsed.rawValue > parsed.validRange.max
  ) {
    throw new Error(
      `Metric "${parsed.metricId}" value ${parsed.rawValue} is outside valid range ${parsed.validRange.min} to ${parsed.validRange.max}.`,
    );
  }
  let value = parsed.rawValue;
  if (parsed.normalization.clamp) {
    value = Math.min(
      parsed.normalization.inputMax,
      Math.max(parsed.normalization.inputMin, value),
    );
  } else if (
    value < parsed.normalization.inputMin ||
    value > parsed.normalization.inputMax
  ) {
    throw new Error(
      `Metric "${parsed.metricId}" value ${value} is outside normalization range ${parsed.normalization.inputMin} to ${parsed.normalization.inputMax}.`,
    );
  }
  const ratio =
    (value - parsed.normalization.inputMin) /
    (parsed.normalization.inputMax - parsed.normalization.inputMin);
  return {
    metricId: parsed.metricId,
    rawValue: parsed.rawValue,
    normalizedValue: round(
      (parsed.direction === "higher_is_better" ? ratio : 1 - ratio) * 100,
    ),
    normalizationVersion: parsed.normalization.version,
    decisionLayer: parsed.decisionLayer,
    provenance: parsed.provenance,
  };
}

const joinEntitySchema = z.object({
  entityId: identifierSchema,
  joinKey: identifierSchema.nullable(),
  payload: z.record(z.string(), z.json()),
  provenance: provenanceSchema,
}).strict();

export const joinGeographyInputSchema = operatorEnvelopeSchema.extend({
  joinVersion: versionSchema,
  unmatchedPolicy: z.enum(["retain", "reject"]),
  entities: z.array(joinEntitySchema),
  geographies: z.array(z.object({
    geographyId: identifierSchema,
    joinKey: identifierSchema,
    payload: z.record(z.string(), z.json()),
    provenance: provenanceSchema,
  }).strict()),
}).strict();
export type JoinGeographyInput = z.infer<typeof joinGeographyInputSchema>;

export function join_geography(input: JoinGeographyInput) {
  const parsed = joinGeographyInputSchema.parse(input);
  const geographyByKey = new Map<string, (typeof parsed.geographies)[number]>();
  for (const geography of parsed.geographies) {
    if (geographyByKey.has(geography.joinKey)) {
      throw new Error(`Duplicate geography join key "${geography.joinKey}".`);
    }
    geographyByKey.set(geography.joinKey, geography);
  }
  return parsed.entities.map((entity) => {
    const geography = entity.joinKey
      ? geographyByKey.get(entity.joinKey) ?? null
      : null;
    if (!geography && parsed.unmatchedPolicy === "reject") {
      throw new Error(`Entity "${entity.entityId}" has no exact geography match.`);
    }
    return {
      entityId: entity.entityId,
      decisionLayer: parsed.decisionLayer,
      joinVersion: parsed.joinVersion,
      joinStatus: geography ? "matched" as const : "unmatched" as const,
      entity: entity.payload,
      geographyId: geography?.geographyId ?? null,
      geography: geography?.payload ?? null,
      provenance: {
        entity: entity.provenance,
        geography: geography?.provenance ?? null,
      },
    };
  });
}

const eligibilityStateSchema = z.enum([
  "passed",
  "failed",
  "missing",
  "rejected",
]);
export const filterEligibleEntitiesInputSchema = operatorEnvelopeSchema.extend({
  policyVersion: versionSchema,
  entities: z.array(z.object({
    entityId: identifierSchema,
    criteria: z.array(z.object({
      criterionId: identifierSchema,
      state: eligibilityStateSchema,
      required: z.boolean(),
      provenance: provenanceSchema,
    }).strict()),
  }).strict()),
}).strict();
export type FilterEligibleEntitiesInput = z.infer<
  typeof filterEligibleEntitiesInputSchema
>;

export function filter_eligible_entities(input: FilterEligibleEntitiesInput) {
  const parsed = filterEligibleEntitiesInputSchema.parse(input);
  return parsed.entities.map((entity) => {
    const required = entity.criteria.filter((criterion) => criterion.required);
    const failed = required.filter((criterion) => criterion.state === "failed");
    const unresolved = required.filter(
      (criterion) =>
        criterion.state === "missing" || criterion.state === "rejected",
    );
    return {
      entityId: entity.entityId,
      decisionLayer: parsed.decisionLayer,
      policyVersion: parsed.policyVersion,
      eligibility:
        failed.length > 0
          ? "ineligible" as const
          : unresolved.length > 0
            ? "unknown" as const
            : "eligible" as const,
      failedCriterionIds: failed.map((criterion) => criterion.criterionId),
      unresolvedCriterionIds: unresolved.map(
        (criterion) => criterion.criterionId,
      ),
    };
  });
}

export const compareCohortInputSchema = operatorEnvelopeSchema.extend({
  comparisonVersion: versionSchema,
  cohortId: identifierSchema,
  direction: z.enum(["higher_is_better", "lower_is_better"]),
  entities: z.array(z.object({
    entityId: identifierSchema,
    cohortId: identifierSchema,
    value: z.number().finite(),
    provenance: provenanceSchema,
  }).strict()).min(1),
}).strict();
export type CompareCohortInput = z.infer<typeof compareCohortInputSchema>;

export function compare_cohort(input: CompareCohortInput) {
  const parsed = compareCohortInputSchema.parse(input);
  const ids = new Set<string>();
  for (const entity of parsed.entities) {
    if (ids.has(entity.entityId)) {
      throw new Error(`Duplicate cohort entity "${entity.entityId}".`);
    }
    ids.add(entity.entityId);
    if (entity.cohortId !== parsed.cohortId) {
      throw new Error("Cohort comparison cannot mix cohort identifiers.");
    }
  }
  const multiplier = parsed.direction === "higher_is_better" ? -1 : 1;
  return [...parsed.entities]
    .sort(
      (left, right) =>
        multiplier * (left.value - right.value) ||
        left.entityId.localeCompare(right.entityId),
    )
    .map((entity, index) => ({
      entityId: entity.entityId,
      cohortId: parsed.cohortId,
      decisionLayer: parsed.decisionLayer,
      comparisonVersion: parsed.comparisonVersion,
      value: entity.value,
      rank: index + 1,
      percentile: round(
        parsed.entities.length === 1
          ? 100
          : ((parsed.entities.length - 1 - index) /
              (parsed.entities.length - 1)) *
              100,
      ),
      provenance: entity.provenance,
    }));
}

const weightedMetricSchema = z.object({
  metricId: identifierSchema,
  normalizedValue: z.number().finite().min(0).max(100).nullable(),
  weight: z.number().finite().nonnegative(),
  included: z.boolean(),
  state: z.enum(["available", "missing", "rejected", "excluded"]),
  missingDataRule: z.enum(["fail_evaluation", "exclude_and_renormalize"]),
  provenance: provenanceSchema,
}).strict();

export const calculateWeightedResultInputSchema = operatorEnvelopeSchema.extend({
  formulaVersion: versionSchema,
  expectedWeightTotal: z.number().finite().positive(),
  metrics: z.array(weightedMetricSchema).min(1),
}).strict();
export type CalculateWeightedResultInput = z.infer<
  typeof calculateWeightedResultInputSchema
>;

export function calculate_weighted_result(input: CalculateWeightedResultInput) {
  const parsed = calculateWeightedResultInputSchema.parse(input);
  const configuredWeight = parsed.metrics.reduce(
    (total, metric) => total + (metric.included ? metric.weight : 0),
    0,
  );
  if (Math.abs(configuredWeight - parsed.expectedWeightTotal) > 1e-9) {
    throw new Error(
      `Included weights total ${round(configuredWeight)}; expected ${parsed.expectedWeightTotal}.`,
    );
  }
  const scoredWeight = parsed.metrics.reduce(
    (total, metric) =>
      metric.included &&
      metric.state === "available" &&
      metric.normalizedValue !== null
        ? total + metric.weight
        : total,
    0,
  );
  const blocksResult = parsed.metrics.some(
    (metric) =>
      metric.included &&
      metric.missingDataRule === "fail_evaluation" &&
      (metric.state !== "available" || metric.normalizedValue === null),
  );
  const status =
    scoredWeight > 0 && !blocksResult
      ? "calculated" as const
      : "not_calculated" as const;
  const contributions = parsed.metrics.map((metric) => ({
    metricId: metric.metricId,
    weight: metric.weight,
    contribution:
      status === "calculated" &&
      metric.included &&
      metric.state === "available" &&
      metric.normalizedValue !== null
        ? round((metric.normalizedValue * metric.weight) / scoredWeight)
        : null,
    provenance: metric.provenance,
  }));
  return {
    decisionLayer: parsed.decisionLayer,
    formulaVersion: parsed.formulaVersion,
    status,
    value:
      status === "calculated"
        ? round(
            contributions.reduce(
              (total, metric) => total + (metric.contribution ?? 0),
              0,
            ),
          )
        : null,
    configuredWeight: round(configuredWeight),
    scoredWeight: round(scoredWeight),
    contributions,
  };
}

export const runSensitivityInputSchema = operatorEnvelopeSchema.extend({
  sensitivityVersion: versionSchema,
  baseline: calculateWeightedResultInputSchema,
  scenarios: z.array(z.object({
    scenarioId: identifierSchema,
    scenarioVersion: versionSchema,
    weightOverrides: z.record(identifierSchema, z.number().finite().nonnegative()),
  }).strict()),
}).strict();
export type RunSensitivityInput = z.infer<typeof runSensitivityInputSchema>;

export function run_sensitivity(input: RunSensitivityInput) {
  const parsed = runSensitivityInputSchema.parse(input);
  if (parsed.baseline.decisionLayer !== parsed.decisionLayer) {
    throw new Error("Sensitivity cannot cross decision layers.");
  }
  const baselineResult = calculate_weighted_result(parsed.baseline);
  const scenarioIds = new Set<string>();
  return parsed.scenarios.map((scenario) => {
    if (scenarioIds.has(scenario.scenarioId)) {
      throw new Error(`Duplicate sensitivity scenario "${scenario.scenarioId}".`);
    }
    scenarioIds.add(scenario.scenarioId);
    const metricIds = new Set(parsed.baseline.metrics.map((metric) => metric.metricId));
    for (const metricId of Object.keys(scenario.weightOverrides)) {
      if (!metricIds.has(metricId)) {
        throw new Error(`Sensitivity scenario references unknown metric "${metricId}".`);
      }
    }
    const result = calculate_weighted_result({
      ...parsed.baseline,
      formulaVersion: scenario.scenarioVersion,
      metrics: parsed.baseline.metrics.map((metric) => ({
        ...metric,
        weight: scenario.weightOverrides[metric.metricId] ?? metric.weight,
      })),
    });
    return {
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      sensitivityVersion: parsed.sensitivityVersion,
      result,
      deltaFromBaseline:
        result.value === null || baselineResult.value === null
          ? null
          : round(result.value - baselineResult.value),
    };
  });
}

export const renderArtifactInputSchema = operatorEnvelopeSchema.extend({
  artifactId: identifierSchema,
  artifactVersion: versionSchema,
  renderer: z.enum([
    "structured_evaluation_result",
    "cohort_comparison",
    "evidence_brief",
    "action_packet",
  ]),
  allowedUse: identifierSchema,
  sensitivity: z.enum([
    "public",
    "internal",
    "confidential",
    "restricted",
  ]),
  payload: z.json(),
  provenance: provenanceSchema,
}).strict();
export type RenderArtifactInput = z.infer<typeof renderArtifactInputSchema>;

export function render_artifact(input: RenderArtifactInput) {
  const parsed = renderArtifactInputSchema.parse(input);
  return {
    artifactId: parsed.artifactId,
    artifactVersion: parsed.artifactVersion,
    renderer: parsed.renderer,
    decisionLayer: parsed.decisionLayer,
    allowedUse: parsed.allowedUse,
    sensitivity: parsed.sensitivity,
    payload: parsed.payload,
    provenance: parsed.provenance,
  };
}
