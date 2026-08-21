import assert from "node:assert/strict";
import test from "node:test";
import { zodTextFormat } from "openai/helpers/zod";
import {
  EXPLORATORY_QUERY_VERSION,
  HYBRID_DISCOVERY_MAX_STEPS,
  hybridInvestigatorActionSchema,
  hybridInvestigatorResponseSchema,
  runHybridInsightDiscovery,
  type ExploratoryQuerySpec,
  type HybridInvestigatorAction,
} from "../lib/insight-discovery/index.ts";
import {
  DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
  NORMALIZED_CALCULATION_VERSION,
  NORMALIZED_QUERY_VERSION,
  type NormalizedQueryResponse,
} from "../lib/data-normalization/contracts.ts";

const fixed = { runId: "hybrid:test", now: () => "2026-08-20T12:00:00.000Z" };

function actions(sequence: HybridInvestigatorAction[]) {
  let index = 0;
  return async () => sequence[index++] ?? { action: "finish" as const, summary: "No additional approved investigation is likely to add value." };
}

test("deterministic mode always returns the established baseline without calling a model", async () => {
  let calls = 0;
  const run = await runHybridInsightDiscovery({ mode: "deterministic" }, {
    ...fixed,
    callModel: async () => { calls += 1; return { action: "finish", summary: "Finished." }; },
  });
  assert.equal(calls, 0);
  assert.equal(run.hybridAudit.mode, "deterministic_only");
  assert.equal(run.hybridAudit.terminationReason, "deterministic_requested");
  assert.ok(run.primaryFindings.length > 0);
  assert.deepEqual(run.supplementalInvestigations, []);
});

test("missing model configuration degrades to the deterministic baseline", async () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const run = await runHybridInsightDiscovery({ mode: "hybrid" }, fixed);
    assert.equal(run.hybridAudit.mode, "deterministic_only");
    assert.equal(run.hybridAudit.terminationReason, "model_not_configured");
    assert.match(run.hybridAudit.fallbackReason ?? "", /deterministic baseline/i);
  } finally {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});

test("a registered aggregate query is capped, scored, and appended only as an evidence receipt", async () => {
  const mockResponse: NormalizedQueryResponse = {
    requestId: "ignored",
    snapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
    queryVersion: NORMALIZED_QUERY_VERSION,
    calculationVersion: NORMALIZED_CALCULATION_VERSION,
    query: "growth_test_screening",
    cbsaCode: null,
    rows: [
      { cbsaCode: "35620", opportunity: 1 },
      { cbsaCode: "42660", opportunity: 2 },
      { cbsaCode: "41860", opportunity: 3 },
    ],
    sourceIds: ["SRC-034"],
    warnings: [],
    metadata: {},
    allowedUse: "local_demo_aggregate_decision_support",
    scoringEligibility: "none",
  };
  const run = await runHybridInsightDiscovery({
    mode: "hybrid",
    maxSteps: 2,
    maxResultRows: 2,
    normalizedSnapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
  }, {
    ...fixed,
    callModel: actions([
      {
        action: "execute",
        objective: "Check whether the approved cross-source growth screen adds markets or measures.",
        decisionValueHypothesis: "A cross-source aggregate may prioritize a bounded follow-up beyond platform-only findings.",
        invocation: { kind: "registered_query", query: "growth_test_screening" },
      },
      { action: "finish", summary: "The bounded query added the available non-duplicative context." },
    ]),
    queryExecutor: async (request) => ({ ...mockResponse, requestId: request.requestId }),
  });
  assert.equal(run.hybridAudit.mode, "hybrid_completed");
  assert.equal(run.hybridAudit.terminationReason, "model_finished");
  assert.equal(run.hybridAudit.receipts.length, 1);
  assert.equal(run.supplementalInvestigations.length, 1);
  assert.equal(run.supplementalInvestigations[0]?.rowCount, 2);
  assert.match(run.supplementalInvestigations[0]?.warnings.join(" ") ?? "", /capped at 2/i);
  assert.equal("rows" in run.supplementalInvestigations[0]!, false);
});

test("the hybrid loop can accept a novel app-compiled cross-source query with lineage", async () => {
  const spec: ExploratoryQuerySpec = {
    version: EXPLORATORY_QUERY_VERSION,
    tables: ["demand", "ads"],
    joins: [{ leftTableId: "demand", rightTableId: "ads", on: "cbsaCode" }],
    groupBy: ["cbsaCode", "cbsaName"],
    measures: [
      { tableId: "demand", column: "netSales", aggregation: "sum" },
      { tableId: "ads", column: "spend", aggregation: "sum" },
    ],
    filters: [{ tableId: "demand", column: "year", operator: "eq", value: 2025 }],
    orderBy: [{ kind: "measure", measureIndex: 0, direction: "desc" }],
    limit: 20,
  };
  const run = await runHybridInsightDiscovery({ mode: "hybrid", maxSteps: 2, normalizedSnapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION }, {
    ...fixed,
    callModel: actions([
      { action: "execute", objective: "Compare regional demand with paid media investment.", decisionValueHypothesis: "The join can identify markets where business demand and media allocation diverge.", invocation: { kind: "exploratory_query", spec } },
      { action: "finish", summary: "The cross-source query supplied the useful additional context." },
    ]),
    exploratoryQueryExecutor: async () => ({
      version: EXPLORATORY_QUERY_VERSION,
      snapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
      rows: [{ cbsaCode: "12060", cbsaName: "Atlanta", measure_0: 1200, measure_1: 100 }],
      rowLimitReached: false,
      lineage: {
        queryFingerprint: "a".repeat(64),
        tableIds: ["demand", "ads"],
        tables: [
          { tableId: "demand", tableName: "normalized_regional_demand_by_cbsa_year", grain: "CBSA x year", sourceIds: ["SNOWFLAKE-CSV-REGIONAL-DEMAND"] },
          { tableId: "ads", tableName: "normalized_google_ads_by_cbsa", grain: "CBSA x report scope", sourceIds: ["GOOGLE-ADS-CVC"] },
        ],
        selectedColumns: ["demand.netSales", "ads.spend"],
        filterColumns: ["demand.year"],
        joinRule: "cbsaCode_equality_only",
        parametersBound: 1,
        readOnly: true,
      },
    }),
  });
  assert.equal(run.supplementalInvestigations.length, 1);
  assert.equal(run.supplementalInvestigations[0]?.kind, "exploratory_query");
  assert.equal(run.supplementalInvestigations[0]?.lineage?.readOnly, true);
  assert.deepEqual(run.supplementalInvestigations[0]?.measureLabels, ["demand.netSales", "ads.spend"]);
});

