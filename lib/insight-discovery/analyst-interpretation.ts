import type { PerspectiveId } from "../perspectives/contracts.ts";
import {
  getReceivingTeam,
  type FindingTeamRoute,
  type ReceivingTeamId,
} from "../planning/receiving-team-catalog.ts";
import type { AutonomousInsight } from "./current-data-discovery.ts";

export const AUTONOMOUS_ANALYST_INTERPRETATION_VERSION = "autonomous-analyst-interpretation-v1" as const;

export type AnalystActionabilityLevel = "decision_ready" | "test_ready" | "investigation_ready" | "descriptive_only";
export type AnalystEvidenceReadinessStatus = "connected" | "missing" | "incompatible";
export type AnalystEvidenceReadiness = {
  firstPartyOutcome: AnalystEvidenceReadinessStatus;
  actionGuardrails: AnalystEvidenceReadinessStatus;
  geographyCompatibility: AnalystEvidenceReadinessStatus;
  cohortComparability: AnalystEvidenceReadinessStatus;
  accountableApproval: AnalystEvidenceReadinessStatus;
  missingEvidence?: string[];
  contraryEvidence?: string[];
};

export type AnalystSourceLineage = {
  sourceId: string;
  snapshotVersion: string;
  role: "signal" | "first_party_outcome" | "guardrail" | "contrary";
  description: string;
};

export type AutonomousAnalystInterpretationInput = {
  finding: AutonomousInsight;
  teamRoute: FindingTeamRoute;
  evidenceReadiness: AnalystEvidenceReadiness;
  sourceLineage: AnalystSourceLineage[];
  siblingFindings?: AutonomousInsight[];
};

export type AutonomousAnalystInterpretation = {
  version: typeof AUTONOMOUS_ANALYST_INTERPRETATION_VERSION;
  insightId: string;
  decisionQuestion: string;
  analystConclusion: string;
  recommendedNextDecisionOrAction: string;
  recommendationKind: "authorized_review" | "controlled_test" | "investigate_only" | "no_action";
  applicabilityScope: {
    department: PerspectiveId;
    marketIds: string[];
    marketName: string;
    statement: string;
  };
  actionabilityLevel: AnalystActionabilityLevel;
  evidenceFor: string[];
  contraryOrLimitingEvidence: string[];
  exactMissingEvidence: string[];
  receivingTeam: {
    teamId: ReceivingTeamId;
    label: string;
    reason: string;
  };
  validationPartner: {
    teamId: ReceivingTeamId;
    label: string;
    reason: string;
  };
  whyThisMattersToBusinessOutcome: string;
  sourceLineage: AnalystSourceLineage[];
  approvalBoundary: string;
};

type DepartmentPolicy = {
  decisionQuestion: (finding: AutonomousInsight) => string;
  businessOutcome: string;
  signalBoundary: string;
  missing: {
    firstPartyOutcome: string;
    actionGuardrails: string;
    geographyCompatibility: string;
    cohortComparability: string;
    accountableApproval: string;
  };
  next: Record<AnalystActionabilityLevel, (finding: AutonomousInsight) => string>;
};

