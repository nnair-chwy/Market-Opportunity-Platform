import { z } from "zod";
import { CAPABILITY_REGISTRY_VERSION } from "../capability-registry.ts";
import {
  evaluationPlanSchema,
  plannedActionSchema,
  type EvaluationPlan,
  type PlannedAction,
} from "./contracts.ts";
import type { InvestigationFollowUp, InvestigationLead, MarketInvestigation } from "./market-investigation.ts";
import type { AnalysisBrief } from "./analysis-brief.ts";
import type { InsightActionPlan } from "./insight-action-plan.ts";
import {
  evidencePlanSchema,
  evaluationDefinitionDraftSchema,
  type EvidencePlan,
  type EvaluationDefinitionDraft,
} from "./evidence-plan.ts";
import {
  evaluationExecutionResultSchema,
  type EvaluationExecutionResult,
} from "./execution.ts";
import {
  checkInvestigationCoverage,
  investigationCoverageReportSchema,
} from "./investigation-coverage.ts";
import {
  composeFinalAnswer,
  composedFinalAnswerSchema,
} from "./final-answer-composer.ts";

export const REVIEWABLE_ACTION_PACKET_VERSION = "reviewable-action-packet-v1" as const;
export const PACKET_SUMMARY_PROMPT_VERSION = "evaluation-packet-findings-summary-v1" as const;

const insightActionPlanSchema = z.object({
  version: z.literal("1.0.0"),
  planId: z.string().trim().min(1),
  leadId: z.string().trim().min(1),
  marketName: z.string().trim().min(1),
  decisionOwner: z.string().trim().min(1),
  decisionDueDate: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
  whyNow: z.string().trim().min(1),
  whatThisInforms: z.array(z.string().trim().min(1)).min(1),
  workstreams: z.array(z.object({
    id: z.string().trim().min(1),
    sequence: z.number().int().positive(),
    title: z.string().trim().min(1),
    owner: z.string().trim().min(1),
    dueDate: z.string().trim().min(1),
    action: z.string().trim().min(1),
    deliverable: z.string().trim().min(1),
    completionCriteria: z.string().trim().min(1),
    status: z.enum(["ready_to_start", "blocked_on_evidence"]),
  }).strict()).min(1),
  decisionRules: z.array(z.object({
    disposition: z.enum(["advance", "hold", "stop"]),
    rule: z.string().trim().min(1),
  }).strict()).length(3),
  stakeholders: z.array(z.string().trim().min(1)).min(1),
  longerTermConsiderations: z.array(z.string().trim().min(1)).min(1),
  sourcePattern: z.string().trim().min(1),
}).strict();

