import { z } from "zod";
import type { ExecutionEvidenceItem } from "../evidence-snapshot/contracts.ts";

export const EVIDENCE_COMPATIBILITY_VERSION = "evidence-compatibility-v1" as const;

export const canonicalGeographyTypeSchema = z.enum([
  "zip",
  "cbsa",
  "dma",
  "trade_area",
  "drive_time",
  "customer_geography",
  "site",
  "state",
  "national",
  "unknown",
]);

export const crosswalkMetadataSchema = z.object({
  crosswalkId: z.string().trim().min(1),
  version: z.string().trim().min(1).nullable(),
  fromGeography: canonicalGeographyTypeSchema,
  toGeography: canonicalGeographyTypeSchema,
  approvalStatus: z.enum(["approved", "provisional", "missing"]),
  approvedBy: z.string().trim().min(1).nullable(),
  approvedAt: z.string().datetime().nullable(),
  method: z.enum(["exact_key", "weighted_allocation", "point_in_polygon", "source_provided", "unknown"]),
  coverage: z.object({
    inputCount: z.number().int().nonnegative(),
    matchedCount: z.number().int().nonnegative(),
    unmatchedCount: z.number().int().nonnegative(),
    coverageRate: z.number().min(0).max(1),
  }).strict(),
  unmatchedIds: z.array(z.string().trim().min(1)).max(100),
  allocation: z.object({
    mode: z.enum(["one_to_one", "one_to_many", "many_to_one", "many_to_many", "not_applicable", "unknown"]),
    weightBasis: z.string().trim().min(1).nullable(),
    weightsValidated: z.boolean().nullable(),
  }).strict(),
  notes: z.array(z.string().trim().min(1)),
}).strict().superRefine((value, ctx) => {
  if (value.coverage.matchedCount + value.coverage.unmatchedCount !== value.coverage.inputCount) {
    ctx.addIssue({ code: "custom", path: ["coverage"], message: "Matched and unmatched counts must equal the crosswalk input count." });
  }
  const expectedRate = value.coverage.inputCount === 0 ? 0 : value.coverage.matchedCount / value.coverage.inputCount;
  if (Math.abs(expectedRate - value.coverage.coverageRate) > 0.000001) {
    ctx.addIssue({ code: "custom", path: ["coverage", "coverageRate"], message: "Crosswalk coverage rate must match the supplied counts." });
  }
  if (value.approvalStatus === "approved" && (!value.version || !value.approvedBy || !value.approvedAt)) {
    ctx.addIssue({ code: "custom", path: ["approvalStatus"], message: "An approved crosswalk requires a version, approver, and approval time." });
  }
  if (value.approvalStatus !== "approved" && (value.approvedBy || value.approvedAt)) {
    ctx.addIssue({ code: "custom", path: ["approvedBy"], message: "A provisional or missing crosswalk cannot claim approval metadata." });
  }
});

export const compatibilityIssueSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum([
    "geography_crosswalk_missing",
    "geography_crosswalk_provisional",
    "geography_coverage_gap",
    "geography_allocation_unvalidated",
    "time_period_missing",
    "time_period_nonoverlap",
    "metric_definition_missing",
    "metric_definition_conflict",
    "unit_missing",
    "unit_conflict",
    "duplicate_observation",
    "missing_value",
    "contradiction",
  ]),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().trim().min(1),
  evidenceIds: z.array(z.string().trim().min(1)),
  sourceIds: z.array(z.string().trim().min(1)),
}).strict();

