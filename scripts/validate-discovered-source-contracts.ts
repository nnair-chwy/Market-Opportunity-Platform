import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  discoveredSourceRegistrySchema,
  firstPartyOutcomeReadinessReportSchema,
  semanticSourceContractRegistrySchema,
  validateDiscoveredOutcomeSource,
  type LocalApprovedSourceInventory,
} from "../lib/data-discovery/index.ts";

const workspaceRoot = process.cwd();
const readJson = async (relativePath: string) => JSON.parse(await readFile(path.join(workspaceRoot, relativePath), "utf8"));
const inventory = await readJson("data/contracts/local-approved-source-inventory.json") as LocalApprovedSourceInventory;
const discovery = discoveredSourceRegistrySchema.parse(await readJson("data/contracts/discovered-source-registry.json"));
const readiness = firstPartyOutcomeReadinessReportSchema.parse(await readJson("data/contracts/first-party-outcome-readiness.json"));
const reports = [];

for (const candidate of readiness.adapterCandidates) {
  const profile = discovery.profiles.find((item) => item.sourceId === candidate.sourceId);
  if (!profile) throw new Error(`Discovery profile ${candidate.sourceId} is missing.`);
  const sourcePackage = inventory.packages.find((item) => item.id === profile.packageId);
  if (!sourcePackage) throw new Error(`Approved package ${profile.packageId} is missing.`);
  reports.push(await validateDiscoveredOutcomeSource({
    workspaceRoot,
    approvedRoot: sourcePackage.root,
    profile,
    outcomeIds: candidate.outcomeIds,
  }));
}

const contracts = reports.flatMap((report) => report.semanticContract ? [report.semanticContract] : []);
const output = semanticSourceContractRegistrySchema.parse({
  version: "semantic-source-contract-registry-v1",
  generatedAt: process.env.SOURCE_DISCOVERY_GENERATED_AT ?? readiness.generatedAt,
  rawRowsStored: false,
  reports,
  contracts,
  summary: {
    validatedCandidateCount: reports.length,
    failedClosedCount: reports.filter((report) => report.status === "failed_closed").length,
    pendingOwnerReviewCount: contracts.length,
  },
});
const outputPath = path.join(workspaceRoot, "data/contracts/semantic-source-contract-registry.json");
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Validated ${reports.length} adapter candidate(s); ${contracts.length} semantic contract(s) await owner review.`);
