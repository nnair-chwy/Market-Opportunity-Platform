import { z } from "zod";

export const SEATTLE_CBSA_CODE = "42660" as const;
export const SEATTLE_MARKET_NAME = "Seattle-Tacoma-Bellevue, WA" as const;
export const SEATTLE_SUBMARKET_SOURCE_ID = "SYN-SEATTLE-SUBMARKET-001" as const;
export const SEATTLE_BROKER_SOURCE_ID = "SYN-SEATTLE-BROKER-001" as const;
export const SEATTLE_GEOMETRY_METHOD_VERSION = "illustrative-geodesic-hubs-v1" as const;

export const submarketMetricIdSchema = z.enum([
  "demand_potential",
  "veterinary_whitespace",
  "customer_presence",
  "commercial_availability",
  "staffing_feasibility",
]);
export type SubmarketMetricId = z.infer<typeof submarketMetricIdSchema>;

const metricValuesSchema = z.object({
  demand_potential: z.number().finite().min(0).max(100).nullable(),
  veterinary_whitespace: z.number().finite().min(0).max(100).nullable(),
  customer_presence: z.number().finite().min(0).max(100).nullable(),
  commercial_availability: z.number().finite().min(0).max(100).nullable(),
  staffing_feasibility: z.number().finite().min(0).max(100).nullable(),
}).strict();

export const seattleSubmarketSchema = z.object({
  submarket_id: z.string().min(1),
  parent_cbsa_code: z.literal(SEATTLE_CBSA_CODE),
  label: z.string().min(1),
  description: z.string().min(1),
  display_number: z.number().int().min(1).max(7),
  display_color: z.string().regex(/^#[0-9a-f]{6}$/i),
  short_label: z.string().min(1).max(24),
  hub: z.object({
    place_label: z.string().min(1),
    longitude: z.number().finite().min(-180).max(180),
    latitude: z.number().finite().min(-90).max(90),
    radius_km: z.number().finite().positive().max(50),
  }).strict(),
  geometry_status: z.literal("illustrative_analysis_area"),
  geometry_method_version: z.literal(SEATTLE_GEOMETRY_METHOD_VERSION),
  geometry_scoring_eligibility: z.literal("none"),
  metrics: metricValuesSchema,
  limitations: z.array(z.string().min(1)).min(1),
}).strict();

export type SeattleSubmarket = z.infer<typeof seattleSubmarketSchema> & {
  source_id: typeof SEATTLE_SUBMARKET_SOURCE_ID;
  evidence_status: "Hypothesis";
  allowed_use: "synthetic_prototype_only";
  scoring_eligibility: "synthetic_prototype_only";
  fixture_version: string;
  last_updated_at: string;
};

export const brokerProfileSchema = z.object({
  broker_profile_id: z.string().min(1),
  display_name: z.string().min(1),
  firm_name: z.string().min(1),
  coverage_labels: z.array(z.string().min(1)).min(1),
  specialty_labels: z.array(z.string().min(1)).min(1),
  contact_page_placeholder: z.string().startsWith("demo://"),
  verification_status: z.literal("demo_only_unverified"),
  last_reviewed_at: z.string().date(),
  limitations: z.array(z.string().min(1)).min(1),
}).strict();

export type DemoBrokerProfile = z.infer<typeof brokerProfileSchema> & {
  source_id: typeof SEATTLE_BROKER_SOURCE_ID;
  evidence_status: "Hypothesis";
  scoring_eligibility: "none";
};

export type SubmarketMetricDefinition = {
  metricId: SubmarketMetricId;
  label: string;
  weight: number;
  direction: "higher-is-better";
  unit: "index";
};

export type SeattleSubmarketScore = {
  submarketId: string;
  label: string;
  overallScore: number;
  priorityRank: number;
  coveragePercent: number;
  metricResults: Array<{
    metricId: SubmarketMetricId;
    label: string;
    rawValue: number | null;
    normalizedValue: number | null;
    configuredWeight: number;
    effectiveWeight: number;
    contribution: number | null;
    state: "available" | "missing";
  }>;
  missingInputs: SubmarketMetricId[];
  sensitivity: {
    baselineRank: number;
    bestRank: number;
    worstRank: number;
    rankRange: number;
  };
  evidenceStatus: "Hypothesis";
  sourceId: typeof SEATTLE_SUBMARKET_SOURCE_ID;
  allowedUse: "synthetic_prototype_only";
};
