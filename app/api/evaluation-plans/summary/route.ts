import { evaluationPlanSchema, plannedActionSchema, proposedActionFromPlan } from "@/lib/planning";
import { evidenceExecutionResponseSchema } from "@/lib/evidence-snapshot/contracts";
import { explainFindingsAndProposal, explainReviewablePacket } from "@/lib/planning/packet-ai-summary";
import {
  packetFindingsSummarySchema,
  reviewableActionPacketSchema,
} from "@/lib/planning/reviewable-packet";
import { z } from "zod";

const headers = { "cache-control": "no-store" };

const requestSchema = z.object({
  plan: evaluationPlanSchema,
  actionId: z.string().trim().min(1).optional(),
  action: plannedActionSchema.optional(),
  evidenceExecution: evidenceExecutionResponseSchema.nullable().optional(),
  packet: reviewableActionPacketSchema.optional(),
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
  if (parsed.data.packet && parsed.data.packet.planId !== plan.planId) {
    return Response.json(
      { status: "error", message: "The supplied action packet does not belong to this evaluation plan." },
      { status: 400, headers },
    );
  }
  const action = parsed.data.action ?? (parsed.data.actionId
    ? plan.actions.find((item) => item.id === parsed.data.actionId)
    : proposedActionFromPlan(plan));
  if (!action) {
    return Response.json(
      { status: "error", message: "The requested action is not present in the plan." },
      { status: 400, headers },
    );
  }
  plannedActionSchema.parse(action);
  if (parsed.data.packet && parsed.data.packet.action.id !== action.id) {
    return Response.json(
      { status: "error", message: "The supplied action packet does not match the requested action." },
      { status: 400, headers },
    );
  }

  const summary = parsed.data.packet
    ? await explainReviewablePacket(parsed.data.packet)
    : await explainFindingsAndProposal(plan, action, parsed.data.evidenceExecution ?? null);
  return Response.json(
    {
      status: "ok",
      summary: packetFindingsSummarySchema.parse(summary),
    },
    { status: 200, headers },
  );
}
