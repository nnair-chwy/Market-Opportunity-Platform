import type { AutonomousInsight } from "./current-data-discovery.ts";

export type RecommendationType = "act_now" | "controlled_test" | "investigate" | "monitor" | "data_quality";

const RECOMMENDATION_LABELS: Record<RecommendationType, string> = {
  act_now: "Act now",
  controlled_test: "Controlled test",
  investigate: "Opportunity to validate",
  monitor: "Monitor",
  data_quality: "Data issue — not an opportunity",
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
  const dataQuality = recommendationType === "data_quality";
  const corroboration = finding.signalCount >= 2 || finding.sourceIds.length >= 2;
  const connectedOutcome = finding.businessValue.status === "outcome_connected";
  const signalConfidence = dataQuality
    ? "Not scored — source issue"
    : connectedOutcome && corroboration
      ? "Connected outcomes + repeated signal"
      : connectedOutcome
        ? "Connected first-party outcome"
        : corroboration
          ? "Repeated across screens or sources"
          : finding.valueTranslation.kind === "modeled_scenario"
            ? "One observed snapshot + proxy model"
            : "Single-source directional signal";
  const decisionReadiness = recommendationType === "act_now"
    ? "Authorized decision review"
    : recommendationType === "controlled_test"
      ? "Approved test ready"
      : recommendationType === "investigate" && connectedOutcome
        ? "Ready to design validation"
        : recommendationType === "investigate"
          ? "Needs outcome sizing"
          : recommendationType === "data_quality"
            ? "Excluded from opportunity ranking"
            : "Watch next refresh";
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
  const recommendedMove = recommendationType === "data_quality"
    ? "Keep this record out of business recommendations until its source coverage and joins pass validation."
    : finding.department === "marketing"
      ? `Use the observed ${finding.marketName} pattern to design a capped geo test; size incremental customers and contribution before changing live spend.`
      : finding.department === "pricing"
        ? `Compare matched Chewy and competitor SKU economics in ${finding.marketName}, then decide whether a bounded price, promotion, or match test is warranted.`
        : `Build a current appointment-demand and staffed-capacity case for ${finding.marketName}, then decide whether media, capacity, or footprint should change.`;

  return {
    recommendationType,
    recommendationLabel: RECOMMENDATION_LABELS[recommendationType],
    confidence: signalConfidence,
    signalConfidence,
    decisionReadiness,
    valueStatus,
    urgency,
    primaryStatement: finding.headline,
    expectedResult: finding.valueTranslation.kind === "modeled_scenario" || finding.valueTranslation.kind === "observed_value"
      ? finding.valueTranslation.statement
      : finding.businessValue.headline,
    recommendedMove,
    validationStep: finding.analystInterpretation?.recommendedNextDecisionOrAction ?? finding.nextValidation,
  };
}
