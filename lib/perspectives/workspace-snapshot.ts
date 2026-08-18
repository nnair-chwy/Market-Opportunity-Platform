import { z } from "zod";

export const workspaceSnapshotDatasetIdSchema = z.enum([
  "pricing_competitor_availability",
  "pricing_observed_equalized_price",
  "pricing_offer_observation_volume",
  "pricing_assortment_breadth",
  "marketing_paid_search_response",
  "marketing_paid_search_impressions",
  "marketing_paid_search_ctr",
  "marketing_paid_search_cpc",
  "marketing_paid_search_cost",
  "marketing_paid_search_conversions",
  "marketing_paid_search_conversion_rate",
  "marketing_paid_search_cost_per_conversion",
]);

export type WorkspaceSnapshotDatasetId = z.infer<typeof workspaceSnapshotDatasetIdSchema>;

export const workspaceSnapshotDatasetSchema = z.object({
  datasetId: workspaceSnapshotDatasetIdSchema,
  snapshotId: z.string().min(1),
  label: z.string().min(1),
  valueLabel: z.string().min(1),
  valueFormat: z.enum(["number", "percent", "currency"]),
  sourceIds: z.array(z.string().min(1)).min(1),
  inputGrain: z.string().min(1),
  outputGrain: z.literal("cbsa"),
  geographyMethod: z.string().min(1),
  transformationVersion: z.string().min(1),
  allowedUse: z.literal("internal_shadow_evaluation_only"),
  scoringEligibility: z.literal("none"),
  coverage: z.object({
    inputRows: z.number().int().nonnegative(),
    inputGeographies: z.number().int().nonnegative(),
    mappedGeographies: z.number().int().nonnegative(),
    mappedCbsaCount: z.number().int().nonnegative(),
    mappedValueShare: z.number().min(0).max(1),
  }),
  values: z.array(z.object({
    cbsaCode: z.string().regex(/^\d{5}$/),
    rawValue: z.number().finite(),
    contributingGeographies: z.number().int().positive(),
  })),
  limitations: z.array(z.string().min(1)).min(1),
});

export type WorkspaceSnapshotDataset = z.infer<typeof workspaceSnapshotDatasetSchema>;

export const workspaceSnapshotBundleSchema = z.object({
  version: z.literal("1.0.0"),
  generatedAt: z.string().datetime(),
  datasets: z.record(workspaceSnapshotDatasetIdSchema, workspaceSnapshotDatasetSchema),
});

export type WorkspaceSnapshotBundle = z.infer<typeof workspaceSnapshotBundleSchema>;
