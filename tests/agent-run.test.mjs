import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

async function withModules(callback) {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  try {
    await callback({
      agent: await vite.ssrLoadModule("/lib/agent/orchestrator.ts"),
      contracts: await vite.ssrLoadModule("/lib/agent/contracts.ts"),
      policy: await vite.ssrLoadModule("/lib/agent/policy.ts"),
      store: await vite.ssrLoadModule("/lib/agent/run-store.ts"),
      esri: await vite.ssrLoadModule("/lib/esri-demo/index.ts"),
      scoring: await vite.ssrLoadModule("/lib/scoring.ts"),
      agentRoute: await vite.ssrLoadModule("/app/api/agent-runs/route.ts"),
    });
  } finally {
    await vite.close();
  }
}

const chooseFirstTool = async ({ permittedTools }) => ({
  action: "call_tool",
  toolName: permittedTools[0],
  explanation: "Use the next approved application tool.",
});

function syntheticEvaluation(scoring) {
  const metricDefinitions = [
    {
      metricId: "synthetic_demand",
      name: "Synthetic demand index",
      description: "Synthetic demonstration input only.",
      unit: "index",
      direction: "higher-is-better",
      validRange: { min: 0, max: 100 },
      normalization: { function: "linear", version: "linear-v1", inputMin: 0, inputMax: 100, clamp: false },
      missingDataPolicy: "fail-evaluation",
      owner: "Synthetic fixture owner",
      sourceIds: ["SYNTHETIC-SRC-001"],
    },
  ];
  return {
    configuration: {
      configurationSchemaVersion: scoring.CONFIGURATION_SCHEMA_VERSION,
      scoringVersion: "synthetic-agent-gate-v1",
      calculationVersion: scoring.CALCULATION_VERSION,
      status: "synthetic",
      label: "Synthetic agent gate configuration",
      metricDefinitions,
      metricWeights: [{ metricId: "synthetic_demand", included: true, weight: 100 }],
      constraints: [],
      expectedWeightTotal: 100,
      notes: "Synthetic deterministic invocation test only.",
    },
    input: {
      siteId: "synthetic-agent-site",
      inputDataVersion: "synthetic-agent-input-v1",
      metricObservations: [{
        metricId: "synthetic_demand",
        rawValue: 75,
        unit: "index",
        sourceReference: { sourceId: "SYNTHETIC-SRC-001", observationId: "synthetic-demand-observation" },
        observedAt: "2026-07-01",
        geography: "synthetic-market",
        qualityStatus: "accepted",
        sensitivity: "internal",
      }],
      constraintObservations: [],
      qualitativeEvidence: [],
    },
  };
}

test("bounded run pauses for review, preserves receipts, and blocks non-scored evaluation", async () => {
  await withModules(async ({ agent, contracts, policy, store, esri }) => {
    store.clearAgentRunsForTests();
    const siteId = esri.DEMO_CANDIDATE_SITE_IDS.find(
      (id) => esri.esriTradeAreaProfiles.find((profile) => profile.site_id === id)?.variants.length > 1,
    );
    assert(siteId);
    const run = await agent.startAgentRun(siteId, { callModel: chooseFirstTool });
    assert.equal(run.status, "waiting_for_review");
    assert.equal(run.stepCount, 4);
    assert.equal(run.requestedHumanDecisions.length, 1);
    assert(run.evidenceReceipts.some((item) => item.allowedUse === "market_context_only" && item.scoringEligibility === "none"));
    assert(run.evidenceReceipts.every((item) => item.sourceIds.length > 0));
    assert(run.toolInvocations.every((item) => !/lease value|landlord|customer coordinate/i.test(item.summary)));
    assert.deepEqual(policy.permittedToolsForRun(run), []);
    assert.equal(contracts.agentRunSchema.parse(run).runId, run.runId);

    const decision = run.requestedHumanDecisions[0];
    const completed = await agent.continueAgentRun(run.runId, {
      decisionId: decision.decisionId,
      decision: "confirm",
      selectedTradeAreaId: decision.evidence[0].value,
    }, { callModel: chooseFirstTool });
    assert.equal(completed.status, "blocked");
    assert.equal(completed.evaluationStatus, "blocked");
    assert(completed.artifact);
    assert.equal(completed.artifact.status, "draft_blocked");
    assert(completed.unresolvedBlockers.some((item) => /scoring input/i.test(item.label)));
    assert(!completed.toolInvocations.some((item) => item.toolName === "run_deterministic_evaluation"));
  });
});

