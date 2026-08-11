import assert from "node:assert/strict";
import test from "node:test";
import { CLINIC_PERFORMANCE_DEFINITION, DEMAND_COVERAGE_GAP_TEST_DEFINITION, SITE_DILIGENCE_DEFINITION, executeEvaluation, marketSelectionNeedsEvidenceRun, needsEvidenceRun, planEvaluation, recordHumanResponse } from "../lib/evaluation/index.ts";

test("both definitions produce the same generic ten-step protocol and approval gate",()=>{
  const site=planEvaluation(SITE_DILIGENCE_DEFINITION);const clinic=planEvaluation(CLINIC_PERFORMANCE_DEFINITION);
  assert.deepEqual(site.steps.map((step)=>step.id),clinic.steps.map((step)=>step.id));
  assert.equal(site.steps.length,10);assert.equal(site.status,"definition_review");assert.equal(site.steps[4].status,"waiting");
});

test("unsupported question stops in a structured needs-evidence state",()=>{
  const run=needsEvidenceRun("How should Chewy change dog-food prices by region?");
  assert.equal(run.status,"needs_evidence");assert.equal(run.actionPacket,null);assert.equal(run.steps.some((step)=>step.name==="Execute evaluation"&&step.status==="pending"),true);assert.ok(run.blockers.some((blocker)=>blocker.includes("absent")));
});

test("advertising question executes public context before requesting lift data",()=>{
  const run=marketSelectionNeedsEvidenceRun("Which comparable cities can benefit from ads?");
  assert.equal(run.steps.find((step)=>step.name==="Match required evidence")?.status,"completed");
  assert.match(run.steps.find((step)=>step.name==="Match required evidence")?.outputSummary??"",/Confirmed Census.*context matched and rendered/i);
  assert.ok(run.sourceSnapshotVersions.includes("cbsa-acs-2024"));
  const payload=run.artifacts[0].payload as {humanInputNeeded:string};
  assert.match(payload.humanInputNeeded,/governed aggregate view.*CBSA.*DMA.*state.*ZIP/i);
});

test("a third evaluation is added as data without changing core orchestration",()=>{
  const rows=[
    {entityId:"market-a",entityLabel:"Market A",values:{demand:75,coverage:60,gap:15},metadata:{}},
    {entityId:"market-b",entityLabel:"Market B",values:{demand:82,coverage:50,gap:32},metadata:{}},
    {entityId:"market-c",entityLabel:"Market C",values:{demand:70,coverage:63,gap:7},metadata:{}},
  ];
  const first=executeEvaluation(DEMAND_COVERAGE_GAP_TEST_DEFINITION,rows);const second=executeEvaluation(DEMAND_COVERAGE_GAP_TEST_DEFINITION,rows);
  assert.equal(first.actionPacket?.entityId,"market-b");assert.equal(first.reproducibilityKey,second.reproducibilityKey);assert.equal(first.steps.length,10);
});

test("structured human responses are retained without modifying evidence artifacts",()=>{
  const run=planEvaluation(SITE_DILIGENCE_DEFINITION);const next=recordHumanResponse(run,{gateType:"approve_definition",choice:"approve",rationale:"Approved as a synthetic run-local choice only.",respondedAt:"2026-08-06T20:00:00.000Z",scope:"process_local_run"});
  assert.equal(next.humanResponses.length,1);assert.deepEqual(next.artifacts,run.artifacts);assert.deepEqual(next.sourceSnapshotVersions,run.sourceSnapshotVersions);
});
