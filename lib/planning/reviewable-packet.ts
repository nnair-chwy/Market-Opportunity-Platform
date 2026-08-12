import { z } from "zod";
import { CAPABILITY_REGISTRY_VERSION } from "../capability-registry.ts";
import {
  evaluationPlanSchema,
  plannedActionSchema,
  type EvaluationPlan,
  type PlannedAction,
} from "./contracts.ts";

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
): ReviewableActionPacket {
  const placeLabels = plan.geographyResolution.places
    .map((place) => place.cbsaName ?? place.requestedName)
    .filter(Boolean);

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