test("review rejection and leave-unresolved remain explicit", async () => {
  await withModules(async ({ agent, store, esri }) => {
    const siteId = esri.DEMO_CANDIDATE_SITE_IDS[0];
    for (const decisionValue of ["reject", "leave_unresolved"]) {
      store.clearAgentRunsForTests();
      const waiting = await agent.startAgentRun(siteId, { callModel: chooseFirstTool });
      const request = waiting.requestedHumanDecisions[0];
      const result = await agent.continueAgentRun(waiting.runId, {
        decisionId: request.decisionId,
        decision: decisionValue,
        selectedTradeAreaId: null,
      }, { callModel: chooseFirstTool });
      assert.equal(result.status, "blocked");
      assert.equal(result.reviewerResponses[0].decision, decisionValue);
      assert(result.unresolvedBlockers.some((item) => /relationship unresolved/i.test(item.label)));
    }
  });
});

test("deterministic evaluation runs only after injected prerequisites pass", async () => {
  await withModules(async ({ agent, store, esri, scoring }) => {
    store.clearAgentRunsForTests();
    const siteId = esri.DEMO_CANDIDATE_SITE_IDS[0];
    const deterministicEvaluation = syntheticEvaluation(scoring);
    const waiting = await agent.startAgentRun(siteId, {
      callModel: chooseFirstTool,
      deterministicEvaluation,
    });
    const request = waiting.requestedHumanDecisions[0];
    const result = await agent.continueAgentRun(waiting.runId, {
      decisionId: request.decisionId,
      decision: "confirm",
      selectedTradeAreaId: request.evidence[0].value,
    }, { callModel: chooseFirstTool, deterministicEvaluation });
    assert.equal(result.status, "completed");
    assert.equal(result.evaluationStatus, "completed");
    assert(result.toolInvocations.some((item) => item.toolName === "run_deterministic_evaluation"));
    assert.equal(result.evaluationResultVersion, scoring.CALCULATION_VERSION);
  });
});

test("policy rejects unsupported calls, unsafe model text, and maximum-step overflow", async () => {
  await withModules(async ({ agent, contracts, store, esri }) => {
    store.clearAgentRunsForTests();
    const siteId = esri.DEMO_CANDIDATE_SITE_IDS[0];
    const unsupported = await agent.startAgentRun(siteId, {
      callModel: async () => ({ action: "call_tool", toolName: "draft_review_brief", explanation: "Draft the packet." }),
    });
    assert.equal(unsupported.status, "failed");

    assert.throws(() => contracts.agentModelActionSchema.parse({
      action: "call_tool",
      toolName: "get_candidate_readiness",
      explanation: "Recommend this site with a score of 91.",
      sourceIds: ["INVENTED-SOURCE"],
    }));

    store.clearAgentRunsForTests();
    const waiting = await agent.startAgentRun(siteId, { callModel: chooseFirstTool });
    waiting.maxSteps = waiting.stepCount;
    store.saveAgentRun(waiting);
    const request = waiting.requestedHumanDecisions[0];
    const overflow = await agent.continueAgentRun(waiting.runId, {
      decisionId: request.decisionId,
      decision: "confirm",
      selectedTradeAreaId: request.evidence[0].value,
    }, { callModel: chooseFirstTool });
    assert.equal(overflow.status, "failed");
    assert.equal(overflow.stepCount, waiting.stepCount);
  });
});

test("agent API returns a controlled no-egress error when model access is absent", async () => {
  await withModules(async ({ agentRoute }) => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const response = await agentRoute.POST(new Request("http://local/api/agent-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId: "candidate" }),
      }));
      const payload = await response.json();
      assert.equal(response.status, 503);
      assert.match(payload.message, /not configured/i);
      assert.equal(response.headers.get("cache-control"), "no-store");
    } finally {
      if (original === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = original;
    }
  });
});
