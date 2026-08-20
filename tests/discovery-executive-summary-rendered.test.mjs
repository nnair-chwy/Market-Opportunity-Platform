import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspace = fs.readFileSync(new URL("../components/insight-discovery/AutonomousDiscoveryWorkspace.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("discovery results lead with every priority takeaway and an explicit inference boundary", () => {
  assert.ok(workspace.indexOf("What this run found") < workspace.indexOf("Analyses completed"));
  assert.match(workspace, /primaryFindings\.map\(\(finding\)/);
  assert.match(workspace, /presentation\.analystRecommendation/);
  assert.match(workspace, /Observed differences and peer-relative patterns/);
  assert.match(workspace, /Statistical significance/);
  assert.match(workspace, /Not tested/);
  assert.match(workspace, /sample sizes, variance, confidence intervals, or experimental design/);
});

test("the decision summary remains readable on narrow screens", () => {
  assert.match(styles, /\.discovery-key-takeaways li[^}]*grid-template-columns:/);
  assert.match(styles, /\.discovery-inference-boundary[^}]*grid-template-columns:\s*1fr 1fr/);
  assert.match(styles, /\.discovery-key-takeaways li, \.discovery-inference-boundary\s*\{\s*grid-template-columns:\s*1fr/);
});
