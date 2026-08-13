import assert from "node:assert/strict";
import test from "node:test";
import { planEvaluation } from "../lib/planning/index.ts";
import { buildAnalysisBrief } from "../lib/planning/analysis-brief.ts";
import { answerInvestigationFollowUp, runConfirmedMarketInvestigation, runMarketInvestigation } from "../lib/planning/market-investigation.ts";

test("stores the exact submitted question with a CVC investigation", () => {
  const question = "Which comparable markets differ most in clinic access and demand—and why?";
  const plan = planEvaluation(question);
  const investigation = runMarketInvestigation(plan);

  assert.equal(investigation.originalQuestion, question);
  assert.equal(investigation.planId, plan.planId);
  assert.equal(investigation.perspectiveId, "cvc");
  assert.equal(investigation.leads.length, 6);
  assert.ok(investigation.comparisonsExamined > investigation.leads.length);
  assert.deepEqual(investigation.sourceIds, ["SRC-009", "SRC-016"]);
  assert.equal(investigation.scoringEligibility, "none");
});

test("screens question-specific marketing peers without pretending to assign test markets", () => {
  const question = "Which comparable markets could support a valid marketing test, and what makes them different?";
  const plan = planEvaluation(question);
  const investigation = runMarketInvestigation(plan);

  assert.equal(plan.intent.topic, "local_growth");
  assert.equal(investigation.originalQuestion, question);
  assert.equal(investigation.perspectiveId, "marketing");
  assert.equal(investigation.leads.length, 6);
  assert.match(investigation.readiness.summary, /cannot assign a valid test\/control market/i);
  assert.deepEqual(investigation.sourceIds, ["SRC-016"]);
});

test("suppresses generic patterns when connected evidence cannot answer the question", () => {
  const plan = planEvaluation("How should regional pricing strategy vary?");
  const investigation = runMarketInvestigation(plan);

  assert.equal(investigation.perspectiveId, "pricing");
  assert.equal(investigation.readiness.label, "Context only");
  assert.equal(investigation.leads.length, 0);
  assert.ok(investigation.rejectedPatterns.length > 0);
});

test("a lead-scoped follow-up stays grounded in the selected lead", () => {
  const investigation = runMarketInvestigation(planEvaluation("Which markets differ in CVC clinic footprint?", "cvc"));
  const lead = investigation.leads[0];
  const answer = answerInvestigationFollowUp(lead, "Why does this matter and what should I check?");
  assert.match(answer, new RegExp(lead.strength.split(" ")[0].replace("×", "\\×")));
  assert.match(answer, /Important boundary:/);
  assert.match(answer, /Best next check:/);
});

test("confirmed CVC opening questions stay on connected evidence without a fabricated score", () => {
  const plan = planEvaluation("Where should we open the next clinic?", "cvc");
  const proposed = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const confirmed = { ...proposed, status: "confirmed" as const, confirmedAt: "2026-08-13T12:00:00.000Z" };
  const investigation = runConfirmedMarketInvestigation(plan, confirmed);
  assert.equal(investigation.scoringEligibility, "none");
  assert.equal(investigation.leads.length, 6);
  assert.equal(investigation.formula?.reduce((total, item) => total + item.weightPercent, 0), 100);
  assert.deepEqual(investigation.sourceIds, ["SRC-009", "SRC-016"]);
  assert.match(investigation.readiness.summary, /cannot yet rank clinic opportunity/i);
});

test("human weight edits are preserved in the confirmed run without fabricating scores", () => {
  const plan = planEvaluation("Where should we open the next clinic?", "cvc");
  const proposed = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const edited = {
    ...proposed,
    status: "confirmed" as const,
    confirmedAt: "2026-08-13T12:00:00.000Z",
    considerations: proposed.considerations.map((item, index) => ({
      ...item,
      weightPercent: [10, 10, 10, 40, 30][index],
    })),
  };
  const investigation = runConfirmedMarketInvestigation(plan, edited);
  assert.deepEqual(investigation.formula?.map((item) => item.weightPercent), [10, 10, 10, 40, 30]);
  assert.equal(investigation.scoringEligibility, "none");
  assert.match(investigation.readiness.summary, /cannot yet rank clinic opportunity/i);
});

test("exploratory CVC questions remain on the published-footprint and Census path", () => {
  const plan = planEvaluation("What clinic footprint patterns are worth investigating?", "cvc");
  const proposed = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const investigation = runConfirmedMarketInvestigation(plan, { ...proposed, status: "confirmed" as const, confirmedAt: "2026-08-13T12:00:00.000Z" });
  assert.equal(proposed.currentScreen.considerationEditsRecalculate, false);
  assert.equal(proposed.considerations.some((item) => item.role === "weighted_preference"), false);
  assert.equal(investigation.scoringEligibility, "none");
  assert.deepEqual(investigation.sourceIds, ["SRC-009", "SRC-016"]);
});

test("different CVC questions keep distinct intent without changing the evidence boundary", () => {
  function run(question: string) {
    const plan = planEvaluation(question, "cvc");
    const proposed = buildAnalysisBrief(plan, runMarketInvestigation(plan));
    return {
      rewrittenQuestion: proposed.rewrittenQuestion,
      result: runConfirmedMarketInvestigation(plan, { ...proposed, status: "confirmed" as const, confirmedAt: "2026-08-13T12:00:00.000Z" }),
    };
  }
  const demand = run("Which markets have the strongest customer demand growth?");
  const supply = run("Where is veterinary supply whitespace?");
  assert.notEqual(demand.rewrittenQuestion, supply.rewrittenQuestion);
  assert.deepEqual(demand.result.sourceIds, supply.result.sourceIds);
  assert.equal(demand.result.scoringEligibility, "none");
  assert.equal(supply.result.scoringEligibility, "none");
});
