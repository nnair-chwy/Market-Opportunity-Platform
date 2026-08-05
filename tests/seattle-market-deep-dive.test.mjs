import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

async function withModules(callback) {
  const vite = await createServer({ configFile: false, appType: "custom", logLevel: "silent", plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } }, server: { hmr: false, middlewareMode: true } });
  try { await callback({
    agent: await vite.ssrLoadModule("/lib/seattle-market-deep-dive/agent-orchestrator.ts"),
    contracts: await vite.ssrLoadModule("/lib/seattle-market-deep-dive/agent-contracts.ts"),
    policy: await vite.ssrLoadModule("/lib/seattle-market-deep-dive/agent-policy.ts"),
    store: await vite.ssrLoadModule("/lib/seattle-market-deep-dive/agent-store.ts"),
    data: await vite.ssrLoadModule("/lib/seattle-market-deep-dive/data.ts"),
    geometry: await vite.ssrLoadModule("/lib/seattle-market-deep-dive/geometry.ts"),
    scoring: await vite.ssrLoadModule("/lib/seattle-market-deep-dive/scoring.ts"),
    route: await vite.ssrLoadModule("/app/api/market-deep-dive-runs/route.ts"),
  }); } finally { await vite.close(); }
}

const chooseFirst = async ({ permittedTools }) => ({ action: "call_tool", toolName: permittedTools[0], explanation: "Use the next permitted application tool." });

test("Seattle comparison is deterministic, transparent, and independent of illustrative geometry", async () => {
  await withModules(async ({ data, scoring }) => {
    const first = scoring.compareSeattleSubmarkets(data.seattleSubmarkets);
    const second = scoring.compareSeattleSubmarkets(data.seattleSubmarkets);
    assert.deepEqual(first, second); assert.equal(first.scores.length, 7); assert.equal(first.prioritySubmarketIds.length, 3);
    assert(first.scores.every((score) => score.overallScore >= 0 && score.overallScore <= 100));
    for (const score of first.scores) {
      assert.equal(Number(score.metricResults.reduce((sum, metric) => sum + (metric.contribution ?? 0), 0).toFixed(2)), score.overallScore);
    }
    const northSound = first.scores.find((score) => score.submarketId === "sea-demo-north-sound");
    assert.equal(northSound.coveragePercent, 85); assert.deepEqual(northSound.missingInputs, ["commercial_availability"]);
    assert.equal(Number(northSound.metricResults.reduce((sum, metric) => sum + metric.effectiveWeight, 0).toFixed(2)), 100);
    const changedGeometry = structuredClone(data.seattleSubmarkets); changedGeometry[0].hub.longitude += 0.05; changedGeometry[0].hub.radius_km += 2;
    assert.deepEqual(scoring.compareSeattleSubmarkets(changedGeometry), first);
  });
});

test("illustrative hubs and geodesic areas are valid, deterministic, and non-scored", async () => {
  await withModules(async ({ data, geometry }) => {
    assert.equal(data.seattleSubmarkets.length, 7);
    assert.equal(new Set(data.seattleSubmarkets.map((item) => item.display_number)).size, 7);
    assert(data.seattleSubmarkets.every((item) => Number.isFinite(item.hub.longitude) && Number.isFinite(item.hub.latitude) && Number.isFinite(item.hub.radius_km)));
    assert(data.seattleSubmarkets.every((item) => item.geometry_scoring_eligibility === "none"));
    const first = geometry.createSeattleIllustrativeOverlay(data.seattleSubmarkets);
    const second = geometry.createSeattleIllustrativeOverlay(data.seattleSubmarkets);
    assert.deepEqual(first, second); assert.equal(first.features.length, 14);
    const areas = first.features.filter((feature) => feature.properties.feature_kind === "illustrative_area");
    assert.equal(areas.length, 7);
    for (const area of areas) {
      assert.equal(area.geometry.type, "Polygon"); assert.equal(area.properties.scoring_eligibility, "none");
      const ring = area.geometry.coordinates[0]; assert.equal(ring.length, geometry.SEATTLE_AREA_VERTEX_COUNT + 1);
      assert.deepEqual(ring[0], ring.at(-1));
      assert(ring.every(([longitude, latitude]) => Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90));
    }
  });
});

