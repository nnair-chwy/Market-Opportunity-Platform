import { z } from "zod";
import type { AnswerContract } from "./answer-contract.ts";
import { validateAnswerContract } from "./answer-contract-validator.ts";
import type { EvaluationPlan, PlannedAction } from "./contracts.ts";
import type { MarketInvestigation } from "./market-investigation.ts";

export const INVESTIGATION_COVERAGE_VERSION = "investigation-coverage-v1" as const;

export const coverageStatusSchema = z.enum(["covered", "unsupported", "blocked", "not_applicable"]);
export type CoverageStatus = z.infer<typeof coverageStatusSchema>;

export const coverageItemSchema = z.object({
  itemId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  required: z.boolean(),
  status: coverageStatusSchema,
  explanation: z.string().trim().min(1),
  sourceIds: z.array(z.string().trim().min(1).max(40)),
  investigationLeadIds: z.array(z.string().trim().min(1)),
}).strict();

export const investigationCoverageReportSchema = z.object({
  version: z.literal(INVESTIGATION_COVERAGE_VERSION),
  planId: z.string().trim().min(1),
  contractId: z.string().trim().min(1),
  investigationVersion: z.string().trim().min(1).nullable(),
  overallStatus: z.enum(["complete", "partial", "blocked"]),
  coveredRequiredCount: z.number().int().nonnegative(),
  requiredCount: z.number().int().nonnegative(),
  sectionCoverage: z.array(coverageItemSchema),
  domainCoverage: z.array(coverageItemSchema),
  unmetRequiredItemIds: z.array(z.string().trim().min(1)),
  permittedConclusion: z.string().trim().min(1),
  fallbackOutcome: z.enum(["clarification", "research_needed", "context_only", "draft_for_review"]),
}).strict();

export type InvestigationCoverageReport = z.infer<typeof investigationCoverageReportSchema>;

function sectionCoverage(
  contract: AnswerContract,
  investigation: MarketInvestigation | undefined,
  action: PlannedAction,
) {
  const leadIds = investigation?.leads.map((lead) => lead.id) ?? [];
  const sourceIds = investigation?.sourceIds ?? [];
  return contract.requiredSections.map((section) => {
    let status: CoverageStatus = "covered";
    let explanation = "The deterministic investigation contains the material needed for this answer section.";
    let itemSources = sourceIds;
    let itemLeads = leadIds;

    if (section.sectionId === "direct_answer") {
      if (!investigation) {
        status = "blocked";
        explanation = "No confirmed investigation result is attached, so this section cannot be completed.";
      } else if (!investigation.leads.length) {
        status = "unsupported";
        explanation = "The investigation found no question-compatible business finding; the answer must state that directly.";
      }
    } else if (section.sectionId === "evidence_findings") {
      if (!investigation) {
        status = "blocked";
        explanation = "No confirmed investigation result is attached, so findings cannot be completed.";
      } else if (!investigation.leads.length) {
        status = "unsupported";
        explanation = "The investigation found no question-compatible business finding.";
      } else if (investigation.evidenceStage === "signal") {
        status = "unsupported";
        explanation = "The investigation produced screening signals only. A finding requires compatible outcome evidence and an explanation or challenge check.";
      }
    } else if (section.sectionId === "contrary_evidence") {
      const contraryCount = (investigation?.rejectedPatterns.length ?? 0)
        + (investigation?.leads.filter((lead) => lead.challenge.trim()).length ?? 0);
      if (!investigation) {
        status = "blocked";
        explanation = "Contrary evidence cannot be checked before investigation.";
      } else if (!contraryCount) {
        status = "unsupported";
        explanation = "No contrary evidence or challenged interpretation was recorded.";
      }
    } else if (section.sectionId === "uncertainty") {
      if (!investigation) {
        status = "blocked";
        explanation = "Uncertainty cannot be assessed before investigation.";
      } else if (!investigation.limitations.length) {
        status = "unsupported";
        explanation = "The investigation did not record limitations or sensitivity boundaries.";
      }
    } else if (section.sectionId === "missing_evidence") {
      const gaps = (investigation?.readiness.missing.length ?? 0)
        + contract.domainRequirements.filter((item) => item.required && item.readiness !== "connected" && item.readiness !== "not_applicable").length;
      if (!gaps) {
        explanation = "No unresolved evidence or approval gap remains in the attached investigation and contract.";
      } else {
        explanation = `${gaps} evidence or approval gap(s) remain explicit in the contract and investigation.`;
      }
    } else if (section.sectionId === "source_and_version_notes") {
      if (!investigation || !sourceIds.length || !investigation.dataSnapshotVersion) {
        status = "blocked";
        explanation = "Source IDs and a versioned investigation snapshot are required for this section.";
      }
      itemLeads = [];
    } else if (section.sectionId === "permitted_next_action") {
      itemSources = [];
      itemLeads = [];
      if (!action.owner.trim() || !action.nextStep.trim()) {
        status = "blocked";
        explanation = "A named owner and bounded next step are required.";
      } else {
        explanation = `${action.owner} owns the bounded next step defined by the validated plan.`;
      }
    }

    return coverageItemSchema.parse({
      itemId: section.sectionId,
      label: section.label,
      required: section.required,
      status,
      explanation,
      sourceIds: itemSources,
      investigationLeadIds: itemLeads,
    });
  });
}

