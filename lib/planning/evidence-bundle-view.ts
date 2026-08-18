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
  } else if (result.query === "growth_test_screening_bundle") {
    headline = `${result.rows.length} complete-evidence markets were ranked with growth-test-screening-v1. The result is a local-demo Hypothesis, not a market recommendation.`;
  } else if (result.query === "multi_market_comparison_bundle") {
    headline = `${result.geographyIds.length} resolved markets were compared only on the requested measures. No universal score was added.`;
  } else if (result.query === "source_coverage_bundle") {
    headline = `${result.rows.length} markets meet the requested source-presence checks. Coverage does not indicate opportunity or data accuracy.`;
  } else if (result.query === "normalized_evidence_bundle") {
    headline = `${result.evidenceBundle.length} requested normalized evidence values were returned from registered CBSA queries.`;
  }
  const reliability = result.executionMode === "synthetic_demo"
    ? "Illustrative only. Every synthetic evidence item is labeled Hypothesis and production comparison reliability is unknown."
    : result.qualityWarnings.length
      ? `Partial reliability. ${result.qualityWarnings.length} quality or interpretation warning${result.qualityWarnings.length === 1 ? " is" : "s are"} attached.`
      : "The registered snapshot and query passed their current validation checks; interpretation remains bounded by allowed use.";
  return { statusLabel, headline, reliability, nextAction: action?.nextStep ?? "Assign owners to the missing evidence and approval gates before a material decision." };
}
