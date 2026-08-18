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
const mapPath = new URL("../components/UnifiedEvaluatorMap.tsx", import.meta.url);
const cssPath = new URL("../app/globals.css", import.meta.url);

test("View A Single, Compare, and Layer modes render with synchronized selection surfaces", async (t) => {
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

  const single = renderToStaticMarkup(
    createElement(AdaptiveMarketWorkspace, {
      opening: true,
      activeView,
      mapMode: "single",
    }),
  );
  assert.match(single, /data-map-mode="single"/);
  assert.match(single, /Click a market to see its value, percentile, rank, and evidence source/);
  assert.match(single, /Household percentile|Household count|Household/i);
  assert.doesNotMatch(single, /ACTIVE REGION|SOURCE/);
  assert.match(single, /Unified clinic and public market context map|data-unified-map/);
  assert.match(single, /market-score-legend|Household percentile/);

  const compare = renderToStaticMarkup(
    createElement(AdaptiveMarketWorkspace, {
      opening: true,
      activeView,
      mapMode: "compare",
    }),
  );
  assert.match(compare, /data-map-mode="compare"/);
  assert.match(compare, /data-view-a-mode="compare"/);
  assert.match(compare, /Up to five regions/);
  assert.match(compare, /Add selected region/);
  assert.match(compare, /Clear comparison/);
  assert.match(compare, /data-selected-market-detail/);
  assert.match(compare, /data-comparison-detail/);
  assert.match(compare, /Ranked market list|Find a market/);
  assert.match(compare, /onChooseMarket|data-unified-map/);

  const layer = renderToStaticMarkup(
    createElement(AdaptiveMarketWorkspace, {
      opening: true,
      activeView,
      mapMode: "layer",
    }),
  );
  assert.match(layer, /data-map-mode="layer"/);
  assert.match(layer, /data-view-a-mode="layer"/);
  assert.match(layer, /Active measure/);
  assert.match(layer, /Workflow or category/);
  assert.match(layer, /Current locations/);
  assert.match(layer, /Public context/);
  assert.match(layer, /Non-scored or unavailable/);
  assert.match(layer, /No hidden combined score/);
  assert.match(layer, /data-hidden-score="false"/);
  assert.doesNotMatch(layer, /universal[_ ]?score|hidden combined score value/i);

  const opening = renderToStaticMarkup(
    createElement(AdaptiveEvaluationWorkspace, {
      question: "Which markets look strongest under household demand context?",
      savedPackets: [],
      onQuestionChange() {},
      onSubmit() {},
      onOpenSaved() {},
      selectedGeographicContexts: [
        { cbsaCode: "19740", cbsaName: "Denver-Aurora-Centennial, CO" },
        { cbsaCode: "38060", cbsaName: "Phoenix-Mesa-Chandler, AZ" },
      ],
      onGeographicContextSelect() {},
      onGeographicContextRemove() {},
    }),
  );
  assert.match(opening, /data-view-a-control="true"/);
  assert.match(opening, /Map view mode/);
  assert.match(opening, />\s*Single\s*</);
  assert.match(opening, />\s*Compare\s*</);
  assert.match(opening, />\s*Layer\s*</);
  assert.match(opening, /adaptive-question-composer/);
  assert.match(opening, /Evaluation question/);
  assert.match(opening, /data-perspective="cvc"/);
  assert.match(opening, /data-active-view="household_demand"/);
  assert.match(opening, /data-map-mode="single"/);
  assert.match(opening, /Geographic context/);
  assert.match(opening, /Denver-Aurora-Centennial, CO/);
  assert.match(opening, /Phoenix-Mesa-Chandler, AZ/);
  assert.match(opening, /Remove Denver-Aurora-Centennial, CO/);
});

test("View A source wiring preserves mode switching, sync, and fail-safe unsupported layers", async () => {
  const [homepage, market, map, css] = await Promise.all([
    readFile(homepagePath, "utf8"),
    readFile(marketPath, "utf8"),
    readFile(mapPath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(homepage, /aria-pressed=\{activeMapMode === "single"\}/);
  assert.match(homepage, /aria-pressed=\{activeMapMode === "compare"\}/);
  assert.match(homepage, /aria-pressed=\{activeMapMode === "layer"\}/);
  assert.match(homepage, /mapMode=\{activeMapMode\}/);
  assert.match(homepage, /coerceSupportedMapMode/);
  assert.match(homepage, /adaptive-question-composer/);
  assert.match(homepage, /selectedGeographicContexts/);
  assert.match(homepage, /onGeographicContextRemove/);
  assert.match(homepage, /setPerspectiveId|choosePerspective/);
  assert.match(homepage, /setActiveViews|chooseView/);

  assert.match(market, /appendComparisonRegion/);
  assert.match(market, /removeComparisonRegion/);
  assert.match(market, /clearComparisonRegions/);
  assert.match(market, /canAddRegionToComparison/);
  assert.match(market, /compare_cohort/);
  assert.match(market, /preserveMissingNumeric/);
  assert.match(market, /MAX_COMPARISON_REGIONS/);
  assert.match(market, /selectMarket\(market\.code\)/);
  assert.match(market, /onChooseMarket=\{selectMarket\}/);
  assert.match(market, /onGeographicContextSelect/);
  assert.match(map, />\s*Reset\s*</);
  assert.match(map, /aria-label=\"Reset map to national view\"/);
  assert.match(map, /new NavigationControl\(\{ showCompass: false \}\),\s*\n\s*\"top-right\"/);
  assert.match(market, /resolveLayerForPresentation/);
  assert.match(market, /layerVisibilityChangesScoringInputs/);
  assert.match(market, /assertNoHiddenLayerScore/);
  assert.match(market, /Unsupported|unsupported/);
  assert.doesNotMatch(market, /from ["'][^"']*\/evaluation\/engine/);

  assert.match(css, /\.adaptive-opening \{[^}]*overflow-x: hidden/s);
  assert.match(css, /\.adaptive-view-controls/);
  assert.match(css, /@media \(max-width: 1050px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /\.adaptive-opening \.adaptive-view-controls \{ display: grid; \}/);
  assert.match(css, /\.adaptive-opening \.adaptive-mode-switch button \{ flex: 1 1 0; \}/);
  assert.match(css, /\.adaptive-view-a-panel/);
  assert.match(css, /\.adaptive-opening \.unified-maplibre \.maplibregl-ctrl-top-right \{ top: 14rem; right: 1rem;/);
  assert.match(css, /\.market-reset-map \{[\s\S]*width: max-content;[\s\S]*white-space: nowrap;/);
  assert.match(css, /\.adaptive-opening \.market-reset-map \{ top: 10\.5rem;[\s\S]*bottom: auto;/);
  assert.doesNotMatch(css, /\.adaptive-opening \.market-reset-map,\s*\n\.adaptive-opening \.map-note/);
  assert.doesNotMatch(
    css,
    /@media \(max-width: 1050px\)[\s\S]*\.adaptive-opening \.adaptive-view-controls \{ display: none; \}/,
  );
});
