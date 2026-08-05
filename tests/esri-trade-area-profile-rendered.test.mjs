import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

async function renderProfile(marketCode) {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("../", import.meta.url)),
      },
    },
    server: { hmr: false, middlewareMode: true },
  });

  const { MarketTradeAreaProfile } = await vite.ssrLoadModule(
    "/components/esri-trade-area/MarketTradeAreaProfile.tsx",
  );
  const html = renderToStaticMarkup(
    createElement(MarketTradeAreaProfile, {
      marketCode,
      onOpenReadiness() {},
      onOpenLocations() {},
    }),
  );
  await vite.close();
  return html;
}

test("server-renders separate accessible public-market and local-evidence language", async () => {
  const html = await renderProfile("19100");

  assert.match(html, /Optional site diligence/);
  assert.match(html, /Linked site evidence/);
  assert.match(html, /<details[^>]*><summary/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /separate from Public CBSA context/);
  assert.match(html, /not part of the market score/);
  assert.match(html, /Trade-area method unknown/);
  assert.match(html, /Observation date unknown/);
  assert.match(html, /Not used for scoring/);
  assert.match(html, /Esri-reported local trade-area evidence/);
  assert.match(html, /Provenance and quality/);
  assert.match(html, /Scoring eligibility/);
  assert.match(html, /Descriptive trade-area comparison/);
  assert.match(html, /Open readiness record/);
  assert.match(html, /Open Locations for market/);
  assert.match(html, /<select/);
  assert.match(html, /<details/);
  assert.doesNotMatch(html, /Landlord|Base Rent|Lease Term/i);
});

test("renders a compact non-error state when a market has no linked records", async () => {
  const html = await renderProfile("10100");

  assert.match(html, /Linked site evidence unavailable for this market/);
  assert.match(html, /<details[^>]*><summary/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /coverage gap in the prototype, not an application error/);
  assert.match(html, /Continue using the public market comparison above/);
  assert.doesNotMatch(html, /Internal local evidence/);
  assert.doesNotMatch(html, /Descriptive trade-area comparison/);
});
