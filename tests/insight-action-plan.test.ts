import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionEvidenceItem } from "../lib/evidence-snapshot/contracts.ts";
import {
  assembleReviewableActionPacket,
  buildInsightActionPlan,
  planEvaluation,
  proposedActionFromPlan,
  reconcileEvidenceCompatibility,
} from "../lib/planning/index.ts";
import { buildAnalysisBrief } from "../lib/planning/analysis-brief.ts";
import { runConfirmedMarketInvestigation, runMarketInvestigation } from "../lib/planning/market-investigation.ts";

function confirmedCvcAnalysis() {
  const plan = planEvaluation("Where should we open the next CVC clinic?", "cvc");
  const proposed = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const brief = { ...proposed, status: "confirmed" as const, confirmedAt: "2026-08-13T22:00:00.000Z" };
  return { plan, brief, investigation: runConfirmedMarketInvestigation(plan, brief) };
}

function confirmedAnalysis(question: string, perspective: "marketing" | "pricing") {
  const plan = planEvaluation(question, perspective);
  const initial = runMarketInvestigation(plan);
  const proposed = buildAnalysisBrief(plan, initial);
  const brief = { ...proposed, status: "confirmed" as const, confirmedAt: "2026-08-13T22:00:00.000Z" };
  return { plan, brief, investigation: runConfirmedMarketInvestigation(plan, brief) };
}

function compatibilityItem(overrides: Pick<ExecutionEvidenceItem, "evidenceId" | "metricId" | "geographyId" | "geographyLabel" | "sourceId">): ExecutionEvidenceItem {
  return {
    ...overrides,
    rawValue: 10,
    structuredValue: null,
    unit: "count",
    snapshotId: "action-plan-compatibility-v1",
    evidenceStatus: "Reported",
    qualityStatus: "accepted",
    observationStart: "2026-01-01",
    observationEnd: "2026-01-31",
    period: { kind: "date_range", start: "2026-01-01", end: "2026-01-31", label: "January 2026" },
    reportScope: null,
    currency: null,
    allowedUse: "internal_shadow_evaluation_only",
    sensitivity: "internal",
    warning: null,
    origin: "frozen_csv_snapshot",
  };
}

test("action plan converts a connected-evidence lead into an owned validation sprint", () => {
  const { plan, brief, investigation } = confirmedCvcAnalysis();
  const actionPlan = buildInsightActionPlan(plan, investigation, investigation.leads[0], brief, brief.confirmedAt);
  assert.ok(actionPlan);
  assert.match(actionPlan.recommendation, /bounded validation sprint/i);
  assert.match(actionPlan.recommendation, /do not begin site selection or opening approval/i);
  assert.equal(actionPlan.workstreams.length, 4);
  assert.equal(actionPlan.workstreams[0].status, "ready_to_start");
  assert.ok(actionPlan.workstreams.slice(1).every((workstream) => workstream.status === "blocked_on_evidence"));
  assert.equal(actionPlan.workstreams[0].dueDate, "2026-08-20");
  assert.equal(actionPlan.decisionDueDate, "2026-09-07");
  assert.match(actionPlan.workstreams[0].owner, /Consumer Insights Health/);
  assert.match(actionPlan.workstreams[0].completionCriteria, /expansion benchmark/i);
  assert.ok(actionPlan.workstreams.every((workstream) => workstream.kpi.length > 0));
  assert.ok(actionPlan.workstreams.every((workstream) => workstream.validationThreshold.length > 0));
  assert.ok(actionPlan.workstreams.every((workstream) => workstream.stopCondition.length > 0));
  assert.deepEqual(actionPlan.decisionRules.map((rule) => rule.disposition), ["advance", "hold", "stop"]);
  assert.equal(actionPlan.lever, "clinic_footprint_validation");
  assert.equal(actionPlan.actionReadiness, "outcome_missing");
  assert.equal(actionPlan.confidence, "Low");
  assert.match(actionPlan.kpi, /appointment capacity.*mature-clinic performance/i);
  assert.ok(actionPlan.baseline.evidenceIds.includes(investigation.leads[0].id));
});

