import { z } from "zod";

export const SNAPSHOT_QUERY_VERSION = "evidence-snapshot-query-v1" as const;
export const SNAPSHOT_CALCULATION_VERSION = "evidence-snapshot-readiness-v1" as const;
export const CANONICAL_EVIDENCE_QUERY_VERSION = "canonical-evidence-query-v1" as const;
export const CANONICAL_EVIDENCE_CALCULATION_VERSION = "canonical-evidence-projection-v1" as const;
export const GOOGLE_ADS_CONTRACT_VERSION = "google-ads-matched-location-context-v2" as const;
export const GOOGLE_ADS_SOURCE_REGISTRY = {
  sourceIdPrefix: "GOOGLE-ADS-MATCHED-LOCATIONS",
  status: "registered_context_only",
  allowedUse: "matched_location_descriptive_context_only",
  sensitivity: "internal",
  aiExposure: "aggregate_only",
  rawRowsToBrowserOrAi: false,
  marketJoinEligibility: "blocked_missing_stable_geography_id",
  rankingEligibility: "none",
  contractVersion: GOOGLE_ADS_CONTRACT_VERSION,
} as const;

export const evidenceStatusSchema = z.enum(["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"]);
export const evidencePeriodSchema = z.object({
  kind: z.enum(["date_range", "as_of", "calendar_year", "timeframe", "not_provided"]),
  start: z.string().date().nullable(),
  end: z.string().date().nullable(),
  label: z.string().trim().min(1).max(120),
}).strict().superRefine((value, ctx) => {
  if (value.start && value.end && value.end < value.start) ctx.addIssue({ code: "custom", message: "Evidence period end must not precede start.", path: ["end"] });
  if (value.kind === "date_range" && (!value.start || !value.end)) ctx.addIssue({ code: "custom", message: "Date-range evidence requires start and end dates.", path: ["start"] });
  if ((value.kind === "as_of" || value.kind === "calendar_year") && !value.end) ctx.addIssue({ code: "custom", message: "As-of and calendar-year evidence require an end date.", path: ["end"] });
});
export type EvidencePeriod = z.infer<typeof evidencePeriodSchema>;
export const snapshotManifestSchema = z.object({
  manifestVersion: z.string().min(1),
  snapshotVersion: z.string().min(1),
  builtAt: z.string().datetime(),
  sourceType: z.string().min(1),
  rawExportsCopied: z.boolean(),
  evidenceStatus: evidenceStatusSchema,
  allowedUse: z.string().min(1),
  scoringStatus: z.string().min(1),
  inputFiles: z.array(z.object({ file: z.string().min(1), path: z.string().min(1).optional() })),
  outputs: z.array(z.object({
    path: z.string().min(1), rowCount: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/), grain: z.string().min(1), allowedUse: z.string().min(1),
  })).min(1),
  exclusions: z.array(z.string()),
  knownIssues: z.array(z.string()),
  derivations: z.record(z.string(), z.string()),
});
export type SnapshotManifest = z.infer<typeof snapshotManifestSchema>;

export const googleAdsObservationSchema = z.object({
  observationId: z.string().min(1), sourceId: z.string().min(1), snapshotId: z.string().min(1), reportScope: z.string().min(1),
  geographyType: z.literal("matched_location_label"), matchedLocationLabel: z.string().min(1), stableGeographyId: z.null(),
  observationStart: z.string().date(), observationEnd: z.string().date(),
  spend: z.number().nonnegative().nullable(), impressions: z.number().int().nonnegative().nullable(),
  clicks: z.number().int().nonnegative().nullable(), conversions: z.number().nonnegative().nullable(),
  ctr: z.number().nonnegative().nullable(), averageCpc: z.number().nonnegative().nullable(),
  conversionRate: z.number().nonnegative().nullable(), costPerConversion: z.number().nonnegative().nullable(),
  conversionsCoveragePresent: z.boolean(), currency: z.string().length(3), spendUnit: z.literal("currency_units"),
  sensitivity: z.literal("internal"), allowedUse: z.literal("matched_location_descriptive_context_only"),
  qualityStatus: z.enum(["valid", "warning", "rejected"]), evidenceStatus: z.literal("Reported"),
  scoringEligibility: z.literal("none"), rankingEligibility: z.literal("none"),
  marketJoinEligibility: z.literal("blocked_missing_stable_geography_id"),
  warnings: z.array(z.string()),
  provenance: z.object({
    sourceFile: z.string().min(1), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceRowNumber: z.number().int().positive(), transformationVersion: z.string().min(1),
  }),
}).superRefine((value, ctx) => {
  if (value.observationEnd < value.observationStart) ctx.addIssue({ code: "custom", message: "Observation end must not precede start.", path: ["observationEnd"] });
  if (value.conversions === null && value.conversionsCoveragePresent) ctx.addIssue({ code: "custom", message: "Missing conversions must be explicit and cannot be marked covered.", path: ["conversionsCoveragePresent"] });
  if (value.stableGeographyId !== null) ctx.addIssue({ code: "custom", message: "Matched-location context must not claim a stable geography ID.", path: ["stableGeographyId"] });
});
export type GoogleAdsObservation = z.infer<typeof googleAdsObservationSchema>;

