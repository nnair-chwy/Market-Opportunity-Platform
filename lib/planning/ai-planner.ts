import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ASK_AI_MODEL } from "../ai/insights.ts";
import { planningIntentSchema } from "./contracts.ts";
import { compileEvaluationPlan } from "./planner.ts";

const INSTRUCTIONS = `Classify an evaluation question into the supplied schema. Do not solve it or provide hidden reasoning. Never invent a source, metric, owner, threshold, approval, or geography. Opening a clinic is clinic_location. Comparing operating clinics is clinic_performance. Campaign questions are local_growth. Public population, household, income, housing, and density questions are market_context. conciseInterpretation must be one short operational sentence.`;

export async function proposeEvaluationPlanWithAi(question: string) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1, timeout: 20_000 });
  const response = await client.responses.parse({
    model: process.env.OPENAI_EVALUATION_PLANNER_MODEL?.trim() || ASK_AI_MODEL,
    reasoning: { effort: "low" },
    store: false,
    input: [{ role: "developer", content: INSTRUCTIONS }, { role: "user", content: question }],
    text: { format: zodTextFormat(planningIntentSchema, "evaluation_planning_intent") },
  });
  if (!response.output_parsed) throw new Error("The model returned no structured planning intent.");
  return compileEvaluationPlan(question, response.output_parsed, "ai_proposed");
}
