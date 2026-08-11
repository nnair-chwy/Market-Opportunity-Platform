import { z } from "zod";
import {
  EVIDENCE_STATUSES,
  SENSITIVITIES,
} from "./data/types.ts";
import type {
  EvaluationInput as ClinicEvaluationInput,
  ScoringConfiguration as ClinicScoringConfiguration,
} from "./scoring.ts";

export const EVALUATION_CONTRACT_VERSION = "1.0.0" as const;

const identifierSchema = z.string().trim().min(1).max(180);
const versionSchema = z.string().trim().min(1).max(120);
const sourceIdSchema = z.string().trim().min(1).max(180);
const nullableDateSchema = z.iso.date().nullable();
const nullableDateTimeSchema = z.iso.datetime().nullable();

export const evidenceStatusSchema = z.enum(EVIDENCE_STATUSES);
export const sensitivitySchema = z.enum(SENSITIVITIES);
export const geographyGrainSchema = z.enum([
  "point",
  "radius",
  "drive_time",
  "site",
  "trade_area",
  "submarket",
  "market",
  "cbsa",
  "region",
  "portfolio",
  "other",
  "unknown",
]);

export const geographyScopeSchema = z.object({
  grain: geographyGrainSchema,
  geographyId: identifierSchema.nullable(),
  label: z.string().trim().min(1).max(240).nullable(),
  method: z.string().trim().min(1).max(500).nullable(),
  version: versionSchema.nullable(),
}).strict();

export const timeScopeSchema = z.object({
  asOfDate: nullableDateSchema,
  startDate: nullableDateSchema,
  endDate: nullableDateSchema,
  label: z.string().trim().min(1).max(240),
}).strict().superRefine((scope, context) => {
  if (scope.startDate && scope.endDate && scope.startDate > scope.endDate) {
    context.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "The time-scope end date cannot precede its start date.",
    });
  }
});

export const eligibilitySchema = z.object({
  status: z.enum(["eligible", "ineligible", "conditional", "unknown"]),
  scoringEligibility: z.enum(["none", "synthetic_prototype_only", "eligible"]),
  allowedUse: z.string().trim().min(1).max(180),
  reasons: z.array(z.string().trim().min(1).max(600)),
}).strict();

export const aiInterpretationSchema = z.object({
  status: z.literal("proposed"),
  text: z.string().trim().min(1).max(10_000),
  modelVersion: versionSchema,
  promptVersion: versionSchema,
  generatedAt: z.iso.datetime(),
  sourceIds: z.array(sourceIdSchema),
}).strict();

export const humanApprovedInterpretationSchema = z.object({
  status: z.literal("approved"),
  text: z.string().trim().min(1).max(10_000),
  reviewerId: identifierSchema,
  approvedAt: z.iso.datetime(),
  sourceIds: z.array(sourceIdSchema),
}).strict();

export const evidenceRecordSchema = z.object({
  evidenceId: identifierSchema,
  label: z.string().trim().min(1).max(240),
  evidenceStatus: evidenceStatusSchema,
  availability: z.enum([
    "available",
    "missing",
    "unknown",
    "restricted",
    "rejected",
  ]),
  value: z.json().nullable(),
  unit: z.string().trim().min(1).max(120).nullable(),
  geography: geographyScopeSchema,
  timeScope: timeScopeSchema,
  eligibility: eligibilitySchema,
  sourceIds: z.array(sourceIdSchema),
  provenance: z.object({
    observationId: identifierSchema.nullable(),
    snapshotVersion: versionSchema.nullable(),
    transformation: z.string().trim().min(1).max(500).nullable(),
    observedAt: nullableDateTimeSchema,
    recordedAt: nullableDateTimeSchema,
  }).strict(),
  sensitivity: sensitivitySchema,
  qualityStatus: z.enum(["accepted", "warning", "rejected", "unknown"]),
  limitations: z.array(z.string().trim().min(1).max(600)),
  aiProposedInterpretation: aiInterpretationSchema.nullable(),
  humanApprovedInterpretation: humanApprovedInterpretationSchema.nullable(),
}).strict().superRefine((record, context) => {
  if (record.availability !== "available" && record.value !== null) {
    context.addIssue({
      code: "custom",
      path: ["value"],
      message: "Unavailable evidence must preserve a null value; it cannot be inferred.",
    });
  }
  if (
    (record.availability === "missing" || record.availability === "unknown") &&
    record.evidenceStatus !== "Unknown" &&
    record.evidenceStatus !== "Hypothesis"
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidenceStatus"],
      message: "Missing or unknown evidence must remain Unknown or an explicit Hypothesis.",
    });
  }
});
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;

