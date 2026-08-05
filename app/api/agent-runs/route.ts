import { createAgentRunRequestSchema } from "@/lib/agent/contracts";
import { startAgentRun } from "@/lib/agent/orchestrator";
import { ZodError } from "zod";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

export async function POST(request: Request) {
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
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return Response.json(
      { status: "error", message: "The candidate review request is too large." },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }
  try {
    const input = createAgentRunRequestSchema.parse(await request.json());
    const run = await startAgentRun(input.siteId);
    return Response.json(run, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { status: "error", message: "Select a valid candidate review record." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    return Response.json(
      {
        status: "error",
        message: "Candidate Review Agent could not start a supported run.",
      },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
