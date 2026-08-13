import { z } from "zod";
import { CAPABILITY_REGISTRY_VERSION } from "../capability-registry.ts";
import {
  evaluationPlanSchema,
  plannedActionSchema,
  type EvaluationPlan,
  type PlannedAction,
} from "./contracts.ts";
import type { InvestigationFollowUp, MarketInvestigation } from "./market-investigation.ts";
import type { AnalysisBrief } from "./analysis-brief.ts";
import {
  evidencePlanSchema,
  evaluationDefinitionDraftSchema,
  type EvidencePlan,
  type EvaluationDefinitionDraft,
} from "./evidence-plan.ts";

export const REVIEWABLE_ACTION_PACKET_VERSION = "reviewable-action-packet-v1" as const;
export const PACKET_SUMMARY_PROMPT_VERSION = "evaluation-packet-findings-summary-v1" as const;

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
  calculationVersions: z.object({
    evaluationPlanVersion: evaluationPlanSchema.shape.version,
    capabilityRegistryVersion: z.literal(CAPABILITY_REGISTRY_VERSION),
    capabilityId: evaluationPlanSchema.shape.capabilityId,
    resultWorkspaceType: evaluationPlanSchema.shape.resultWorkspaceType,
    evidenceSourceIds: z.array(z.string().trim().min(1)).max(12),
  }).strict(),
  action: plannedActionSchema,
  findings: evaluationPlanSchema.shape.findings,
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
      considerationEditsRecalculate: z.literal(false),
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
  analysisAppendix: z.object({
    version: z.literal("1.0.0"),
    planId: z.string().trim().min(1),
    originalQuestion: evaluationPlanSchema.shape.originalQuestion,
    perspectiveId: evaluationPlanSchema.shape.perspectiveId,
    geography: z.literal("CBSA"),
    period: z.string().trim().min(1),
    readiness: z.object({
      label: z.enum(["Partial answer", "Context only"]),
      summary: z.string().trim().min(1),
      missing: z.array(z.string().trim().min(1)),
    }).strict(),
    toolsRun: z.array(z.string().trim().min(1)),
    measuresExamined: z.array(z.string().trim().min(1)),
    comparisonsExamined: z.number().int().nonnegative(),
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
    }).strict()).max(10),
    rejectedPatterns: z.array(z.string().trim().min(1)),
    limitations: z.array(z.string().trim().min(1)),
    sourceIds: z.array(z.string().trim().min(1)),
    allowedUse: z.literal("market_context_only"),
    scoringEligibility: z.literal("none"),
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

function evidenceSourceIdsFor(plan: EvaluationPlan): string[] {
  if (plan.capabilityId === "census_market_context") {
    return ["SRC-014", "SRC-015", "SRC-016"];
  }
  if (plan.capabilityId === "clinic_site_evaluation") {
    return ["SRC-014", "SRC-015", "SRC-016", "SYNTHETIC"];
  }
  return [];
}

export function proposedActionFromPlan(plan: EvaluationPlan): PlannedAction {
  return plan.actions[0];
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
    calculationVersions: {
      evaluationPlanVersion: plan.version,
      capabilityRegistryVersion: CAPABILITY_REGISTRY_VERSION,
      capabilityId: plan.capabilityId,
      resultWorkspaceType: plan.resultWorkspaceType,
      evidenceSourceIds: evidenceSourceIdsFor(plan),
    },
    action,
    findings: plan.findings,
    evidencePlan,
    evaluationDefinition,
    reviewContext,
    analysisBrief,
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
    "### Current screen mechanics",
    `- Inputs: ${packet.analysisBrief.currentScreen.inputs.join("; ")}`,
    `- Method: ${packet.analysisBrief.currentScreen.method}`,
    "- Human consideration edits recalculate this screen: no",
    "",
    "### Considerations",
    ...packet.analysisBrief.considerations.flatMap((item) => [
      `- ${item.label}: ${item.metric}`,
      `  - Role: ${item.role.replaceAll("_", " ")}; evidence: ${item.evidenceStatus}; weight: ${item.weightPercent === null ? "not weighted" : `${item.weightPercent}%`}`,
      `  - Why it matters: ${item.whyItMatters}`,
    ]),
    "",
  ] : [];
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
    `- Measures examined: ${packet.analysisAppendix.measuresExamined.join("; ")}`,
    `- Process: ${packet.analysisAppendix.toolsRun.join(" → ")}`,
    `- Readiness: ${packet.analysisAppendix.readiness.label} — ${packet.analysisAppendix.readiness.summary}`,
    `- Source IDs: ${packet.analysisAppendix.sourceIds.join(", ")}`,
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

export function reviewableActionPacketFilename(packet: ReviewableActionPacket): string {
  const stamp = packet.generatedAt.slice(0, 10);
  const slug = packet.action.id.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `draft-action-packet-${slug}-${stamp}.md`;
}

export function downloadReviewableActionPacket(packet: ReviewableActionPacket) {
  if (typeof document === "undefined") {
    throw new Error("Action packet download requires a browser document.");
  }
  const content = formatReviewableActionPacketDocument(packet);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = reviewableActionPacketFilename(packet);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function deterministicFindingsAndProposalSummary(
  plan: EvaluationPlan,
  action: PlannedAction = proposedActionFromPlan(plan),
): PacketFindingsSummary {
  const interpretation = plan.findings.find((finding) => finding.kind === "interpretation")?.detail
    ?? plan.intent.conciseInterpretation;
  const geography = plan.findings.find((finding) => finding.kind === "geography")?.detail
    ?? plan.geographyResolution.message;
  const evidenceFinding = plan.findings.find((finding) => finding.kind === "evidence");
  const unknownParts = [
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
    evidenceIndicates:
      `The validated plan interprets the question as: ${interpretation} Geographic focus: ${geography} Evidence boundary: ${plan.evidenceBoundary}`,
    whyActionRelevant:
      `The proposed action “${action.title}” is the governed next step compiled for capability ${plan.capabilityId.replaceAll("_", " ")} with ${action.confidence.toLowerCase()} confidence. ${action.summary}`,
    ownerNextStep:
      `${action.owner} should ${action.nextStep} Timing: ${action.timing}.`,
    remainsUnknown: unknownParts.join(" "),
  });
}
