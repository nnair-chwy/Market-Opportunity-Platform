import type { AutonomousInsight } from "./current-data-discovery.ts";
import { buildFindingDecisionCase } from "./decision-case.ts";

export type RecommendationType = "act_now" | "controlled_test" | "investigate" | "monitor" | "data_quality";

const RECOMMENDATION_LABELS: Record<RecommendationType, string> = {
  act_now: "Act now",
  controlled_test: "Controlled test",
  investigate: "Validate before acting",
  monitor: "Monitor only",
  data_quality: "Data issue — not an opportunity",
};

const SOURCE_LABELS: Record<string, string> = {
  "SRC-009": "Published CVC clinic footprint",
  "SRC-016": "Census CBSA market context",
  "SRC-018": "Google Ads regional performance",
  "SRC-025": "Competitor ZIP offer history",
  "SRC-028": "Monitored competitor offer detail",
  "SRC-030": "Competitor coverage and freshness checks",
  "tableau-cvc-site-outcomes": "Tableau CVC spend, appointments, acquisition mix, and net sales",
};

function evidenceSummary(finding: AutonomousInsight) {
  const sources = finding.sourceIds.map((sourceId) => SOURCE_LABELS[sourceId] ?? sourceId);
  if (finding.department === "marketing") return `${sources.join(" + ")}. Performance supplies the signal; market context defines the peer comparison and is not an independent outcome.`;
  if (finding.department === "cvc" && finding.businessValue.status === "outcome_connected") return `${sources.join(" + ")}. The same historical aggregate connects spend to clinic outcomes.`;
  if (finding.department === "cvc") return `${sources.join(" + ")}. These jointly describe footprint pressure; neither measures current capacity or contribution.`;
  return `${sources.join(" + ")}. The sample describes monitored competitor conditions, not Chewy demand response.`;
}

function marketingRead(finding: AutonomousInsight) {
  const ctr = finding.evidenceDetail.match(/click-through rate was ([\d.]+)%—among the (lowest|highest) ([\d.]+)%/i);
  const conversionRate = finding.evidenceDetail.match(/attributed conversion rate ([\d.]+)% \(P(\d+)\)/i);
  const cpa = finding.evidenceDetail.match(/cost per attributed conversion \$([\d,.]+) \(P(\d+)\)/i);
  if (!ctr && !conversionRate && !cpa) return finding.whyInteresting;
  return [
    ctr ? `CTR ${ctr[1]}% (${ctr[2]} ${ctr[3]}% of measured regions)` : null,
    conversionRate ? `attributed conversion rate ${conversionRate[1]}% (P${conversionRate[2]})` : null,
    cpa ? `attributed CPA $${cpa[1]} (P${cpa[2]})` : null,
  ].filter(Boolean).join("; ") + ".";
}

function analystRecommendation(finding: AutonomousInsight, recommendationType: RecommendationType) {
  if (recommendationType === "data_quality") return `Exclude ${finding.marketName} from price, spend, or footprint decisions until its source coverage is repaired.`;
  if (finding.department === "marketing") {
    const conversionRate = Number(finding.evidenceDetail.match(/attributed conversion rate [\d.]+% \(P(\d+)\)/i)?.[1] ?? NaN);
    const cpa = Number(finding.evidenceDetail.match(/cost per attributed conversion \$[\d,.]+ \(P(\d+)\)/i)?.[1] ?? NaN);
    if (cpa <= 20 && conversionRate >= 80) return `Prioritize ${finding.marketName} for an incremental paid-search test candidate—but keep live spend unchanged until new-customer and contribution outcomes confirm the attributed efficiency.`;
    if (cpa >= 80 || conversionRate <= 20) return `Do not add paid-search budget in ${finding.marketName}; diagnose query, audience, creative, and conversion quality before reconsidering spend.`;
    return `Keep ${finding.marketName} spend stable and validate whether the observed paid-search pattern persists in first-party customer and contribution outcomes.`;
  }
  if (finding.department === "cvc") return finding.businessValue.status === "outcome_connected"
    ? `Keep ${finding.marketName} on the CVC intervention shortlist; confirm current staffed capacity and contribution before increasing media or changing clinic capacity.`
    : `Prioritize ${finding.marketName} for demand-and-capacity validation; do not infer clinic expansion from footprint and household context alone.`;
  return `Do not change regional price in ${finding.marketName} yet; first join matched-SKU Chewy margin, competitor price, and expected unit response.`;
}

function nextAction(finding: AutonomousInsight) {
  if (finding.department === "marketing") return `Join same-period regional orders, new customers, and contribution to the Google Ads signal. If the advantage remains versus a matched control, pre-register a reversible geo test sized from baseline volume and detectable lift.`;
  if (finding.department === "cvc") return finding.businessValue.status === "outcome_connected"
    ? `Refresh the current period, confirm staffed appointment availability and contribution, then test one reversible media or scheduling change before considering footprint.`
    : `Attach the available site × metro outcome export, staffed capacity, mature-clinic cohort, and contribution; then decide between demand generation, capacity, or no change.`;
  return `Build a matched-SKU table with Chewy price, unit margin, competitor landed price, availability, and expected unit response before proposing a bounded regional test.`;
}

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
  const decisionCase = buildFindingDecisionCase(finding);
  const dataQuality = recommendationType === "data_quality";
  const connectedOutcome = finding.businessValue.status === "outcome_connected";
  const signalConfidence = dataQuality
    ? "Not scored — source issue"
    : finding.department === "marketing"
      ? "Google Ads performance + Census peer context"
      : finding.department === "cvc" && connectedOutcome
        ? "Historical Tableau clinic outcomes"
        : finding.department === "cvc"
          ? "Published clinic footprint + Census households"
          : "Monitored competitor offers + coverage checks";
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
    ? `Historical outcome observed: ${finding.valueTranslation.statement} This is not incremental contribution.`
    : finding.businessValue.status === "export_available"
      ? "Cannot quantify in this run: the outcome export exists but is not joined to this market and period."
      : finding.department === "marketing" && decisionCase.status === "quantified_proxy_scenario"
        ? `${decisionCase.scenario.summary} Incremental sales, new customers, and contribution are not connected.`
        : finding.department === "pricing"
          ? "Cannot quantify: Chewy margin and customer unit response are not connected."
          : "Cannot quantify from the current evidence.";
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
    analystRecommendation: analystRecommendation(finding, recommendationType),
    analystRead: finding.department === "marketing" ? marketingRead(finding) : finding.whyInteresting,
    evidenceSummary: evidenceSummary(finding),
    confidenceStatement: dataQuality
      ? "Not interpretable until source quality passes."
      : connectedOutcome
        ? "Moderate: historical outcomes are joined; current capacity, contribution, and a counterfactual are still missing."
        : finding.department === "marketing"
          ? "Directional: platform performance is observed, but no first-party customer or contribution outcome corroborates it."
          : "Directional: the regional condition is observed, but business response is not connected.",
    nextAction: nextAction(finding),
    reversalCondition: decisionCase.couldReverseRecommendation.slice(0, 2).join(" "),
    urgency,
    primaryStatement: finding.headline,
    expectedResult: finding.valueTranslation.kind === "modeled_scenario" || finding.valueTranslation.kind === "observed_value"
      ? finding.valueTranslation.statement
      : finding.businessValue.headline,
    recommendedMove,
    validationStep: finding.analystInterpretation?.recommendedNextDecisionOrAction ?? finding.nextValidation,
  };
}