test("action plan follows the selected market rather than returning a fixed packet", () => {
  const { plan, brief, investigation } = confirmedCvcAnalysis();
  const first = buildInsightActionPlan(plan, investigation, investigation.leads[0], brief, brief.confirmedAt);
  const second = buildInsightActionPlan(plan, investigation, investigation.leads[1], brief, brief.confirmedAt);
  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.marketName, second.marketName);
  assert.match(first.workstreams[0].action, new RegExp(first.marketName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(second.workstreams[0].action, new RegExp(second.marketName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("marketing finding produces a bounded paid-search lever plan with outcome and experiment gates", () => {
  const { plan, brief, investigation } = confirmedAnalysis("Where should we increase paid search spend?", "marketing");
  const actionPlan = buildInsightActionPlan(plan, investigation, investigation.leads[0], brief, brief.confirmedAt);
  assert.ok(actionPlan);
  assert.equal(actionPlan.lever, "paid_search_spend_test");
  assert.equal(actionPlan.actionReadiness, "outcome_missing");
  assert.equal(actionPlan.confidence, "Low");
  assert.match(actionPlan.recommendation, /do not change live spend/i);
  assert.match(actionPlan.kpi, /new customers.*orders.*net sales.*contribution/i);
  assert.match(actionPlan.validationThreshold, /power|minimum-detectable-effect/i);
  assert.match(actionPlan.stopCondition, /do not change live spend/i);
  assert.match(actionPlan.sensitivityAndContraryEvidence, /are not|does not|cannot|different/i);
  assert.ok(actionPlan.workstreams.every((workstream) => workstream.kpi && workstream.validationThreshold && workstream.stopCondition));

  const packet = assembleReviewableActionPacket(
    plan,
    proposedActionFromPlan(plan),
    brief.confirmedAt,
    investigation,
    [],
    brief,
    undefined,
    undefined,
    { selectedLeadId: investigation.leads[0].id, contextMetric: "total_population" },
    actionPlan,
  );
  assert.equal(packet.actionPlan?.lever, "paid_search_spend_test");
  assert.equal(packet.actionPlan?.actionReadiness, "outcome_missing");
  assert.ok(packet.actionPlan?.baseline?.evidenceIds.includes(investigation.leads[0].id));
});

test("pricing finding produces a matched-SKU test plan without inventing a price", () => {
  const { plan, brief, investigation } = confirmedAnalysis("Where do competitor conditions warrant a pricing test?", "pricing");
  const actionPlan = buildInsightActionPlan(plan, investigation, investigation.leads[0], brief, brief.confirmedAt);
  assert.ok(actionPlan);
  assert.equal(actionPlan.lever, "pricing_test");
  assert.equal(actionPlan.actionReadiness, "outcome_missing");
  assert.match(actionPlan.recommendation, /matched-SKU pricing test/i);
  assert.match(actionPlan.recommendation, /do not change live price/i);
  assert.match(actionPlan.kpi, /contribution.*unit.*sales.*customer-response/i);
  assert.match(actionPlan.stopCondition, /regional outcomes.*matched-SKU coverage.*economics/i);
  assert.doesNotMatch(actionPlan.recommendation, /\$\d|\d+%/);
});

test("incompatible geography forces low-confidence source-specific lever validation", () => {
  const { plan, brief, investigation } = confirmedAnalysis("Where should we increase paid search spend?", "marketing");
  const reconciliation = reconcileEvidenceCompatibility([
    compatibilityItem({ evidenceId: "zip-spend", metricId: "spend", geographyId: "zip:98101", geographyLabel: "ZIP 98101", sourceId: "ADS" }),
    compatibilityItem({ evidenceId: "dma-orders", metricId: "orders", geographyId: "dma:819", geographyLabel: "Seattle DMA", sourceId: "OUTCOMES" }),
  ], { operation: "join" });
  const incompatibleInvestigation = { ...investigation, reconciliation };
  const actionPlan = buildInsightActionPlan(plan, incompatibleInvestigation, incompatibleInvestigation.leads[0], brief, brief.confirmedAt);
  assert.ok(actionPlan);
  assert.equal(actionPlan.actionReadiness, "evidence_incompatible");
  assert.equal(actionPlan.confidence, "Low");
  assert.equal(actionPlan.workstreams[0].status, "blocked_on_evidence");
  assert.match(actionPlan.stopCondition, /incompatible.*remain source-specific/i);
});
