import { z } from "zod";

export const NORMALIZATION_VERSION = "market-data-normalization-v1" as const;
export const NORMALIZED_QUERY_VERSION = "normalized-market-query-v1" as const;
export const NORMALIZED_CALCULATION_VERSION = "normalized-market-aggregation-v1" as const;
export const DEFAULT_NORMALIZED_SNAPSHOT_VERSION = "normalized-market-data-2026-08-17-v1" as const;

export const normalizationConfidenceSchema = z.enum(["exact", "high", "medium", "low", "none"]);
export const normalizationMethodSchema = z.enum([
  "source_cbsa_code",
  "exact_cbsa_name",
  "zip_bridge",
  "clinic_identity_bridge",
  "principal_city_and_state",
  "token_similarity_and_state",
  "state_only",
  "national",
  "unresolved",
]);
export const normalizationReviewStatusSchema = z.enum([
  "auto_accepted",
  "demo_inferred",
  "review_required",
  "not_applicable",
  "unmatched",
]);

export const geographyResolutionSchema = z.object({
  rawGeographyType: z.enum(["cbsa_code", "cbsa_label", "zip", "state", "matched_location_label", "national", "unknown"]),
  rawGeographyValue: z.string().nullable(),
  normalizedGeographyValue: z.string().nullable(),
  canonicalGeographyType: z.enum(["cbsa", "state", "national", "unresolved"]),
  canonicalGeographyId: z.string().nullable(),
  cbsaCode: z.string().regex(/^\d{5}$/).nullable(),
  cbsaName: z.string().nullable(),
  stateCodes: z.array(z.string().regex(/^[A-Z]{2}$/)),
  method: normalizationMethodSchema,
  confidence: normalizationConfidenceSchema,
  confidenceScore: z.number().min(0).max(1),
  evidenceStatus: z.enum(["Confirmed", "Derived", "Hypothesis", "Unknown"]),
  reviewStatus: normalizationReviewStatusSchema,
  demoUsable: z.boolean(),
  candidateMarketIds: z.array(z.string()),
  warnings: z.array(z.string()),
}).strict();
export type GeographyResolution = z.infer<typeof geographyResolutionSchema>;

export const sourceGeographyStrategySchema = z.enum([
  "cbsa_code_or_label",
  "cbsa_code",
  "zip_to_cbsa",
  "zip_then_cbsa_label",
  "clinic_identity_then_zip",
  "state",
  "national",
  "matched_location_label",
]);

export const normalizationSourceDefinitionSchema = z.object({
  datasetId: z.string().regex(/^[a-z0-9_]+$/),
  sourceFamily: z.enum(["general_regional", "clinic", "google_ads"]),
  relativePath: z.string().min(1),
  sourceId: z.string().min(1),
  grain: z.string().min(1),
  requiredColumns: z.array(z.string()).min(1),
  geographyStrategy: sourceGeographyStrategySchema,
  geographyFields: z.object({
    cbsaCode: z.string().optional(),
    cbsaLabel: z.string().optional(),
    zip: z.string().optional(),
    state: z.string().optional(),
    clinicId: z.string().optional(),
    matchedLocation: z.string().optional(),
  }).strict(),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
  allowedUse: z.string().min(1),
  browserExposure: z.enum(["none", "aggregate_only", "approved_detail"]),
}).strict();
export type NormalizationSourceDefinition = z.infer<typeof normalizationSourceDefinitionSchema>;

export const normalizedSourceRecordSchema = z.object({
  recordId: z.string().min(1),
  datasetId: z.string().min(1),
  sourceId: z.string().min(1),
  firstSourceRowNumber: z.number().int().positive(),
  occurrenceCount: z.number().int().positive(),
  sourceLocationKey: z.string().min(1),
  clinicId: z.string().nullable(),
  zip: z.string().regex(/^\d{5}$/).nullable(),
  suppliedCbsaLabel: z.string().nullable(),
  suppliedState: z.string().nullable(),
  resolution: geographyResolutionSchema,
}).strict();
export type NormalizedSourceRecord = z.infer<typeof normalizedSourceRecordSchema>;

