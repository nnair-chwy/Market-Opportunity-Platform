import assert from "node:assert/strict";
import test from "node:test";
import { getApprovedWorkspaceSnapshotBundle } from "../lib/perspectives/approved-workspace-snapshot.ts";
import { planEvaluation } from "../lib/planning/index.ts";
import { reviseMarketInvestigation, runMarketInvestigation } from "../lib/planning/market-investigation.ts";

test("approved paid-search bundle carries compatible funnel numerators and rates", () => {
  const bundle = getApprovedWorkspaceSnapshotBundle();
  const ids = [
    "marketing_paid_search_cost",
    "marketing_paid_search_response",
    "marketing_paid_search_impressions",
    "marketing_paid_search_ctr",
    "marketing_paid_search_cpc",
    "marketing_paid_search_conversions",
    "marketing_paid_search_conversion_rate",
    "marketing_paid_search_cost_per_conversion",
  ] as const;
  const datasets = ids.map((id) => bundle.datasets[id]);
  assert.ok(datasets.every((dataset) => dataset.snapshotId === "google-ads-2026-07-14_2026-08-12"));
  assert.ok(datasets.every((dataset) => dataset.outputGrain === "cbsa"));
  assert.ok(datasets.every((dataset) => dataset.sourceIds.includes("SRC-018")));
  assert.ok(datasets.every((dataset) => dataset.values.length >= 380));
});

test("overpayment investigation joins funnel and market context without a blended score", () => {
  const plan = planEvaluation("Which region are we paying more than we should for ads?", "marketing");
  const investigation = runMarketInvestigation(plan);
  assert.equal(investigation.scoringEligibility, "none");
  assert.deepEqual(investigation.sourceIds, ["SRC-018", "SRC-016", "AVMA-PDS-2017-2018-T16"]);
  assert.match(investigation.screeningScope.selectionRule, /lexicographic|order transparently/i);
  assert.match(investigation.screeningScope.selectionRule, /20 closest measured metros/i);
  assert.ok(investigation.leads.every((lead) => lead.supportingMeasures?.some((item) => item.id === "cost_per_conversion")));
  assert.ok(investigation.leads.every((lead) => lead.supportingMeasures?.some((item) => item.id === "households")));
  assert.equal(investigation.investigationPath.filter((step) => step.status === "completed").length, 4);
  assert.equal(investigation.investigationPath.filter((step) => step.status === "waiting_for_evidence").length, 2);
  assert.ok(investigation.leads.some((lead) => lead.supportingMeasures?.some((measure) => measure.id === "state_dog_ownership")));
  assert.match(investigation.limitations.join(" "), /not a CBSA pet count/i);
  assert.match(investigation.portfolioPattern?.headline ?? "", /markets show/i);
  assert.equal(investigation.portfolioPattern?.segments.length, 4);
  assert.match(investigation.portfolioPattern?.implication ?? "", /not a time trend/i);
  assert.match(investigation.mediaScope?.included ?? "", /Google Ads paid search/i);
  assert.match(investigation.mediaScope?.bundlingRule ?? "", /No cross-channel bundling/i);
  assert.ok(investigation.mediaScope?.excluded.includes("Paid social"));
});

test("analyst feedback creates a bounded revised investigation without inventing channel evidence", () => {
  const plan = planEvaluation("Which region are we paying more than we should for ads?", "marketing");
  const original = runMarketInvestigation(plan);
  const revised = reviseMarketInvestigation(original, "Consider the other advertising channels", 2);
  assert.equal(revised.analystRevision?.draftNumber, 2);
  assert.match(revised.analystRevision?.effectOnRecommendation ?? "", /Google Ads paid-search signal/i);
  assert.match(revised.analystRevision?.effectOnRecommendation ?? "", /cannot be generalized/i);
  assert.match(revised.leads[0].nextEvidence, /Analyst-requested check/i);
  assert.equal(original.analystRevision, undefined);
});
