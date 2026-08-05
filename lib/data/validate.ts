import {
  EVIDENCE_STATUSES,
  GEOGRAPHIC_GRAINS,
  QUALITY_STATUSES,
  SENSITIVITIES,
  type CandidateSite,
  type CandidateValidationResult,
  type DataCoverageSummary,
  type GeographicGrain,
  type MetricDefinition,
  type MetricObservation,
  type ParsedRecords,
  type QualityStatus,
  type RecordKind,
  type RejectedInput,
  type Sensitivity,
  type SiteConstraint,
  type QualitativeEvidence,
  type ValidationBatchResult,
  type ValidationIssue,
  type ValidationOptions,
} from "./types.ts";
import { recordsFromCsv, recordsFromJson } from "./parsers.ts";
import type { CsvRecord, EvidenceStatus } from "./types.ts";

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const DAY_MS = 86_400_000;

type MutableContext = {
  issues: ValidationIssue[];
  rejectedInputs: RejectedInput[];
  candidateId?: string;
  recordIndex: number;
  allowedSourceIds: ReadonlySet<string>;
  options: ValidationOptions;
  staleMetricIds: Set<string>;
  warningMetricIds: Set<string>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  context: MutableContext,
  severity: ValidationIssue["severity"],
  code: string,
  field: string,
  kind: RecordKind,
  index: number,
  reason: string,
  id?: string,
) {
  context.issues.push({
    code,
    severity,
    field,
    record: {
      kind,
      index,
      id,
      candidateId: context.candidateId,
    },
    reason,
  });
}

function requiredString(
  input: Record<string, unknown>,
  field: string,
  context: MutableContext,
  kind: RecordKind,
  index: number,
  id?: string,
): string | null {
  const value = input[field];
  if (typeof value !== "string" || value.trim() === "") {
    issue(
      context,
      "error",
      "required_field",
      field,
      kind,
      index,
      `${field} must be a non-empty string.`,
      id,
    );
    return null;
  }
  return value.trim();
}

function stableId(
  input: Record<string, unknown>,
  field: string,
  context: MutableContext,
  kind: RecordKind,
  index: number,
): string | null {
  const value = requiredString(input, field, context, kind, index);
  if (value !== null && !STABLE_ID.test(value)) {
    issue(
      context,
      "error",
      "invalid_stable_id",
      field,
      kind,
      index,
      `${field} must use only letters, numbers, periods, underscores, colons, or hyphens.`,
      value,
    );
    return null;
  }
  return value;
}

function strictDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function dateField(
  input: Record<string, unknown>,
  field: string,
  context: MutableContext,
  kind: RecordKind,
  index: number,
  id?: string,
): string | null {
  const value = input[field];
  if (!strictDate(value)) {
    issue(
      context,
      "error",
      "invalid_date",
      field,
      kind,
      index,
      `${field} must be a real ISO 8601 calendar date in YYYY-MM-DD form.`,
      id,
    );
    return null;
  }
  return value;
}

function enumField<T extends string>(
  input: Record<string, unknown>,
  field: string,
  values: readonly T[],
  context: MutableContext,
  kind: RecordKind,
  index: number,
  id?: string,
): T | null {
  const value = input[field];
  if (typeof value !== "string" || !values.includes(value as T)) {
    issue(
      context,
      "error",
      "invalid_enum",
      field,
      kind,
      index,
      `${field} must be one of: ${values.join(", ")}.`,
      id,
    );
    return null;
  }
  return value as T;
}

function sourceId(
  input: Record<string, unknown>,
  context: MutableContext,
  kind: RecordKind,
  index: number,
  id?: string,
): string | null {
  const value = requiredString(
    input,
    "source_id",
    context,
    kind,
    index,
    id,
  );
  if (value !== null && !context.allowedSourceIds.has(value)) {
    issue(
      context,
      "error",
      "unknown_source_id",
      "source_id",
      kind,
      index,
      `source_id ${value} is not in the approved source registry.`,
      id,
    );
    return null;
  }
  return value;
}

