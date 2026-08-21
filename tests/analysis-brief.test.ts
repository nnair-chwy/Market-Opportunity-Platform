import assert from "node:assert/strict";
import test from "node:test";
import { analysisBriefWeightTotal, buildAnalysisBrief, describeAnalysisReframe, validateAnalysisBriefConsistency } from "../lib/planning/analysis-brief.ts";
import { runMarketInvestigation } from "../lib/planning/market-investigation.ts";
import { planEvaluation } from "../lib/planning/planner.ts";

test("national CVC investigation stays evidence-readiness work without an invented ranking", () => {
  const plan = planEvaluation("Which comparable markets differ most in clinic footprint and demand?", "cvc");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.equal(brief.originalQuestion, plan.originalQuestion);
  assert.equal(plan.resultWorkspaceType, "evidence_readiness");
  assert.match(brief.rewrittenQuestion, /national CVC footprint and public market context/i);
  assert.doesNotMatch(brief.rewrittenQuestion, /3[–-]5|rank|shortlist/i);
  assert.equal(analysisBriefWeightTotal(brief), 0);
  assert.equal(brief.queryContract?.scoringVersion, null);
  assert.deepEqual(brief.queryContract?.registeredQueries, []);
  assert.deepEqual(validateAnalysisBriefConsistency(plan, brief), []);
});

test("named-market CVC location brief preserves Phoenix and uses the executable query contract", () => {
  const plan = planEvaluation("What evidence should we review before opening a clinic in Phoenix?", "cvc");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.equal(plan.intent.topic, "clinic_location");
  assert.equal(plan.intent.requestedAction, "investigate");
  assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, ["38060"]);
  assert.match(brief.rewrittenQuestion, /Phoenix-Mesa-Chandler, AZ/i);
  assert.match(brief.rewrittenQuestion, /what.*evidence.*remains unknown/i);
  assert.doesNotMatch(brief.rewrittenQuestion, /3[–-]5|which markets.*first|rank/i);
  assert.deepEqual(brief.queryContract?.geographyIds, ["cbsa:38060"]);
  assert.deepEqual(brief.queryContract?.registeredQueries, ["regional_context_by_cbsa", "clinic_context_by_cbsa"]);
  assert.deepEqual(validateAnalysisBriefConsistency(plan, brief), []);
});

test("selected map geography is explained as part of the automatic runnable reframe", () => {
  const plan = planEvaluation(
    "Where should Marketing spend more on ads?",
    "marketing",
    [{ cbsaCode: "47930", cbsaName: "Waterbury-Shelton, CT" }],
    "paid_search_cpc",
  );
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const note = describeAnalysisReframe(plan, brief);
  assert.match(brief.rewrittenQuestion, /Waterbury-Shelton, CT/i);
  assert.equal(note.changed, true);
  assert.match(note.summary, /selected map context: Waterbury-Shelton, CT/i);
  assert.match(note.reason, /map selection.*analytical scope/i);
});

test("analysis brief consistency rejects geography, query, and unsupported ranking drift", () => {
  const plan = planEvaluation("What evidence should we review before opening a clinic in Phoenix?", "cvc");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const inconsistent = {
    ...brief,
    rewrittenQuestion: "Rank the top 3-5 U.S. markets for the next clinic.",
    queryContract: { ...brief.queryContract!, geographyIds: ["cbsa:42660"], registeredQueries: ["clinic_context_by_cbsa" as const] },
  };
  const issues = validateAnalysisBriefConsistency(plan, inconsistent);
  assert.ok(issues.some((issue) => /geography IDs/i.test(issue)));
  assert.ok(issues.some((issue) => /registered queries/i.test(issue)));
  assert.ok(issues.some((issue) => /ranking language/i.test(issue)));
});

test("a common metro alias preserves the resolved market in a rewritten question", () => {
  const plan = planEvaluation("Describe the population of the Dallas metro.", "marketing");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const rewritten = { ...brief, rewrittenQuestion: "Describe total population for the Dallas metro area." };
  assert.deepEqual(validateAnalysisBriefConsistency(plan, rewritten), []);
});

test("Marketing analysis brief separates influence weights from validity roles", () => {
  const plan = planEvaluation("Which comparable markets could support a valid marketing test?", "marketing");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.equal(analysisBriefWeightTotal(brief), 100);
  assert.ok(brief.considerations.every((item) => item.weightPercent !== null));
  assert.ok(brief.considerations.some((item) => item.id === "media_isolation" && item.role === "validity_gate"));
});

test("a regional ad-cost question is not rewritten as a growth-test ranking", () => {
  const plan = planEvaluation("What area are we paying too much on ads?", "marketing", [], "paid_search_cpc");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.match(brief.rewrittenQuestion, /cost|cpc|paid search|ads/i);
  assert.doesNotMatch(brief.rewrittenQuestion, /rank complete-evidence regional growth-test candidates/i);
});

test("an explicit price-increase question keeps its decision intent ahead of the active evidence view", () => {
  const plan = planEvaluation("Where can we raise the price?", "pricing", [], "competitor_availability");
  const brief = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  assert.match(plan.intent.conciseInterpretation, /regions.*raising prices/i);
  assert.match(brief.rewrittenQuestion, /regions.*raising prices/i);
  assert.match(brief.rewrittenQuestion, /customer demand.*unit economics.*competitive price position/i);
  assert.doesNotMatch(brief.rewrittenQuestion, /where monitored competitor availability differs/i);
});
