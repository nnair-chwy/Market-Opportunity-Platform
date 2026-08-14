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
  assert.match(html, /Perspective/);
  assert.match(html, /Pricing/);
  assert.match(html, /Marketing/);
  assert.match(html, /CVC/);
  assert.match(html, /CVC views/);
  assert.match(html, /Household demand/);
  assert.match(html, /Household demand context/);
  assert.match(html, /market context only/i);
  assert.match(html, /Measure/);
  assert.match(html, /Workflow/);
  assert.match(html, /Include micropolitan/);
  assert.match(html, /Evaluation question/);
  assert.match(html, /Run decision graph/);
  assert.match(html, /opportunity score/i);
  assert.match(html, /View A/);
  assert.match(html, /Single/);
  assert.match(html, /Compare/);
  assert.match(html, /Layer/);
  assert.match(html, /Map view mode/);
  assert.doesNotMatch(html, /smart_toy|space_dashboard|Synthetic prototype|Clinic evaluation|Evaluation workspace/);
  assert.doesNotMatch(html, /MarketAttractivenessRanking|CandidateBriefsWorkspace/);
  assert.doesNotMatch(html, /universal_score|cross_perspective_score/);
});

test("keeps the question workflow client-side and stores packet drafts in the browser", async () => {
  const [workflow, homepage, page, layout] = await Promise.all([
    readFile(new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/decision-workflow/AdaptiveEvaluationWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /DecisionWorkflowApp/);
  assert.match(workflow, /market-intelligence-action-packets/);
  assert.match(workflow, /setPhase\("running"\)/);
  assert.match(workflow, /setPhase\("packet"\)/);
  assert.match(workflow, /decision-review-primary/);
  assert.match(workflow, /resolveGeographicFocus/);
  assert.match(workflow, /GeographicFocusMap/);
  assert.match(workflow, /SisterGeographiesSection/);
  assert.match(workflow, /Save action packet/);
  assert.match(workflow, /Download action packet/);
  assert.match(workflow, /Findings and proposed action/);
  assert.match(workflow, /packet-action-details/);
  assert.match(workflow, /downloadReviewableActionPacket/);
  assert.doesNotMatch(workflow, /review-evidence-strip/);
  assert.doesNotMatch(workflow, /Compare possible actions/);
  assert.doesNotMatch(workflow, /AdaptiveMarketWorkspace/);
  assert.match(workflow, /SavedPacketsView/);
  assert.doesNotMatch(workflow, /AskAiPanel/);
  assert.match(workflow, /actionId/);
  assert.match(workflow, /workspace-decision-graph/);
  assert.match(workflow, /DecisionGraphAnimation/);
  assert.match(workflow, /isAnimationPage/);
  assert.match(workflow, /isResultPage/);
  assert.match(workflow, /data-page-phase/);
  assert.doesNotMatch(workflow, /graph-workspace-layout/);
  assert.match(workflow, /AdaptiveEvaluationWorkspace/);
  assert.match(homepage, /adaptive-question-composer/);
  assert.match(homepage, /AdaptiveMarketWorkspace/);
  assert.match(homepage, /mapMode=\{activeMapMode\}/);
  assert.match(homepage, /data-view-a-control="true"/);
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
