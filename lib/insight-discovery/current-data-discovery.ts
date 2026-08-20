import { createHash } from "node:crypto";
import type { PerspectiveId, PerspectiveViewId } from "../perspectives/contracts.ts";
import { publicMarkets } from "../data/public-market-ui.ts";
import { planEvaluation } from "../planning/planner.ts";
import { runMarketInvestigation, type InvestigationLead } from "../planning/market-investigation.ts";
import { getReceivingTeam, routeAutonomousGeoFinding, type FindingTeamRoute } from "../planning/receiving-team-catalog.ts";
import { assessGovernedSnowflakeEscalationFromLocalEvidence, type GovernedSnowflakeEscalationAssessment } from "../snowflake-escalation/index.ts";
import { interpretAutonomousFinding, type AutonomousAnalystInterpretation } from "./analyst-interpretation.ts";
import { selectDiscoveryFindings, type DiscoveryFindingSelectionCounts } from "./finding-selection.ts";
import { encodeInsightDiscoveryCursor } from "./rerun-contract.ts";
import { getApprovedWorkspaceSnapshotDataset } from "../perspectives/approved-workspace-snapshot.ts";
import type { WorkspaceSnapshotDatasetId } from "../perspectives/workspace-snapshot.ts";
import { assessBusinessValue, type BusinessValueAssessment } from "../business-value/first-party-value-framework.ts";
import { getTableauCvcMetroSummaries, median, TABLEAU_CVC_OUTCOME_SNAPSHOT_VERSION, TABLEAU_CVC_OUTCOME_SOURCE_ID } from "../business-value/tableau-cvc-metro-summary.ts";
import { buildOpportunityRunFromFindings, opportunityForFinding } from "./opportunity-from-findings.ts";
import type { CrossSourceRegionalOpportunity } from "./cross-source-opportunity.ts";
import type { IterativeDiscoveryRun } from "./iterative-discovery-loop.ts";

export const CURRENT_DATA_DISCOVERY_VERSION = "current-data-insight-discovery-v3" as const;
const TABLEAU_CVC_OUTCOME_ANALYSES = ["cvc-completed-appointments-per-spend", "cvc-net-sales-per-spend", "cvc-new-to-chewy-appointment-mix"] as const;

export type DiscoveryHypothesis = {
  id: string;
  department: PerspectiveId;
  viewId: PerspectiveViewId;
  question: string;
  objective: string;
};

export const CURRENT_DATA_HYPOTHESES: readonly DiscoveryHypothesis[] = [
  { id: "marketing-response", department: "marketing", viewId: "paid_search_response", question: "Where is paid search response unusually strong or weak across regions?", objective: "Find regional response contrasts that may improve customer acquisition." },
  { id: "marketing-impressions", department: "marketing", viewId: "paid_search_impressions", question: "Where is paid search delivery unusually concentrated across regions?", objective: "Find possible reach concentration, saturation, or under-delivery." },
  { id: "marketing-ctr", department: "marketing", viewId: "paid_search_ctr", question: "Which regions have unusually high or low paid search click-through response?", objective: "Find creative, audience, or query-mix hypotheses." },
  { id: "marketing-cpc", department: "marketing", viewId: "paid_search_cpc", question: "Which regions have unusually high or low paid search click cost?", objective: "Find cost-pressure patterns worth testing against outcomes." },
  { id: "pricing-availability", department: "pricing", viewId: "competitor_availability", question: "Where does monitored competitor availability differ most across regions?", objective: "Find competitor-coverage anomalies and potential local assortment gaps." },
  { id: "pricing-offer-price", department: "pricing", viewId: "observed_equalized_price", question: "Where do observed equalized competitor offer prices differ most?", objective: "Find regional price-observation contrasts requiring matched-SKU validation." },
  { id: "pricing-volume", department: "pricing", viewId: "offer_observation_volume", question: "Which regions have unusually high or low competitor offer observation counts?", objective: "Separate possible market signals from data-coverage artifacts." },
  { id: "pricing-assortment", department: "pricing", viewId: "assortment_breadth", question: "Where does observed competitor assortment breadth differ most?", objective: "Find local assortment hypotheses while retaining monitoring limitations." },
  { id: "cvc-footprint", department: "cvc", viewId: "market_expansion_context", question: "Which markets have the most interesting clinic footprint and household-demand contrasts?", objective: "Find clinic access and footprint patterns worth capacity validation." },
] as const;

type LeadOccurrence = {
  hypothesis: DiscoveryHypothesis;
  lead: InvestigationLead;
  topic: ReturnType<typeof planEvaluation>["intent"]["topic"];
  sourceIds: string[];
  snapshotVersion: string;
  evidenceStage: "signal" | "triangulated_finding";
};

