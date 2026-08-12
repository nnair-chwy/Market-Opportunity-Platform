import { evaluationPlanRequestSchema, evaluationPlanResponseSchema, planEvaluation } from "@/lib/planning";
import { proposeEvaluationPlanWithAi } from "@/lib/planning/ai-planner";

const headers = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ status: "error", message: "Enter a valid evaluation question." }, { status: 400, headers });
  }
  const parsed = evaluationPlanRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ status: "error", message: "Enter an evaluation question between 3 and 600 characters." }, { status: 400, headers });
  let plan = planEvaluation(parsed.data.question);
  if (process.env.OPENAI_API_KEY?.trim()) {
    try { plan = await proposeEvaluationPlanWithAi(parsed.data.question); }
    catch (error) { console.error("[evaluation-plan]", error instanceof Error ? error.name : "UnknownError"); }
  }
  return Response.json(evaluationPlanResponseSchema.parse({ status: "ok", plan }), { status: 200, headers });
}
