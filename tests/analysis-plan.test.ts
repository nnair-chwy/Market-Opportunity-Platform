import assert from "node:assert/strict";
import test from "node:test";
import { compileAnalysisIntent, inferAnalysisIntent, planAnalysisPrototype, proposeDecisionGraphPrototype } from "../lib/evaluation/index.ts";

test("planner composes dog ownership and income without a dedicated question route",()=>{
  const plan=planAnalysisPrototype("Show where strong dog ownership overlaps with household income nationwide");
  assert.equal(plan.analysisType,"state_pet_ownership");
  assert.equal(plan.activeMeasure,"dog_income_proxy");
  assert.match(plan.evidenceBoundary,/not measured willingness to pay/i);
});

test("planner separates cat promotion from cat ownership",()=>{
  const plan=planAnalysisPrototype("Where should a cat food promotion run across comparable markets?");
  assert.equal(plan.analysisType,"campaign_opportunity");
  assert.equal(plan.activeMeasure,"market_population");
  assert.equal(plan.intent.animal,"cat");
  assert.equal(plan.intent.requestedMeasures.includes("cat_ownership"),false);
});

test("planner selects a declarative public Census layer from the question",()=>{
  const plan=planAnalysisPrototype("Which U.S. markets have the highest population density?");
  assert.equal(plan.analysisType,"public_market_context");
  assert.equal(plan.activeMeasure,"market_density");
  assert.equal(plan.status,"executable");
  assert.match(plan.evidenceBoundary,/Census/i);
});

test("compiler rejects model-proposed cat ownership at an incompatible campaign grain",()=>{
  const intent=inferAnalysisIntent("Where should a cat food promotion run across comparable markets?");
  const plan=compileAnalysisIntent("Where should a cat food promotion run across comparable markets?",{...intent,topic:"marketing",entityGrain:"cbsa_market",requestedMeasures:["cat_ownership","chewy_demand","chewy_engagement"],conciseInterpretation:"Use cat ownership to choose campaign markets."},"ai_proposed");
  assert.doesNotMatch(plan.interpretation,/use cat ownership/i);
  assert.match(plan.missingMeasures.join(" "),/cat ownership at compatible CBSA grain/i);
  assert.equal(plan.availableMeasures.includes("Cat ownership"),false);
});

test("AI-shaped intent is validated and compiled to the same deterministic campaign capability",()=>{
  const intent=inferAnalysisIntent("Where should Get Real build awareness?");
  const plan=compileAnalysisIntent("Where should Get Real build awareness?",{...intent,topic:"marketing",entityGrain:"cbsa_market",requestedMeasures:["brand_awareness","chewy_demand","market_capacity","chewy_engagement"],requestedAction:"screen",namedBrand:"Get Real",conciseInterpretation:"Screen comparable markets for a Get Real awareness measurement plan."},"ai_proposed");
  assert.equal(plan.proposalMethod,"ai_proposed");
  assert.equal(plan.analysisType,"campaign_opportunity");
  assert.match(plan.missingMeasures.join(" "),/aided and unaided awareness/i);
  const graph=proposeDecisionGraphPrototype(plan.originalQuestion,plan);
  assert.equal(graph.proposalMethod,"ai_proposed");
  assert.equal(graph.graphId,"graph-market-ad-opportunity");
});

test("unsupported intent stops instead of inventing an evaluation",()=>{
  const plan=planAnalysisPrototype("How should Chewy change prices next week?");
  assert.equal(plan.status,"needs_evidence");
  assert.equal(plan.visualization,"needs_evidence");
});
