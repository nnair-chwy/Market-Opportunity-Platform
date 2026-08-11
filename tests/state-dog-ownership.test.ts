import assert from "node:assert/strict";
import test from "node:test";
import { stateDogOwnership } from "../lib/data/state-dog-ownership.ts";
import { proposeDecisionGraphPrototype, validateDecisionGraph } from "../lib/evaluation/decision-graph.ts";

test("nationwide dog-owner question produces a distinct executable visual stage", () => {
  const graph = proposeDecisionGraphPrototype("Which state has the most dog owners, and show the dog owner score across the country?");
  assert.equal(graph.graphId, "graph-state-pet-ownership");
  assert.equal(graph.stages.length, 1);
  assert.equal(graph.stages[0].entityType, "U.S. state");
  assert.match(graph.stages[0].output, /choropleth/i);
  assert.equal(validateDecisionGraph(graph).valid, true);
});

test("cat ownership and dog-income crossover reuse the same state comparison graph", () => {
  const cat = proposeDecisionGraphPrototype("Show cat ownership across the country");
  const crossover = proposeDecisionGraphPrototype("Compare dog owners x willingness to pay across states");
  assert.equal(cat.graphId, "graph-state-pet-ownership");
  assert.equal(crossover.graphId, "graph-state-pet-ownership");
  assert.match(cat.ultimateDecision, /cat-owning/i);
  assert.match(crossover.stages[0].capabilityExplanation, /ability-to-pay proxy/i);
  assert.match(crossover.stages[0].unresolvedRequirements[0], /willingness-to-pay/i);
});

test("state fixture covers every state and DC without imputing absent estimates", () => {
  assert.equal(stateDogOwnership.length, 51);
  assert.equal(new Set(stateDogOwnership.map((item) => item.fips)).size, 51);
  assert.equal(stateDogOwnership.find((item) => item.code === "ID")?.relativeScore, 100);
  assert.equal(stateDogOwnership.find((item) => item.code === "AK")?.householdRate, null);
  assert.equal(stateDogOwnership.find((item) => item.code === "HI")?.relativeScore, null);
  assert.equal(stateDogOwnership.find((item) => item.code === "VT")?.catRelativeScore, 100);
  assert.equal(stateDogOwnership.find((item) => item.code === "CA")?.medianHouseholdIncome, 99122);
  assert.equal(stateDogOwnership.find((item) => item.code === "AK")?.dogIncomeProxyScore, null);
});
