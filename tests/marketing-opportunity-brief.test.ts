import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmptyTeamOpportunityBrief,
  buildMarketingOpportunityBrief,
  buildTeamOpportunityBrief,
  runCurrentDataInsightDiscovery,
  type CurrentDataDiscoveryRun,
  type TeamOpportunityBriefScope,
} from "../lib/insight-discovery/index.ts";

const run = runCurrentDataInsightDiscovery({ runId: "team-brief:test", now: () => "2026-08-20T12:00:00.000Z" });

function eligibleFindingIds(scope: TeamOpportunityBriefScope) {
  return new Set([
    ...run.adaptiveDiscovery.findings
      .filter((finding) => scope === "all" || finding.departments.includes(scope))
      .map((finding) => finding.id),
    ...run.findings
      .filter((finding) => scope === "all" || finding.department === scope)
      .map((finding) => finding.insightId),
  ]);
}

test("team briefs contain only evidence-derived moves from the requested scope", () => {
  for (const scope of ["all", "marketing", "pricing", "cvc"] as const) {
    const brief = buildTeamOpportunityBrief(run, scope);
    const eligibleIds = eligibleFindingIds(scope);
    assert.equal(brief.scope, scope);
    assert.ok(brief.opportunityMoves.length > 0);
    assert.ok(brief.opportunityMoves.every((move) => eligibleIds.has(move.findingId)));
    assert.deepEqual(brief.sourceIds, [...new Set(brief.opportunityMoves.flatMap((move) => move.sourceIds))]);
    assert.ok(brief.opportunityMoves.every((move) => move.evidence.trim() && move.action.trim()));
  }
});

test("Marketing compatibility brief derives its claims from the supplied run", () => {
  const brief = buildMarketingOpportunityBrief(run);
  const text = JSON.stringify(brief);
  assert.match(brief.title, /regional Marketing opportunities/i);
  assert.equal(brief.primaryTeam, "Growth Marketing");
  assert.ok(brief.opportunityMoves.every((move) => run.adaptiveDiscovery.findings.some((finding) => finding.id === move.findingId)));
  assert.doesNotMatch(text, /Costa|Angelakis/i);
});

test("an empty or missing run never fabricates saved market claims", () => {
  const emptyRun: CurrentDataDiscoveryRun = {
    ...run,
    findings: [],
    primaryFindings: [],
    additionalFindings: [],
    adaptiveDiscovery: { ...run.adaptiveDiscovery, findings: [], generatedCount: 0, testedCount: 0 },
  };
  const emptyFromRun = buildTeamOpportunityBrief(emptyRun, "marketing");
  const emptyWithoutRun = buildEmptyTeamOpportunityBrief("marketing");
  const compatibilityEmpty = buildMarketingOpportunityBrief();
  for (const brief of [emptyFromRun, emptyWithoutRun, compatibilityEmpty]) {
    assert.equal(brief.opportunityMoves.length, 0);
    assert.equal(brief.sourceIds.length, 0);
    assert.doesNotMatch(JSON.stringify(brief), /Louisville|Lubbock|Wilkes|Denver|Fort Lauderdale/i);
  }
});

test("team decision rules retain scale, protect, split, and stop boundaries", () => {
  for (const scope of ["all", "marketing", "pricing", "cvc"] as const) {
    const brief = buildTeamOpportunityBrief(run, scope);
    assert.match(brief.decisionRules.scale, /Scale only/i);
    assert.match(brief.decisionRules.protect, /Protect/i);
    assert.match(brief.decisionRules.split, /Split/i);
    assert.match(brief.decisionRules.stop, /Stop|reverse/i);
    assert.match(brief.evidenceBoundary, /only findings present|supplied discovery run/i);
  }
});
