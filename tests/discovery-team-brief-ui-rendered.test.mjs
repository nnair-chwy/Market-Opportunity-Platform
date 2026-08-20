import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspace = await readFile(new URL("../components/insight-discovery/AutonomousDiscoveryWorkspace.tsx", import.meta.url), "utf8");
const presentation = await readFile(new URL("../lib/insight-discovery/finding-presentation.ts", import.meta.url), "utf8");

test("discovery chooses one team before generating its scoped brief", () => {
  assert.match(workspace, /Choose the team this readout is for/);
  assert.match(workspace, /<select value=\{department\}/);
  assert.match(workspace, /buildTeamOpportunityBrief\(run, department\)/);
  assert.match(workspace, /Download \$\{department === "all" \? "portfolio" : LABELS\[department\]\} brief/);
});

test("baseline, cross-functional, and AI-led discovery are visibly distinct", () => {
  assert.match(workspace, /Ranked baseline findings/);
  assert.match(workspace, /The blue cards are the strongest supported findings/);
  assert.match(workspace, /Cross-functional opportunities/);
  assert.match(workspace, /The green section combines evidence owned by more than one team/);
  assert.match(workspace, /AI additional discovery/);
  assert.match(workspace, /Only successfully executed, traceable analysis appears here/);
});

test("Ask AI exposes exact finding context and no longer defaults to the first result", () => {
  assert.match(workspace, /Question that opened this finding/);
  assert.match(workspace, /Finding \{followUpTarget\.insightId\}/);
  assert.doesNotMatch(workspace, /followUpFinding \?\? primaryFindings\[0\]/);
  assert.match(workspace, /disabled=\{!followUpQuestion\.trim\(\) \|\| !followUpFinding\}/);
});

test("the repeated validation badge is removed", () => {
  assert.doesNotMatch(presentation, /Validate before acting/);
  assert.match(presentation, /Needs outcome sizing/);
});
