import { snapshotQueryRequestSchema, querySnapshot, snapshotReadiness } from "@/lib/evidence-snapshot/index.ts";
import { ZodError } from "zod";

const headers = { "cache-control": "no-store" };

export async function GET() {
  return Response.json(await snapshotReadiness(), { headers });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = snapshotQueryRequestSchema.parse(body);
    return Response.json(await querySnapshot(input), { headers });
  } catch (error) {
    const status = error instanceof ZodError ? 400 : 422;
    return Response.json({ status: "error", message: error instanceof Error ? error.message : "The evidence query failed." }, { status, headers });
  }
}
