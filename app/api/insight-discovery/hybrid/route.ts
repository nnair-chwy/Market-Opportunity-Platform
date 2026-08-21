import {
  DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
  hybridDiscoveryRequestSchema,
  runHybridInsightDiscovery,
} from "@/lib/insight-discovery";
import { normalizedSnapshotDirectory, validateNormalizedSnapshot } from "@/lib/data-normalization/query";

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
    let normalizedSnapshotVersion: string | undefined;
    if (process.env.NORMALIZED_MARKET_DATA_DIR?.trim()) {
      try {
        const manifest = await validateNormalizedSnapshot(
          normalizedSnapshotDirectory(),
          parsed.data.normalizedSnapshotVersion ?? DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
        );
        normalizedSnapshotVersion = manifest.snapshotVersion;
      } catch {
        // A request cannot advertise local query tools merely by naming a
        // snapshot. Hosted discovery remains fully usable through the bundled
        // market-screen operators when the reviewed DuckDB snapshot is absent.
      }
    }
    return Response.json(await runHybridInsightDiscovery({ ...parsed.data, normalizedSnapshotVersion }), { status: 201, headers });
  } catch (error) {
    console.error("[hybrid-insight-discovery]", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ status: "error", message: "Hybrid discovery could not complete; use deterministic mode for a guaranteed baseline." }, { status: 500, headers });
  }
}
