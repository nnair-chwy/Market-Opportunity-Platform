import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  GROWTH_TEST_SCREENING_FINGERPRINT,
  calculateGrowthTestScreening,
} from "../lib/data-normalization/growth-screening.ts";
import { analysisBriefWeightTotal, buildAnalysisBrief } from "../lib/planning/analysis-brief.ts";
import { executeEvaluationPlanEvidence } from "../lib/planning/execute-plan.ts";
import { runMarketInvestigation } from "../lib/planning/market-investigation.ts";
import { planConfiguredDemoQuestion, DEMO_QUESTIONS } from "../lib/demo/scenarios.ts";
import { planEvaluation, validatePlanningIntentConsistency } from "../lib/planning/planner.ts";
import { buildPacketAnswer, proposedActionFromPlan } from "../lib/planning/reviewable-packet.ts";

const normalizedSnapshotDir = resolve(process.env.NORMALIZED_MARKET_DATA_DIR?.trim() || ".local-data/normalized-market-data");
const actualSnapshotTest = existsSync(join(normalizedSnapshotDir, "manifest.json")) ? test : test.skip;

function summary(question: string) {
  const plan = planEvaluation(question);
  return {
    plan,
    topic: plan.intent.topic,
    metrics: plan.intent.requestedMetrics,
    queries: plan.intent.selectedQueries,
    codes: plan.geographyResolution.selectedCbsaCodes,
  };
}

test("routes normalized descriptive questions by source family and metric vocabulary", () => {
  const seattle = summary("What aggregate clinic orders, customers, prescriptions, and sales exist for Seattle?");
  assert.equal(seattle.topic, "clinic_context");
  assert.deepEqual(seattle.codes, ["42660"]);
  assert.deepEqual(seattle.queries, ["clinic_context_by_cbsa"]);
  assert.deepEqual(seattle.metrics, ["total_orders", "rx_orders", "total_customers", "net_sales", "rx_net_sales"]);
  assert.equal(seattle.plan.intent.rankingMode, "none");
  assert.equal(seattle.plan.intent.sort, null);

  const atlanta = summary("What clinic sales exist for Atlanta?");
  assert.equal(atlanta.topic, "clinic_context");
  assert.deepEqual(atlanta.metrics, ["net_sales"]);
  assert.deepEqual(atlanta.codes, ["12060"]);

  const dallas = summary("How many Rx orders exist in Dallas?");
  assert.equal(dallas.topic, "clinic_context");
  assert.deepEqual(dallas.metrics, ["rx_orders"]);
  assert.deepEqual(dallas.codes, ["19100"]);

  const regional = summary("What regional sales exist for Seattle?");
  assert.equal(regional.topic, "regional_context");
  assert.deepEqual(regional.queries, ["regional_context_by_cbsa"]);

  const ads = summary("What Google Ads spend exists for Chicago?");
  assert.equal(ads.topic, "google_ads_context");
  assert.deepEqual(ads.metrics, ["google_ads_spend"]);
  assert.deepEqual(ads.codes, ["16980"]);
});