export const requiredEvidenceSpecSchema = z.object({
  evidenceId: identifierSchema,
  purpose: z.string().trim().min(1).max(500),
  requiredFor: z.enum(["eligibility", "threshold", "formula", "weight", "artifact", "action"]),
  allowMissing: z.boolean(),
  missingDataRuleId: identifierSchema,
}).strict();

export const questionSpecSchema = z.object({
  questionId: identifierSchema,
  version: versionSchema,
  text: z.string().trim().min(1).max(2_000),
  decisionType: identifierSchema,
  geography: geographyScopeSchema,
  timeScope: timeScopeSchema,
  eligibility: eligibilitySchema,
  requiredEvidence: z.array(requiredEvidenceSpecSchema),
  permittedActionIds: z.array(identifierSchema),
  approvalGateIds: z.array(identifierSchema),
}).strict();
export type QuestionSpec = z.infer<typeof questionSpecSchema>;

export const decisionGraphNodeSchema = z.object({
  nodeId: identifierSchema,
  kind: z.enum([
    "question",
    "eligibility",
    "evidence",
    "formula",
    "threshold",
    "human_review",
    "artifact",
    "action",
  ]),
  referenceId: identifierSchema,
  label: z.string().trim().min(1).max(240),
}).strict();

export const decisionGraphSchema = z.object({
  graphId: identifierSchema,
  version: versionSchema,
  entryNodeId: identifierSchema,
  nodes: z.array(decisionGraphNodeSchema).min(1),
  edges: z.array(z.object({
    edgeId: identifierSchema,
    fromNodeId: identifierSchema,
    toNodeId: identifierSchema,
    condition: z.string().trim().min(1).max(500),
    outcome: z.enum(["continue", "block", "require_review", "complete"]),
  }).strict()),
}).strict().superRefine((graph, context) => {
  const nodeIds = new Set(graph.nodes.map((node) => node.nodeId));
  if (!nodeIds.has(graph.entryNodeId)) {
    context.addIssue({ code: "custom", path: ["entryNodeId"], message: "Entry node is not present in the graph." });
  }
  graph.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      context.addIssue({
        code: "custom",
        path: ["edges", index],
        message: "Graph edges must reference existing nodes.",
      });
    }
  });
});
export type DecisionGraph = z.infer<typeof decisionGraphSchema>;

export const capabilitySchema = z.object({
  capabilityId: identifierSchema,
  kind: z.enum([
    "evidence_access",
    "deterministic_calculation",
    "ai_interpretation",
    "human_review",
    "artifact_generation",
    "action_preparation",
  ]),
  availability: z.enum(["available", "unavailable", "unknown"]),
  syntheticOnly: z.boolean(),
  sourceIds: z.array(sourceIdSchema),
  restrictions: z.array(z.string().trim().min(1).max(600)),
}).strict();
export type Capability = z.infer<typeof capabilitySchema>;

export const artifactSpecSchema = z.object({
  artifactId: identifierSchema,
  version: versionSchema,
  kind: z.enum(["evidence_brief", "comparison", "evaluation_result", "action_packet"]),
  title: z.string().trim().min(1).max(240),
  requiredEvidenceIds: z.array(identifierSchema),
  status: z.enum(["draft_only", "review_required", "approved_template"]),
  allowedUse: z.string().trim().min(1).max(180),
  sensitivity: sensitivitySchema,
  approvalGateIds: z.array(identifierSchema),
}).strict();
export type ArtifactSpec = z.infer<typeof artifactSpecSchema>;

