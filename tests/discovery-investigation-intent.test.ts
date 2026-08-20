import assert from "node:assert/strict";
import test from "node:test";
import { publicMarkets } from "../lib/data/public-market-ui.ts";
import {
  buildDiscoveryInvestigationIntent,
  discoveryInvestigationIntentFromSearchParams,
  discoveryInvestigationIntentSearchParams,
  runCurrentDataInsightDiscovery,
} from "../lib/insight-discovery/index.ts";
import { planEvaluation } from "../lib/planning/planner.ts";
import { runMarketInvestigation } from "../lib/planning/market-investigation.ts";
import { buildAnalysisBrief, validateAnalysisBriefConsistency } from "../lib/planning/analysis-brief.ts";
import { getApprovedWorkspaceSnapshotDataset } from "../lib/perspectives/approved-workspace-snapshot.ts";

const run = runCurrentDataInsightDiscovery({
  runId: "discovery:intent-test",
  now: () => "2026-08-19T12:00:00.000Z",
});

test("finding investigation intent preserves exact geography, perspective, and view for every department", () => {
  for (const department of ["marketing", "pricing", "cvc"] as const) {
    const finding = run.findings.find((candidate) => candidate.department === department);
    assert.ok(finding);
    const intent = buildDiscoveryInvestigationIntent({
      insightId: finding.insightId,
      department: finding.department,
      viewId: finding.viewId,
      marketIds: finding.marketIds,
    });
    assert.equal(intent.perspectiveId, department);
    assert.equal(intent.viewId, finding.viewId);
    assert.deepEqual(intent.selectedCbsaCodes, finding.marketIds);
    assert.ok(intent.marketNames.every((marketName) => intent.question.includes(marketName)));

    const plan = planEvaluation(
      intent.question,
      intent.perspectiveId,
      intent.selectedGeographicContexts,
      intent.viewId,
    );
    assert.equal(plan.perspectiveId, department);
    assert.equal(plan.evidenceSelection.viewId, finding.viewId);
    assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, finding.marketIds);

    const investigation = runMarketInvestigation(plan);
    assert.ok(investigation.leads.length > 0);
    assert.ok(investigation.leads.every((lead) =>
      lead.marketIds.some((marketId) => intent.selectedCbsaCodes.includes(marketId)),
    ));
    const brief = buildAnalysisBrief(plan, investigation);
    assert.deepEqual(validateAnalysisBriefConsistency(plan, brief), []);
    assert.ok(intent.marketNames.every((marketName) => brief.rewrittenQuestion.includes(marketName)));
  }
});

test("URL-backed intent survives reload without trusting display labels", () => {
  const finding = run.findings.find((candidate) => candidate.department === "pricing");
  assert.ok(finding);
  const intent = buildDiscoveryInvestigationIntent({
    insightId: finding.insightId,
    department: finding.department,
    viewId: finding.viewId,
    marketIds: finding.marketIds,
  });
  const restored = discoveryInvestigationIntentFromSearchParams(
    discoveryInvestigationIntentSearchParams(intent),
  );
  assert.deepEqual(restored, intent);
});

test("invalid geography and cross-perspective views fail validation", () => {
  assert.throws(() => buildDiscoveryInvestigationIntent({
    insightId: "insight:invalid-geography",
    department: "marketing",
    viewId: "paid_search_response",
    marketIds: ["99999"],
  }), /unknown CBSA/i);
  assert.throws(() => buildDiscoveryInvestigationIntent({
    insightId: "insight:invalid-view",
    department: "pricing",
    viewId: "paid_search_response",
    marketIds: ["19100"],
  }), /not configured for perspective pricing/i);
});

test("a selected market without compatible snapshot evidence returns a gap instead of another market", () => {
  const dataset = getApprovedWorkspaceSnapshotDataset("pricing_competitor_availability");
  const covered = new Set(dataset.values.map((item) => item.cbsaCode));
  const missingMarket = publicMarkets.find((market) => !covered.has(market.cbsa_code));
  assert.ok(missingMarket);
  const plan = planEvaluation(
    `Investigate regional pricing competitor availability for ${missingMarket.cbsa_name}.`,
    "pricing",
    [{ cbsaCode: missingMarket.cbsa_code, cbsaName: missingMarket.cbsa_name }],
    "competitor_availability",
  );
  const investigation = runMarketInvestigation(plan);
  assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, [missingMarket.cbsa_code]);
  assert.deepEqual(investigation.leads, []);
  assert.match(investigation.readiness.summary, /no compatible|did not substitute/i);
});
