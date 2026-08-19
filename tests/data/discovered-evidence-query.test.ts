import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { discoveredSourceProfileSchema } from "../../lib/data-discovery/contracts.ts";
import { fullFileValidationReportSchema } from "../../lib/data-discovery/full-file-validator.ts";
import {
  createValidatedDiscoveredSourceContract,
  executeDiscoveredAggregateQuery,
  type DiscoveredAggregateQuery,
  type ValidatedDiscoveredSourceContract,
} from "../../lib/discovered-evidence-query/index.ts";

async function sha256(file: string) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function fixture() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "discovered-query-"));
  const approvedRoot = path.join(workspaceRoot, "data", "approved", "incoming");
  await mkdir(approvedRoot, { recursive: true });
  const relativePath = "data/approved/incoming/regional-outcomes.csv";
  const file = path.join(workspaceRoot, relativePath);
  await writeFile(file, [
    "DMA_CODE,REPORTING_WEEK,CHANNEL,ORDER_COUNT,CONTRIBUTION",
    "501,2026-08-03,Search,10,100.5",
    "501,2026-08-03,Search,20,",
    "504,2026-08-03,Search,5,",
    "504,2026-08-03,Search,8,",
    "505,2026-08-03,Search,1,5",
  ].join("\n"));
  const profile = discoveredSourceProfileSchema.parse({
    profileVersion: "approved-source-discovery-v1",
    sourceId: "DISCOVERED-OUTCOMES",
    packageId: "incoming",
    relativePath,
    format: "csv",
    bytes: (await readFile(file)).byteLength,
    sha256: await sha256(file),
    agentUse: "approved_local_source_file",
    inheritedSensitivity: "internal",
    inferredSensitivity: "internal",
    sensitivitySignals: [],
    allowedUse: "temporary_aggregate_evidence_only",
    approvalState: "approved_local_source",
    evidenceStatus: "Reported",
    rowCount: 5,
    sampledRowCount: 5,
    columns: [
      { name: "DMA_CODE", normalizedName: "dma_code", inferredType: "integer", nullable: false, sampledNonNullCount: 5, sampledDistinctCount: 3, roles: ["identifier", "geography"], inferredUnit: null },
      { name: "REPORTING_WEEK", normalizedName: "reporting_week", inferredType: "date", nullable: false, sampledNonNullCount: 5, sampledDistinctCount: 1, roles: ["time"], inferredUnit: null },
      { name: "CHANNEL", normalizedName: "channel", inferredType: "string", nullable: false, sampledNonNullCount: 5, sampledDistinctCount: 1, roles: ["dimension"], inferredUnit: null },
      { name: "ORDER_COUNT", normalizedName: "order_count", inferredType: "integer", nullable: false, sampledNonNullCount: 5, sampledDistinctCount: 5, roles: ["metric"], inferredUnit: "count" },
      { name: "CONTRIBUTION", normalizedName: "contribution", inferredType: "number", nullable: true, sampledNonNullCount: 2, sampledDistinctCount: 2, roles: ["metric"], inferredUnit: "currency_unspecified" },
    ],
    grain: { description: "one DMA x week x channel", keyFields: ["DMA_CODE", "REPORTING_WEEK", "CHANNEL"], confidence: "medium" },
    geography: { grain: "dma", fields: ["DMA_CODE"], confidence: "high", alternatives: [] },
    time: { fields: ["REPORTING_WEEK"], grain: "week", confidence: "high" },
    metrics: [{ field: "ORDER_COUNT", unit: "count", confidence: "high" }, { field: "CONTRIBUTION", unit: "currency_unspecified", confidence: "high" }],
    uncertainties: [],
    warnings: [],
    containsRawRows: false,
    integration: { inventoryFileMatched: true, queryEligibility: "candidate_for_adapter", nextStep: "Review and register." },
  });
  const validation = fullFileValidationReportSchema.parse({
    version: "discovered-source-full-validation-v1",
    sourceId: profile.sourceId,
    status: "structurally_valid_candidate",
    rowsValidated: 5,
    distinctGrainKeys: 5,
    duplicateRowCount: 0,
    fieldValidation: profile.columns.map((column) => ({
      field: column.name,
      role: column.roles.includes("metric") ? "metric" : column.roles.includes("geography") ? "geography" : column.roles.includes("time") ? "time" : column.roles.includes("dimension") ? "context" : "grain",
      missingCount: 0,
      invalidCount: 0,
    })),
    failures: [],
    rawRowsStored: false,
    semanticContract: {
      version: "semantic-regional-outcome-source-v1",
      sourceId: profile.sourceId,
      packageId: profile.packageId,
      fileSha256: profile.sha256,
      format: profile.format,
      rowCount: 5,
      rawRowsStored: false,
      allowedUse: profile.allowedUse,
      sensitivity: profile.inferredSensitivity,
      privacy: { directIdentifiersDetected: false, aggregateOnly: true },
      grain: { keyFields: profile.grain.keyFields, uniqueness: "validated_unique", duplicateRowCount: 0 },
      geography: { grain: "dma", fields: ["DMA_CODE"], validity: "all_rows_valid", semanticStatus: "candidate_requires_owner_review" },
      time: { grain: "week", fields: ["REPORTING_WEEK"], validity: "all_rows_valid", semanticStatus: "candidate_requires_owner_review" },
      metrics: [
        { outcomeId: "regional_orders", sourceField: "ORDER_COUNT", unit: "count", validity: "all_rows_numeric", definitionStatus: "candidate_requires_owner_review" },
        { outcomeId: "contribution_profit", sourceField: "CONTRIBUTION", unit: "currency_unspecified", validity: "all_rows_numeric", definitionStatus: "candidate_requires_owner_review" },
      ],
      fieldValidation: profile.columns.map((column) => ({
        field: column.name,
        role: column.roles.includes("metric") ? "metric" : column.roles.includes("geography") ? "geography" : column.roles.includes("time") ? "time" : column.roles.includes("dimension") ? "context" : "grain",
        missingCount: 0,
        invalidCount: 0,
      })),
      approvalState: "candidate_requires_owner_review",
      queryEligibility: "none_pending_semantic_approval",
      limitations: ["Fixture contract requires explicit query review."],
    },
  });
  const contract = createValidatedDiscoveredSourceContract(profile, validation, {
    contractId: "regional-outcomes-contract-v1",
    reviewedBy: "Test data steward",
    reviewedAt: "2026-08-18T12:00:00.000Z",
    dimensionFields: ["DMA_CODE", "REPORTING_WEEK", "CHANNEL"],
    measures: [
      { field: "ORDER_COUNT", allowedAggregations: ["sum", "average", "count_non_null"] },
      { field: "CONTRIBUTION", allowedAggregations: ["sum", "average"] },
    ],
    filterFields: ["REPORTING_WEEK", "CHANNEL"],
    minimumGroupSize: 2,
    maxSourceRows: 100,
    maxGroups: 10,
  });
  const query: DiscoveredAggregateQuery = {
    version: "discovered-evidence-query-v1",
    requestId: "aggregate-outcomes",
    contractId: contract.contractId,
    operation: "aggregate",
    dimensions: ["DMA_CODE"],
    measures: [
      { field: "ORDER_COUNT", aggregation: "sum" },
      { field: "CONTRIBUTION", aggregation: "average" },
    ],
    filters: [{ field: "CHANNEL", operator: "equals", value: "Search" }],
    orderBy: { field: "ORDER_COUNT", aggregation: "sum", direction: "descending" },
    limit: 10,
  };
  return { workspaceRoot, approvedRoot, file, profile, validation, contract, query };
}

