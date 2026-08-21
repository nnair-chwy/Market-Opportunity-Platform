import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspace = fs.readFileSync(new URL("../components/insight-discovery/AutonomousDiscoveryWorkspace.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("discovery results lead with every priority takeaway and an explicit inference boundary", () => {
  assert.ok(workspace.indexOf("Decision takeaways") < workspace.indexOf("Analyses completed"));
  assert.match(workspace, /primaryFindings\.map\(\(finding\)/);
  assert.match(workspace, /finding: finding\.headline/);
  assert.match(workspace, /<b>Decision:<\/b>/);
  assert.match(workspace, /presentation\.analystRecommendation/);
  assert.match(workspace, /Observed differences and peer-relative patterns/);
  assert.match(workspace, /Statistical significance/);
  assert.match(workspace, /Not tested/);
  assert.match(workspace, /sample sizes, variance, confidence intervals, or experimental design/);
});

test("the portfolio count and AI result status use honest comparable definitions", () => {
  assert.match(workspace, /const allFindingCount = run\?\.findings\.length \?\? 0/);
  assert.match(workspace, /All departments <span>\{allFindingCount\}<\/span>/);
  assert.match(workspace, /No additional AI finding was produced in this run/);
  assert.match(workspace, /none cleared the finding bar/);
  assert.match(workspace, /new AI finding/);
  assert.match(workspace, /Review analysis record/);
});

test("the decision summary remains readable on narrow screens", () => {
  assert.match(styles, /\.discovery-key-takeaways li[^}]*grid-template-columns:/);
  assert.match(styles, /\.discovery-inference-boundary[^}]*grid-template-columns:\s*1fr 1fr/);
  assert.match(styles, /\.discovery-key-takeaways li, \.discovery-inference-boundary\s*\{\s*grid-template-columns:\s*1fr/);
});
