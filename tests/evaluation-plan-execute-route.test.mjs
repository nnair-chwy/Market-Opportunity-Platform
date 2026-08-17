import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

test("execution API validates requests and reports local snapshot availability honestly", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());
  const [{ POST }, scenarios, planner] = await Promise.all([
    vite.ssrLoadModule("/app/api/evaluation-plans/execute/route.ts"),
    vite.ssrLoadModule("/lib/demo/scenarios.ts"),
    vite.ssrLoadModule("/lib/planning/planner.ts"),
  ]);

  const malformed = await POST(new Request("http://localhost/api/evaluation-plans/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "bad", plan: { planId: "bad" } }) }));
  assert.equal(malformed.status, 400);

  const snapshotDir = resolve(process.env.CLINIC_MARKET_SNAPSHOT_DIR?.trim() || ".local-data/clinic-market-snapshot");
  const databasePath = resolve(process.env.DUCKDB_PATH?.trim() || ".local/evidence-snapshot.duckdb");
  const localSnapshotAvailable = existsSync(join(snapshotDir, "manifest.json")) && existsSync(databasePath);

  for (const [id, question] of Object.entries(scenarios.DEMO_QUESTIONS)) {
    const plan = scenarios.planConfiguredDemoQuestion(question);
    const response = await POST(new Request("http://localhost/api/evaluation-plans/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: `route-${id}`, plan }) }));
    const body = await response.json();

    if (id !== "clinicPerformance" && !localSnapshotAvailable) {
      assert.equal(response.status, 422);
      assert.equal(body.status, "failed");
      assert.equal(body.errorCode, "SNAPSHOT_VALIDATION_FAILED");
      assert.deepEqual(body.evidenceBundle, []);
      assert.equal(response.headers.get("cache-control"), "no-store");
      continue;
    }

    assert.equal(response.status, 200);
    assert.equal(body.requestId, `route-${id}`);
    assert.equal(body.planId, plan.planId);
    assert.equal(body.originalQuestion, question);
    assert.ok(["complete", "partial", "blocked"].includes(body.status));
    assert.equal(response.headers.get("cache-control"), "no-store");
  }

  const blockedPlan = planner.planEvaluation("What should we do next?");
  const blocked = await POST(new Request("http://localhost/api/evaluation-plans/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "route-blocked", plan: blockedPlan }) }));
  const blockedBody = await blocked.json();
  assert.equal(blocked.status, 200);
  assert.equal(blockedBody.status, "blocked");
  assert.deepEqual(blockedBody.componentQueries, []);
  assert.deepEqual(blockedBody.evidenceBundle, []);
});
