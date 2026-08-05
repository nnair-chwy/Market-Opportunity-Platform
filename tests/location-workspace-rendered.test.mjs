import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("renders potential locations as the candidate brief starting point", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());

  const { CandidateBriefsWorkspace } = await vite.ssrLoadModule(
    "/components/location-workspace/CandidateBriefsWorkspace.tsx",
  );
  const html = renderToStaticMarkup(
    createElement(CandidateBriefsWorkspace, {
      onOpenMarket() {},
    }),
  );

  assert.match(html, /Potential locations/);
  assert.match(html, /Prepare candidate brief/);
  assert.match(html, /Open draft document/);
  assert.match(html, /bounded evidence workflow/);
  assert.match(html, /do not score, rank, recommend, or approve/);
  assert.doesNotMatch(html, /current clinics|Map and locations|Data readiness/i);
});

