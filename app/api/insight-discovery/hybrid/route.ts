import {
  DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
  hybridDiscoveryRequestSchema,
  runHybridInsightDiscovery,
} from "@/lib/insight-discovery";

const headers = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ status: "error", message: "Enter a valid hybrid discovery request." }, { status: 400, headers });
  }
  const parsed = hybridDiscoveryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ status: "error", message: "Hybrid discovery requires bounded mode, step, row, and snapshot settings." }, { status: 400, headers });
  }
  try {
    const normalizedSnapshotVersion = parsed.data.normalizedSnapshotVersion
      ?? (process.env.NORMALIZED_MARKET_DATA_DIR?.trim() ? DEFAULT_NORMALIZED_SNAPSHOT_VERSION : undefined);
    return Response.json(await runHybridInsightDiscovery({ ...parsed.data, normalizedSnapshotVersion }), { status: 201, headers });
  } catch (error) {
    console.error("[hybrid-insight-discovery]", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ status: "error", message: "Hybrid discovery could not complete; use deterministic mode for a guaranteed baseline." }, { status: 500, headers });
  }
}
