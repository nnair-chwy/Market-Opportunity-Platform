import { z } from "zod";
import { SEATTLE_CBSA_CODE } from "./types.ts";

export const SEATTLE_AGENT_MODEL = "gpt-5.6-terra";
export const SEATTLE_AGENT_PROMPT_VERSION = "seattle-market-deep-dive-agent-v1";
export const SEATTLE_AGENT_TOOL_VERSION = "seattle-market-deep-dive-tools-v1";
export const SEATTLE_AGENT_RUN_VERSION = "seattle-market-deep-dive-run-v1";
export const SEATTLE_AGENT_MAX_STEPS = 7;

export const seattleAgentStatusSchema = z.enum([
  "planned", "collecting", "waiting_for_segmentation_review", "validating",
  "comparing", "preparing_broker_research", "drafting", "completed", "blocked", "failed",
]);
export const seattleAgentToolSchema = z.enum([
  "get_seattle_market_context", "get_proposed_submarkets", "validate_submarket_evidence",
  "compare_submarkets", "get_demo_broker_directory", "check_market_deep_dive_prerequisites",
  "draft_market_deep_dive",
]);
export type SeattleAgentTool = z.infer<typeof seattleAgentToolSchema>;
export const segmentationDecisionSchema = z.enum(["confirm", "reject", "leave_unresolved"]);
export type SegmentationDecision = z.infer<typeof segmentationDecisionSchema>;

const stepSchema = z.object({
  stepId: z.string(), label: z.string(), status: z.enum(["pending", "active", "completed", "waiting", "blocked"]),
}).strict();
const invocationSchema = z.object({
  invocationId: z.string(), toolName: seattleAgentToolSchema,
  status: z.enum(["started", "completed", "failed"]), summary: z.string(), sourceIds: z.array(z.string()),
  startedAt: z.string().datetime(), completedAt: z.string().datetime().nullable(),
}).strict();
const receiptSchema = z.object({
  receiptId: z.string(), label: z.string(), sourceIds: z.array(z.string()),
  evidenceStatuses: z.array(z.enum(["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"])),
  allowedUse: z.string(), scoringEligibility: z.enum(["none", "synthetic_prototype_only"]),
  snapshotVersions: z.array(z.string()), recordedAt: z.string().datetime(),
}).strict();
const decisionRequestSchema = z.object({
  decisionId: z.string(), question: z.string(), reason: z.string(),
  options: z.array(segmentationDecisionSchema), status: z.enum(["pending", "answered"]),
}).strict();
const responseSchema = z.object({
  decisionId: z.string(), decision: segmentationDecisionSchema, note: z.string().max(600).nullable(), respondedAt: z.string().datetime(),
}).strict();
const artifactSchema = z.object({
  artifactId: z.string(), title: z.string(), status: z.enum(["draft_for_review", "draft_blocked"]),
  summary: z.string(), prioritySubmarketIds: z.array(z.string()), remainingItems: z.array(z.string()),
  sourceIds: z.array(z.string()), generatedAt: z.string().datetime(),
}).strict();

export const seattleAgentRunSchema = z.object({
  schemaVersion: z.literal(SEATTLE_AGENT_RUN_VERSION), runId: z.string(), cbsaCode: z.literal(SEATTLE_CBSA_CODE),
  marketName: z.literal("Seattle-Tacoma-Bellevue, WA"), status: seattleAgentStatusSchema, currentStep: z.string(),
  plannedSteps: z.array(stepSchema), toolInvocations: z.array(invocationSchema), evidenceReceipts: z.array(receiptSchema),
  requestedHumanDecisions: z.array(decisionRequestSchema), reviewerResponses: z.array(responseSchema),
  blockers: z.array(z.string()), artifact: artifactSchema.nullable(), comparisonReady: z.boolean(), brokerDirectoryReady: z.boolean(),
  maxSteps: z.literal(SEATTLE_AGENT_MAX_STEPS), stepCount: z.number().int().nonnegative(),
  modelVersion: z.string(), promptVersion: z.string(), toolContractVersion: z.string(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), persistence: z.literal("process_local_prototype"),
}).strict();
export type SeattleAgentRun = z.infer<typeof seattleAgentRunSchema>;

export const createSeattleAgentRunRequestSchema = z.object({ cbsaCode: z.literal(SEATTLE_CBSA_CODE) }).strict();
export const continueSeattleAgentRunRequestSchema = z.object({
  decisionId: z.string().min(1).max(180), decision: segmentationDecisionSchema,
  note: z.string().trim().max(600).nullable().optional(),
}).strict();

export const seattleAgentActionSchema = z.object({
  action: z.literal("call_tool"), toolName: seattleAgentToolSchema,
  explanation: z.string().min(1).max(240)
    .refine((value) => !/\d/.test(value), "Explanations cannot introduce numeric values.")
    .refine((value) => !/\b(?:best|recommend|select|approve|enter the market|sign a lease)\b/i.test(value), "Explanations cannot make a market decision."),
}).strict();
export type SeattleAgentAction = z.infer<typeof seattleAgentActionSchema>;
