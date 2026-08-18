import { z } from "zod";
import type { AnswerContract } from "./answer-contract.ts";
import type { EvaluationPlan, PlannedAction } from "./contracts.ts";
import {
  checkInvestigationCoverage,
  investigationCoverageReportSchema,
  type InvestigationCoverageReport,
} from "./investigation-coverage.ts";
import type { MarketInvestigation } from "./market-investigation.ts";

export const FINAL_ANSWER_COMPOSER_VERSION = "final-answer-composer-v1" as const;

export const composedAnswerSectionSchema = z.object({
  sectionId: z.enum([
    "direct_answer",
    "evidence_findings",
    "contrary_evidence",
    "uncertainty",
    "missing_evidence",
    "source_and_version_notes",
    "permitted_next_action",
  ]),
  label: z.string().trim().min(1),
  supportStatus: z.enum(["supported", "unsupported", "blocked"]),
  content: z.string().trim().min(1).max(5000),
  sourceIds: z.array(z.string().trim().min(1).max(40)),
}).strict();

export const composedFinalAnswerSchema = z.object({
  version: z.literal(FINAL_ANSWER_COMPOSER_VERSION),
  planId: z.string().trim().min(1),
  contractId: z.string().trim().min(1),
  coverageVersion: investigationCoverageReportSchema.shape.version,
  status: z.enum(["draft_for_review", "research_needed", "clarification", "context_only"]),
  title: z.string().trim().min(1),
  decisionBoundary: z.string().trim().min(1),
  strongestSupportedConclusion: z.string().trim().min(1),
  sections: z.array(composedAnswerSectionSchema).length(7),
  unsupportedRequirementIds: z.array(z.string().trim().min(1)),
  reviewRequiredBy: z.string().trim().min(1),
  disclaimer: z.string().trim().min(1),
}).strict();

export type ComposedFinalAnswer = z.infer<typeof composedFinalAnswerSchema>;

function supportStatus(
  sectionId: AnswerContract["requiredSections"][number]["sectionId"],
  coverage: InvestigationCoverageReport,
): ComposedFinalAnswer["sections"][number]["supportStatus"] {
  const item = coverage.sectionCoverage.find((candidate) => candidate.itemId === sectionId);
  if (!item || item.status === "blocked") return "blocked";
  return item.status === "covered" || item.status === "not_applicable" ? "supported" : "unsupported";
}

function missingEvidenceContent(
  plan: EvaluationPlan,
  investigation: MarketInvestigation | undefined,
  coverage: InvestigationCoverageReport,
) {
  const domainGaps = coverage.domainCoverage
    .filter((item) => item.required && item.status !== "covered" && item.status !== "not_applicable")
    .map((item) => `${item.label}: ${item.explanation}`);
  const gaps = [
    ...plan.missingEvidence.map((item) => `Missing evidence: ${item}`),
    ...plan.missingApprovals.map((item) => `Missing approval: ${item}`),
    ...(investigation?.readiness.missing.map((item) => `Investigation gap: ${item}`) ?? []),
    ...domainGaps,
  ];
  return gaps.length ? gaps.join("\n") : "No unresolved evidence or approval gaps were recorded.";
}

function answerStatus(
  plan: EvaluationPlan,
  coverage: InvestigationCoverageReport,
): ComposedFinalAnswer["status"] {
  if (coverage.overallStatus === "complete") return "draft_for_review";
  if (plan.answerContract.fallbackOutcome === "draft_for_review") return "research_needed";
  return plan.answerContract.fallbackOutcome;
}