test("routes the complete demo question matrix without changing the user's analytical target", () => {
  const clinic = summary("What clinic orders, customers, prescriptions, and sales exist for Seattle?");
  assert.equal(clinic.topic, "clinic_context");
  assert.deepEqual(clinic.metrics, ["total_orders", "rx_orders", "total_customers", "net_sales", "rx_net_sales"]);
  assert.deepEqual(clinic.codes, ["42660"]);

  const regional = summary("What regional customers and sales exist for Atlanta?");
  assert.equal(regional.topic, "regional_context");
  assert.deepEqual(regional.metrics, ["active_customer_count", "regional_net_sales"]);
  assert.deepEqual(regional.queries, ["regional_context_by_cbsa"]);

  const ads = summary("What Google Ads spend exists for Chicago?");
  assert.equal(ads.topic, "google_ads_context");
  assert.deepEqual(ads.metrics, ["google_ads_spend"]);

  const comparison = summary("Compare Seattle and Atlanta clinic performance.");
  assert.equal(comparison.topic, "multi_market_comparison");
  assert.deepEqual(comparison.metrics, ["total_orders", "total_customers", "rx_orders", "net_sales", "rx_net_sales"]);
  assert.deepEqual(comparison.codes, ["42660", "12060"]);
  assert.match(comparison.plan.intent.conciseInterpretation, /descriptive aggregate clinic-market activity, not an approved operating KPI/i);

  const multiSource = summary("Show regional, clinic, and Google Ads evidence for Atlanta.");
  assert.equal(multiSource.topic, "multi_source_evidence");
  assert.deepEqual(multiSource.plan.intent.sourceFamilies, ["regional", "clinic", "google_ads"]);
  assert.deepEqual(multiSource.queries, ["regional_context_by_cbsa", "clinic_context_by_cbsa", "google_ads_context_by_cbsa"]);

  const coverage = summary("What evidence is available for Denver?");
  assert.equal(coverage.topic, "source_coverage");
  assert.deepEqual(coverage.codes, ["19740"]);
  assert.deepEqual(coverage.queries, ["supported_regions"]);

  const screening = summary("Rank regional growth-test candidates.");
  assert.equal(screening.topic, "growth_test_screening");
  assert.equal(screening.plan.intent.rankingMode, "growth_test_screening_v1");

  for (const item of [clinic, regional, ads, comparison, multiSource, coverage, screening]) {
    assert.deepEqual(validatePlanningIntentConsistency(item.plan.intent), []);
  }
});

test("generic deictic questions never silently select Phoenix and synthetic clinic use is explicit", () => {
  for (const question of [
    "What is this market, what public or descriptive evidence exists, and what remains unknown?",
    "Is there a measurable regional opportunity, and what evidence and guardrails are required before testing it?",
  ]) {
    const plan = planEvaluation(question);
    assert.equal(plan.status, "blocked");
    assert.equal(plan.geographyResolution.mode, "clarification");
    assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, []);
    assert.doesNotMatch(plan.intent.conciseInterpretation, /Phoenix/i);
  }

  const genericClinic = planEvaluation("How is this clinic performing relative to its peers?");
  assert.equal(genericClinic.status, "blocked");
  assert.equal(genericClinic.geographyResolution.mode, "clarification");

  const synthetic = planConfiguredDemoQuestion(DEMO_QUESTIONS.clinicPerformance);
  assert.ok(synthetic);
  assert.match(synthetic.intent.conciseInterpretation, /Synthetic South Clinic/i);
  assert.ok(synthetic.missingApprovals.includes("Synthetic demo selection confirmation"));
  assert.equal(synthetic.actions[0]?.requiresApproval, true);
});

test("routes coverage, multi-source, comparison, and screening as distinct workflows", () => {
  const coverage = summary("Which markets have clinic and Google Ads coverage?");
  assert.equal(coverage.topic, "source_coverage");
  assert.deepEqual(coverage.queries, ["supported_regions"]);
  assert.equal(coverage.plan.intent.rankingMode, "none");

  const multiSource = summary("What evidence exists across market, clinic, and advertising for Atlanta?");
  assert.equal(multiSource.topic, "multi_source_evidence");
  assert.deepEqual(multiSource.plan.intent.sourceFamilies, ["clinic", "google_ads", "regional"]);
  assert.deepEqual(multiSource.queries, ["clinic_context_by_cbsa", "google_ads_context_by_cbsa", "regional_context_by_cbsa"]);

  const comparison = summary("Compare clinic orders in Seattle and Atlanta.");
  assert.equal(comparison.topic, "multi_market_comparison");
  assert.deepEqual(comparison.codes, ["42660", "12060"]);
  assert.equal(comparison.plan.intent.sort, null);
  assert.equal(comparison.plan.intent.rankingMode, "none");

  const screening = summary("Which markets are the strongest candidates for a measurable regional growth test?");
  assert.equal(screening.topic, "growth_test_screening");
  assert.deepEqual(screening.queries, ["growth_test_screening"]);
  assert.equal(screening.plan.intent.rankingMode, "growth_test_screening_v1");
});

