import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { LocalApprovedSourceInventory } from "./contracts.ts";

export const localSourcePackageSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]+$/),
  root: z.string().min(1),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
  allowedUse: z.string().min(1),
  contract: z.string().min(1),
}).strict();
export type LocalSourcePackage = z.infer<typeof localSourcePackageSchema>;

export const localSourceApprovalRegistrySchema = z.object({
  version: z.literal("local-source-approval-registry-v1"),
  approvals: z.array(z.object({
    packageId: z.string().min(1),
    file: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    approvedBy: z.string().min(1),
    approvedAt: z.string().datetime(),
    agentUse: z.literal("approved_local_source_file"),
  }).strict()),
}).strict().superRefine((value, ctx) => {
  const keys = new Set<string>();
  value.approvals.forEach((approval, index) => {
    const key = `${approval.packageId}:${approval.file}`;
    if (keys.has(key)) ctx.addIssue({ code: "custom", path: ["approvals", index, "file"], message: "An approval path may appear only once per package." });
    keys.add(key);
    if (path.isAbsolute(approval.file) || approval.file.split(/[\\/]/).includes("..")) ctx.addIssue({ code: "custom", path: ["approvals", index, "file"], message: "Approval paths must be workspace-relative without traversal." });
  });
});
export type LocalSourceApprovalRegistry = z.infer<typeof localSourceApprovalRegistrySchema>;

type InventoryFile = LocalApprovedSourceInventory["packages"][number]["files"][number] & {
  approvalReason?: string;
  approvedBy?: string;
  approvedAt?: string;
};

type BuildOptions = {
  workspaceRoot: string;
  packages: LocalSourcePackage[];
  priorInventory?: LocalApprovedSourceInventory | null;
  approvalRegistry?: LocalSourceApprovalRegistry | null;
  generatedAt: string;
};

const inside = (parent: string, child: string) => child === parent || child.startsWith(`${parent}${path.sep}`);

function safeRelative(value: string, label: string) {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/).includes("..")) throw new Error(`${label} must be workspace-relative without traversal.`);
}

async function hashFile(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function listRegularFiles(root: string): Promise<{ files: string[]; skippedSymlinks: string[] }> {
  const files: string[] = [];
  const skippedSymlinks: string[] = [];
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      const details = await lstat(candidate);
      if (details.isSymbolicLink()) { skippedSymlinks.push(candidate); continue; }
      if (details.isDirectory()) await visit(candidate);
      else if (details.isFile()) files.push(candidate);
    }
  }
  await visit(root);
  return { files: files.sort(), skippedSymlinks: skippedSymlinks.sort() };
}

function priorFiles(inventory: LocalApprovedSourceInventory | null | undefined) {
  return new Map<string, LocalApprovedSourceInventory["packages"][number]["files"][number]>((inventory?.packages ?? []).flatMap((sourcePackage) => sourcePackage.files.map((file) => [`${sourcePackage.id}:${file.file}`, file])));
}

