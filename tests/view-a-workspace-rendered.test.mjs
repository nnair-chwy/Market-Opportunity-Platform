import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const homepagePath = new URL(
  "../components/decision-workflow/AdaptiveEvaluationWorkspace.tsx",
  import.meta.url,
);
const marketPath = new URL(
  "../components/decision-workflow/AdaptiveMarketWorkspace.tsx",
  import.meta.url,
);
const cssPath = new URL("../app/globals.css", import.meta.url);

test("Explore, regional comparison, and map-layer manager render with synchronized selection surfaces", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());

  const { AdaptiveMarketWorkspace } = await vite.ssrLoadModule(
    "/components/decision-workflow/AdaptiveMarketWorkspace.tsx",
  );
  const { AdaptiveEvaluationWorkspace } = await vite.ssrLoadModule(
    "/components/decision-workflow/AdaptiveEvaluationWorkspace.tsx",
  );
  const { getPerspectiveView } = await vite.ssrLoadModule("/lib/perspectives/index.ts");
  const activeView = getPerspectiveView("cvc", "household_demand");
  const comparisonView = getPerspectiveView("cvc", "market_expansion_context");

  const single = renderToStaticMarkup(
    createElement(AdaptiveMarketWorkspace, {
      opening: true,
      activeView,
      mapMode: "single",
    }),
  );
  assert.match(single, /data-map-mode="single"/);
  assert.match(single, /Show map context and legend/);
  assert.equal((single.match(/adaptive-map-help-trigger/g) ?? []).length, 1);
  assert.doesNotMatch(single, /ACTIVE REGION|SOURCE/);
  assert.match(single, /Unified clinic and public market context map|data-unified-map/);
  assert.doesNotMatch(single, /market-score-legend|Household percentile/);

  const swipe = renderToStaticMarkup(
    createElement(AdaptiveMarketWorkspace, {
      opening: true,
      activeView,
      comparisonView,
      mapMode: "single",
      initialSelectedCode: "12060",
    }),
  );
  assert.match(swipe, /role="slider"/);
  assert.match(swipe, /Compare Population-density percentile with Household percentile/);
  assert.match(swipe, /View B · Population/);
  assert.match(swipe, /View A · Household percentile/);
  assert.match(swipe, /Same region · two approved measures · no combined score/);
  assert.match(swipe, /Compare views for Atlanta-Sandy Springs-Roswell, GA/);
  assert.match(swipe, /Show map context/);
  const unifiedMapSource = await readFile(new URL("../components/UnifiedEvaluatorMap.tsx", import.meta.url), "utf8");
  assert.match(unifiedMapSource, /#efc94c/);
  assert.match(unifiedMapSource, /#7f5d00/);
  assert.doesNotMatch(unifiedMapSource, /#dd6f68|#681d2b/);

  const compare = renderToStaticMarkup(
    createElement(AdaptiveMarketWorkspace, {
      opening: true,
      activeView,
      mapMode: "compare",
      initialComparisonCodes: ["12060", "14460"],
    }),
  );
  assert.match(compare, /data-map-mode="compare"/);
  assert.match(compare, /data-view-a-mode="compare"/);
  assert.match(compare, /See how selected regions differ/);
  assert.match(compare, /Comparison ready · 2 of 5/);
  assert.match(compare, /Add at least two regions to see differences/);
  assert.match(compare, /Regional comparison result/);
  assert.match(compare, /vs\. first/);
  assert.match(compare, /not an opportunity score or recommendation/i);
  assert.match(compare, /Select a region on the map/);
  assert.match(compare, /Clear comparison/);
  assert.match(compare, /data-selected-market-detail/);
  assert.match(compare, /data-comparison-detail/);
  assert.match(compare, /Ranked market list|Find a market/);
  assert.match(compare, /onChooseMarket|data-unified-map/);

  const layer = renderToStaticMarkup(
    createElement(AdaptiveMarketWorkspace, {
      opening: true,
      activeView,
      mapMode: "single",
      showLayerManager: true,
    }),
  );
  assert.match(layer, /data-map-mode="single"/);
  assert.match(layer, /data-layer-manager="true"/);
  assert.match(layer, /Primary measure · always on/);
  assert.match(layer, /Workflow status/);
  assert.match(layer, /Current clinic locations/);
  assert.match(layer, /Regions with missing data/);
  assert.match(layer, /Source details/);
  assert.match(layer, /Layers never blend into a score/);
  assert.match(layer, /data-hidden-score="false"/);
  assert.doesNotMatch(layer, /universal[_ ]?score|hidden combined score value/i);

  const opening = renderToStaticMarkup(
    createElement(AdaptiveEvaluationWorkspace, {
      question: "Which markets look strongest under household demand context?",
      savedPackets: [],
      onQuestionChange() {},
      onSubmit() {},
      onOpenSaved() {},
    }),
  );
  assert.match(opening, /data-view-a-control="true"/);
  assert.match(opening, /Analysis view/);
  assert.match(opening, />\s*Explore\s*</);
  assert.match(opening, />\s*Compare regions\s*</);
  assert.match(opening, /Map layers/);
  assert.match(opening, /Add view/);
  assert.match(opening, /aria-controls="adaptive-view-b-control"/);
  assert.match(opening, /adaptive-question-composer/);
  assert.match(opening, /Evaluation question/);
  assert.match(opening, /data-perspective="cvc"/);
  assert.match(opening, /data-active-view="household_demand"/);
  assert.match(opening, /data-map-mode="single"/);
});

test("View A source wiring preserves mode switching, sync, and fail-safe unsupported layers", async () => {
  const [homepage, market, css] = await Promise.all([
    readFile(homepagePath, "utf8"),
    readFile(marketPath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(homepage, /aria-pressed=\{activeMapMode === "single"\}/);
  assert.match(homepage, /aria-pressed=\{activeMapMode === "compare"\}/);
  assert.match(homepage, /mapMode=\{activeMapMode\}/);
  assert.match(homepage, /showLayerManager=\{layerManagerOpen\}/);
  assert.match(homepage, /aria-controls="adaptive-map-layer-manager"/);
  assert.match(homepage, /compatibleComparisonViews/);
  assert.match(homepage, /comparisonView=\{comparisonView\}/);
  assert.match(homepage, /Compare views/);
  assert.match(homepage, /adaptive-view-primary-row/);
  assert.match(homepage, /data-view-row="a"/);
  assert.match(homepage, /adaptive-view-secondary-actions/);
  assert.match(homepage, /data-controls-owner=\{comparisonView \? "view-b" : "view-a"\}/);
  assert.match(homepage, /coerceSupportedMapMode/);
  assert.match(homepage, /adaptive-question-composer/);
  assert.match(homepage, /setPerspectiveId|choosePerspective/);
  assert.match(homepage, /setActiveViews|chooseView/);

  assert.match(market, /appendComparisonRegion/);
  assert.match(market, /removeComparisonRegion/);
  assert.match(market, /clearComparisonRegions/);
  assert.match(market, /canAddRegionToComparison/);
  assert.match(market, /compare_cohort/);
  assert.match(market, /preserveMissingNumeric/);
  assert.match(market, /MAX_COMPARISON_REGIONS/);
  assert.match(market, /setSelectedCode\(market\.code\)/);
  assert.match(market, /onChooseMarket=\{setSelectedCode\}/);
  assert.match(market, /resolveLayerForPresentation/);
  assert.match(market, /layerVisibilityChangesScoringInputs/);
  assert.match(market, /assertNoHiddenLayerScore/);
  assert.match(market, /secondaryMarketScores=\{viewComparisonScores\}/);
  assert.match(market, /onSwipePercentChange=\{setSwipePercent\}/);
  assert.match(market, /Unsupported|unsupported/);
  assert.doesNotMatch(market, /from ["'][^"']*\/evaluation\/engine/);

  assert.match(css, /\.adaptive-opening \{[^}]*overflow-x: hidden/s);
  assert.match(css, /\.adaptive-view-controls/);
  assert.match(css, /\.adaptive-view-primary-row/);
  assert.match(css, /\.adaptive-view-secondary-actions/);
  assert.match(css, /@media \(max-width: 1050px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /\.adaptive-opening \.adaptive-view-controls \{ display: grid; \}/);
  assert.match(css, /\.adaptive-opening \.adaptive-mode-switch button \{ flex: 1 1 0; \}/);
  assert.match(css, /\.adaptive-view-a-panel/);
  assert.match(css, /\.unified-swipe-divider/);
  assert.match(css, /\.unified-map-region-comparison-grid/);
  assert.doesNotMatch(css, /\.unified-swipe-range/);
  assert.doesNotMatch(
    css,
    /@media \(max-width: 1050px\)[\s\S]*\.adaptive-opening \.adaptive-view-controls \{ display: none; \}/,
  );
});