export const formulaSpecSchema = z.object({
  formulaId: identifierSchema,
  version: versionSchema,
  expression: z.string().trim().min(1).max(2_000),
  inputEvidenceIds: z.array(identifierSchema).min(1),
  outputUnit: z.string().trim().min(1).max(120),
  deterministic: z.literal(true),
  sourceIds: z.array(sourceIdSchema),
}).strict();

export const thresholdSpecSchema = z.object({
  thresholdId: identifierSchema,
  evidenceId: identifierSchema,
  operator: z.enum(["gte", "gt", "lte", "lt", "eq"]),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(120),
  missingDataRuleId: identifierSchema,
  sourceIds: z.array(sourceIdSchema),
}).strict();

export const weightSpecSchema = z.object({
  evidenceId: identifierSchema,
  weight: z.number().finite().nonnegative(),
  included: z.boolean(),
  rationale: z.string().trim().min(1).max(600),
  sourceIds: z.array(sourceIdSchema),
}).strict();

export const missingDataRuleSchema = z.object({
  ruleId: identifierSchema,
  behavior: z.enum([
    "fail_evaluation",
    "exclude_and_renormalize",
    "report_only",
    "require_human_review",
  ]),
  imputationPermitted: z.literal(false),
  description: z.string().trim().min(1).max(600),
}).strict();

export const approvalGateSchema = z.object({
  gateId: identifierSchema,
  label: z.string().trim().min(1).max(240),
  requiredRole: z.string().trim().min(1).max(180),
  status: z.enum(["required", "satisfied", "rejected", "unknown"]),
  approvedBy: identifierSchema.nullable(),
  approvedAt: nullableDateTimeSchema,
  scope: z.string().trim().min(1).max(500),
}).strict().superRefine((gate, context) => {
  const hasReceipt = gate.approvedBy !== null || gate.approvedAt !== null;
  if (gate.status === "satisfied" && (!gate.approvedBy || !gate.approvedAt)) {
    context.addIssue({ code: "custom", path: ["status"], message: "A satisfied gate requires an approval receipt." });
  } else if (gate.status !== "satisfied" && hasReceipt) {
    context.addIssue({ code: "custom", path: ["approvedBy"], message: "Unsatisfied gates cannot contain an approval receipt." });
  }
});

export const permittedActionSchema = z.object({
  actionId: identifierSchema,
  label: z.string().trim().min(1).max(240),
  kind: z.enum(["prepare", "compare", "request_evidence", "draft", "record_human_decision"]),
  aiMayPropose: z.boolean(),
  humanApprovalRequired: z.boolean(),
  approvalGateIds: z.array(identifierSchema),
  prohibitedEffects: z.array(z.string().trim().min(1).max(500)),
}).strict().superRefine((action, context) => {
  if (action.humanApprovalRequired && action.approvalGateIds.length === 0) {
    context.addIssue({ code: "custom", path: ["approvalGateIds"], message: "Human-approved actions require at least one approval gate." });
  }
});

function duplicateIds(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => seen.size === seen.add(value).size);
}

