import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

function result(overrides = {}) {
  return {
    requestId: "render-demo",
    status: "partial",
    snapshotVersion: "clinic-market-demo-2026-08-17-v1",
    queryVersion: "plan-evidence-dispatch-v1",
    calculationVersion: "evidence-bundle-composition-v1",
    query: "market_context_bundle",
    componentQueries: ["canonical_market_evidence"],
    capability: "census_market_context",
    planId: "plan-render-demo",
    originalQuestion: "What is this market, what public or descriptive evidence exists, and what remains unknown?",
    geographyIds: ["cbsa:38060"],
    missingApprovals: [],
    guardrails: ["Descriptive context is not an opportunity score."],
    rows: [{ metricId: "market.active_customer_yoy_growth", value: 0.08 }],
    evidenceBundle: [{
      evidenceId: "evidence-render-1",
      metricId: "market.active_customer_yoy_growth",
      geographyId: "cbsa:38060",
      geographyLabel: "Phoenix-Mesa-Chandler, AZ",
      rawValue: 0.08,
      structuredValue: null,
      unit: "ratio",
      sourceId: "SOURCE-RENDER-1",
      snapshotId: "snapshot-render-1",
      evidenceStatus: "Reported",
      qualityStatus: "warning",
      observationStart: null,
      observationEnd: "2026-07-31",
      allowedUse: "descriptive_context_only",
      sensitivity: "internal",
      warning: "Interpretation warning.",
      origin: "frozen_csv_snapshot",
    }],
    sourceIds: ["SOURCE-RENDER-1"],
    qualityWarnings: ["Interpretation warning."],
    missingEvidence: ["Pricing evidence is unavailable."],
    unknowns: ["Causal demand is unknown."],
    allowedUse: "descriptive_context_only",
    sensitivity: "internal",
    executionMode: "frozen_snapshot_demo",
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

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
  return (await vite.ssrLoadModule("/components/evidence/EvidenceBundlePanel.tsx")).EvidenceBundlePanel;
}

test("shared evidence view renders the required ordered market result and provenance", async (t) => {
  const EvidenceBundlePanel = await component(t);
  const html = renderToStaticMarkup(createElement(EvidenceBundlePanel, { result: result(), action: { nextStep: "Review missing evidence." } }));
  const headings = ["Original question", "Answer available with limits", "Evidence used", "Calculation or comparison", "Reliability", "Unknowns", "Limitations", "Required approvals", "Proposed next action"];
  let prior = -1;
  for (const heading of headings) {
    const index = html.indexOf(heading);
    assert.ok(index > prior, `${heading} should render after the prior section`);
    prior = index;
  }
  assert.match(html, /SOURCE-RENDER-1/);
  assert.match(html, /snapshot-render-1/);
  assert.match(html, /Reported/);
  assert.match(html, /warning/);
  assert.match(html, /2026-07-31/);
  assert.match(html, /descriptive context only/);
  assert.match(html, /frozen snapshot demo/);
});

test("shared evidence view distinguishes clinic synthetic fallback and growth guardrails", async (t) => {
  const EvidenceBundlePanel = await component(t);
  const clinic = result({
    query: "clinic_performance_bundle",
    capability: "clinic_performance",
    originalQuestion: "How is this clinic performing relative to an approved peer group, and how reliable is that comparison?",
    executionMode: "synthetic_demo",
    calculationVersion: "synthetic-clinic-rank-v1",
    geographyIds: ["SYN-CVC-001", "SYN-CVC-002", "SYN-CVC-003"],
    rows: [
      { clinicId: "SYN-CVC-001", clinicName: "Synthetic North Clinic", selected: false, value: 840, rank: 1, metricId: "completed_appointments" },
      { clinicId: "SYN-CVC-003", clinicName: "Synthetic South Clinic", selected: true, value: 812, rank: 2, metricId: "completed_appointments" },
      { clinicId: "SYN-CVC-002", clinicName: "Synthetic West Clinic", selected: false, value: 795, rank: 3, metricId: "completed_appointments" },
    ],
    evidenceBundle: [{ ...result().evidenceBundle[0], evidenceId: "synthetic-clinic", metricId: "synthetic.clinic_performance.completed_appointments", geographyId: "SYN-CVC-003", geographyLabel: "Synthetic South Clinic", rawValue: 812, unit: "appointments", evidenceStatus: "Hypothesis", origin: "synthetic_demo_fixture", snapshotId: "synthetic-clinic-performance-v1", sourceId: "SRC-002" }],
    sourceIds: ["SRC-002"],
    missingApprovals: ["Production peer-group approval"],
  });
  const clinicHtml = renderToStaticMarkup(createElement(EvidenceBundlePanel, { result: clinic }));
  assert.match(clinicHtml, /Synthetic South Clinic/);
  assert.match(clinicHtml, /2<!-- --> of <!-- -->3|2 of 3/);
  assert.match(clinicHtml, /Hypothesis/);
  assert.match(clinicHtml, /Illustrative only/);
  assert.match(clinicHtml, /Production peer-group approval/);

  const growthHtml = renderToStaticMarkup(createElement(EvidenceBundlePanel, { result: result({ query: "growth_test_bundle", capability: "local_growth_test", originalQuestion: "Is there a measurable regional opportunity, and what evidence and guardrails are required before testing it?", guardrails: ["Do not launch or rank regions."], missingApprovals: ["Growth-test design approval"] }) }));
  assert.match(growthHtml, /Do not launch or rank regions/);
  assert.match(growthHtml, /Growth-test design approval/);
  assert.doesNotMatch(growthHtml, /Launch campaign|Authorize spend|Causal lift achieved/i);
});

test("shared evidence view renders a controlled blocked state", async (t) => {
  const EvidenceBundlePanel = await component(t);
  const html = renderToStaticMarkup(createElement(EvidenceBundlePanel, { result: result({ status: "blocked", rows: [], evidenceBundle: [], sourceIds: [], componentQueries: [], missingEvidence: ["An exact geography is required."], unknowns: [] }) }));
  assert.match(html, /Blocked by evidence gate/);
  assert.match(html, /An exact geography is required/);
  assert.doesNotMatch(html, /NaN|undefined/);
});
