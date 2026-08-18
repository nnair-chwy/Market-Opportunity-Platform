import { explainReviewablePacket } from "@/lib/planning/packet-ai-summary";
import {
  packetFindingsSummarySchema,
  reviewableActionPacketSchema,
} from "@/lib/planning/reviewable-packet";
import { z } from "zod";

const headers = { "cache-control": "no-store" };

const requestSchema = z.object({
  packet: reviewableActionPacketSchema,
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

  const summary = await explainReviewablePacket(parsed.data.packet);
  return Response.json(
    {
      status: "ok",
      summary: packetFindingsSummarySchema.parse(summary),
    },
    { status: 200, headers },
  );
}