export const evidenceReconciliationReportSchema = z.object({
  version: z.literal(EVIDENCE_COMPATIBILITY_VERSION),
  status: z.enum(["compatible", "needs_review", "not_combinable"]),
  operation: z.enum(["compare", "join", "union"]),
  canCompare: z.boolean(),
  canCombine: z.boolean(),
  geographyTypes: z.array(canonicalGeographyTypeSchema),
  sourceIds: z.array(z.string().trim().min(1)),
  observationCount: z.number().int().nonnegative(),
  crosswalks: z.array(crosswalkMetadataSchema),
  issues: z.array(compatibilityIssueSchema),
  summary: z.object({
    errorCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    duplicateCount: z.number().int().nonnegative(),
    missingValueCount: z.number().int().nonnegative(),
    contradictionCount: z.number().int().nonnegative(),
  }).strict(),
  conclusionBoundary: z.string().trim().min(1),
}).strict();

export type CanonicalGeographyType = z.infer<typeof canonicalGeographyTypeSchema>;
export type CrosswalkMetadata = z.infer<typeof crosswalkMetadataSchema>;
export type EvidenceReconciliationReport = z.infer<typeof evidenceReconciliationReportSchema>;

type ReconciliationOptions = {
  operation?: "compare" | "join" | "union";
  crosswalks?: CrosswalkMetadata[];
  missingEvidence?: string[];
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function geographyType(item: ExecutionEvidenceItem): CanonicalGeographyType {
  const id = (item.geographyId ?? "").toLowerCase();
  const label = item.geographyLabel.toLowerCase();
  if (/^cbsa:/.test(id) || /\bcbsa\b/.test(label)) return "cbsa";
  if (/^dma:/.test(id) || /\bdma\b|designated market area/.test(label)) return "dma";
  if (/^zip:/.test(id) || /\bzip\b|postal/.test(label)) return "zip";
  if (/trade[_ -]?area/.test(id) || /trade area/.test(label)) return "trade_area";
  if (/drive[_ -]?time/.test(id) || /drive time/.test(label)) return "drive_time";
  if (/customer/.test(id) || /customer geography/.test(label)) return "customer_geography";
  if (/^site:/.test(id) || /\bsite\b/.test(label)) return "site";
  if (/^state:/.test(id) || /\bstate\b/.test(label)) return "state";
  if (id === "national" || /united states|national/.test(label)) return "national";
  return "unknown";
}

function metadataString(item: ExecutionEvidenceItem, keys: string[]) {
  if (!item.structuredValue) return null;
  for (const key of keys) {
    const value = item.structuredValue[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizedUnit(item: ExecutionEvidenceItem) {
  const unit = item.unit?.trim().toLowerCase().replaceAll(" ", "_") ?? null;
  if (!unit) return null;
  const aliases: Record<string, string> = {
    dollars: "currency_units",
    usd: "currency_units",
    dollar: "currency_units",
    percent: "percentage_points",
    percentage: "percentage_points",
  };
  return aliases[unit] ?? unit;
}

function overlap(left: ExecutionEvidenceItem, right: ExecutionEvidenceItem) {
  const leftStart = left.period.start;
  const leftEnd = left.period.end;
  const rightStart = right.period.start;
  const rightEnd = right.period.end;
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return null;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function geographyPair(left: CanonicalGeographyType, right: CanonicalGeographyType) {
  return [left, right].sort().join("::");
}

function issueKey(type: string, evidenceIds: string[], message: string) {
  return `${type}:${[...evidenceIds].sort().join("|")}:${message}`;
}

/**
 * Reconciles browser-safe structured evidence without silently translating a
 * geography, period, metric definition, or unit. This reports whether a
 * combined claim is supportable; it never prevents the investigation itself.
 */
export function reconcileEvidenceCompatibility(
  evidence: ExecutionEvidenceItem[],
  options: ReconciliationOptions = {},
): EvidenceReconciliationReport {
  const operation = options.operation ?? "compare";
  const crosswalks = (options.crosswalks ?? []).map((item) => crosswalkMetadataSchema.parse(item));
  const issues = new Map<string, z.infer<typeof compatibilityIssueSchema>>();
  const addIssue = (issue: Omit<z.infer<typeof compatibilityIssueSchema>, "id">) => {
    const key = issueKey(issue.type, issue.evidenceIds, issue.message);
    if (!issues.has(key)) issues.set(key, compatibilityIssueSchema.parse({ ...issue, id: `compat-${issues.size + 1}` }));
  };
  const types = unique(evidence.map(geographyType)) as CanonicalGeographyType[];
  const sourceIds = unique(evidence.map((item) => item.sourceId));

  if (operation === "join" && types.length > 1) {
    for (let leftIndex = 0; leftIndex < types.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < types.length; rightIndex += 1) {
        const left = types[leftIndex];
        const right = types[rightIndex];
        const crosswalk = crosswalks.find((item) => geographyPair(item.fromGeography, item.toGeography) === geographyPair(left, right));
        if (!crosswalk || crosswalk.approvalStatus === "missing") {
          addIssue({ type: "geography_crosswalk_missing", severity: "error", message: `No approved, versioned ${left}-to-${right} crosswalk is attached; these geographies must remain separate.`, evidenceIds: [], sourceIds });
          continue;
        }
        if (crosswalk.approvalStatus !== "approved") {
          addIssue({ type: "geography_crosswalk_provisional", severity: "error", message: `${crosswalk.crosswalkId} is provisional and cannot support a production ${left}-to-${right} join.`, evidenceIds: [], sourceIds });
        }
        if (crosswalk.coverage.unmatchedCount > 0 || crosswalk.coverage.coverageRate < 1) {
          addIssue({ type: "geography_coverage_gap", severity: "warning", message: `${crosswalk.crosswalkId} matched ${(crosswalk.coverage.coverageRate * 100).toFixed(1)}% and left ${crosswalk.coverage.unmatchedCount} record(s) unmatched.`, evidenceIds: [], sourceIds });
        }
        if (["one_to_many", "many_to_many"].includes(crosswalk.allocation.mode) && crosswalk.allocation.weightsValidated !== true) {
          addIssue({ type: "geography_allocation_unvalidated", severity: "error", message: `${crosswalk.crosswalkId} requires allocation, but its weights are not validated.`, evidenceIds: [], sourceIds });
        }
      }
    }
  }

  const duplicateKeys = new Map<string, ExecutionEvidenceItem[]>();
  for (const item of evidence) {
    const key = [item.sourceId, item.metricId, item.geographyId ?? item.geographyLabel, item.period.start, item.period.end, item.reportScope].join("|");
    duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), item]);
    if (item.rawValue === null) {
      addIssue({ type: "missing_value", severity: "warning", message: `${item.metricId} has no numeric value; its structured value may be descriptive but cannot enter arithmetic.`, evidenceIds: [item.evidenceId], sourceIds: [item.sourceId] });
    }
    if (item.period.kind === "not_provided" || (!item.period.start && !item.period.end)) {
      addIssue({ type: "time_period_missing", severity: "warning", message: `${item.metricId} does not have a bounded observation period.`, evidenceIds: [item.evidenceId], sourceIds: [item.sourceId] });
    }
    if (!normalizedUnit(item) && item.rawValue !== null) {
      addIssue({ type: "unit_missing", severity: "warning", message: `${item.metricId} has a numeric value without a comparable unit.`, evidenceIds: [item.evidenceId], sourceIds: [item.sourceId] });
    }
  }
  for (const duplicates of duplicateKeys.values()) {
    if (duplicates.length < 2) continue;
    addIssue({ type: "duplicate_observation", severity: "warning", message: `${duplicates.length} observations share the same source, metric, geography, period, and report scope; they must be deduplicated before aggregation.`, evidenceIds: duplicates.map((item) => item.evidenceId), sourceIds: unique(duplicates.map((item) => item.sourceId)) });
  }

  for (let leftIndex = 0; leftIndex < evidence.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < evidence.length; rightIndex += 1) {
      const left = evidence[leftIndex];
      const right = evidence[rightIndex];
      if (left.metricId !== right.metricId) continue;
      const sameGeography = (left.geographyId ?? left.geographyLabel) === (right.geographyId ?? right.geographyLabel);
      if (!sameGeography) continue;
      const pairEvidenceIds = [left.evidenceId, right.evidenceId];
      const pairSourceIds = unique([left.sourceId, right.sourceId]);
      const periodsOverlap = overlap(left, right);
      if (periodsOverlap === false) {
        addIssue({ type: "time_period_nonoverlap", severity: "warning", message: `${left.metricId} observations for ${left.geographyLabel} do not overlap in time and must not be described as concurrent.`, evidenceIds: pairEvidenceIds, sourceIds: pairSourceIds });
      }
      const leftDefinition = metadataString(left, ["metricDefinitionId", "definitionId"]);
      const rightDefinition = metadataString(right, ["metricDefinitionId", "definitionId"]);
      if (!leftDefinition || !rightDefinition) {
        addIssue({ type: "metric_definition_missing", severity: "warning", message: `${left.metricId} lacks a complete versioned definition across sources.`, evidenceIds: pairEvidenceIds, sourceIds: pairSourceIds });
      } else if (leftDefinition !== rightDefinition) {
        addIssue({ type: "metric_definition_conflict", severity: "error", message: `${left.metricId} uses conflicting definitions (${leftDefinition} versus ${rightDefinition}).`, evidenceIds: pairEvidenceIds, sourceIds: pairSourceIds });
      }
      const leftUnit = normalizedUnit(left);
      const rightUnit = normalizedUnit(right);
      if (leftUnit && rightUnit && leftUnit !== rightUnit) {
        addIssue({ type: "unit_conflict", severity: "error", message: `${left.metricId} uses incompatible units (${left.unit} versus ${right.unit}).`, evidenceIds: pairEvidenceIds, sourceIds: pairSourceIds });
      }
      if (left.rawValue !== null && right.rawValue !== null && leftUnit && leftUnit === rightUnit && periodsOverlap !== false) {
        const scale = Math.max(1, Math.abs(left.rawValue), Math.abs(right.rawValue));
        if (Math.abs(left.rawValue - right.rawValue) / scale > 0.000001) {
          addIssue({ type: "contradiction", severity: "warning", message: `${left.metricId} has different source values for the same geography and overlapping period (${left.rawValue} versus ${right.rawValue}); preserve both until definition, scope, and precedence are resolved.`, evidenceIds: pairEvidenceIds, sourceIds: pairSourceIds });
        }
      }
    }
  }

  for (const missing of unique(options.missingEvidence ?? [])) {
    addIssue({ type: "missing_value", severity: "warning", message: missing, evidenceIds: [], sourceIds });
  }

  const issueList = [...issues.values()];
  const errorCount = issueList.filter((item) => item.severity === "error").length;
  const warningCount = issueList.filter((item) => item.severity === "warning").length;
  const status = errorCount ? "not_combinable" : warningCount ? "needs_review" : "compatible";
  return evidenceReconciliationReportSchema.parse({
    version: EVIDENCE_COMPATIBILITY_VERSION,
    status,
    operation,
    canCompare: !issueList.some((item) => item.type === "unit_conflict" || item.type === "metric_definition_conflict"),
    canCombine: !errorCount,
    geographyTypes: types,
    sourceIds,
    observationCount: evidence.length,
    crosswalks,
    issues: issueList,
    summary: {
      errorCount,
      warningCount,
      duplicateCount: issueList.filter((item) => item.type === "duplicate_observation").length,
      missingValueCount: issueList.filter((item) => item.type === "missing_value").length,
      contradictionCount: issueList.filter((item) => item.type === "contradiction").length,
    },
    conclusionBoundary: errorCount
      ? "The investigation may continue, but incompatible evidence must remain separate and cannot support a combined production claim."
      : warningCount
        ? "The evidence can support a bounded comparison only while the listed reconciliation uncertainty remains visible."
        : "The supplied compatibility metadata does not identify a blocker to the requested bounded comparison.",
  });
}
