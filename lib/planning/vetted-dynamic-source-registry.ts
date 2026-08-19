import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  discoveredAggregateQuerySchema,
  validatedDiscoveredSourceContractSchema,
  type DiscoveredAggregateQueryResponse,
} from "../discovered-evidence-query/contracts.ts";
import { executeDiscoveredAggregateQuery } from "../discovered-evidence-query/execute.ts";
import { evidenceExecutionResponseSchema, type EvidenceExecutionResponse } from "../evidence-snapshot/contracts.ts";
import { vettedDynamicResearchPassSchema, type VettedDynamicResearchPass } from "./agentic-evidence-loop.ts";
import type { EvaluationPlan } from "./contracts.ts";

export const VETTED_DYNAMIC_SOURCE_REGISTRY_VERSION = "vetted-dynamic-source-registry-v1" as const;
const REGISTRY_RELATIVE_PATH = "data/contracts/vetted-dynamic-source-registry.json";

const metricMappingSchema = z.object({
  field: z.string().trim().min(1),
  aggregation: z.enum(["sum", "average", "minimum", "maximum", "count_non_null", "distinct_count"]),
  metricId: z.string().trim().min(1),
  currency: z.string().length(3).nullable().default(null),
}).strict();

const registryEntrySchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{1,79}$/),
  label: z.string().trim().min(3).max(160),
  sourceFamily: z.enum(["census", "regional", "clinic", "google_ads", "consumer_insights", "pricing", "other"]),
  relevanceScore: z.number().int().min(0).max(100),
  addressesCriterionIds: z.array(z.string().trim().min(1).max(100)).max(12),
  dedupeKey: z.string().trim().min(1).max(120),
  compatibilityStatus: z.enum(["compatible", "compatible_with_limits"]),
  allowedUse: z.enum(["internal_decision_support", "internal_shadow_evaluation", "synthetic_prototype"]),
  perspectiveIds: z.array(z.enum(["pricing", "marketing", "cvc"])).min(1),
  topics: z.array(z.string().trim().min(1)).min(1),
  geographyGrains: z.array(z.enum(["cbsa", "submarket", "site", "portfolio"])).min(1),
  contract: validatedDiscoveredSourceContractSchema,
  query: discoveredAggregateQuerySchema,
  mapping: z.object({
    geographyDimension: z.string().trim().min(1),
    geographyPrefix: z.string().trim().min(1),
    geographyLabelPrefix: z.string().trim().min(1),
    timeDimension: z.string().trim().min(1).nullable(),
    reportScope: z.string().trim().min(1).max(160),
    metrics: z.array(metricMappingSchema).min(1),
  }).strict(),
}).strict().superRefine((entry, ctx) => {
  if (entry.query.contractId !== entry.contract.contractId) ctx.addIssue({ code: "custom", path: ["query", "contractId"], message: "Query and reviewed contract IDs must match." });
  if (!entry.query.dimensions.includes(entry.mapping.geographyDimension)) ctx.addIssue({ code: "custom", path: ["mapping", "geographyDimension"], message: "The geography mapping must reference a returned aggregate dimension." });
  if (entry.mapping.timeDimension && !entry.query.dimensions.includes(entry.mapping.timeDimension)) ctx.addIssue({ code: "custom", path: ["mapping", "timeDimension"], message: "The time mapping must reference a returned aggregate dimension." });
  for (const [index, metric] of entry.mapping.metrics.entries()) {
    if (!entry.query.measures.some((measure) => measure.field === metric.field && measure.aggregation === metric.aggregation)) {
      ctx.addIssue({ code: "custom", path: ["mapping", "metrics", index], message: "Every metric mapping must reference an allowlisted requested aggregate." });
    }
  }
});

export const vettedDynamicSourceRegistrySchema = z.object({
  version: z.literal(VETTED_DYNAMIC_SOURCE_REGISTRY_VERSION),
  approvedRoots: z.array(z.string().trim().min(1)).min(1),
  entries: z.array(registryEntrySchema),
}).strict();

