import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspace = await readFile(new URL("../components/insight-discovery/AutonomousDiscoveryWorkspace.tsx", import.meta.url), "utf8");
const presentation = await readFile(new URL("../lib/insight-discovery/finding-presentation.ts", import.meta.url), "utf8");

test("department toggles change which findings lead the readout and scope its brief", () => {
  assert.match(workspace, /role="tablist" aria-label="Filter findings by department"/);
  assert.match(workspace, /All departments/);
  assert.match(workspace, /department === "cross" \? <CrossSourceFindings findings=\{adaptiveFindings\} onOpenInvestigation=\{openInAskAi\}/);
  assert.match(workspace, /buildTeamOpportunityBrief\(run, briefScope\)/);
  assert.match(workspace, /Shareable opportunity brief/);
  assert.match(workspace, /deliveryMode && teamOpportunityBrief/);
  assert.match(workspace, /Choose brief audience/);
});

test("baseline, cross-functional, and AI-led discovery are visibly distinct", () => {
  assert.match(workspace, /Ranked portfolio findings/);
  assert.match(workspace, /Cross-department/);
  assert.doesNotMatch(workspace, /The blue cards are the strongest supported findings/);
  assert.match(workspace, /Cross-functional opportunities/);
  assert.match(workspace, /Every finding here combines evidence owned by more than one team/);
  assert.match(workspace, /New patterns found beyond the repeatable scan/);
  assert.match(workspace, /AI analysis attempts/);
  assert.match(workspace, /not stakeholder recommendations/i);
  assert.match(workspace, /promoted into the findings above only when it returns a traceable result/);
});

test("AI findings have their own portfolio filter and preserve the hybrid evidence boundary", () => {
  assert.match(workspace, /type DiscoveryScope = "all" \| "cross" \| "ai" \| PerspectiveId/);
  assert.match(workspace, /AI findings <span>\{promotedAiFindings\.length\}<\/span>/);
  assert.match(workspace, /department === "ai" \? \(/);
  assert.match(workspace, /AI proposed each investigation and interpreted the result/);
  assert.match(workspace, /The numbers shown here come from an executed analysis/);
  assert.match(workspace, /Validated result/);
  assert.match(workspace, /Question to investigate next/);
});

test("Ask AI exposes exact finding context and no longer defaults to the first result", () => {
  assert.match(workspace, /Analysis that opened this finding/);
  assert.match(workspace, /Finding \{followUpTarget\.insightId\}/);
  assert.doesNotMatch(workspace, /followUpFinding \?\? primaryFindings\[0\]/);
  assert.match(workspace, /Explain this finding/);
  assert.match(workspace, /Run a new analysis/);
  assert.match(workspace, /\/api\/ai\/insights/);
  assert.match(workspace, /This does not rerun the investigation/);
});

test("AI supplemental discoveries can open an evidence-bound explanation", () => {
  assert.match(workspace, /function supplementalInvestigationContext/);
  assert.match(workspace, /Ask AI about this finding →/);
  assert.match(workspace, /onOpenInvestigation\(supplementalInvestigationContext\(finding\)\)/);
});

test("percentile notation is explained without implying significance", () => {
  assert.match(workspace, /How to read P81, P1, and other percentiles/);
  assert.match(workspace, /relative position, not statistical significance or certainty/);
});

test("every cross-functional finding can carry its exact evidence into Ask AI", () => {
  assert.match(workspace, /function adaptiveInvestigationContext/);
  assert.match(workspace, /originatingQuestion: finding\.question/);
  assert.match(workspace, /sourceIds: finding\.sourceIds/);
  assert.match(workspace, /onOpenInvestigation\(adaptiveInvestigationContext\(finding\)\)/);
  assert.match(workspace, /Open in Ask AI →/);
});

test("the repeated validation badge is removed", () => {
  assert.doesNotMatch(presentation, /Validate before acting/);
  assert.match(presentation, /Needs outcome sizing/);
});
