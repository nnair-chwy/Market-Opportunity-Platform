import {
  decodeInsightDiscoveryCursor,
  insightDiscoveryRequestSchema,
  runCurrentDataInsightDiscovery,
} from "@/lib/insight-discovery";

const headers = { "cache-control": "no-store" };

export async function POST(request?: Request) {
  let body: unknown = {};
  try {
    const raw = request ? await request.text() : "";
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return Response.json({ status: "error", message: "Enter a valid insight-discovery rerun request." }, { status: 400, headers });
  }
  const parsed = insightDiscoveryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ status: "error", message: "A rerun requires a valid previous run and finding history." }, { status: 400, headers });
  }
  try {
    let cursor: ReturnType<typeof decodeInsightDiscoveryCursor> | null = null;
    if (parsed.data.explorationCursor) {
      try {
        cursor = decodeInsightDiscoveryCursor(parsed.data.explorationCursor);
      } catch {
        return Response.json({ status: "error", message: "The exploration cursor is invalid or no longer supported." }, { status: 400, headers });
      }
    }
    if (cursor && cursor.runId !== parsed.data.previousRunId) {
      return Response.json({ status: "error", message: "The exploration cursor does not belong to the previous run." }, { status: 400, headers });
    }
    return Response.json(runCurrentDataInsightDiscovery({
      previousRunId: parsed.data.previousRunId,
      previousPrimaryFindingIds: parsed.data.previousPrimaryFindingIds,
      previousSnapshotFingerprint: cursor?.snapshotFingerprint,
      previousRunSequence: cursor?.runSequence,
      previouslyExcludedPrimaryFindingIds: cursor?.excludedPrimaryFindingIds,
    }), { status: 201, headers });
  } catch {
    return Response.json({ status: "error", message: "The current-data insight scan could not complete." }, { status: 500, headers });
  }
}
