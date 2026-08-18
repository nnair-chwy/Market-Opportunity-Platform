import approvedSnapshot from "../../data/approved/derived-map-signals/current.json" with { type: "json" };
import {
  workspaceSnapshotBundleSchema,
  type WorkspaceSnapshotBundle,
  type WorkspaceSnapshotDataset,
  type WorkspaceSnapshotDatasetId,
} from "./workspace-snapshot.ts";

let parsedBundle: WorkspaceSnapshotBundle | undefined;

export function getApprovedWorkspaceSnapshotBundle() {
  parsedBundle ??= workspaceSnapshotBundleSchema.parse(approvedSnapshot);
  return parsedBundle;
}

export function getApprovedWorkspaceSnapshotDataset(
  datasetId: WorkspaceSnapshotDatasetId,
): WorkspaceSnapshotDataset {
  return getApprovedWorkspaceSnapshotBundle().datasets[datasetId];
}
