import { continueAgentRunRequestSchema } from "@/lib/agent/contracts";
import { continueAgentRun } from "@/lib/agent/orchestrator";
import { getAgentRun } from "@/lib/agent/run-store";
import { ZodError } from "zod";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const run = getAgentRun(runId);
  if (!run) {
    return Response.json(
      {
        status: "error",
        message:
          "This process-local review run is unavailable. Start a new candidate review.",
      },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }
  return Response.json(run, { status: 200, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request, context: RouteContext) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      {
        status: "error",
        message:
          "Candidate Review Agent is not configured. Add OPENAI_API_KEY to the server environment.",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
  try {
    const { runId } = await context.params;
    const input = continueAgentRunRequestSchema.parse(await request.json());
    const run = await continueAgentRun(runId, input);
    return Response.json(run, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (error instanceof ZodError || /requires|cannot select|not pending|not waiting/i.test(message)) {
      return Response.json(
        { status: "error", message: "The analyst review response is not valid for this run." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (/not found/i.test(message)) {
      return Response.json(
        {
          status: "error",
          message:
            "This process-local review run is unavailable. Start a new candidate review.",
        },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    return Response.json(
      {
        status: "error",
        message: "Candidate Review Agent could not continue the supported run.",
      },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
