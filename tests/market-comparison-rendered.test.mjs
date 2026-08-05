import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("renders a governed market comparison starting state", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());

  const [{ MarketComparisonWorkspace }, { publicMarkets }] = await Promise.all([
    vite.ssrLoadModule(
      "/components/market-comparison/MarketComparisonWorkspace.tsx",
    ),
    vite.ssrLoadModule("/lib/data/public-market-ui.ts"),
  ]);
  const activeMarket = publicMarkets.find(
    (market) => market.cbsa_code === "10100",
  );
  const html = renderToStaticMarkup(
    createElement(MarketComparisonWorkspace, {
      activeMarket,
      selectedCodes: [],
      onAddActiveMarket() {},
      onRemoveMarket() {},
    }),
  );

  assert.match(html, /Compare markets/);
  assert.match(html, /two to five markets from one scoring cohort/i);
  assert.match(html, /Save comparison/);
  assert.match(html, /Add to comparison/);
  assert.match(html, /Synthetic screening only/);
  assert.match(html, /Not scored|Synthetic score/);
  assert.match(html, /no winner is produced/i);
  assert.doesNotMatch(html, /best market|recommended market/i);
});

test("renders controlled comparison selections in analyst order", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());

  const [
    { MarketComparisonWorkspace },
    { publicMarkets },
    { syntheticMarketAttractivenessResults },
  ] = await Promise.all([
    vite.ssrLoadModule(
      "/components/market-comparison/MarketComparisonWorkspace.tsx",
    ),
    vite.ssrLoadModule("/lib/data/public-market-ui.ts"),
    vite.ssrLoadModule("/lib/market-attractiveness/index.ts"),
  ]);
  const scored = syntheticMarketAttractivenessResults.filter(
    (result) => result.cbsaCode && result.cohort === "metropolitan",
  );
  const selectedCodes = [scored[1].cbsaCode, scored[0].cbsaCode];
  const activeMarket = publicMarkets.find(
    (market) => market.cbsa_code === selectedCodes[0],
  );
  const html = renderToStaticMarkup(
    createElement(MarketComparisonWorkspace, {
      activeMarket,
      selectedCodes,
      onAddActiveMarket() {},
      onRemoveMarket() {},
    }),
  );

  assert.match(html, /2 of 5 selected/);
  assert.ok(html.indexOf(scored[1].marketName) < html.indexOf(scored[0].marketName));
  assert.match(html, new RegExp(`Remove ${scored[1].marketName} from comparison`));
  assert.match(html, /Synthetic deterministic results in analyst selection order/);
});

test("renders usable Ask AI context with one selected market", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());

  const [
    { MarketComparisonWorkspace },
    { publicMarkets },
    { syntheticMarketAttractivenessResults },
  ] = await Promise.all([
    vite.ssrLoadModule(
      "/components/market-comparison/MarketComparisonWorkspace.tsx",
    ),
    vite.ssrLoadModule("/lib/data/public-market-ui.ts"),
    vite.ssrLoadModule("/lib/market-attractiveness/index.ts"),
  ]);
  const scored = syntheticMarketAttractivenessResults.find(
    (result) => result.cbsaCode && result.cohort === "metropolitan",
  );
  const activeMarket = publicMarkets.find(
    (market) => market.cbsa_code === scored.cbsaCode,
  );
  const html = renderToStaticMarkup(
    createElement(MarketComparisonWorkspace, {
      activeMarket,
      selectedCodes: [scored.cbsaCode],
      onAddActiveMarket() {},
      onRemoveMarket() {},
    }),
  );

  assert.match(html, /1 of 5 selected/);
  assert.match(html, new RegExp(`Review ${scored.marketName}`));
  assert.match(html, /Ask AI/);
  assert.match(html, /Ask AI about Review/);
  assert.match(html, /Add another scored market/);
});

test("save comparison is explicitly non-persistent", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(
      new URL(
        "../components/market-comparison/MarketComparisonWorkspace.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.match(source, /Nothing was stored/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|\/api\/comparisons/);
});
