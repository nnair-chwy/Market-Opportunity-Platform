import { evaluationPlanSchema, plannedActionSchema } from "@/lib/planning";
import { evidenceExecutionResponseSchema } from "@/lib/evidence-snapshot/contracts";
import { explainFindingsAndProposal } from "@/lib/planning/packet-ai-summary";
import {
  packetFindingsSummarySchema,
  proposedActionFromPlan,
} from "@/lib/planning/reviewable-packet";
import { z } from "zod";

const headers = { "cache-control": "no-store" };

const requestSchema = z.object({
  plan: evaluationPlanSchema,
  actionId: z.string().trim().min(1).optional(),
  evidenceExecution: evidenceExecutionResponseSchema.nullable().optional(),
}).strict();

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { status: "error", message: "Provide a validated evaluation plan." },
      { status: 400, headers },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { status: "error", message: "The evaluation plan failed validation." },
      { status: 400, headers },
    );
  }

  const plan = parsed.data.plan;
  const action = parsed.data.actionId
    ? plan.actions.find((item) => item.id === parsed.data.actionId)
    : proposedActionFromPlan(plan);
  if (!action) {
    return Response.json(
      { status: "error", message: "The requested action is not present in the plan." },
      { status: 400, headers },
    );
  }
  plannedActionSchema.parse(action);

  const summary = await explainFindingsAndProposal(plan, action, parsed.data.evidenceExecution ?? null);
  return Response.json(
    {
      status: "ok",
      summary: packetFindingsSummarySchema.parse(summary),
    },
    { status: 200, headers },
  );
}
