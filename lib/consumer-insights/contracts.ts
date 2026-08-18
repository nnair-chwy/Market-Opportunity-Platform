import { z } from "zod";

export const CONSUMER_INSIGHTS_QUERY_VERSION = "consumer-insights-query-v1" as const;
export const CONSUMER_INSIGHTS_SNAPSHOT_VERSION = "chewy-brand-health-2024-dma-generation-v1" as const;
export const consumerInsightsQuerySchema = z.discriminatedUnion("query", [
  z.object({ query: z.literal("consumer_insights_by_dma"), snapshotVersion: z.string().min(1), dmaId: z.string().optional(), dmaName: z.string().optional(), segment: z.string().optional() }),
  z.object({ query: z.literal("consumer_insights_by_cbsa"), snapshotVersion: z.string().min(1), cbsaCode: z.string().length(5), segment: z.string().optional() }),
  z.object({ query: z.literal("brand_funnel_by_dma"), snapshotVersion: z.string().min(1), dmaId: z.string().min(1), segment: z.string().optional(), brand: z.string().optional() }),
  z.object({ query: z.literal("brand_funnel_by_cbsa"), snapshotVersion: z.string().min(1), cbsaCode: z.string().length(5), segment: z.string().optional(), brand: z.string().optional() }),
  z.object({ query: z.literal("brand_relevance_drivers_by_dma"), snapshotVersion: z.string().min(1), dmaId: z.string().min(1), segment: z.string().optional(), brand: z.string().optional() }),
  z.object({ query: z.literal("brand_relevance_drivers_by_cbsa"), snapshotVersion: z.string().min(1), cbsaCode: z.string().length(5), segment: z.string().optional(), brand: z.string().optional() }),
  z.object({ query: z.literal("brand_health_by_generation"), snapshotVersion: z.string().min(1), dmaId: z.string().min(1), segment: z.string().optional(), brand: z.string().optional() }),
  z.object({ query: z.literal("brand_health_by_cbsa"), snapshotVersion: z.string().min(1), cbsaCode: z.string().length(5), segment: z.string().optional(), brand: z.string().optional() }),
  z.object({ query: z.literal("consumer_insights_source_quality"), snapshotVersion: z.string().min(1) }),
]);
export type ConsumerInsightsQuery = z.infer<typeof consumerInsightsQuerySchema>;

export const dmaCbsaCrosswalkSchema = z.object({
  crosswalk_version: z.string().min(1),
  method: z.string().min(1),
  evidence_status: z.literal("Derived"),
  review_state: z.string().min(1),
  allowed_use: z.string().min(1),
  scoring_eligibility: z.literal("none"),
  mappings: z.array(z.object({
    dma_name: z.string().min(1),
    dma_code_in_source: z.string().min(1),
    cbsa_code: z.string().regex(/^\d{5}$/),
    cbsa_name: z.string().min(1),
    confidence: z.enum(["high", "medium", "low"]),
    review_state: z.string().min(1),
  }).strict()).min(1),
}).strict();
export type DmaCbsaCrosswalk = z.infer<typeof dmaCbsaCrosswalkSchema>;

export const consumerInsightsEvidenceStatusSchema = z.enum(["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"]);
export const consumerInsightsManifestSchema = z.object({
  manifest_version: z.string(), snapshot_version: z.string(), built_at: z.string(), source_id: z.string(), source_file: z.string(), source_sha256: z.string(),
  extraction_version: z.string(), normalization_version: z.string(), geography_reference_version: z.string(), source_status: z.string(), evidence_status: consumerInsightsEvidenceStatusSchema,
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]), allowed_use: z.string(), scoring_eligibility: z.string(), field_start: z.string(), field_end: z.string(),
  sample: z.object({ total_pet_owners: z.number(), dma_count: z.number(), generation_deep_dive_dma_count: z.number() }), outputs: z.array(z.object({ path: z.string(), rowCount: z.number(), sha256: z.string(), grain: z.string(), allowedUse: z.string() })), quality_checks: z.record(z.string(), z.number()), exclusions: z.array(z.string()), known_issues: z.array(z.string()), derivations: z.record(z.string(), z.string()),
});
export type ConsumerInsightsManifest = z.infer<typeof consumerInsightsManifestSchema>;
