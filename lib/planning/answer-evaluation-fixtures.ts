import { z } from "zod";
import { checkInvestigationCoverage } from "./investigation-coverage.ts";
import { composeFinalAnswer } from "./final-answer-composer.ts";
import { runMarketInvestigation } from "./market-investigation.ts";
import { planEvaluation } from "./planner.ts";

export const ANSWER_EVALUATION_FIXTURE_VERSION = "answer-evaluation-fixtures-v1" as const;

export const answerEvaluationFixtureSchema = z.object({
  fixtureId: z.string().trim().min(1),
  version: z.literal(ANSWER_EVALUATION_FIXTURE_VERSION),
  reviewStatus: z.enum(["synthetic_regression", "analyst_approved_historical"]),
  question: z.string().trim().min(3),
  perspectiveId: z.enum(["cvc", "marketing", "pricing"]),
  expectedAnswerMode: z.enum(["description", "comparison", "investigation", "research_needed", "clarification"]),
  expectedFallbackOutcome: z.enum(["clarification", "research_needed", "context_only", "draft_for_review"]),
  expectedFinalStatus: z.enum(["draft_for_review", "research_needed", "clarification", "context_only"]),
  requiredRequirementIds: z.array(z.string().trim().min(1)).min(3),
  prohibitedConclusionPattern: z.string().trim().min(1),
}).strict();

export type AnswerEvaluationFixture = z.infer<typeof answerEvaluationFixtureSchema>;

export const answerEvaluationFixtures: readonly AnswerEvaluationFixture[] = [
  {
    fixtureId: "AC-001",
    version: ANSWER_EVALUATION_FIXTURE_VERSION,
    reviewStatus: "synthetic_regression",
    question: "Describe the population of the Dallas metro.",
    perspectiveId: "marketing",
    expectedAnswerMode: "description",
    expectedFallbackOutcome: "context_only",
    expectedFinalStatus: "context_only",
    requiredRequirementIds: ["marketing_comparable_cohort", "marketing_geography", "marketing_business_outcome", "marketing_incrementality"],
    prohibitedConclusionPattern: "spend change",
  },
  {
    fixtureId: "AC-002",
    version: ANSWER_EVALUATION_FIXTURE_VERSION,
    reviewStatus: "synthetic_regression",
    question: "Which comparable markets differ most in CVC footprint?",
    perspectiveId: "cvc",
    expectedAnswerMode: "investigation",
    expectedFallbackOutcome: "draft_for_review",
    expectedFinalStatus: "research_needed",
    requiredRequirementIds: ["cvc_demand_outcome", "cvc_access_capacity", "cvc_supply_feasibility", "cvc_human_judgment"],
    prohibitedConclusionPattern: "lease|opening",
  },
  {
    fixtureId: "AC-003",
    version: ANSWER_EVALUATION_FIXTURE_VERSION,
    reviewStatus: "synthetic_regression",
    question: "Which DMAs should receive more paid-search spend?",
    perspectiveId: "marketing",
    expectedAnswerMode: "research_needed",
    expectedFallbackOutcome: "research_needed",
    expectedFinalStatus: "research_needed",
    requiredRequirementIds: ["marketing_comparable_cohort", "marketing_geography", "marketing_business_outcome", "marketing_incrementality"],
    prohibitedConclusionPattern: "causal lift|spend change",
  },
  {
    fixtureId: "AC-004",
    version: ANSWER_EVALUATION_FIXTURE_VERSION,
    reviewStatus: "synthetic_regression",
    question: "Where should Chewy change regional prices?",
    perspectiveId: "pricing",
    expectedAnswerMode: "clarification",
    expectedFallbackOutcome: "clarification",
    expectedFinalStatus: "clarification",
    requiredRequirementIds: ["pricing_competitor_condition", "pricing_chewy_economics", "pricing_customer_outcome", "pricing_test_authority"],
    prohibitedConclusionPattern: "contribution profit|price change",
  },
  {
    fixtureId: "AC-005",
    version: ANSWER_EVALUATION_FIXTURE_VERSION,
    reviewStatus: "synthetic_regression",
    question: "What should we do next?",
    perspectiveId: "marketing",
    expectedAnswerMode: "clarification",
    expectedFallbackOutcome: "clarification",
    expectedFinalStatus: "clarification",
    requiredRequirementIds: ["marketing_comparable_cohort", "marketing_geography", "marketing_business_outcome", "marketing_incrementality"],
    prohibitedConclusionPattern: "causal lift|spend change",
  },
].map((fixture) => answerEvaluationFixtureSchema.parse(fixture));

export const answerEvaluationResultSchema = z.object({
  fixtureId: z.string().trim().min(1),
  passed: z.boolean(),
  mismatches: z.array(z.string().trim().min(1)),
}).strict();

export function runAnswerEvaluationFixture(fixture: AnswerEvaluationFixture) {
  const plan = planEvaluation(fixture.question, fixture.perspectiveId);
  const investigation = runMarketInvestigation(plan);
  const coverage = checkInvestigationCoverage(plan, investigation);
  const answer = composeFinalAnswer(plan, investigation, plan.actions[0], coverage);
  const mismatches: string[] = [];
  if (plan.answerContract.answerMode !== fixture.expectedAnswerMode) mismatches.push(`answer mode ${plan.answerContract.answerMode}`);
  if (plan.answerContract.fallbackOutcome !== fixture.expectedFallbackOutcome) mismatches.push(`fallback ${plan.answerContract.fallbackOutcome}`);
  if (answer.status !== fixture.expectedFinalStatus) mismatches.push(`final status ${answer.status}`);
  const actualIds = new Set(plan.answerContract.domainRequirements.map((item) => item.requirementId));
  for (const requirementId of fixture.requiredRequirementIds) {
    if (!actualIds.has(requirementId)) mismatches.push(`missing requirement ${requirementId}`);
  }
  if (!new RegExp(fixture.prohibitedConclusionPattern, "i").test(plan.answerContract.prohibitedConclusions.join(" "))) {
    mismatches.push("prohibited conclusion boundary missing");
  }
  if (answer.sections.length !== 7) mismatches.push(`answer section count ${answer.sections.length}`);
  return answerEvaluationResultSchema.parse({
    fixtureId: fixture.fixtureId,
    passed: mismatches.length === 0,
    mismatches,
  });
}