test("preserves legacy clinic-performance and clinic-location routing", () => {
  assert.equal(planEvaluation("How is this clinic performing relative to an approved peer group?").intent.topic, "clinic_performance");
  const location = planEvaluation("Where should we open a clinic in Seattle?");
  assert.equal(location.intent.topic, "clinic_location");
  assert.deepEqual(location.geographyResolution.selectedCbsaCodes, ["42660"]);
  assert.deepEqual(location.intent.selectedQueries, ["regional_context_by_cbsa", "clinic_context_by_cbsa"]);
  assert.equal(location.intent.rankingMode, "none");
});

test("blocks comparison cohorts outside the supported two-to-five range", () => {
  const one = planEvaluation("Compare clinic orders in Seattle.");
  assert.equal(one.status, "blocked");
  assert.equal(one.geographyResolution.mode, "clarification");
  const six = planEvaluation("Compare clinic orders in Seattle, Atlanta, Dallas, Chicago, Phoenix, and Denver.");
  assert.equal(six.status, "blocked");
  assert.equal(six.geographyResolution.mode, "clarification");
  assert.match(six.geographyResolution.message, /two to five/i);
});

test("interpretation stays faithful and makes the Rx proxy visible", () => {
  const plan = planEvaluation("What aggregate clinic orders, customers, prescriptions, and sales exist for Seattle?");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.match(brief.rewrittenQuestion, /Clinic orders.*Clinic Rx orders.*Clinic customers.*Clinic net sales.*Clinic Rx net sales.*Seattle/i);
  assert.match(brief.rewrittenQuestion, /supplied proxy for prescriptions/i);
  assert.doesNotMatch(brief.rewrittenQuestion, /footprint contrasts|household context for customer/i);
  assert.equal(brief.currentScreen.considerationEditsRecalculate, false);
});

test("pre-execution briefs expose exact query contracts and topic-specific boundaries", () => {
  const briefFor = (question: string) => {
    const plan = planEvaluation(question);
    return buildAnalysisBrief(plan, runMarketInvestigation(plan));
  };

  const regional = briefFor("What regional customers and sales exist for Atlanta?");
  assert.match(regional.rewrittenQuestion, /active customers.*regional net sales excluding refunds.*Atlanta/i);
  assert.match(regional.timeframe, /2026-07-31.*2024, 2025, and partial 2026/i);
  assert.deepEqual(regional.queryContract?.requestedMetrics, ["active_customer_count", "regional_net_sales"]);

  const comparison = briefFor("Compare Seattle and Atlanta clinic performance.");
  assert.match(comparison.rewrittenQuestion, /descriptive aggregate clinic-market activity, not as an approved operating KPI/i);
  assert.deepEqual(comparison.queryContract?.geographyIds, ["cbsa:42660", "cbsa:12060"]);
  assert.equal(comparison.currentScreen.weightMode, "none");

  const coverage = briefFor("What evidence is available for Denver?");
  assert.match(coverage.rewrittenQuestion, /present or absent.*Denver.*not data quality or market attractiveness/i);
  assert.deepEqual(coverage.queryContract?.registeredQueries, ["supported_regions"]);

  const growth = briefFor("Rank regional growth-test candidates.");
  assert.equal(growth.currentScreen.weightMode, "fixed_calculation");
  assert.equal(growth.currentScreen.considerationEditsRecalculate, false);
  assert.equal(analysisBriefWeightTotal(growth), 100);
  assert.deepEqual(growth.considerations.map((item) => item.weightPercent), [30, 25, 20, 15, 10]);
  assert.match(growth.currentScreen.method, /fixed 30\/25\/20\/15\/10/i);
  assert.match(growth.queryContract?.missingDataRule ?? "", /do not renormalize weights/i);
});

