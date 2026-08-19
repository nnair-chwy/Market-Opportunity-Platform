import { readFile } from "node:fs/promises";
import path from "node:path";
import checkedInReadiness from "../../data/contracts/first-party-outcome-readiness.json" with { type: "json" };
import type { EvaluationPlan } from "../planning/contracts.ts";
import { firstPartyOutcomeReadinessReportSchema, type FirstPartyOutcomeId, type FirstPartyOutcomeReadinessReport } from "./outcome-readiness.ts";

const READINESS_FILE = path.join("data", "contracts", "first-party-outcome-readiness.json");

/** Server-only fixed-path loader. Callers cannot supply a filesystem path. */
export async function loadFirstPartyOutcomeReadiness(workspaceRoot?: string) {
  if (!workspaceRoot) return firstPartyOutcomeReadinessReportSchema.parse(checkedInReadiness);
  const content = await readFile(path.resolve(workspaceRoot, READINESS_FILE), "utf8");
  return firstPartyOutcomeReadinessReportSchema.parse(JSON.parse(content));
}

function relevantOutcomes(plan: EvaluationPlan): FirstPartyOutcomeId[] {
  const question = plan.originalQuestion.toLowerCase();
  const marketingDecision = plan.perspectiveId === "marketing" && /spend|paid search|campaign|advertis|growth|conversion|customer|order|contribution/.test(question);
  const pricingDecision = plan.perspectiveId === "pricing" && /price|pricing|margin|profit|contribution|customer|order|sales/.test(question);
  const clinicDecision = plan.perspectiveId === "cvc" && (plan.intent.topic === "clinic_location" || plan.intent.topic === "clinic_performance" || /clinic|appointment|capacity|matur/.test(question));
  if (clinicDecision) return ["clinic_capacity", "appointments", "mature_clinic_performance"];
  if (marketingDecision || pricingDecision) return ["regional_orders", "new_customers", "contribution_profit"];
  return [];
}

export function attachOutcomeReadinessGaps(plan: EvaluationPlan, report: FirstPartyOutcomeReadinessReport): EvaluationPlan {
  const relevant = new Set(relevantOutcomes(plan));
  if (!relevant.size) return plan;
  const readinessGaps = report.outcomes
    .filter((outcome) => relevant.has(outcome.outcomeId) && outcome.status === "gap")
    .flatMap((outcome) => outcome.missingEvidence);
  if (!readinessGaps.length) return plan;
  return { ...plan, missingEvidence: [...new Set([...plan.missingEvidence, ...readinessGaps])] };
}

export function compactSourceReadiness(report: FirstPartyOutcomeReadinessReport) {
  return {
    version: report.version,
    contractVersion: report.contractVersion,
    generatedAt: report.generatedAt,
    outcomes: report.outcomes.map((outcome) => ({
      outcomeId: outcome.outcomeId,
      label: outcome.label,
      status: outcome.status,
      readySourceIds: outcome.readySourceIds,
      missingEvidence: outcome.missingEvidence,
    })),
    adapterCandidates: report.adapterCandidates,
    summary: report.summary,
    conclusionBoundary: report.conclusionBoundary,
  };
}

export type CompactSourceReadiness = ReturnType<typeof compactSourceReadiness>;
