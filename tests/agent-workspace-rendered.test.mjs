import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("renders running, waiting, blocked, failed, and completed agent states", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());
  const { CandidateReviewAgent } = await vite.ssrLoadModule(
    "/components/agent-workspace/CandidateReviewAgent.tsx",
  );
  const { agentRunSchema, AGENT_RUN_SCHEMA_VERSION } = await vite.ssrLoadModule(
    "/lib/agent/contracts.ts",
  );
  const base = agentRunSchema.parse({
    schemaVersion: AGENT_RUN_SCHEMA_VERSION,
    runId: "rendered-agent-run",
    siteId: "esri-site-rendered",
    siteLabel: "Rendered candidate",
    status: "collecting",
    currentStep: "Load approved evidence",
    plannedSteps: [
      { stepId: "inspect", label: "Inspect candidate readiness", status: "completed" },
      { stepId: "collect", label: "Load approved evidence", status: "active" },
      { stepId: "review", label: "Request analyst confirmation", status: "pending" },
    ],
    completedSteps: ["inspect"],
    toolInvocations: [],
    evidenceReceipts: [],
    unresolvedBlockers: [],
    requestedHumanDecisions: [],
    reviewerResponses: [],
    sourceSnapshotVersions: [],
    modelVersion: "gpt-5.6-terra",
    promptVersion: "candidate-review-agent-v1",
    toolContractVersion: "candidate-review-tools-v1",
    generatedArtifactId: null,
    artifact: null,
    evaluationStatus: "not_checked",
    evaluationResultVersion: null,
    maxSteps: 8,
    stepCount: 1,
    createdAt: "2026-07-31T12:00:00.000Z",
    updatedAt: "2026-07-31T12:00:00.000Z",
    persistence: "process_local_prototype",
  });
  const waiting = structuredClone(base);
  waiting.status = "waiting_for_review";
  waiting.currentStep = "Waiting for analyst confirmation";
  waiting.plannedSteps[2].status = "waiting";
  waiting.requestedHumanDecisions = [{
    decisionId: "trade-review",
    kind: "trade_area_relationship",
    question: "Which supplied relationship should this packet use?",
    reason: "Two source relationships are possible.",
    evidence: [
      { label: "Variant A", value: "trade-a", sourceId: "SRC-017" },
      { label: "Variant B", value: "trade-b", sourceId: "SRC-017" },
    ],
    consequences: ["No source record or score is changed."],
    options: ["confirm", "reject", "leave_unresolved"],
    status: "pending",
  }];
  const blocked = structuredClone(base);
  blocked.status = "blocked";
  blocked.currentStep = "Draft packet prepared with unresolved blockers";
  blocked.evaluationStatus = "blocked";
  blocked.unresolvedBlockers = [{ blockerId: "blocker", label: "Approved scoring input unavailable", detail: "Evidence is non-scored.", sourceIds: ["SRC-017"], resolution: "Provide an approved scoring input." }];
  blocked.artifact = { artifactId: "artifact", briefId: "brief", status: "draft_blocked", title: "Rendered candidate review packet", summary: "Draft source-linked packet.", sourceIds: ["SRC-017"], remainingItems: ["Approved scoring input unavailable"], generatedAt: "2026-07-31T12:00:00.000Z" };
  blocked.generatedArtifactId = "artifact";
  const failed = structuredClone(base);
  failed.status = "failed";
  failed.currentStep = "The review run stopped safely";
  const completed = structuredClone(blocked);
  completed.status = "completed";
  completed.currentStep = "Draft packet prepared for human review";
  completed.evaluationStatus = "completed";
  completed.unresolvedBlockers = [];
  completed.artifact.status = "draft_for_review";
  completed.artifact.remainingItems = [];

  const render = (run) => renderToStaticMarkup(createElement(CandidateReviewAgent, {
    siteId: run.siteId,
    initialRun: run,
    autoStart: false,
    onOpenReadiness() {},
    onOpenBrief() {},
    onOpenMarket() {},
  }));
  const runningHtml = render(base);
  assert.match(runningHtml, /Collecting evidence/);
  assert.match(runningHtml, /Visible plan/);
  assert.match(runningHtml, /Data readiness is not site quality/);
  const waitingHtml = render(waiting);
  assert.match(waitingHtml, /Waiting for analyst review/);
  assert.match(waitingHtml, /Confirm selected/);
  assert.match(waitingHtml, /Leave unresolved/);
  assert.match(render(blocked), /Draft packet prepared with unresolved blockers/);
  assert.match(render(failed), /Failed safely/);
  assert.match(render(completed), /Completed/);
  assert.doesNotMatch(`${runningHtml}${waitingHtml}`, /chain-of-thought|hidden reasoning/i);
});
