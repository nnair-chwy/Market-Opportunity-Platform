import assert from "node:assert/strict";
import fs from "node:fs";
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
  return (await vite.ssrLoadModule("/components/decision-workflow/AnswerEvidenceTrail.tsx")).AnswerEvidenceTrail;
}

const plan = {
  originalQuestion: "Where should we investigate paid-search spend?",
  perspectiveId: "marketing",
};

const result = {
  status: "partial",
  rows: [{ CUSTOMER_ID: "must-not-render", raw_campaign_row: "must-not-render" }],
  evidenceBundle: [{
    evidenceId: "ads-1",
    metricId: "normalized.google_ads_clicks",
    geographyLabel: "Atlanta-Sandy Springs-Roswell, GA",
    sourceId: "SRC-018",
    qualityStatus: "warning",
    warning: "Matched-location geography requires review.",
    period: { label: "2026-07-14 to 2026-08-12" },
  }, {
    evidenceId: "orders-1",
    metricId: "normalized.regional_orders",
    geographyLabel: "Atlanta-Sandy Springs-Roswell, GA",
    sourceId: "NEW-REGIONAL-ORDERS",
    qualityStatus: "accepted",
    warning: null,
    period: { label: "Week of 2026-08-03" },
  }],
  missingEvidence: ["Incremental customer outcomes are unavailable for the campaign cohort."],
  unknowns: ["DMA-to-CBSA compatibility is not approved."],
  agenticLifecycle: {
    passes: [{
      selectedQueries: ["clinic_context_by_cbsa"],
      addedEvidenceCount: 0,
    }],
  },
  sourceAdaptation: {
    sources: [{ candidateId: "orders", label: "Reviewed regional order outcomes", sourceIds: ["NEW-REGIONAL-ORDERS"], decision: "used", reason: "Added compatible order evidence.", addressesRequirementIds: ["marketing_business_outcome"], evidenceIds: ["orders-1"] },
      { candidateId: "pricing", label: "Reviewed pricing-only source", sourceIds: ["PRICING-ONLY"], decision: "incompatible", reason: "Registered for pricing rather than marketing.", addressesRequirementIds: [], evidenceIds: [] }],
    goalCheck: { status: "partial", explanation: "The original question was re-checked; two completion checks remain unmet.", unmetCriterionIds: ["marketing_geography", "marketing_incrementality"] },
    nextRequiredDataset: { reason: "These exact fields are still required to satisfy the original answer contract.", fields: [
      { field: "geography_id", label: "Governed geography ID", requirementId: "marketing_geography", description: "Approved DMA or postal identifier with coverage." },
      { field: "experiment_cohort", label: "Test/control cohort", requirementId: "marketing_incrementality", description: "Pre-period, treatment/control, success, stop, and rollback fields." },
    ] },
  },
};

const readiness = {
  outcomes: [{ outcomeId: "regional_orders", label: "Regional orders", status: "ready", readySourceIds: ["NEW-REGIONAL-ORDERS"], missingEvidence: [] },
    { outcomeId: "new_customers", label: "New customers", status: "gap", readySourceIds: [], missingEvidence: ["No approved new-customer aggregate is connected."] },
    { outcomeId: "contribution_profit", label: "Contribution or profit", status: "gap", readySourceIds: [], missingEvidence: ["Contribution has no approved geography key."] }],
  adapterCandidates: [{ sourceId: "DISCOVERED-CONTRIBUTION", outcomeIds: ["contribution_profit"] }],
};

test("renders a compact question-to-sources-to-answer trail with plain source contributions", async (t) => {
  const AnswerEvidenceTrail = await component(t);
  const html = renderToStaticMarkup(createElement(AnswerEvidenceTrail, { plan, result, readiness }));
  const sequence = ["Question", "Sources used", "Answer"];
  let prior = -1;
  for (const label of sequence) {
    const index = html.indexOf(label);
    assert.ok(index > prior, `${label} should follow the prior trail step`);
    prior = index;
  }
  assert.match(html, /Paid-search matched-location export/);
  assert.match(html, /Google ads clicks/);
  assert.match(html, /Reviewed regional order outcomes/);
  assert.match(html, /Regional orders/);
  assert.match(html, /Atlanta-Sandy Springs-Roswell/);
  assert.match(html, /Used with limits/);
  assert.match(html, /aggregate evidence only/i);
  assert.doesNotMatch(html, /must-not-render|CUSTOMER_ID|raw_campaign_row/);
});

test("shows unavailable evidence and an honest next-data contract without fake upload success", async (t) => {
  const AnswerEvidenceTrail = await component(t);
  const html = renderToStaticMarkup(createElement(AnswerEvidenceTrail, { plan, result, readiness }));
  assert.match(html, /Considered but unavailable or incompatible/);
  assert.match(html, /Reviewed pricing-only source/);
  assert.match(html, /Registered for pricing rather than marketing/);
  assert.match(html, /Clinic context by market was checked but added no compatible evidence/);
  assert.match(html, /Incremental customer outcomes are unavailable/);
  assert.match(html, /DMA-to-CBSA compatibility is not approved/);
  assert.match(html, /Add data to improve this answer/);
  assert.match(html, /Regional campaign outcome aggregate/);
  assert.match(html, /Governed geography ID/);
  assert.match(html, /Approved DMA or postal identifier with coverage/);
  assert.match(html, /Test\/control cohort/);
  assert.match(html, /exact fields are still required/);
  assert.match(html, /original question was re-checked/i);
  assert.match(html, /Candidate already found/);
  assert.match(html, /DISCOVERED-CONTRIBUTION/);
  assert.match(html, /does not upload, connect, approve, or query a new file/);
  assert.doesNotMatch(html, /type="file"|Upload successful|Data connected/);
});

test("keeps answer and map ahead of the visible evidence trail in the final workflow", () => {
  const workflow = fs.readFileSync(new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url), "utf8");
  const answerIndex = workflow.indexOf('data-result-priority="answer-to-goal"');
  const mapIndex = workflow.indexOf("<GeographicFocusMap");
  const trailIndex = workflow.indexOf("<AnswerEvidenceTrail");
  const detailIndex = workflow.indexOf("<EvidenceBundlePanel");
  assert.ok(answerIndex >= 0 && answerIndex < mapIndex);
  assert.ok(mapIndex < trailIndex);
  assert.ok(trailIndex < detailIndex);
});