function domainCoverage(contract: AnswerContract, investigation: MarketInvestigation | undefined) {
  const investigationSources = new Set(investigation?.sourceIds ?? []);
  return contract.domainRequirements.map((requirement) => {
    const matchedSources = requirement.sourceIds.filter((sourceId) => investigationSources.has(sourceId));
    let status: CoverageStatus;
    let explanation: string;
    if (requirement.readiness === "not_applicable") {
      status = "not_applicable";
      explanation = "The validated contract explicitly marks this requirement as not applicable.";
    } else if (requirement.readiness === "missing") {
      status = "blocked";
      explanation = `${requirement.ifUnmet} Required evidence is missing.`;
    } else if (requirement.readiness === "documented_not_approved") {
      status = "blocked";
      explanation = `${requirement.ifUnmet} The referenced evidence is documented but not approved to satisfy this requirement.`;
    } else if (!investigation) {
      status = "blocked";
      explanation = "The evidence requirement is connected, but no confirmed investigation result is attached.";
    } else if (!matchedSources.length) {
      status = "unsupported";
      explanation = `${requirement.ifUnmet} The investigation did not use a permitted source for this requirement.`;
    } else {
      status = "covered";
      explanation = `The investigation used permitted source ${matchedSources.join(", ")} for this requirement.`;
    }
    return coverageItemSchema.parse({
      itemId: requirement.requirementId,
      label: requirement.label,
      required: requirement.required,
      status,
      explanation,
      sourceIds: matchedSources,
      investigationLeadIds: status === "covered" ? investigation?.leads.map((lead) => lead.id) ?? [] : [],
    });
  });
}

export function checkInvestigationCoverage(
  plan: EvaluationPlan,
  investigation: MarketInvestigation | undefined,
  action: PlannedAction = plan.actions[0],
): InvestigationCoverageReport {
  const validation = validateAnswerContract(plan.answerContract, {
    planId: plan.planId,
    perspectiveId: plan.perspectiveId,
  });
  if (!validation.valid) {
    throw new Error(`Coverage cannot run against an invalid answer contract: ${validation.issues.map((item) => item.message).join("; ")}`);
  }
  if (investigation && (investigation.planId !== plan.planId || investigation.originalQuestion !== plan.originalQuestion)) {
    throw new Error("The investigation does not belong to this answer contract.");
  }

  const sections = sectionCoverage(plan.answerContract, investigation, action);
  const domains = domainCoverage(plan.answerContract, investigation);
  const requiredItems = [...sections, ...domains].filter((item) => item.required);
  const unmet = requiredItems.filter((item) => item.status !== "covered" && item.status !== "not_applicable");
  const coveredRequiredCount = requiredItems.length - unmet.length;
  const overallStatus = !investigation
    ? "blocked"
    : unmet.length
      ? coveredRequiredCount ? "partial" : "blocked"
      : "complete";
  const permittedConclusion = overallStatus === "complete"
    ? plan.answerContract.strongestPermittedConclusion
    : plan.answerContract.fallbackOutcome === "clarification"
      ? "Ask for the missing decision, geography, cohort, timeframe, or requested output before investigating."
      : "Return only the supported context or investigation leads and explicitly identify every unsupported requirement.";

  return investigationCoverageReportSchema.parse({
    version: INVESTIGATION_COVERAGE_VERSION,
    planId: plan.planId,
    contractId: plan.answerContract.contractId,
    investigationVersion: investigation?.version ?? null,
    overallStatus,
    coveredRequiredCount,
    requiredCount: requiredItems.length,
    sectionCoverage: sections,
    domainCoverage: domains,
    unmetRequiredItemIds: unmet.map((item) => item.itemId),
    permittedConclusion,
    fallbackOutcome: plan.answerContract.fallbackOutcome,
  });
}
