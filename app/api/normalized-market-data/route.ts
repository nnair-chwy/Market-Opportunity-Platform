import { normalizedQueryRequestSchema } from "@/lib/data-normalization/contracts";
import { queryNormalizedMarketData } from "@/lib/data-normalization/query";

const headers = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ status: "error", message: "Enter a valid normalized-data query request." }, { status: 400, headers }); }
  const parsed = normalizedQueryRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ status: "error", message: "A registered query and valid parameters are required.", issues: parsed.error.issues }, { status: 400, headers });
  try {
    return Response.json(await queryNormalizedMarketData(parsed.data), { status: 200, headers });
  } catch {
    return Response.json({ status: "error", message: "The requested normalized local snapshot is unavailable or invalid." }, { status: 422, headers });
  }
}
