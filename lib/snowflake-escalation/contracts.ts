import { z } from "zod";

export const snowflakeQueryTemplateSchema = z.object({
  templateId: z.string().regex(/^[a-z0-9][a-z0-9_]*_v\d+$/),
  perspectiveId: z.enum(["marketing", "pricing", "cvc"]),
  addressesRequirementIds: z.array(z.string().min(1)).min(1),
  owningTeam: z.string().min(3),
  semanticViewConcept: z.string().regex(/^governed_[a-z0-9_]+$/),
  publicationState: z.enum(["available", "publication_required", "access_review_required"]),
  purpose: z.string().min(20),
  requiredMetrics: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1),
  allowedGeographyGrains: z.array(z.enum(["postal", "dma", "cbsa", "trade_area", "drive_time", "clinic_service_area"])).min(1),
  timeGrain: z.enum(["day", "week", "month"]),
  lookbackDays: z.number().int().positive().max(1095),
  minimumGroupSize: z.number().int().min(10),
}).strict();

export const snowflakeQueryTemplateRegistrySchema = z.object({
  version: z.literal("governed-snowflake-query-registry-v1"),
  templates: z.array(snowflakeQueryTemplateSchema).min(1),
}).strict();

const plannedTemplateSchema = snowflakeQueryTemplateSchema.extend({
  requestedRequirementIds: z.array(z.string().min(1)).min(1),
  parameters: z.object({
    metrics: z.array(z.string().min(1)).min(1),
    geographyGrains: z.array(z.string().min(1)).length(1),
    geographyScope: z.enum(["selected_geographies", "approved_market_universe"]),
    geographyIds: z.array(z.string().min(1)),
    timeGrain: z.enum(["day", "week", "month"]),
    lookbackDays: z.number().int().positive(),
    finalizedPeriodsOnly: z.literal(true),
    minimumGroupSize: z.number().int().min(10),
  }).strict(),
}).strict();

export const governedSnowflakeEscalationAssessmentSchema = z.object({
  version: z.literal("governed-snowflake-escalation-v1"),
  runId: z.string().min(1),
  planId: z.string().min(1),
  originalQuestion: z.string().min(3),
  status: z.enum(["local_evidence_sufficient", "snowflake_escalation_required", "governance_review_required"]),
  reason: z.string().min(1),
  localEvidence: z.object({
    executionStatus: z.enum(["complete", "partial", "blocked", "failed"]),
    evidenceIds: z.array(z.string().min(1)),
    sourceIds: z.array(z.string().min(1)),
    coveredRequirementIds: z.array(z.string().min(1)),
    unmetRequirementIds: z.array(z.string().min(1)),
  }).strict(),
  accessRequest: z.object({
    requestType: z.literal("publish_or_grant_read_only_semantic_view"),
    owningTeams: z.array(z.string().min(3)).min(1),
    purpose: z.string().min(20),
    approvedUseBoundary: z.literal("aggregate_internal_decision_support_and_shadow_evaluation_only"),
    prohibitedData: z.array(z.string().min(1)).min(1),
    executionPolicy: z.object({
      mode: z.literal("read_only_template"),
      sqlSource: z.literal("reviewed_template_only"),
      credentialsRequested: z.literal(false),
      externalConnectionAttempted: z.literal(false),
      arbitrarySqlAllowed: z.literal(false),
      materialActionsAllowed: z.literal(false),
    }).strict(),
    templates: z.array(plannedTemplateSchema).min(1),
    unresolvedGovernanceRequirementIds: z.array(z.string().min(1)),
  }).strict().nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.status === "local_evidence_sufficient" && value.accessRequest !== null) ctx.addIssue({ code: "custom", path: ["accessRequest"], message: "Sufficient local evidence cannot create an access request." });
  if (value.status === "snowflake_escalation_required" && value.accessRequest === null) ctx.addIssue({ code: "custom", path: ["accessRequest"], message: "A Snowflake escalation requires a governed query plan." });
});

export type SnowflakeQueryTemplateRegistry = z.infer<typeof snowflakeQueryTemplateRegistrySchema>;
export type GovernedSnowflakeEscalationAssessment = z.infer<typeof governedSnowflakeEscalationAssessmentSchema>;
