import assert from "node:assert/strict";
import test from "node:test";
import type { PublicMarketRecord } from "../lib/data/cbsa-market-context.ts";
import {
  executeEvaluationPlan,
  evaluationExecutionResultSchema,
  MARKET_CONTEXT_CALCULATION_VERSION,
  MARKET_CONTEXT_SNAPSHOT_VERSION,
} from "../lib/planning/execution.ts";
import { planEvaluation } from "../lib/planning/index.ts";

const markets = [
  {
    cbsa_code: "12420",
    cbsa_name: "Austin-Round Rock-Georgetown, TX",
    cbsa_type: "metropolitan",
    state_codes: ["TX"],
    principal_cities: [],
    component_counties: [],
    geometry_status: "available",
    acs: { metrics: { population_density: { metric_id: "census.population_density", raw_value: 120, unit: "people_per_square_mile", source_id: "SRC-016", observed_at: "2024-12-31", geography: "cbsa", quality_status: "accepted", evidence_status: "Derived", sensitivity: "public", allowed_use: "market_context_only", scoring_weight: "none", warning: null } } },
  },
  {
    cbsa_code: "19740",
    cbsa_name: "Denver-Aurora-Lakewood, CO",
    cbsa_type: "metropolitan",
    state_codes: ["CO"],
    principal_cities: [],
    component_counties: [],
    geometry_status: "available",
    acs: { metrics: { population_density: { metric_id: "census.population_density", raw_value: 80, unit: "people_per_square_mile", source_id: "SRC-016", observed_at: "2024-12-31", geography: "cbsa", quality_status: "accepted", evidence_status: "Derived", sensitivity: "public", allowed_use: "market_context_only", scoring_weight: "none", warning: null } } },
  },
] as unknown as PublicMarketRecord[];

test("executes a resolved public-market question deterministically", () => {
  const plan = planEvaluation("Compare Austin and Denver by population density.");
  const result = executeEvaluationPlan(plan, markets);
  evaluationExecutionResultSchema.parse(result);
  assert.equal(result.status, "complete");
  assert.equal(result.snapshotVersion, MARKET_CONTEXT_SNAPSHOT_VERSION);
  assert.equal(result.calculationVersion, MARKET_CONTEXT_CALCULATION_VERSION);
  assert.deepEqual(result.comparisons.map((item) => item.cbsaCode), ["12420", "19740"]);
  assert.equal(result.evidenceBundle.every((item) => item.sourceId === "SRC-016"), true);
  assert.equal(result.evidenceBundle.every((item) => item.allowedUse === "market_context_only"), true);
  assert.ok(result.contraryEvidence.length > 0);
});

test("does not execute a capability blocked by missing evidence", () => {
  const plan = planEvaluation("Why are operating clinics underperforming their peers?");
  const result = executeEvaluationPlan(plan, markets);
  assert.equal(result.status, "blocked");
  assert.equal(result.comparisons.length, 0);
  assert.equal(result.evidenceBundle.length, 0);
  assert.ok(result.missingEvidence.length > 0);
});

test("does not infer a requested measure when the plan has none", () => {
  const plan = planEvaluation("Describe the Austin market.");
  const result = executeEvaluationPlan(plan, markets);
  assert.equal(result.status, "blocked");
  assert.match(result.missingEvidence.join(" "), /observations/i);
});
