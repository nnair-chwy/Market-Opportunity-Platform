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

export const CURRENT_DATA_DISCOVERY_VERSION = "current-data-insight-discovery-v2" as const;

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
  analystInterpretation?: AutonomousAnalystInterpretation;
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
  const finding: AutonomousInsight = {
    insightId: `insight:${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    department: first.hypothesis.department,
    marketIds: unique(group.flatMap((item) => item.lead.marketIds)),
    marketName: name,
    headline: signalCount > 1
      ? `${name} appears in ${signalCount} registered ${first.hypothesis.department.toUpperCase()} regional screens`
      : first.lead.title,
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
    decisionValue: decisionValueForGroup(group),
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

  const allFindings = groupOccurrences(occurrences).map(([key, group]) => insightFromGroup(key, group));
  const excludedPreviousPrimaryFindingIds = unique([
    ...(input.previouslyExcludedPrimaryFindingIds ?? []),
    ...(input.previousPrimaryFindingIds ?? []),
  ]);
  const selection = selectDiscoveryFindings(allFindings, { excludedPrimaryFindingIds: excludedPreviousPrimaryFindingIds });
  const findings = [...selection.primaryDigest, ...selection.additionalFindings];
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
    analysesRun: CURRENT_DATA_HYPOTHESES.length,
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
      reranHypothesisCount: CURRENT_DATA_HYPOTHESES.length,
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
  };
}