function provenance(
  input: Record<string, unknown>,
  context: MutableContext,
  kind: RecordKind,
  index: number,
  id?: string,
) {
  const source_id = sourceId(input, context, kind, index, id);
  const observed_at = dateField(
    input,
    "observed_at",
    context,
    kind,
    index,
    id,
  );
  const geography = enumField(
    input,
    "geography",
    GEOGRAPHIC_GRAINS,
    context,
    kind,
    index,
    id,
  );
  const quality_status = enumField(
    input,
    "quality_status",
    QUALITY_STATUSES,
    context,
    kind,
    index,
    id,
  );
  const sensitivity = enumField(
    input,
    "sensitivity",
    SENSITIVITIES,
    context,
    kind,
    index,
    id,
  );
  const transformation =
    typeof input.transformation === "string" && input.transformation.trim()
      ? input.transformation.trim()
      : undefined;

  if (quality_status === "warning") {
    issue(
      context,
      "warning",
      "quality_warning",
      "quality_status",
      kind,
      index,
      "The source marked this record with a quality warning.",
      id,
    );
  } else if (quality_status === "rejected") {
    issue(
      context,
      "info",
      "source_rejected",
      "quality_status",
      kind,
      index,
      "The source marked this record as rejected; it is retained for audit only.",
      id,
    );
  }

  if (sensitivity === "restricted") {
    issue(
      context,
      "error",
      "restricted_data",
      "sensitivity",
      kind,
      index,
      "Restricted data is not allowed in this prototype.",
      id,
    );
  }

  return {
    source_id,
    observed_at,
    geography,
    quality_status,
    sensitivity,
    transformation,
  };
}

function recordErrors(
  issues: readonly ValidationIssue[],
  kind: RecordKind,
  index: number,
): ValidationIssue[] {
  return issues.filter(
    (item) =>
      item.severity === "error" &&
      item.record.kind === kind &&
      item.record.index === index,
  );
}

function rejection(
  context: MutableContext,
  kind: Exclude<RecordKind, "csv_row">,
  index: number,
  id: string | undefined,
  input: unknown,
  reasons: string[],
) {
  const existing = context.rejectedInputs.find(
    (item) => item.kind === kind && item.index === index,
  );
  if (existing) {
    existing.reasons = [...new Set([...existing.reasons, ...reasons])];
    return;
  }
  context.rejectedInputs.push({ kind, index, id, input, reasons });
}

