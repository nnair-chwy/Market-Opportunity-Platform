import assert from "node:assert/strict";
import test from "node:test";
import { compileCurrentStage, proposeDecisionGraphPrototype, validateDecisionGraph } from "../lib/evaluation/index.ts";

test("broad clinic-opening question decomposes into market, submarket, site, and human approval stages",()=>{
  const graph=proposeDecisionGraphPrototype("What are the best places for Chewy to open a new clinic?");
  const validation=validateDecisionGraph(graph);
  assert.equal(validation.valid,true,validation.issues.join("\n"));
  assert.deepEqual(graph.stages.map((stage)=>stage.stageId),["national-market-screening","submarket-comparison","candidate-site-diligence","investment-approval"]);
  assert.deepEqual(graph.stages.map((stage)=>stage.capabilityStatus),["partially_executable","executable","needs_evidence","human_only"]);
  assert.equal(graph.currentStageId,"national-market-screening");
  assert.equal(compileCurrentStage(graph).compiledEvaluationDefinitionId,null);
  assert.equal(graph.stages[1].compiledEvaluationDefinitionId,"eval-seattle-area-diligence");
});

test("clinic performance question remains one recurring peer-evaluation stage",()=>{
  const graph=proposeDecisionGraphPrototype("Which comparable clinics require performance review?");
  const validation=validateDecisionGraph(graph);
  assert.equal(validation.valid,true,validation.issues.join("\n"));
  assert.equal(graph.questionClassifications.includes("comparative"),true);
  assert.equal(graph.stages.length,1);
  assert.equal(graph.stages[0].entityType,"Aggregate clinic-period");
  assert.equal(compileCurrentStage(graph).compiledEvaluationDefinitionId,"eval-clinic-performance-review");
});

test("city advertising question runs a proxy market screen without claiming ad lift",()=>{
  const graph=proposeDecisionGraphPrototype("Which comparable cities can benefit from ads?");
  const validation=validateDecisionGraph(graph);
  assert.equal(validation.valid,true,validation.issues.join("\n"));
  assert.equal(graph.graphId,"graph-market-ad-opportunity");
  assert.equal(graph.stages.length,1);
  assert.equal(graph.stages[0].entityType,"U.S. Census market");
  assert.equal(graph.stages[0].capabilityStatus,"partially_executable");
  assert.match(graph.stages[0].capabilityExplanation,/Census context layer can run now/i);
  assert.match(graph.stages[0].decisionBoundary,/cannot rank campaign opportunity/i);
});

test("Get Real promotion question requests brand-awareness evidence",()=>{
  const graph=proposeDecisionGraphPrototype("What are best places for Chewy to launch dog food promotion campaign to raise Get Real brand awareness?");
  assert.equal(graph.graphId,"graph-market-ad-opportunity");
  assert.match(graph.ultimateDecision,/Get Real brand-awareness/i);
  assert.match(graph.stages[0].unresolvedRequirements.join(" "),/baseline aided and unaided awareness/i);
  assert.match(graph.stages[0].decisionBoundary,/cannot rank campaign opportunity/i);
});

test("cat food promotion does not inherit Get Real awareness semantics",()=>{
  const graph=proposeDecisionGraphPrototype("What are best places for Chewy to launch cat food promotion campaign?");
  assert.equal(graph.graphId,"graph-market-ad-opportunity");
  assert.doesNotMatch(graph.ultimateDecision,/Get Real|awareness/i);
  assert.doesNotMatch(graph.stages[0].capabilityExplanation,/baseline awareness/i);
});

test("graph validation rejects executable stages with invented capabilities",()=>{
  const graph=proposeDecisionGraphPrototype("Which comparable clinics require performance review?");
  const invalid={...graph,stages:graph.stages.map((stage)=>({...stage,requiredSourceIds:["INVENTED-SOURCE"],requiredOperatorIds:["invented_operator"]}))};
  const validation=validateDecisionGraph(invalid);
  assert.equal(validation.valid,false);
  assert.ok(validation.issues.some((issue)=>issue.includes("unknown sources")));
  assert.ok(validation.issues.some((issue)=>issue.includes("unknown operators")));
});
