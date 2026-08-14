import { z } from "zod";

export const READINESS_QUERY_VERSION = "clinic-market-evidence-readiness-v1" as const;
export const READINESS_CALCULATION_VERSION = "clinic-market-evidence-readiness-calculation-v1" as const;

export const evidenceStatusSchema = z.enum(["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"]);
export const qualityStatusSchema = z.enum(["accepted", "warning", "rejected"]);
export const sensitivitySchema = z.enum(["public", "internal", "confidential", "restricted"]);
export const scoringEligibilitySchema = z.literal("none");

export const canonicalObservationSchema = z.object({
  observation_id: z.string().min(1),
  market_id: z.string().min(1),
  cbsa_code: z.string().regex(/^\d{5}$/).nullable(),
  market_name: z.string().min(1),
  evidence_domain: z.enum(["market_context", "clinic_identity", "clinic_performance", "demand", "marketing", "seo"]),
  metric_id: z.string().min(1),
  raw_value: z.number().finite().nullable(),
  unit: z.string().min(1),
  observed_at: z.string().nullable(),
  source_id: z.string().min(1),
  source_file: z.string().min(1),
  grain: z.string().min(1),
  evidence_status: evidenceStatusSchema,
  quality_status: qualityStatusSchema,
  sensitivity: sensitivitySchema,
  allowed_use: z.string().min(1),
  scoring_eligibility: scoringEligibilitySchema,
  transformation_version: z.string().min(1),
  is_synthetic: z.boolean(),
  warning: z.string().nullable(),
});
export type CanonicalObservation = z.infer<typeof canonicalObservationSchema>;

export const readinessRequestSchema = z.object({
  snapshotVersion: z.string().min(1),
  marketId: z.string().min(1),
});
export type ReadinessRequest = z.infer<typeof readinessRequestSchema>;

export type QualityFinding = {
  findingId: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "failed" | "warning" | "passed";
  check: string;
  message: string;
  evidence: Record<string, string | number | null>;
  impact: string;
  remediation: string;
};

export type QualityReport = {
  reportVersion: "clinic-market-quality-report-v1";
  snapshotVersion: string;
  generatedAt: string;
  intendedUse: string;
  observationCount: number;
  marketCount: number;
  sourceCount: number;
  evidenceCounts: Record<string, number>;
  qualityCounts: Record<string, number>;
  sensitivityCounts: Record<string, number>;
  findings: QualityFinding[];
  status: "ready" | "ready_with_warnings" | "blocked";
  completenessThreshold: number;
  queryVersion: typeof READINESS_QUERY_VERSION;
  calculationVersion: typeof READINESS_CALCULATION_VERSION;
};

export type ReadinessPacket = {
  packetVersion: "clinic-market-evidence-packet-v1";
  packetStatus: "blocked" | "reviewable";
  snapshotVersion: string;
  queryVersion: typeof READINESS_QUERY_VERSION;
  calculationVersion: typeof READINESS_CALCULATION_VERSION;
  market: { marketId: string; cbsaCode: string | null; marketName: string; synthetic: boolean } | null;
  evidence: CanonicalObservation[];
  completeness: { requiredDomains: string[]; availableDomains: string[]; percentage: number; threshold: number };
  blockers: string[];
  warnings: string[];
  missingEvidence: string[];
  qualityFindingIds: string[];
  allowedUse: string;
  scoringEligibility: "none";
};