export const reviewableActionPacketSchema = z.object({
  packetKind: z.literal("draft_action_packet"),
  status: z.literal("draft_for_review"),
  reviewDisclaimer: z.string().trim().min(1),
  packetVersion: z.literal(REVIEWABLE_ACTION_PACKET_VERSION),
  planVersion: evaluationPlanSchema.shape.version,
  planId: z.string().trim().min(1),
  generatedAt: z.string().trim().min(1),
  proposalMethod: evaluationPlanSchema.shape.proposalMethod,
  originalQuestion: evaluationPlanSchema.shape.originalQuestion,
  perspectiveId: evaluationPlanSchema.shape.perspectiveId,
  geographicFocus: z.object({
    mode: evaluationPlanSchema.shape.geographyResolution.shape.mode,
    message: z.string().trim().min(1),
    selectedCbsaCodes: z.array(z.string().trim().min(1).max(5)).max(5),
    placeLabels: z.array(z.string().trim().min(1)).max(8),
  }).strict(),
  evidenceBoundary: evaluationPlanSchema.shape.evidenceBoundary,
  missingEvidence: evaluationPlanSchema.shape.missingEvidence,
  missingApprovals: evaluationPlanSchema.shape.missingApprovals,
  answerContract: evaluationPlanSchema.shape.answerContract,
  answerCoverage: investigationCoverageReportSchema,
  finalAnswer: composedFinalAnswerSchema,
  calculationVersions: z.object({
    evaluationPlanVersion: evaluationPlanSchema.shape.version,
    capabilityRegistryVersion: z.literal(CAPABILITY_REGISTRY_VERSION),
    capabilityId: evaluationPlanSchema.shape.capabilityId,
    resultWorkspaceType: evaluationPlanSchema.shape.resultWorkspaceType,
    evidenceSourceIds: z.array(z.string().trim().min(1)).max(12),
  }).strict(),
  action: plannedActionSchema,
  findings: evaluationPlanSchema.shape.findings,
  execution: evaluationExecutionResultSchema.nullable().optional(),
  evidencePlan: evidencePlanSchema.optional(),
  evaluationDefinition: evaluationDefinitionDraftSchema.optional(),
  reviewContext: z.object({
    selectedLeadId: z.string().trim().min(1).nullable(),
    contextMetric: z.enum(["total_population", "household_count", "median_household_income", "housing_unit_count", "population_density"]),
  }).strict().optional(),
  analysisBrief: z.object({
    version: z.literal("1.0.0"),
    planId: z.string().trim().min(1),
    status: z.enum(["proposed", "confirmed"]),
    originalQuestion: evaluationPlanSchema.shape.originalQuestion,
    rewrittenQuestion: z.string().trim().min(1),
    perspectiveId: evaluationPlanSchema.shape.perspectiveId,
    geography: z.string().trim().min(1),
    timeframe: z.string().trim().min(1),
    assumptions: z.array(z.string().trim().min(1)),
    currentScreen: z.object({
      inputs: z.array(z.string().trim().min(1)),
      method: z.string().trim().min(1),
      considerationEditsRecalculate: z.boolean(),
    }).strict(),
    considerations: z.array(z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      metric: z.string().trim().min(1),
      role: z.enum(["weighted_preference", "validity_gate", "context_only"]),
      evidenceStatus: z.enum(["connected", "partial", "needed"]),
      weightPercent: z.number().min(0).max(100).nullable(),
      whyItMatters: z.string().trim().min(1),
    }).strict()).min(1),
    confirmedAt: z.string().trim().min(1).nullable(),
  }).strict().optional(),
  actionPlan: insightActionPlanSchema.optional(),
  analysisAppendix: z.object({
    version: z.literal("1.0.0"),
    planId: z.string().trim().min(1),
    originalQuestion: evaluationPlanSchema.shape.originalQuestion,
    perspectiveId: evaluationPlanSchema.shape.perspectiveId,
    geography: z.literal("CBSA"),
    period: z.string().trim().min(1),
    dataSnapshotLabel: z.string().trim().min(1),
    dataSnapshotVersion: z.string().trim().min(1),
    readiness: z.object({
      label: z.enum(["Partial answer", "Context only"]),
      summary: z.string().trim().min(1),
      missing: z.array(z.string().trim().min(1)),
    }).strict(),
    toolsRun: z.array(z.string().trim().min(1)),
    measuresExamined: z.array(z.string().trim().min(1)),
    comparisonsExamined: z.number().int().nonnegative(),
    portfolioPattern: z.object({
      headline: z.string().trim().min(1),
      summary: z.string().trim().min(1),
      implication: z.string().trim().min(1),
      segments: z.array(z.object({
        label: z.string().trim().min(1),
        eligibleMarkets: z.number().int().nonnegative(),
        highCpcMarkets: z.number().int().nonnegative(),
        dualPressureMarkets: z.number().int().nonnegative(),
      }).strict()).min(1),
    }).strict().optional(),
    mediaScope: z.object({
      included: z.string().trim().min(1),
      excluded: z.array(z.string().trim().min(1)).min(1),
      bundlingRule: z.string().trim().min(1),
    }).strict().optional(),
    analystRevision: z.object({
      draftNumber: z.number().int().positive(),
      prompt: z.string().trim().min(1).max(600),
      summary: z.string().trim().min(1),
      effectOnRecommendation: z.string().trim().min(1),
      recommendedFollowUp: z.string().trim().min(1),
    }).strict().optional(),
    screeningScope: z.object({
      marketUniverse: z.number().int().nonnegative(),
      eligibleCohort: z.string().trim().min(1),
      eligibleComparisons: z.number().int().nonnegative(),
      allMarketPairs: z.number().int().nonnegative(),
      selectionRule: z.string().trim().min(1),
      executionMode: z.literal("deterministic_local_snapshot"),
    }).strict(),
    leads: z.array(z.object({
      id: z.string().trim().min(1),
      marketIds: z.array(z.string().trim().min(1).max(5)).max(5),
      title: z.string().trim().min(1),
      observation: z.string().trim().min(1),
      businessMeaning: z.string().trim().min(1),
      method: z.string().trim().min(1),
      sampleSize: z.number().int().nonnegative(),
      strength: z.string().trim().min(1),
      challenge: z.string().trim().min(1),
      nextEvidence: z.string().trim().min(1),
      measureValue: z.object({
        label: z.string().trim().min(1),
        rawValue: z.number().finite(),
        formattedValue: z.string().trim().min(1),
        percentile: z.number().int().min(1).max(100),
        rangeMeaning: z.string().trim().min(1),
      }).strict().optional(),
      supportingMeasures: z.array(z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
        formattedValue: z.string().trim().min(1),
        percentile: z.number().int().min(1).max(100),
        rangeMeaning: z.string().trim().min(1),
        role: z.enum(["cost", "response", "attributed_outcome", "comparison", "market_context"]),
      }).strict()).optional(),
    }).strict()).max(10),
    rejectedPatterns: z.array(z.string().trim().min(1)),
    limitations: z.array(z.string().trim().min(1)),
    sourceIds: z.array(z.string().trim().min(1)),
    allowedUse: z.enum(["market_context_only", "internal_shadow_evaluation_only"]),
    scoringEligibility: z.literal("none"),
    evidenceStage: z.enum(["signal", "triangulated_finding"]),
    nextPass: z.object({
      status: z.enum(["waiting_for_evidence", "ready_to_run"]),
      question: z.string().trim().min(1),
      evidenceNeeded: z.array(z.string().trim().min(1)).min(1),
      completionRule: z.string().trim().min(1),
    }).strict(),
    investigationPath: z.array(z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      purpose: z.string().trim().min(1),
      contributionToAnswer: z.string().trim().min(1),
      status: z.enum(["completed", "waiting_for_evidence", "pending"]),
      sourceIds: z.array(z.string().trim().min(1)),
      result: z.string().trim().min(1),
    }).strict()).min(1),
    formula: z.array(z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      weightPercent: z.number().min(0).max(100),
    }).strict()).optional(),
    followUps: z.array(z.object({
      id: z.string().trim().min(1),
      leadId: z.string().trim().min(1),
      question: z.string().trim().min(1),
      answer: z.string().trim().min(1),
    }).strict()),
  }).strict().optional(),
}).strict();

export type ReviewableActionPacket = z.infer<typeof reviewableActionPacketSchema>;

