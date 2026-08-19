import type { PerspectiveId, PerspectiveViewId } from "../perspectives/index.ts";

export type AnalysisPlanReviewAction = {
  mode: "update_plan" | "confirm_and_run";
  label: "Update analysis plan" | "Confirm and run analysis";
  disabled: boolean;
};

export function resolveAnalysisPlanReviewAction(input: {
  questionChanged: boolean;
  hasQuestion: boolean;
  weightsValid: boolean;
  canRun: boolean;
}): AnalysisPlanReviewAction {
  if (input.questionChanged) {
    return {
      mode: "update_plan",
      label: "Update analysis plan",
      disabled: !input.hasQuestion,
    };
  }
  return {
    mode: "confirm_and_run",
    label: "Confirm and run analysis",
    disabled: !input.canRun || !input.weightsValid || !input.hasQuestion,
  };
}

export function buildAnalysisPlanRequest(input: {
  question: string;
  perspectiveId?: PerspectiveId;
  activeViewId?: PerspectiveViewId;
  selectedCbsaCodes?: readonly string[];
}) {
  return {
    question: input.question.trim(),
    selectedCbsaCodes: [...(input.selectedCbsaCodes ?? [])],
    ...(input.perspectiveId ? { perspectiveId: input.perspectiveId } : {}),
    ...(input.activeViewId ? { activeViewId: input.activeViewId } : {}),
  };
}
