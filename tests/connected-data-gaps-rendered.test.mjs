import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

async function component(t) {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());
  return (await vite.ssrLoadModule("/components/decision-workflow/ConnectedDataGapsPanel.tsx")).ConnectedDataGapsPanel;
}

const readiness = {
  version: "first-party-outcome-readiness-v1",
  contractVersion: "first-party-regional-outcome-v1",
  generatedAt: "2026-08-18T00:00:00.000Z",
  outcomes: [
    { outcomeId: "regional_orders", label: "Regional orders", status: "gap", readySourceIds: [], missingEvidence: ["No approved aggregate regional order source is connected."] },
    { outcomeId: "new_customers", label: "New customers", status: "gap", readySourceIds: [], missingEvidence: ["No approved aggregate new-customer source is connected."] },
    { outcomeId: "contribution_profit", label: "Contribution or profit", status: "gap", readySourceIds: [], missingEvidence: ["No approved regional contribution source is connected."] },
    { outcomeId: "clinic_capacity", label: "Clinic capacity", status: "gap", readySourceIds: [], missingEvidence: ["No staffed-capacity source is connected."] },
    { outcomeId: "appointments", label: "Appointments", status: "gap", readySourceIds: [], missingEvidence: ["No compatible appointment aggregate is connected."] },
    { outcomeId: "mature_clinic_performance", label: "Mature-clinic performance", status: "gap", readySourceIds: [], missingEvidence: ["No mature-clinic outcome is connected."] },
  ],
  adapterCandidates: [],
  summary: { readyOutcomeCount: 0, gapOutcomeCount: 6, adapterCandidateCount: 0, executableQueryCount: 0 },
  conclusionBoundary: "Candidates require review.",
};

test("renders a collapsed result-section with plain-language connected-data gaps", async (t) => {
  const ConnectedDataGapsPanel = await component(t);
  const html = renderToStaticMarkup(createElement(ConnectedDataGapsPanel, { readiness }));
  assert.match(html, /<details/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /Connected data and remaining gaps/);
  assert.match(html, /0\/6 first-party outcome families ready/);
  assert.match(html, /Regional orders/);
  assert.match(html, /Mature-clinic performance/);
  assert.match(html, /bounded discovery refresh/);
  assert.doesNotMatch(html, /relativePath|sha256|CUSTOMER_ID/);
});