test("runs only allowlisted bounded aggregates and preserves nulls, provenance, suppression, and quality", async () => {
  const { workspaceRoot, contract, query } = await fixture();
  const result = await executeDiscoveredAggregateQuery({ workspaceRoot, approvedRoots: ["data/approved/incoming"] }, contract, query);
  assert.equal(result.rawRowsReturned, false);
  assert.equal(result.sourceRowsRead, 5);
  assert.equal(result.sourceRowsMatched, 5);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((row) => row.dimensions.DMA_CODE), ["501", "504"]);
  assert.equal(result.rows[0].measures.find((item) => item.field === "ORDER_COUNT")?.rawValue, 30);
  assert.equal(result.rows[0].measures.find((item) => item.field === "CONTRIBUTION")?.rawValue, 100.5);
  assert.equal(result.rows[1].measures.find((item) => item.field === "CONTRIBUTION")?.rawValue, null);
  assert.equal(result.rows[1].measures.find((item) => item.field === "CONTRIBUTION")?.nonNullCount, 0);
  assert.equal(result.quality.nullCounts.CONTRIBUTION, 3);
  assert.equal(result.suppressedGroupCount, 1);
  assert.equal(result.provenance.sourceId, "DISCOVERED-OUTCOMES");
  assert.equal(result.provenance.sha256, contract.sha256);
  assert.equal(result.provenance.fullFileValidationVersion, "discovered-source-full-validation-v1");
  assert.equal(result.provenance.validatedRowCount, 5);
  assert.equal(result.provenance.reviewedBy, "Test data steward");
  assert.ok(result.quality.warnings.some((warning) => /suppressed/i.test(warning)));
});

