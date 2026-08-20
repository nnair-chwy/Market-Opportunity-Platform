import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildLocalApprovedSourceInventory, localSourceApprovalRegistrySchema, type LocalSourcePackage } from "../lib/data-discovery/inventory-builder.ts";
import type { LocalApprovedSourceInventory } from "../lib/data-discovery/contracts.ts";

const workspaceRoot = process.cwd();
const generatedAt = process.env.LOCAL_SOURCE_INVENTORY_GENERATED_AT ?? new Date().toISOString();
const outputPath = path.join(workspaceRoot, "data/contracts/local-approved-source-inventory.json");
const approvalPath = path.join(workspaceRoot, "data/contracts/local-source-approval-registry.json");

const packages: LocalSourcePackage[] = [
  { id: "google-ads-2026-07-14_2026-08-12", root: "data/approved/google-ads/2026-07-14_2026-08-12", sensitivity: "internal", allowedUse: "workspace_validation_only", contract: "data/contracts/google-ads/export-catalog.json" },
  { id: "snowflake-pricing-2026-08-17", root: "data/approved/snowflake/pricing/2026-08-17", sensitivity: "internal", allowedUse: "internal_shadow_evaluation_and_source_validation_only", contract: "data/contracts/pricing-snowflake/export-manifest.json" },
  { id: "seo-keywords-2026-08-14", root: "data/approved/seo/2026-08-14", sensitivity: "internal", allowedUse: "national_demand_vocabulary_and_context_only", contract: "data/contracts/seo-keywords/manifest.json" },
  { id: "zeus-ui-2026-08-18", root: "data/approved/zeus-ui/2026-08-18", sensitivity: "internal", allowedUse: "internal_source_discovery_and_shadow_evaluation_only", contract: "data/contracts/zeus-ui/export-manifest.json" },
  { id: "tableau-cvc-2026-08-20", root: "data/approved/tableau-cvc/2026-08-20", sensitivity: "internal", allowedUse: "aggregate_clinic_and_marketing_outcome_analysis", contract: "data/contracts/tableau-cvc/export-manifest.json" },
];

async function optionalJson<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

const priorInventory = await optionalJson<LocalApprovedSourceInventory>(outputPath);
const approvalRegistry = localSourceApprovalRegistrySchema.parse(JSON.parse(await readFile(approvalPath, "utf8")));
const output = await buildLocalApprovedSourceInventory({ workspaceRoot, packages, priorInventory, approvalRegistry, generatedAt });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Inventoried ${output.packages.reduce((total, sourcePackage) => total + sourcePackage.fileCount, 0)} approved-root files; new or changed files remain review-required.`);