export async function buildLocalApprovedSourceInventory(options: BuildOptions) {
  const workspaceRoot = await realpath(options.workspaceRoot);
  const packages = options.packages.map((item) => localSourcePackageSchema.parse(item));
  const approvals = localSourceApprovalRegistrySchema.parse(options.approvalRegistry ?? { version: "local-source-approval-registry-v1", approvals: [] });
  const prior = priorFiles(options.priorInventory);
  const explicit = new Map<string, LocalSourceApprovalRegistry["approvals"][number]>(approvals.approvals.map((approval) => [`${approval.packageId}:${approval.file}`, approval]));
  const observedApprovalKeys = new Set<string>();
  const inventoryPackages = [];
  const skippedSymlinks: string[] = [];

  for (const sourcePackage of packages) {
    safeRelative(sourcePackage.root, `Approved root for ${sourcePackage.id}`);
    const configuredRoot = path.resolve(workspaceRoot, sourcePackage.root);
    if (!inside(workspaceRoot, configuredRoot)) throw new Error(`Approved root for ${sourcePackage.id} escapes the workspace.`);
    const approvedRoot = await realpath(configuredRoot);
    if (!inside(workspaceRoot, approvedRoot)) throw new Error(`Approved root for ${sourcePackage.id} resolves outside the workspace.`);
    const listed = await listRegularFiles(approvedRoot);
    skippedSymlinks.push(...listed.skippedSymlinks.map((file) => path.relative(workspaceRoot, file)));
    const records: InventoryFile[] = [];
    for (const absoluteFile of listed.files) {
      const resolved = await realpath(absoluteFile);
      if (!inside(approvedRoot, resolved)) throw new Error(`Source file resolves outside approved package ${sourcePackage.id}.`);
      const relativeFile = path.relative(workspaceRoot, resolved);
      const details = await stat(resolved);
      const sha256 = await hashFile(resolved);
      const key = `${sourcePackage.id}:${relativeFile}`;
      const previous = prior.get(key);
      const approval = explicit.get(key);
      if (approval) observedApprovalKeys.add(key);
      let agentUse = "unregistered_file_requires_review";
      let approvalReason = previous && previous.sha256 !== sha256 ? "hash_changed_requires_review" : "new_file_requires_review";
      let approvedBy: string | undefined;
      let approvedAt: string | undefined;
      if (relativeFile.includes("/excluded/")) {
        agentUse = "audit_only_excluded_from_evaluation";
        approvalReason = "excluded_path_policy";
      } else if (relativeFile.endsWith("manifest.json")) {
        agentUse = "local_control_metadata";
        approvalReason = "control_metadata_path_policy";
      } else if (approval?.sha256 === sha256) {
        agentUse = approval.agentUse;
        approvalReason = "explicit_path_and_hash_approval";
        approvedBy = approval.approvedBy;
        approvedAt = approval.approvedAt;
      } else if (previous?.sha256 === sha256 && previous.agentUse === "approved_local_source_file") {
        agentUse = previous.agentUse;
        approvalReason = "retained_exact_prior_approval";
      } else if (approval && approval.sha256 !== sha256) {
        approvalReason = "explicit_approval_hash_mismatch";
      }
      records.push({ file: relativeFile, bytes: details.size, sha256, agentUse, approvalReason, ...(approvedBy ? { approvedBy, approvedAt } : {}) });
    }
    inventoryPackages.push({
      ...sourcePackage,
      gitTracked: false,
      fileCount: records.length,
      totalBytes: records.reduce((total, file) => total + file.bytes, 0),
      files: records,
    });
  }

  const staleApprovals = [...explicit.keys()].filter((key) => !observedApprovalKeys.has(key));
  if (staleApprovals.length) throw new Error(`Explicit source approvals do not resolve to configured package files: ${staleApprovals.join(", ")}`);
  return {
    version: "1.1.0",
    generatedAt: options.generatedAt,
    workspace: "Market-Opportunity-Platform-main",
    purpose: "Agent-discoverable inventory of local approved-root files with fail-closed path-and-hash approval state",
    rawAndSensitiveDataPolicy: "Files remain under ignored data/approved paths. New or changed files require explicit path-and-hash approval before adapter candidacy or querying.",
    approvalPolicy: {
      version: approvals.version,
      newFiles: "unregistered_file_requires_review",
      changedFiles: "hash_changed_requires_review",
      retainedApproval: "exact_package_path_and_sha256_only",
      explicitApproval: "data/contracts/local-source-approval-registry.json",
    },
    gisDownloadStatus: {
      observedAt: "2026-08-18",
      cvcCustomerGeospatialDashboard: "permission_denied_no_download",
      cvcVetCompetitionDashboard: "permission_denied_no_download",
      demographicsLookup: "no_verified_export_surface",
      retainedData: "existing minimized data/sample/esri/2026-07-30 fixture only",
    },
    skippedSymlinks,
    packages: inventoryPackages,
  };
}
