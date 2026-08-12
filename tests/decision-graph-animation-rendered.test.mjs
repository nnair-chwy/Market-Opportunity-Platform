import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(
  new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url),
  "utf8",
);
const animation = fs.readFileSync(
  new URL("../components/decision-workflow/DecisionGraphAnimation.tsx", import.meta.url),
  "utf8",
);
const opening = fs.readFileSync(
  new URL("../components/decision-workflow/AdaptiveEvaluationWorkspace.tsx", import.meta.url),
  "utf8",
);
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("post-question flow uses mutually exclusive full-page phases", () => {
  assert.match(workflow, /isQuestionPage/);
  assert.match(workflow, /isAnimationPage/);
  assert.match(workflow, /isResultPage/);
  assert.match(workflow, /data-page-phase=\{pagePhase\}/);
  assert.match(workflow, /animation-page-layout/);
  assert.match(workflow, /result-page-layout/);
  assert.match(workflow, /className="animation-page"/);
  assert.match(workflow, /className="decision-content result-page"/);
  assert.doesNotMatch(workflow, /graph-workspace-layout/);
  assert.doesNotMatch(workflow, /workspace-map/);
  assert.doesNotMatch(workflow, /network-context-pins/);
});

test("decision graph mounts only on the animation page", () => {
  assert.match(workflow, /DecisionGraphAnimation/);
  assert.match(workflow, /workspace-decision-graph/);
  assert.match(workflow, /phase="running"/);
  assert.match(workflow, /activeStep=\{activeStep\}/);
  assert.match(workflow, /isAnimationPage \? \(/);
  assert.match(workflow, /isResultPage && plan && selectedAction/);
  assert.doesNotMatch(workflow, /isResultPage[\s\S]{0,200}DecisionGraphAnimation/);
  assert.doesNotMatch(workflow, /showDecisionGraph/);
  assert.doesNotMatch(workflow, /graphPhase/);
});

test("opening CTA launches the decision graph workflow", () => {
  assert.match(opening, /Run decision graph/);
});

test("animation reacts to workflow phase and active step without Mapbox", () => {
  assert.match(animation, /DecisionGraphAnimationProps/);
  assert.match(animation, /phase: DecisionGraphPhase/);
  assert.match(animation, /"running" \| "packet" \| "compare" \| "saved"/);
  assert.match(animation, /activeStep/);
  assert.match(animation, /selectedActionId/);
  assert.match(animation, /data-graph-phase=\{phase\}/);
  assert.match(animation, /data-active-step=\{activeStep\}/);
  assert.doesNotMatch(animation, /mapbox|Mapbox|reactflow|ReactFlow|@xyflow/i);
  assert.doesNotMatch(styles, /mapbox/i);
  assert.match(styles, /\.animation-page-layout/);
  assert.match(styles, /\.result-page-layout/);
});
