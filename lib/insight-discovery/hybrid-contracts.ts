import { z } from "zod";
import { normalizedQueryNameSchema } from "../data-normalization/contracts.ts";
import { perspectiveIdSchema, perspectiveViewIdSchema } from "../perspectives/contracts.ts";
import { exploratoryQuerySpecSchema } from "./exploratory-query.ts";

export const HYBRID_DISCOVERY_VERSION = "hybrid-insight-discovery-v1" as const;
export const HYBRID_DISCOVERY_PROMPT_VERSION = "hybrid-discovery-investigator-v1" as const;
export const HYBRID_DISCOVERY_MAX_STEPS = 5;
export const HYBRID_DISCOVERY_MAX_RESULT_ROWS = 50;

export const hybridDiscoveryRequestSchema = z.object({
  mode: z.enum(["deterministic", "hybrid"]).default("hybrid"),
  department: perspectiveIdSchema.optional(),
  maxSteps: z.number().int().min(1).max(HYBRID_DISCOVERY_MAX_STEPS).default(3),
  maxResultRows: z.number().int().min(1).max(HYBRID_DISCOVERY_MAX_RESULT_ROWS).default(25),
  normalizedSnapshotVersion: z.string().trim().min(1).max(160).optional(),
  previousRunId: z.string().trim().min(1).max(240).optional(),
  previousPrimaryFindingIds: z.array(z.string().trim().min(1).max(240)).max(100).default([]),
}).strict();
export type HybridDiscoveryRequest = z.infer<typeof hybridDiscoveryRequestSchema>;

export const marketScreenInvocationSchema = z.object({
  kind: z.literal("market_screen"),
  perspectiveId: perspectiveIdSchema,
  viewId: perspectiveViewIdSchema,
  cbsaCodes: z.array(z.string().regex(/^\d{5}$/)).max(5),
}).strict();

export const registeredQueryInvocationSchema = z.object({
  kind: z.literal("registered_query"),
  query: normalizedQueryNameSchema,
  cbsaCode: z.string().regex(/^\d{5}$/).optional(),
}).strict().superRefine((value, context) => {
  const needsCbsa = ["regional_context_by_cbsa", "clinic_context_by_cbsa", "google_ads_context_by_cbsa"].includes(value.query);
  if (needsCbsa && !value.cbsaCode) context.addIssue({ code: "custom", path: ["cbsaCode"], message: "This registered query requires a CBSA code." });
  if (!needsCbsa && value.cbsaCode) context.addIssue({ code: "custom", path: ["cbsaCode"], message: "This registered query does not accept a CBSA code." });
});

export const hybridInvestigatorInvocationSchema = z.discriminatedUnion("kind", [
  marketScreenInvocationSchema,
  registeredQueryInvocationSchema,
  z.object({ kind: z.literal("exploratory_query"), spec: exploratoryQuerySpecSchema }).strict(),
]);
export type HybridInvestigatorInvocation = z.infer<typeof hybridInvestigatorInvocationSchema>;

export const hybridInvestigatorActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("execute"),
    objective: z.string().trim().min(3).max(240),
    decisionValueHypothesis: z.string().trim().min(3).max(360),
    invocation: hybridInvestigatorInvocationSchema,
  }).strict(),
  z.object({
    action: z.literal("finish"),
    summary: z.string().trim().min(3).max(360),
  }).strict(),
]);
export type HybridInvestigatorAction = z.infer<typeof hybridInvestigatorActionSchema>;

// The model-facing contract is deliberately flat and fully required. OpenAI
// Structured Outputs requires an object root and does not accept optional
// properties; the application converts this envelope into the stricter
// discriminated action contract before anything can execute.
export const hybridInvestigatorResponseSchema = z.object({
  action: z.enum(["execute", "finish"]),
  objective: z.string().max(240),
  decisionValueHypothesis: z.string().max(360),
  summary: z.string().max(360),
  invocationKind: z.enum(["market_screen", "registered_query", "exploratory_query"]).nullable(),
  perspectiveId: perspectiveIdSchema.nullable(),
  viewId: perspectiveViewIdSchema.nullable(),
  cbsaCodes: z.array(z.string().regex(/^\d{5}$/)).max(5),
  registeredQuery: normalizedQueryNameSchema.nullable(),
  registeredCbsaCode: z.string().regex(/^\d{5}$/).nullable(),
  exploratorySpecJson: z.string().max(12_000).nullable(),
}).strict();

const investigationReceiptSchema = z.object({
  kind: z.enum(["market_screen", "registered_query", "exploratory_query"]),
  fingerprint: z.string(),
  objective: z.string(),
  status: z.enum(["accepted", "rejected", "failed"]),
  noveltyScore: z.number().int().min(0).max(100),
  decisionValueScore: z.number().int().min(0).max(100),
  reason: z.string(),
  rowCount: z.number().int().nonnegative(),
  leadCount: z.number().int().nonnegative(),
  marketIds: z.array(z.string()),
  sourceIds: z.array(z.string()),
  measureLabels: z.array(z.string()),
  warnings: z.array(z.string()),
  lineage: z.object({
    queryFingerprint: z.string(),
    tableIds: z.array(z.string()),
    tables: z.array(z.object({ tableId: z.string(), tableName: z.string(), grain: z.string(), sourceIds: z.array(z.string()) }).strict()),
    selectedColumns: z.array(z.string()),
    filterColumns: z.array(z.string()),
    joinRule: z.literal("cbsaCode_equality_only"),
    parametersBound: z.number().int().nonnegative(),
    readOnly: z.literal(true),
  }).strict().nullable(),
}).strict();
export type HybridInvestigationReceipt = z.infer<typeof investigationReceiptSchema>;

export const hybridDiscoveryAuditSchema = z.object({
  version: z.literal(HYBRID_DISCOVERY_VERSION),
  mode: z.enum(["deterministic_only", "hybrid_completed", "hybrid_fallback"]),
  modelVersion: z.string().nullable(),
  promptVersion: z.literal(HYBRID_DISCOVERY_PROMPT_VERSION),
  maxSteps: z.number().int().min(1).max(HYBRID_DISCOVERY_MAX_STEPS),
  stepsAttempted: z.number().int().nonnegative(),
  acceptedInvestigationCount: z.number().int().nonnegative(),
  terminationReason: z.enum(["deterministic_requested", "model_not_configured", "model_finished", "step_limit", "failure_limit", "model_error"]),
  fallbackReason: z.string().nullable(),
  receipts: z.array(investigationReceiptSchema),
  guarantees: z.array(z.string()),
}).strict();
export type HybridDiscoveryAudit = z.infer<typeof hybridDiscoveryAuditSchema>;
