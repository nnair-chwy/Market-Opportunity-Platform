import assert from "node:assert/strict";
import test from "node:test";
import { CLINIC_PERFORMANCE_DEFINITION, DEMAND_COVERAGE_GAP_TEST_DEFINITION, EVALUATION_DATA_CATALOG, SITE_DILIGENCE_DEFINITION, VERIFIED_EVALUATION_LIBRARY, evaluationDefinitionSchema } from "../lib/evaluation/index.ts";

test("both demos use the same complete evaluation definition contract",()=>{
  for(const definition of [SITE_DILIGENCE_DEFINITION,CLINIC_PERFORMANCE_DEFINITION]){
    assert.deepEqual(evaluationDefinitionSchema.parse(definition),definition);
    assert.deepEqual(definition.requiredHumanGates,["approve_definition","resolve_evidence","approve_action"]);
    assert.ok(definition.operatorPlan.length>0);
    assert.ok(definition.metrics.every((metric)=>metric.formula&&metric.inputFields.length&&metric.sourceIds.length));
  }
});

test("catalog exposes only real prototype capabilities and restrictions",()=>{
  assert.deepEqual(EVALUATION_DATA_CATALOG.map((entry)=>entry.sourceId).sort(),["SRC-002","SRC-014","SRC-015","SRC-016","SRC-017","SYN-DEMAND-COVERAGE-TEST-001","SYN-MARKET-ATTRACTIVENESS-001","SYN-SEATTLE-SUBMARKET-001"].sort());
  assert.equal(EVALUATION_DATA_CATALOG.find((entry)=>entry.sourceId==="SRC-017")?.allowedUse,"internal_demo_evidence_only");
  assert.equal(EVALUATION_DATA_CATALOG.some((entry)=>entry.name.includes("Snowflake")),false);
});

test("verified library binds questions to versioned definitions and fixture expectations",()=>{
  assert.equal(VERIFIED_EVALUATION_LIBRARY.length,3);
  assert.ok(VERIFIED_EVALUATION_LIBRARY.every((entry)=>entry.verificationStatus==="prototype_test_verified"));
  assert.equal(VERIFIED_EVALUATION_LIBRARY.find((entry)=>entry.definitionId===DEMAND_COVERAGE_GAP_TEST_DEFINITION.evaluationId)?.expectedFixtureResult.includes("market-b"),true);
});
