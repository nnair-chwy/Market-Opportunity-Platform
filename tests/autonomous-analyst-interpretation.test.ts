import assert from "node:assert/strict";
import test from "node:test";
import type { AutonomousInsight } from "../lib/insight-discovery/current-data-discovery.ts";
import {
  interpretAutonomousFinding,
  type AnalystEvidenceReadiness,
  type AnalystSourceLineage,
} from "../lib/insight-discovery/analyst-interpretation.ts";
import { getReceivingTeam, routeAutonomousGeoFinding } from "../lib/planning/receiving-team-catalog.ts";

function finding(department: AutonomousInsight["department"], overrides: Partial<AutonomousInsight> = {}): AutonomousInsight {
  const route = routeAutonomousGeoFinding({
    perspectiveId: department,
    viewId: department === "marketing" ? "paid_search_cpc" : department === "pricing" ? "competitor_availability" : "market_expansion_context",
    topic: department === "marketing" ? "local_growth" : department === "pricing" ? "regional_context" : "clinic_location",
  });
  return {
    insightId: `${department}-finding`,
    department,
    marketIds: ["12060"],
    marketName: "Atlanta-Sandy Springs-Roswell, GA",
    headline: `${department.toUpperCase()} regional signal in Atlanta`,
    whyInteresting: "The region differs materially from the reviewed comparison cohort and warrants bounded validation.",
    evidenceDetail: "The reviewed regional metric is in an extreme percentile among compatible observations.",
    nextValidation: "Connect the signal to governed business outcomes and explicit action guardrails.",
    sourceIds: [`SRC-${department.toUpperCase()}`],
    snapshotVersions: ["snapshot-v1"],
    hypothesisIds: [`${department}-screen`],
    signalCount: 1,
    priority: "single-signal lead",
    question: "Where is the regional pattern unusually strong or weak?",
    applicability: {
      primaryTeamId: route.primaryTeam.teamId,
      primaryTeamLabel: getReceivingTeam(route.primaryTeam.teamId).label,
      reason: route.primaryTeam.reason,
      partnerTeams: route.partnerTeams.map((partner) => ({ ...partner, label: getReceivingTeam(partner.teamId).label })),
      approvalBoundary: route.approvalBoundary,
    },
    decisionValue: { score: 50, reason: "A reviewable test fixture.", flags: [] },
    valueTranslation: {
      kind: "observed_value",
      label: "Observed regional signal",
      statement: "The reviewed metric differs from its comparison cohort.",
      caveat: "This is descriptive, not causal.",
    },
    importance: {
      score: 50,
      tier: "watch",
      label: "Watch",
      reason: "The fixture does not yet justify immediate focus.",
      notificationCandidate: false,
    },
    ...overrides,
  };
}

function readiness(overrides: Partial<AnalystEvidenceReadiness> = {}): AnalystEvidenceReadiness {
  return {
    firstPartyOutcome: "missing",
    actionGuardrails: "missing",
    geographyCompatibility: "connected",
    cohortComparability: "connected",
    accountableApproval: "missing",
    ...overrides,
  };
}

function lineage(item: AutonomousInsight, extras: AnalystSourceLineage[] = []): AnalystSourceLineage[] {
  return [
    ...item.sourceIds.map((sourceId) => ({ sourceId, snapshotVersion: "snapshot-v1", role: "signal" as const, description: "Reviewed aggregate regional signal." })),
    ...extras,
  ];
}

test("Marketing CPC remains investigate-only without first-party outcomes and incrementality guardrails", () => {
  const item = finding("marketing");
  const teamRoute = routeAutonomousGeoFinding({ perspectiveId: "marketing", viewId: "paid_search_cpc", topic: "local_growth" });
  const result = interpretAutonomousFinding({ finding: item, teamRoute, evidenceReadiness: readiness(), sourceLineage: lineage(item) });

  assert.equal(result.actionabilityLevel, "investigation_ready");
  assert.equal(result.recommendationKind, "investigate_only");
  assert.match(result.recommendedNextDecisionOrAction, /do not recommend increasing or reducing live spend/i);
  assert.ok(result.exactMissingEvidence.some((gap) => /new-customer.*order.*contribution/i.test(gap)));
  assert.ok(result.exactMissingEvidence.some((gap) => /test\/control.*rollback/i.test(gap)));
  assert.equal(result.receivingTeam.teamId, "growth_marketing");
  assert.equal(result.validationPartner.teamId, "measurement_analytics");
  assert.match(result.whyThisMattersToBusinessOutcome, /incremental new customers.*orders.*contribution/i);
});

