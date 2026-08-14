import {
  deterministicFindingsAndProposalSummary,
  evaluationPlanRequestSchema,
  planEvaluation,
  proposedActionFromPlan,
  packetFindingsSummarySchema,
  type EvaluationPlan,
} from "@/lib/planning";
import { proposeEvaluationPlanWithAi } from "@/lib/planning/ai-planner";
import { explainFindingsAndProposal } from "@/lib/planning/packet-ai-summary";
import {
  assembleReviewableActionPacket,
} from "@/lib/planning/reviewable-packet";
import {
  clinicSiteWorkflowResultSchema,
  runClinicSiteWorkflow,
} from "@/lib/phoenix-retrieval";
import { z } from "zod";

const headers = { "cache-control": "no-store" };

const responseSchema = z.object({
  status: z.literal("ok"),
  plan: z.any(),
  workflow: clinicSiteWorkflowResultSchema,
  packet: z.any(),
  explanation: packetFindingsSummarySchema,
}).strict();

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ status: "error", message: "Enter a valid clinic-site question." }, { status: 400, headers });
  }

  const parsed = evaluationPlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ status: "error", message: "Enter a clinic-site question between 3 and 600 characters." }, { status: 400, headers });
  }

  let plan: EvaluationPlan = planEvaluation(parsed.data.question);
  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      plan = await proposeEvaluationPlanWithAi(parsed.data.question);
    } catch (error) {
      console.error("[clinic-site-evaluation] planner", error instanceof Error ? error.name : "UnknownError");
    }
  }

  const workflow = await runClinicSiteWorkflow(plan);
  const action = proposedActionFromPlan(plan);
  const packet = assembleReviewableActionPacket(plan, action, new Date().toISOString(), null);
  const fallback = deterministicFindingsAndProposalSummary(plan, action);
  let explanation = fallback;
  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      explanation = await explainFindingsAndProposal(plan, action);
    } catch (error) {
      console.error("[clinic-site-evaluation] explanation", error instanceof Error ? error.name : "UnknownError");
    }
  }

  return Response.json(responseSchema.parse({
    status: "ok",
    plan,
    workflow,
    packet,
    explanation,
  }), { headers });
}
