import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const workflow = fs.readFileSync(new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url), "utf8");

test("running UI is generic until verified lifecycle receipts return", () => {
  assert.doesNotMatch(workflow, /window\.setInterval/);
  assert.match(workflow, /Individual passes appear only after the service returns receipts/);
  assert.match(workflow, /Waiting for verified execution receipts/);
  assert.match(workflow, /evidenceExecution\?\.agenticLifecycle/);
  assert.match(workflow, /<AgenticRunSummary/);
});

test("completed lifecycle renders actual passes and stop reason", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());
  const [{ renderToStaticMarkup }, React, { AgenticRunSummary }] = await Promise.all([
    import("react-dom/server"),
    import("react"),
    vite.ssrLoadModule("/components/decision-workflow/AgenticRunSummary.tsx"),
  ]);
  const lifecycle = {
    version: "agentic-evidence-loop-v1",
    runId: "render-loop",
    planId: "render-plan",
    contractId: "render-contract",
    goal: "Where should we investigate paid search spend?",
    status: "best_available_answer",
    stopReason: "Every compatible registered source was investigated; unresolved criteria remain.",
    maxIterations: 3,
    candidateQueries: ["google_ads_context_by_cbsa", "regional_context_by_cbsa"],
    exhaustedQueries: ["google_ads_context_by_cbsa", "regional_context_by_cbsa"],
    finalAnswerStatus: "partial",
    passes: [{
      passId: "render-loop:pass-1",
      iteration: 1,
      selectedQueries: ["google_ads_context_by_cbsa"],
      executionStatus: "partial",
      answerStatus: "partial",
      composedAnswerStatus: "draft_for_review",
      addedEvidenceCount: 4,
      sourceIds: ["SRC-ADS"],
      evidenceIds: ["ads-1", "ads-2", "ads-3", "ads-4"],
      unmetCriterionIds: ["covers_domain_requirements"],
      startedAt: "2026-08-18T12:00:00.000Z",
      completedAt: "2026-08-18T12:00:01.000Z",
    }, {
      passId: "render-loop:pass-2",
      iteration: 2,
      selectedQueries: ["dynamic:regional_outcome_join"],
      executionStatus: "partial",
      answerStatus: "partial",
      composedAnswerStatus: "draft_for_review",
      addedEvidenceCount: 2,
      sourceIds: ["SRC-OUTCOME"],
      evidenceIds: ["outcome-1", "outcome-2"],
      unmetCriterionIds: ["covers_domain_requirements"],
      startedAt: "2026-08-18T12:00:01.000Z",
      completedAt: "2026-08-18T12:00:02.000Z",
    }],
  };
  const html = renderToStaticMarkup(React.createElement(AgenticRunSummary, {
    lifecycle,
    selectedActionId: "review-action",
    actions: [{ id: "review-action", title: "Review the finding" }],
  }));
  assert.match(html, /Best available answer produced/);
  assert.match(html, /Every compatible registered source was investigated/);
  assert.match(html, /Useful answer with validation remaining/);
  assert.match(html, /What to validate next/);
  assert.match(html, /Evidence and method details/);
  assert.match(html, /Google ads context by market/i);
  assert.match(html, /1 newly discovered source pass/);
  assert.match(html, /Newly discovered source investigation: Regional outcome join/);
  assert.doesNotMatch(html, /dynamic:regional_outcome_join/);
  assert.match(html, /4 new evidence items/);
  assert.match(html, /View the executed evidence graph/);
  assert.ok(html.indexOf("Google ads context by market") > html.indexOf("Evidence and method details"));
});
