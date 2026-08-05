import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("server-renders an accessible, print-safe, non-scored evidence brief", async (t) => {
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

  const { CandidateEvidenceWorkspace } = await vite.ssrLoadModule(
    "/components/esri-candidate-brief/CandidateEvidenceWorkspace.tsx",
  );
  const html = renderToStaticMarkup(
    createElement(CandidateEvidenceWorkspace, {
      onOpenReadiness() {},
      onOpenMarket() {},
    }),
  );

  for (const heading of [
    "Identity and workflow",
    "Market and trade-area context",
    "Clinic landscape",
    "Physical-site evidence",
    "Constraints and diligence",
    "Analyst follow-up questions",
  ]) {
    assert.match(html, new RegExp(heading));
  }
  assert.match(html, /Non-scored · human review required/);
  assert.match(html, /Print brief/);
  assert.match(html, /Source and quality details/);
  assert.match(html, /Scoring eligibility/);
  assert.match(html, /Restricted/);
  assert.match(html, /Rejected/);
  assert.match(html, /Stale/);
  assert.match(html, /Conflicting/);
  assert.match(html, /Synthetic/);
  assert.match(html, /This is not an approved investment, lease, or clinic-opening document/);
  assert.doesNotMatch(
    html,
    /phone|prescriptions_count|account_owner|rx_contact_preference|base_rent|security_deposit/i,
  );
  assert.doesNotMatch(html, /total score|candidate rank|recommended site|winner/i);

  const comparisonHtml = renderToStaticMarkup(
    createElement(CandidateEvidenceWorkspace, {
      initialMode: "compare",
      showModeTabs: false,
      showWorkspaceIntroduction: false,
      heading: "Compare locations",
      onOpenMarket() {},
    }),
  );
  assert.match(comparisonHtml, /aria-label="Compare locations"/);
  assert.doesNotMatch(comparisonHtml, /Internal analyst workspace/);
  assert.doesNotMatch(comparisonHtml, /Decision boundary/);
  assert.match(comparisonHtml, /Non-scored comparison for human review/);
});
