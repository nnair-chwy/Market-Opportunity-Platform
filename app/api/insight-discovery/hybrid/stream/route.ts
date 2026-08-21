import {
  DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
  hybridDiscoveryRequestSchema,
  runHybridInsightDiscovery,
  type HybridDiscoveryProgressEvent,
} from "@/lib/insight-discovery";
import { normalizedSnapshotDirectory, validateNormalizedSnapshot } from "@/lib/data-normalization/query";

const responseHeaders = {
  "cache-control": "no-store",
  "content-type": "application/x-ndjson; charset=utf-8",
};

async function reviewedSnapshotVersion(requestedVersion?: string) {
  if (!process.env.NORMALIZED_MARKET_DATA_DIR?.trim()) return undefined;
  try {
    const manifest = await validateNormalizedSnapshot(
      normalizedSnapshotDirectory(),
      requestedVersion ?? DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
    );
    return manifest.snapshotVersion;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ status: "error", message: "Enter a valid hybrid discovery request." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const parsed = hybridDiscoveryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ status: "error", message: "Hybrid discovery requires bounded mode, step, row, and snapshot settings." }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const publish = (event: HybridDiscoveryProgressEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      void (async () => {
        try {
          const normalizedSnapshotVersion = await reviewedSnapshotVersion(parsed.data.normalizedSnapshotVersion);
          const run = await runHybridInsightDiscovery(
            { ...parsed.data, normalizedSnapshotVersion },
            { onProgress: publish },
          );
          publish({ type: "complete", run });
        } catch {
          publish({ type: "error", message: "AI discovery stopped safely. The repeatable findings remain available." });
        } finally {
          controller.close();
        }
      })();
    },
  });
  return new Response(stream, { status: 200, headers: responseHeaders });
}
