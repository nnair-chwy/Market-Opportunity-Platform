import { continueSeattleAgentRunRequestSchema } from "@/lib/seattle-market-deep-dive/agent-contracts";
import { continueSeattleAgentRun } from "@/lib/seattle-market-deep-dive/agent-orchestrator";
import { getSeattleAgentRun } from "@/lib/seattle-market-deep-dive/agent-store";
import { ZodError } from "zod";

const NO_STORE_HEADERS = { "cache-control": "no-store" };
type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const run = getSeattleAgentRun((await context.params).runId);
  return run ? Response.json(run, { headers: NO_STORE_HEADERS }) : Response.json({ status: "error", message: "This process-local Seattle run is unavailable. Start a new run." }, { status: 404, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request, context: RouteContext) {
  if (!process.env.OPENAI_API_KEY?.trim()) return Response.json({ status: "error", message: "Seattle Market Deep Dive is not configured. Add OPENAI_API_KEY to the server environment." }, { status: 503, headers: NO_STORE_HEADERS });
  try {
    const input = continueSeattleAgentRunRequestSchema.parse(await request.json());
    return Response.json(await continueSeattleAgentRun((await context.params).runId, input), { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (error instanceof ZodError || /waiting|pending/i.test(message)) return Response.json({ status: "error", message: "The segmentation response is not valid for this run." }, { status: 400, headers: NO_STORE_HEADERS });
    if (/not found/i.test(message)) return Response.json({ status: "error", message: "This process-local Seattle run is unavailable. Start a new run." }, { status: 404, headers: NO_STORE_HEADERS });
    return Response.json({ status: "error", message: "Seattle Market Deep Dive could not continue the supported run." }, { status: 502, headers: NO_STORE_HEADERS });
  }
}