export const packetFindingsSummarySchema = z.object({
  title: z.literal("Findings and proposed action"),
  draftOnlyNotice: z.string().trim().min(1),
  origin: z.enum(["ai", "deterministic_fallback"]),
  state: z.enum([
    "available",
    "deterministic_fallback",
    "not_configured",
    "timeout",
    "provider_error",
    "invalid_structure",
    "validation_rejected",
  ]),
  modelVersion: z.string().trim().min(1).nullable(),
  promptVersion: z.literal(PACKET_SUMMARY_PROMPT_VERSION),
  evidenceIndicates: z.string().trim().min(1).max(600),
  whyActionRelevant: z.string().trim().min(1).max(600),
  ownerNextStep: z.string().trim().min(1).max(600),
  remainsUnknown: z.string().trim().min(1).max(600),
}).strict();

export type PacketFindingsSummary = z.infer<typeof packetFindingsSummarySchema>;

function boundedSummaryText(value: string, maximum = 600) {
  const normalized = value.trim();
  if (normalized.length <= maximum) return normalized;
  const clipped = normalized.slice(0, maximum - 1);
  const lastWordBoundary = clipped.lastIndexOf(" ");
  const readableEnd = lastWordBoundary >= Math.floor(maximum * 0.7)
    ? lastWordBoundary
    : clipped.length;
  return `${clipped.slice(0, readableEnd).trimEnd()}…`;
}

function evidenceSourceIdsFor(plan: EvaluationPlan): string[] {
  if (plan.capabilityId === "census_market_context") {
    return ["SRC-014", "SRC-015", "SRC-016"];
  }
  if (plan.capabilityId === "clinic_site_evaluation") {
    return ["SRC-009", "SRC-014", "SRC-015", "SRC-016"];
  }
  return [];
}

export function proposedActionFromPlan(plan: EvaluationPlan): PlannedAction {
  return plan.actions[0];
}

export function actionForInvestigationLead(
  action: PlannedAction,
  investigation: MarketInvestigation | null,
  lead: InvestigationLead | null,
): PlannedAction {
  if (!investigation || !lead) return action;
  return plannedActionSchema.parse({
    ...action,
    title: `Validate ${lead.title}`,
    summary: lead.businessMeaning,
    confidence: investigation.evidenceStage === "triangulated_finding" ? action.confidence : "Low",
    evidence: [
      `Observed signal: ${lead.observation}`,
      `Selection method: ${lead.method}`,
      `Evidence boundary: ${lead.challenge}`,
    ],
    tradeoffs: [
      lead.challenge,
      ...investigation.limitations.slice(0, 2),
    ],
    nextStep: lead.nextEvidence,
  });
}

export function assembleReviewableActionPacket(
  plan: EvaluationPlan,
  action: PlannedAction = proposedActionFromPlan(plan),
  generatedAt = new Date().toISOString(),
  investigation?: MarketInvestigation,
  followUps: InvestigationFollowUp[] = [],
  analysisBrief?: AnalysisBrief,
  evidencePlan?: EvidencePlan,
  evaluationDefinition?: EvaluationDefinitionDraft,
  reviewContext?: { selectedLeadId: string | null; contextMetric: "total_population" | "household_count" | "median_household_income" | "housing_unit_count" | "population_density" },
  actionPlan?: InsightActionPlan,
  execution: EvaluationExecutionResult | null = null,
): ReviewableActionPacket {
  const placeLabels = plan.geographyResolution.places
    .map((place) => place.cbsaName ?? place.requestedName)
    .filter(Boolean);

  if (investigation && (investigation.planId !== plan.planId || investigation.originalQuestion !== plan.originalQuestion)) {
    throw new Error("The investigation does not belong to this evaluation plan.");
  }
  if (analysisBrief && (analysisBrief.planId !== plan.planId || analysisBrief.originalQuestion !== plan.originalQuestion)) {
    throw new Error("The analysis brief does not belong to this evaluation plan.");
  }
  if (evidencePlan && (evidencePlan.planId !== plan.planId || evidencePlan.originalQuestion !== plan.originalQuestion)) {
    throw new Error("The evidence plan does not belong to this evaluation plan.");
  }
  if (evaluationDefinition && evaluationDefinition.planId !== plan.planId) {
    throw new Error("The evaluation definition does not belong to this evaluation plan.");
  }
  if (reviewContext?.selectedLeadId && !investigation?.leads.some((lead) => lead.id === reviewContext.selectedLeadId)) {
    throw new Error("The selected lead does not belong to this investigation.");
  }
  if (actionPlan && (actionPlan.planId !== plan.planId || !investigation?.leads.some((lead) => lead.id === actionPlan.leadId))) {
    throw new Error("The action plan does not belong to this evaluation plan and investigation.");
  }
  const answerCoverage = checkInvestigationCoverage(plan, investigation, action);
  const finalAnswer = composeFinalAnswer(plan, investigation, action, answerCoverage);

  return reviewableActionPacketSchema.parse({
    packetKind: "draft_action_packet",
    status: "draft_for_review",
    reviewDisclaimer:
      "This file is a draft action packet for human review only. Downloading it does not approve, authorize, or execute any real-estate, campaign, spend, or business action, and it was not sent by email, Slack, or any external channel.",
    packetVersion: REVIEWABLE_ACTION_PACKET_VERSION,
    planVersion: plan.version,
    planId: plan.planId,
    generatedAt,
    proposalMethod: plan.proposalMethod,
    originalQuestion: plan.originalQuestion,
    perspectiveId: plan.perspectiveId,
    geographicFocus: {
      mode: plan.geographyResolution.mode,
      message: plan.geographyResolution.message,
      selectedCbsaCodes: plan.geographyResolution.selectedCbsaCodes,
      placeLabels,
    },
    evidenceBoundary: plan.evidenceBoundary,
    missingEvidence: plan.missingEvidence,
    missingApprovals: plan.missingApprovals,
    answerContract: plan.answerContract,
    answerCoverage,
    finalAnswer,
    calculationVersions: {
      evaluationPlanVersion: plan.version,
      capabilityRegistryVersion: CAPABILITY_REGISTRY_VERSION,
      capabilityId: plan.capabilityId,
      resultWorkspaceType: plan.resultWorkspaceType,
      evidenceSourceIds: evidenceSourceIdsFor(plan),
    },
    action,
    findings: plan.findings,
    execution,
    evidencePlan,
    evaluationDefinition,
    reviewContext,
    analysisBrief,
    actionPlan,
    analysisAppendix: investigation ? { ...investigation, followUps } : undefined,
  });
}

