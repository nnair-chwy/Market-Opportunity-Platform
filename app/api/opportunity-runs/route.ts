import {
  getOpportunityInboxSnapshot,
  enrichEcosystemActionPackets,
  resetOpportunityInboxDemo,
  runSyntheticDiscovery,
} from "@/lib/opportunity-inbox";
import { z } from "zod";

const NO_STORE_HEADERS = { "cache-control": "no-store" };
const runRequestSchema = z.object({
  batchId: z.string().trim().min(1).max(120).optional(),
}).strict();

export async function GET() {
  return Response.json(getOpportunityInboxSnapshot(), {
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 8_192) {
      return Response.json(
        { status: "error", message: "The discovery request is too large." },
        { status: 413, headers: NO_STORE_HEADERS },
      );
    }
    const input = runRequestSchema.parse(await request.json());
    const result = runSyntheticDiscovery(input.batchId);
    const enrichedSnapshot = await enrichEcosystemActionPackets(result.snapshot.opportunities);
    return Response.json({ ...result, snapshot: enrichedSnapshot }, {
      status: 201,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discovery could not run.";
    return Response.json(
      { status: "error", message },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
}

export async function DELETE() {
  return Response.json(resetOpportunityInboxDemo(), {
    headers: NO_STORE_HEADERS,
  });
}
