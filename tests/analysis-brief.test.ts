import assert from "node:assert/strict";
import test from "node:test";
import { analysisBriefWeightTotal, buildAnalysisBrief } from "../lib/planning/analysis-brief.ts";
import { runMarketInvestigation } from "../lib/planning/market-investigation.ts";
import { planEvaluation } from "../lib/planning/planner.ts";

test("CVC analysis brief exposes evidence gates and context without inventing weights", () => {
  const plan = planEvaluation("Which comparable markets differ most in clinic footprint and demand?", "cvc");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.equal(brief.originalQuestion, plan.originalQuestion);
  assert.match(brief.rewrittenQuestion, /metro footprint contrasts/i);
  assert.equal(analysisBriefWeightTotal(brief), 0);
  assert.ok(brief.considerations.every((item) => item.role !== "weighted_preference"));
  assert.ok(brief.considerations.some((item) => item.role === "validity_gate" && item.weightPercent === null));
  assert.ok(brief.considerations.some((item) => item.role === "context_only" && item.evidenceStatus === "connected"));
});

test("CVC location brief preserves the requested decision instead of replacing it with a footprint exercise", () => {
  const plan = planEvaluation("Where should we open a new clinic?", "cvc");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.match(brief.rewrittenQuestion, /which 3–5 U\.S\. metro areas/i);
  assert.match(brief.rewrittenQuestion, /candidates for the next CVC clinic/i);
  assert.match(brief.rewrittenQuestion, /before selecting a location/i);
});

test("Marketing analysis brief uses validity and context considerations without a misleading score", () => {
  const plan = planEvaluation("Which comparable markets could support a valid marketing test?", "marketing");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.equal(analysisBriefWeightTotal(brief), 0);
  assert.ok(brief.considerations.every((item) => item.weightPercent === null));
  assert.ok(brief.considerations.some((item) => item.id === "media_isolation" && item.role === "validity_gate"));
});