export const canonicalSnapshotManifestSchema = z.object({
  manifestVersion: z.string().min(1),
  snapshotVersion: z.string().min(1),
  builtAt: z.string().datetime(),
  sourceType: z.string().min(1),
  rawExportsCopied: z.literal(false),
  outputs: z.array(z.object({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().nonnegative() }).strict()).min(1),
  knownIssues: z.array(z.string()),
  queryVersion: z.string().min(1),
  calculationVersion: z.string().min(1),
}).passthrough().superRefine((value, ctx) => {
  for (const [index, output] of value.outputs.entries()) {
    if (output.path.includes("/") || output.path.includes("\\") || output.path === "." || output.path === "..") {
      ctx.addIssue({ code: "custom", message: "Canonical snapshot outputs must be local filenames without path traversal.", path: ["outputs", index, "path"] });
    }
  }
});
export type CanonicalSnapshotManifest = z.infer<typeof canonicalSnapshotManifestSchema>;

const executionRequestBase = z.object({
  requestId: z.string().trim().min(1).max(160),
  snapshotVersion: z.string().trim().min(1).max(160),
  questionId: z.string().trim().min(1).max(160).nullable().optional(),
  planId: z.string().trim().min(1).max(160).nullable().optional(),
  requestedAt: z.string().datetime(),
  executionMode: z.enum(["frozen_snapshot_demo", "synthetic_demo"]),
});

export const evidenceExecutionRequestSchema = z.discriminatedUnion("query", [
  executionRequestBase.extend({ query: z.literal("canonical_market_evidence"), parameters: z.object({ marketId: z.string().regex(/^cbsa:\d{5}$/) }).strict() }).strict(),
  executionRequestBase.extend({ query: z.literal("canonical_clinic_performance"), parameters: z.object({ marketId: z.string().regex(/^cbsa:\d{5}$/) }).strict() }).strict(),
  executionRequestBase.extend({ query: z.literal("google_ads_matched_location_context"), parameters: z.object({ matchedLocationLabel: z.string().trim().min(1).max(240).optional(), reportScope: z.string().trim().min(1).max(120).optional() }).strict() }).strict(),
]);
export type EvidenceExecutionRequest = z.infer<typeof evidenceExecutionRequestSchema>;

