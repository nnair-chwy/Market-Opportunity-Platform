import { z } from "zod";

export const SNAPSHOT_QUERY_VERSION = "evidence-snapshot-query-v1" as const;
export const SNAPSHOT_CALCULATION_VERSION = "evidence-snapshot-readiness-v1" as const;
export const GOOGLE_ADS_CONTRACT_VERSION = "google-ads-market-evidence-v1" as const;
export const GOOGLE_ADS_SOURCE_REGISTRY = {
  sourceId: "ADS-UNREGISTERED-FUTURE-EXPORT",
  status: "planned_not_registered",
  allowedUse: "approved_internal_decision_support_after_owner_approval",
  sensitivity: "internal_or_restricted_until_aggregate_review",
  rawRowsToBrowserOrAi: false,
  contractVersion: GOOGLE_ADS_CONTRACT_VERSION,
} as const;

export const evidenceStatusSchema = z.enum(["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"]);
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
  sourceId: z.string().min(1), snapshotId: z.string().min(1), campaignOrAccountScope: z.string().min(1),
  geographyType: z.enum(["market", "zip"]), geographyId: z.string().min(1),
  observationStart: z.string().date(), observationEnd: z.string().date(),
  spend: z.number().nonnegative().nullable(), impressions: z.number().int().nonnegative().nullable(),
  clicks: z.number().int().nonnegative().nullable(), conversions: z.number().nonnegative().nullable(),
  coveragePresent: z.boolean(), currency: z.string().length(3), spendUnit: z.string().min(1),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]), allowedUse: z.string().min(1),
  qualityStatus: z.enum(["valid", "warning", "rejected"]), evidenceStatus: evidenceStatusSchema,
  provenance: z.string().min(1),
}).superRefine((value, ctx) => {
  if (value.observationEnd < value.observationStart) ctx.addIssue({ code: "custom", message: "Observation end must not precede start.", path: ["observationEnd"] });
  if (value.conversions === null && value.coveragePresent) ctx.addIssue({ code: "custom", message: "Missing conversions must be explicit and cannot be marked covered.", path: ["coveragePresent"] });
});
export type GoogleAdsObservation = z.infer<typeof googleAdsObservationSchema>;

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
  z.object({ query: z.literal("google_ads_market_aggregates"), snapshotVersion: z.string().min(1), marketId: z.string().min(1).optional() }),
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
