import { createHash } from "node:crypto";
import { lstat, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { discoveredSourceProfileSchema, discoveredSourceRegistrySchema, SOURCE_DISCOVERY_VERSION, type DiscoveredSourceProfile, type LocalApprovedSourceInventory } from "./contracts.ts";
import { inferColumns, inferProfile } from "./inference.ts";
import { formatForFile, readTableSample } from "./readers.ts";

export type DiscoveryOptions = {
  workspaceRoot: string;
  inventory: LocalApprovedSourceInventory;
  generatedAt?: string;
  maxSampleRows?: number;
};

const inside = (parent: string, child: string) => child === parent || child.startsWith(`${parent}${path.sep}`);

function validateConfiguredRoot(value: string) {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/).includes("..")) throw new Error(`Approved source root must be a workspace-relative path without traversal: ${value}`);
}

async function listApprovedFiles(root: string): Promise<{ files: string[]; skipped: Array<{ file: string; reason: string }> }> {
  const files: string[] = [];
  const skipped: Array<{ file: string; reason: string }> = [];
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      const details = await lstat(candidate);
      if (details.isSymbolicLink()) { skipped.push({ file: candidate, reason: "Symbolic links are not followed across the approved-root boundary." }); continue; }
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile()) files.push(candidate);
    }
  }
  await visit(root);
  return { files: files.sort(), skipped };
}

function stableSourceId(packageId: string, relativePath: string) {
  const digest = createHash("sha256").update(`${packageId}\0${relativePath}`).digest("hex").slice(0, 16).toUpperCase();
  return `DISCOVERED-${digest}`;
}

export async function discoverApprovedSources(options: DiscoveryOptions) {
  const workspaceRoot = await realpath(options.workspaceRoot);
  const profiles: DiscoveredSourceProfile[] = [];
  const skipped: Array<{ relativePath: string; reason: string }> = [];
  const approvedRoots: string[] = [];

  for (const sourcePackage of [...options.inventory.packages].sort((left, right) => left.id.localeCompare(right.id))) {
    validateConfiguredRoot(sourcePackage.root);
    const configuredRoot = path.resolve(workspaceRoot, sourcePackage.root);
    if (!inside(workspaceRoot, configuredRoot)) throw new Error(`Approved root escapes the workspace: ${sourcePackage.root}`);
    const approvedRoot = await realpath(configuredRoot);
    if (!inside(workspaceRoot, approvedRoot)) throw new Error(`Approved root resolves outside the workspace: ${sourcePackage.root}`);
    approvedRoots.push(sourcePackage.root);
    const listed = await listApprovedFiles(approvedRoot);
    skipped.push(...listed.skipped.map((item) => ({ relativePath: path.relative(workspaceRoot, item.file), reason: item.reason })));
    const inventoryByPath = new Map(sourcePackage.files.map((file) => [file.file, file]));

    for (const absoluteFile of listed.files) {
      const resolvedFile = await realpath(absoluteFile);
      if (!inside(approvedRoot, resolvedFile)) { skipped.push({ relativePath: path.relative(workspaceRoot, absoluteFile), reason: "Resolved path escapes its configured approved root." }); continue; }
      const relativePath = path.relative(workspaceRoot, resolvedFile);
      const format = formatForFile(resolvedFile);
      if (!format) { skipped.push({ relativePath, reason: "Unsupported file extension." }); continue; }
      const inventoryFile = inventoryByPath.get(relativePath);
      const details = await stat(resolvedFile);
      try {
        const sample = await readTableSample(resolvedFile, format, options.maxSampleRows ?? 200);
        const columns = inferColumns(sample.columns, sample.rows);
        const inferred = inferProfile(columns, sample.rowCount, sample.rows.length);
        const approvalState = inventoryFile?.agentUse === "approved_local_source_file" ? "approved_local_source" : inventoryFile?.agentUse === "local_control_metadata" ? "control_metadata" : inventoryFile?.agentUse?.includes("excluded") ? "excluded" : "review_required";
        const queryEligibility = approvalState === "excluded" ? "excluded" : approvalState === "approved_local_source" && inferred.inferredSensitivity !== "restricted" ? "candidate_for_adapter" : "profile_only";
        const warnings = [...sample.warnings];
        if (!inventoryFile) warnings.push("File is physically present under an approved root but is absent from the signed local inventory; review is required before use.");
        if (columns.length === 0) warnings.push("No tabular columns could be profiled.");
        const inheritedRank = ["public", "internal", "confidential", "restricted"].indexOf(sourcePackage.sensitivity);
        const inferredRank = ["public", "internal", "confidential", "restricted"].indexOf(inferred.inferredSensitivity);
        const effectiveSensitivity = inheritedRank >= inferredRank ? sourcePackage.sensitivity : inferred.inferredSensitivity;
        profiles.push(discoveredSourceProfileSchema.parse({
          profileVersion: SOURCE_DISCOVERY_VERSION,
          sourceId: stableSourceId(sourcePackage.id, relativePath),
          packageId: sourcePackage.id,
          relativePath,
          format,
          bytes: details.size,
          sha256: inventoryFile?.sha256 ?? null,
          agentUse: inventoryFile?.agentUse ?? "unregistered_file_requires_review",
          inheritedSensitivity: sourcePackage.sensitivity,
          inferredSensitivity: effectiveSensitivity,
          sensitivitySignals: inferred.sensitivitySignals,
          allowedUse: sourcePackage.allowedUse,
          approvalState,
          evidenceStatus: inventoryFile ? "Reported" : "Unknown",
          rowCount: sample.rowCount,
          sampledRowCount: sample.rows.length,
          columns,
          grain: inferred.grain,
          geography: inferred.geography,
          time: inferred.time,
          metrics: inferred.metrics,
          uncertainties: inferred.uncertainties,
          warnings,
          containsRawRows: false,
          integration: {
            inventoryFileMatched: Boolean(inventoryFile),
            queryEligibility,
            nextStep: queryEligibility === "candidate_for_adapter" ? "Review inferred contract, validate full-file grain and quality, then register a typed adapter and allowlisted query." : queryEligibility === "excluded" ? "Retain for audit only; do not expose to evaluation." : "Resolve inventory, sensitivity, and contract review before any query integration.",
          },
        }));
      } catch (error) {
        skipped.push({ relativePath, reason: `Profile failed: ${error instanceof Error ? error.message : "unknown error"}` });
      }
    }
  }

  profiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  skipped.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return discoveredSourceRegistrySchema.parse({
    version: SOURCE_DISCOVERY_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workspace: options.inventory.workspace,
    approvedRoots: [...new Set(approvedRoots)].sort(),
    sourceInventoryVersion: options.inventory.version,
    rawRowsStored: false,
    profiles,
    skipped,
    summary: {
      discoveredFileCount: profiles.length + skipped.length,
      profiledFileCount: profiles.length,
      reviewRequiredCount: profiles.filter((profile) => profile.approvalState === "review_required").length,
      restrictedSignalCount: profiles.filter((profile) => profile.inferredSensitivity === "restricted").length,
    },
  });
}
