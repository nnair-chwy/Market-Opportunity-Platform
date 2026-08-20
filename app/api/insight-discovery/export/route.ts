import { z } from "zod";
import {
  buildDiscoveryCsv,
  buildDiscoveryDocx,
  discoveryExportFilename,
  type DiscoveryExportScope,
} from "@/lib/insight-discovery/export";
import type { CurrentDataDiscoveryRun } from "@/lib/insight-discovery";

export const dynamic = "force-dynamic";

const scopeSchema = z.enum(["all", "marketing", "pricing", "cvc"]);
const requestSchema = z.object({
  format: z.enum(["csv", "docx"]),
  scope: scopeSchema,
  run: z.object({
    runId: z.string().min(1),
    runSequence: z.number().int().positive(),
    completedAt: z.string().min(1),
    analysesRun: z.number().int().nonnegative(),
    marketUniverse: z.number().int().nonnegative(),
    measuresExamined: z.number().int().nonnegative(),
    findings: z.array(z.object({ insightId: z.string().min(1) }).passthrough()).max(250),
    primaryFindings: z.array(z.object({ insightId: z.string().min(1) }).passthrough()).max(25),
    limitations: z.array(z.string()).max(50),
  }).passthrough(),
}).strict();

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 5_000_000) {
      return Response.json({ status: "error", message: "The discovery run is too large to export." }, { status: 413 });
    }
    const input = requestSchema.parse(await request.json());
    const run = input.run as unknown as CurrentDataDiscoveryRun;
    const scope = input.scope as DiscoveryExportScope;
    const filename = discoveryExportFilename(run, scope, input.format);
    const body = input.format === "csv" ? buildDiscoveryCsv(run, scope) : await buildDiscoveryDocx(run, scope);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": input.format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json({ status: "error", message: "A completed discovery run and valid export scope are required." }, { status: 400 });
  }
}
