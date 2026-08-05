import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("server-renders a transparent synthetic market ranking", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());

  const { MarketAttractivenessRanking } = await vite.ssrLoadModule(
    "/components/market-attractiveness/MarketAttractivenessRanking.tsx",
  );
  const html = renderToStaticMarkup(createElement(MarketAttractivenessRanking));

  assert.match(html, /Market attractiveness ranking/);
  assert.match(html, /<details[^>]*>/);
  assert.match(html, /<summary[^>]*>/);
  assert.match(html, /Open the ranked market list/);
  assert.match(html, /Synthetic only · Not a recommendation/);
  assert.match(html, /What goes into this score\?/);
  assert.match(html, /View the metrics, weights, and scoring direction/);
  assert.match(html, /Active customers per 1,000 households/);
  assert.match(html, /Clinics per 10,000 households/);
  assert.match(html, /Higher increases the score/);
  assert.match(html, /Lower increases the score/);
  assert.match(html, /Metropolitan and micropolitan markets[^<]*are normalized separately/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.doesNotMatch(html, /Compare synthetic market demand|Configuration|Fingerprint/);
  assert.doesNotMatch(html, /Synthetic prototype only/);
  assert.match(html, /Metropolitan/);
  assert.match(html, /Micropolitan/);
  assert.match(html, /Cohort rank/);
  assert.match(html, /Vet opportunity/);
  assert.match(html, /Sensitivity/);
  assert.match(html, /aria-selected="true"/);
  assert.doesNotMatch(html, /recommended market|approved score|investment decision/i);
});
