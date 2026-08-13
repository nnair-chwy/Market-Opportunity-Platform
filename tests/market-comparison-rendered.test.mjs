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

test("does not manufacture comparison selections after prototype scores are removed", async (t) => {
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
  const selectedCodes = [publicMarkets[1].cbsa_code, publicMarkets[0].cbsa_code];
  const activeMarket = publicMarkets[1];
  const html = renderToStaticMarkup(
    createElement(MarketComparisonWorkspace, {
      activeMarket,
      selectedCodes,
      onAddActiveMarket() {},
      onRemoveMarket() {},
    }),
  );

  assert.match(html, /0 of 5 selected/);
  assert.match(html, /No exact scored CBSA result/);
  assert.doesNotMatch(html, /Synthetic deterministic results in analyst selection order/);
});

test("withholds Ask AI comparison context when no scored result exists", async (t) => {
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
  const activeMarket = publicMarkets[0];
  const html = renderToStaticMarkup(
    createElement(MarketComparisonWorkspace, {
      activeMarket,
      selectedCodes: [activeMarket.cbsa_code],
      onAddActiveMarket() {},
      onRemoveMarket() {},
    }),
  );

  assert.match(html, /0 of 5 selected/);
  assert.match(html, /No exact scored CBSA result/);
  assert.doesNotMatch(html, /Ask AI about Review/);
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
