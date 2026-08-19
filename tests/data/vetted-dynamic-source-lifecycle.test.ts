import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { discoveredSourceProfileSchema } from "../../lib/data-discovery/contracts.ts";
import { validateDiscoveredOutcomeSource } from "../../lib/data-discovery/full-file-validator.ts";
import { createValidatedDiscoveredSourceContract } from "../../lib/discovered-evidence-query/contract-builder.ts";
import { executeAgenticEvidenceLoop } from "../../lib/planning/agentic-evidence-loop.ts";
import { planEvaluation } from "../../lib/planning/planner.ts";
import { createVettedDynamicSourceRuntime } from "../../lib/planning/vetted-dynamic-source-registry.ts";

test("approved CSV flows through validation, review, aggregate query, lifecycle receipt, and goal check", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "dynamic-lifecycle-"));
  const relativePath = "data/approved/incoming/new-regional-orders.csv";
  const file = path.join(workspaceRoot, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, [
    "DMA_CODE,REPORTING_WEEK,COHORT,ORDER_COUNT",
    "501,2026-08-03,A,10",
    "501,2026-08-03,B,20",
    "504,2026-08-03,A,5",
    "504,2026-08-03,B,8",
  ].join("\n"));
  const bytes = await readFile(file);
  const profile = discoveredSourceProfileSchema.parse({
    profileVersion: "approved-source-discovery-v1",
    sourceId: "NEW-REGIONAL-ORDERS",
    packageId: "incoming",
    relativePath,
    format: "csv",
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    agentUse: "approved aggregate evidence",
    inheritedSensitivity: "internal",
    inferredSensitivity: "internal",
    sensitivitySignals: [],
    allowedUse: "temporary_aggregate_evidence_only",
    approvalState: "approved_local_source",
    evidenceStatus: "Reported",
    rowCount: 4,
    sampledRowCount: 4,
    columns: [
      { name: "DMA_CODE", normalizedName: "dma_code", inferredType: "integer", nullable: false, sampledNonNullCount: 4, sampledDistinctCount: 2, roles: ["geography"], inferredUnit: null },
      { name: "REPORTING_WEEK", normalizedName: "reporting_week", inferredType: "date", nullable: false, sampledNonNullCount: 4, sampledDistinctCount: 1, roles: ["time"], inferredUnit: null },
      { name: "COHORT", normalizedName: "cohort", inferredType: "string", nullable: false, sampledNonNullCount: 4, sampledDistinctCount: 2, roles: ["dimension"], inferredUnit: null },
      { name: "ORDER_COUNT", normalizedName: "order_count", inferredType: "integer", nullable: false, sampledNonNullCount: 4, sampledDistinctCount: 4, roles: ["metric"], inferredUnit: "count" },
    ],
    grain: { description: "one DMA x reporting week x cohort", keyFields: ["DMA_CODE", "REPORTING_WEEK", "COHORT"], confidence: "high" },
    geography: { grain: "dma", fields: ["DMA_CODE"], confidence: "high", alternatives: [] },
    time: { fields: ["REPORTING_WEEK"], grain: "week", confidence: "high" },
    metrics: [{ field: "ORDER_COUNT", unit: "count", confidence: "high" }],
    uncertainties: [],
    warnings: [],
    containsRawRows: false,
    integration: { inventoryFileMatched: true, queryEligibility: "candidate_for_adapter", nextStep: "Review and register." },
  });

  const validation = await validateDiscoveredOutcomeSource({
    workspaceRoot,
    approvedRoot: "data/approved/incoming",
    profile,
    outcomeIds: ["regional_orders"],
  });
  assert.equal(validation.status, "structurally_valid_candidate");
  const contract = createValidatedDiscoveredSourceContract(profile, validation, {
    contractId: "new-regional-orders-contract-v1",
    reviewedBy: "Fixture data steward",
    reviewedAt: "2026-08-18T12:00:00.000Z",
    dimensionFields: ["DMA_CODE", "REPORTING_WEEK"],
    measures: [{ field: "ORDER_COUNT", allowedAggregations: ["sum"] }],
    filterFields: [],
    minimumGroupSize: 2,
  });
  const plan = planEvaluation("Where should we increase paid search spend?", "marketing");
  const runtime = createVettedDynamicSourceRuntime({
    version: "vetted-dynamic-source-registry-v1",
    approvedRoots: ["data/approved/incoming"],
    entries: [{
      id: "new-regional-orders",
      label: "Reviewed regional order outcomes",
      sourceFamily: "regional",
      relevanceScore: 99,
      addressesCriterionIds: ["marketing_business_outcome"],
      dedupeKey: "regional-orders-by-dma-week",
      compatibilityStatus: "compatible_with_limits",
      allowedUse: "internal_shadow_evaluation",
      perspectiveIds: ["marketing"],
      topics: ["local_growth"],
      geographyGrains: ["cbsa"],
      contract,
      query: {
        version: "discovered-evidence-query-v1",
        requestId: "registry-template-id",
        contractId: contract.contractId,
        operation: "aggregate",
        dimensions: ["DMA_CODE", "REPORTING_WEEK"],
        measures: [{ field: "ORDER_COUNT", aggregation: "sum" }],
        filters: [],
        orderBy: { field: "ORDER_COUNT", aggregation: "sum", direction: "descending" },
        limit: 10,
      },
      mapping: {
        geographyDimension: "DMA_CODE",
        geographyPrefix: "dma",
        geographyLabelPrefix: "DMA",
        timeDimension: "REPORTING_WEEK",
        reportScope: "Reviewed regional orders by DMA and week",
        metrics: [{ field: "ORDER_COUNT", aggregation: "sum", metricId: "first_party.regional_orders", currency: null }],
      },
    }],
  }, { workspaceRoot }, plan);

  const result = await executeAgenticEvidenceLoop({ requestId: "full-chain-run", plan }, {
    maxIterations: 1,
    now: () => "2026-08-18T12:00:00.000Z",
    candidateResearchPasses: runtime.candidateResearchPasses,
    executeCandidatePass: runtime.executeCandidatePass,
    executePass: async () => { throw new Error("The higher-ranked vetted source should execute first."); },
  });

  assert.equal(result.evidenceBundle.length, 2);
  assert.deepEqual(result.evidenceBundle.map((item) => item.rawValue), [30, 13]);
  assert.deepEqual(result.geographyIds, ["dma:501", "dma:504"]);
  assert.ok(result.evidenceBundle.every((item) => item.period.label === "2026-08-03"));
  assert.ok(result.evidenceBundle.every((item) => item.sourceId === "NEW-REGIONAL-ORDERS"));
  assert.deepEqual(result.evidenceBundle[0].structuredValue?.reviewedSourceContract, {
    contractId: "new-regional-orders-contract-v1",
    reviewedBy: "Fixture data steward",
    reviewedAt: "2026-08-18T12:00:00.000Z",
    fullFileValidationVersion: "discovered-source-full-validation-v1",
    semanticSourceContractVersion: "semantic-regional-outcome-source-v1",
    validatedRowCount: 4,
    sourceRowsRead: 4,
    sourceRowsMatched: 4,
    sourceRowsTruncated: false,
    resultLimitReached: false,
    suppressedGroupCount: 0,
    rawRowsReturned: false,
  });
  assert.ok(result.guardrails.some((item) => /reviewed by Fixture data steward/i.test(item)));
  assert.deepEqual(result.agenticLifecycle?.passes[0].selectedQueries, ["dynamic:new-regional-orders"]);
  assert.equal(result.agenticLifecycle?.passes[0].sourceIds[0], "NEW-REGIONAL-ORDERS");
  assert.ok(["pass", "partial", "fail"].includes(result.agenticLifecycle?.passes[0].answerStatus ?? ""));
  assert.equal(result.agenticLifecycle?.passes[0].addedEvidenceCount, 2);
});