export type VettedDynamicSourceRegistry = z.infer<typeof vettedDynamicSourceRegistrySchema>;
type RegistryEntry = z.infer<typeof registryEntrySchema>;

export type VettedDynamicSourceRuntime = {
  candidateResearchPasses: VettedDynamicResearchPass[];
  executeCandidatePass: (
    candidate: VettedDynamicResearchPass,
    input: { requestId: string; plan: EvaluationPlan },
  ) => Promise<EvidenceExecutionResponse>;
};

function eligible(entry: RegistryEntry, plan: EvaluationPlan) {
  return entry.perspectiveIds.includes(plan.perspectiveId)
    && entry.topics.includes(plan.intent.topic)
    && entry.geographyGrains.includes(plan.geographyGrain);
}

function candidateFor(entry: RegistryEntry): VettedDynamicResearchPass {
  return vettedDynamicResearchPassSchema.parse({
    id: entry.id,
    label: entry.label,
    sourceFamily: entry.sourceFamily,
    sourceIds: [entry.contract.sourceId],
    relevanceScore: entry.relevanceScore,
    addressesCriterionIds: entry.addressesCriterionIds,
    dedupeKey: entry.dedupeKey,
    compatibilityStatus: entry.compatibilityStatus,
    allowedUse: entry.allowedUse,
    vetted: true,
    browserSafeAggregateOnly: true,
    executesMaterialAction: false,
  });
}

function periodFor(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return { kind: "not_provided" as const, start: null, end: null, label: "Period not provided" };
  const label = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(label) ? label : null;
  return { kind: date ? "as_of" as const : "not_provided" as const, start: date, end: date, label };
}

