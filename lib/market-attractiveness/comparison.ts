import type { AskAiContext } from "@/lib/ai/insights";
import type {
  MarketAttractivenessResult,
  MarketCohort,
} from "./types.ts";

export type MarketComparisonEligibility = {
  allowed: boolean;
  reason: string | null;
};

export function canAddMarketToComparison(
  result: MarketAttractivenessResult | null,
  selected: readonly MarketAttractivenessResult[],
): MarketComparisonEligibility {
  if (!result || !result.cbsaCode) {
    return {
      allowed: false,
      reason: "This market has no exact scored CBSA result.",
    };
  }
  if (selected.some((market) => market.cbsaCode === result.cbsaCode)) {
    return { allowed: false, reason: "This market is already in the comparison." };
  }
  if (selected.length >= 5) {
    return { allowed: false, reason: "A comparison can include up to five markets." };
  }
  const cohort: MarketCohort | null = selected[0]?.cohort ?? null;
  if (cohort && result.cohort !== cohort) {
    return {
      allowed: false,
      reason:
        "Metropolitan and micropolitan results are normalized separately. Start a new comparison to change cohorts.",
    };
  }
  return { allowed: true, reason: null };
}

function subscoreSummary(result: MarketAttractivenessResult): string {
  return result.subscores
    .map((subscore) => `${subscore.label} ${compactNumber(subscore.score)}`)
    .join(", ");
}

function compactNumber(value: number): number {
  return Number(value.toFixed(2));
}

function metricContributionSummary(
  result: MarketAttractivenessResult,
  direction: "highest" | "lowest",
): string {
  const multiplier = direction === "highest" ? -1 : 1;
  return [...result.metricResults]
    .sort(
      (left, right) =>
        multiplier * (left.contribution - right.contribution) ||
        left.label.localeCompare(right.label),
    )
    .slice(0, 3)
    .map(
      (metric) =>
        `${metric.label}: normalized ${compactNumber(metric.normalizedScore)}, contribution ${compactNumber(metric.contribution)}`,
    )
    .join("; ");
}

export function buildMarketComparisonAskAiContext(
  results: readonly MarketAttractivenessResult[],
): AskAiContext | null {
  if (results.length < 1) return null;
  const isSingleMarket = results.length === 1;
  const orderedCodes = results.map((result) => result.cbsaCode).join(":");
  const highest = [...results].sort(
    (left, right) => right.overallScore - left.overallScore,
  )[0];
  const lowest = [...results].sort(
    (left, right) => left.overallScore - right.overallScore,
  )[0];
  const scoreSpread = Number(
    (highest.overallScore - lowest.overallScore).toFixed(2),
  );

  return {
    id: `market-comparison-${orderedCodes}`,
    kind: "market",
    title: isSingleMarket
      ? `Review ${results[0].marketName}`
      : `Compare ${results.length} markets`,
    subtitle: `${results[0].cohort} synthetic screening ${
      isSingleMarket ? "result" : "comparison"
    }`,
    overview:
      `Ask about the supplied deterministic ${
        isSingleMarket ? "score" : "scores"
      }, subscores, sensitivity, missing evidence, or limitations. AI explains ${
        isSingleMarket ? "this result" : "these results"
      } but does not recalculate scores or choose a market.`,
    insights: [
      ...results.map((result) => ({
        title: result.marketName,
        detail: `CBSA ${result.cbsaCode}. Overall score ${compactNumber(result.overallScore)}; cohort rank ${result.cohortRank}; cohort percentile ${compactNumber(result.cohortPercentile)}; ${subscoreSummary(result)}; sensitivity ${result.sensitivity.classification} with rank range ${result.sensitivity.rankRange}. Largest supplied metric contributions: ${metricContributionSummary(result, "highest")}. Weakest supplied metric contributions: ${metricContributionSummary(result, "lowest")}.`,
        status: "Hypothesis" as const,
        sourceIds: [result.configurationFingerprint],
        tone: result.sensitivity.classification === "stable"
          ? ("neutral" as const)
          : ("caution" as const),
      })),
      ...(isSingleMarket
        ? []
        : [
          {
            title: "Supplied score range",
            detail: `${highest.marketName} has the highest supplied score at ${compactNumber(highest.overallScore)}; ${lowest.marketName} has the lowest at ${compactNumber(lowest.overallScore)}; the deterministic spread is ${scoreSpread}.`,
            status: "Derived" as const,
            sourceIds: [highest.configurationFingerprint],
            tone: "neutral" as const,
          },
        ]),
    ],
    warnings: [
      ...new Set(results.flatMap((result) => result.warnings)),
    ].slice(0, 12),
    limitations: [
      "All comparison scores are synthetic prototype evidence.",
      "The comparison does not measure site feasibility, execution readiness, financial impact, or lease suitability.",
      "AI may explain supplied results but must not calculate scores, change weights, or recommend market entry.",
    ],
    suggestedQuestions: isSingleMarket
      ? [
          "What stands out in this market result?",
          "How sensitive is this result to the current weights?",
          "What evidence is missing for this market?",
          "What should an analyst investigate next?",
        ]
      : [
          "What explains the largest supplied score differences?",
          "Which market is most sensitive to the current weights?",
          "What evidence is missing from this comparison?",
          "What should an analyst investigate next?",
          "What questions should make an analyst skeptical of these results?",
        ],
  };
}
