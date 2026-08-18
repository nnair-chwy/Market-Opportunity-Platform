import { z } from "zod";
import { getAnswerDomainPack } from "./answer-domain-packs.ts";
import {
  decisionFramingProposalSchema,
  deterministicDecisionFramingProposal,
  type DecisionFramingProposal,
} from "./decision-framing.ts";

export const ANSWER_CONTRACT_VERSION = "answer-contract-v1" as const;

const textSchema = z.string().trim().min(1).max(800);
const identifierSchema = z.string().trim().min(1).max(120);

export const answerRequirementSchema = z.object({
  requirementId: identifierSchema,
  label: z.string().trim().min(1).max(160),
  questionToAnswer: textSchema,
  required: z.boolean(),
  readiness: z.enum(["connected", "documented_not_approved", "missing", "not_applicable"]),
  sourceIds: z.array(z.string().trim().min(1).max(40)).max(12),
  ifUnmet: textSchema,
}).strict();

export const answerSectionSchema = z.object({
  sectionId: z.enum([
    "direct_answer",
    "evidence_findings",
    "contrary_evidence",
    "uncertainty",
    "missing_evidence",
    "source_and_version_notes",
    "permitted_next_action",
  ]),
  label: z.string().trim().min(1).max(120),
  purpose: textSchema,
  required: z.boolean(),
}).strict();

export const answerCompletionCriterionSchema = z.object({
  criterionId: identifierSchema,
  label: textSchema,
  required: z.boolean(),
}).strict();

export const answerContractSchema = z.object({
  version: z.literal(ANSWER_CONTRACT_VERSION),
  contractId: identifierSchema,
  planId: identifierSchema,
  perspectiveId: z.enum(["cvc", "marketing", "pricing"]),
  answerMode: z.enum(["description", "comparison", "investigation", "research_needed", "clarification"]),
  framingProposal: decisionFramingProposalSchema,
  audience: z.object({
    primaryUser: textSchema,
    decisionOwner: textSchema,
    accountableReviewer: textSchema,
  }).strict(),
  decisionFrame: z.object({
    decisionToInform: textSchema,
    unitOfAnalysis: textSchema,
    decisionBoundary: textSchema,
    geography: textSchema,
    timeframe: textSchema,
    comparisonCohort: textSchema,
  }).strict(),
  requiredSections: z.array(answerSectionSchema).length(7),
  domainRequirements: z.array(answerRequirementSchema).min(3).max(8),
  claimRules: z.object({
    sourceIdsRequiredForFactualClaims: z.literal(true),
    numericClaimsMustResolveToStructuredEvidence: z.literal(true),
    preserveEvidenceStatus: z.literal(true),
    preserveNullConflictAndSuppressionStates: z.literal(true),
    causalClaimsRequireApprovedExperimentalEvidence: z.literal(true),
    distinguishObservationFromRecommendation: z.literal(true),
  }).strict(),
  strongestPermittedConclusion: textSchema,
  prohibitedConclusions: z.array(textSchema).min(2).max(8),
  completionCriteria: z.array(answerCompletionCriterionSchema).min(5).max(12),
  fallbackOutcome: z.enum(["clarification", "research_needed", "context_only", "draft_for_review"]),
}).strict().superRefine((contract, context) => {
  const sectionIds = contract.requiredSections.map((section) => section.sectionId);
  if (new Set(sectionIds).size !== sectionIds.length) {
    context.addIssue({ code: "custom", path: ["requiredSections"], message: "Answer section identifiers must be unique." });
  }
  const requirementIds = contract.domainRequirements.map((item) => item.requirementId);
  if (new Set(requirementIds).size !== requirementIds.length) {
    context.addIssue({ code: "custom", path: ["domainRequirements"], message: "Domain requirement identifiers must be unique." });
  }
});

export type AnswerContract = z.infer<typeof answerContractSchema>;
type AnswerContractPlanContext = {
  planId: string;
  perspectiveId: "cvc" | "marketing" | "pricing";
  geographyGrain: "cbsa" | "submarket" | "site" | "portfolio";
  resultWorkspaceType: "adaptive_market_workspace" | "clinic_evaluation_surface" | "clarification" | "evidence_readiness";
  status: "executable" | "partially_executable" | "blocked";
  capabilityId: "census_market_context" | "clinic_performance" | "clinic_site_evaluation" | "local_growth_test";
  evidenceBoundary: string;
  intent: {
    requestedAction: "describe" | "compare" | "screen" | "investigate" | "approve";
    conciseInterpretation: string;
  };
  geographyResolution: {
    mode: "national" | "single" | "compare" | "needs_selection" | "clarification" | "unavailable";
    message: string;
  };
};

const requiredSections: AnswerContract["requiredSections"] = [
  { sectionId: "direct_answer", label: "Direct answer", purpose: "Answer the confirmed question first at the strongest level the evidence supports.", required: true },
  { sectionId: "evidence_findings", label: "Evidence-backed findings", purpose: "State the material findings with evidence status, geography, time, and source IDs.", required: true },
  { sectionId: "contrary_evidence", label: "Contrary evidence", purpose: "Show evidence that challenges, weakens, or changes the interpretation.", required: true },
  { sectionId: "uncertainty", label: "Uncertainty and sensitivity", purpose: "Explain material uncertainty, comparability limits, sensitivity, and confidence without inventing precision.", required: true },
  { sectionId: "missing_evidence", label: "Missing evidence and approvals", purpose: "Keep unresolved evidence, definitions, ownership, and approvals visible instead of treating them as passed.", required: true },
  { sectionId: "source_and_version_notes", label: "Sources and versions", purpose: "Identify the source IDs and calculation, snapshot, geography, and contract versions used.", required: true },
  { sectionId: "permitted_next_action", label: "Permitted next action", purpose: "Propose only a review, investigation, or controlled test that the capability and approval boundary permits.", required: true },
];