function mapAggregateResponse(entry: RegistryEntry, result: DiscoveredAggregateQueryResponse, input: { requestId: string; plan: EvaluationPlan }): EvidenceExecutionResponse {
  const warnings = [...new Set(result.quality.warnings)];
  const evidenceBundle = result.rows.flatMap((row) => entry.mapping.metrics.map((mapping) => {
    const measure = row.measures.find((item) => item.field === mapping.field && item.aggregation === mapping.aggregation);
    if (!measure) return null;
    const geographyValue = row.dimensions[entry.mapping.geographyDimension];
    const geographyText = geographyValue === null ? "Unknown" : String(geographyValue);
    const period = periodFor(entry.mapping.timeDimension ? row.dimensions[entry.mapping.timeDimension] : null);
    const key = JSON.stringify([entry.id, row.dimensions, mapping.field, mapping.aggregation]);
    return {
      evidenceId: `dynamic-${createHash("sha256").update(key).digest("hex").slice(0, 24)}`,
      metricId: mapping.metricId,
      geographyId: geographyValue === null ? null : `${entry.mapping.geographyPrefix}:${geographyText}`,
      geographyLabel: geographyValue === null ? "Unknown geography" : `${entry.mapping.geographyLabelPrefix} ${geographyText}`,
      rawValue: measure.rawValue,
      structuredValue: {
        aggregation: measure.aggregation,
        nonNullCount: measure.nonNullCount,
        contributingRowCount: row.contributingRowCount,
        dimensions: row.dimensions,
        reviewedSourceContract: {
          contractId: result.provenance.contractId,
          reviewedBy: result.provenance.reviewedBy,
          reviewedAt: result.provenance.reviewedAt,
          fullFileValidationVersion: result.provenance.fullFileValidationVersion,
          semanticSourceContractVersion: result.provenance.semanticSourceContractVersion,
          validatedRowCount: result.provenance.validatedRowCount,
          sourceRowsRead: result.sourceRowsRead,
          sourceRowsMatched: result.sourceRowsMatched,
          sourceRowsTruncated: result.sourceRowsTruncated,
          resultLimitReached: result.resultLimitReached,
          suppressedGroupCount: result.suppressedGroupCount,
          rawRowsReturned: result.rawRowsReturned,
        },
      },
      unit: measure.unit,
      sourceId: result.sourceId,
      snapshotId: result.provenance.sha256,
      evidenceStatus: "Reported" as const,
      qualityStatus: warnings.length || measure.rawValue === null ? "warning" as const : "accepted" as const,
      observationStart: period.start,
      observationEnd: period.end,
      period,
      reportScope: entry.mapping.reportScope,
      currency: mapping.currency,
      allowedUse: result.provenance.allowedUse,
      sensitivity: result.provenance.sensitivity,
      warning: measure.rawValue === null ? `No non-null ${mapping.field} values contributed to this aggregate.` : warnings.join(" ") || null,
      origin: "frozen_csv_snapshot" as const,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null));
  const missingEvidence = evidenceBundle.filter((item) => item.rawValue === null).map((item) => `${item.metricId} is null for ${item.geographyLabel} (${item.period.label}).`);
  return evidenceExecutionResponseSchema.parse({
    requestId: input.requestId,
    status: result.status,
    snapshotVersion: `discovered-${result.provenance.sha256.slice(0, 16)}`,
    queryVersion: result.version,
    calculationVersion: null,
    query: "normalized_evidence_bundle",
    componentQueries: [],
    capability: input.plan.capabilityId,
    planId: input.plan.planId,
    originalQuestion: input.plan.originalQuestion,
    geographyIds: [...new Set(evidenceBundle.map((item) => item.geographyId).filter((value): value is string => value !== null))],
    missingApprovals: [],
    guardrails: [
      "Aggregate-only reviewed source; no raw rows or material actions.",
      `Temporary source contract ${result.provenance.contractId} was reviewed by ${result.provenance.reviewedBy} at ${result.provenance.reviewedAt}; ${result.provenance.validatedRowCount} full-file row(s) were validated.`,
    ],
    rows: result.rows.map((row) => ({ dimensions: row.dimensions, measures: row.measures, contributingRowCount: row.contributingRowCount })),
    evidenceBundle,
    sourceIds: [result.sourceId],
    qualityWarnings: warnings,
    missingEvidence,
    unknowns: [],
    allowedUse: result.provenance.allowedUse,
    sensitivity: result.provenance.sensitivity,
    executionMode: "frozen_snapshot_demo",
    errorCode: null,
    errorMessage: null,
  });
}

/** Builds a bounded runtime from already-loaded server-owned registry data. */
export function createVettedDynamicSourceRuntime(
  registryInput: unknown,
  context: { workspaceRoot: string },
  plan: EvaluationPlan,
): VettedDynamicSourceRuntime {
  const registry = vettedDynamicSourceRegistrySchema.parse(registryInput);
  const entries = registry.entries.filter((entry) => eligible(entry, plan));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return {
    candidateResearchPasses: entries.map(candidateFor),
    executeCandidatePass: async (candidate, input) => {
      const entry = byId.get(candidate.id);
      if (!entry || candidate.sourceIds.length !== 1 || candidate.sourceIds[0] !== entry.contract.sourceId) throw new Error("Dynamic research pass is not present in the server-owned vetted registry.");
      const result = await executeDiscoveredAggregateQuery(
        { workspaceRoot: context.workspaceRoot, approvedRoots: registry.approvedRoots },
        entry.contract,
        { ...entry.query, requestId: input.requestId },
      );
      return mapAggregateResponse(entry, result, input);
    },
  };
}

/** Loads only the fixed checked-in registry; request data cannot choose a path or query. */
export async function loadVettedDynamicSourceRuntime(plan: EvaluationPlan): Promise<VettedDynamicSourceRuntime> {
  const workspaceRoot = process.cwd();
  const registry = JSON.parse(await readFile(path.join(workspaceRoot, REGISTRY_RELATIVE_PATH), "utf8")) as unknown;
  return createVettedDynamicSourceRuntime(registry, { workspaceRoot }, plan);
}
