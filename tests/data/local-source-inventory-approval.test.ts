import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildLocalApprovedSourceInventory, type LocalSourceApprovalRegistry, type LocalSourcePackage } from "../../lib/data-discovery/inventory-builder.ts";
import type { LocalApprovedSourceInventory } from "../../lib/data-discovery/contracts.ts";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function fixture() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "approved-inventory-"));
  const approvedRoot = path.join(workspaceRoot, "data", "approved", "incoming");
  await mkdir(path.join(approvedRoot, "excluded"), { recursive: true });
  await writeFile(path.join(approvedRoot, "retained.csv"), "CBSA_CODE,ORDER_COUNT\n38060,10\n");
  await writeFile(path.join(approvedRoot, "changed.csv"), "CBSA_CODE,ORDER_COUNT\n38060,20\n");
  await writeFile(path.join(approvedRoot, "explicit.csv"), "CBSA_CODE,ORDER_COUNT\n38060,30\n");
  await writeFile(path.join(approvedRoot, "new.csv"), "CBSA_CODE,ORDER_COUNT\n38060,40\n");
  await writeFile(path.join(approvedRoot, "manifest.json"), "{}");
  await writeFile(path.join(approvedRoot, "excluded", "audit.csv"), "value\n1\n");
  await symlink(path.join(workspaceRoot, "data"), path.join(approvedRoot, "outside-link"));
  const root = "data/approved/incoming";
  const sourcePackage: LocalSourcePackage = { id: "incoming", root, sensitivity: "internal", allowedUse: "shadow_only", contract: "data/contracts/incoming.json" };
  const priorInventory: LocalApprovedSourceInventory = {
    version: "1.0.0",
    workspace: "test",
    packages: [{
      ...sourcePackage,
      files: [
        { file: `${root}/retained.csv`, bytes: 1, sha256: hash("CBSA_CODE,ORDER_COUNT\n38060,10\n"), agentUse: "approved_local_source_file" },
        { file: `${root}/changed.csv`, bytes: 1, sha256: hash("old bytes"), agentUse: "approved_local_source_file" },
      ],
    }],
  };
  const approvalRegistry: LocalSourceApprovalRegistry = {
    version: "local-source-approval-registry-v1",
    approvals: [{ packageId: "incoming", file: `${root}/explicit.csv`, sha256: hash("CBSA_CODE,ORDER_COUNT\n38060,30\n"), approvedBy: "Fixture steward", approvedAt: "2026-08-19T12:00:00.000Z", agentUse: "approved_local_source_file" }],
  };
  return { workspaceRoot, sourcePackage, priorInventory, approvalRegistry };
}

test("retains exact prior approvals, requires review for new or changed files, and honors exact explicit approvals", async () => {
  const { workspaceRoot, sourcePackage, priorInventory, approvalRegistry } = await fixture();
  const inventory = await buildLocalApprovedSourceInventory({ workspaceRoot, packages: [sourcePackage], priorInventory, approvalRegistry, generatedAt: "2026-08-19T12:00:00.000Z" });
  const files = new Map(inventory.packages[0]!.files.map((file) => [path.basename(file.file), file]));
  assert.equal(files.get("retained.csv")?.agentUse, "approved_local_source_file");
  assert.equal(files.get("retained.csv")?.approvalReason, "retained_exact_prior_approval");
  assert.equal(files.get("explicit.csv")?.agentUse, "approved_local_source_file");
  assert.equal(files.get("explicit.csv")?.approvalReason, "explicit_path_and_hash_approval");
  assert.equal(files.get("explicit.csv")?.approvedBy, "Fixture steward");
  assert.equal(files.get("new.csv")?.agentUse, "unregistered_file_requires_review");
  assert.equal(files.get("new.csv")?.approvalReason, "new_file_requires_review");
  assert.equal(files.get("changed.csv")?.agentUse, "unregistered_file_requires_review");
  assert.equal(files.get("changed.csv")?.approvalReason, "hash_changed_requires_review");
  assert.equal(files.get("manifest.json")?.agentUse, "local_control_metadata");
  assert.equal(files.get("audit.csv")?.agentUse, "audit_only_excluded_from_evaluation");
  assert.deepEqual(inventory.skippedSymlinks, ["data/approved/incoming/outside-link"]);
});

test("a first inventory run discovers files but approves none without an explicit path-and-hash review", async () => {
  const { workspaceRoot, sourcePackage } = await fixture();
  const inventory = await buildLocalApprovedSourceInventory({ workspaceRoot, packages: [sourcePackage], priorInventory: null, approvalRegistry: null, generatedAt: "2026-08-19T12:00:00.000Z" });
  const dataFiles = inventory.packages[0]!.files.filter((file) => file.file.endsWith(".csv") && !file.file.includes("/excluded/"));
  assert.ok(dataFiles.length > 0);
  assert.ok(dataFiles.every((file) => file.agentUse === "unregistered_file_requires_review"));
});

test("stale approvals and approval hash mismatches fail closed", async () => {
  const { workspaceRoot, sourcePackage } = await fixture();
  const stale: LocalSourceApprovalRegistry = { version: "local-source-approval-registry-v1", approvals: [{ packageId: "incoming", file: "data/approved/incoming/missing.csv", sha256: "a".repeat(64), approvedBy: "Reviewer", approvedAt: "2026-08-19T12:00:00.000Z", agentUse: "approved_local_source_file" }] };
  await assert.rejects(() => buildLocalApprovedSourceInventory({ workspaceRoot, packages: [sourcePackage], approvalRegistry: stale, generatedAt: "2026-08-19T12:00:00.000Z" }), /do not resolve/i);

  const wrong: LocalSourceApprovalRegistry = { version: "local-source-approval-registry-v1", approvals: [{ packageId: "incoming", file: "data/approved/incoming/new.csv", sha256: "b".repeat(64), approvedBy: "Reviewer", approvedAt: "2026-08-19T12:00:00.000Z", agentUse: "approved_local_source_file" }] };
  const inventory = await buildLocalApprovedSourceInventory({ workspaceRoot, packages: [sourcePackage], approvalRegistry: wrong, generatedAt: "2026-08-19T12:00:00.000Z" });
  const file = inventory.packages[0]!.files.find((item) => item.file.endsWith("new.csv"));
  assert.equal(file?.agentUse, "unregistered_file_requires_review");
  assert.equal(file?.approvalReason, "explicit_approval_hash_mismatch");
});
