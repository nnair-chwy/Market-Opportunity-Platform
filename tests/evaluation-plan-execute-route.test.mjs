import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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
  const [{ POST }, scenarios, planner, contracts] = await Promise.all([
    vite.ssrLoadModule("/app/api/evaluation-plans/execute/route.ts"),
    vite.ssrLoadModule("/lib/demo/scenarios.ts"),
    vite.ssrLoadModule("/lib/planning/planner.ts"),
    vite.ssrLoadModule("/lib/evidence-snapshot/contracts.ts"),
  ]);

  const malformed = await POST(new Request("http://localhost/api/evaluation-plans/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "bad", plan: { planId: "bad" } }) }));
  assert.equal(malformed.status, 400);

  for (const [id, question] of Object.entries(scenarios.DEMO_QUESTIONS)) {
    const plan = scenarios.planConfiguredDemoQuestion(question) ?? planner.planEvaluation(question);
    const response = await POST(new Request("http://localhost/api/evaluation-plans/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: `route-${id}`, plan }) }));
    const body = await response.json();

    assert.equal(response.status, body.status === "failed" ? 422 : 200);
    assert.equal(body.requestId, `route-${id}`);
    assert.equal(body.planId, plan.planId);
    assert.equal(body.originalQuestion, question);
    assert.equal(body.sourceAdaptation.version, "source-adaptation-readiness-v1");
    assert.equal(body.sourceAdaptation.originalGoal, question);
    assert.match(body.sourceAdaptation.registryFingerprint, /^[a-f0-9]{64}$/);
    assert.ok(["adapted_with_new_evidence", "reviewed_sources_considered", "no_compatible_reviewed_source"].includes(body.sourceAdaptation.status));
    assert.ok(Array.isArray(body.sourceAdaptation.sources));
    assert.ok(Array.isArray(body.sourceAdaptation.nextRequiredDataset.fields));
    assert.ok(["complete", "partial", "blocked", "failed"].includes(body.status));
    if (id === "clinicPerformance") {
      assert.equal(body.executionMode, "synthetic_demo");
      assert.equal(body.status, "partial");
    } else if (body.status === "failed") {
      assert.equal(JSON.stringify(body).includes(process.cwd()), false);
    } else {
      assert.notEqual(body.status, "blocked");
    }
    assert.equal(response.headers.get("cache-control"), "no-store");
  }

  const blockedPlan = planner.planEvaluation("What should we do next?");
  const blocked = await POST(new Request("http://localhost/api/evaluation-plans/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "route-blocked", plan: blockedPlan }) }));
  const blockedBody = await blocked.json();
  assert.equal(blocked.status, 200);
  assert.equal(blockedBody.status, "blocked");
  assert.deepEqual(blockedBody.componentQueries, []);
  assert.deepEqual(blockedBody.evidenceBundle, []);

  const normalizedSnapshotDir = resolve(process.env.NORMALIZED_MARKET_DATA_DIR?.trim() || ".local-data/normalized-market-data");
  const normalizedAvailable = existsSync(join(normalizedSnapshotDir, "manifest.json"));
  const normalizedPlan = planner.planEvaluation("What aggregate clinic orders, customers, prescriptions, and sales exist for Seattle?");
  const normalized = await POST(new Request("http://localhost/api/evaluation-plans/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "route-normalized", plan: normalizedPlan }) }));
  const normalizedBody = await normalized.json();
  assert.equal(normalized.status, normalizedAvailable ? 200 : 422);
  assert.equal(normalized.headers.get("cache-control"), "no-store");
  if (normalizedAvailable) {
    assert.equal(normalizedBody.query, "normalized_evidence_bundle");
    assert.deepEqual(normalizedBody.componentQueries, ["clinic_context_by_cbsa"]);
    assert.equal(JSON.stringify(normalizedBody).includes(normalizedSnapshotDir), false);
    const clinicLocationPlan = planner.planEvaluation("What evidence should we review before opening a clinic in Phoenix?");
    const clinicLocation = await POST(new Request("http://localhost/api/evaluation-plans/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "route-clinic-location", plan: clinicLocationPlan }) }));
    const clinicLocationBody = await clinicLocation.json();
    assert.equal(clinicLocation.status, 200);
    assert.equal(clinicLocationBody.query, "clinic_location_evidence_bundle");
    assert.ok(clinicLocationBody.missingEvidence.some((item) => /staffed capacity/i.test(item)));
    assert.ok(clinicLocationBody.missingEvidence.some((item) => /workforce and competitive access/i.test(item)));
    assert.deepEqual(clinicLocationBody.geographyIds, ["cbsa:38060"]);
    assert.deepEqual(clinicLocationBody.componentQueries, ["regional_context_by_cbsa", "clinic_context_by_cbsa"]);
  } else {
    assert.equal(normalizedBody.status, "failed");
    assert.equal(JSON.stringify(normalizedBody).includes(process.cwd()), false);
  }

  const originalCwd = process.cwd();
  const runtimeDirectory = await mkdtemp(join(tmpdir(), "evaluation-route-runtime-"));
  try {
    process.chdir(runtimeDirectory);
    const plan = planner.planEvaluation("Where should we increase paid search spend?", "marketing");
    const response = await POST(new Request("http://localhost/api/evaluation-plans/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "route-bundled-registry", plan }) }));
    const body = await response.json();
    assert.notEqual(response.status, 500);
    assert.equal(body.requestId, "route-bundled-registry");
    assert.equal(body.planId, plan.planId);
    assert.equal(body.sourceAdaptation.version, "source-adaptation-readiness-v1");
  } finally {
    process.chdir(originalCwd);
    await rm(runtimeDirectory, { recursive: true, force: true });
  }

  const originalServiceUrl = process.env.LOCAL_EVIDENCE_SERVICE_URL;
  const originalFetch = globalThis.fetch;
  try {
    process.env.LOCAL_EVIDENCE_SERVICE_URL = "http://127.0.0.1:1";
    globalThis.fetch = async () => { throw new Error("Simulated local evidence runtime failure"); };
    const plan = planner.planEvaluation("Where should we increase paid search spend?", "marketing");
    const response = await POST(new Request("http://localhost/api/evaluation-plans/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "route-runtime-failure", plan }) }));
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.status, "failed");
    assert.equal(body.errorCode, "EVIDENCE_EXECUTION_RUNTIME_FAILED");
    assert.equal(body.requestId, "route-runtime-failure");
    assert.equal(body.planId, plan.planId);
    assert.deepEqual(body.rows, []);
    assert.deepEqual(body.evidenceBundle, []);
    assert.equal(JSON.stringify(body).includes("Simulated local evidence runtime failure"), false);
    assert.equal(contracts.evidenceExecutionResponseSchema.safeParse(body).success, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalServiceUrl === undefined) delete process.env.LOCAL_EVIDENCE_SERVICE_URL;
    else process.env.LOCAL_EVIDENCE_SERVICE_URL = originalServiceUrl;
  }
});