export const executionEvidenceItemSchema = z.object({
  evidenceId: z.string().min(1),
  metricId: z.string().min(1),
  geographyId: z.string().min(1).nullable(),
  geographyLabel: z.string().min(1),
  rawValue: z.number().finite().nullable(),
  structuredValue: z.record(z.string(), z.unknown()).nullable(),
  unit: z.string().min(1).nullable(),
  sourceId: z.string().min(1),
  snapshotId: z.string().min(1),
  evidenceStatus: evidenceStatusSchema,
  qualityStatus: z.enum(["accepted", "valid", "warning", "rejected", "unknown"]),
  observationStart: z.string().nullable(),
  observationEnd: z.string().nullable(),
  period: evidencePeriodSchema.default({ kind: "not_provided", start: null, end: null, label: "Period not provided" }),
  reportScope: z.string().trim().min(1).max(160).nullable().default(null),
  currency: z.string().length(3).nullable().default(null),
  allowedUse: z.string().min(1),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
  warning: z.string().nullable(),
  origin: z.enum(["public_context", "frozen_csv_snapshot", "synthetic_demo_fixture"]),
}).strict().superRefine((value, ctx) => {
  if (value.origin === "synthetic_demo_fixture" && value.evidenceStatus !== "Hypothesis") ctx.addIssue({ code: "custom", message: "Synthetic evidence must be labeled Hypothesis.", path: ["evidenceStatus"] });
  if (value.rawValue === null && value.structuredValue === null) ctx.addIssue({ code: "custom", message: "Evidence must preserve either a raw or structured value; missing evidence belongs in missingEvidence.", path: ["rawValue"] });
});
export type ExecutionEvidenceItem = z.infer<typeof executionEvidenceItemSchema>;

export const executionCapabilitySchema = z.enum([
  "census_market_context",
  "clinic_performance",
  "clinic_site_evaluation",
  "local_growth_test",
  "consumer_insights",
]);

export const evidenceResponseQuerySchema = z.enum([
  "canonical_market_evidence",
  "canonical_clinic_performance",
  "google_ads_matched_location_context",
  "market_context_bundle",
  "clinic_performance_bundle",
  "clinic_site_evidence_bundle",
  "clinic_location_evidence_bundle",
  "growth_test_bundle",
  "normalized_evidence_bundle",
  "multi_market_comparison_bundle",
  "source_coverage_bundle",
  "growth_test_screening_bundle",
  "consumer_insights_bundle",
]);

export const evidenceExecutionResponseSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["complete", "partial", "blocked", "failed"]),
  snapshotVersion: z.string().min(1),
  queryVersion: z.string().min(1),
  calculationVersion: z.string().min(1).nullable(),
  query: evidenceResponseQuerySchema,
  componentQueries: z.array(z.enum([
    "canonical_market_evidence",
    "canonical_clinic_performance",
    "google_ads_matched_location_context",
    "supported_regions",
    "regional_context_by_cbsa",
    "clinic_context_by_cbsa",
    "google_ads_context_by_cbsa",
    "normalization_coverage",
    "growth_test_screening",
    "consumer_insights_by_cbsa",
    "brand_funnel_by_cbsa",
    "brand_relevance_drivers_by_cbsa",
    "brand_health_by_cbsa",
  ])),
  capability: executionCapabilitySchema.nullable(),
  planId: z.string().min(1).nullable(),
  originalQuestion: z.string().min(3).max(600).nullable(),
  geographyIds: z.array(z.string().min(1)),
  missingApprovals: z.array(z.string().min(1)),
  guardrails: z.array(z.string().min(1)),
  rows: z.array(z.record(z.string(), z.unknown())),
  evidenceBundle: z.array(executionEvidenceItemSchema),
  sourceIds: z.array(z.string().min(1)),
  qualityWarnings: z.array(z.string().min(1)),
  missingEvidence: z.array(z.string().min(1)),
  unknowns: z.array(z.string().min(1)),
  allowedUse: z.string().min(1),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
  executionMode: z.enum(["frozen_snapshot_demo", "synthetic_demo"]),
  errorCode: z.string().min(1).nullable(),
  errorMessage: z.string().min(1).nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.status === "failed" && (!value.errorCode || !value.errorMessage)) ctx.addIssue({ code: "custom", message: "Failed responses require an error code and message.", path: ["errorCode"] });
  if (value.status !== "failed" && (value.errorCode || value.errorMessage)) ctx.addIssue({ code: "custom", message: "Only failed responses may contain execution errors.", path: ["errorCode"] });
  if (["blocked", "failed"].includes(value.status) && (value.rows.length || value.evidenceBundle.length)) ctx.addIssue({ code: "custom", message: "Blocked and failed responses cannot expose rows or evidence.", path: ["rows"] });
  if (value.evidenceBundle.some((item) => item.sensitivity === "restricted" || item.sensitivity === "confidential")) ctx.addIssue({ code: "custom", message: "Confidential or restricted evidence cannot cross the browser or AI response boundary.", path: ["evidenceBundle"] });
  const evidenceSourceIds = new Set(value.evidenceBundle.map((item) => item.sourceId));
  if ([...evidenceSourceIds].some((sourceId) => !value.sourceIds.includes(sourceId))) ctx.addIssue({ code: "custom", message: "Every evidence source ID must be present in the response sourceIds list.", path: ["sourceIds"] });
});
export type EvidenceExecutionResponse = z.infer<typeof evidenceExecutionResponseSchema>;