export const evaluationContractSchema = z.object({
  contractVersion: z.literal(EVALUATION_CONTRACT_VERSION),
  contractId: identifierSchema,
  contractRevision: versionSchema,
  domain: z.string().trim().min(1).max(180),
  status: z.enum(["synthetic", "draft", "approved"]),
  question: questionSpecSchema,
  decisionGraph: decisionGraphSchema,
  capabilities: z.array(capabilitySchema),
  evidence: z.array(evidenceRecordSchema),
  formulas: z.array(formulaSpecSchema),
  thresholds: z.array(thresholdSpecSchema),
  weights: z.array(weightSpecSchema),
  expectedWeightTotal: z.number().finite().positive().nullable(),
  missingDataRules: z.array(missingDataRuleSchema),
  artifacts: z.array(artifactSpecSchema),
  permittedActions: z.array(permittedActionSchema),
  approvalGates: z.array(approvalGateSchema),
  contractApproval: z.object({
    approvedBy: identifierSchema,
    approvedAt: z.iso.datetime(),
  }).strict().nullable(),
  sourceIds: z.array(sourceIdSchema),
}).strict().superRefine((contract, context) => {
  if (contract.status === "approved" && contract.contractApproval === null) {
    context.addIssue({ code: "custom", path: ["contractApproval"], message: "Approved contracts require an approval receipt." });
  }
  if (contract.status !== "approved" && contract.contractApproval !== null) {
    context.addIssue({ code: "custom", path: ["contractApproval"], message: "Only approved contracts may contain a contract approval receipt." });
  }

  const collections = [
    ["evidence", contract.evidence.map((item) => item.evidenceId)],
    ["formulas", contract.formulas.map((item) => item.formulaId)],
    ["thresholds", contract.thresholds.map((item) => item.thresholdId)],
    ["missingDataRules", contract.missingDataRules.map((item) => item.ruleId)],
    ["artifacts", contract.artifacts.map((item) => item.artifactId)],
    ["permittedActions", contract.permittedActions.map((item) => item.actionId)],
    ["approvalGates", contract.approvalGates.map((item) => item.gateId)],
  ] as const;
  for (const [path, ids] of collections) {
    if (duplicateIds(ids).length > 0) {
      context.addIssue({ code: "custom", path: [path], message: `${path} identifiers must be unique.` });
    }
  }

  const evidenceIds = new Set(contract.evidence.map((item) => item.evidenceId));
  const ruleIds = new Set(contract.missingDataRules.map((item) => item.ruleId));
  const actionIds = new Set(contract.permittedActions.map((item) => item.actionId));
  const gateIds = new Set(contract.approvalGates.map((item) => item.gateId));
  contract.question.requiredEvidence.forEach((required, index) => {
    if (!evidenceIds.has(required.evidenceId) || !ruleIds.has(required.missingDataRuleId)) {
      context.addIssue({ code: "custom", path: ["question", "requiredEvidence", index], message: "Required evidence must reference an evidence record and missing-data rule." });
    }
  });
  if (contract.question.permittedActionIds.some((id) => !actionIds.has(id))) {
    context.addIssue({ code: "custom", path: ["question", "permittedActionIds"], message: "Question references an unknown permitted action." });
  }
  if (contract.question.approvalGateIds.some((id) => !gateIds.has(id))) {
    context.addIssue({ code: "custom", path: ["question", "approvalGateIds"], message: "Question references an unknown approval gate." });
  }
  contract.thresholds.forEach((threshold, index) => {
    if (!evidenceIds.has(threshold.evidenceId) || !ruleIds.has(threshold.missingDataRuleId)) {
      context.addIssue({ code: "custom", path: ["thresholds", index], message: "Threshold references unknown evidence or missing-data policy." });
    }
  });
  contract.formulas.forEach((formula, index) => {
    if (formula.inputEvidenceIds.some((id) => !evidenceIds.has(id))) {
      context.addIssue({ code: "custom", path: ["formulas", index, "inputEvidenceIds"], message: "Formula references unknown evidence." });
    }
  });
  contract.weights.forEach((weight, index) => {
    if (!evidenceIds.has(weight.evidenceId)) {
      context.addIssue({ code: "custom", path: ["weights", index, "evidenceId"], message: "Weight references unknown evidence." });
    }
  });
  contract.artifacts.forEach((artifact, index) => {
    if (
      artifact.requiredEvidenceIds.some((id) => !evidenceIds.has(id)) ||
      artifact.approvalGateIds.some((id) => !gateIds.has(id))
    ) {
      context.addIssue({ code: "custom", path: ["artifacts", index], message: "Artifact references unknown evidence or approval gates." });
    }
  });
  contract.permittedActions.forEach((action, index) => {
    if (action.approvalGateIds.some((id) => !gateIds.has(id))) {
      context.addIssue({ code: "custom", path: ["permittedActions", index, "approvalGateIds"], message: "Action references an unknown approval gate." });
    }
  });

  const includedWeight = contract.weights.reduce((sum, item) => item.included ? sum + item.weight : sum, 0);
  if (
    (contract.weights.length === 0) !== (contract.expectedWeightTotal === null) ||
    (contract.expectedWeightTotal !== null && Math.abs(includedWeight - contract.expectedWeightTotal) > 1e-9)
  ) {
    context.addIssue({ code: "custom", path: ["expectedWeightTotal"], message: "Included weights must equal the explicit expected total; absent weights require null." });
  }
});
export type EvaluationContract = z.infer<typeof evaluationContractSchema>;

