import assert from "node:assert/strict";
import test from "node:test";
import {
  geographicArtifactSchema,
  marketSelectionNeedsEvidenceRun,
  planAnalysisPrototype,
  publicMarketGeographicArtifact,
  statePetGeographicArtifact,
} from "../lib/evaluation/index.ts";

test("one public artifact drives map scores, ranking values, selection, and evidence receipt", () => {
  const plan = planAnalysisPrototype("Compare median income across cities");
  const artifact = publicMarketGeographicArtifact(plan, "market_income");
  assert.equal(geographicArtifactSchema.safeParse(artifact).success, true);
  assert.equal(artifact.measure.id, "market_income");
  assert.equal(artifact.rows[0].rank, 1);
  assert.equal(artifact.rows[0].score, 100);
  assert.equal(artifact.defaultSelectedEntityId, artifact.rows[0].entityId);
  assert.match(artifact.measure.observedPeriod, /2020–2024 ACS/);
  assert.match(artifact.measure.limitation, /willingness to pay/i);
});

test("question and measure identity prevent stale geographic artifacts", () => {
  const populationPlan = planAnalysisPrototype("Compare population across U.S. markets");
  const incomePlan = planAnalysisPrototype("Compare income across U.S. markets");
  const population = publicMarketGeographicArtifact(populationPlan, "market_population");
  const income = publicMarketGeographicArtifact(incomePlan, "market_income");
  assert.notEqual(population.artifactId, income.artifactId);
  assert.notEqual(population.measure.id, income.measure.id);
  assert.notEqual(population.rows[0].displayValue, income.rows[0].displayValue);
});

test("dog, cat, and crossover questions use the same state artifact schema without imputation", () => {
  const dogPlan = planAnalysisPrototype("Show dog ownership across the country");
  const catPlan = planAnalysisPrototype("Show cat ownership across the country");
  const crossoverPlan = planAnalysisPrototype("Compare dog owners x willingness to pay across states");
  const dog = statePetGeographicArtifact(dogPlan, "dog");
  const cat = statePetGeographicArtifact(catPlan, "cat");
  const crossover = statePetGeographicArtifact(crossoverPlan, "dogIncome");
  assert.equal(dog.schemaVersion, cat.schemaVersion);
  assert.equal(cat.schemaVersion, crossover.schemaVersion);
  assert.notEqual(dog.artifactId, cat.artifactId);
  assert.equal(dog.rows.find((row) => row.attributes.stateCode === "AK")?.rawValue, null);
  assert.equal(crossover.rows.find((row) => row.attributes.stateCode === "AK")?.score, null);
  assert.equal(cat.rows[0].entityLabel, "Vermont");
});

test("public evaluation run persists the exact geographic artifact before an evidence stop", () => {
  const run = marketSelectionNeedsEvidenceRun("What are the best places for Chewy to open a new clinic?");
  const artifact = run.artifacts.find((item) => item.type === "geographic_layer");
  const warning = run.artifacts.find((item) => item.type === "warning");
  assert.ok(artifact);
  assert.ok(warning);
  assert.equal(geographicArtifactSchema.safeParse(artifact.payload).success, true);
  assert.equal(run.status, "needs_evidence");
});
