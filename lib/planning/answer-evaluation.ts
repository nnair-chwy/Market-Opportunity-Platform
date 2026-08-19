import { z } from "zod";
import type { EvaluationPlan, PlannedAction } from "./contracts.ts";
import type { InvestigationCoverageReport } from "./investigation-coverage.ts";
import type { MarketInvestigation } from "./market-investigation.ts";
import { evaluateActionDirection } from "./action-direction.ts";

export const ANSWER_EVALUATION_VERSION = "answer-evaluation-v1" as const;

export const answerCompletionEvaluationSchema = z.object({
  criterionId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  status: z.enum(["pass", "partial", "fail"]),
  explanation: z.string().trim().min(1),
  evidenceIds: z.array(z.string().trim().min(1)),
}).strict();

export const answerEvaluationReportSchema = z.object({
  version: z.literal(ANSWER_EVALUATION_VERSION),
  planId: z.string().trim().min(1),
  contractId: z.string().trim().min(1),
  overallStatus: z.enum(["pass", "partial", "fail"]),
  passedCount: z.number().int().nonnegative(),
  criterionCount: z.number().int().nonnegative(),
  criteria: z.array(answerCompletionEvaluationSchema).min(1),
  unmetCriterionIds: z.array(z.string().trim().min(1)),
  nextPass: z.object({
    status: z.enum(["ready_for_review", "research_needed"]),
    question: z.string().trim().min(1),
    evidenceNeeded: z.array(z.string().trim().min(1)).min(1),
    completionRule: z.string().trim().min(1),
  }).strict(),
}).strict();

export type AnswerEvaluationReport = z.infer<typeof answerEvaluationReportSchema>;

function materialActionLanguage(value: string) {
  return /\b(approve|authorize|open|sign|change|increase|decrease|shift|set|raise|lower)\b.*\b(price|pricing|spend|budget|clinic|site|lease|footprint)\b/i.test(value);
}

