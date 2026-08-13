import assert from "node:assert/strict";
import test from "node:test";
import { buildInsightActionPlan, planEvaluation } from "../lib/planning/index.ts";
import { buildAnalysisBrief } from "../lib/planning/analysis-brief.ts";
import { runConfirmedMarketInvestigation, runMarketInvestigation } from "../lib/planning/market-investigation.ts";

function confirmedCvcAnalysis() {
  const plan = planEvaluation("Where should we open the next CVC clinic?", "cvc");
  const proposed = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const brief = { ...proposed, status: "confirmed" as const, confirmedAt: "2026-08-13T22:00:00.000Z" };
  return { plan, brief, investigation: runConfirmedMarketInvestigation(plan, brief) };
}

test("action plan converts a synthetic market lead into an owned validation sprint", () => {
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
  assert.deepEqual(actionPlan.decisionRules.map((rule) => rule.disposition), ["advance", "hold", "stop"]);
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
