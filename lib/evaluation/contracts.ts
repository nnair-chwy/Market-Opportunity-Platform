import { z } from "zod";

export const evidenceStatusSchema = z.enum([
  "Confirmed",
  "Reported",
  "Derived",
  "Hypothesis",
  "Unknown",
]);
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;

export const requirementOriginSchema = z.enum([
  "user_provided",
  "approved_definition",
  "prototype_default",
  "agent_proposed",
  "unsupported_or_missing",
  "human_approved_run_local",
]);
export type RequirementOrigin = z.infer<typeof requirementOriginSchema>;

export const requirementSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  origin: requirementOriginSchema,
  material: z.boolean(),
  approved: z.boolean(),
});

export const metricDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  inputFields: z.array(z.string().min(1)).min(1),
  formula: z.string().min(1),
  unit: z.string().min(1),
  direction: z.enum(["higher", "lower", "neutral"]),
  weight: z.number().finite().min(0).max(100).optional(),
  threshold: z.number().finite().optional(),
  sourceIds: z.array(z.string().min(1)).min(1),
});

export const validationRuleSchema = z.object({
  type: z.enum(["freshness", "completeness", "minimum_sample", "comparability"]),
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  failurePolicy: z.enum(["block", "warn", "exclude"]),
});

export const operatorInvocationSchema = z.object({
  id: z.string().min(1),
  operator: z.string().min(1),
  label: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
});

export const gateTypeSchema = z.enum([
  "approve_definition",
  "resolve_evidence",
  "approve_action",
]);
export type HumanGateType = z.infer<typeof gateTypeSchema>;

export const evaluationDefinitionSchema = z.object({
  evaluationId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  originalQuestion: z.string().min(1),
  decisionSupported: z.string().min(1),
  proposedDecisionOwner: z.string().min(1),
  entityType: z.string().min(1),
  eligibilityRules: z.array(requirementSchema).min(1),
  geographicScope: z.string().min(1),
  temporalScope: z.string().min(1),
  requiredEvidence: z.array(z.string().min(1)).min(1),
  requiredFields: z.array(z.string().min(1)).min(1),
  metrics: z.array(metricDefinitionSchema).min(1),
  comparisonType: z.enum(["peer", "historical", "threshold", "ranked_alternatives"]),
  cohortRules: z.array(requirementSchema).min(1),
  criteria: z.array(requirementSchema).min(1),
  missingDataPolicy: z.string().min(1),
  validationRules: z.array(validationRuleSchema).min(1),
  decisionBoundary: z.string().min(1),
  permittedActions: z.array(z.string().min(1)).min(1),
  requiredHumanGates: z.array(gateTypeSchema).min(1),
  followUpMetric: z.string().min(1),
  evidenceStatus: evidenceStatusSchema,
  allowedUse: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
  operatorPlan: z.array(operatorInvocationSchema).min(1),
  assumptions: z.array(requirementSchema),
}).strict();

export type EvaluationDefinition = z.infer<typeof evaluationDefinitionSchema>;

export const evaluationStepSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  stepType: z.enum(["interpret", "scope", "rules", "catalog", "gate", "retrieve", "validate", "calculate", "explain", "action"]),
  purpose: z.string().min(1),
  actor: z.enum(["agent", "deterministic_application", "human"]),
  status: z.enum(["pending", "active", "completed", "waiting", "skipped", "blocked"]),
  inputs: z.array(z.string()),
  operator: z.string().nullable(),
  outputSummary: z.string(),
  sourceIds: z.array(z.string()),
  snapshotVersions: z.array(z.string()),
  evidenceStatus: evidenceStatusSchema,
  warnings: z.array(z.string()),
  humanDecisionRequired: z.boolean(),
});
export type EvaluationStep = z.infer<typeof evaluationStepSchema>;

export const humanGateResponseSchema = z.object({
  gateType: gateTypeSchema,
  choice: z.enum(["approve", "revise", "resolve", "reject", "leave_unresolved"]),
  rationale: z.string(),
  respondedAt: z.string().datetime(),
  scope: z.literal("process_local_run"),
});

export const actionPacketSchema = z.object({
  finding: z.string().min(1),
  qualified: z.boolean(),
  entityId: z.string().min(1),
  entityLabel: z.string().min(1),
  comparison: z.string().min(1),
  supportingEvidence: z.array(z.string()).min(1),
  contraryEvidence: z.array(z.string()).min(1),
  missingDiligence: z.array(z.string()),
  draftDisposition: z.string().min(1),
  receivingFunction: z.string().min(1),
  requestedNextStep: z.string().min(1),
  followUpMetric: z.string().min(1),
  approvalState: z.enum(["draft", "approved", "rejected"]),
  evidenceStatus: evidenceStatusSchema,
  allowedUse: z.string().min(1),
});
export type ActionPacket = z.infer<typeof actionPacketSchema>;

export type EvaluationArtifact = {
  id: string;
  type: "geographic_layer" | "entity_list" | "metric_table" | "comparison" | "evidence_detail" | "warning" | "finding" | "action_packet";
  title: string;
  payload: unknown;
  sourceIds: string[];
  snapshotVersions: string[];
  evidenceStatus: EvidenceStatus;
};

export type EvaluationRun = {
  runId: string;
  definitionId: string;
  definitionVersion: string;
  status: "definition_review" | "needs_evidence" | "executed" | "waiting_for_action_review" | "blocked";
  steps: EvaluationStep[];
  artifacts: EvaluationArtifact[];
  humanResponses: z.infer<typeof humanGateResponseSchema>[];
  actionPacket: ActionPacket | null;
  blockers: string[];
  sourceSnapshotVersions: string[];
  reproducibilityKey: string;
  persistence: "process_local_prototype";
};

export const verifiedEvaluationSchema = z.object({
  id: z.string().min(1),
  verifiedQuestion: z.string().min(1),
  approvedInterpretation: z.string().min(1),
  definitionId: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
  metricIds: z.array(z.string().min(1)).min(1),
  comparisonRule: z.string().min(1),
  decisionBoundary: z.string().min(1),
  expectedFixtureResult: z.string().min(1),
  verifiedBy: z.string().min(1),
  verifiedAt: z.string().date(),
  version: z.string().min(1),
  verificationStatus: z.enum(["prototype_test_verified", "business_approved"]),
});
export type VerifiedEvaluation = z.infer<typeof verifiedEvaluationSchema>;

export function materialDefinitionGaps(definition: EvaluationDefinition) {
  return [...definition.eligibilityRules, ...definition.cohortRules, ...definition.criteria, ...definition.assumptions]
    .filter((item) => item.material && !item.approved);
}
