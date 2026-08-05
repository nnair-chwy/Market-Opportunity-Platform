import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the location evaluator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Clinic Location Evaluator<\/title>/i);
  assert.match(html, /Evaluate the market before the location/);
  assert.match(html, />Markets</);
  assert.match(html, />Locations</);
  assert.match(html, />All/);
  assert.match(html, />Current/);
  assert.match(html, />Potential/);
  assert.match(html, />Evaluated/);
  assert.match(html, /Synthetic prototype/);
  assert.doesNotMatch(html, /Unified geographic context/);
  assert.match(html, /MapTiler provides visual geographic context only/);
  assert.equal((html.match(/data-unified-map="true"/g) ?? []).length, 1);
  assert.ok(
    html.indexOf('aria-label="Evaluator workspaces"') <
      html.indexOf('data-unified-map="true"'),
  );
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/i);
});

test("mounts the address API and rejects incomplete input without a provider call", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/geocode", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        host: "localhost",
      },
      body: JSON.stringify({ address: "short" }),
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    status: "error",
    message:
      "Enter a complete U.S. street address between 8 and 240 characters.",
  });
});

test("ships product-specific map, AI, and social assets", async () => {
  const [page, askAi, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AskAiPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/us-map.svg", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(page, /Source data/);
  assert.match(page, /Ask AI/);
  assert.match(page, /mapAiContext/);
  assert.match(askAi, /does not calculate\s+scores/);
  assert.match(askAi, /does not.*make the final site\s+decision/s);
  assert.match(page, /PublicMarketContext/);
  assert.match(page, /UnifiedEvaluatorMap/);
  assert.match(layout, /Clinic Location Evaluator/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|drizzle/);
  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
  await assert.rejects(access(new URL("db/index.ts", root)));
});

test("public ACS context stays isolated from scoring and exposes required presentation", async () => {
  const [component, presentation, scoring] = await Promise.all([
    readFile(new URL("../components/PublicMarketContext.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/data/public-market-ui.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/scoring.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /MarketComparisonWorkspace/);
  assert.doesNotMatch(component, /View locations in this market/);
  assert.doesNotMatch(component, /Mark synthetic review complete/);
  assert.doesNotMatch(component, /Market review/);
  assert.match(component, /Search market, code, city, county, or state/);
  assert.doesNotMatch(component, /Context metric|Public context only/);
  assert.doesNotMatch(component, /market_context_only|no scoring weight/);
  assert.match(presentation, /Population density/);
  assert.match(component, /Missing/);
  assert.doesNotMatch(scoring, /cbsa-acs|SRC-016|census\.total_population/);
});

test("the unified map is persistent, MapTiler-configured, and retains an accessible fallback", async () => {
  const [map, page, environment, styles] = await Promise.all([
    readFile(
      new URL("../components/UnifiedEvaluatorMap.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(map, /fitBounds/);
  assert.match(map, /easeTo/);
  assert.match(map, /maxBounds:\s*MAINLAND_MARKET_BOUNDS/);
  assert.match(map, /renderWorldCopies:\s*false/);
  assert.match(map, /cameraForBounds/);
  assert.match(map, /setMinZoom/);
  assert.match(map, /PUBLIC_MARKET_MAX_FIT_ZOOM/);
  assert.match(map, /AttributionControl/);
  assert.match(map, /CBSA_FILL_LAYER_ID/);
  assert.match(map, /LOCATION_SOURCE_IDS/);
  assert.match(map, /isKeyboardSelectionKey/);
  assert.match(map, /Reset map/);
  assert.match(map, /market-reset-map.*with-navigation/);
  assert.match(styles, /\.market-reset-map\.with-navigation\s*\{[^}]*top:\s*82px/s);
  assert.doesNotMatch(page, /key=\{view\}/);
  assert.equal((page.match(/<UnifiedEvaluatorMap/g) ?? []).length, 1);
  assert.match(environment, /^NEXT_PUBLIC_MAPTILER_KEY=$/m);
  assert.match(environment, /^NEXT_PUBLIC_MAP_STYLE_URL=$/m);
  assert.doesNotMatch(environment, /https?:\/\/.+style/i);
});

test("market selection stays synchronized between map and browser", async () => {
  const [page, map, marketBrowser] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../components/UnifiedEvaluatorMap.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/PublicMarketContext.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /onChooseMarket=\{chooseMarket\}/);
  assert.match(map, /selectedMarketBounds\(collection, selectedMarketCode\)/);
  assert.match(map, /map\.fitBounds\(bounds/);
  assert.match(map, /fallbackViewBox\(collection, selectedMarketCode/);
  assert.match(marketBrowser, /scrollMarketRowIntoList/);
  assert.match(marketBrowser, /ref=\{listRef\}/);
  assert.match(marketBrowser, /Your search is preserved/);
  assert.doesNotMatch(marketBrowser, /row\?\.scrollIntoView/);
  assert.doesNotMatch(marketBrowser, /scrollIntoView/);
  assert.doesNotMatch(marketBrowser, /workspaceRef|selectionOrigin/);
  assert.match(marketBrowser, /comparisonCodes/);
  assert.match(marketBrowser, /onAddActiveMarket/);
  assert.match(marketBrowser, /aria-current/);
  assert.match(marketBrowser, /aria-live="polite"/);
});

test("map and comparison workspace share one lifted comparison selection", async () => {
  const [page, map, comparison] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/UnifiedEvaluatorMap.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../components/market-comparison/MarketComparisonWorkspace.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(page, /marketComparisonCodes/);
  assert.match(page, /onAddMarketToComparison=\{addActiveMarketToComparison\}/);
  assert.match(page, /comparisonCodes=\{marketComparisonCodes\}/);
  assert.match(map, /Market comparison tray/);
  assert.match(map, /Map exploration does not add markets automatically/);
  assert.match(map, /comparison-map-number/);
  assert.match(map, /geoCentroid/);
  assert.match(map, /fallback-comparison-numbers/);
  assert.match(comparison, /selectedCodes: readonly string\[\]/);
  assert.doesNotMatch(comparison, /setSelectedCodes/);
});

test("locations exposes candidate briefs, comparison, and scoring sandbox navigation", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const topbar = page.slice(
    page.indexOf('<div className="topbar-actions">'),
    page.indexOf('</header>'),
  );
  const locationNavigation = page.slice(
    page.indexOf('{workspaceMode === "locations" ? ('),
    page.indexOf('{workspaceMode === "markets" ? ('),
  );
  assert.match(page, /Candidate briefs/);
  assert.match(page, /Compare locations/);
  assert.match(locationNavigation, /Scoring sandbox/);
  assert.match(locationNavigation, /setLocationView\("sandbox"\)/);
  assert.doesNotMatch(locationNavigation, /href="\/scoring-sandbox"/);
  assert.doesNotMatch(topbar, /Scoring sandbox|\/scoring-sandbox/);
  assert.match(page, /locationView === "briefs"/);
  assert.match(page, /locationView === "compare"/);
  assert.match(page, /locationView === "sandbox"/);
  assert.match(page, /<ScoringSandbox showIntroduction=\{false\}/);
  assert.doesNotMatch(page, />\s*Map and locations\s*</);
  assert.doesNotMatch(page, />\s*Data readiness\s*</);
  assert.doesNotMatch(page, />\s*Evidence briefs\s*</);
  assert.doesNotMatch(page, />\s*Review agent\s*</);
});

test("scoring sandbox route redirects into the locations workspace", async () => {
  const [sandboxPage, evaluatorPage] = await Promise.all([
    readFile(new URL("../app/scoring-sandbox/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(sandboxPage, /redirect\("\/\?workspace=locations&view=sandbox"\)/);
  assert.doesNotMatch(sandboxPage, /aria-label="Evaluator workspaces"/);
  assert.doesNotMatch(sandboxPage, /<ScoringSandbox/);
  assert.match(evaluatorPage, /locationViewFromParam/);
  assert.match(evaluatorPage, /view === "sandbox"/);
  assert.match(evaluatorPage, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(evaluatorPage, /parameters\.get\("workspace"\) !== "locations"/);
});

test("market-first workspace state and location prerequisite are explicit", async () => {
  const [page, workflow, marketPanel] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/workflow/market-workflow.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/PublicMarketContext.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(page, /type WorkspaceMode = "markets" \| "locations"/);
  assert.match(page, /\["all", "current", "potential", "evaluated"\]/);
  assert.match(page, /canEvaluateLocation\(selectedParentCategory\)/);
  assert.match(page, /Review market first/);
  assert.match(marketPanel, /MarketComparisonWorkspace/);
  assert.match(workflow, /marketCategory === "evaluated"/);
  assert.match(workflow, /marketCategory === "current"/);
  assert.match(workflow, /A current location requires a current parent market/);
  assert.match(
    workflow,
    /An evaluated location requires an evaluated or current parent market/,
  );
  assert.doesNotMatch(marketPanel, /Context metric|Public context only/);
});