test("strict request parsing rejects arbitrary SQL and contract policy rejects unknown fields or operations", async () => {
  const { workspaceRoot, contract, query } = await fixture();
  await assert.rejects(
    () => executeDiscoveredAggregateQuery({ workspaceRoot, approvedRoots: ["data/approved/incoming"] }, contract, { ...query, sql: "select * from secrets" }),
    /unrecognized key/i,
  );
  await assert.rejects(
    () => executeDiscoveredAggregateQuery({ workspaceRoot, approvedRoots: ["data/approved/incoming"] }, contract, { ...query, dimensions: ["NOT_ALLOWLISTED"] }),
    /not allowlisted/i,
  );
  await assert.rejects(
    () => executeDiscoveredAggregateQuery({ workspaceRoot, approvedRoots: ["data/approved/incoming"] }, contract, { ...query, measures: [{ field: "ORDER_COUNT", aggregation: "maximum" }] }),
    /not allowlisted/i,
  );
});

test("fixed source integrity and approved-root boundaries are enforced before execution", async () => {
  const { workspaceRoot, contract, query } = await fixture();
  await assert.rejects(
    () => executeDiscoveredAggregateQuery({ workspaceRoot, approvedRoots: ["data/approved/another-root"] }, contract, query),
    /ENOENT|approved root/i,
  );
  await assert.rejects(
    () => executeDiscoveredAggregateQuery({ workspaceRoot, approvedRoots: ["data/approved/incoming"] }, { ...contract, sha256: "0".repeat(64) }, query),
    /SHA-256 does not match/i,
  );
  await assert.rejects(
    () => executeDiscoveredAggregateQuery({ workspaceRoot, approvedRoots: ["../outside"] }, contract, query),
    /cannot contain traversal/i,
  );
});

test("source scans and returned groups are independently capped and reported as partial", async () => {
  const { workspaceRoot, contract, query } = await fixture();
  const boundedContract: ValidatedDiscoveredSourceContract = {
    ...contract,
    policy: { ...contract.policy, maxSourceRows: 4 },
  };
  const result = await executeDiscoveredAggregateQuery(
    { workspaceRoot, approvedRoots: ["data/approved/incoming"] },
    boundedContract,
    { ...query, limit: 1 },
  );
  assert.equal(result.status, "partial");
  assert.equal(result.sourceRowsTruncated, true);
  assert.equal(result.resultLimitReached, true);
  assert.equal(result.rows.length, 1);
  assert.ok(result.quality.warnings.some((warning) => /first 4 rows/i.test(warning)));
  assert.ok(result.quality.warnings.some((warning) => /only the first 1/i.test(warning)));
});

test("contract creation requires explicit approved, non-sensitive, fully validated adapter-candidate evidence", async () => {
  const { profile, validation } = await fixture();
  const review = { contractId: "blocked", reviewedBy: "Reviewer", reviewedAt: "2026-08-18T12:00:00.000Z", dimensionFields: ["DMA_CODE"], measures: [{ field: "ORDER_COUNT", allowedAggregations: ["sum" as const] }], filterFields: [] };
  assert.throws(() => createValidatedDiscoveredSourceContract(profile, undefined as never, review), /expected object/i);
  assert.throws(() => createValidatedDiscoveredSourceContract({ ...profile, approvalState: "review_required", integration: { ...profile.integration, queryEligibility: "profile_only" } }, validation, review), /approved local source/i);
  assert.throws(() => createValidatedDiscoveredSourceContract({ ...profile, inferredSensitivity: "restricted" }, validation, review), /restricted/i);
  assert.throws(() => createValidatedDiscoveredSourceContract({ ...profile, format: "xlsx" }, validation, review), /separately reviewed adapter/i);
  assert.throws(() => createValidatedDiscoveredSourceContract(profile, { ...validation, status: "failed_closed", semanticContract: null, failures: ["invalid full file"] }, review), /structurally_valid_candidate/i);
  assert.throws(() => createValidatedDiscoveredSourceContract(profile, { ...validation, semanticContract: { ...validation.semanticContract!, fileSha256: "0".repeat(64) } }, review), /does not match/i);
  assert.throws(() => createValidatedDiscoveredSourceContract(profile, validation, { ...review, filterFields: ["CHANNEL", "UNVALIDATED"] }), /both the discovered profile and full-file semantic contract/i);
});
