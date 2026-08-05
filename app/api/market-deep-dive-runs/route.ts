import { createSeattleAgentRunRequestSchema } from "@/lib/seattle-market-deep-dive/agent-contracts";
import { startSeattleAgentRun } from "@/lib/seattle-market-deep-dive/agent-orchestrator";
import { ZodError } from "zod";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) return Response.json({ status: "error", message: "Seattle Market Deep Dive is not configured. Add OPENAI_API_KEY to the server environment." }, { status: 503, headers: NO_STORE_HEADERS });
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 16_384) return Response.json({ status: "error", message: "The Seattle deep-dive request is too large." }, { status: 413, headers: NO_STORE_HEADERS });
  try {
    createSeattleAgentRunRequestSchema.parse(await request.json());
    return Response.json(await startSeattleAgentRun(), { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ status: "error", message: "This demo supports only Seattle CBSA 42660." }, { status: 400, headers: NO_STORE_HEADERS });
    return Response.json({ status: "error", message: "Seattle Market Deep Dive could not start a supported run." }, { status: 502, headers: NO_STORE_HEADERS });
  }
}
