import type { PerspectiveId } from "../perspectives/contracts.ts";
import type { AdaptiveDecisionFinding } from "./adaptive-decision-insights.ts";
import type { AutonomousInsight, CurrentDataDiscoveryRun } from "./current-data-discovery.ts";

export const TEAM_OPPORTUNITY_BRIEF_VERSION = "team-opportunity-brief-v1" as const;

export type TeamOpportunityBriefScope = "all" | PerspectiveId;

export type TeamOpportunityMove = {
  findingId: string;
  market: string;
  decision: string;
  evidence: string;
  action: string;
  sourceIds: string[];
};

export type TeamOpportunityBrief = {
  version: typeof TEAM_OPPORTUNITY_BRIEF_VERSION;
  scope: TeamOpportunityBriefScope;
  title: string;
  primaryTeam: string;
  partnerTeams: string[];
  recommendation: string;
  why: string;
  opportunityMoves: TeamOpportunityMove[];
  portfolioImplications: string[];
  primaryOutcomes: string[];
  evidenceNeededToScale: string[];
  decisionRules: { scale: string; protect: string; split: string; stop: string };
  evidenceBoundary: string;
  sourceIds: string[];
};

const SCOPE_COPY: Record<TeamOpportunityBriefScope, {
  title: string;
  primaryTeam: string;
  partnerTeams: string[];
  primaryOutcomes: string[];
}> = {
  all: {
    title: "The cross-team opportunities supported by this run",
    primaryTeam: "Market Opportunity review",
    partnerTeams: ["Growth Marketing", "Pricing", "CVC Strategy and Clinic Operations", "Measurement and Finance"],
    primaryOutcomes: ["Incremental contribution", "Incremental customers or completed appointments", "Operational feasibility"],
  },
  marketing: {
    title: "The regional Marketing opportunities supported by this run",
    primaryTeam: "Growth Marketing",
    partnerTeams: ["Marketing Measurement", "Regional test planning", "Finance"],
    primaryOutcomes: ["Incremental new customers", "Incremental orders or completed appointments", "Incremental contribution after media cost", "Retention or repeat behavior"],
  },
  pricing: {
    title: "The Pricing opportunities supported by this run",
    primaryTeam: "Pricing",
    partnerTeams: ["Pricing Science", "Merchandising", "Finance", "Measurement"],
    primaryOutcomes: ["Incremental contribution after unit response", "Customer retention", "Competitive position", "Price-test validity"],
  },
  cvc: {
    title: "The CVC opportunities supported by this run",
    primaryTeam: "CVC Strategy and Clinic Operations",
    partnerTeams: ["CVC Marketing", "Clinic Operations", "Finance", "Measurement"],
    primaryOutcomes: ["Incremental completed appointments", "New-to-Chewy appointments", "Clinic contribution", "Staffed-capacity utilization"],
  },
};

