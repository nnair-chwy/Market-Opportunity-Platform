import { z } from "zod";

export const SOURCE_DISCOVERY_VERSION = "approved-source-discovery-v1" as const;

export const discoveredFileFormatSchema = z.enum(["csv", "tsv", "json", "xlsx", "parquet"]);
export type DiscoveredFileFormat = z.infer<typeof discoveredFileFormatSchema>;

export const inferredValueTypeSchema = z.enum([
  "null",
  "boolean",
  "integer",
  "number",
  "date",
  "datetime",
  "string",
  "mixed",
]);

export const discoveredColumnSchema = z.object({
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  inferredType: inferredValueTypeSchema,
  nullable: z.boolean(),
  sampledNonNullCount: z.number().int().nonnegative(),
  sampledDistinctCount: z.number().int().nonnegative(),
  roles: z.array(z.enum(["identifier", "geography", "time", "metric", "dimension", "sensitive"])),
  inferredUnit: z.string().nullable(),
}).strict();
export type DiscoveredColumn = z.infer<typeof discoveredColumnSchema>;

export const uncertaintySchema = z.object({
  field: z.enum(["grain", "geography", "time", "metric", "unit", "sensitivity", "schema"]),
  reason: z.string().min(1),
  candidates: z.array(z.string()),
}).strict();
export type DiscoveryUncertainty = z.infer<typeof uncertaintySchema>;

export const discoveredSourceProfileSchema = z.object({
  profileVersion: z.literal(SOURCE_DISCOVERY_VERSION),
  sourceId: z.string().min(1),
  packageId: z.string().min(1),
  relativePath: z.string().min(1),
  format: discoveredFileFormatSchema,
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  agentUse: z.string().min(1),
  inheritedSensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
  inferredSensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
  sensitivitySignals: z.array(z.string()),
  allowedUse: z.string().min(1),
  approvalState: z.enum(["approved_local_source", "control_metadata", "excluded", "review_required"]),
  evidenceStatus: z.enum(["Reported", "Unknown"]),
  rowCount: z.number().int().nonnegative().nullable(),
  sampledRowCount: z.number().int().nonnegative(),
  columns: z.array(discoveredColumnSchema),
  grain: z.object({
    description: z.string(),
    keyFields: z.array(z.string()),
    confidence: z.enum(["high", "medium", "low", "none"]),
  }).strict(),
  geography: z.object({
    grain: z.enum(["zip", "cbsa", "metro", "dma", "state", "county", "trade_area", "drive_time", "point", "national", "unknown"]),
    fields: z.array(z.string()),
    confidence: z.enum(["high", "medium", "low", "none"]),
    alternatives: z.array(z.string()),
  }).strict(),
  time: z.object({
    fields: z.array(z.string()),
    grain: z.enum(["day", "week", "month", "quarter", "year", "range", "snapshot", "unknown"]),
    confidence: z.enum(["high", "medium", "low", "none"]),
  }).strict(),
  metrics: z.array(z.object({ field: z.string(), unit: z.string().nullable(), confidence: z.enum(["high", "medium", "low"]) }).strict()),
  uncertainties: z.array(uncertaintySchema),
  warnings: z.array(z.string()),
  containsRawRows: z.literal(false),
  integration: z.object({
    inventoryFileMatched: z.boolean(),
    queryEligibility: z.enum(["profile_only", "candidate_for_adapter", "excluded"]),
    nextStep: z.string(),
  }).strict(),
}).strict();
export type DiscoveredSourceProfile = z.infer<typeof discoveredSourceProfileSchema>;

export const discoveredSourceRegistrySchema = z.object({
  version: z.literal(SOURCE_DISCOVERY_VERSION),
  generatedAt: z.string().datetime(),
  workspace: z.string().min(1),
  approvedRoots: z.array(z.string()),
  sourceInventoryVersion: z.string(),
  rawRowsStored: z.literal(false),
  profiles: z.array(discoveredSourceProfileSchema),
  skipped: z.array(z.object({ relativePath: z.string(), reason: z.string() }).strict()),
  summary: z.object({
    discoveredFileCount: z.number().int().nonnegative(),
    profiledFileCount: z.number().int().nonnegative(),
    reviewRequiredCount: z.number().int().nonnegative(),
    restrictedSignalCount: z.number().int().nonnegative(),
  }).strict(),
}).strict();
export type DiscoveredSourceRegistry = z.infer<typeof discoveredSourceRegistrySchema>;

export type LocalApprovedSourceInventory = {
  version: string;
  workspace: string;
  packages: Array<{
    id: string;
    root: string;
    sensitivity: "public" | "internal" | "confidential" | "restricted";
    allowedUse: string;
    files: Array<{
      file: string;
      bytes: number;
      sha256?: string;
      agentUse: string;
    }>;
  }>;
};
