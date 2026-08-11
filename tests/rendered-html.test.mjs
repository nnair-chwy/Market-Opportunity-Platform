import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

async function render() {
  const built = await worker();
  return built.fetch(new Request("http://localhost/", {headers:{accept:"text/html",host:"localhost"}}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
}

test("server-renders the adaptable Evaluation Workspace", async () => {
  const response=await render();assert.equal(response.status,200);assert.match(response.headers.get("content-type")??"",/^text\/html\b/i);const html=await response.text();
  assert.match(html,/<title>Evaluation Workspace<\/title>/i);
  assert.match(html,/What decision are you trying to make\?/);
  assert.match(html,/What are the best places for Chewy to open a new clinic\?/);
  assert.match(html,/Within Greater Seattle, how do submarkets compare for deeper clinic site diligence\?/);
  assert.match(html,/Which comparable clinics require performance review, and why\?/);
  assert.match(html,/What public market context is available for clinic screening\?/);assert.match(html,/Deeper blue = higher national percentile/);assert.match(html,/Highest total population/);assert.match(html,/Confirmed public context/);
  assert.match(html,/Verified library/);
  assert.doesNotMatch(html,/aria-label="Evaluator workspaces"|>Markets<|>Locations</);
  assert.doesNotMatch(html,/codex-preview|react-loading-skeleton|Starter Project/i);
});

test("mounts the address API and rejects incomplete input without a provider call", async () => {
  const built=await worker();const response=await built.fetch(new Request("http://localhost/api/geocode",{method:"POST",headers:{accept:"application/json","content-type":"application/json",host:"localhost"},body:JSON.stringify({address:"short"})}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
  assert.equal(response.status,400);assert.deepEqual(await response.json(),{status:"error",message:"Enter a complete U.S. street address between 8 and 240 characters."});
});

test("ships product-specific workspace and social assets", async () => {
  const [page,workspace,layout,packageJson]=await Promise.all([
    readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../components/evaluation-workspace/EvaluationWorkspace.tsx",import.meta.url),"utf8"),readFile(new URL("../app/layout.tsx",import.meta.url),"utf8"),readFile(new URL("../package.json",import.meta.url),"utf8"),access(new URL("../public/og.png",import.meta.url)),
  ]);
  assert.match(page,/EvaluationWorkspace/);assert.match(page,/buildEvaluationDemos/);assert.match(workspace,/Attractiveness by submarket/);assert.match(workspace,/Decide what moves forward/);assert.match(workspace,/Needs evidence/);assert.match(layout,/Evaluation Workspace/);assert.match(layout,/og\.png/);assert.doesNotMatch(packageJson,/react-loading-skeleton|drizzle/);await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx",import.meta.url)));await assert.rejects(access(new URL("db/index.ts",root)));
});

test("primary entry composes demos without use-case workflow branches", async()=>{
  const [page,engine,definitions]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../lib/evaluation/engine.ts",import.meta.url),"utf8"),readFile(new URL("../lib/evaluation/definitions.ts",import.meta.url),"utf8")]);
  assert.doesNotMatch(page,/SeattleMarketDeepDive|CandidateReviewAgent|PublicMarketContext|UnifiedEvaluatorMap/);
  assert.doesNotMatch(engine,/if\s*\([^)]*(site|clinic)|switch\s*\([^)]*(site|clinic)/i);
  assert.match(definitions,/SITE_DILIGENCE_DEFINITION/);assert.match(definitions,/CLINIC_PERFORMANCE_DEFINITION/);
});

test("legacy deterministic capabilities remain available during development",async()=>{
  const [map,market,askAi,sandbox]=await Promise.all([readFile(new URL("../components/UnifiedEvaluatorMap.tsx",import.meta.url),"utf8"),readFile(new URL("../components/PublicMarketContext.tsx",import.meta.url),"utf8"),readFile(new URL("../components/AskAiPanel.tsx",import.meta.url),"utf8"),readFile(new URL("../app/scoring-sandbox/page.tsx",import.meta.url),"utf8")]);
  assert.match(map,/CBSA_FILL_LAYER_ID/);assert.match(map,/LOCATION_SOURCE_IDS/);assert.match(market,/MarketComparisonWorkspace/);assert.match(askAi,/does not calculate\s+scores/);assert.match(sandbox,/redirect/);
});

test("public ACS context stays isolated from scoring",async()=>{
  const [scoring,presentation]=await Promise.all([readFile(new URL("../lib/scoring.ts",import.meta.url),"utf8"),readFile(new URL("../lib/data/public-market-ui.ts",import.meta.url),"utf8")]);assert.doesNotMatch(scoring,/cbsa-acs|SRC-016|census\.total_population/);assert.match(presentation,/Population density/);
});
