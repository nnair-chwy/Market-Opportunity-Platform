import type { AutonomousInsight } from "./current-data-discovery.ts";

export type RecommendationType = "act_now" | "controlled_test" | "investigate" | "monitor" | "data_quality";

const RECOMMENDATION_LABELS: Record<RecommendationType, string> = {
  act_now: "Act now",
  controlled_test: "Controlled test",
  investigate: "Investigate",
  monitor: "Monitor",
  data_quality: "Data quality",
};

export function recommendationTypeForFinding(finding: AutonomousInsight): RecommendationType {
  if (finding.opportunity) return finding.opportunity.recommendation.type;
  if (finding.decisionValue.flags.includes("coverage_risk")) return "data_quality";
  switch (finding.analystInterpretation?.actionabilityLevel) {
    case "decision_ready": return "act_now";
    case "test_ready": return "controlled_test";
    case "investigation_ready": return "investigate";
    default: return finding.importance.tier === "watch" ? "monitor" : "investigate";
  }
}

export function findingPresentation(finding: AutonomousInsight) {
  const recommendationType = recommendationTypeForFinding(finding);
  const corroboration = finding.signalCount >= 3 && finding.sourceIds.length >= 2;
  const connectedOutcome = finding.businessValue.status === "outcome_connected";
  const confidence = finding.opportunity
    ? finding.opportunity.confidence === "high" ? "High" : finding.opportunity.confidence === "medium" ? "Medium" : "Low"
    : connectedOutcome && corroboration
    ? "High"
    : connectedOutcome || finding.signalCount >= 2
      ? "Medium"
      : "Low";
  const valueStatus = connectedOutcome
    ? "Business outcome connected"
    : finding.businessValue.status === "export_available"
      ? "Value data available to connect"
      : "Potential value not yet sized";
  const urgency = recommendationType === "act_now"
    ? "Act this quarter"
    : recommendationType === "controlled_test"
      ? "Design next test"
      : recommendationType === "investigate" || recommendationType === "data_quality"
        ? "Validate next"
        : "Monitor";

  return {
    recommendationType,
    recommendationLabel: RECOMMENDATION_LABELS[recommendationType],
    confidence,
    valueStatus,
    urgency,
  };
}