function validateMetric(
  input: unknown,
  index: number,
  evaluationDate: string | null,
  context: MutableContext,
): MetricObservation | null {
  if (!isObject(input)) {
    issue(
      context,
      "error",
      "invalid_type",
      "metrics",
      "metric",
      index,
      "Metric record must be an object.",
    );
    rejection(context, "metric", index, undefined, input, [
      "Metric record must be an object.",
    ]);
    return null;
  }

  const metric_id = stableId(input, "metric_id", context, "metric", index);
  const unit = requiredString(
    input,
    "unit",
    context,
    "metric",
    index,
    metric_id ?? undefined,
  );
  const rawValue = input.raw_value;
  if (
    rawValue !== null &&
    (typeof rawValue !== "number" || !Number.isFinite(rawValue))
  ) {
    issue(
      context,
      "error",
      "invalid_type",
      "raw_value",
      "metric",
      index,
      "raw_value must be a finite number or null. null means missing.",
      metric_id ?? undefined,
    );
  } else if (rawValue === null) {
    issue(
      context,
      "info",
      "missing_value",
      "raw_value",
      "metric",
      index,
      "raw_value is missing and remains null; it is not converted to zero.",
      metric_id ?? undefined,
    );
  } else if (rawValue === 0) {
    issue(
      context,
      "info",
      "zero_value",
      "raw_value",
      "metric",
      index,
      "raw_value is an observed numeric zero, not a missing value.",
      metric_id ?? undefined,
    );
  }

  const details = provenance(
    input,
    context,
    "metric",
    index,
    metric_id ?? undefined,
  );
  const definition =
    metric_id === null ? undefined : context.options.metricDefinitions[metric_id];

  if (metric_id !== null && !definition) {
    issue(
      context,
      "error",
      "unknown_metric_id",
      "metric_id",
      "metric",
      index,
      `metric_id ${metric_id} is not in the supplied metric catalog.`,
      metric_id,
    );
  }

  if (definition && unit !== null && unit !== definition.unit) {
    issue(
      context,
      "error",
      "invalid_unit",
      "unit",
      "metric",
      index,
      `Expected unit ${definition.unit} for ${definition.metricId}; received ${unit}.`,
      metric_id ?? undefined,
    );
  }
  if (definition && typeof rawValue === "number" && Number.isFinite(rawValue)) {
    validateRange(rawValue, definition, context, index);
  }
  if (
    definition &&
    details.geography &&
    !definition.allowedGeographies.includes(details.geography)
  ) {
    issue(
      context,
      "error",
      "invalid_geographic_grain",
      "geography",
      "metric",
      index,
      `Geography ${details.geography} is not allowed for ${definition.metricId}.`,
      metric_id ?? undefined,
    );
  }
  if (definition && details.observed_at && evaluationDate) {
    const ageDays =
      (Date.parse(`${evaluationDate}T00:00:00Z`) -
        Date.parse(`${details.observed_at}T00:00:00Z`)) /
      DAY_MS;
    if (ageDays < 0) {
      issue(
        context,
        "error",
        "future_observation",
        "observed_at",
        "metric",
        index,
        "observed_at cannot be after the candidate evaluation_date.",
        metric_id ?? undefined,
      );
    } else if (ageDays > definition.freshnessDays) {
      issue(
        context,
        "warning",
        "stale_observation",
        "observed_at",
        "metric",
        index,
        `Observation is ${ageDays} days old; the configured threshold is ${definition.freshnessDays} days.`,
        metric_id ?? undefined,
      );
      if (metric_id) context.staleMetricIds.add(metric_id);
    }
  }

  if (details.quality_status === "warning" && metric_id) {
    context.warningMetricIds.add(metric_id);
  }

  const errors = recordErrors(context.issues, "metric", index);
  const rejectedBySource = details.quality_status === "rejected";
  if (errors.length > 0 || rejectedBySource) {
    rejection(
      context,
      "metric",
      index,
      metric_id ?? undefined,
      input,
      rejectedBySource
        ? ["quality_status is rejected.", ...errors.map((item) => item.reason)]
        : errors.map((item) => item.reason),
    );
  }

  if (
    metric_id === null ||
    unit === null ||
    typeof rawValue !== "number" && rawValue !== null ||
    details.source_id === null ||
    details.observed_at === null ||
    details.geography === null ||
    details.quality_status === null ||
    details.sensitivity === null
  ) {
    return null;
  }

  return {
    metric_id,
    raw_value: rawValue,
    unit,
    source_id: details.source_id,
    observed_at: details.observed_at,
    geography: details.geography,
    quality_status: details.quality_status,
    sensitivity: details.sensitivity,
    ...(details.transformation
      ? { transformation: details.transformation }
      : {}),
  };
}

function validateRange(
  value: number,
  definition: MetricDefinition,
  context: MutableContext,
  index: number,
) {
  if (definition.minimum !== undefined && value < definition.minimum) {
    issue(
      context,
      "error",
      "out_of_range",
      "raw_value",
      "metric",
      index,
      `raw_value must be at least ${definition.minimum}.`,
      definition.metricId,
    );
  }
  if (definition.maximum !== undefined && value > definition.maximum) {
    issue(
      context,
      "error",
      "out_of_range",
      "raw_value",
      "metric",
      index,
      `raw_value must be at most ${definition.maximum}.`,
      definition.metricId,
    );
  }
}

