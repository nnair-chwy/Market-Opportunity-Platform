import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("server-renders accessible evidence views without restricted fields", async (t) => {
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

  const { EvidenceRenderHarness } = await vite.ssrLoadModule(
    "/tests/fixtures/evidence-render-harness.tsx",
  );
  const html = renderToStaticMarkup(createElement(EvidenceRenderHarness));

  assert.match(html, /Evidence summary/);
  assert.match(html, /Evidence status: Reported/);
  assert.match(html, /Quality status: warning/);
  assert.match(html, /<details/);
  assert.match(html, /Diligence checklist/);
  assert.match(html, /rejected/);
  assert.match(html, /Unavailable source metadata/);
  assert.match(html, /Qualitative evidence/);
  assert.match(html, /not converted into a score/);
  assert.match(html, /Restricted information/);
  assert.doesNotMatch(html, /This restricted label must not render/);
  assert.doesNotMatch(html, /Restricted geography|Restricted aggregation/);
  assert.doesNotMatch(
    html,
    /Restricted values are not displayed|Restricted input was not admitted/,
  );
  assert.doesNotMatch(html, /href=/);
});