function bulletList(items: string[], emptyLabel: string) {
  if (!items.length) return `- ${emptyLabel}`;
  return items.map((item) => `- ${item}`).join("\n");
}

export function formatReviewableActionPacketDocument(packet: ReviewableActionPacket): string {
  const action = packet.action;
  const focusPlaces = packet.geographicFocus.placeLabels.length
    ? packet.geographicFocus.placeLabels.join("; ")
    : "No named place labels";
  const cbsa = packet.geographicFocus.selectedCbsaCodes.length
    ? packet.geographicFocus.selectedCbsaCodes.join(", ")
    : "None selected";

  const framingSections = packet.analysisBrief ? [
    "## Confirmed analysis framing",
    `- Status: ${packet.analysisBrief.status}`,
    `- Rewritten question: ${packet.analysisBrief.rewrittenQuestion}`,
    `- Perspective: ${packet.analysisBrief.perspectiveId}`,
    `- Geography: ${packet.analysisBrief.geography}`,
    `- Timeframe: ${packet.analysisBrief.timeframe}`,
    "",
    "### Working assumptions",
    bulletList(packet.analysisBrief.assumptions, "None listed"),
    "",
    "### Confirmed calculation mechanics",
    `- Inputs: ${packet.analysisBrief.currentScreen.inputs.join("; ")}`,
    `- Method: ${packet.analysisBrief.currentScreen.method}`,
    `- Human consideration edits recalculate this screen: ${packet.analysisBrief.currentScreen.considerationEditsRecalculate ? "yes" : "no"}`,
    "",
    "### Considerations",
    ...packet.analysisBrief.considerations.flatMap((item) => [
      `- ${item.label}: ${item.metric}`,
      `  - Role: ${item.role.replaceAll("_", " ")}; evidence: ${item.evidenceStatus}; weight: ${item.weightPercent === null ? "not weighted" : `${item.weightPercent}%`}`,
      `  - Why it matters: ${item.whyItMatters}`,
    ]),
    "",
  ] : [];
  const answerContractSections = [
    "## Final-answer contract",
    `- Contract version: ${packet.answerContract.version}`,
    `- Answer mode: ${packet.answerContract.answerMode.replaceAll("_", " ")}`,
    `- Framing origin: ${packet.answerContract.framingProposal.origin.replaceAll("_", " ")}${packet.answerContract.framingProposal.modelVersion ? ` (${packet.answerContract.framingProposal.modelVersion})` : ""}`,
    `- Primary user: ${packet.answerContract.audience.primaryUser}`,
    `- Decision owner: ${packet.answerContract.audience.decisionOwner}`,
    `- Accountable reviewer: ${packet.answerContract.audience.accountableReviewer}`,
    `- Unit of analysis: ${packet.answerContract.decisionFrame.unitOfAnalysis}`,
    `- Strongest permitted conclusion: ${packet.answerContract.strongestPermittedConclusion}`,
    `- Fallback outcome: ${packet.answerContract.fallbackOutcome.replaceAll("_", " ")}`,
    `- Unresolved framing questions: ${packet.answerContract.framingProposal.unresolvedQuestions.join("; ") || "None"}`,
    "",
    "### Required answer sections",
    ...packet.answerContract.requiredSections.map((section) => `- ${section.label}: ${section.purpose}`),
    "",
    `### ${packet.answerContract.perspectiveId.toUpperCase()} answer requirements`,
    ...packet.answerContract.domainRequirements.flatMap((requirement) => [
      `- ${requirement.label}: ${requirement.readiness.replaceAll("_", " ")}`,
      `  - Must answer: ${requirement.questionToAnswer}`,
      `  - Sources: ${requirement.sourceIds.join(", ") || "No governed source identified"}`,
      `  - If unmet: ${requirement.ifUnmet}`,
    ]),
    "",
    "### Completion criteria",
    ...packet.answerContract.completionCriteria.map((criterion) => `- ${criterion.label}`),
    "",
    "### Prohibited conclusions",
    ...packet.answerContract.prohibitedConclusions.map((conclusion) => `- ${conclusion}`),
    "",
  ];
  const answerCoverageSections = [
    "## Investigation coverage against the answer contract",
    `- Coverage version: ${packet.answerCoverage.version}`,
    `- Overall status: ${packet.answerCoverage.overallStatus}`,
    `- Required items covered: ${packet.answerCoverage.coveredRequiredCount} of ${packet.answerCoverage.requiredCount}`,
    `- Strongest supported conclusion: ${packet.answerCoverage.permittedConclusion}`,
    "",
    "### Required answer-section coverage",
    ...packet.answerCoverage.sectionCoverage.map((item) => `- ${item.label}: ${item.status} — ${item.explanation}`),
    "",
    "### Domain-requirement coverage",
    ...packet.answerCoverage.domainCoverage.map((item) => `- ${item.label}: ${item.status} — ${item.explanation}`),
    "",
  ];
  const finalAnswerSections = [
    "## Contract-complete draft answer",
    `- Status: ${packet.finalAnswer.status.replaceAll("_", " ")}`,
    `- Composer version: ${packet.finalAnswer.version}`,
    `- Review required by: ${packet.finalAnswer.reviewRequiredBy}`,
    "",
    packet.finalAnswer.disclaimer,
    "",
    ...packet.finalAnswer.sections.flatMap((section) => [
      `### ${section.label} — ${section.supportStatus}`,
      section.content,
      ...(section.sourceIds.length ? [`Sources: ${section.sourceIds.join(", ")}`] : []),
      "",
    ]),
  ];
  const evidencePlanningSections = packet.evidencePlan && packet.evaluationDefinition ? [
    "## Evidence readiness and generated execution plan",
    `- Status: ${packet.evaluationDefinition.status.replaceAll("_", " ")}`,
    `- Strongest allowed conclusion: ${packet.evaluationDefinition.strongestAllowedConclusion}`,
    `- Available evidence: ${packet.evaluationDefinition.availableEvidenceIds.join(", ") || "None"}`,
    `- Staged for validation (not used): ${packet.evaluationDefinition.stagedEvidenceIds.join(", ") || "None"}`,
    "",
    "### Evidence needs",
    ...packet.evidencePlan.items.flatMap((item) => [
      `- ${item.label}: ${item.availability}`,
      `  - Needed for: ${item.requiredFor}`,
      `  - Allowed use: ${item.allowedUse}`,
      `  - Next: ${item.nextAction}`,
      ...(item.correctionRequest ? [`  - Correction requested: ${item.correctionRequest}`] : []),
    ]),
    "",
    "### Execution steps",
    ...packet.evaluationDefinition.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "### Blockers",
    bulletList(packet.evaluationDefinition.blockers, "None listed"),
    "",
  ] : [];
  const selectedLead = packet.reviewContext?.selectedLeadId
    ? packet.analysisAppendix?.leads.find((lead) => lead.id === packet.reviewContext?.selectedLeadId)
    : undefined;
  const reviewContextSections = packet.reviewContext ? [
    "## Saved review context",
    `- Selected lead: ${selectedLead?.title ?? "No lead selected"}`,
    `- Map context measure: ${packet.reviewContext.contextMetric.replaceAll("_", " ")}`,
    ...(selectedLead ? [
      `- Selected observation: ${selectedLead.observation}`,
      `- Selected boundary: ${selectedLead.challenge}`,
      `- Selected evidence to check next: ${selectedLead.nextEvidence}`,
    ] : []),
    "",
  ] : [];
  const analysisSections = packet.analysisAppendix ? [
    "## Analyst screening",
    `- Perspective: ${packet.analysisAppendix.perspectiveId}`,
    `- Coverage: ${packet.analysisAppendix.comparisonsExamined.toLocaleString()} comparisons screened; ${packet.analysisAppendix.leads.length} review leads kept`,
    `- Screening universe: ${packet.analysisAppendix.screeningScope.marketUniverse} metros; ${packet.analysisAppendix.screeningScope.eligibleComparisons.toLocaleString()} eligible comparisons of ${packet.analysisAppendix.screeningScope.allMarketPairs.toLocaleString()} possible metro pairs`,
    `- Selection rule: ${packet.analysisAppendix.screeningScope.selectionRule}`,
    `- Execution mode: ${packet.analysisAppendix.screeningScope.executionMode.replaceAll("_", " ")}`,
    `- Period: ${packet.analysisAppendix.period}`,
    `- Data snapshot: ${packet.analysisAppendix.dataSnapshotLabel} (${packet.analysisAppendix.dataSnapshotVersion})`,
    `- Measures examined: ${packet.analysisAppendix.measuresExamined.join("; ")}`,
    `- Process: ${packet.analysisAppendix.toolsRun.join(" → ")}`,
    `- Readiness: ${packet.analysisAppendix.readiness.label} — ${packet.analysisAppendix.readiness.summary}`,
    ...(packet.analysisAppendix.portfolioPattern ? [
      `- Portfolio pattern: ${packet.analysisAppendix.portfolioPattern.headline}. ${packet.analysisAppendix.portfolioPattern.summary}`,
      `- Pattern boundary: ${packet.analysisAppendix.portfolioPattern.implication}`,
    ] : []),
    ...(packet.analysisAppendix.mediaScope ? [
      `- Media included: ${packet.analysisAppendix.mediaScope.included}`,
      `- Channel bundling rule: ${packet.analysisAppendix.mediaScope.bundlingRule}`,
      `- Media not included: ${packet.analysisAppendix.mediaScope.excluded.join("; ")}`,
    ] : []),
    ...(packet.analysisAppendix.analystRevision ? [
      `- Draft ${packet.analysisAppendix.analystRevision.draftNumber} analyst direction: ${packet.analysisAppendix.analystRevision.prompt}`,
      `- Revision effect: ${packet.analysisAppendix.analystRevision.effectOnRecommendation}`,
    ] : []),
    `- Source IDs: ${packet.analysisAppendix.sourceIds.join(", ")}`,
    ...(packet.analysisAppendix.formula?.length ? [
      `- Confirmed formula: ${packet.analysisAppendix.formula.map((item) => `${item.label} ${item.weightPercent}%`).join("; ")}`,
    ] : []),
    "",
    "### Question-specific leads",
    ...packet.analysisAppendix.leads.flatMap((lead, index) => [
      `#### ${index + 1}. ${lead.title}`,
      `- Observation: ${lead.observation}`,
      `- Why it matters: ${lead.businessMeaning}`,
      `- Method: ${lead.method}`,
      `- Strength: ${lead.strength} (n=${lead.sampleSize})`,
      `- Boundary: ${lead.challenge}`,
      `- Evidence to check next: ${lead.nextEvidence}`,
      "",
    ]),
    "### Rejected patterns and limitations",
    bulletList(packet.analysisAppendix.rejectedPatterns, "None listed"),
    "",
    bulletList(packet.analysisAppendix.limitations, "None listed"),
    "",
    ...(packet.analysisAppendix.followUps.length ? [
      "### Lead-scoped follow-ups",
      ...packet.analysisAppendix.followUps.flatMap((turn) => [
        `- Question: ${turn.question}`,
        `- Answer: ${turn.answer}`,
      ]),
      "",
    ] : []),
  ] : [];
  const actionPlanSections = packet.actionPlan ? [
    "## Decision handoff",
    `- Recommendation: ${packet.actionPlan.recommendation}`,
    `- Market: ${packet.actionPlan.marketName}`,
    `- Decision owner: ${packet.actionPlan.decisionOwner}`,
    `- Decision review date: ${packet.actionPlan.decisionDueDate}`,
    `- Why now: ${packet.actionPlan.whyNow}`,
    "",
    "### What this will inform",
    bulletList(packet.actionPlan.whatThisInforms, "None listed"),
    "",
    "### Do this next",
    `- ${packet.actionPlan.workstreams[0].title}`,
    `  - Owner: ${packet.actionPlan.workstreams[0].owner}`,
    `  - Due: ${packet.actionPlan.workstreams[0].dueDate}`,
    `  - Action: ${packet.actionPlan.workstreams[0].action}`,
    `  - Deliverable: ${packet.actionPlan.workstreams[0].deliverable}`,
    `  - Done when: ${packet.actionPlan.workstreams[0].completionCriteria}`,
    "",
    "### Validation workplan",
    ...packet.actionPlan.workstreams.flatMap((workstream) => [
      `#### ${workstream.sequence}. ${workstream.title}`,
      `- Status: ${workstream.status.replaceAll("_", " ")}`,
      `- Owner: ${workstream.owner}`,
      `- Due: ${workstream.dueDate}`,
      `- Action: ${workstream.action}`,
      `- Deliverable: ${workstream.deliverable}`,
      `- Done when: ${workstream.completionCriteria}`,
      "",
    ]),
    "### Decision rules",
    ...packet.actionPlan.decisionRules.map((item) => `- ${item.disposition[0].toUpperCase()}${item.disposition.slice(1)}: ${item.rule}`),
    "",
    "### Stakeholders to involve",
    bulletList(packet.actionPlan.stakeholders, "None listed"),
    "",
    "### Longer-term considerations",
    bulletList(packet.actionPlan.longerTermConsiderations, "None listed"),
    "",
    `Research structure used: ${packet.actionPlan.sourcePattern}`,
    "",
  ] : [];

  return [
    "# Draft action packet (reviewable)",
    "",
    packet.reviewDisclaimer,
    "",
    "## Status",
    `- Packet status: ${packet.status.replaceAll("_", " ")}`,
    `- Packet kind: ${packet.packetKind.replaceAll("_", " ")}`,
    `- Packet version: ${packet.packetVersion}`,
    `- Plan version: ${packet.planVersion}`,
    `- Plan ID: ${packet.planId}`,
    `- Generated at: ${packet.generatedAt}`,
    `- Proposal method: ${packet.proposalMethod.replaceAll("_", " ")}`,
    "",
    "## Original question",
    packet.originalQuestion,
    `Perspective: ${packet.perspectiveId}`,
    "",
    "## Geographic focus",
    `- Mode: ${packet.geographicFocus.mode.replaceAll("_", " ")}`,
    `- Message: ${packet.geographicFocus.message}`,
    `- Selected CBSA codes: ${cbsa}`,
    `- Places: ${focusPlaces}`,
    "",
    "## Evidence boundary",
    packet.evidenceBoundary,
    "",
    "## Missing evidence",
    bulletList(packet.missingEvidence, "None listed"),
    "",
    "## Missing approvals",
    bulletList(packet.missingApprovals, "None listed"),
    "",
    "## Calculation and evidence versions",
    `- Evaluation plan version: ${packet.calculationVersions.evaluationPlanVersion}`,
    `- Capability registry version: ${packet.calculationVersions.capabilityRegistryVersion}`,
    `- Capability: ${packet.calculationVersions.capabilityId}`,
    `- Result workspace: ${packet.calculationVersions.resultWorkspaceType}`,
    `- Evidence source IDs: ${packet.calculationVersions.evidenceSourceIds.join(", ") || "None declared"}`,
    "",
    ...(packet.actionPlan ? [] : [
      "## Proposed action",
      `- Title: ${action.title}`,
      `- Summary: ${action.summary}`,
      `- Owner: ${action.owner}`,
      `- Timing: ${action.timing}`,
      `- Confidence: ${action.confidence}`,
      `- Next step: ${action.nextStep}`,
      `- Output ID: ${action.outputId}`,
      `- Requires approval: ${action.requiresApproval ? "yes" : "no"}`,
      "",
      "### Evidence considered",
      bulletList(action.evidence, "None listed"),
      "",
      "### Tradeoffs",
      bulletList(action.tradeoffs, "None listed"),
      "",
    ]),
    ...actionPlanSections,
    ...answerContractSections,
    ...answerCoverageSections,
    ...finalAnswerSections,
    ...framingSections,
    ...evidencePlanningSections,
    ...reviewContextSections,
    ...analysisSections,
    "## Structured findings",
    ...packet.findings.flatMap((finding) => [
      `### ${finding.title}`,
      finding.detail,
      "",
    ]),
    "## Structured packet (JSON)",
    "```json",
    JSON.stringify(packet, null, 2),
    "```",
    "",
  ].join("\n");
}