function validateEvidence(
  input: unknown,
  index: number,
  context: MutableContext,
): QualitativeEvidence | null {
  if (!isObject(input)) {
    issue(
      context,
      "error",
      "invalid_type",
      "qualitative_evidence",
      "qualitative_evidence",
      index,
      "Qualitative evidence must be an object.",
    );
    rejection(context, "qualitative_evidence", index, undefined, input, [
      "Qualitative evidence must be an object.",
    ]);
    return null;
  }
  const evidence_id = stableId(
    input,
    "evidence_id",
    context,
    "qualitative_evidence",
    index,
  );
  const summary = requiredString(
    input,
    "summary",
    context,
    "qualitative_evidence",
    index,
    evidence_id ?? undefined,
  );
  const evidence_status = enumField(
    input,
    "evidence_status",
    EVIDENCE_STATUSES,
    context,
    "qualitative_evidence",
    index,
    evidence_id ?? undefined,
  );
  const details = provenance(
    input,
    context,
    "qualitative_evidence",
    index,
    evidence_id ?? undefined,
  );
  const errors = recordErrors(context.issues, "qualitative_evidence", index);
  if (errors.length || details.quality_status === "rejected") {
    rejection(
      context,
      "qualitative_evidence",
      index,
      evidence_id ?? undefined,
      input,
      errors.length
        ? errors.map((item) => item.reason)
        : ["quality_status is rejected."],
    );
  }
  if (
    !evidence_id ||
    !summary ||
    !evidence_status ||
    !details.source_id ||
    !details.observed_at ||
    !details.geography ||
    !details.quality_status ||
    !details.sensitivity
  ) {
    return null;
  }
  return {
    evidence_id,
    summary,
    source_id: details.source_id,
    evidence_status,
    observed_at: details.observed_at,
    geography: details.geography,
    quality_status: details.quality_status,
    sensitivity: details.sensitivity,
    ...(details.transformation
      ? { transformation: details.transformation }
      : {}),
  };
}

function validateConstraint(
  input: unknown,
  index: number,
  context: MutableContext,
): SiteConstraint | null {
  if (!isObject(input)) {
    issue(
      context,
      "error",
      "invalid_type",
      "constraints",
      "constraint",
      index,
      "Constraint must be an object.",
    );
    rejection(context, "constraint", index, undefined, input, [
      "Constraint must be an object.",
    ]);
    return null;
  }
  const constraint_id = stableId(
    input,
    "constraint_id",
    context,
    "constraint",
    index,
  );
  const status = enumField(
    input,
    "status",
    ["pass", "fail", "unknown"] as const,
    context,
    "constraint",
    index,
    constraint_id ?? undefined,
  );
  const evidence_status = enumField(
    input,
    "evidence_status",
    EVIDENCE_STATUSES,
    context,
    "constraint",
    index,
    constraint_id ?? undefined,
  );
  const notes =
    typeof input.notes === "string" && input.notes.trim()
      ? input.notes.trim()
      : undefined;
  const details = provenance(
    input,
    context,
    "constraint",
    index,
    constraint_id ?? undefined,
  );
  const errors = recordErrors(context.issues, "constraint", index);
  if (errors.length || details.quality_status === "rejected") {
    rejection(
      context,
      "constraint",
      index,
      constraint_id ?? undefined,
      input,
      errors.length
        ? errors.map((item) => item.reason)
        : ["quality_status is rejected."],
    );
  }
  if (
    !constraint_id ||
    !status ||
    !evidence_status ||
    !details.source_id ||
    !details.observed_at ||
    !details.geography ||
    !details.quality_status ||
    !details.sensitivity
  ) {
    return null;
  }
  return {
    constraint_id,
    status,
    ...(notes ? { notes } : {}),
    source_id: details.source_id,
    evidence_status,
    observed_at: details.observed_at,
    geography: details.geography,
    quality_status: details.quality_status,
    sensitivity: details.sensitivity,
    ...(details.transformation
      ? { transformation: details.transformation }
      : {}),
  };
}

function duplicateRawIndexes(
  items: readonly unknown[],
  idField: string,
): Map<number, string> {
  const indexes = new Map<string, number[]>();
  items.forEach((item, index) => {
    if (!isObject(item) || typeof item[idField] !== "string") return;
    const key = item[idField].trim();
    if (!key) return;
    indexes.set(key, [...(indexes.get(key) ?? []), index]);
  });
  const duplicates = new Map<number, string>();
  for (const [id, matches] of indexes) {
    if (matches.length > 1) {
      for (const index of matches) duplicates.set(index, id);
    }
  }
  return duplicates;
}

