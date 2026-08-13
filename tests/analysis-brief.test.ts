import assert from "node:assert/strict";
import test from "node:test";
import { analysisBriefWeightTotal, buildAnalysisBrief } from "../lib/planning/analysis-brief.ts";
import { runMarketInvestigation } from "../lib/planning/market-investigation.ts";
import { planEvaluation } from "../lib/planning/planner.ts";

test("CVC analysis brief proposes editable preferences separately from gates and context", () => {
  const plan = planEvaluation("Which comparable markets differ most in clinic footprint and demand?", "cvc");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.equal(brief.originalQuestion, plan.originalQuestion);
  assert.equal(brief.rewrittenQuestion, plan.intent.conciseInterpretation);
  assert.equal(analysisBriefWeightTotal(brief), 100);
  assert.ok(brief.considerations.some((item) => item.role === "weighted_preference"));
  assert.ok(brief.considerations.some((item) => item.role === "validity_gate" && item.weightPercent === null));
  assert.ok(brief.considerations.some((item) => item.role === "context_only" && item.evidenceStatus === "connected"));
});

test("Marketing analysis brief uses validity and context considerations without a misleading score", () => {
  const plan = planEvaluation("Which comparable markets could support a valid marketing test?", "marketing");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.equal(analysisBriefWeightTotal(brief), 0);
  assert.ok(brief.considerations.every((item) => item.weightPercent === null));
  assert.ok(brief.considerations.some((item) => item.id === "media_isolation" && item.role === "validity_gate"));
});