function finalAnswerSection(
  packet: ReviewableActionPacket,
  sectionId: ReviewableActionPacket["finalAnswer"]["sections"][number]["sectionId"],
) {
  return packet.finalAnswer.sections.find((section) => section.sectionId === sectionId);
}

export function formatDecisionBriefDocument(packet: ReviewableActionPacket): string {
  const directAnswer = finalAnswerSection(packet, "direct_answer");
  const nextAction = finalAnswerSection(packet, "permitted_next_action");
  const owner = packet.actionPlan?.decisionOwner ?? packet.action.owner;
  const reviewDate = packet.actionPlan?.decisionDueDate ?? packet.action.timing;
  const recommendation = packet.actionPlan?.recommendation ?? packet.action.summary;
  const places = packet.geographicFocus.placeLabels.join("; ") || packet.geographicFocus.message;
  const coveragePercent = packet.answerCoverage.requiredCount
    ? Math.round((packet.answerCoverage.coveredRequiredCount / packet.answerCoverage.requiredCount) * 100)
    : 0;
  const isDecisionReady = packet.answerCoverage.overallStatus === "complete";
  const evidenceLabel = packet.analysisAppendix?.evidenceStage === "triangulated_finding"
    ? "Triangulated findings"
    : "Screening signals—not final findings";
  const selectedLead = packet.reviewContext?.selectedLeadId
    ? packet.analysisAppendix?.leads.find((lead) => lead.id === packet.reviewContext?.selectedLeadId)
    : packet.analysisAppendix?.leads[0];
  const orderedLeads = packet.analysisAppendix
    ? [
      ...(selectedLead ? [selectedLead] : []),
      ...packet.analysisAppendix.leads.filter((lead) => lead.id !== selectedLead?.id),
    ].slice(0, 4)
    : [];
  const unmetRequirements = packet.answerCoverage.domainCoverage
    .filter((item) => item.required && item.status !== "covered" && item.status !== "not_applicable")
    .slice(0, 5);
  const challengeNotes = Array.from(new Set([
    ...(selectedLead?.challenge ? [selectedLead.challenge] : []),
    ...(packet.analysisAppendix?.rejectedPatterns ?? []),
    ...(packet.analysisAppendix?.limitations ?? []),
  ])).slice(0, 4);
  const firstWorkstream = packet.actionPlan?.workstreams[0];
  const sourceIds = packet.analysisAppendix?.sourceIds
    ?? packet.calculationVersions.evidenceSourceIds;
  const decisionStatus = isDecisionReady
    ? "Ready for accountable review"
    : "Research needed before a decision-level recommendation";
  const boundedRecommendation = isDecisionReady
    ? recommendation
    : `Do not treat the current ${packet.analysisAppendix?.evidenceStage === "signal" ? "screening signal" : "partial evidence"} as authorization for a material action. ${recommendation}`;

  return [
    `# Decision brief: ${packet.originalQuestion}`,
    "",
    `> **${decisionStatus}.** ${packet.reviewDisclaimer}`,
    "",
    "## Recommendation",
    boundedRecommendation,
    "",
    `- **Decision owner:** ${owner}`,
    `- **Review timing:** ${reviewDate}`,
    `- **Geography:** ${places}`,
    `- **Evidence coverage:** ${packet.answerCoverage.coveredRequiredCount} of ${packet.answerCoverage.requiredCount} required items (${coveragePercent}%)`,
    "",
    "## What the evidence supports",
    directAnswer?.content ?? packet.answerCoverage.permittedConclusion,
    "",
    ...(packet.analysisAppendix?.portfolioPattern ? [
      "## Portfolio pattern",
      `**${packet.analysisAppendix.portfolioPattern.headline}.**`,
      packet.analysisAppendix.portfolioPattern.summary,
      "",
      packet.analysisAppendix.portfolioPattern.implication,
      "",
    ] : []),
    ...(packet.analysisAppendix?.analystRevision ? [
      `## Draft ${packet.analysisAppendix.analystRevision.draftNumber} analyst revision`,
      `**Direction:** ${packet.analysisAppendix.analystRevision.prompt}`,
      "",
      packet.analysisAppendix.analystRevision.effectOnRecommendation,
      "",
    ] : []),
    `## ${evidenceLabel}`,
    ...(orderedLeads.length ? orderedLeads.flatMap((lead) => [
      `### ${lead.title}`,
      `- **Observed:** ${lead.observation}`,
      `- **Why it matters:** ${lead.businessMeaning}`,
      `- **Interpretation boundary:** ${lead.challenge}`,
      "",
    ]) : ["No question-compatible regional finding was produced from the permitted evidence.", ""]),
    "## What is still unknown",
    ...(unmetRequirements.length
      ? unmetRequirements.map((item) => `- **${item.label}:** ${item.explanation}`)
      : ["- No required evidence gap remains in the answer contract."]),
    "",
    "## Checks that could change the conclusion",
    ...(challengeNotes.length ? challengeNotes.map((item) => `- ${item}`) : ["- No additional challenge was recorded."]),
    "",
    "## Recommended next action",
    ...(firstWorkstream ? [
      `**${firstWorkstream.title}**`,
      "",
      `- **Owner:** ${firstWorkstream.owner}`,
      `- **Due:** ${firstWorkstream.dueDate}`,
      `- **Action:** ${firstWorkstream.action}`,
      `- **Deliverable:** ${firstWorkstream.deliverable}`,
      `- **Done when:** ${firstWorkstream.completionCriteria}`,
    ] : [nextAction?.content ?? `${packet.action.owner} should ${packet.action.nextStep}`]),
    "",
    "## Evidence and review record",
    `- **Answer status:** ${packet.finalAnswer.status.replaceAll("_", " ")}`,
    `- **Strongest permitted conclusion:** ${packet.finalAnswer.strongestSupportedConclusion}`,
    `- **Sources:** ${sourceIds.join(", ") || "No governed source recorded"}`,
    `- **Snapshot:** ${packet.analysisAppendix ? `${packet.analysisAppendix.dataSnapshotLabel} (${packet.analysisAppendix.dataSnapshotVersion})` : "See audit appendix"}`,
    `- **Accountable reviewer:** ${packet.finalAnswer.reviewRequiredBy}`,
    "",
    "---",
    "The audit appendix contains the full answer contract, calculation method, coverage checks, limitations, source versions, and structured record.",
    "",
  ].join("\n");
}

