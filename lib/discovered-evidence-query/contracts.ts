import { z } from "zod";
import { discoveredColumnSchema, discoveredFileFormatSchema, SOURCE_DISCOVERY_VERSION } from "../data-discovery/contracts.ts";
import { FULL_FILE_VALIDATION_VERSION, SEMANTIC_SOURCE_CONTRACT_VERSION } from "../data-discovery/full-file-validator.ts";

export const DISCOVERED_EVIDENCE_QUERY_VERSION = "discovered-evidence-query-v1" as const;

export const aggregateFunctionSchema = z.enum(["sum", "average", "minimum", "maximum", "count_non_null", "distinct_count"]);
export type AggregateFunction = z.infer<typeof aggregateFunctionSchema>;

export const validatedDiscoveredSourceContractSchema = z.object({
  version: z.literal(DISCOVERED_EVIDENCE_QUERY_VERSION),
  contractId: z.string().trim().min(1).max(160),
  sourceProfileVersion: z.literal(SOURCE_DISCOVERY_VERSION),
  fullFileValidationVersion: z.literal(FULL_FILE_VALIDATION_VERSION),
  semanticSourceContractVersion: z.literal(SEMANTIC_SOURCE_CONTRACT_VERSION),
  validatedRowCount: z.number().int().positive(),
  sourceId: z.string().trim().min(1).max(160),
  relativePath: z.string().trim().min(1),
  format: discoveredFileFormatSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sensitivity: z.enum(["public", "internal"]),
  allowedUse: z.string().trim().min(1),
  reviewedBy: z.string().trim().min(1),
  reviewedAt: z.string().datetime(),
  reviewStatus: z.literal("reviewed_for_temporary_aggregate_query"),
  columns: z.array(discoveredColumnSchema).min(1),
  policy: z.object({
    dimensionFields: z.array(z.string().trim().min(1)).max(8),
    measures: z.array(z.object({
      field: z.string().trim().min(1),
      allowedAggregations: z.array(aggregateFunctionSchema).min(1),
    }).strict()).min(1).max(20),
    filterFields: z.array(z.string().trim().min(1)).max(20),
    minimumGroupSize: z.number().int().min(2).max(100),
    maxSourceRows: z.number().int().min(1).max(1_000_000),
    maxSourceBytes: z.number().int().min(1).max(256 * 1024 * 1024),
    maxGroups: z.number().int().min(1).max(100),
  }).strict(),
  quality: z.object({
    profileWarnings: z.array(z.string()),
    unresolvedContractQuestions: z.array(z.string()),
  }).strict(),
}).strict().superRefine((contract, ctx) => {
  if (contract.relativePath.split(/[\\/]/).includes("..") || contract.relativePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(contract.relativePath)) {
    ctx.addIssue({ code: "custom", path: ["relativePath"], message: "The source path must remain workspace-relative and cannot contain traversal." });
  }
  const columns = new Map(contract.columns.map((column) => [column.name, column]));
  for (const [index, field] of contract.policy.dimensionFields.entries()) {
    const column = columns.get(field);
    if (!column) ctx.addIssue({ code: "custom", path: ["policy", "dimensionFields", index], message: `Unknown dimension field ${field}.` });
    else if (column.roles.includes("sensitive") || !column.roles.some((role) => ["geography", "time", "dimension"].includes(role))) {
      ctx.addIssue({ code: "custom", path: ["policy", "dimensionFields", index], message: `Dimension ${field} is not an approved non-sensitive geography, time, or dimension field.` });
    }
  }
  for (const [index, measure] of contract.policy.measures.entries()) {
    const column = columns.get(measure.field);
    if (!column) ctx.addIssue({ code: "custom", path: ["policy", "measures", index, "field"], message: `Unknown measure field ${measure.field}.` });
    else if (column.roles.includes("sensitive") || !column.roles.includes("metric")) {
      ctx.addIssue({ code: "custom", path: ["policy", "measures", index, "field"], message: `Measure ${measure.field} is not an approved non-sensitive metric.` });
    } else if (!["integer", "number"].includes(column.inferredType)) {
      ctx.addIssue({ code: "custom", path: ["policy", "measures", index, "field"], message: `Measure ${measure.field} must have a reviewed numeric type for temporary aggregation.` });
    }
  }
  for (const [index, field] of contract.policy.filterFields.entries()) {
    const column = columns.get(field);
    if (!column) ctx.addIssue({ code: "custom", path: ["policy", "filterFields", index], message: `Unknown filter field ${field}.` });
    else if (column.roles.includes("sensitive")) ctx.addIssue({ code: "custom", path: ["policy", "filterFields", index], message: `Sensitive field ${field} cannot be queried.` });
  }
});

const scalarSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);

export const discoveredAggregateQuerySchema = z.object({
  version: z.literal(DISCOVERED_EVIDENCE_QUERY_VERSION),
  requestId: z.string().trim().min(1).max(160),
  contractId: z.string().trim().min(1).max(160),
  operation: z.literal("aggregate"),
  dimensions: z.array(z.string().trim().min(1)).max(3),
  measures: z.array(z.object({ field: z.string().trim().min(1), aggregation: aggregateFunctionSchema }).strict()).min(1).max(8),
  filters: z.array(z.object({
    field: z.string().trim().min(1),
    operator: z.enum(["equals", "in", "greater_than_or_equal", "less_than_or_equal"]),
    value: scalarSchema.optional(),
    values: z.array(scalarSchema).min(1).max(50).optional(),
  }).strict().superRefine((filter, ctx) => {
    if (filter.operator === "in" && !filter.values) ctx.addIssue({ code: "custom", path: ["values"], message: "The in operator requires values." });
    if (filter.operator !== "in" && filter.value === undefined) ctx.addIssue({ code: "custom", path: ["value"], message: `${filter.operator} requires value.` });
    if (filter.operator === "in" && filter.value !== undefined) ctx.addIssue({ code: "custom", path: ["value"], message: "The in operator accepts values only." });
    if (filter.operator !== "in" && filter.values !== undefined) ctx.addIssue({ code: "custom", path: ["values"], message: `${filter.operator} accepts value only.` });
  })).max(8),
  orderBy: z.object({ field: z.string().trim().min(1), aggregation: aggregateFunctionSchema, direction: z.enum(["ascending", "descending"]) }).strict().nullable(),
  limit: z.number().int().min(1).max(100),
}).strict();

export const discoveredAggregateMeasureResultSchema = z.object({
  field: z.string().trim().min(1),
  aggregation: aggregateFunctionSchema,
  rawValue: z.number().finite().nullable(),
  unit: z.string().trim().min(1).nullable(),
  nonNullCount: z.number().int().nonnegative(),
}).strict();

export const discoveredAggregateQueryResponseSchema = z.object({
  version: z.literal(DISCOVERED_EVIDENCE_QUERY_VERSION),
  requestId: z.string().trim().min(1),
  contractId: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  status: z.enum(["complete", "partial"]),
  rows: z.array(z.object({
    dimensions: z.record(z.string(), scalarSchema),
    measures: z.array(discoveredAggregateMeasureResultSchema),
    contributingRowCount: z.number().int().nonnegative(),
  }).strict()).max(100),
  sourceRowsRead: z.number().int().nonnegative(),
  sourceRowsMatched: z.number().int().nonnegative(),
  sourceRowsTruncated: z.boolean(),
  resultLimitReached: z.boolean(),
  suppressedGroupCount: z.number().int().nonnegative(),
  provenance: z.object({
    sourceId: z.string().trim().min(1),
    relativePath: z.string().trim().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    contractId: z.string().trim().min(1),
    fullFileValidationVersion: z.literal(FULL_FILE_VALIDATION_VERSION),
    semanticSourceContractVersion: z.literal(SEMANTIC_SOURCE_CONTRACT_VERSION),
    validatedRowCount: z.number().int().positive(),
    reviewedBy: z.string().trim().min(1),
    reviewedAt: z.string().datetime(),
    allowedUse: z.string().trim().min(1),
    sensitivity: z.enum(["public", "internal"]),
  }).strict(),
  quality: z.object({
    nullCounts: z.record(z.string(), z.number().int().nonnegative()),
    invalidValueCounts: z.record(z.string(), z.number().int().nonnegative()),
    warnings: z.array(z.string()),
  }).strict(),
  rawRowsReturned: z.literal(false),
}).strict();

export type ValidatedDiscoveredSourceContract = z.infer<typeof validatedDiscoveredSourceContractSchema>;
export type DiscoveredAggregateQuery = z.infer<typeof discoveredAggregateQuerySchema>;
export type DiscoveredAggregateQueryResponse = z.infer<typeof discoveredAggregateQueryResponseSchema>;
