import { getApprovedWorkspaceSnapshotBundle } from "@/lib/perspectives/approved-workspace-snapshot";
import { workspaceSnapshotDatasetIdSchema } from "@/lib/perspectives/workspace-snapshot";

export async function GET(
  _request: Request,
  context: { params: Promise<{ datasetId: string }> },
) {
  const { datasetId: rawDatasetId } = await context.params;
  const parsedDatasetId = workspaceSnapshotDatasetIdSchema.safeParse(rawDatasetId);
  if (!parsedDatasetId.success) {
    return Response.json({ status: "error", message: "Unknown perspective map dataset." }, { status: 404 });
  }

  try {
    const bundle = getApprovedWorkspaceSnapshotBundle();
    return Response.json(bundle.datasets[parsedDatasetId.data], {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        status: "unavailable",
        message: "The approved local perspective-map snapshot has not been built.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