test("growth-test screening is deterministic, complete-case, and does not renormalize", () => {
  const inputs = [
    { cbsaCode: "10001", cbsaName: "A", demand2024: 100, demand2025: 120, activeCustomersPer1000Households: 10, activeCustomerYoyGrowth: 0.1, veterinarySearchConversions: 5, householdCount: 1000, sourceIds: "A" },
    { cbsaCode: "10002", cbsaName: "B", demand2024: 100, demand2025: 110, activeCustomersPer1000Households: 20, activeCustomerYoyGrowth: 0.2, veterinarySearchConversions: 10, householdCount: 2000, sourceIds: "B" },
    { cbsaCode: "10003", cbsaName: "C", demand2024: 100, demand2025: 130, activeCustomersPer1000Households: 30, activeCustomerYoyGrowth: null, veterinarySearchConversions: 15, householdCount: 3000, sourceIds: "C" },
  ];
  const first = calculateGrowthTestScreening(inputs);
  const second = calculateGrowthTestScreening(inputs);
  assert.deepEqual(first, second);
  assert.equal(first.included.length, 2);
  assert.deepEqual(first.excluded, [{ cbsaCode: "10003", cbsaName: "C", eligible: false, missingMetricIds: ["activeCustomerYoyGrowth"] }]);
  assert.equal(first.included[0]?.rank, 1);
  assert.equal(first.included[0]?.configurationFingerprint, GROWTH_TEST_SCREENING_FINGERPRINT);
  assert.equal(Object.values(first.included[0]!.contributions).reduce((sum, value) => sum + value, 0), first.included[0]?.score);
});

actualSnapshotTest("executes the exact demo matrix with requested metrics, periods, scope, and named coverage", async () => {
  const questions = [
    "What clinic orders, customers, prescriptions, and sales exist for Seattle?",
    "What regional customers and sales exist for Atlanta?",
    "What Google Ads spend exists for Chicago?",
    "Compare Seattle and Atlanta clinic performance.",
    "Show regional, clinic, and Google Ads evidence for Atlanta.",
    "What evidence is available for Denver?",
    "Rank regional growth-test candidates.",
  ];
  const results = [];
  const plans = [];
  for (const question of questions) {
    const plan = planEvaluation(question);
    plans.push(plan);
    results.push(await executeEvaluationPlanEvidence({ requestId: `actual-${plan.planId}`, plan }, { normalizedSnapshotDir }));
  }
  assert.equal(results[0]?.query, "normalized_evidence_bundle");
  assert.deepEqual(results[0]?.evidenceBundle.map((item) => item.metricId), ["normalized.total_orders", "normalized.rx_orders", "normalized.total_customers", "normalized.net_sales", "normalized.rx_net_sales"]);
  assert.ok(results[0]?.evidenceBundle.every((item) => item.period.kind === "timeframe" && item.period.label === "Pre-PH"));

  assert.deepEqual([...new Set(results[1]?.rows.map((row) => row.metricId))], ["active_customer_count", "regional_net_sales"]);
  assert.ok(results[1]?.rows.every((row) => typeof row.period === "object"));

  assert.deepEqual(results[2]?.evidenceBundle.map((item) => item.metricId), ["normalized.google_ads_spend", "normalized.google_ads_spend"]);
  assert.ok(results[2]?.evidenceBundle.every((item) => item.currency === "USD" && item.reportScope && item.period.kind === "date_range"));

  assert.equal(results[3]?.query, "multi_market_comparison_bundle");
  assert.equal(results[3]?.rows.length, 10);
  assert.deepEqual([...new Set(results[3]?.rows.map((row) => row.cbsaCode))], ["42660", "12060"]);
  assert.deepEqual([...new Set(results[3]?.rows.map((row) => row.metricId))], ["total_orders", "total_customers", "rx_orders", "net_sales", "rx_net_sales"]);

  assert.deepEqual(results[4]?.componentQueries, ["regional_context_by_cbsa", "clinic_context_by_cbsa", "google_ads_context_by_cbsa"]);
  assert.ok(results[4]?.evidenceBundle.some((item) => item.metricId.startsWith("normalized.active_customer")));
  assert.ok(results[4]?.evidenceBundle.some((item) => item.metricId.startsWith("normalized.total_orders")));
  assert.ok(results[4]?.evidenceBundle.some((item) => item.metricId.startsWith("normalized.google_ads")));

  assert.equal(results[5]?.query, "source_coverage_bundle");
  assert.equal(results[5]?.rows.length, 1);
  assert.equal(results[5]?.rows[0]?.cbsaCode, "19740");
  assert.equal(results[5]?.evidenceBundle[0]?.sourceId, "SRC-019");
  assert.match(results[5]?.evidenceBundle[0]?.warning ?? "", /presence only/i);

  assert.equal(results[6]?.query, "growth_test_screening_bundle");
  assert.ok((results[6]?.rows.length ?? 0) > 0);
  assert.equal(results[6]?.rows[0]?.rank, 1);
  assert.ok(results[6]?.guardrails.some((item) => /Do not use this screening rank/i.test(item)));

  const answers = results.map((result, index) => buildPacketAnswer(plans[index]!, proposedActionFromPlan(plans[index]!), result));
  assert.match(answers[0]!.directAnswer, /aggregate clinic-market activity.*Rx orders.*prescription proxy/i);
  assert.match(answers[1]!.directAnswer, /calendar-year sales.*do not establish incremental regional opportunity/i);
  assert.match(answers[2]!.directAnswer, /spend is intentionally separated by report scope.*inferred demo context/i);
  assert.match(answers[3]!.directAnswer, /Seattle.*Atlanta.*side-by-side comparison.*not an approved clinic operating KPI/i);
  assert.match(answers[4]!.directAnswer, /canonical observations.*periods, grains, and Ads geography quality/i);
  assert.match(answers[5]!.directAnswer, /Census: available.*regional: available.*clinic: available.*Google Ads: available.*does not establish freshness/i);
  assert.match(answers[6]!.directAnswer, /fixed complete-case hypothesis screen ranks.*30\/25\/20\/15\/10.*does not authorize/i);

  assert.deepEqual(plans.map((plan) => proposedActionFromPlan(plan).id), [
    "review-clinic-context",
    "review-regional-context",
    "review-google-ads-context",
    "review-descriptive-clinic-market-comparison",
    "reconcile-multi-source-evidence",
    "review-source-coverage-gaps",
    "review-growth-test-screening",
  ]);
  assert.ok(plans.every((plan) => !/review the returned metrics/i.test(proposedActionFromPlan(plan).nextStep)));
});

