import type { EvidenceExecutionResponse } from "../evidence-snapshot/contracts.ts";
import type { PlannedAction } from "./contracts.ts";

export type EvidenceBundleViewModel = {
  statusLabel: string;
  headline: string;
  reliability: string;
  nextAction: string;
};

export function buildEvidenceBundleView(result: EvidenceExecutionResponse, action?: PlannedAction): EvidenceBundleViewModel {
  const statusLabel = result.status === "complete" ? "Answer available"
    : result.status === "partial" ? "Answer available with limits"
      : result.status === "blocked" ? "Blocked by evidence gate"
        : "Execution failed";
  let headline = "The registered workflow did not return usable evidence.";
  if (result.query === "market_context_bundle") {
    headline = `${result.evidenceBundle.length} descriptive evidence items are available for ${result.geographyIds[0] ?? "the resolved market"}; missing sources remain explicit.`;
  } else if (result.query === "clinic_performance_bundle") {
    const selected = result.rows.find((row) => row.selected === true);
    headline = selected
      ? `${String(selected.clinicName)} ranks ${String(selected.rank)} of ${result.rows.length} on ${String(selected.metricId).replaceAll("_", " ")} in the synthetic demo cohort.`
      : "The configured clinic comparison did not return the selected clinic.";
  } else if (result.query === "growth_test_bundle") {
    headline = "Phoenix has measurable descriptive regional signals, while advertising geography, causal measurement, and launch approvals remain unresolved.";
  } else if (result.query === "clinic_site_evidence_bundle") {
    headline = "Clinic-site evidence remains inside the registered query boundary and does not produce a final site decision.";
  }
  const reliability = result.executionMode === "synthetic_demo"
    ? "Illustrative only. Every synthetic evidence item is labeled Hypothesis and production comparison reliability is unknown."
    : result.qualityWarnings.length
      ? `Partial reliability. ${result.qualityWarnings.length} quality or interpretation warning${result.qualityWarnings.length === 1 ? " is" : "s are"} attached.`
      : "The registered snapshot and query passed their current validation checks; interpretation remains bounded by allowed use.";
  return { statusLabel, headline, reliability, nextAction: action?.nextStep ?? "Assign owners to the missing evidence and approval gates before a material decision." };
}