export const snapshotQueryRequestSchema = z.discriminatedUnion("query", [
  z.object({ query: z.literal("market_context_by_cbsa"), snapshotVersion: z.string().min(1), cbsaCode: z.string().regex(/^\d{5}$/) }),
  z.object({ query: z.literal("zip_cbsa_coverage"), snapshotVersion: z.string().min(1), zip: z.string().regex(/^\d{5}$/).optional() }),
  z.object({ query: z.literal("regional_demand_by_zip_year"), snapshotVersion: z.string().min(1), zip: z.string().regex(/^\d{5}$/).optional(), year: z.number().int().min(2000).max(2100).optional() }),
  z.object({ query: z.literal("regional_demand_by_cbsa_year"), snapshotVersion: z.string().min(1), cbsaName: z.string().min(1).max(120), year: z.number().int().min(2000).max(2100).optional() }),
  z.object({ query: z.literal("clinic_profile_by_market"), snapshotVersion: z.string().min(1), cbsaName: z.string().min(1).max(120).optional() }),
  z.object({ query: z.literal("clinic_activity_by_market"), snapshotVersion: z.string().min(1), cbsaName: z.string().min(1).max(120).optional(), timeframe: z.string().max(80).optional() }),
  z.object({ query: z.literal("cbsa_population_by_cbsa"), snapshotVersion: z.string().min(1), cbsaCode: z.string().regex(/^\d{5}$/).optional() }),
  z.object({ query: z.literal("zip_context_by_zip"), snapshotVersion: z.string().min(1), zip: z.string().regex(/^\d{5}$/).optional() }),
  z.object({ query: z.literal("zip_metro_by_zip"), snapshotVersion: z.string().min(1), zip: z.string().regex(/^\d{5}$/).optional() }),
  z.object({ query: z.literal("clinic_market_evidence"), snapshotVersion: z.string().min(1), cbsaCode: z.string().regex(/^\d{5}$/).optional() }),
  z.object({ query: z.literal("appointment_context"), snapshotVersion: z.string().min(1), geography: z.string().max(80).optional() }),
  z.object({ query: z.literal("retention_context"), snapshotVersion: z.string().min(1), reportingYear: z.number().int().min(2000).max(2100).optional() }),
  z.object({ query: z.literal("google_ads_matched_location_context"), snapshotVersion: z.string().min(1), matchedLocationLabel: z.string().min(1).max(240).optional(), reportScope: z.string().min(1).max(120).optional() }),
  z.object({ query: z.literal("google_ads_market_aggregates"), snapshotVersion: z.string().min(1), marketId: z.string().min(1) }),
  z.object({ query: z.literal("source_quality_summary"), snapshotVersion: z.string().min(1) }),
]);
export type SnapshotQueryRequest = z.infer<typeof snapshotQueryRequestSchema>;

export type SnapshotReadiness = {
  snapshotVersion: string;
  manifestValid: boolean;
  tables: Array<{ tableName: string; expectedRowCount: number; actualRowCount: number; hashValid: boolean; dateRange: { min: string | null; max: string | null }; duplicateKeyCount: number; nullCounts: Record<string, number>; sensitivity: string; allowedUse: string }>;
  unmatchedGeographyCounts: Record<string, number>;
  qualityWarningCount: number;
  sensitivitySummary: Record<string, number>;
  allowedUseSummary: Record<string, number>;
  restrictedDatasetsExcluded: string[];
  sourceDatasetsLoaded: string[];
  knownIssues: string[];
  status: "ready" | "ready_with_warnings" | "blocked";
  queryVersion: typeof SNAPSHOT_QUERY_VERSION;
  calculationVersion: typeof SNAPSHOT_CALCULATION_VERSION;
};