const POLICIES: Record<PerspectiveId, DepartmentPolicy> = {
  marketing: {
    decisionQuestion: (finding) => `Should ${finding.marketName} advance from a paid-media signal into a bounded incrementality test or authorized media-plan review?`,
    businessOutcome: "This matters only if the regional pattern predicts incremental new customers, orders, net sales, or contribution after channel substitution and operating constraints.",
    signalBoundary: "Paid-search CPC, delivery, clicks, and platform-attributed conversions are descriptive platform signals; they do not establish incremental business impact or authority to change spend.",
    missing: {
      firstPartyOutcome: "Approved regional new-customer, order, net-sales, and contribution outcomes aligned to campaign geography, attribution definition, and lag window.",
      actionGuardrails: "A pre-registered test/control design with power, budget bounds, channel-substitution and contamination checks, success threshold, stop rule, and rollback rule.",
      geographyCompatibility: "An approved campaign-geography to customer-outcome crosswalk with explicit target, presence, interest, DMA, ZIP, and CBSA semantics.",
      cohortComparability: "Comparable account, tactic, audience, creative, promotion, funnel, and time cohorts for treatment and control.",
      accountableApproval: "Authorized Growth Marketing and budget-owner review for any spend, targeting, or campaign change.",
    },
    next: {
      decision_ready: (finding) => `Route ${finding.marketName} to the authorized Growth Marketing decision review using the bounded test result and guardrails; do not execute a spend change from this interpretation alone.`,
      test_ready: (finding) => `Pre-register a reversible paid-media test for ${finding.marketName}; hold live spend constant until the authorized test and budget approvals are recorded.`,
      investigation_ready: (finding) => `Investigate ${finding.marketName} by joining the signal to compatible first-party outcomes and designing the missing incrementality guardrails; do not recommend increasing or reducing live spend yet.`,
      descriptive_only: (finding) => `Keep ${finding.marketName} as descriptive context only and resolve lineage or compatibility before prioritizing a media investigation.`,
    },
  },
  pricing: {
    decisionQuestion: (finding) => `Should ${finding.marketName} advance from a competitor-condition signal into a matched-SKU pricing test or authorized price review?`,
    businessOutcome: "This matters only if the observed competitor condition changes customer response, units, sales, contribution, or margin under Chewy's actual price, cost, promotion, and MAP constraints.",
    signalBoundary: "Competitor availability, observed offer price, assortment, and monitoring volume do not establish Chewy profitability, elasticity, customer response, or authority to change price.",
    missing: {
      firstPartyOutcome: "Compatible regional sales, units, contribution or margin, discount, return, and customer-response outcomes joined to matched Chewy SKU, price, promotion, and cost evidence.",
      actionGuardrails: "A controlled price-test design with elasticity status, MAP and policy constraints, materiality threshold, success measure, stop rule, rollback rule, and Pricing approval gate.",
      geographyCompatibility: "An approved competitor observation geography to Chewy outcome geography crosswalk at a compatible ZIP, market, SKU, and period grain.",
      cohortComparability: "Stable matched-SKU, package-equalization, availability, coupon, retailer, category, freshness, and observation-coverage cohorts.",
      accountableApproval: "Authorized Pricing review for any price, match, promotion, or override decision.",
    },
    next: {
      decision_ready: (finding) => `Route ${finding.marketName} to authorized Pricing decision review with matched economics and test results; do not execute a price or match change from this interpretation alone.`,
      test_ready: (finding) => `Pre-register a reversible matched-SKU pricing test for ${finding.marketName}; keep live price unchanged until authorized test approval.`,
      investigation_ready: (finding) => `Investigate ${finding.marketName} with matched Chewy SKU economics and regional customer outcomes; do not recommend a live price, match, or promotion change yet.`,
      descriptive_only: (finding) => `Keep ${finding.marketName} as a competitor-monitoring diagnostic until geography, SKU, period, and lineage are compatible.`,
    },
  },
  cvc: {
    decisionQuestion: (finding) => `Should ${finding.marketName} advance from a clinic-footprint signal into capacity validation, market diligence, or authorized site review?`,
    businessOutcome: "This matters only if the market improves appointment access, staffed capacity utilization, mature-clinic performance, and sustainable clinic economics after supply and feasibility constraints.",
    signalBoundary: "Clinic count and public household context do not measure trade-area demand, drive-time access, appointment capacity, mature-clinic performance, site feasibility, or authority to select a site.",
    missing: {
      firstPartyOutcome: "Approved appointment demand, staffed or schedulable capacity, clinic maturity, mature-clinic performance, customer demand, and clinic economics for a comparable market and peer cohort.",
      actionGuardrails: "Market and site diligence covering veterinary supply, workforce, drive time, competition, property, regulatory, physical inspection, economics, stop rules, and lease/opening approval gates.",
      geographyCompatibility: "An approved clinic, trade-area, drive-time, customer, and market crosswalk rather than a public CBSA boundary alone.",
      cohortComparability: "A documented clinic maturity rule and comparable peer cohort with aligned performance period, service mix, staffing, capacity, and market conditions.",
      accountableApproval: "Authorized Clinic Operations, Real Estate, clinical, finance, and lease/opening review for any site or footprint decision.",
    },
    next: {
      decision_ready: (finding) => `Route ${finding.marketName} to the authorized clinic/site decision review with capacity, maturity, feasibility, economics, and physical diligence attached; do not select or approve a site from this interpretation alone.`,
      test_ready: (finding) => `Begin the approved capacity and market-diligence protocol for ${finding.marketName}; do not select a site, sign a lease, or authorize an opening.`,
      investigation_ready: (finding) => `Investigate ${finding.marketName} by connecting appointment, capacity, maturity, trade-area, supply, and feasibility evidence; do not prioritize or select a site yet.`,
      descriptive_only: (finding) => `Keep ${finding.marketName} as footprint context only until clinic identity, geography, cohort, and lineage are compatible.`,
    },
  },
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isConnected(status: AnalystEvidenceReadinessStatus) {
  return status === "connected";
}

function determineActionability(
  readiness: AnalystEvidenceReadiness,
  lineageComplete: boolean,
  hasFirstPartyOutcomeLineage: boolean,
  hasGuardrailLineage: boolean,
): AnalystActionabilityLevel {
  if (!lineageComplete || readiness.geographyCompatibility === "incompatible" || readiness.cohortComparability === "incompatible") return "descriptive_only";
  const outcomeReady = isConnected(readiness.firstPartyOutcome) && hasFirstPartyOutcomeLineage;
  const guardrailsReady = isConnected(readiness.actionGuardrails) && hasGuardrailLineage;
  const comparable = isConnected(readiness.geographyCompatibility) && isConnected(readiness.cohortComparability);
  if (outcomeReady && guardrailsReady && comparable && isConnected(readiness.accountableApproval)) return "decision_ready";
  if (outcomeReady && guardrailsReady && comparable) return "test_ready";
  return "investigation_ready";
}

function validationPartner(route: FindingTeamRoute) {
  return route.partnerTeams.find((partner) => partner.teamId === "measurement_analytics")
    ?? route.partnerTeams[0]
    ?? { teamId: "measurement_analytics" as const, reason: "Validate evidence compatibility, quality, causality, and completion rules." };
}

function sameScopeSibling(finding: AutonomousInsight, route: FindingTeamRoute, sibling: AutonomousInsight) {
  return sibling.insightId !== finding.insightId
    && sibling.department === finding.department
    && sibling.applicability.primaryTeamId === route.primaryTeam.teamId
    && sibling.marketIds.some((marketId) => finding.marketIds.includes(marketId));
}

export function interpretAutonomousFinding(input: AutonomousAnalystInterpretationInput): AutonomousAnalystInterpretation {
  const { finding, teamRoute, evidenceReadiness } = input;
  if (teamRoute.input.perspectiveId !== finding.department) {
    throw new Error("The analyst team route does not match the finding department.");
  }
  if (teamRoute.primaryTeam.teamId !== finding.applicability.primaryTeamId) {
    throw new Error("The analyst team route does not match the finding receiving team.");
  }

  const sourceLineage = [...input.sourceLineage]
    .filter((item) => item.sourceId.trim() && item.snapshotVersion.trim() && item.description.trim())
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.snapshotVersion.localeCompare(right.snapshotVersion) || left.role.localeCompare(right.role));
  const lineageSourceIds = new Set(sourceLineage.map((item) => item.sourceId));
  const missingFindingLineage = finding.sourceIds.filter((sourceId) => !lineageSourceIds.has(sourceId));
  const lineageComplete = sourceLineage.length > 0 && missingFindingLineage.length === 0;
  const hasFirstPartyOutcomeLineage = sourceLineage.some((item) => item.role === "first_party_outcome");
  const hasGuardrailLineage = sourceLineage.some((item) => item.role === "guardrail");
  const actionabilityLevel = determineActionability(evidenceReadiness, lineageComplete, hasFirstPartyOutcomeLineage, hasGuardrailLineage);
  const policy = POLICIES[finding.department];

  const missing: string[] = [...(evidenceReadiness.missingEvidence ?? [])];
  for (const key of ["firstPartyOutcome", "actionGuardrails", "geographyCompatibility", "cohortComparability", "accountableApproval"] as const) {
    if (!isConnected(evidenceReadiness[key])) missing.push(policy.missing[key]);
  }
  if (isConnected(evidenceReadiness.firstPartyOutcome) && !hasFirstPartyOutcomeLineage) missing.push(`Source lineage for the claimed first-party outcome: ${policy.missing.firstPartyOutcome}`);
  if (isConnected(evidenceReadiness.actionGuardrails) && !hasGuardrailLineage) missing.push(`Source lineage for the claimed action guardrails: ${policy.missing.actionGuardrails}`);
  if (missingFindingLineage.length) missing.push(`Versioned source lineage for finding source(s): ${missingFindingLineage.join(", ")}.`);

  const siblings = (input.siblingFindings ?? [])
    .filter((sibling) => sameScopeSibling(finding, teamRoute, sibling))
    .sort((left, right) => right.signalCount - left.signalCount || left.insightId.localeCompare(right.insightId));
  const evidenceFor = unique([
    finding.evidenceDetail,
    `The finding appeared in ${finding.signalCount} reviewed screen${finding.signalCount === 1 ? "" : "s"}: ${finding.hypothesisIds.join(", ")}.`,
    ...siblings.map((sibling) => `Same-market sibling finding ${sibling.insightId}: ${sibling.evidenceDetail}`),
  ]);
  const contraryOrLimitingEvidence = unique([
    policy.signalBoundary,
    ...(evidenceReadiness.contraryEvidence ?? []),
    ...(evidenceReadiness.geographyCompatibility === "incompatible" ? [policy.missing.geographyCompatibility] : []),
    ...(evidenceReadiness.cohortComparability === "incompatible" ? [policy.missing.cohortComparability] : []),
  ]);
  const receiving = getReceivingTeam(teamRoute.primaryTeam.teamId);
  const partnerRoute = validationPartner(teamRoute);
  const partner = getReceivingTeam(partnerRoute.teamId);
  const isClinicCapacityReview = finding.department === "cvc" && teamRoute.primaryTeam.teamId === "clinic_operations";
  const conclusionSuffix: Record<AnalystActionabilityLevel, string> = {
    decision_ready: "The supplied outcome, compatibility, guardrail, lineage, and approval gates support authorized decision review, not automatic execution.",
    test_ready: "The supplied outcome, compatibility, guardrail, and lineage gates support a controlled test, but not a live lever change.",
    investigation_ready: "The signal is worth investigating, but unresolved outcome or guardrail evidence prevents a material recommendation.",
    descriptive_only: "Lineage or compatibility limits this to descriptive context.",
  };

  return {
    version: AUTONOMOUS_ANALYST_INTERPRETATION_VERSION,
    insightId: finding.insightId,
    decisionQuestion: isClinicCapacityReview
      ? `Should ${finding.marketName} advance into an appointment-demand, staffed-capacity, and data-quality validation with Clinic Operations?`
      : policy.decisionQuestion(finding),
    analystConclusion: `${finding.headline}. ${conclusionSuffix[actionabilityLevel]}`,
    recommendedNextDecisionOrAction: isClinicCapacityReview && actionabilityLevel === "investigation_ready"
      ? `Validate appointment demand, staffed and schedulable capacity, status accuracy, clinic maturity, and utilization in ${finding.marketName}; do not add staffing or capacity from this signal yet.`
      : isClinicCapacityReview && actionabilityLevel === "descriptive_only"
        ? `Keep ${finding.marketName} as clinic-capacity context only until appointment, staffing, maturity, and lineage are compatible.`
        : policy.next[actionabilityLevel](finding),
    recommendationKind: actionabilityLevel === "decision_ready"
      ? "authorized_review"
      : actionabilityLevel === "test_ready"
        ? "controlled_test"
        : actionabilityLevel === "investigation_ready"
          ? "investigate_only"
          : "no_action",
    applicabilityScope: {
      department: finding.department,
      marketIds: [...finding.marketIds],
      marketName: finding.marketName,
      statement: `Applies only to ${finding.marketName} and the reviewed ${finding.department} evidence represented by ${finding.sourceIds.join(", ")}; it is not a national or cross-department conclusion.`,
    },
    actionabilityLevel,
    evidenceFor,
    contraryOrLimitingEvidence,
    exactMissingEvidence: unique(missing),
    receivingTeam: {
      teamId: receiving.id,
      label: receiving.label,
      reason: teamRoute.primaryTeam.reason,
    },
    validationPartner: {
      teamId: partner.id,
      label: partner.label,
      reason: partnerRoute.reason,
    },
    whyThisMattersToBusinessOutcome: policy.businessOutcome,
    sourceLineage,
    approvalBoundary: teamRoute.approvalBoundary,
  };
}
