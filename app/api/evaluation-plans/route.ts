import { evaluationPlanRequestSchema, evaluationPlanResponseSchema, planEvaluation } from "@/lib/planning";
import { proposeEvaluationPlanWithAi } from "@/lib/planning/ai-planner";
import { publicMarkets } from "@/lib/data/public-market-ui";
import { planConfiguredDemoQuestion } from "@/lib/demo/scenarios";

const headers = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ status: "error", message: "Enter a valid evaluation question." }, { status: 400, headers });
  }
  const parsed = evaluationPlanRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ status: "error", message: "Enter an evaluation question between 3 and 600 characters." }, { status: 400, headers });
  const selectedGeographicContext = parsed.data.selectedCbsaCodes.flatMap((cbsaCode) => {
    const market = publicMarkets.find((candidate) => candidate.cbsa_code === cbsaCode);
    return market ? [{ cbsaCode, cbsaName: market.cbsa_name }] : [];
  });
  const configuredDemoPlan = selectedGeographicContext.length ? null : planConfiguredDemoQuestion(parsed.data.question);
  let plan = configuredDemoPlan ?? planEvaluation(
    parsed.data.question,
    parsed.data.perspectiveId,
    selectedGeographicContext,
    parsed.data.activeViewId,
  );
  if (!configuredDemoPlan && plan.intent.selectedQueries.length === 0 && process.env.OPENAI_API_KEY?.trim()) {
    try {
      plan = await proposeEvaluationPlanWithAi(
        parsed.data.question,
        parsed.data.perspectiveId,
        selectedGeographicContext,
        parsed.data.activeViewId,
      );
    }
    catch (error) { console.error("[evaluation-plan]", error instanceof Error ? error.name : "UnknownError"); }
  }
  return Response.json(evaluationPlanResponseSchema.parse({ status: "ok", plan }), { status: 200, headers });
}