test("Pricing can become test-ready only with linked outcomes, compatibility, and guardrails", () => {
  const item = finding("pricing");
  const teamRoute = routeAutonomousGeoFinding({ perspectiveId: "pricing", viewId: "competitor_availability", topic: "regional_context" });
  const result = interpretAutonomousFinding({
    finding: item,
    teamRoute,
    evidenceReadiness: readiness({ firstPartyOutcome: "connected", actionGuardrails: "connected" }),
    sourceLineage: lineage(item, [
      { sourceId: "SRC-PRICING-OUTCOME", snapshotVersion: "outcomes-v1", role: "first_party_outcome", description: "Matched regional units and contribution." },
      { sourceId: "SRC-PRICING-GUARDRAIL", snapshotVersion: "guardrails-v1", role: "guardrail", description: "Reviewed price-test protocol and rollback rule." },
    ]),
  });

  assert.equal(result.actionabilityLevel, "test_ready");
  assert.equal(result.recommendationKind, "controlled_test");
  assert.match(result.recommendedNextDecisionOrAction, /reversible matched-SKU pricing test/i);
  assert.match(result.recommendedNextDecisionOrAction, /keep live price unchanged/i);
  assert.ok(result.exactMissingEvidence.some((gap) => /Authorized Pricing review/i.test(gap)));
  assert.match(result.contraryOrLimitingEvidence.join(" "), /competitor availability.*do not establish.*authority to change price/i);
});

test("CVC footprint stays below site authority until capacity, maturity, and diligence guardrails are linked", () => {
  const item = finding("cvc", { marketIds: ["12060", "38060"] });
  const teamRoute = routeAutonomousGeoFinding({ perspectiveId: "cvc", viewId: "market_expansion_context", topic: "clinic_location" });
  const result = interpretAutonomousFinding({
    finding: item,
    teamRoute,
    evidenceReadiness: readiness({ firstPartyOutcome: "connected" }),
    sourceLineage: lineage(item, [
      { sourceId: "SRC-CVC-OUTCOME", snapshotVersion: "clinic-outcomes-v1", role: "first_party_outcome", description: "Reviewed appointment and mature-clinic outcome cohort." },
    ]),
  });

  assert.equal(result.actionabilityLevel, "investigation_ready");
  assert.equal(result.recommendationKind, "investigate_only");
  assert.match(result.recommendedNextDecisionOrAction, /do not prioritize or select a site/i);
  assert.ok(result.exactMissingEvidence.some((gap) => /site diligence.*physical inspection.*lease\/opening/i.test(gap)));
  assert.match(result.contraryOrLimitingEvidence.join(" "), /clinic count.*do not measure.*authority to select a site/i);
  assert.equal(result.receivingTeam.teamId, "clinic_real_estate");
  assert.match(result.whyThisMattersToBusinessOutcome, /appointment access.*capacity.*mature-clinic performance/i);
});

test("decision-ready still routes to authorized review and same-scope siblings add evidence deterministically", () => {
  const item = finding("marketing");
  const sibling = finding("marketing", {
    insightId: "marketing-sibling",
    evidenceDetail: "A second reviewed screen found a compatible same-market response contrast.",
  });
  const unrelated = finding("pricing", { insightId: "unrelated", marketIds: item.marketIds });
  const teamRoute = routeAutonomousGeoFinding({ perspectiveId: "marketing", viewId: "paid_search_cpc", topic: "local_growth" });
  const result = interpretAutonomousFinding({
    finding: item,
    teamRoute,
    evidenceReadiness: readiness({ firstPartyOutcome: "connected", actionGuardrails: "connected", accountableApproval: "connected" }),
    sourceLineage: lineage(item, [
      { sourceId: "SRC-MKT-OUTCOME", snapshotVersion: "outcomes-v1", role: "first_party_outcome", description: "Regional acquisition and contribution outcomes." },
      { sourceId: "SRC-MKT-GUARDRAIL", snapshotVersion: "test-v1", role: "guardrail", description: "Approved incrementality test guardrails." },
    ]),
    siblingFindings: [unrelated, sibling],
  });

  assert.equal(result.actionabilityLevel, "decision_ready");
  assert.equal(result.recommendationKind, "authorized_review");
  assert.match(result.recommendedNextDecisionOrAction, /do not execute a spend change/i);
  assert.ok(result.evidenceFor.some((evidence) => evidence.includes("marketing-sibling")));
  assert.ok(result.evidenceFor.every((evidence) => !evidence.includes("unrelated")));
});

test("missing source lineage forces descriptive-only output", () => {
  const item = finding("pricing");
  const teamRoute = routeAutonomousGeoFinding({ perspectiveId: "pricing", viewId: "competitor_availability", topic: "regional_context" });
  const result = interpretAutonomousFinding({ finding: item, teamRoute, evidenceReadiness: readiness(), sourceLineage: [] });
  assert.equal(result.actionabilityLevel, "descriptive_only");
  assert.equal(result.recommendationKind, "no_action");
  assert.ok(result.exactMissingEvidence.some((gap) => gap.includes(item.sourceIds[0]!)));
});
