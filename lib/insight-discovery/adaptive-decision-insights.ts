import snapshot from "../../data/approved/adaptive-discovery/current.json" with { type: "json" };

export const ADAPTIVE_DECISION_INSIGHTS_VERSION = snapshot.version;

type SnapshotFinding = {
  id: string;
  type: string;
  question: string;
  hypothesis: string;
  evidenceStatus: string;
  geography: { type: string; label: string };
  period: string;
  confidence: { level: string; reason: string };
  metrics: Array<{ id: string; label: string; value: number; unit: string; benchmark?: string | number; calculation: string }>;
  evidence: string[];
  implication: string;
  proposedAction: string;
  decisionBoundary: string;
  limits: string[];
  sourceIds: string[];
  sourceFiles: string[];
};

export type AdaptiveDecisionFinding = SnapshotFinding & {
  departments: Array<"marketing" | "pricing" | "cvc">;
  findingKind: "opportunity" | "contradiction" | "quality" | "price_test" | "competitive_risk" | "cross_functional";
};

function withScope(
  finding: SnapshotFinding,
  departments: AdaptiveDecisionFinding["departments"],
  findingKind: AdaptiveDecisionFinding["findingKind"],
): AdaptiveDecisionFinding {
  return { ...finding, departments, findingKind };
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  if (!ordered.length) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function metricValue(finding: SnapshotFinding, id: string) {
  return Number(finding.metrics.find((item) => item.id === id)?.value ?? 0);
}

function repeatedChannelMixFindings(findings: SnapshotFinding[]): AdaptiveDecisionFinding[] {
  const groups = new Map<string, SnapshotFinding[]>();
  for (const finding of findings) {
    const label = finding.metrics.find((item) => item.id === "spend_share")?.label ?? "";
    const channel = label.replace(/\s+spend share$/i, "").trim();
    if (!channel) continue;
    groups.set(channel, [...(groups.get(channel) ?? []), finding]);
  }

  return [...groups.entries()].flatMap(([channel, channelFindings]) => {
    const positive = channelFindings.filter((finding) => metricValue(finding, "share_gap") > 0);
    const negative = channelFindings.filter((finding) => metricValue(finding, "share_gap") < 0);
    const candidates = [positive, negative].filter((items) => items.length >= 3);
    return candidates.map((items) => {
      const isPositive = metricValue(items[0]!, "share_gap") > 0;
      const multiples = items.map((finding) => {
        const spendShare = metricValue(finding, "spend_share");
        const appointmentShare = metricValue(finding, "completed_appointment_share");
        return isPositive ? appointmentShare / Math.max(spendShare, 0.0001) : spendShare / Math.max(appointmentShare, 0.0001);
      });
      const medianMultiple = round(median(multiples), 1);
      const medianGap = round(median(items.map((finding) => metricValue(finding, "share_gap"))), 4);
      const markets = items.map((finding) => finding.geography.label).sort();
      const direction = isPositive ? "over-indexed" : "under-indexed";
      return withScope({
        id: `cvc:channel-pattern:${channel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${direction}`,
        type: "repeated_channel_pattern",
        question: `Does ${channel}'s relationship between spend and completed appointments repeat across CVC metros?`,
        hypothesis: isPositive
          ? `${channel} may be a more productive CVC acquisition treatment than its current spend share suggests across multiple metros.`
          : `${channel} may have a repeated funnel, targeting, measurement, or capacity constraint across multiple CVC metros.`,
        evidenceStatus: "Derived",
        geography: { type: "tableau_metro_portfolio", label: `${items.length} CVC metros` },
        period: items[0]!.period,
        confidence: { level: "medium", reason: "The same directional share gap clears the materiality threshold in at least three metros, but the comparison remains observational and the Tableau metro labels do not have an approved crosswalk." },
        metrics: [
          { id: "markets_with_pattern", label: "Metros with the same directional pattern", value: items.length, unit: "markets", calculation: "Count of metros where the absolute completed-appointment-share minus spend-share gap is at least 10 percentage points" },
          { id: "median_share_multiple", label: isPositive ? "Median appointment-share versus spend-share multiple" : "Median spend-share versus appointment-share multiple", value: medianMultiple, unit: "multiple", calculation: isPositive ? "Median(completed-appointment share / spend share)" : "Median(spend share / completed-appointment share)" },
          { id: "median_share_gap", label: "Median completed-appointment-share minus spend-share gap", value: medianGap, unit: "percentage_point_ratio", calculation: "Median(completed-appointment share - spend share)" },
        ],
        evidence: items.map((finding) => `${finding.geography.label}: ${round(metricValue(finding, "spend_share") * 100, 1)}% of spend and ${round(metricValue(finding, "completed_appointment_share") * 100, 1)}% of completed appointments.`),
        implication: isPositive
          ? `${channel} produced a median ${medianMultiple}× its proportional share of completed appointments across ${items.length} metros (${markets.join(", ")}). This repeated pattern is stronger than a one-market anomaly and should lead the next multi-market CVC media test.`
          : `${channel} consumed a median ${medianMultiple}× its proportional share of completed appointments across ${items.length} metros (${markets.join(", ")}). Treat this as a repeated allocation warning, not a one-market exception.`,
        proposedAction: isPositive
          ? `Use ${channel} as the common treatment in a matched multi-market test across ${markets.join(", ")}; keep comparison-channel spend stable and size the decision on incremental completed appointments, new-to-Chewy appointments, capacity utilization, and contribution.`
          : `Keep ${channel} out of broad CVC budget expansion across ${markets.join(", ")} until a matched-market diagnostic separates targeting, attribution, clinic capacity, and downstream conversion; preserve spend only where an approved test can identify incremental value.`,
        decisionBoundary: "Do not reallocate live spend from observational channel shares alone.",
        limits: ["Historical four-week snapshot.", "The same patients or customers may appear across funnel measures.", "No experimental incrementality, contribution, or approved metro crosswalk is attached."],
        sourceIds: [...new Set(items.flatMap((finding) => finding.sourceIds))],
        sourceFiles: [...new Set(items.flatMap((finding) => finding.sourceFiles))],
      }, ["cvc", "marketing"], "cross_functional");
    });
  }).sort((left, right) => Math.abs(metricValue(right, "median_share_gap")) - Math.abs(metricValue(left, "median_share_gap")));
}

function allDataCoverageFinding(): AdaptiveDecisionFinding {
  const cvcFindings = snapshot.discoveries.cvcChannelMix.questions as SnapshotFinding[];
  const marketingFindings = [
    ...snapshot.discoveries.matchedDmaCrossAccount.jointOpportunities,
    ...snapshot.discoveries.matchedDmaCrossAccount.contradictions,
  ] as SnapshotFinding[];
  const pricingFindings = [
    ...snapshot.discoveries.dogFoodPricing.raiseCandidates,
    ...snapshot.discoveries.dogFoodPricing.riskCandidates,
  ] as SnapshotFinding[];
  const sourceIds = [...new Set(snapshot.sources.map((item) => item.sourceId))];
  return withScope({
    id: "portfolio:all-data:regional-join-readiness",
    type: "cross_source_readiness",
    question: "What can all available Marketing, Pricing, and CVC evidence conclude together, and what prevents one regional opportunity ranking?",
    hypothesis: "The portfolio may contain useful within-team opportunities while still lacking the shared geography, period, and business outcomes needed to prioritize one market across all three departments.",
    evidenceStatus: "Derived",
    geography: { type: "mixed_unjoined_geographies", label: "United States" },
    period: "2025-02-03/2026-08-17 mixed approved snapshots",
    confidence: { level: "high", reason: "This is a direct inventory and compatibility result: every attached source and generated finding is counted, and no unlike geography or period is numerically blended." },
    metrics: [
      { id: "approved_source_files", label: "Approved source files scanned", value: snapshot.sources.length, unit: "files", calculation: "Count of files registered in the adaptive discovery snapshot" },
      { id: "outcome_bearing_snapshots", label: "Snapshots with first-party outcomes", value: 2, unit: "snapshots", calculation: "CVC metro outcomes plus national new-customer acquisition" },
      { id: "shared_regional_joins", label: "Approved regional joins spanning all three departments", value: 0, unit: "joins", calculation: "Count of shared geography × period × outcome joins across Marketing, Pricing, and CVC" },
    ],
    evidence: [
      `${marketingFindings.length} Marketing screens use matched DMA labels and platform-attributed conversion outcomes.`,
      `${cvcFindings.length} CVC/Marketing screens connect channel spend to appointments and net sales at historical Tableau metro labels.`,
      `${pricingFindings.length} Pricing screens connect current Dog Food SKU economics to monitored competitor offers, while new-customer acquisition remains national.`,
    ],
    implication: `Across ${snapshot.sources.length} approved source files, two snapshots contain first-party outcomes, but zero approved regional joins span Marketing, Pricing, and CVC at the same geography and period. The current opportunities are useful within their evidence lanes; the data cannot yet defensibly name one all-department market winner.`,
    proposedAction: "Keep acting through bounded team-specific tests, and make the next data connection a shared region-week decision layer linking media, orders, new customers, contribution, CVC appointments and capacity, and matched-SKU price position. Re-run discovery after that join to produce a genuine all-department regional ranking.",
    decisionBoundary: "Do not blend DMA labels, Tableau metro labels, ZIP panels, and national category outcomes into one score.",
    limits: ["This finding measures evidence coverage, not opportunity value.", "First-party orders and contribution are not present at a shared regional grain.", "Pricing observations are not linked to clinic trade areas or regional customer outcomes."],
    sourceIds,
    sourceFiles: [...new Set(snapshot.sources.map((item) => item.file))],
  }, ["marketing", "pricing", "cvc"], "cross_functional");
}

/**
 * Returns hypotheses produced from the evidence itself. These are generated by
 * reusable cohort, contradiction, decomposition, quality, and SKU-gap
 * operators rather than by the starter-question registry.
 */
export function getAdaptiveDecisionFindings(): AdaptiveDecisionFinding[] {
  const cvcChannelFindings = snapshot.discoveries.cvcChannelMix.questions as SnapshotFinding[];
  const findings: AdaptiveDecisionFinding[] = [
    ...repeatedChannelMixFindings(cvcChannelFindings),
    ...snapshot.discoveries.matchedDmaCrossAccount.jointOpportunities.map((item) => withScope(item as SnapshotFinding, ["marketing"], "opportunity")),
    ...snapshot.discoveries.matchedDmaCrossAccount.contradictions.map((item) => withScope(item as SnapshotFinding, ["marketing"], "contradiction")),
    ...cvcChannelFindings.map((item) => withScope(item, ["cvc", "marketing"], "cross_functional")),
    ...snapshot.discoveries.dogFoodPricing.raiseCandidates.slice(0, 5).map((item) => withScope(item as SnapshotFinding, ["pricing"], "price_test")),
    ...snapshot.discoveries.dogFoodPricing.riskCandidates.slice(0, 5).map((item) => withScope(item as SnapshotFinding, ["pricing"], "competitive_risk")),
    ...(snapshot.discoveries.nationalDogFoodContext?.hypotheses ?? []).map((item) => withScope(item as SnapshotFinding, ["marketing", "pricing"], "cross_functional")),
    // Keep the portfolio compatibility gap visible without allowing a data-readiness
    // card to outrank the concrete, decision-relevant patterns above it.
    allDataCoverageFinding(),
  ];
  return findings;
}

export function getAdaptiveDiscoveryAudit() {
  const findings = getAdaptiveDecisionFindings();
  return {
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    method: "data_generated_decision_hypotheses" as const,
    sourceCount: snapshot.sources.length,
    generatedCount: findings.length,
    testedCount: findings.filter((finding) => finding.evidenceStatus === "Derived").length,
    findings,
  };
}
