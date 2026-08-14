import { z } from "zod";

export const PHOENIX_RETRIEVAL_CONTRACT_VERSION = "phoenix-local-retrieval-v1" as const;

export const clinicEvidenceQuerySchema = z.enum([
  "market_context_by_cbsa",
  "clinic_market_evidence",
  "clinic_profile_by_market",
  "clinic_activity_by_market",
  "regional_demand_by_cbsa_year",
]);

export type ClinicEvidenceQuery = z.infer<typeof clinicEvidenceQuerySchema>;

export const clinicSiteEvidenceRequestSchema = z.object({
  cbsaCode: z.string().regex(/^\d{5}$/),
  cbsaName: z.string().trim().min(1).max(180),
  snapshotVersion: z.string().trim().min(1).max(120),
  year: z.number().int().min(2000).max(2100).nullable(),
}).strict();

export type ClinicSiteEvidenceRequest = z.infer<typeof clinicSiteEvidenceRequestSchema>;

export const retrievalResultSchema = z.object({
  query: clinicEvidenceQuerySchema,
  cacheStatus: z.enum(["miss", "hit"]),
  rows: z.array(z.record(z.string(), z.unknown())),
  sourceIds: z.array(z.string().trim().min(1)),
  warnings: z.array(z.string().trim().min(1)),
  snapshotVersion: z.string().trim().min(1),
}).strict();

export type RetrievalResult = z.infer<typeof retrievalResultSchema>;

export const clinicSiteEvidenceBundleSchema = z.object({
  contractVersion: z.literal(PHOENIX_RETRIEVAL_CONTRACT_VERSION),
  request: clinicSiteEvidenceRequestSchema,
  results: z.array(retrievalResultSchema).min(1),
  sourceIds: z.array(z.string().trim().min(1)),
  availableQueryCount: z.number().int().nonnegative(),
  missingEvidence: z.array(z.string().trim().min(1)),
  warnings: z.array(z.string().trim().min(1)),
  cacheHits: z.number().int().nonnegative(),
}).strict();

export type ClinicSiteEvidenceBundle = z.infer<typeof clinicSiteEvidenceBundleSchema>;

export const clinicResearchStepSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  owner: z.string().trim().min(1),
  priority: z.enum(["next", "later"]),
}).strict();

export type ClinicResearchStep = z.infer<typeof clinicResearchStepSchema>;

export const clinicSiteWorkflowResultSchema = z.object({
  status: z.enum(["complete", "blocked", "research_needed"]),
  interpretation: z.string().trim().min(1),
  evidenceBundles: z.array(clinicSiteEvidenceBundleSchema),
  supportedFindings: z.array(z.string().trim().min(1)),
  contraryEvidence: z.array(z.string().trim().min(1)),
  missingEvidence: z.array(z.string().trim().min(1)),
  warnings: z.array(z.string().trim().min(1)),
  nextResearchSteps: z.array(clinicResearchStepSchema).min(1),
}).strict();

export type ClinicSiteWorkflowResult = z.infer<typeof clinicSiteWorkflowResultSchema>;
