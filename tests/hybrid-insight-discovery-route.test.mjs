import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

test("hybrid discovery API validates its bounded contract and supports deterministic fallback", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());
  const { POST } = await vite.ssrLoadModule("/app/api/insight-discovery/hybrid/route.ts");

  const malformed = await POST(new Request("http://localhost/api/insight-discovery/hybrid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }));
  assert.equal(malformed.status, 400);

  const unbounded = await POST(new Request("http://localhost/api/insight-discovery/hybrid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "hybrid", maxSteps: 100, maxResultRows: 10000 }),
  }));
  assert.equal(unbounded.status, 400);

  const deterministic = await POST(new Request("http://localhost/api/insight-discovery/hybrid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "deterministic", maxSteps: 2 }),
  }));
  assert.equal(deterministic.status, 201);
  assert.equal(deterministic.headers.get("cache-control"), "no-store");
  const body = await deterministic.json();
  assert.equal(body.hybridAudit.mode, "deterministic_only");
  assert.ok(body.primaryFindings.length > 0);
});

