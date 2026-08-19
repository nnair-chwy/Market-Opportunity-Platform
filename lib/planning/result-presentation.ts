import type { EvaluationPlan } from "./contracts.ts";

export type FinalPresentationMode = "result_only" | "action_package";

const PRICING_ACTION = /\b(?:raise|lower|increase|decrease|change|set|adjust|recommend|test)\w*\b[^?.]{0,80}\b(?:price|pricing|promotion|discount)\w*\b|\b(?:price|pricing|promotion|discount)\w*\b[^?.]{0,80}\b(?:raise|lower|increase|decrease|change|set|adjust|recommend|test)\w*\b/i;
const MARKETING_ACTION = /\b(?:increase|decrease|shift|move|allocate|reallocate|change|recommend|launch|pause|test)\w*\b[^?.]{0,80}\b(?:spend|budget|campaign|paid[ -]?search|media)\w*\b|\b(?:spend|budget|campaign|paid[ -]?search|media)\w*\b[^?.]{0,80}\b(?:increase|decrease|shift|move|allocate|reallocate|change|recommend|launch|pause|test)\w*\b/i;
const CLINIC_ACTION = /\b(?:open|close|build|lease|approve|expand|relocate|prioriti[sz]e|recommend|test)\w*\b[^?.]{0,80}\b(?:clinic|site|footprint|market|trade area)\w*\b|\b(?:clinic|site|footprint|market|trade area)\w*\b[^?.]{0,80}\b(?:open|close|build|lease|approve|expand|relocate|prioriti[sz]e|recommend|test)\w*\b/i;
const GENERIC_HANDOFF = /\b(?:recommend(?:ation)?|proposed action|decision package|action plan|what should we do|next action)\b/i;

/**
 * Chooses the final UI from the user's requested output, not from the presence
 * of plan.actions (every plan has at least one bounded next step).
 */
export function resolveFinalPresentationMode(plan: EvaluationPlan): FinalPresentationMode {
  if (plan.answerContract.answerMode === "clarification") return "result_only";
  if (plan.intent.requestedAction === "approve") return "action_package";

  const question = plan.originalQuestion;
  const asksForMaterialAction = plan.perspectiveId === "pricing"
    ? PRICING_ACTION.test(question)
    : plan.perspectiveId === "marketing"
      ? MARKETING_ACTION.test(question)
      : CLINIC_ACTION.test(question);

  return asksForMaterialAction || GENERIC_HANDOFF.test(question)
    ? "action_package"
    : "result_only";
}

export function presentsActionPackage(plan: EvaluationPlan) {
  return resolveFinalPresentationMode(plan) === "action_package";
}