test("clinic-opening routing keeps the client and executor on one bounded workflow", () => {
  const plan = planEvaluation("Where should we open a clinic in Seattle?");
  const action = proposedActionFromPlan(plan);
  assert.equal(plan.intent.topic, "clinic_location");
  assert.match(action.title, /clinic-location evidence.*Seattle/i);
  assert.match(action.nextStep, /validate|governed evidence|approval/i);
  assert.deepEqual(plan.intent.sourceFamilies, ["census", "regional", "clinic"]);
  assert.deepEqual(plan.intent.selectedQueries, ["regional_context_by_cbsa", "clinic_context_by_cbsa"]);
  assert.equal(plan.status, "partially_executable");
});

actualSnapshotTest("named clinic-location evidence review executes and replays the exact query-aware Phoenix contract", async () => {
  const question = "What evidence should we review before opening a clinic in Phoenix?";
  const plan = planEvaluation(question);
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const first = await executeEvaluationPlanEvidence({ requestId: "clinic-location-phoenix", plan }, { normalizedSnapshotDir });
  const replay = await executeEvaluationPlanEvidence({ requestId: "clinic-location-phoenix", plan }, { normalizedSnapshotDir });
  assert.equal(first.query, "clinic_location_evidence_bundle");
  assert.equal(first.status, "partial");
  assert.deepEqual(first.geographyIds, ["cbsa:38060"]);
  assert.deepEqual(first.componentQueries, ["regional_context_by_cbsa", "clinic_context_by_cbsa"]);
  assert.ok(first.missingEvidence.some((item) => /staffed capacity/i.test(item)));
  assert.ok(first.missingEvidence.some((item) => /workforce and competitive access/i.test(item)));
  assert.ok(first.unknowns.some((item) => /does not establish site suitability/i.test(item)));
  assert.deepEqual(replay, first);
  assert.deepEqual(brief.queryContract?.geographyIds, first.geographyIds);
  assert.deepEqual(brief.queryContract?.registeredQueries, first.componentQueries);
  const answer = buildPacketAnswer(plan, proposedActionFromPlan(plan), first);
  assert.match(answer.directAnswer, /Phoenix-Mesa-Chandler, AZ has connected public and regional market context plus aggregate clinic activity/i);
  assert.match(answer.directAnswer, /still not connected.*capacity.*workforce.*competitive.*property.*economics/i);
  assert.match(answer.directAnswer, /not site selection or approval to open a clinic/i);
});
