import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_QUESTIONS } from "../lib/demo/scenarios.ts";
import { planEvaluation } from "../lib/planning/planner.ts";
import { runMarketInvestigation } from "../lib/planning/market-investigation.ts";
import { restoreSavedInvestigation } from "../lib/planning/saved-packet-state.ts";

test("registered evidence plans reopen their stored investigation instead of discarding it", () => {
  const plan = planEvaluation(DEMO_QUESTIONS.marketContext);
  const stored = runMarketInvestigation(plan);
  const fallback = { ...stored, toolsRun: ["fallback should not replace saved state"] };

  assert.ok(plan.intent.selectedQueries.length > 0 || plan.planId.startsWith("plan-demo-"));
  assert.equal(restoreSavedInvestigation(plan, stored, fallback), stored);
});

test("registered evidence plans do not synthesize a replacement investigation when none was saved", () => {
  const plan = planEvaluation(DEMO_QUESTIONS.marketContext);
  const fallback = runMarketInvestigation(plan);

  assert.equal(restoreSavedInvestigation(plan, undefined, fallback), null);
});

test("legacy non-registered packets retain the deterministic fallback behavior", () => {
  const plan = planEvaluation("What clinic footprint patterns are worth investigating?", "cvc");
  const fallback = runMarketInvestigation(plan);

  assert.equal(restoreSavedInvestigation(plan, undefined, fallback), fallback);
});