function coverage(
  expectedIds: readonly string[],
  metrics: readonly MetricObservation[],
  eligibleMetrics: readonly MetricObservation[],
  rejectedMetricCount: number,
  context: MutableContext,
): DataCoverageSummary {
  const observedIds = new Set(metrics.map((metric) => metric.metric_id));
  const expectedSet = new Set(expectedIds);
  const available = eligibleMetrics.filter(
    (metric) =>
      metric.raw_value !== null &&
      (expectedSet.size === 0 || expectedSet.has(metric.metric_id)),
  );
  const missingMetricIds = expectedIds.filter((id) => {
    const match = eligibleMetrics.find((metric) => metric.metric_id === id);
    return !match || match.raw_value === null;
  });
  const denominator = expectedIds.length;
  return {
    expectedMetricCount: denominator,
    observedMetricCount: observedIds.size,
    availableMetricCount: available.length,
    missingValueCount: metrics.filter((metric) => metric.raw_value === null).length,
    zeroValueCount: metrics.filter((metric) => metric.raw_value === 0).length,
    rejectedMetricCount,
    staleMetricCount: context.staleMetricIds.size,
    warningMetricCount: context.warningMetricIds.size,
    coveragePercent:
      denominator === 0
        ? 100
        : Math.round((available.length / denominator) * 10_000) / 100,
    missingMetricIds,
  };
}

function emptyCoverage(expectedIds: readonly string[]): DataCoverageSummary {
  return {
    expectedMetricCount: expectedIds.length,
    observedMetricCount: 0,
    availableMetricCount: 0,
    missingValueCount: 0,
    zeroValueCount: 0,
    rejectedMetricCount: 0,
    staleMetricCount: 0,
    warningMetricCount: 0,
    coveragePercent: expectedIds.length === 0 ? 100 : 0,
    missingMetricIds: [...expectedIds],
  };
}

