import type { EvaluationPlan } from "./contracts.ts";
import type { MarketInvestigation } from "./market-investigation.ts";

function isRegisteredEvidencePlan(plan: EvaluationPlan) {
  return plan.planId.startsWith("plan-demo-") || plan.intent.selectedQueries.length > 0;
}

export function restoreSavedInvestigation(
  plan: EvaluationPlan,
  storedInvestigation: MarketInvestigation | undefined,
  fallbackInvestigation: MarketInvestigation,
): MarketInvestigation | null {
  if (
    storedInvestigation
    && storedInvestigation.planId === plan.planId
    && storedInvestigation.originalQuestion === plan.originalQuestion
  ) {
    return storedInvestigation;
  }

  return isRegisteredEvidencePlan(plan) ? null : fallbackInvestigation;
}