export function reviewableActionPacketFilename(packet: ReviewableActionPacket): string {
  const stamp = packet.generatedAt.slice(0, 10);
  const slug = packet.action.id.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `draft-action-packet-${slug}-${stamp}.md`;
}

export function decisionBriefFilename(packet: ReviewableActionPacket): string {
  const stamp = packet.generatedAt.slice(0, 10);
  const slug = packet.action.id.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `draft-decision-brief-${slug}-${stamp}.md`;
}

function downloadMarkdown(content: string, filename: string) {
  if (typeof document === "undefined") {
    throw new Error("Document download requires a browser document.");
  }
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadDecisionBrief(packet: ReviewableActionPacket) {
  downloadMarkdown(formatDecisionBriefDocument(packet), decisionBriefFilename(packet));
}

export function downloadReviewableActionPacket(packet: ReviewableActionPacket) {
  downloadMarkdown(formatReviewableActionPacketDocument(packet), reviewableActionPacketFilename(packet));
}

export function deterministicFindingsAndProposalSummary(
  plan: EvaluationPlan,
  action: PlannedAction = proposedActionFromPlan(plan),
  investigation?: MarketInvestigation,
): PacketFindingsSummary {
  const interpretation = plan.findings.find((finding) => finding.kind === "interpretation")?.detail
    ?? plan.intent.conciseInterpretation;
  const geography = plan.findings.find((finding) => finding.kind === "geography")?.detail
    ?? plan.geographyResolution.message;
  const evidenceFinding = plan.findings.find((finding) => finding.kind === "evidence");
  const unknownParts = [
    investigation?.readiness.missing.length ? `Investigation gaps: ${investigation.readiness.missing.join("; ")}.` : null,
    plan.missingEvidence.length ? `Missing evidence: ${plan.missingEvidence.join("; ")}.` : null,
    plan.missingApprovals.length ? `Missing approvals: ${plan.missingApprovals.join("; ")}.` : null,
    evidenceFinding?.detail ?? null,
    "This draft does not approve spend, leases, openings, campaigns, or other material actions.",
  ].filter(Boolean);

  return packetFindingsSummarySchema.parse({
    title: "Findings and proposed action",
    draftOnlyNotice:
      "AI-generated draft summary for human review only. It restates the validated plan and proposed action packet and is not a final real-estate or business decision.",
    origin: "deterministic_fallback",
    state: "deterministic_fallback",
    modelVersion: null,
    promptVersion: PACKET_SUMMARY_PROMPT_VERSION,
    evidenceIndicates: boundedSummaryText(
      investigation?.leads.length
        ? `${investigation.evidenceStage === "signal" ? "Joined screening signals" : "Findings"}: ${investigation.leads.slice(0, 3).map((lead) => `${lead.title} — ${lead.observation}`).join(" ")}`
        : `The validated plan interprets the question as: ${interpretation} Geographic focus: ${geography} Evidence boundary: ${plan.evidenceBoundary}`,
    ),
    whyActionRelevant: boundedSummaryText(
      investigation?.leads[0]
        ? `${investigation.leads[0].businessMeaning} Important boundary: ${investigation.leads[0].challenge}`
        : `The proposed action “${action.title}” is the governed next step compiled for capability ${plan.capabilityId.replaceAll("_", " ")} with ${action.confidence.toLowerCase()} confidence. ${action.summary}`,
    ),
    ownerNextStep: boundedSummaryText(
      investigation
        ? `${action.owner} should answer the next evidence question: ${investigation.nextPass.question} Required evidence: ${investigation.nextPass.evidenceNeeded.join("; ")}.`
        : `${action.owner} should ${action.nextStep} Timing: ${action.timing}.`,
    ),
    remainsUnknown: boundedSummaryText(unknownParts.join(" ")),
  });
}