function validateCandidate(
  input: unknown,
  recordIndex: number,
  options: ValidationOptions,
): CandidateValidationResult {
  const allowedSourceIds =
    options.allowedSourceIds instanceof Set
      ? options.allowedSourceIds
      : new Set(options.allowedSourceIds);
  const expectedIds =
    options.expectedMetricIds ?? Object.keys(options.metricDefinitions).sort();
  const context: MutableContext = {
    issues: [],
    rejectedInputs: [],
    recordIndex,
    allowedSourceIds,
    options,
    staleMetricIds: new Set(),
    warningMetricIds: new Set(),
  };

  if (!isObject(input)) {
    issue(
      context,
      "error",
      "invalid_type",
      "$",
      "candidate",
      recordIndex,
      "Candidate record must be an object.",
    );
    rejection(context, "candidate", recordIndex, undefined, input, [
      "Candidate record must be an object.",
    ]);
    return {
      recordIndex,
      input,
      candidate: null,
      scoringCandidate: null,
      acceptedForScoring: false,
      issues: context.issues,
      rejectedInputs: context.rejectedInputs,
      coverage: emptyCoverage(expectedIds),
    };
  }

  const site_id = stableId(input, "site_id", context, "candidate", recordIndex);
  context.candidateId = site_id ?? undefined;
  const site_name = requiredString(
    input,
    "site_name",
    context,
    "candidate",
    recordIndex,
    site_id ?? undefined,
  );
  const evaluation_date = dateField(
    input,
    "evaluation_date",
    context,
    "candidate",
    recordIndex,
    site_id ?? undefined,
  );
  if (
    evaluation_date &&
    options.asOfDate &&
    strictDate(options.asOfDate) &&
    evaluation_date > options.asOfDate
  ) {
    issue(
      context,
      "error",
      "future_evaluation",
      "evaluation_date",
      "candidate",
      recordIndex,
      "evaluation_date cannot be after the configured asOfDate.",
      site_id ?? undefined,
    );
  }

  const coordinates: { latitude?: number; longitude?: number } = {};
  for (const [field, minimum, maximum] of [
    ["latitude", -90, 90],
    ["longitude", -180, 180],
  ] as const) {
    const value = input[field];
    if (value !== undefined) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < minimum ||
        value > maximum
      ) {
        issue(
          context,
          "error",
          "out_of_range",
          field,
          "candidate",
          recordIndex,
          `${field} must be a finite number from ${minimum} to ${maximum}.`,
          site_id ?? undefined,
        );
      } else {
        coordinates[field] = value;
      }
    }
  }

  const metricInputs = Array.isArray(input.metrics) ? input.metrics : [];
  if (!Array.isArray(input.metrics)) {
    issue(
      context,
      "error",
      "invalid_type",
      "metrics",
      "candidate",
      recordIndex,
      "metrics must be an array.",
      site_id ?? undefined,
    );
  }
  const validatedMetrics = metricInputs.map((metric, index) =>
    validateMetric(metric, index, evaluation_date, context),
  );
  const metrics = validatedMetrics.filter(
    (metric): metric is MetricObservation => metric !== null,
  );

  const evidenceInputs =
    input.qualitative_evidence === undefined
      ? []
      : Array.isArray(input.qualitative_evidence)
        ? input.qualitative_evidence
        : [];
  if (
    input.qualitative_evidence !== undefined &&
    !Array.isArray(input.qualitative_evidence)
  ) {
    issue(
      context,
      "error",
      "invalid_type",
      "qualitative_evidence",
      "candidate",
      recordIndex,
      "qualitative_evidence must be an array.",
      site_id ?? undefined,
    );
  }
  const qualitative_evidence = evidenceInputs
    .map((item, index) => validateEvidence(item, index, context))
    .filter((item): item is QualitativeEvidence => item !== null);

  const constraintInputs =
    input.constraints === undefined
      ? []
      : Array.isArray(input.constraints)
        ? input.constraints
        : [];
  if (
    input.constraints !== undefined &&
    !Array.isArray(input.constraints)
  ) {
    issue(
      context,
      "error",
      "invalid_type",
      "constraints",
      "candidate",
      recordIndex,
      "constraints must be an array.",
      site_id ?? undefined,
    );
  }
  const constraints = constraintInputs
    .map((item, index) => validateConstraint(item, index, context))
    .filter((item): item is SiteConstraint => item !== null);

  const duplicateMetricIndexes = duplicateRawIndexes(metricInputs, "metric_id");
  const duplicateEvidenceIndexes = duplicateRawIndexes(
    evidenceInputs,
    "evidence_id",
  );
  const duplicateConstraintIndexes = duplicateRawIndexes(
    constraintInputs,
    "constraint_id",
  );

  for (const [index, metricId] of duplicateMetricIndexes) {
    issue(
      context,
      "error",
      "duplicate_record",
      "metric_id",
      "metric",
      index,
      `Duplicate metric_id ${metricId}; all copies are excluded from scoring.`,
      metricId,
    );
    rejection(context, "metric", index, metricId, metricInputs[index], [
      `Duplicate metric_id ${metricId}.`,
    ]);
  }
  for (const [index, evidenceId] of duplicateEvidenceIndexes) {
    issue(
      context,
      "error",
      "duplicate_record",
      "evidence_id",
      "qualitative_evidence",
      index,
      `Duplicate evidence_id ${evidenceId}.`,
      evidenceId,
    );
    rejection(
      context,
      "qualitative_evidence",
      index,
      evidenceId,
      evidenceInputs[index],
      [`Duplicate evidence_id ${evidenceId}.`],
    );
  }
  for (const [index, constraintId] of duplicateConstraintIndexes) {
    issue(
      context,
      "error",
      "duplicate_record",
      "constraint_id",
      "constraint",
      index,
      `Duplicate constraint_id ${constraintId}.`,
      constraintId,
    );
    rejection(
      context,
      "constraint",
      index,
      constraintId,
      constraintInputs[index],
      [`Duplicate constraint_id ${constraintId}.`],
    );
  }

  const candidateErrors = recordErrors(
    context.issues,
    "candidate",
    recordIndex,
  );
  const candidate =
    site_id && site_name && evaluation_date
      ? {
          site_id,
          site_name,
          ...coordinates,
          evaluation_date,
          metrics,
          qualitative_evidence,
          constraints,
        }
      : null;
  if (candidateErrors.length) {
    rejection(
      context,
      "candidate",
      recordIndex,
      site_id ?? undefined,
      input,
      candidateErrors.map((item) => item.reason),
    );
  }

  const rejectedMetricKeys = new Set(
    context.rejectedInputs
      .filter((item) => item.kind === "metric")
      .map((item) => `${item.index}:${item.id ?? ""}`),
  );
  const eligibleMetrics = validatedMetrics.flatMap((metric, index) => {
    if (
      metric === null ||
      rejectedMetricKeys.has(`${index}:${metric.metric_id}`) ||
      metric.quality_status === "rejected"
    ) {
      return [];
    }
    return [metric];
  });
  const hasAvailableMetric = eligibleMetrics.some(
    (metric) => metric.raw_value !== null,
  );
  if (candidate && candidateErrors.length === 0 && !hasAvailableMetric) {
    issue(
      context,
      "error",
      "no_available_metric",
      "metrics",
      "candidate",
      recordIndex,
      "Candidate has no validated, non-rejected metric value available for scoring.",
      site_id ?? undefined,
    );
  }
  const scoringCandidate =
    candidate && candidateErrors.length === 0 && hasAvailableMetric
      ? { ...candidate, metrics: eligibleMetrics }
      : null;
  const candidateCoverage = coverage(
    expectedIds,
    metrics,
    eligibleMetrics,
    context.rejectedInputs.filter((item) => item.kind === "metric").length,
    context,
  );

  return {
    recordIndex,
    candidateId: site_id ?? undefined,
    input,
    candidate,
    scoringCandidate,
    acceptedForScoring: scoringCandidate !== null,
    issues: context.issues,
    rejectedInputs: context.rejectedInputs,
    coverage: candidateCoverage,
  };
}