export const normalizationCoverageSchema = z.object({
  datasetId: z.string(),
  sourceFamily: z.string(),
  sourceRowCount: z.number().int().nonnegative(),
  distinctLocationCount: z.number().int().nonnegative(),
  cbsaResolvedCount: z.number().int().nonnegative(),
  stateResolvedCount: z.number().int().nonnegative(),
  nationalCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(),
  exactCount: z.number().int().nonnegative(),
  highCount: z.number().int().nonnegative(),
  mediumCount: z.number().int().nonnegative(),
  lowCount: z.number().int().nonnegative(),
  inferredCount: z.number().int().nonnegative(),
  reviewRequiredCount: z.number().int().nonnegative(),
  demoUsableCount: z.number().int().nonnegative(),
  coverageRate: z.number().min(0).max(1),
  limitations: z.array(z.string()),
}).strict();
export type NormalizationCoverage = z.infer<typeof normalizationCoverageSchema>;

export const normalizedOutputSchema = z.object({
  tableName: z.string(),
  path: z.string(),
  rowCount: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  grain: z.string(),
}).strict();

export const normalizedSnapshotManifestSchema = z.object({
  manifestVersion: z.literal("normalized-market-snapshot-v1"),
  snapshotVersion: z.string().min(1),
  normalizationVersion: z.literal(NORMALIZATION_VERSION),
  queryVersion: z.literal(NORMALIZED_QUERY_VERSION),
  calculationVersion: z.literal(NORMALIZED_CALCULATION_VERSION),
  builtAt: z.string().datetime(),
  censusUniverseVersion: z.literal("2023-07"),
  censusSourceId: z.literal("SRC-014"),
  sourceRootStored: z.literal(false),
  rawExportsCopied: z.literal(false),
  seoIncluded: z.literal(false),
  purpose: z.literal("local_demo_geography_normalization"),
  sourceFiles: z.array(z.object({
    datasetId: z.string(),
    sourceId: z.string(),
    relativePath: z.string(),
    rowCount: z.number().int().nonnegative(),
    columnNames: z.array(z.string()),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    geographyStrategy: sourceGeographyStrategySchema,
    sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
    allowedUse: z.string(),
    browserExposure: z.enum(["none", "aggregate_only", "approved_detail"]),
  }).strict()),
  outputs: z.array(normalizedOutputSchema),
  coverage: z.array(normalizationCoverageSchema),
  warnings: z.array(z.string()),
  exclusions: z.array(z.string()),
}).strict();
export type NormalizedSnapshotManifest = z.infer<typeof normalizedSnapshotManifestSchema>;

export const normalizedQueryNameSchema = z.enum([
  "supported_regions",
  "regional_context_by_cbsa",
  "clinic_context_by_cbsa",
  "google_ads_context_by_cbsa",
  "normalization_coverage",
  "growth_test_screening",
]);

export const normalizedQueryRequestSchema = z.object({
  requestId: z.string().trim().min(1).max(160),
  snapshotVersion: z.string().trim().min(1),
  query: normalizedQueryNameSchema,
  cbsaCode: z.string().regex(/^\d{5}$/).optional(),
}).strict().superRefine((value, ctx) => {
  const needsCbsa = ["regional_context_by_cbsa", "clinic_context_by_cbsa", "google_ads_context_by_cbsa"].includes(value.query);
  if (needsCbsa && !value.cbsaCode) ctx.addIssue({ code: "custom", path: ["cbsaCode"], message: "This registered query requires a five-digit CBSA code." });
  if (!needsCbsa && value.cbsaCode) ctx.addIssue({ code: "custom", path: ["cbsaCode"], message: "This registered query does not accept a CBSA code." });
});
export type NormalizedQueryRequest = z.infer<typeof normalizedQueryRequestSchema>;

export const normalizedQueryResponseSchema = z.object({
  requestId: z.string(),
  snapshotVersion: z.string(),
  queryVersion: z.literal(NORMALIZED_QUERY_VERSION),
  calculationVersion: z.literal(NORMALIZED_CALCULATION_VERSION),
  query: normalizedQueryNameSchema,
  cbsaCode: z.string().nullable(),
  rows: z.array(z.record(z.string(), z.unknown())),
  sourceIds: z.array(z.string()),
  warnings: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  allowedUse: z.literal("local_demo_aggregate_decision_support"),
  scoringEligibility: z.literal("none"),
}).strict();
export type NormalizedQueryResponse = z.infer<typeof normalizedQueryResponseSchema>;
