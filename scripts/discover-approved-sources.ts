import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFirstPartyOutcomeReadiness, discoverApprovedSources, type LocalApprovedSourceInventory } from "../lib/data-discovery/index.ts";

const workspaceRoot = process.cwd();
const inventoryPath = path.join(workspaceRoot, "data/contracts/local-approved-source-inventory.json");
const outputPath = path.join(workspaceRoot, "data/contracts/discovered-source-registry.json");
const readinessPath = path.join(workspaceRoot, "data/contracts/first-party-outcome-readiness.json");
const inventory = JSON.parse(await readFile(inventoryPath, "utf8")) as LocalApprovedSourceInventory;
const registry = await discoverApprovedSources({
  workspaceRoot,
  inventory,
  generatedAt: process.env.SOURCE_DISCOVERY_GENERATED_AT,
  maxSampleRows: Number(process.env.SOURCE_DISCOVERY_SAMPLE_ROWS ?? 200),
});
await writeFile(outputPath, `${JSON.stringify(registry, null, 2)}\n`);
const readiness = buildFirstPartyOutcomeReadiness(registry);
await writeFile(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`);
console.log(`Profiled ${registry.summary.profiledFileCount} approved-root files into ${outputPath}; wrote outcome readiness to ${readinessPath}.`);