function validateParsed(
  parsed: ParsedRecords,
  options: ValidationOptions,
): ValidationBatchResult {
  const candidates = parsed.records.map((record, index) =>
    validateCandidate(record, index, options),
  );
  const firstIndexById = new Map<string, number>();
  for (const candidate of candidates) {
    if (!candidate.candidateId) continue;
    const firstIndex = firstIndexById.get(candidate.candidateId);
    if (firstIndex === undefined) {
      firstIndexById.set(candidate.candidateId, candidate.recordIndex);
      continue;
    }
    const duplicateIssue: ValidationIssue = {
      code: "duplicate_record",
      severity: "error",
      field: "site_id",
      record: {
        kind: "candidate",
        index: candidate.recordIndex,
        id: candidate.candidateId,
        candidateId: candidate.candidateId,
      },
      reason: `Duplicate site_id ${candidate.candidateId}; first seen at candidate index ${firstIndex}.`,
    };
    candidate.issues.push(duplicateIssue);
    candidate.rejectedInputs.push({
      kind: "candidate",
      index: candidate.recordIndex,
      id: candidate.candidateId,
      input: candidate.input,
      reasons: [duplicateIssue.reason],
    });
    candidate.scoringCandidate = null;
    candidate.acceptedForScoring = false;
  }

  const issues = [...parsed.issues, ...candidates.flatMap((item) => item.issues)];
  const scoringCandidates = candidates
    .map((item) => item.scoringCandidate)
    .filter((item): item is CandidateSite => item !== null);
  return {
    valid: issues.every((item) => item.severity !== "error"),
    candidates,
    scoringCandidates,
    issues,
    summary: {
      candidateCount: candidates.length,
      scoringCandidateCount: scoringCandidates.length,
      errorCount: issues.filter((item) => item.severity === "error").length,
      warningCount: issues.filter((item) => item.severity === "warning").length,
      infoCount: issues.filter((item) => item.severity === "info").length,
    },
  };
}

export function validateJsonInput(
  input: unknown,
  options: ValidationOptions,
): ValidationBatchResult {
  return validateParsed(recordsFromJson(input), options);
}

export function validateCsvRecords(
  rows: readonly CsvRecord[],
  options: ValidationOptions,
): ValidationBatchResult {
  return validateParsed(recordsFromCsv(rows), options);
}

export type {
  EvidenceStatus,
  GeographicGrain,
  QualityStatus,
  Sensitivity,
};
