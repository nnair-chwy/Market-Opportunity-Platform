import { z } from "zod";

export const AGENT_MODEL = "gpt-5.6-terra";
export const AGENT_PROMPT_VERSION = "candidate-review-agent-v1";
export const AGENT_TOOL_CONTRACT_VERSION = "candidate-review-tools-v1";
export const AGENT_RUN_SCHEMA_VERSION = "candidate-review-run-v1";
export const AGENT_MAX_STEPS = 8;

export const agentRunStatusSchema = z.enum([
  "planned",
  "collecting",
  "validating",
  "waiting_for_review",
  "ready_for_evaluation",
  "completed",
  "blocked",
  "failed",
]);
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;

export const agentToolNameSchema = z.enum([
  "get_candidate_readiness",
  "get_candidate_evidence",
  "get_market_context",
  "validate_candidate_evidence",
  "compare_candidate_evidence",
  "prepare_evidence_request",
  "check_evaluation_prerequisites",
  "run_deterministic_evaluation",
  "draft_review_brief",
]);
export type AgentToolName = z.infer<typeof agentToolNameSchema>;

export const reviewerDecisionSchema = z.enum([
  "confirm",
  "reject",
  "leave_unresolved",
]);
export type ReviewerDecision = z.infer<typeof reviewerDecisionSchema>;

export const evidenceReceiptSchema = z.object({
  receiptId: z.string().min(1),
  toolName: agentToolNameSchema,
  label: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  evidenceStatuses: z.array(
    z.enum(["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"]),
  ),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
  allowedUse: z.string().min(1),
  scoringEligibility: z.enum(["none", "eligible"]),
  snapshotVersions: z.array(z.string().min(1)),
  recordedAt: z.string().datetime(),
});
export type EvidenceReceipt = z.infer<typeof evidenceReceiptSchema>;

export const blockerSchema = z.object({
  blockerId: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  resolution: z.string().min(1),
});
export type AgentBlocker = z.infer<typeof blockerSchema>;

export const humanDecisionRequestSchema = z.object({
  decisionId: z.string().min(1),
  kind: z.literal("trade_area_relationship"),
  question: z.string().min(1),
  reason: z.string().min(1),
  evidence: z.array(
    z.object({
      label: z.string().min(1),
      value: z.string().min(1),
      sourceId: z.string().min(1),
    }),
  ),
  consequences: z.array(z.string().min(1)),
  options: z.array(reviewerDecisionSchema),
  status: z.enum(["pending", "answered"]),
});
export type HumanDecisionRequest = z.infer<typeof humanDecisionRequestSchema>;

export const reviewerResponseSchema = z.object({
  decisionId: z.string().min(1),
  decision: reviewerDecisionSchema,
  selectedTradeAreaId: z.string().min(1).nullable(),
  note: z.string().trim().max(600).nullable(),
  respondedAt: z.string().datetime(),
});
export type ReviewerResponse = z.infer<typeof reviewerResponseSchema>;

export const toolInvocationSchema = z.object({
  invocationId: z.string().min(1),
  toolName: agentToolNameSchema,
  status: z.enum(["started", "completed", "rejected", "failed"]),
  summary: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type ToolInvocation = z.infer<typeof toolInvocationSchema>;

export const agentStepSchema = z.object({
  stepId: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["pending", "active", "completed", "waiting", "blocked"]),
});
export type AgentStep = z.infer<typeof agentStepSchema>;

export const reviewArtifactSchema = z.object({
  artifactId: z.string().min(1),
  briefId: z.string().min(1),
  status: z.enum(["draft_for_review", "draft_blocked", "ready_for_evaluation"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  remainingItems: z.array(z.string().min(1)),
  generatedAt: z.string().datetime(),
});
export type ReviewArtifact = z.infer<typeof reviewArtifactSchema>;

export const agentRunSchema = z.object({
  schemaVersion: z.literal(AGENT_RUN_SCHEMA_VERSION),
  runId: z.string().min(1),
  siteId: z.string().min(1),
  siteLabel: z.string().min(1),
  status: agentRunStatusSchema,
  currentStep: z.string().min(1),
  plannedSteps: z.array(agentStepSchema),
  completedSteps: z.array(z.string().min(1)),
  toolInvocations: z.array(toolInvocationSchema),
  evidenceReceipts: z.array(evidenceReceiptSchema),
  unresolvedBlockers: z.array(blockerSchema),
  requestedHumanDecisions: z.array(humanDecisionRequestSchema),
  reviewerResponses: z.array(reviewerResponseSchema),
  sourceSnapshotVersions: z.array(z.string().min(1)),
  modelVersion: z.string().min(1),
  promptVersion: z.string().min(1),
  toolContractVersion: z.string().min(1),
  generatedArtifactId: z.string().min(1).nullable(),
  artifact: reviewArtifactSchema.nullable(),
  evaluationStatus: z.enum(["not_checked", "blocked", "ready", "completed"]),
  evaluationResultVersion: z.string().min(1).nullable(),
  maxSteps: z.number().int().positive(),
  stepCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  persistence: z.literal("process_local_prototype"),
});
export type AgentRun = z.infer<typeof agentRunSchema>;

export const createAgentRunRequestSchema = z.object({
  siteId: z.string().trim().min(1).max(180),
});

export const continueAgentRunRequestSchema = z.object({
  decisionId: z.string().trim().min(1).max(180),
  decision: reviewerDecisionSchema,
  selectedTradeAreaId: z.string().trim().min(1).max(180).nullable().optional(),
  note: z.string().trim().max(600).nullable().optional(),
});

export const agentModelActionSchema = z.object({
  action: z.enum(["call_tool", "finish"]),
  toolName: agentToolNameSchema.nullable(),
  explanation: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .refine((value) => !/\d/.test(value), "Agent action explanations cannot introduce numeric values.")
    .refine(
      (value) =>
        !/\b(?:recommend|select this site|sign (?:a|the) lease|open (?:a|the) clinic|best (?:site|location)|approve (?:the )?(?:site|location|market))\b/i.test(value),
      "Agent action explanations cannot make a final site decision.",
    ),
}).strict();
export type AgentModelAction = z.infer<typeof agentModelActionSchema>;

export const TERMINAL_RUN_STATUSES: readonly AgentRunStatus[] = [
  "completed",
  "blocked",
  "failed",
] as const;
