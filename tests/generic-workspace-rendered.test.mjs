import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("root renders the new question-first workflow instead of the retired evaluator workspace", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("generic-workspace", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Evaluation question/);
  assert.match(html, /Evaluate/);
  assert.match(html, /Perspective/);
  assert.match(html, /Household demand/);
  assert.doesNotMatch(html, /Goal composer|Clinic evaluation|Synthetic fixture|smart_toy/);
});

test("generic workspace source validates AI interpretation and delegates calculations to deterministic operators", async () => {
  const [component, fixtures] = await Promise.all([
    readFile(new URL("../components/generic-workspace/GenericEvaluationWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/generic-workspace-fixtures.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /validateWorkspaceInterpretation/);
  assert.match(component, /calculateWorkspaceResults/);
  assert.match(fixtures, /questionSpecSchema\.parse/);
  assert.match(fixtures, /evaluationContractSchema\.parse/);
  assert.match(fixtures, /actionPacketSchema\.parse/);
  assert.match(fixtures, /normalize_metric/);
  assert.match(fixtures, /calculate_weighted_result/);
  assert.match(fixtures, /compare_cohort/);
  assert.doesNotMatch(component, /recommended|recommendation:\s*true/i);
});