export function composeFinalAnswer(
  plan: EvaluationPlan,
  investigation: MarketInvestigation | undefined,
  action: PlannedAction = plan.actions[0],
  coverage = checkInvestigationCoverage(plan, investigation, action),
): ComposedFinalAnswer {
  if (coverage.planId !== plan.planId || coverage.contractId !== plan.answerContract.contractId) {
    throw new Error("The coverage report does not belong to this answer contract.");
  }
  const leads = investigation?.leads ?? [];
  const sources = investigation?.sourceIds ?? [];
  const evidenceTerm = investigation?.evidenceStage === "triangulated_finding" ? "finding" : "signal";
  const completedPath = investigation?.investigationPath
    .filter((step) => step.status === "completed")
    .map((step) => `${step.label}: ${step.result} Contribution: ${step.contributionToAnswer}`)
    .join("\n");
  const directAnswer = !investigation
    ? "The requested answer is blocked because no confirmed investigation result is attached."
    : leads.length
      ? coverage.overallStatus === "complete"
        ? `${coverage.permittedConclusion} The investigation retained ${leads.length} source-linked ${evidenceTerm}(s).`
        : `The investigation retained ${leads.length} bounded ${evidenceTerm}(s), but it does not support the requested decision-level conclusion. ${coverage.permittedConclusion}`
      : `The connected evidence does not support a question-compatible business finding. ${coverage.permittedConclusion}`;
  const portfolioPattern = investigation?.portfolioPattern
    ? `Portfolio pattern: ${investigation.portfolioPattern.headline}. ${investigation.portfolioPattern.summary} ${investigation.portfolioPattern.implication}\n\n`
    : "";
  const findings = leads.length
    ? `${portfolioPattern}${evidenceTerm === "signal" ? "Signals—not final findings—until compatible outcome evidence is connected:" : "Triangulated findings:"}\n${leads.map((lead) => `${lead.title}: ${lead.observation}`).join("\n")}${completedPath ? `\n\nHow the investigation contributed:\n${completedPath}` : ""}`
    : "Unsupported: no question-compatible finding was produced from the permitted evidence.";
  const contrary = investigation
    ? [
      ...investigation.rejectedPatterns.map((item) => `Rejected pattern: ${item}.`),
      ...leads.map((lead) => `${lead.title} — challenge: ${lead.challenge}`),
    ].join("\n") || "Unsupported: the investigation recorded no contrary evidence."
    : "Blocked: contrary evidence cannot be assessed before investigation.";
  const uncertainty = investigation?.limitations.length
    ? investigation.limitations.join("\n")
    : "Unsupported: no uncertainty or sensitivity boundary was recorded.";
  const sourceNotes = investigation
    ? `Sources: ${sources.join(", ") || "none"}. Snapshot: ${investigation.dataSnapshotLabel} (${investigation.dataSnapshotVersion}). Investigation version: ${investigation.version}. Contract: ${plan.answerContract.version}.`
    : `Blocked: no investigation snapshot is attached. Contract: ${plan.answerContract.version}.`;
  const nextAction = `${action.owner} should ${action.nextStep} Timing: ${action.timing}. This remains ${action.requiresApproval ? "subject to the named approval gates" : "a draft review action"}.`;

  const contentBySection: Record<AnswerContract["requiredSections"][number]["sectionId"], string> = {
    direct_answer: directAnswer,
    evidence_findings: findings,
    contrary_evidence: contrary,
    uncertainty,
    missing_evidence: missingEvidenceContent(plan, investigation, coverage),
    source_and_version_notes: sourceNotes,
    permitted_next_action: nextAction,
  };

  return composedFinalAnswerSchema.parse({
    version: FINAL_ANSWER_COMPOSER_VERSION,
    planId: plan.planId,
    contractId: plan.answerContract.contractId,
    coverageVersion: coverage.version,
    status: answerStatus(plan, coverage),
    title: "Contract-complete draft answer",
    decisionBoundary: plan.answerContract.decisionFrame.decisionBoundary,
    strongestSupportedConclusion: coverage.permittedConclusion,
    sections: plan.answerContract.requiredSections.map((section) => ({
      sectionId: section.sectionId,
      label: section.label,
      supportStatus: supportStatus(section.sectionId, coverage),
      content: contentBySection[section.sectionId],
      sourceIds: ["direct_answer", "evidence_findings", "contrary_evidence", "uncertainty", "source_and_version_notes"].includes(section.sectionId)
        ? sources
        : [],
    })),
    unsupportedRequirementIds: coverage.unmetRequiredItemIds,
    reviewRequiredBy: plan.answerContract.audience.accountableReviewer,
    disclaimer: "Draft for accountable human review. Unsupported sections are explicit; this answer does not approve or execute a material business action.",
  });
}
