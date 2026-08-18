import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ASK_AI_MODEL } from "../ai/insights.ts";
import { planningIntentSchema } from "./contracts.ts";
import { compileEvaluationPlan } from "./planner.ts";
import type { SelectedGeographicContext } from "./geographic-context.ts";
import {
  modelDecisionFramingProposalSchema,
  validateAiDecisionFramingProposal,
} from "./decision-framing.ts";
import { z } from "zod";
import type { PerspectiveViewId } from "../perspectives/contracts.ts";

const aiPlanningProposalSchema = z.object({
  intent: planningIntentSchema,
  framing: modelDecisionFramingProposalSchema,
}).strict();

const INSTRUCTIONS = `Classify an evaluation question and propose advisory answer framing in the supplied schema. Do not solve it or provide hidden reasoning. Never invent a source, metric, owner, threshold, approval, CBSA code, coordinate, or geometry. Opening a clinic is clinic_location. Comparing operating clinics is clinic_performance. Campaign questions are local_growth. Public population, household, income, housing, and density questions are market_context. Put only human place names in requestedPlaces, optionally with a two-letter stateHint when the question supplies one. Use zero, one, or up to five places in question order. Never invent geography identifiers. Set clarificationRequired when the decision, geography, comparison cohort, or requested output is ambiguous. conciseInterpretation and framing.decisionRestatement must be short operational sentences. framing.emphasizedRequirementIds may contain only IDs supplied by the application; if none are supplied, return an empty array. framing.unresolvedQuestions must ask what evidence, definition, cohort, geography, timeframe, outcome, or approval must be resolved and must not assert an answer. The application will compile and validate the final contract deterministically.`;

export async function proposeEvaluationPlanWithAi(
  question: string,
  perspectiveId?: "pricing" | "marketing" | "cvc",
  selectedGeographicContext: readonly SelectedGeographicContext[] = [],
  activeViewId?: PerspectiveViewId,
) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1, timeout: 20_000 });
  const response = await client.responses.parse({
    model: process.env.OPENAI_EVALUATION_PLANNER_MODEL?.trim() || ASK_AI_MODEL,
    reasoning: { effort: "low" },
    store: false,
    input: [{ role: "developer", content: INSTRUCTIONS }, { role: "user", content: question }],
    text: { format: zodTextFormat(aiPlanningProposalSchema, "evaluation_planning_and_framing_proposal") },
  });
  if (!response.output_parsed) throw new Error("The model returned no structured planning intent.");
  const basePlan = compileEvaluationPlan(question, response.output_parsed.intent, "ai_proposed", perspectiveId, selectedGeographicContext, undefined, activeViewId);
  const framing = validateAiDecisionFramingProposal({
    proposal: response.output_parsed.framing,
    modelVersion: response.model,
    allowedRequirementIds: basePlan.answerContract.domainRequirements.map((item) => item.requirementId),
    deterministicDecisionRestatement: basePlan.intent.conciseInterpretation,
  });
  return compileEvaluationPlan(question, response.output_parsed.intent, "ai_proposed", perspectiveId, selectedGeographicContext, framing, activeViewId);
}