export const actionPacketSchema = z.object({
  packetId: identifierSchema,
  packetVersion: versionSchema,
  contractId: identifierSchema,
  contractRevision: versionSchema,
  status: z.enum(["incomplete", "draft_for_review", "awaiting_human_review", "approved_for_permitted_action", "blocked"]),
  generatedAt: z.iso.datetime(),
  evidence: z.array(evidenceRecordSchema),
  missingEvidenceIds: z.array(identifierSchema),
  proposedAiInterpretation: aiInterpretationSchema.nullable(),
  humanApprovedInterpretation: humanApprovedInterpretationSchema.nullable(),
  actions: z.array(z.object({
    actionId: identifierSchema,
    status: z.enum(["proposed", "approved", "rejected", "blocked"]),
    proposedBy: z.enum(["deterministic_system", "ai", "human"]),
    rationale: z.string().trim().min(1).max(2_000),
    approvalGateIds: z.array(identifierSchema),
  }).strict()),
  approvalGates: z.array(approvalGateSchema),
  artifactIds: z.array(identifierSchema),
  sourceIds: z.array(sourceIdSchema),
}).strict().superRefine((packet, context) => {
  const pendingGate = packet.approvalGates.some((gate) => gate.status !== "satisfied");
  const approvedAction = packet.actions.some((action) => action.status === "approved");
  if (approvedAction && pendingGate) {
    context.addIssue({ code: "custom", path: ["actions"], message: "An action cannot be approved while a required approval gate is unsatisfied." });
  }
  if (packet.status === "approved_for_permitted_action" && (!approvedAction || pendingGate)) {
    context.addIssue({ code: "custom", path: ["status"], message: "Approved packet status requires an approved action and satisfied gates." });
  }
  if (packet.proposedAiInterpretation && packet.humanApprovedInterpretation?.text === packet.proposedAiInterpretation.text) {
    // Equal text is allowed, but the distinct receipt fields above remain mandatory.
  }
});
export type ActionPacket = z.infer<typeof actionPacketSchema>;

function clinicGeography(value: string): z.infer<typeof geographyScopeSchema> {
  return {
    grain: value.includes("drive") ? "drive_time" : value.includes("market") ? "market" : "other",
    geographyId: null,
    label: value || "Unknown geography",
    method: null,
    version: null,
  };
}

function clinicTimeScope(observedAt: string | null): z.infer<typeof timeScopeSchema> {
  const date = observedAt?.slice(0, 10) ?? null;
  return { asOfDate: date, startDate: null, endDate: null, label: date ?? "Unknown time scope" };
}

