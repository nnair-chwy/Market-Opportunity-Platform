import assert from "node:assert/strict";
import test from "node:test";
import { planEvaluation } from "../lib/planning/planner.ts";
import { attachOutcomeReadinessGaps, loadFirstPartyOutcomeReadiness } from "../lib/data-discovery/readiness-service.ts";

test("adds relevant business-outcome readiness gaps to a paid-search decision plan", async () => {
  const report = await loadFirstPartyOutcomeReadiness();
  const original = planEvaluation("Where should we increase paid search spend?", "marketing");
  const plan = attachOutcomeReadinessGaps(original, report);
  const missing = plan.missingEvidence.join(" ");
  assert.match(missing, /regional orders/i);
  assert.match(missing, /new customers/i);
  assert.match(missing, /contribution or profit/i);
  assert.equal(plan.status, original.status);
  assert.deepEqual(plan.intent, original.intent);
});

test("keeps connected appointments while adding capacity and maturity gaps to a clinic decision plan", async () => {
  const report = await loadFirstPartyOutcomeReadiness();
  const original = planEvaluation("Which clinic markets have capacity to support more appointments?", "cvc");
  const plan = attachOutcomeReadinessGaps(original, report);
  const missing = plan.missingEvidence.join(" ");
  assert.match(missing, /clinic capacity/i);
  assert.doesNotMatch(missing, /No approved.*appointments contract/i);
  assert.match(missing, /mature-clinic performance/i);
  assert.equal(report.outcomes.find((outcome) => outcome.outcomeId === "appointments")?.status, "ready");
});

test("does not add business-outcome gaps to a public Census context question", async () => {
  const report = await loadFirstPartyOutcomeReadiness();
  const original = planEvaluation("What is the population of Phoenix?", "cvc");
  const plan = attachOutcomeReadinessGaps(original, report);
  assert.deepEqual(plan.missingEvidence, original.missingEvidence);
});
