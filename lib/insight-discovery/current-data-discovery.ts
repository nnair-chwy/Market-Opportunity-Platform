import type { PerspectiveId, PerspectiveViewId } from "../perspectives/contracts.ts";
import { publicMarkets } from "../data/public-market-ui.ts";
import { planEvaluation } from "../planning/planner.ts";
import { runMarketInvestigation, type InvestigationLead } from "../planning/market-investigation.ts";

export const CURRENT_DATA_DISCOVERY_VERSION = "current-data-insight-discovery-v1" as const;

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
  { id: "pricing-volume", department: "pricing", viewId: "offer_observation_volume", question: "Where is competitor offer monitoring unusually dense or sparse?", objective: "Separate possible market signals from data-coverage artifacts." },
  { id: "pricing-assortment", department: "pricing", viewId: "assortment_breadth", question: "Where does observed competitor assortment breadth differ most?", objective: "Find local assortment hypotheses while retaining monitoring limitations." },
  { id: "cvc-footprint", department: "cvc", viewId: "market_expansion_context", question: "Which markets have the most interesting clinic footprint and household-demand contrasts?", objective: "Find clinic access and footprint patterns worth capacity validation." },
] as const;

type LeadOccurrence = {
  hypothesis: DiscoveryHypothesis;
  lead: InvestigationLead;
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
};

export type CurrentDataDiscoveryRun = {
  version: typeof CURRENT_DATA_DISCOVERY_VERSION;
  runId: string;
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
  const cbsaCode = lead.marketIds[0];
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

function insightFromGroup(key: string, group: LeadOccurrence[]): AutonomousInsight {
  const first = group[0]!;
  const signals = unique(group.map((item) => item.lead.businessMeaning));
  const observations = unique(group.map((item) => item.lead.observation));
  const validations = unique(group.map((item) => item.lead.nextEvidence));
  const hypotheses = unique(group.map((item) => item.hypothesis));
  const name = marketName(first.lead);
  const signalCount = hypotheses.length;
  return {
    insightId: `insight:${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    department: first.hypothesis.department,
    marketIds: unique(group.flatMap((item) => item.lead.marketIds)),
    marketName: name,
    headline: signalCount > 1
      ? `${name} appears in ${signalCount} independent ${first.hypothesis.department.toUpperCase()} regional screens`
      : first.lead.title,
    whyInteresting: signalCount > 1
      ? `${signals.slice(0, 2).join(" ")} The repeated appearance makes this a higher-priority investigation lead, not a causal conclusion.`
      : signals[0] ?? "This market produced a question-compatible regional contrast.",
    evidenceDetail: observations.slice(0, 3).join(" "),
    nextValidation: validations.slice(0, 2).join(" "),
    sourceIds: unique(group.flatMap((item) => item.sourceIds)),
    snapshotVersions: unique(group.map((item) => item.snapshotVersion)),
    hypothesisIds: hypotheses.map((item) => item.id),
    signalCount,
    priority: signalCount > 1 ? "multi-signal lead" : "single-signal lead",
    question: hypotheses.map((item) => item.question).join(" "),
  };
}

export function runCurrentDataInsightDiscovery(input: { now?: () => string; runId?: string } = {}): CurrentDataDiscoveryRun {
  const now = input.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const occurrences: LeadOccurrence[] = [];
  const traces: CurrentDataDiscoveryRun["traces"] = [];
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
      sourceIds: investigation.sourceIds,
      snapshotVersion: investigation.dataSnapshotVersion,
      evidenceStage: investigation.evidenceStage,
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
  const findings = (["marketing", "pricing", "cvc"] as const).flatMap((department) => allFindings
    .filter((finding) => finding.department === department)
    .sort((left, right) => right.signalCount - left.signalCount || right.sourceIds.length - left.sourceIds.length || left.marketName.localeCompare(right.marketName))
    .slice(0, 5));

  return {
    version: CURRENT_DATA_DISCOVERY_VERSION,
    runId: input.runId ?? `discovery:${crypto.randomUUID()}`,
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
    traces,
    limitations: [
      "The autonomous run uses the reviewed local hypothesis registry; it does not yet ask an external model to invent arbitrary SQL.",
      "Findings are descriptive investigation leads from currently approved snapshots, not causal conclusions or authority for price, spend, clinic, lease, or other material action.",
      "Cross-department findings remain separate when geography, period, definitions, or approved crosswalks are incompatible.",
      "A scheduled production run still needs durable persistence, refresh-event orchestration, owner notifications, and feedback on whether prior findings produced value.",
    ],
  };
}