export function evaluateAnswerCompletion(
  plan: EvaluationPlan,
  investigation: MarketInvestigation | undefined,
  coverage: InvestigationCoverageReport,
  action: PlannedAction = plan.actions[0],
): AnswerEvaluationReport {
  if (coverage.planId !== plan.planId || coverage.contractId !== plan.answerContract.contractId) {
    throw new Error("The answer coverage report does not belong to this evaluation plan.");
  }
  const sourceIds = investigation?.sourceIds ?? [];
  const leadIds = investigation?.leads.map((lead) => lead.id) ?? [];
  const evidenceIds = [...new Set([...sourceIds, ...leadIds])];
  const section = (id: string) => coverage.sectionCoverage.find((item) => item.itemId === id);
  const requiredDomains = coverage.domainCoverage.filter((item) => item.required && item.status !== "not_applicable");
  const coveredDomains = requiredDomains.filter((item) => item.status === "covered");

  const evaluations = plan.answerContract.completionCriteria.map((criterion) => {
    let status: "pass" | "partial" | "fail" = "fail";
    let explanation = "The criterion could not be evaluated from the attached investigation.";
    let criterionEvidenceIds = evidenceIds;

    if (criterion.criterionId === "answers_confirmed_question") {
      const directionCheck = evaluateActionDirection(plan, [
        action.title,
        action.summary,
        action.nextStep,
      ].join(" "));
      if (investigation?.planId === plan.planId && investigation.originalQuestion === plan.originalQuestion && investigation.leads.length) {
        status = investigation.reconciliation?.canCombine === false ? "partial" : "pass";
        explanation = investigation.reconciliation?.canCombine === false
          ? "The investigation is bound to the confirmed question, but incompatible evidence remains separate and cannot support one combined claim."
          : "The investigation is bound to the confirmed plan and retained question-compatible source-linked leads.";
      } else if (investigation?.planId === plan.planId && investigation.originalQuestion === plan.originalQuestion) {
        status = "partial";
        explanation = "The investigation is bound to the confirmed question but retained no supported lead; the answer must state that directly.";
      } else {
        explanation = "No investigation bound to the confirmed question is attached.";
      }
      if (directionCheck.status === "opposed" || directionCheck.status === "conflicting") {
        status = "fail";
        explanation = directionCheck.explanation;
      } else if (directionCheck.status === "missing" && status === "pass") {
        status = "partial";
        explanation = directionCheck.explanation;
      } else if (directionCheck.status === "matched") {
        explanation = `${explanation} ${directionCheck.explanation}`;
      }
    } else if (criterion.criterionId === "respects_decision_boundary") {
      criterionEvidenceIds = [];
      if (!materialActionLanguage(`${action.title} ${action.summary} ${action.nextStep}`) && !action.requiresApproval) {
        status = "pass";
        explanation = "The proposed next step remains investigative and does not authorize a material action.";
      } else if (action.requiresApproval && !materialActionLanguage(`${action.title} ${action.summary}`)) {
        status = "partial";
        explanation = "The action remains explicitly approval-gated and cannot be treated as authorized.";
      } else {
        explanation = "The proposed action language exceeds the validated investigation boundary.";
      }
    } else if (criterion.criterionId === "covers_domain_requirements") {
      criterionEvidenceIds = [...new Set(coveredDomains.flatMap((item) => item.sourceIds))];
      if (requiredDomains.length && coveredDomains.length === requiredDomains.length) {
        status = "pass";
        explanation = "Every required domain requirement is supported by permitted evidence.";
      } else if (coveredDomains.length) {
        status = "partial";
        explanation = `${coveredDomains.length} of ${requiredDomains.length} required domain requirements are covered; unmet requirements remain explicit.`;
      } else {
        explanation = "No required domain requirement is fully covered by the attached investigation.";
      }
    } else if (criterion.criterionId === "shows_contrary_evidence") {
      const contrary = section("contrary_evidence");
      status = contrary?.status === "covered" ? "pass" : contrary?.status === "unsupported" ? "partial" : "fail";
      explanation = contrary?.explanation ?? "Contrary evidence was not evaluated.";
      criterionEvidenceIds = contrary?.sourceIds ?? [];
    } else if (criterion.criterionId === "shows_unknowns") {
      const uncertainty = section("uncertainty");
      const missing = section("missing_evidence");
      const statuses = [uncertainty?.status, missing?.status];
      status = statuses.every((item) => item === "covered") ? "pass" : statuses.some((item) => item === "covered") ? "partial" : "fail";
      explanation = status === "pass"
        ? "Uncertainty, missing evidence, and approval gaps remain explicit."
        : "The answer does not yet expose every required uncertainty and missing-evidence boundary.";
      criterionEvidenceIds = [...new Set([...(uncertainty?.sourceIds ?? []), ...(missing?.sourceIds ?? [])])];
    } else if (criterion.criterionId === "cites_claims") {
      if (investigation && sourceIds.length && investigation.dataSnapshotVersion.trim()) {
        status = "pass";
        explanation = "The investigation retains source IDs and a versioned evidence snapshot for its factual claims.";
      } else if (investigation && (sourceIds.length || investigation.dataSnapshotVersion.trim())) {
        status = "partial";
        explanation = "Only part of the required source and snapshot lineage is attached.";
      } else {
        explanation = "No source-linked, versioned investigation is attached.";
      }
      criterionEvidenceIds = sourceIds;
    } else if (criterion.criterionId === "action_is_permitted") {
      criterionEvidenceIds = [];
      if (action.owner.trim() && action.nextStep.trim() && !action.requiresApproval && !materialActionLanguage(`${action.title} ${action.summary} ${action.nextStep}`)) {
        status = "pass";
        explanation = `${action.owner} owns a bounded investigative next step inside the validated capability.`;
      } else if (action.owner.trim() && action.nextStep.trim() && action.requiresApproval) {
        status = "partial";
        explanation = "The action has an owner and next step but remains explicitly approval-gated.";
      } else {
        explanation = "The proposed action is missing a bounded owner/next step or exceeds the permitted capability.";
      }
    }

    return answerCompletionEvaluationSchema.parse({
      criterionId: criterion.criterionId,
      label: criterion.label,
      status,
      explanation,
      evidenceIds: criterionEvidenceIds,
    });
  });

  const passedCount = evaluations.filter((item) => item.status === "pass").length;
  const failedCount = evaluations.filter((item) => item.status === "fail").length;
  const unmetCriterionIds = evaluations.filter((item) => item.status !== "pass").map((item) => item.criterionId);
  const overallStatus = failedCount ? "fail" : passedCount === evaluations.length ? "pass" : "partial";
  const evidenceNeeded = [...new Set([
    ...(investigation?.nextPass.evidenceNeeded ?? []),
    ...plan.missingEvidence,
    ...plan.missingApprovals,
    ...evaluations.filter((item) => item.status !== "pass").map((item) => `${item.label}: ${item.explanation}`),
  ])];

  return answerEvaluationReportSchema.parse({
    version: ANSWER_EVALUATION_VERSION,
    planId: plan.planId,
    contractId: plan.answerContract.contractId,
    overallStatus,
    passedCount,
    criterionCount: evaluations.length,
    criteria: evaluations,
    unmetCriterionIds,
    nextPass: {
      status: overallStatus === "pass" ? "ready_for_review" : "research_needed",
      question: overallStatus === "pass"
        ? "Does the accountable reviewer accept this answer within the validated decision boundary?"
        : "What bounded evidence pass will resolve the unmet answer criteria without exceeding the validated decision boundary?",
      evidenceNeeded: evidenceNeeded.length ? evidenceNeeded : ["Accountable human review of the completed answer contract."],
      completionRule: overallStatus === "pass"
        ? "The accountable reviewer confirms the answer, source lineage, and permitted next action."
        : "Rerun evaluation only after every failed or partial criterion is supported or explicitly dispositioned; do not authorize a material action from the partial answer.",
    },
  });
}