export type AutonomousInsight = {
  insightId: string;
  department: PerspectiveId;
  marketIds: string[];
  marketName: string;
  headline: string;
  whyInteresting: string;
  evidenceDetail: string;
  nextValidation: string;
  sourceIds: string[];
  snapshotVersions: string[];
  hypothesisIds: string[];
  signalCount: number;
  priority: "multi-signal lead" | "single-signal lead";
  question: string;
  applicability: {
    primaryTeamId: FindingTeamRoute["primaryTeam"]["teamId"];
    primaryTeamLabel: string;
    reason: string;
    partnerTeams: Array<{ teamId: FindingTeamRoute["partnerTeams"][number]["teamId"]; label: string; reason: string }>;
    approvalBoundary: string;
  };
  decisionValue: {
    score: number;
    reason: string;
    flags: Array<"cross_measure_contradiction" | "coverage_risk" | "scale_only" | "capacity_validation" | "peer_diligence">;
  };
  valueTranslation: {
    kind: "observed_value" | "derived_indicator" | "modeled_scenario" | "decision_boundary";
    label: string;
    statement: string;
    caveat: string;
  };
  businessValue: BusinessValueAssessment;
  importance: {
    score: number;
    tier: "priority_now" | "validate_next" | "watch";
    label: "Priority now" | "Validate next" | "Watch";
    reason: string;
    notificationCandidate: boolean;
  };
  analystInterpretation?: AutonomousAnalystInterpretation;
  opportunity?: CrossSourceRegionalOpportunity;
};