export function createClinicEvaluationContract(
  input: ClinicEvaluationInput,
  configuration: ClinicScoringConfiguration,
): EvaluationContract {
  const metricRules = configuration.metricDefinitions.map((definition) => ({
    ruleId: `missing:${definition.metricId}`,
    behavior: definition.missingDataPolicy === "fail-evaluation"
      ? "fail_evaluation" as const
      : "exclude_and_renormalize" as const,
    imputationPermitted: false as const,
    description: definition.missingDataPolicy === "fail-evaluation"
      ? "Do not calculate when this metric is missing."
      : "Exclude missing values and visibly renormalize available configured weight.",
  }));
  const constraintRules = configuration.constraints.map((constraint) => ({
    ruleId: `missing:${constraint.constraintId}`,
    behavior: constraint.missingPolicy === "fail" ? "fail_evaluation" as const : "report_only" as const,
    imputationPermitted: false as const,
    description: "Preserve missing constraint evidence as null and do not infer a pass.",
  }));

  const metricEvidence: EvidenceRecord[] = configuration.metricDefinitions.map((definition) => {
    const observation = input.metricObservations.find((item) => item.metricId === definition.metricId);
    const available = observation?.rawValue !== null && observation?.rawValue !== undefined;
    return {
      evidenceId: `metric:${definition.metricId}`,
      label: definition.name,
      evidenceStatus: available ? (configuration.status === "synthetic" ? "Hypothesis" : "Reported") : "Unknown",
      availability: available ? "available" : "missing",
      value: available ? observation.rawValue : null,
      unit: observation?.unit ?? definition.unit,
      geography: clinicGeography(observation?.geography ?? "unknown"),
      timeScope: clinicTimeScope(observation?.observedAt ?? null),
      eligibility: {
        status: available ? "eligible" : "unknown",
        scoringEligibility: configuration.status === "synthetic" ? "synthetic_prototype_only" : "eligible",
        allowedUse: configuration.status === "synthetic" ? "synthetic_prototype_only" : "approved_clinic_evaluation",
        reasons: available ? [] : ["Required observation is missing."],
      },
      sourceIds: observation ? [observation.sourceReference.sourceId] : definition.sourceIds,
      provenance: {
        observationId: observation?.sourceReference.observationId ?? null,
        snapshotVersion: input.inputDataVersion,
        transformation: null,
        observedAt: observation ? `${observation.observedAt}T00:00:00.000Z` : null,
        recordedAt: null,
      },
      sensitivity: observation?.sensitivity ?? "internal",
      qualityStatus: observation?.qualityStatus ?? "unknown",
      limitations: available ? [] : ["No observation was supplied; no value was inferred."],
      aiProposedInterpretation: null,
      humanApprovedInterpretation: null,
    };
  });

  const constraintEvidence: EvidenceRecord[] = configuration.constraints.map((definition) => {
    const observation = input.constraintObservations.find((item) => item.constraintId === definition.constraintId);
    const available = observation?.rawValue !== null && observation?.rawValue !== undefined;
    return {
      evidenceId: `constraint:${definition.constraintId}`,
      label: definition.name,
      evidenceStatus: available ? (configuration.status === "synthetic" ? "Hypothesis" : "Reported") : "Unknown",
      availability: available ? "available" : "missing",
      value: available ? observation.rawValue : null,
      unit: observation?.unit ?? definition.unit,
      geography: clinicGeography("site"),
      timeScope: clinicTimeScope(observation?.observedAt ?? null),
      eligibility: {
        status: available ? "eligible" : "unknown",
        scoringEligibility: configuration.status === "synthetic" ? "synthetic_prototype_only" : "eligible",
        allowedUse: configuration.status === "synthetic" ? "synthetic_prototype_only" : "approved_clinic_evaluation",
        reasons: available ? [] : ["Required constraint observation is missing."],
      },
      sourceIds: observation ? [observation.sourceReference.sourceId] : definition.sourceIds,
      provenance: {
        observationId: observation?.sourceReference.observationId ?? null,
        snapshotVersion: input.inputDataVersion,
        transformation: null,
        observedAt: observation ? `${observation.observedAt}T00:00:00.000Z` : null,
        recordedAt: null,
      },
      sensitivity: observation?.sensitivity ?? "internal",
      qualityStatus: observation?.qualityStatus ?? "unknown",
      limitations: available ? [] : ["No constraint value was supplied; no outcome was inferred."],
      aiProposedInterpretation: null,
      humanApprovedInterpretation: null,
    };
  });

  const qualitativeEvidence: EvidenceRecord[] = input.qualitativeEvidence.map((item) => ({
    evidenceId: `qualitative:${item.evidenceId}`,
    label: item.evidenceId,
    evidenceStatus: configuration.status === "synthetic" ? "Hypothesis" : "Reported",
    availability: "available",
    value: null,
    unit: null,
    geography: clinicGeography("unknown"),
    timeScope: clinicTimeScope(null),
    eligibility: {
      status: "eligible",
      scoringEligibility: "none",
      allowedUse: configuration.status === "synthetic" ? "synthetic_prototype_only" : "qualitative_context_only",
      reasons: ["Qualitative evidence is retained for review and never enters clinic scoring formulas."],
    },
    sourceIds: [item.sourceReference.sourceId],
    provenance: {
      observationId: item.sourceReference.observationId ?? null,
      snapshotVersion: input.inputDataVersion,
      transformation: null,
      observedAt: null,
      recordedAt: null,
    },
    sensitivity: "internal",
    qualityStatus: "unknown",
    limitations: ["The clinic scoring input contains a source reference but no qualitative text."],
    aiProposedInterpretation: null,
    humanApprovedInterpretation: null,
  }));

  const evidence = [...metricEvidence, ...constraintEvidence, ...qualitativeEvidence];
  const actionId = "prepare-clinic-review-packet";
  const gateId = "clinic-final-decision-review";
  const sourceIds = [...new Set(evidence.flatMap((item) => item.sourceIds))];
  const contract: EvaluationContract = {
    contractVersion: EVALUATION_CONTRACT_VERSION,
    contractId: `clinic:${input.siteId}:${configuration.scoringVersion}`,
    contractRevision: configuration.scoringVersion,
    domain: "clinic_location_evaluation",
    status: configuration.status === "approved" ? "approved" : "synthetic",
    question: {
      questionId: `clinic:${input.siteId}`,
      version: configuration.scoringVersion,
      text: `Evaluate clinic candidate ${input.siteId} under the supplied deterministic configuration.`,
      decisionType: "clinic_candidate_review",
      geography: { grain: "site", geographyId: input.siteId, label: input.siteId, method: null, version: null },
      timeScope: clinicTimeScope(null),
      eligibility: {
        status: "conditional",
        scoringEligibility: configuration.status === "synthetic" ? "synthetic_prototype_only" : "eligible",
        allowedUse: configuration.status === "synthetic" ? "synthetic_prototype_only" : "approved_clinic_evaluation",
        reasons: ["Eligibility remains subject to deterministic constraints and human review."],
      },
      requiredEvidence: [
        ...configuration.metricDefinitions.map((item) => ({
          evidenceId: `metric:${item.metricId}`,
          purpose: "Configured clinic evaluation metric.",
          requiredFor: "formula" as const,
          allowMissing: item.missingDataPolicy !== "fail-evaluation",
          missingDataRuleId: `missing:${item.metricId}`,
        })),
        ...configuration.constraints.map((item) => ({
          evidenceId: `constraint:${item.constraintId}`,
          purpose: "Configured clinic eligibility threshold.",
          requiredFor: "threshold" as const,
          allowMissing: item.missingPolicy !== "fail",
          missingDataRuleId: `missing:${item.constraintId}`,
        })),
      ],
      permittedActionIds: [actionId],
      approvalGateIds: [gateId],
    },
    decisionGraph: {
      graphId: `clinic-graph:${configuration.scoringVersion}`,
      version: configuration.scoringVersion,
      entryNodeId: "question",
      nodes: [
        { nodeId: "question", kind: "question", referenceId: `clinic:${input.siteId}`, label: "Clinic evaluation question" },
        { nodeId: "evidence", kind: "evidence", referenceId: "clinic-required-evidence", label: "Validate required evidence" },
        { nodeId: "formula", kind: "formula", referenceId: "clinic-deterministic-score", label: "Run deterministic formulas" },
        { nodeId: "review", kind: "human_review", referenceId: gateId, label: "Human decision review" },
        { nodeId: "artifact", kind: "artifact", referenceId: "clinic-review-packet", label: "Prepare review packet" },
      ],
      edges: [
        { edgeId: "question-evidence", fromNodeId: "question", toNodeId: "evidence", condition: "Question is in scope.", outcome: "continue" },
        { edgeId: "evidence-formula", fromNodeId: "evidence", toNodeId: "formula", condition: "Required scoring evidence passes validation.", outcome: "continue" },
        { edgeId: "formula-review", fromNodeId: "formula", toNodeId: "review", condition: "Structured result is available for review.", outcome: "require_review" },
        { edgeId: "review-artifact", fromNodeId: "review", toNodeId: "artifact", condition: "Reviewer records an interpretation.", outcome: "complete" },
      ],
    },
    capabilities: [
      { capabilityId: "clinic-deterministic-scoring", kind: "deterministic_calculation", availability: "available", syntheticOnly: configuration.status === "synthetic", sourceIds, restrictions: ["Calculations may use only supplied validated inputs and configuration."] },
      { capabilityId: "clinic-ai-explanation", kind: "ai_interpretation", availability: "available", syntheticOnly: configuration.status === "synthetic", sourceIds, restrictions: ["AI may propose explanations only and cannot change weights, thresholds, evidence, or decisions."] },
      { capabilityId: "clinic-human-review", kind: "human_review", availability: "available", syntheticOnly: false, sourceIds, restrictions: ["A human reviewer remains accountable for any material decision."] },
    ],
    evidence,
    formulas: configuration.metricDefinitions.map((definition) => ({
      formulaId: `normalize:${definition.metricId}`,
      version: definition.normalization.version,
      expression: `${definition.normalization.function} normalization (${definition.direction})`,
      inputEvidenceIds: [`metric:${definition.metricId}`],
      outputUnit: "normalized_score",
      deterministic: true,
      sourceIds: definition.sourceIds,
    })),
    thresholds: configuration.constraints.map((constraint) => ({
      thresholdId: constraint.constraintId,
      evidenceId: `constraint:${constraint.constraintId}`,
      operator: constraint.operator,
      value: constraint.threshold,
      unit: constraint.unit,
      missingDataRuleId: `missing:${constraint.constraintId}`,
      sourceIds: constraint.sourceIds,
    })),
    weights: configuration.metricWeights.map((weight) => ({
      evidenceId: `metric:${weight.metricId}`,
      weight: weight.weight,
      included: weight.included,
      rationale: weight.included ? configuration.notes : weight.exclusionReason ?? "Excluded by configuration.",
      sourceIds: configuration.metricDefinitions.find((item) => item.metricId === weight.metricId)?.sourceIds ?? [],
    })),
    expectedWeightTotal: configuration.expectedWeightTotal,
    missingDataRules: [...metricRules, ...constraintRules],
    artifacts: [{
      artifactId: "clinic-review-packet",
      version: configuration.scoringVersion,
      kind: "action_packet",
      title: "Clinic candidate review packet",
      requiredEvidenceIds: evidence.map((item) => item.evidenceId),
      status: "review_required",
      allowedUse: configuration.status === "synthetic" ? "synthetic_prototype_only" : "draft_for_human_review",
      sensitivity: "internal",
      approvalGateIds: [gateId],
    }],
    permittedActions: [{
      actionId,
      label: "Prepare a clinic review packet",
      kind: "prepare",
      aiMayPropose: true,
      humanApprovalRequired: false,
      approvalGateIds: [],
      prohibitedEffects: ["No lease, spend, hiring, opening, or final site decision may be approved."],
    }],
    approvalGates: [{
      gateId,
      label: "Final clinic decision remains human-owned",
      requiredRole: "Authorized clinic real-estate reviewer",
      status: "required",
      approvedBy: null,
      approvedAt: null,
      scope: "Any material clinic site, lease, opening, spend, or staffing decision.",
    }],
    contractApproval: configuration.status === "approved"
      ? { approvedBy: configuration.approvedBy!, approvedAt: configuration.approvedAt! }
      : null,
    sourceIds,
  };
  return evaluationContractSchema.parse(contract);
}
