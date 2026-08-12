import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the question-to-action-packet workflow", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Market Intelligence<\/title>/i);
  assert.match(html, /What do you need to decide\?/);
  assert.match(html, /Run decision graph/);
  assert.match(html, /Follow the decision graph/);
  assert.match(html, /Saved packets/);
  assert.match(html, /use the map for geographic context/i);
  assert.match(html, /question-map-section/);
  assert.match(html, /Review.*Read the action packet/s);
  assert.match(html, /accountable owner makes the business decision/);
  assert.doesNotMatch(html, /smart_toy|space_dashboard|Synthetic prototype|Clinic evaluation|Evaluation workspace/);
  assert.doesNotMatch(html, /MarketAttractivenessRanking|CandidateBriefsWorkspace/);
});

test("keeps the question workflow client-side and stores packet drafts in the browser", async () => {
  const [workflow, questionMap, page, layout] = await Promise.all([
    readFile(new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/decision-workflow/QuestionMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /DecisionWorkflowApp/);
  assert.match(workflow, /market-intelligence-action-packets/);
  assert.match(workflow, /setPhase\("running"\)/);
  assert.match(workflow, /setPhase\("packet"\)/);
  assert.match(workflow, /Compare possible actions/);
  assert.match(workflow, /Save action packet/);
  assert.match(workflow, /SavedPacketsView/);
  assert.match(workflow, /AskAiPanel/);
  assert.match(workflow, /actionId/);
  assert.match(workflow, /workspace-map/);
  assert.match(workflow, /Geographic context map/);
  assert.match(workflow, /QuestionMap/);
  assert.match(questionMap, /NEXT_PUBLIC_MAPTILER_KEY/);
  assert.match(questionMap, /api\.maptiler\.com/);
  assert.match(questionMap, /question-maplibre/);
  assert.match(layout, /Market Intelligence/);
});

test("mounts the address API and rejects incomplete input without a provider call", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/geocode", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", host: "localhost" },
      body: JSON.stringify({ address: "short" }),
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    status: "error",
    message: "Enter a complete U.S. street address between 8 and 240 characters.",
  });
});

test("keeps product assets available without rendering the legacy evaluator", async () => {
  await Promise.all([
    access(new URL("../public/us-map.svg", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
  ]);
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.doesNotMatch(packageJson, /react-loading-skeleton|drizzle/);
});
