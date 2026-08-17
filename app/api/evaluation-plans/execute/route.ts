import { executeEvaluationPlanEvidence, evaluationPlanExecutionRequestSchema } from "@/lib/planning/execute-plan";

const headers = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ status: "error", message: "Enter a valid plan execution request." }, { status: 400, headers }); }
  const parsed = evaluationPlanExecutionRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ status: "error", message: "A valid evaluation plan and request ID are required." }, { status: 400, headers });
  try {
    const result = await executeEvaluationPlanEvidence(parsed.data);
    return Response.json(result, { status: result.status === "failed" ? 422 : 200, headers });
  } catch {
    return Response.json({ status: "error", message: "The evidence execution service failed unexpectedly." }, { status: 500, headers });
  }
}
