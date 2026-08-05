import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("Seattle workspace renders approval and completed disclosure states", async (t) => {
  const vite = await createServer({ configFile: false, appType: "custom", logLevel: "silent", plugins: [react()], resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } }, server: { hmr: false, middlewareMode: true } });
  t.after(() => vite.close());
  const { SeattleMarketDeepDive } = await vite.ssrLoadModule("/components/market-deep-dive/SeattleMarketDeepDive.tsx");
  const { startSeattleAgentRun, continueSeattleAgentRun } = await vite.ssrLoadModule("/lib/seattle-market-deep-dive/agent-orchestrator.ts");
  const { clearSeattleAgentRunsForTests } = await vite.ssrLoadModule("/lib/seattle-market-deep-dive/agent-store.ts");
  const chooseFirst = async ({ permittedTools }) => ({ action: "call_tool", toolName: permittedTools[0], explanation: "Use the next permitted application tool." });
  clearSeattleAgentRunsForTests(); const waiting = await startSeattleAgentRun({ callModel: chooseFirst });
  const render = (run) => renderToStaticMarkup(createElement(SeattleMarketDeepDive, { initialRun: run, autoStart: false, onBack() {} }));
  const waitingHtml = render(waiting);
  assert.match(waitingHtml, /Confirm demo segmentation/); assert.match(waitingHtml, /Illustrative demo areas/); assert.match(waitingHtml, /not approved neighborhoods, trade areas, service areas, drive-time polygons, or scoring inputs/); assert.match(waitingHtml, /View illustrative areas on map/); assert.match(waitingHtml, /Geometry scoring: none/); assert.doesNotMatch(waitingHtml, /Priority under demo criteria/);
  const completed = await continueSeattleAgentRun(waiting.runId, { decisionId: waiting.requestedHumanDecisions[0].decisionId, decision: "confirm" }, { callModel: chooseFirst });
  const completedHtml = render(completed);
  assert.match(completedHtml, /Priority under demo criteria/); assert.match(completedHtml, /Broker research leads/); assert.match(completedHtml, /fictional profiles/i);
  assert.match(completedHtml, /No market-entry, property, or lease decision is produced/); assert.doesNotMatch(completedHtml, /chain-of-thought|hidden reasoning/i);
});
