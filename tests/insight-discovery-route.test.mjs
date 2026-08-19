import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

test("insight discovery API runs a cursor-bound same-snapshot reprioritization", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());
  const { POST } = await vite.ssrLoadModule("/app/api/insight-discovery/route.ts");

  const initialResponse = await POST(new Request("http://localhost/api/insight-discovery", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }));
  const initial = await initialResponse.json();
  assert.equal(initialResponse.status, 201);
  assert.equal(initial.runSequence, 1);
  assert.equal(initial.runAudit.mode, "initial_run");

  const rerunResponse = await POST(new Request("http://localhost/api/insight-discovery", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      previousRunId: initial.runId,
      previousPrimaryFindingIds: initial.findingSelection.primaryFindingIds,
      explorationCursor: initial.explorationCursor,
    }),
  }));
  const rerun = await rerunResponse.json();
  assert.equal(rerunResponse.status, 201);
  assert.notEqual(rerun.runId, initial.runId);
  assert.equal(rerun.runSequence, 2);
  assert.equal(rerun.runAudit.previousRunId, initial.runId);
  assert.equal(rerun.runAudit.mode, "same_snapshot_reprioritization");
  assert.equal(rerun.runAudit.reranHypothesisCount, initial.analysesRun);
  assert.deepEqual(rerun.runAudit.repeatedPrimaryFindingIds, []);
  assert.ok(rerun.primaryFindings.every((finding) => !initial.findingSelection.primaryFindingIds.includes(finding.insightId)));
  assert.equal(rerunResponse.headers.get("cache-control"), "no-store");

  const invalidCursor = await POST(new Request("http://localhost/api/insight-discovery", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ previousRunId: initial.runId, explorationCursor: "not-a-valid-cursor" }),
  }));
  assert.equal(invalidCursor.status, 400);
});
