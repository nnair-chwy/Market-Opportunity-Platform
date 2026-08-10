import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const component=fs.readFileSync(new URL("../components/evaluation-workspace/EvaluationWorkspace.tsx",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");

test("one workspace renders both demos through shared components",()=>{
  assert.match(page,/EvaluationWorkspace/);assert.doesNotMatch(page,/SeattleMarketDeepDive|CandidateReviewAgent/);
  assert.match(component,/View full evaluation contract/);assert.match(component,/Evaluation plan/);assert.match(component,/Attractiveness by submarket/);assert.match(component,/Decide what moves forward/);
  for(const cue of ["1 · Look","2 · Select an area","3 · Inspect the selection","4 · Decide what moves forward"])assert.match(component,new RegExp(cue));
  assert.match(component,/className=\{styles.auditLayer\}/);
});

test("map and entity list share one selected entity state",()=>{
  assert.match(component,/ZoneMap payload=\{map\} rows=\{rows\} selectedId=\{selected.entityId\} colorField=\{colorField\} hoveredId=\{hoveredId\}/);
  assert.match(component,/onHover=\{setHoveredId\}/);
  assert.match(component,/onClick=\{\(\)=>onSelect\(row.entityId\)\}/);
  assert.match(component,/selected\?\.entityId===row.entityId/);
  assert.match(component,/onClick=\{\(\)=>setColorField\(item.id\)\}/);
});

test("visible steps include operational rationale without chain-of-thought",()=>{
  for(const label of ["Input","Operator","Output","Evidence","Needs attention"])assert.match(component,new RegExp(label));
  assert.doesNotMatch(component,/chain.of.thought|internal reasoning/i);
});

test("public market questions route to the shared map instead of needs-evidence",()=>{
  assert.match(component,/\['public_market_context','campaign_opportunity','market_attractiveness'\]\.includes/);
});