function geographyLabel(plan: AnswerContractPlanContext) {
  if (plan.geographyResolution.mode === "national") return "U.S. CBSA market universe at the plan's validated grain";
  return plan.geographyResolution.message;
}

function answerMode(plan: AnswerContractPlanContext): AnswerContract["answerMode"] {
  if (plan.resultWorkspaceType === "clarification") return "clarification";
  if (plan.status === "blocked") return "research_needed";
  if (plan.intent.requestedAction === "compare") return "comparison";
  if (plan.intent.requestedAction === "investigate" || plan.intent.requestedAction === "screen") return "investigation";
  return "description";
}

function strongestConclusion(plan: AnswerContractPlanContext) {
  if (plan.resultWorkspaceType === "clarification") return "A clarification request that names the missing decision, geography, cohort, timeframe, or requested output.";
  if (plan.status === "blocked") return "A source-linked research-needed answer that explains what can be described now and what prevents the requested decision-level conclusion.";
  if (plan.capabilityId === "census_market_context") return "A descriptive or comparative public-market context answer; it is not an opportunity score or business recommendation.";
  if (plan.perspectiveId === "cvc") return "A bounded clinic or market investigation lead for accountable human review, never a final site, lease, or opening decision.";
  if (plan.perspectiveId === "marketing") return "A bounded Marketing diagnostic or controlled-test proposal, never causal lift or an authorized spend change without approved experiment evidence.";
  return "A bounded Pricing diagnostic or controlled-test proposal, never a regional profit claim or authorized price change without approved outcome evidence.";
}

export function buildAnswerContract(
  plan: AnswerContractPlanContext,
  framingProposal?: DecisionFramingProposal,
): AnswerContract {
  const domainPack = getAnswerDomainPack(plan.perspectiveId);
  const mode = answerMode(plan);
  const framing = framingProposal ?? deterministicDecisionFramingProposal({
    decisionRestatement: plan.intent.conciseInterpretation,
    requirementIds: domainPack.requirements.map((item) => item.requirementId),
    unresolvedQuestions: domainPack.requirements
      .filter((item) => item.required && item.readiness !== "connected" && item.readiness !== "not_applicable")
      .map((item) => item.questionToAnswer),
  });
  return answerContractSchema.parse({
    version: ANSWER_CONTRACT_VERSION,
    contractId: `${plan.planId}-answer`,
    planId: plan.planId,
    perspectiveId: plan.perspectiveId,
    answerMode: mode,
    framingProposal: framing,
    audience: {
      primaryUser: domainPack.primaryUser,
      decisionOwner: domainPack.decisionOwner,
      accountableReviewer: domainPack.accountableReviewer,
    },
    decisionFrame: {
      decisionToInform: plan.intent.conciseInterpretation,
      unitOfAnalysis: `${plan.geographyGrain} entities resolved by the validated evaluation plan`,
      decisionBoundary: plan.evidenceBoundary,
      geography: geographyLabel(plan),
      timeframe: "Use the confirmed analysis window and state every evidence observation or period explicitly.",
      comparisonCohort: plan.intent.requestedAction === "compare" || plan.intent.requestedAction === "screen"
        ? "Compare only compatible entities at the same governed geographic and temporal grain."
        : "No comparison cohort may be inferred beyond the validated plan.",
    },
    requiredSections,
    domainRequirements: domainPack.requirements,
    claimRules: {
      sourceIdsRequiredForFactualClaims: true,
      numericClaimsMustResolveToStructuredEvidence: true,
      preserveEvidenceStatus: true,
      preserveNullConflictAndSuppressionStates: true,
      causalClaimsRequireApprovedExperimentalEvidence: true,
      distinguishObservationFromRecommendation: true,
    },
    strongestPermittedConclusion: strongestConclusion(plan),
    prohibitedConclusions: [
      "Do not invent, impute, or silently repair missing evidence, geography, dates, definitions, thresholds, or approvals.",
      "Do not turn public context, reference-only sources, workspace access, or prototype-only evidence into production recommendation evidence.",
      domainPack.prohibitedConclusion,
    ],
    completionCriteria: [
      { criterionId: "answers_confirmed_question", label: "The direct answer addresses the confirmed question and requested output before adding background.", required: true },
      { criterionId: "respects_decision_boundary", label: "The conclusion stays at or below the strongest permitted conclusion.", required: true },
      { criterionId: "covers_domain_requirements", label: "Every required domain question is answered or explicitly marked unmet with its consequence.", required: true },
      { criterionId: "shows_contrary_evidence", label: "Material contrary evidence, conflicts, and alternative explanations are visible.", required: true },
      { criterionId: "shows_unknowns", label: "Missing, unknown, stale, suppressed, rejected, and unapproved evidence remain distinguishable.", required: true },
      { criterionId: "cites_claims", label: "Factual and numeric claims resolve to permitted structured evidence and source IDs.", required: true },
      { criterionId: "action_is_permitted", label: "The proposed next action names an owner and remains inside capability and approval boundaries.", required: true },
    ],
    fallbackOutcome: mode === "clarification" ? "clarification"
      : plan.status === "blocked" ? "research_needed"
        : plan.capabilityId === "census_market_context" ? "context_only"
          : "draft_for_review",
  });
}
