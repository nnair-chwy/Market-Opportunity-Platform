import { z } from "zod";
import { answerContractSchema, type AnswerContract } from "./answer-contract.ts";
import { getAnswerDomainPack } from "./answer-domain-packs.ts";

export const ANSWER_CONTRACT_VALIDATION_VERSION = "answer-contract-validation-v1" as const;

export const answerContractValidationIssueSchema = z.object({
  code: z.enum([
    "invalid_structure",
    "plan_mismatch",
    "perspective_mismatch",
    "missing_owner",
    "missing_decision",
    "missing_unit_of_analysis",
    "missing_evidence_requirement",
    "domain_pack_mismatch",
    "missing_completion_test",
    "unauthorized_conclusion",
  ]),
  path: z.string().trim().min(1),
  message: z.string().trim().min(1),
}).strict();

export const answerContractValidationReportSchema = z.object({
  version: z.literal(ANSWER_CONTRACT_VALIDATION_VERSION),
  contractId: z.string().trim().min(1).nullable(),
  valid: z.boolean(),
  issues: z.array(answerContractValidationIssueSchema),
}).strict();

export type AnswerContractValidationIssue = z.infer<typeof answerContractValidationIssueSchema>;
export type AnswerContractValidationReport = z.infer<typeof answerContractValidationReportSchema>;

type ValidationContext = {
  planId?: string;
  perspectiveId?: AnswerContract["perspectiveId"];
};

function issue(
  code: AnswerContractValidationIssue["code"],
  path: string,
  message: string,
): AnswerContractValidationIssue {
  return { code, path, message };
}

export function validateAnswerContract(
  candidate: unknown,
  context: ValidationContext = {},
): AnswerContractValidationReport {
  const parsed = answerContractSchema.safeParse(candidate);
  if (!parsed.success) {
    return answerContractValidationReportSchema.parse({
      version: ANSWER_CONTRACT_VALIDATION_VERSION,
      contractId: candidate && typeof candidate === "object" && "contractId" in candidate
        ? String((candidate as { contractId?: unknown }).contractId ?? "") || null
        : null,
      valid: false,
      issues: parsed.error.issues.map((item) => issue(
        "invalid_structure",
        item.path.length ? item.path.join(".") : "answerContract",
        item.message,
      )),
    });
  }

  const contract = parsed.data;
  const issues: AnswerContractValidationIssue[] = [];
  const pack = getAnswerDomainPack(contract.perspectiveId);

  if (context.planId && contract.planId !== context.planId) {
    issues.push(issue("plan_mismatch", "planId", "The answer contract must belong to the active evaluation plan."));
  }
  if (context.perspectiveId && contract.perspectiveId !== context.perspectiveId) {
    issues.push(issue("perspective_mismatch", "perspectiveId", "The answer contract perspective must match the evaluation plan."));
  }
  if (!contract.audience.decisionOwner.trim() || !contract.audience.accountableReviewer.trim()) {
    issues.push(issue("missing_owner", "audience", "A decision owner and accountable reviewer are required."));
  }
  if (!contract.decisionFrame.decisionToInform.trim() || !contract.decisionFrame.decisionBoundary.trim()) {
    issues.push(issue("missing_decision", "decisionFrame", "The decision and its boundary are required."));
  }
  if (!contract.decisionFrame.unitOfAnalysis.trim() || !contract.decisionFrame.geography.trim()) {
    issues.push(issue("missing_unit_of_analysis", "decisionFrame.unitOfAnalysis", "The unit of analysis and geography are required."));
  }

  for (const requirement of contract.domainRequirements) {
    if (requirement.required && !requirement.sourceIds.length) {
      issues.push(issue(
        "missing_evidence_requirement",
        `domainRequirements.${requirement.requirementId}.sourceIds`,
        `${requirement.label} must name the evidence sources that could satisfy it.`,
      ));
    }
  }

  const expectedIds = pack.requirements.map((item) => item.requirementId).sort();
  const actualIds = contract.domainRequirements.map((item) => item.requirementId).sort();
  if (expectedIds.join("|") !== actualIds.join("|")) {
    issues.push(issue(
      "domain_pack_mismatch",
      "domainRequirements",
      `The ${pack.label} contract must retain the reviewed ${pack.version} requirement set.`,
    ));
  }

  const requiredCriteria = [
    "answers_confirmed_question",
    "respects_decision_boundary",
    "covers_domain_requirements",
    "shows_contrary_evidence",
    "shows_unknowns",
    "cites_claims",
    "action_is_permitted",
  ];
  const criteria = new Set(contract.completionCriteria.filter((item) => item.required).map((item) => item.criterionId));
  for (const criterionId of requiredCriteria) {
    if (!criteria.has(criterionId)) {
      issues.push(issue(
        "missing_completion_test",
        "completionCriteria",
        `Required completion test ${criterionId} is missing.`,
      ));
    }
  }

  if (/^(approve|authorize|select|sign|open|increase|decrease|change)\b/i.test(contract.strongestPermittedConclusion)) {
    issues.push(issue(
      "unauthorized_conclusion",
      "strongestPermittedConclusion",
      "The strongest permitted conclusion cannot itself authorize or execute a material action.",
    ));
  }

  return answerContractValidationReportSchema.parse({
    version: ANSWER_CONTRACT_VALIDATION_VERSION,
    contractId: contract.contractId,
    valid: issues.length === 0,
    issues,
  });
}