test("persistent map owns the Seattle overlay and selection contract", async () => {
  const [page, map] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/UnifiedEvaluatorMap.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal((page.match(/<UnifiedEvaluatorMap/g) ?? []).length, 1);
  assert.match(page, /seattleDeepDiveOpen && selectedMarketCode === "42660"/);
  assert.match(page, /activeSeattleSubmarketId/);
  assert.match(map, /SEATTLE_OVERLAY_SOURCE_ID/);
  assert.match(map, /seattle-illustrative-area-fill/);
  assert.match(map, /onChooseSeattleSubmarket/);
  assert.match(map, /illustrative Seattle areas may overlap/i);
});

test("Seattle agent pauses before comparison and continues only after confirmation", async () => {
  await withModules(async ({ agent, contracts, policy, store }) => {
    store.clearSeattleAgentRunsForTests();
    const waiting = await agent.startSeattleAgentRun({ callModel: chooseFirst });
    assert.equal(waiting.status, "waiting_for_segmentation_review"); assert.equal(waiting.stepCount, 2);
    assert.equal(waiting.comparisonReady, false); assert.deepEqual(policy.permittedSeattleTools(waiting), []);
    assert(waiting.evidenceReceipts.some((item) => item.allowedUse === "market_context_only" && item.scoringEligibility === "none"));
    const completed = await agent.continueSeattleAgentRun(waiting.runId, { decisionId: waiting.requestedHumanDecisions[0].decisionId, decision: "confirm" }, { callModel: chooseFirst });
    assert.equal(completed.status, "completed"); assert.equal(completed.stepCount, 7); assert.equal(completed.comparisonReady, true);
    assert.equal(completed.brokerDirectoryReady, true); assert(completed.artifact); assert.equal(completed.artifact.prioritySubmarketIds.length, 3);
    assert.equal(contracts.seattleAgentRunSchema.parse(completed).runId, completed.runId);
  });
});

test("reject and unresolved decisions block without comparison", async () => {
  await withModules(async ({ agent, store }) => {
    for (const decision of ["reject", "leave_unresolved"]) {
      store.clearSeattleAgentRunsForTests(); const waiting = await agent.startSeattleAgentRun({ callModel: chooseFirst });
      const result = await agent.continueSeattleAgentRun(waiting.runId, { decisionId: waiting.requestedHumanDecisions[0].decisionId, decision }, { callModel: chooseFirst });
      assert.equal(result.status, "blocked"); assert.equal(result.comparisonReady, false);
      assert(!result.toolInvocations.some((item) => item.toolName === "compare_submarkets"));
    }
  });
});

test("policy rejects unsupported actions and unsafe language", async () => {
  await withModules(async ({ agent, contracts, store }) => {
    store.clearSeattleAgentRunsForTests();
    const failed = await agent.startSeattleAgentRun({ callModel: async () => ({ action: "call_tool", toolName: "compare_submarkets", explanation: "Run comparison." }) });
    assert.equal(failed.status, "failed");
    assert.throws(() => contracts.seattleAgentActionSchema.parse({ action: "call_tool", toolName: "get_seattle_market_context", explanation: "Recommend the best market with score 91." }));
  });
});

test("Seattle API fails closed when model access is absent", async () => {
  await withModules(async ({ route }) => {
    const original = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
    try {
      const response = await route.POST(new Request("http://local/api/market-deep-dive-runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cbsaCode: "42660" }) }));
      assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store"); assert.match((await response.json()).message, /not configured/i);
    } finally { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; }
  });
});
