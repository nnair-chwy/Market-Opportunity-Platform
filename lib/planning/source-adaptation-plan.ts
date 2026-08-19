import type { SourceAdaptationReadiness } from "../evidence-snapshot/contracts.ts";
import type { EvaluationPlan } from "./contracts.ts";

type UsedSource = Pick<SourceAdaptationReadiness["sources"][number], "decision" | "sourceIds" | "addressesRequirementIds">;

/**
 * Applies only reviewed sources actually used by execution to a copied answer
 * contract. Plan identity, question, intent, geography, actions, and evidence
 * boundaries remain unchanged. This helper is browser-safe and performs no I/O.
 */
export function applyUsedSourceAdaptation(plan: EvaluationPlan, sources: readonly UsedSource[]): EvaluationPlan {
  const byRequirement = new Map<string, string[]>();
  for (const source of sources) {
    if (source.decision !== "used") continue;
    for (const requirementId of source.addressesRequirementIds) {
      byRequirement.set(requirementId, [...new Set([...(byRequirement.get(requirementId) ?? []), ...source.sourceIds])]);
    }
  }
  if (!byRequirement.size) return plan;
  return {
    ...plan,
    answerContract: {
      ...plan.answerContract,
      domainRequirements: plan.answerContract.domainRequirements.map((requirement) => byRequirement.has(requirement.requirementId)
        ? {
            ...requirement,
            readiness: "connected" as const,
            sourceIds: [...new Set([...requirement.sourceIds, ...byRequirement.get(requirement.requirementId)!])],
          }
        : requirement),
    },
  };
}

export function effectivePlanForSourceAdaptation(
  plan: EvaluationPlan,
  adaptation: SourceAdaptationReadiness | null | undefined,
): EvaluationPlan {
  return adaptation ? applyUsedSourceAdaptation(plan, adaptation.sources) : plan;
}
