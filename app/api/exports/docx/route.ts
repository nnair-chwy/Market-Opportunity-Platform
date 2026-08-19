import { buildPacketDocx } from "@/lib/planning/docx-export";
import { reviewableActionPacketSchema } from "@/lib/planning/reviewable-packet";
import { z } from "zod";

const requestSchema = z.object({
  kind: z.enum(["decision_brief", "audit_appendix"]),
  packet: reviewableActionPacketSchema,
}).strict();

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 2_000_000) {
      return Response.json({ status: "error", message: "The report packet is too large." }, { status: 413 });
    }
    const input = requestSchema.parse(await request.json());
    const bytes = await buildPacketDocx(input.packet, input.kind);
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${input.kind === "decision_brief" ? "decision-brief.docx" : "evidence-audit-appendix.docx"}`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json({ status: "error", message: "A valid result packet is required to build the Word report." }, { status: 400 });
  }
}