export type CurrentDataDiscoveryRun = {
  version: typeof CURRENT_DATA_DISCOVERY_VERSION;
  runId: string;
  runSequence: number;
  status: "completed";
  startedAt: string;
  completedAt: string;
  generationMethod: "reviewed_hypothesis_registry";
  analysesRun: number;
  departmentsScanned: PerspectiveId[];
  marketUniverse: number;
  measuresExamined: number;
  sourceIds: string[];
  findings: AutonomousInsight[];
  primaryFindings: AutonomousInsight[];
  additionalFindings: AutonomousInsight[];
  findingSelection: {
    version: string;
    primaryFindingIds: string[];
    additionalFindingIds: string[];
    suppressed: Array<{ insightId: string; reasons: string[] }>;
    counts: {
      global: DiscoveryFindingSelectionCounts;
      byDepartment: Record<PerspectiveId, DiscoveryFindingSelectionCounts>;
    };
  };
  dataAccessSummary: {
    status: "local_evidence_sufficient" | "additional_access_recommended" | "governance_review_required";
    questionsNeedingWarehouseEvidence: number;
    uniqueTemplateCount: number;
    owningTeams: string[];
  };
  snowflakeEscalations: GovernedSnowflakeEscalationAssessment[];
  explorationCursor: string;
  runAudit: {
    previousRunId: string | null;
    mode: "initial_run" | "same_snapshot_reprioritization" | "refreshed_data" | "snapshot_comparison_unavailable";
    snapshotFingerprint: string;
    previousSnapshotFingerprint: string | null;
    reranHypothesisCount: number;
    excludedPreviousPrimaryFindingIds: string[];
    newPrimaryFindingIds: string[];
    repeatedPrimaryFindingIds: string[];
  };
  traces: Array<{
    hypothesisId: string;
    department: PerspectiveId;
    question: string;
    objective: string;
    planStatus: string;
    leadsFound: number;
    comparisonsExamined: number;
    measuresExamined: string[];
    sourceIds: string[];
    snapshotVersion: string;
    readiness: string;
  }>;
  limitations: string[];
  opportunityRun: IterativeDiscoveryRun;
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function marketName(lead: InvestigationLead) {
  const cbsaCode = lead.id.startsWith("cvc-peer-contrast-") ? lead.marketIds[1] : lead.marketIds[0];
  return publicMarkets.find((market) => market.cbsa_code === cbsaCode)?.cbsa_name
    ?? lead.title.split(":")[0]?.replace(/\s+(?:shows|has|may be)\s+.*$/i, "").trim()
    ?? lead.title;
}

function groupOccurrences(occurrences: LeadOccurrence[]) {
  const groups = new Map<string, LeadOccurrence[]>();
  for (const occurrence of occurrences) {
    const marketId = occurrence.lead.marketIds.join("+") || occurrence.lead.id;
    const key = `${occurrence.hypothesis.department}:${marketId}`;
    groups.set(key, [...(groups.get(key) ?? []), occurrence]);
  }
  return [...groups.entries()];
}

const HYPOTHESIS_DECISION_WEIGHT: Record<string, number> = {
  "marketing-cpc": 58,
  "marketing-ctr": 52,
  "marketing-response": 24,
  "marketing-impressions": 18,
  "pricing-volume": 58,
  "pricing-availability": 48,
  "pricing-offer-price": 38,
  "pricing-assortment": 34,
  "cvc-footprint": 45,
};

function decisionValueForGroup(group: LeadOccurrence[]): AutonomousInsight["decisionValue"] {
  const flags: AutonomousInsight["decisionValue"]["flags"] = [];
  let score = Math.max(...group.map((item) => HYPOTHESIS_DECISION_WEIGHT[item.hypothesis.id] ?? 10));
  const marketingContradiction = group.some(({ hypothesis, lead }) => {
    if (!["marketing-cpc", "marketing-ctr"].includes(hypothesis.id) || !lead.measureValue) return false;
    const primaryHigh = lead.measureValue.percentile >= 90;
    const primaryLow = lead.measureValue.percentile <= 10;
    const favorableOutcome = lead.supportingMeasures?.some((measure) =>
      (/conversion_rate/.test(measure.id) && measure.percentile >= 90)
      || (/cost_per_conversion/.test(measure.id) && measure.percentile <= 10));
    const adverseOutcome = lead.supportingMeasures?.some((measure) =>
      (/conversion_rate/.test(measure.id) && measure.percentile <= 10)
      || (/cost_per_conversion/.test(measure.id) && measure.percentile >= 90));
    return hypothesis.id === "marketing-cpc"
      ? (primaryHigh && favorableOutcome) || (primaryLow && adverseOutcome)
      : (primaryLow && favorableOutcome) || (primaryHigh && adverseOutcome);
  });
  if (marketingContradiction) {
    flags.push("cross_measure_contradiction");
    score += 35;
  }
  const coverageRisk = group.some(({ hypothesis, lead }) =>
    (hypothesis.id === "pricing-volume" && (lead.measureValue?.percentile ?? 50) <= 10)
    || (hypothesis.id === "pricing-assortment" && (lead.supportingMeasures?.some((measure) => measure.id === "pricing_offer_observation_volume" && measure.percentile <= 10) ?? false)));
  if (coverageRisk) {
    flags.push("coverage_risk");
    score += 18;
  }
  const hypotheses = new Set(group.map((item) => item.hypothesis.id));
  if ([...hypotheses].every((id) => ["marketing-response", "marketing-impressions"].includes(id))) {
    flags.push("scale_only");
    score -= 15;
  }
  if (group.some((item) => item.lead.id === "cvc-footprint-intensity-proxy")) {
    flags.push("capacity_validation");
    score += 20;
  } else if (group.some((item) => item.lead.id.startsWith("cvc-peer-contrast-"))) {
    flags.push("peer_diligence");
  }
  const reason = flags.includes("cross_measure_contradiction")
    ? "A decision-relevant efficiency measure conflicts with the attributed outcome pattern, making explanation more valuable than raw volume ranking."
    : flags.includes("coverage_risk")
      ? "Monitoring coverage may be driving the apparent commercial pattern and must be audited before interpretation."
      : flags.includes("capacity_validation")
        ? "This directly frames a clinic capacity and appointment-demand validation task."
        : flags.includes("peer_diligence")
          ? "This is a peer-market diligence lead, not a clinic or site recommendation."
          : flags.includes("scale_only")
            ? "The pattern is primarily market scale or delivery volume and has lower decision value without efficiency outcomes."
            : "The signal maps to a recurring team investigation but still requires compatible business outcomes and guardrails.";
  return { score: Math.max(0, Math.min(100, score)), reason, flags };
}

type GroupMetric = {
  id: string;
  label: string;
  rawValue: number | null;
  formattedValue: string;
  percentile: number;
};

function groupMetrics(group: LeadOccurrence[]) {
  const metrics = new Map<string, GroupMetric>();
  for (const item of group) {
    if (item.lead.measureValue) {
      metrics.set(item.hypothesis.viewId, {
        id: item.hypothesis.viewId,
        label: item.lead.measureValue.label,
        rawValue: item.lead.measureValue.rawValue,
        formattedValue: item.lead.measureValue.formattedValue,
        percentile: item.lead.measureValue.percentile,
      });
    }
    for (const measure of item.lead.supportingMeasures ?? []) {
      if (!metrics.has(measure.id)) {
        const parsedValue = Number(measure.formattedValue.replace(/[^0-9.-]+/g, ""));
        metrics.set(measure.id, { ...measure, rawValue: Number.isFinite(parsedValue) ? parsedValue : null });
      }
    }
  }
  return metrics;
}

function snapshotMedian(datasetId: WorkspaceSnapshotDatasetId) {
  const values = getApprovedWorkspaceSnapshotDataset(datasetId).values
    .map((item) => item.rawValue)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
}

function relativeToMedian(value: number, median: number) {
  if (value >= median * 10) return `${(value / median).toLocaleString("en-US", { maximumFractionDigits: 0 })}× the snapshot median`;
  const difference = Math.abs(value / median - 1) * 100;
  return `${difference.toFixed(0)}% ${value < median ? "below" : "above"} the snapshot median`;
}

function synthesizedHeadline(name: string, department: PerspectiveId, decisionValue: AutonomousInsight["decisionValue"], metrics: Map<string, GroupMetric>, fallback: string) {
  if (decisionValue.flags.includes("coverage_risk")) {
    return `${name}: competitor monitoring is too thin to support a local price decision`;
  }
  if (decisionValue.flags.includes("cross_measure_contradiction")) {
    const ctr = metrics.get("paid_search_ctr");
    const conversionRate = metrics.get("marketing_paid_search_conversion_rate");
    const cpa = metrics.get("marketing_paid_search_cost_per_conversion");
    const medianCpa = snapshotMedian("marketing_paid_search_cost_per_conversion");
    const attributedEfficiencyRatio = cpa?.rawValue && medianCpa ? medianCpa / cpa.rawValue : null;
    if ((ctr?.percentile ?? 50) <= 10 && ((conversionRate?.percentile ?? 0) >= 90 || (cpa?.percentile ?? 100) <= 10)) {
      return attributedEfficiencyRatio && attributedEfficiencyRatio >= 1.1
        ? `Test whether ${name}'s ${attributedEfficiencyRatio.toFixed(1)}× observed attributed spend efficiency can scale`
        : `Test whether ${name}'s strong post-click efficiency can scale`;
    }
    return `Diagnose ${name}'s conflicting paid-search response and attributed efficiency before changing spend`;
  }
  if (decisionValue.flags.includes("capacity_validation")) return `Prioritize ${name} for appointment and capacity validation—not automatic expansion`;
  if (department === "pricing") {
    const volume = metrics.get("offer_observation_volume");
    const medianVolume = snapshotMedian("pricing_offer_observation_volume");
    if (volume?.rawValue && medianVolume && volume.rawValue >= medianVolume * 10) {
      return `Quarantine ${name}'s extreme competitor aggregate until its joins and duplication are audited`;
    }
    if (metrics.has("observed_equalized_price")) return `${name}: observed competitor prices need a matched-SKU comparison before action`;
  }
  return fallback;
}

function valueTranslationForGroup(group: LeadOccurrence[], decisionValue: AutonomousInsight["decisionValue"]): AutonomousInsight["valueTranslation"] {
  const first = group[0]!;
  const metrics = groupMetrics(group);
  if (first.hypothesis.department === "marketing") {
    const cpa = metrics.get("marketing_paid_search_cost_per_conversion");
    const medianCpa = snapshotMedian("marketing_paid_search_cost_per_conversion");
    if (cpa?.rawValue && medianCpa && cpa.rawValue > 0 && medianCpa > 0) {
      const currentConversions = 1000 / cpa.rawValue;
      const medianConversions = 1000 / medianCpa;
      return {
        kind: "modeled_scenario",
        label: "Non-incremental spend scenario",
        statement: `At the observed platform-attributed CPA of ${cpa.formattedValue}, $1,000 corresponds to about ${currentConversions.toFixed(0)} attributed conversions—${(currentConversions / medianConversions).toFixed(1)}× the count implied by the snapshot median CPA of $${medianCpa.toFixed(2)}.`,
        caveat: "This holds the observed attributed CPA constant. It is not marginal lift, incrementality, a forecast, or a recommendation to change spend.",
      };
    }
  }
  if (first.hypothesis.department === "pricing") {
    const volume = metrics.get("offer_observation_volume");
    const breadth = metrics.get("assortment_breadth");
    const price = metrics.get("observed_equalized_price");
    const parts: string[] = [];
    const volumeMedian = snapshotMedian("pricing_offer_observation_volume");
    const breadthMedian = snapshotMedian("pricing_assortment_breadth");
    const priceMedian = snapshotMedian("pricing_observed_equalized_price");
    if (volume?.rawValue !== null && volume?.rawValue !== undefined && volumeMedian) parts.push(`${volume.formattedValue} monitored offer rows (${relativeToMedian(volume.rawValue, volumeMedian)})`);
    if (breadth?.rawValue !== null && breadth?.rawValue !== undefined && breadthMedian) parts.push(`${breadth.formattedValue} observed SKUs (${relativeToMedian(breadth.rawValue, breadthMedian)})`);
    if (price?.rawValue !== null && price?.rawValue !== undefined && priceMedian) parts.push(`${price.formattedValue} observed equalized offer price (${relativeToMedian(price.rawValue, priceMedian)})`);
    return {
      kind: "decision_boundary",
      label: decisionValue.flags.includes("coverage_risk") ? "Coverage audit value" : "Observed competitor context",
      statement: `${parts.slice(0, 3).join("; ")}. Business value is not estimable until matched Chewy SKU economics, margin, and customer outcomes are joined.`,
      caveat: "Monitoring depth and product mix can create apparent regional price differences; this is not a price-change opportunity estimate.",
    };
  }
  if (decisionValue.flags.includes("capacity_validation")) {
    return {
      kind: "derived_indicator",
      label: "Footprint-load indicator",
      statement: first.lead.observation,
      caveat: "Households per published clinic is a derived screening proxy—not appointment demand, staffed capacity, clinic performance, or proof that another clinic is needed.",
    };
  }
  return {
    kind: "observed_value",
    label: "Observed regional signal",
    statement: first.lead.observation,
    caveat: "This is descriptive regional evidence, not a causal effect or a quantified business impact.",
  };
}

function importanceForFinding(
  decisionValue: AutonomousInsight["decisionValue"],
  valueTranslation: AutonomousInsight["valueTranslation"],
  businessValue: AutonomousInsight["businessValue"],
): AutonomousInsight["importance"] {
  const valueAdjustment = valueTranslation.kind === "modeled_scenario"
    ? 8
    : valueTranslation.kind === "derived_indicator"
      ? 7
      : valueTranslation.kind === "decision_boundary"
        ? 0
        : -8;
  const uncappedScore = Math.max(0, Math.min(100, decisionValue.score + valueAdjustment));
  const score = businessValue.status === "outcome_connected" ? uncappedScore : Math.min(69, uncappedScore);
  const tier = score >= 80 ? "priority_now" : score >= 60 ? "validate_next" : "watch";
  const label = tier === "priority_now" ? "Priority now" : tier === "validate_next" ? "Validate next" : "Watch";
  const reason = tier === "priority_now"
    ? valueTranslation.kind === "modeled_scenario"
      ? "The finding has a substantial quantified proxy and a bounded test that can validate business value."
      : "The finding exposes a large, measurable decision risk with a concrete remediation step."
    : tier === "validate_next"
      ? businessValue.status === "export_available"
        ? "The signal is substantial and the first-party outcome export is known, but it must be connected before opportunity size is validated."
        : "The signal is substantial enough to validate next, but its value is still a proxy rather than first-party opportunity size."
      : "The signal is interesting but does not yet justify taking focus from higher-value findings.";
  return {
    score,
    tier,
    label,
    reason,
    notificationCandidate: tier === "priority_now" && !decisionValue.flags.includes("scale_only"),
  };
}

function insightFromGroup(key: string, group: LeadOccurrence[]): AutonomousInsight {
  const first = group[0]!;
  const signals = unique(group.map((item) => item.lead.businessMeaning));
  const observations = unique(group.map((item) => item.lead.observation));
  const validations = unique(group.map((item) => item.lead.nextEvidence));
  const hypotheses = unique(group.map((item) => item.hypothesis));
  const name = marketName(first.lead);
  const signalCount = hypotheses.length;
  const cvcCapacitySignal = first.hypothesis.department === "cvc" && first.lead.id === "cvc-footprint-intensity-proxy";
  const route = routeAutonomousGeoFinding({
    perspectiveId: first.hypothesis.department,
    viewId: cvcCapacitySignal ? "clinic_performance_context" : first.hypothesis.viewId,
    topic: cvcCapacitySignal ? "clinic_performance" : first.topic,
  });
  const decisionValue = decisionValueForGroup(group);
  const metrics = groupMetrics(group);
  const valueTranslation = valueTranslationForGroup(group, decisionValue);
  const businessValue = assessBusinessValue(first.hypothesis.department);
  const finding: AutonomousInsight = {
    insightId: `insight:${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    department: first.hypothesis.department,
    marketIds: unique(group.flatMap((item) => item.lead.marketIds)),
    marketName: name,
    headline: synthesizedHeadline(name, first.hypothesis.department, decisionValue, metrics, first.lead.title),
    whyInteresting: signalCount > 1
      ? `${signals.slice(0, 2).join(" ")} Repeated appearance across correlated measures makes this a higher-priority diagnostic lead, not independent corroboration or a causal conclusion.`
      : signals[0] ?? "This market produced a question-compatible regional contrast.",
    evidenceDetail: observations.slice(0, 3).join(" "),
    nextValidation: validations.slice(0, 2).join(" "),
    sourceIds: unique(group.flatMap((item) => item.sourceIds)),
    snapshotVersions: unique(group.map((item) => item.snapshotVersion)),
    hypothesisIds: hypotheses.map((item) => item.id),
    signalCount,
    priority: signalCount > 1 ? "multi-signal lead" : "single-signal lead",
    question: hypotheses.map((item) => item.question).join(" "),
    applicability: {
      primaryTeamId: route.primaryTeam.teamId,
      primaryTeamLabel: getReceivingTeam(route.primaryTeam.teamId).label,
      reason: route.primaryTeam.reason,
      partnerTeams: route.partnerTeams.map((partner) => ({
        ...partner,
        label: getReceivingTeam(partner.teamId).label,
      })),
      approvalBoundary: route.approvalBoundary,
    },
    decisionValue,
    valueTranslation,
    businessValue,
    importance: importanceForFinding(decisionValue, valueTranslation, businessValue),
  };
  finding.analystInterpretation = interpretAutonomousFinding({
    finding,
    teamRoute: route,
    evidenceReadiness: {
      firstPartyOutcome: "missing",
      actionGuardrails: "missing",
      geographyCompatibility: "missing",
      cohortComparability: "missing",
      accountableApproval: "missing",
      missingEvidence: validations,
      contraryEvidence: unique(group.map((item) => item.lead.challenge)),
    },
    sourceLineage: finding.sourceIds.map((sourceId) => ({
      sourceId,
      snapshotVersion: finding.snapshotVersions[0] ?? "unknown-snapshot",
      role: "signal",
      description: "Reviewed aggregate regional signal or market context used in the autonomous screen.",
    })),
  });
  return finding;
}

function tableauCvcOutcomeFindings(): AutonomousInsight[] {
  const summaries = getTableauCvcMetroSummaries();
  const medianCompletedPerThousand = median(summaries.map((item) => item.completedAppointmentsPerThousandSpend));
  const medianSalesPerThousand = median(summaries.map((item) => item.netSalesPerThousandSpend));
  return summaries.map((summary) => {
    const marketId = `tableau-metro:${summary.metro.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const route = routeAutonomousGeoFinding({ perspectiveId: "cvc", viewId: "clinic_performance_context", topic: "clinic_performance" });
    const completedRatio = medianCompletedPerThousand > 0 ? summary.completedAppointmentsPerThousandSpend / medianCompletedPerThousand : 0;
    const salesRatio = medianSalesPerThousand > 0 ? summary.netSalesPerThousandSpend / medianSalesPerThousand : 0;
    const evidenceDetail = `${summary.metro} recorded ${summary.completedAppointments.toLocaleString("en-US")} completed appointments, ${summary.newToChewyAppointments.toLocaleString("en-US")} new-to-Chewy appointments, ${summary.netSales.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} net sales, and ${summary.spend.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} tracked media spend from ${summary.periodStart} through ${summary.periodEnd}. That equals ${summary.completedAppointmentsPerThousandSpend.toFixed(2)} completed appointments and ${summary.netSalesPerThousandSpend.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} net sales per $1,000 of observed spend.`;
    const finding: AutonomousInsight = {
      insightId: `insight:cvc-tableau-outcomes-${marketId.split(":")[1]}`,
      department: "cvc",
      marketIds: [marketId],
      marketName: summary.metro,
      headline: `Validate ${summary.metro}'s observed clinic-acquisition economics before changing CVC media or capacity`,
      whyInteresting: `Observed completed appointments per $1,000 were ${completedRatio.toFixed(1)}× the five-metro median and net sales per $1,000 were ${salesRatio.toFixed(1)}× the median. This joins marketing cost to clinic outcomes in one approved aggregate, which is more decision-relevant than clicks alone.`,
      evidenceDetail,
      nextValidation: `Refresh the same export for the current period, map the Tableau metro label to the approved market geography, add staffed capacity and contribution or CCP, then compare like-for-like channel and clinic cohorts before a bounded test.`,
      sourceIds: [TABLEAU_CVC_OUTCOME_SOURCE_ID],
      snapshotVersions: [TABLEAU_CVC_OUTCOME_SNAPSHOT_VERSION],
      hypothesisIds: [...TABLEAU_CVC_OUTCOME_ANALYSES],
      signalCount: TABLEAU_CVC_OUTCOME_ANALYSES.length,
      priority: "multi-signal lead",
      question: `Which CVC metros combine observed media efficiency, completed appointments, new-to-Chewy appointment mix, and net sales strongly enough to justify current-period validation?`,
      applicability: {
        primaryTeamId: route.primaryTeam.teamId,
        primaryTeamLabel: getReceivingTeam(route.primaryTeam.teamId).label,
        reason: route.primaryTeam.reason,
        partnerTeams: route.partnerTeams.map((partner) => ({ ...partner, label: getReceivingTeam(partner.teamId).label })),
        approvalBoundary: route.approvalBoundary,
      },
      decisionValue: { score: Math.min(74, 50 + Math.round(Math.max(completedRatio, salesRatio) * 8)), reason: "The finding connects observed media cost to appointments and net sales, but the period is historical and lacks capacity, incrementality, and contribution.", flags: ["capacity_validation"] },
      valueTranslation: { kind: "observed_value", label: "Observed clinic outcomes", statement: `${summary.completedAppointmentsPerThousandSpend.toFixed(2)} completed appointments and ${summary.netSalesPerThousandSpend.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} net sales per $1,000 of tracked spend; ${(summary.newToChewyShare ?? 0).toLocaleString("en-US", { style: "percent", maximumFractionDigits: 0 })} of completed appointments were new to Chewy.`, caveat: "Historical observed ratios only. They are not incremental lift, marginal returns, capacity availability, contribution, or CCP." },
      businessValue: { status: "outcome_connected", label: "Observed outcomes connected", headline: `Appointments and net sales are connected for the approved ${summary.periodStart}–${summary.periodEnd} Tableau period.`, formula: "Observed net sales per $1,000 spend = aggregate clinic net sales ÷ tracked media spend × 1,000", requiredInputs: ["current-period refresh", "approved metro crosswalk", "staffed capacity", "contribution or CCP", "test/control counterfactual"], sourceIds: [TABLEAU_CVC_OUTCOME_SOURCE_ID] },
      importance: { score: Math.min(69, 54 + Math.round(Math.max(completedRatio, salesRatio) * 6)), tier: "validate_next", label: "Validate next", reason: "First-party clinic outcomes are connected, but the historical period and missing crosswalk, capacity, contribution, and counterfactual prevent a current action.", notificationCandidate: false },
    };
    finding.analystInterpretation = interpretAutonomousFinding({
      finding,
      teamRoute: route,
      evidenceReadiness: { firstPartyOutcome: "connected", actionGuardrails: "missing", geographyCompatibility: "missing", cohortComparability: "missing", accountableApproval: "missing", missingEvidence: finding.businessValue.requiredInputs, contraryEvidence: [finding.valueTranslation.caveat] },
      sourceLineage: [{ sourceId: TABLEAU_CVC_OUTCOME_SOURCE_ID, snapshotVersion: TABLEAU_CVC_OUTCOME_SNAPSHOT_VERSION, role: "first_party_outcome", description: "Approved aggregate Tableau CVC spend, appointment, acquisition-segment, and net-sales outcomes." }],
    });
    return finding;
  });
}

export function runCurrentDataInsightDiscovery(input: {
  now?: () => string;
  runId?: string;
  previousRunId?: string;
  previousPrimaryFindingIds?: string[];
  previousSnapshotFingerprint?: string;
  previousRunSequence?: number;
  previouslyExcludedPrimaryFindingIds?: string[];
} = {}): CurrentDataDiscoveryRun {
  const now = input.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const generatedRunId = input.runId ?? `discovery:${crypto.randomUUID()}`;
  const runSequence = input.previousRunId ? (input.previousRunSequence ?? 1) + 1 : 1;
  const runId = generatedRunId === input.previousRunId ? `${generatedRunId}:rerun-${runSequence}` : generatedRunId;
  const occurrences: LeadOccurrence[] = [];
  const traces: CurrentDataDiscoveryRun["traces"] = [];
  const snowflakeEscalations: GovernedSnowflakeEscalationAssessment[] = [];
  const measures = new Set<string>();
  const sources = new Set<string>();
  let marketUniverse = 0;

  for (const hypothesis of CURRENT_DATA_HYPOTHESES) {
    const plan = planEvaluation(hypothesis.question, hypothesis.department, [], hypothesis.viewId);
    const investigation = runMarketInvestigation(plan);
    marketUniverse = Math.max(marketUniverse, investigation.screeningScope.marketUniverse);
    investigation.measuresExamined.forEach((measure) => measures.add(measure));
    investigation.sourceIds.forEach((sourceId) => sources.add(sourceId));
    investigation.leads.forEach((lead) => occurrences.push({
      hypothesis,
      lead,
      topic: plan.intent.topic,
      sourceIds: investigation.sourceIds,
      snapshotVersion: investigation.dataSnapshotVersion,
      evidenceStage: investigation.evidenceStage,
    }));
    snowflakeEscalations.push(assessGovernedSnowflakeEscalationFromLocalEvidence({
      runId: `${runId}:${hypothesis.id}`,
      plan,
      localEvidence: {
        executionStatus: investigation.leads.length ? "complete" : "partial",
        evidenceIds: investigation.leads.map((lead) => lead.id),
        sourceIds: investigation.sourceIds,
        metricLabels: investigation.measuresExamined,
      },
    }));
    traces.push({
      hypothesisId: hypothesis.id,
      department: hypothesis.department,
      question: hypothesis.question,
      objective: hypothesis.objective,
      planStatus: plan.status,
      leadsFound: investigation.leads.length,
      comparisonsExamined: investigation.comparisonsExamined,
      measuresExamined: investigation.measuresExamined,
      sourceIds: investigation.sourceIds,
      snapshotVersion: investigation.dataSnapshotVersion,
      readiness: investigation.readiness.summary,
    });
  }

  const outcomeFindings = tableauCvcOutcomeFindings();
  outcomeFindings.forEach((finding) => {
    finding.sourceIds.forEach((sourceId) => sources.add(sourceId));
    ["completed appointments", "new-to-Chewy appointments", "net sales per spend"].forEach((measure) => measures.add(measure));
  });
  traces.push(...TABLEAU_CVC_OUTCOME_ANALYSES.map((analysisId) => ({
    hypothesisId: analysisId,
    department: "cvc" as const,
    question: "Which CVC metros connect observed marketing cost to clinic outcomes strongly enough for current-period validation?",
    objective: "Join regional marketing cost to completed appointments, new-to-Chewy appointment mix, and net sales.",
    planStatus: "executable",
    leadsFound: outcomeFindings.length,
    comparisonsExamined: outcomeFindings.length,
    measuresExamined: ["spend", "completed appointments", "new-to-Chewy appointments", "net sales"],
    sourceIds: [TABLEAU_CVC_OUTCOME_SOURCE_ID],
    snapshotVersion: TABLEAU_CVC_OUTCOME_SNAPSHOT_VERSION,
    readiness: "Approved historical aggregate connected; current-period refresh, geography crosswalk, capacity, contribution, and counterfactual remain required.",
  })));
  const allFindings = [...groupOccurrences(occurrences).map(([key, group]) => insightFromGroup(key, group)), ...outcomeFindings];
  const opportunityRun = buildOpportunityRunFromFindings({ runId, generatedAt: startedAt, findings: allFindings });
  allFindings.forEach((finding) => {
    finding.opportunity = opportunityForFinding(opportunityRun, finding) ?? undefined;
  });
  const excludedPreviousPrimaryFindingIds = unique([
    ...(input.previouslyExcludedPrimaryFindingIds ?? []),
    ...(input.previousPrimaryFindingIds ?? []),
  ]);
  const selection = selectDiscoveryFindings(allFindings, { excludedPrimaryFindingIds: excludedPreviousPrimaryFindingIds });
  const findings = [...selection.primaryDigest, ...selection.additionalFindings].sort((left, right) =>
    right.importance.score - left.importance.score
    || right.decisionValue.score - left.decisionValue.score
    || left.marketName.localeCompare(right.marketName),
  );
  const accessRequests = snowflakeEscalations.flatMap((assessment) => assessment.accessRequest ? [assessment.accessRequest] : []);
  const uniqueTemplateIds = unique(accessRequests.flatMap((request) => request.templates.map((template) => template.templateId)));
  const governanceReviewCount = snowflakeEscalations.filter((assessment) => assessment.status === "governance_review_required").length;
  const snapshotFingerprint = createHash("sha256")
    .update(JSON.stringify(unique(traces.map((trace) => `${trace.snapshotVersion}:${trace.sourceIds.slice().sort().join(",")}`)).sort()))
    .digest("hex");
  const mode = !input.previousRunId
    ? "initial_run" as const
    : !input.previousSnapshotFingerprint
      ? "snapshot_comparison_unavailable" as const
      : input.previousSnapshotFingerprint === snapshotFingerprint
        ? "same_snapshot_reprioritization" as const
        : "refreshed_data" as const;
  const previousPrimaryIds = new Set(input.previousPrimaryFindingIds ?? []);
  const primaryFindingIds = selection.primaryDigest.map((finding) => finding.insightId);
  const cumulativeExcludedPrimaryFindingIds = unique([...excludedPreviousPrimaryFindingIds, ...primaryFindingIds]);

  return {
    version: CURRENT_DATA_DISCOVERY_VERSION,
    runId,
    runSequence,
    status: "completed",
    startedAt,
    completedAt: now(),
    generationMethod: "reviewed_hypothesis_registry",
    analysesRun: CURRENT_DATA_HYPOTHESES.length + TABLEAU_CVC_OUTCOME_ANALYSES.length,
    departmentsScanned: ["marketing", "pricing", "cvc"],
    marketUniverse,
    measuresExamined: measures.size,
    sourceIds: [...sources].sort(),
    findings,
    primaryFindings: selection.primaryDigest,
    additionalFindings: selection.additionalFindings,
    findingSelection: {
      version: selection.version,
      primaryFindingIds: selection.primaryDigest.map((finding) => finding.insightId),
      additionalFindingIds: selection.additionalFindings.map((finding) => finding.insightId),
      suppressed: selection.suppressedFindings.map(({ finding, reasons }) => ({ insightId: finding.insightId, reasons })),
      counts: selection.counts,
    },
    dataAccessSummary: {
      status: accessRequests.length ? "additional_access_recommended" : governanceReviewCount ? "governance_review_required" : "local_evidence_sufficient",
      questionsNeedingWarehouseEvidence: accessRequests.length,
      uniqueTemplateCount: uniqueTemplateIds.length,
      owningTeams: unique(accessRequests.flatMap((request) => request.owningTeams)),
    },
    snowflakeEscalations,
    explorationCursor: encodeInsightDiscoveryCursor({
      version: "insight-discovery-cursor-v1",
      runId,
      runSequence,
      snapshotFingerprint,
      excludedPrimaryFindingIds: cumulativeExcludedPrimaryFindingIds,
    }),
    runAudit: {
      previousRunId: input.previousRunId ?? null,
      mode,
      snapshotFingerprint,
      previousSnapshotFingerprint: input.previousSnapshotFingerprint ?? null,
      reranHypothesisCount: CURRENT_DATA_HYPOTHESES.length + TABLEAU_CVC_OUTCOME_ANALYSES.length,
      excludedPreviousPrimaryFindingIds,
      newPrimaryFindingIds: primaryFindingIds.filter((findingId) => !previousPrimaryIds.has(findingId)),
      repeatedPrimaryFindingIds: primaryFindingIds.filter((findingId) => previousPrimaryIds.has(findingId)),
    },
    traces,
    limitations: [
      "The autonomous run uses the reviewed local hypothesis registry; it does not yet ask an external model to invent arbitrary SQL.",
      "Findings are descriptive investigation leads from currently approved snapshots, not causal conclusions or authority for price, spend, clinic, lease, or other material action.",
      "Cross-department findings remain separate when geography, period, definitions, or approved crosswalks are incompatible.",
      mode === "same_snapshot_reprioritization"
        ? "This rerun used the same approved snapshot set and reprioritized the next qualified findings; it did not refresh source data."
        : "A scheduled production run still needs durable persistence, refresh-event orchestration, receiving-team notifications, and feedback on whether prior findings produced value.",
    ],
    opportunityRun,
  };
}
