import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalysisPlanRequest, resolveAnalysisPlanReviewAction } from "../lib/planning/analysis-plan-review.ts";

test("a changed question can update a blocked analysis plan", () => {
  assert.deepEqual(resolveAnalysisPlanReviewAction({
    questionChanged: true,
    hasQuestion: true,
    weightsValid: false,
    canRun: false,
  }), {
    mode: "update_plan",
    label: "Update analysis plan",
    disabled: false,
  });
});

test("an unchanged blocked plan cannot run", () => {
  const action = resolveAnalysisPlanReviewAction({
    questionChanged: false,
    hasQuestion: true,
    weightsValid: true,
    canRun: false,
  });
  assert.equal(action.mode, "confirm_and_run");
  assert.equal(action.disabled, true);
});

test("replanning preserves perspective, view, and selected geography", () => {
  assert.deepEqual(buildAnalysisPlanRequest({
    question: "  Compare the selected markets  ",
    perspectiveId: "marketing",
    activeViewId: "paid_search_response",
    selectedCbsaCodes: ["37980", "41700"],
  }), {
    question: "Compare the selected markets",
    perspectiveId: "marketing",
    activeViewId: "paid_search_response",
    selectedCbsaCodes: ["37980", "41700"],
  });
});