test("baseline duplicate screens are rejected and never presented as supplemental findings", async () => {
  const run = await runHybridInsightDiscovery({ mode: "hybrid", maxSteps: 2 }, {
    ...fixed,
    callModel: actions([
      {
        action: "execute",
        objective: "Repeat the national paid-search response screen.",
        decisionValueHypothesis: "The repeated screen might return another ordering.",
        invocation: { kind: "market_screen", perspectiveId: "marketing", viewId: "paid_search_response", cbsaCodes: [] },
      },
      { action: "finish", summary: "No novel analysis remains." },
    ]),
  });
  assert.equal(run.hybridAudit.receipts[0]?.status, "rejected");
  assert.equal(run.hybridAudit.receipts[0]?.noveltyScore, 0);
  assert.deepEqual(run.supplementalInvestigations, []);
});

test("a novel AI-selected market screen is promoted only with a complete stakeholder finding", async () => {
  const run = await runHybridInsightDiscovery({ mode: "hybrid", maxSteps: 2 }, {
    ...fixed,
    callModel: actions([
      {
        action: "execute",
        objective: "Find a new regional paid-search opportunity.",
        decisionValueHypothesis: "A focused market screen may add a quantified result beyond the national scan.",
        invocation: { kind: "market_screen", perspectiveId: "marketing", viewId: "paid_search_response", cbsaCodes: ["35620"] },
      },
      { action: "finish", summary: "The focused screen returned the only new decision-ready result." },
    ]),
  });
  const promoted = run.supplementalInvestigations[0]?.supplementalFinding;
  assert.ok(promoted);
  assert.match(promoted.recommendation, /New York-Newark-Jersey City/i);
  assert.match(promoted.quantifiedEvidence, /percentile/i);
  assert.ok(promoted.comparison.length > 40);
  assert.ok(promoted.businessImplication.length > 20);
  assert.ok(promoted.nextAction.length > 20);
  assert.ok(promoted.sourceIds.length > 0);
  assert.ok(promoted.limitations.length > 0);
});

test("department scope rejects an unrelated registered query and stops after the hard failure limit", async () => {
  let modelCalls = 0;
  const run = await runHybridInsightDiscovery({
    mode: "hybrid",
    department: "pricing",
    maxSteps: HYBRID_DISCOVERY_MAX_STEPS,
    normalizedSnapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
  }, {
    ...fixed,
    callModel: async () => {
      modelCalls += 1;
      return {
        action: "execute",
        objective: "Try an unrelated marketing screen.",
        decisionValueHypothesis: "The marketing screen is outside Pricing scope.",
        invocation: { kind: "registered_query", query: "google_ads_context_by_cbsa", cbsaCode: "35620" },
      };
    },
    queryExecutor: async () => { throw new Error("The executor must not run for a disallowed query."); },
  });
  assert.equal(modelCalls, 2);
  assert.equal(run.hybridAudit.terminationReason, "failure_limit");
  assert.equal(run.hybridAudit.receipts.length, 2);
  assert.ok(run.hybridAudit.receipts.every((receipt) => receipt.status === "failed"));
  assert.deepEqual(run.supplementalInvestigations, []);
});

test("the action contract rejects arbitrary SQL and the request enforces hard limits", () => {
  assert.equal(hybridInvestigatorActionSchema.safeParse({
    action: "execute",
    objective: "Read everything.",
    decisionValueHypothesis: "An unrestricted query could find something.",
    invocation: { kind: "sql", sql: "DELETE FROM findings" },
  }).success, false);
  assert.equal(HYBRID_DISCOVERY_MAX_STEPS, 5);
});

test("the model response contract compiles to a required object-root schema", () => {
  const format = zodTextFormat(hybridInvestigatorResponseSchema, "hybrid_discovery_next_action");
  assert.equal(format.schema.type, "object");
  assert.deepEqual(format.schema.required, Object.keys(format.schema.properties ?? {}));
});

test("model failures return the deterministic baseline with a bounded audit", async () => {
  const run = await runHybridInsightDiscovery({ mode: "hybrid", maxSteps: 3 }, {
    ...fixed,
    callModel: async () => { throw new Error("synthetic model outage"); },
  });
  assert.equal(run.hybridAudit.mode, "hybrid_fallback");
  assert.equal(run.hybridAudit.terminationReason, "model_error");
  assert.match(run.hybridAudit.fallbackReason ?? "", /synthetic model outage/i);
  assert.ok(run.primaryFindings.length > 0);
});
