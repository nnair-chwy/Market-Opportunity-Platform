import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspace = fs.readFileSync(new URL("../components/insight-discovery/AutonomousDiscoveryWorkspace.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("discovery results lead with a concise decision brief and an explicit inference boundary", () => {
  assert.match(workspace, /Decision brief/);
  assert.match(workspace, /primaryFindings\.map\(\(finding/);
  assert.match(workspace, /label: "Start here"/);
  assert.match(workspace, /label: "Why it leads"/);
  assert.match(workspace, /label: "Next opportunity"/);
  assert.match(workspace, /label: "Do not over-read"/);
  assert.match(workspace, /presentation\.analystRecommendation/);
  assert.match(workspace, /Observed differences and peer-relative patterns/);
  assert.match(workspace, /Statistical significance/);
  assert.match(workspace, /Not tested/);
  assert.match(workspace, /sample sizes, variance, confidence intervals, or experimental design/);
});

test("team views rank their own five strongest findings and retain the analysis behind each decision question", () => {
  assert.match(workspace, /run\.findings\.filter\(\(finding\) => finding\.department === department\)/);
  assert.match(workspace, /right\.importance\.score - left\.importance\.score/);
  assert.match(workspace, /\.slice\(0, 5\)/);
  assert.match(workspace, /Decision question/);
  assert.match(workspace, /Analysis tested/);
});

test("the AI expansion exposes its iterative execution trail even when no extra finding is promoted", () => {
  assert.match(workspace, /AI investigation loop/);
  assert.match(workspace, /hybridReceipts\.map/);
  assert.match(workspace, /No additional AI analysis has completed/);
  assert.match(workspace, /normalizedSnapshotVersion: NORMALIZED_DISCOVERY_SNAPSHOT/);
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
