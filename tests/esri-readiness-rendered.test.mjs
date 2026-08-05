import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("server-renders the analyst readiness summary and selected-site evidence", async (t) => {
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
  t.after(() => vite.close());

  const { PortfolioReadinessPanel } = await vite.ssrLoadModule(
    "/components/esri-readiness/PortfolioReadinessPanel.tsx",
  );
  const html = renderToStaticMarkup(
    createElement(PortfolioReadinessPanel, { onOpenMarket() {} }),
  );

  assert.match(html, /Portfolio data readiness/);
  assert.match(html, /not measure site or market attractiveness/);
  assert.match(html, /Non-scored evidence view/);
  assert.match(html, /Search portfolio/);
  assert.match(html, /All issue types/);
  assert.match(html, /Expected source or owner/);
  assert.match(html, /Scoring eligibility/);
  assert.match(html, /None/);
  assert.match(html, /role="status"|aria-label=/);
  assert.match(html, /<button/);
  assert.doesNotMatch(html, /Landlord|Base Rent|phone/i);
});