const DECISION_BY_KIND: Record<AdaptiveDecisionFinding["findingKind"], string> = {
  opportunity: "Protect the signal and validate incremental value",
  contradiction: "Separate the decisions before reallocating",
  quality: "Repair the evidence before ranking the opportunity",
  price_test: "Review a bounded matched-SKU price test",
  competitive_risk: "Review competitive exposure before changing price",
  cross_functional: "Coordinate the cross-team validation",
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function diverseAdaptiveFindings(findings: AdaptiveDecisionFinding[], limit: number) {
  const selected: AdaptiveDecisionFinding[] = [];
  const seenKinds = new Set<AdaptiveDecisionFinding["findingKind"]>();
  for (const finding of findings) {
    if (seenKinds.has(finding.findingKind)) continue;
    selected.push(finding);
    seenKinds.add(finding.findingKind);
    if (selected.length === limit) return selected;
  }
  for (const finding of findings) {
    if (selected.some((candidate) => candidate.id === finding.id)) continue;
    selected.push(finding);
    if (selected.length === limit) break;
  }
  return selected;
}

function adaptiveCandidates(run: CurrentDataDiscoveryRun, scope: TeamOpportunityBriefScope) {
  if (scope !== "all") return diverseAdaptiveFindings(run.adaptiveDiscovery.findings.filter((finding) => finding.departments.includes(scope)), 6);
  const crossFunctional = run.adaptiveDiscovery.findings.filter((finding) => finding.departments.length > 1);
  const strongestByTeam = (["marketing", "pricing", "cvc"] as const).flatMap((department) => {
    const finding = run.adaptiveDiscovery.findings.find((candidate) => candidate.departments.includes(department));
    return finding ? [finding] : [];
  });
  return diverseAdaptiveFindings([...new Map([...crossFunctional, ...strongestByTeam].map((finding) => [finding.id, finding])).values()], 6);
}

function adaptiveMove(finding: AdaptiveDecisionFinding): TeamOpportunityMove {
  return {
    findingId: finding.id,
    market: finding.geography.label,
    decision: DECISION_BY_KIND[finding.findingKind],
    evidence: unique([finding.implication, ...finding.evidence]).slice(0, 2).join(" "),
    action: finding.proposedAction,
    sourceIds: unique(finding.sourceIds),
  };
}

function standardMove(finding: AutonomousInsight): TeamOpportunityMove {
  return {
    findingId: finding.insightId,
    market: finding.marketName,
    decision: finding.headline,
    evidence: finding.evidenceDetail,
    action: finding.analystInterpretation?.recommendedNextDecisionOrAction ?? finding.nextValidation,
    sourceIds: unique(finding.sourceIds),
  };
}

function standardCandidates(run: CurrentDataDiscoveryRun, scope: TeamOpportunityBriefScope) {
  const ordered = [...run.primaryFindings, ...run.findings.filter((finding) => !run.primaryFindings.some((primary) => primary.insightId === finding.insightId))];
  return ordered.filter((finding) => scope === "all" || finding.department === scope).slice(0, scope === "all" ? 6 : 4);
}

function decisionRules(scope: TeamOpportunityBriefScope): TeamOpportunityBrief["decisionRules"] {
  const lever = scope === "marketing" ? "media" : scope === "pricing" ? "price" : scope === "cvc" ? "clinic capacity, media, or footprint" : "material business";
  return {
    scale: `Scale only when a compatible controlled comparison shows incremental business value and the accountable owner approves the ${lever} change.`,
    protect: "Protect a repeatable signal from broad cuts or overrides while its business outcome is validated.",
    split: "Split the decision whenever accounts, channels, categories, retailers, or operating contexts point in different directions.",
    stop: "Stop or reverse when the advantage disappears on governed outcomes, a guardrail fails, or the evidence is stale, incompatible, or incomplete.",
  };
}

export function buildTeamOpportunityBrief(run: CurrentDataDiscoveryRun, scope: TeamOpportunityBriefScope): TeamOpportunityBrief {
  const copy = SCOPE_COPY[scope];
  const adaptive = adaptiveCandidates(run, scope);
  const moves = adaptive.length ? adaptive.map(adaptiveMove) : standardCandidates(run, scope).map(standardMove);
  const selectedIds = new Set(moves.map((move) => move.findingId));
  const selectedAdaptive = run.adaptiveDiscovery.findings.filter((finding) => selectedIds.has(finding.id));
  const selectedStandard = run.findings.filter((finding) => selectedIds.has(finding.insightId));
  const evidenceNeededToScale = unique([
    ...selectedAdaptive.flatMap((finding) => finding.limits),
    ...selectedStandard.flatMap((finding) => finding.businessValue.requiredInputs),
  ]).slice(0, 8);
  const recommendation = moves.length
    ? moves.slice(0, 3).map((move) => `${move.market}: ${move.evidence}`).join(" ")
    : `No ${scope === "all" ? "cross-team" : scope} opportunity in this run has enough evidence for a reviewable move.`;
  const portfolioImplications = moves.map((move) => `${move.market}: ${move.decision}.`).slice(0, 4);
  const why = moves.length
    ? scope === "marketing"
      ? "These patterns help Marketing distinguish markets worth protecting or testing from markets that only look efficient in platform attribution, so the next regional review can focus on incremental customers and contribution."
      : scope === "pricing"
        ? "These patterns show where regional competitor position may affect a pricing decision and where assortment, coverage, or matched-SKU quality makes the apparent gap unreliable."
        : scope === "cvc"
          ? "These patterns connect regional demand and acquisition signals to clinic capacity and appointment outcomes, helping CVC separate a media opportunity from a footprint or operating constraint."
          : "Together, these patterns show where teams should protect an observed advantage, separate conflicting decisions, or combine evidence before treating every region the same."
    : "The run did not produce an evidence-derived move for this scope; the brief does not substitute a saved market claim or fallback recommendation.";

  return {
    version: TEAM_OPPORTUNITY_BRIEF_VERSION,
    scope,
    title: copy.title,
    primaryTeam: copy.primaryTeam,
    partnerTeams: copy.partnerTeams,
    recommendation,
    why,
    opportunityMoves: moves,
    portfolioImplications,
    primaryOutcomes: copy.primaryOutcomes,
    evidenceNeededToScale: evidenceNeededToScale.length ? evidenceNeededToScale : ["No additional evidence requirement was recorded because this run produced no scoped move."],
    decisionRules: decisionRules(scope),
    evidenceBoundary: "This brief reports only findings present in the supplied discovery run. It prioritizes accountable review or controlled validation and does not authorize an automatic spend, price, clinic, lease, staffing, or footprint change.",
    sourceIds: unique(moves.flatMap((move) => move.sourceIds)),
  };
}

export function buildEmptyTeamOpportunityBrief(scope: TeamOpportunityBriefScope): TeamOpportunityBrief {
  const copy = SCOPE_COPY[scope];
  return {
    version: TEAM_OPPORTUNITY_BRIEF_VERSION,
    scope,
    title: copy.title,
    primaryTeam: copy.primaryTeam,
    partnerTeams: copy.partnerTeams,
    recommendation: `No ${scope === "all" ? "cross-team" : scope} opportunity is available until a completed discovery run is supplied.`,
    why: "The brief does not substitute a saved market claim or fallback recommendation when run evidence is unavailable.",
    opportunityMoves: [],
    portfolioImplications: [],
    primaryOutcomes: copy.primaryOutcomes,
    evidenceNeededToScale: ["Complete the discovery run and retain its finding lineage before generating a stakeholder brief."],
    decisionRules: decisionRules(scope),
    evidenceBoundary: "No market, metric, source, or recommendation is inferred without a supplied discovery run.",
    sourceIds: [],
  };
}
