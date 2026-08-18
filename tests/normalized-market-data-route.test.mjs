import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

test("normalized market API accepts only registered queries and reports snapshot availability", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());
  const [{ POST }, contracts] = await Promise.all([
    vite.ssrLoadModule("/app/api/normalized-market-data/route.ts"),
    vite.ssrLoadModule("/lib/data-normalization/contracts.ts"),
  ]);

  const malformedJson = await POST(new Request("http://localhost/api/normalized-market-data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }));
  assert.equal(malformedJson.status, 400);

  const arbitrary = await POST(new Request("http://localhost/api/normalized-market-data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: "bad-query", snapshotVersion: contracts.DEFAULT_NORMALIZED_SNAPSHOT_VERSION, query: "select_everything" }),
  }));
  assert.equal(arbitrary.status, 400);

  const missingCbsa = await POST(new Request("http://localhost/api/normalized-market-data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: "missing-cbsa", snapshotVersion: contracts.DEFAULT_NORMALIZED_SNAPSHOT_VERSION, query: "clinic_context_by_cbsa" }),
  }));
  assert.equal(missingCbsa.status, 400);

  const snapshotDir = resolve(process.env.NORMALIZED_MARKET_DATA_DIR?.trim() || ".local-data/normalized-market-data");
  const snapshotAvailable = existsSync(join(snapshotDir, "manifest.json"));
  const supported = await POST(new Request("http://localhost/api/normalized-market-data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: "supported", snapshotVersion: contracts.DEFAULT_NORMALIZED_SNAPSHOT_VERSION, query: "supported_regions" }),
  }));
  assert.equal(supported.status, snapshotAvailable ? 200 : 422);
  assert.equal(supported.headers.get("cache-control"), "no-store");
  const body = await supported.json();
  if (snapshotAvailable) {
    assert.equal(body.allowedUse, "local_demo_aggregate_decision_support");
    assert.equal(body.scoringEligibility, "none");
    assert.ok(body.rows.length > 0);
    const screening = await POST(new Request("http://localhost/api/normalized-market-data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: "screening", snapshotVersion: contracts.DEFAULT_NORMALIZED_SNAPSHOT_VERSION, query: "growth_test_screening" }),
    }));
    const screeningBody = await screening.json();
    assert.equal(screening.status, 200);
    assert.equal(screeningBody.metadata.screeningVersion, "growth-test-screening-v1");
    assert.ok(screeningBody.metadata.excludedMarketCount > 0);
    assert.ok(screeningBody.rows.length > 0);
    assert.equal(screeningBody.rows[0].evidenceStatus, "Hypothesis");
  } else {
    assert.equal(body.status, "error");
    assert.equal(body.message.includes(process.cwd()), false);
  }
});
