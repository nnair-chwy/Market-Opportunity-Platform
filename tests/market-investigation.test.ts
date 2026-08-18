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
  assert.match(investigation.leads[0].title, /lightly covered relative to its household size/i);
  assert.match(investigation.leads[0].observation, /This metro has .* households and .* published CVC clinic/i);
  assert.match(investigation.leads[0].businessMeaning, /priority for demand and capacity validation—not proof/i);
  assert.doesNotMatch(investigation.leads[0].observation, /produce .* households per clinic/i);
});

test("screens question-specific marketing peers without pretending to assign test markets", () => {
  const question = "Which comparable markets could support a valid marketing test, and what makes them different?";
  const plan = planEvaluation(question);
  const investigation = runMarketInvestigation(plan);

  assert.equal(plan.intent.topic, "local_growth");
  assert.equal(investigation.originalQuestion, question);
  assert.equal(investigation.perspectiveId, "marketing");
  assert.equal(investigation.leads.length, 5);
  assert.match(investigation.readiness.summary, /selected approved snapshot/i);
  assert.deepEqual(investigation.sourceIds, ["SRC-018", "SRC-016"]);
  assert.ok(investigation.leads.every((lead) => (lead.supportingMeasures?.length ?? 0) >= 12));
  assert.deepEqual(investigation.investigationPath.slice(0, 3).map((step) => step.status), ["completed", "completed", "completed"]);
  assert.equal(investigation.dataSnapshotVersion.includes("google-ads"), true);
});

test("suppresses generic patterns when connected evidence cannot answer the question", () => {
  const plan = planEvaluation("How should regional pricing strategy vary?");
  const investigation = runMarketInvestigation(plan);

  assert.equal(investigation.perspectiveId, "pricing");
  assert.equal(investigation.readiness.label, "Partial answer");
  assert.equal(investigation.leads.length, 5);
  assert.deepEqual(investigation.sourceIds, ["SRC-025", "SRC-028", "SRC-030", "SRC-016"]);
  assert.ok(investigation.leads.every((lead) => (lead.supportingMeasures?.length ?? 0) >= 8));
  assert.deepEqual(investigation.investigationPath.slice(0, 3).map((step) => step.status), ["completed", "completed", "completed"]);
  assert.ok(investigation.rejectedPatterns.length > 0);
});

test("an explicitly selected Pricing view remains Pricing for a generic question", () => {
  const plan = planEvaluation(
    "Which regions need a closer review?",
    "pricing",
    "competitor_availability",
  );
  const investigation = runMarketInvestigation(plan);

  assert.equal(plan.perspectiveId, "pricing");
  assert.equal(investigation.perspectiveId, "pricing");
  assert.match(investigation.readiness.summary, /competitor availability/i);
  assert.ok(investigation.leads.every((lead) => lead.measureValue?.percentile));
});

test("pricing language does not accidentally resolve Price, Utah", () => {
  const plan = planEvaluation(
    "which market should we price differently",
    "pricing",
    "competitor_availability",
  );
  const investigation = runMarketInvestigation(plan);

  assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, []);
  assert.notEqual(plan.geographyResolution.message.includes("Price, UT"), true);
  assert.equal(investigation.leads.length, 5);
  assert.ok(investigation.comparisonsExamined > 0);
});

test("a CPC question consumes the selected CSV-derived snapshot without claiming overpayment", () => {
  const plan = planEvaluation("Which region are we paying more than we should for ads?", "marketing");
  const investigation = runMarketInvestigation(plan);
  assert.equal(plan.evidenceSelection.datasetId, "marketing_paid_search_cpc");
  assert.deepEqual(investigation.measuresExamined.slice(0, 8), [
    "Cost",
    "Average CPC",
    "Impressions",
    "Clicks",
    "Click-through rate",
    "Attributed conversions",
    "Attributed conversion rate",
    "Cost per attributed conversion",
  ]);
  assert.equal(investigation.leads.length, 5);
  assert.ok(investigation.leads.every((lead) => lead.measureValue?.formattedValue.startsWith("$")));
  assert.ok(investigation.leads.every((lead) => (lead.supportingMeasures?.length ?? 0) >= 6));
  assert.match(investigation.leads[0].challenge, /not governed orders/i);
  assert.match(investigation.rejectedPatterns.join(" "), /overpayment/i);
  assert.equal(investigation.evidenceStage, "signal");
  assert.doesNotMatch(investigation.leads[0].observation, /cost divided by clicks|google-ads-\d/i);
  assert.match(investigation.leads[0].observation, /closest measured metros by population, households, income, and density/i);
  assert.match(investigation.leads[0].observation, /average CPC .*cost per attributed conversion .*attributed conversion rate/i);
  assert.match(investigation.leads[0].businessMeaning, /before changing spend/i);
  assert.match(investigation.leads[0].nextEvidence, /before changing spend/i);
  assert.match(investigation.nextPass.question, /orders, new customers, net sales, and contribution/i);
  assert.deepEqual(investigation.investigationPath.map((step) => step.status), ["completed", "completed", "completed", "completed", "waiting_for_evidence", "waiting_for_evidence"]);
  assert.match(investigation.investigationPath[2].contributionToAnswer, /attributed conversion efficiency/i);
  assert.match(investigation.investigationPath[5].contributionToAnswer, /business value/i);
});

test("spending more than we should routes to comparable-market efficiency analysis", () => {
  const question = "where are we spending more than we should on ads";
  const plan = planEvaluation(question, "marketing");
  const investigation = runMarketInvestigation(plan);

  assert.equal(plan.evidenceSelection.datasetId, "marketing_paid_search_cpc");
  assert.match(plan.intent.conciseInterpretation, /cost per click is high and attributed conversion efficiency is weak/i);
  assert.equal(investigation.leads.length, 5);
  assert.ok(investigation.leads.every((lead) => /comparable markets|similar markets/i.test(lead.title)));
  assert.ok(investigation.leads.every((lead) => /20 closest measured metros/i.test(lead.observation)));
  assert.doesNotMatch(investigation.leads.map((lead) => lead.title).join(" "), /generated more click volume/i);
});

test("different Pricing views run different snapshot measures", () => {
  const availability = runMarketInvestigation(planEvaluation("Review regional competition", "pricing", "competitor_availability"));
  const price = runMarketInvestigation(planEvaluation("Review regional offer levels", "pricing", "observed_equalized_price"));
  assert.notEqual(availability.dataSnapshotLabel, price.dataSnapshotLabel);
  assert.notEqual(availability.measuresExamined[0], price.measuresExamined[0]);
  assert.notDeepEqual(availability.leads.map((lead) => lead.id), price.leads.map((lead) => lead.id));
});

test("an uncovered named Pricing market returns a clear zero-result state", () => {
  const plan = planEvaluation(
    "Review competitor availability in Abilene",
    "pricing",
    "competitor_availability",
  );
  const investigation = runMarketInvestigation(plan);

  assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, ["10180"]);
  assert.equal(investigation.comparisonsExamined, 0);
  assert.equal(Object.is(investigation.comparisonsExamined, -0), false);
  assert.equal(investigation.leads.length, 0);
  assert.equal(investigation.readiness.label, "Context only");
  assert.match(investigation.readiness.summary, /no compatible observed competitor availability row for Abilene/i);
  assert.match(investigation.screeningScope.selectionRule, /do not substitute a different market/i);
});

test("a lead-scoped follow-up stays grounded in the selected lead", () => {
  const investigation = runMarketInvestigation(planEvaluation("Which markets differ in CVC clinic footprint?", "cvc"));
  const lead = investigation.leads[0];
  const answer = answerInvestigationFollowUp(lead, "Why does this matter and what should I check?");
  assert.match(answer, new RegExp(`${lead.strength.split("×")[0]} times`, "i"));
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

test("a named CVC geography limits leads to the requested market", () => {
  const plan = planEvaluation("Where should we investigate a new clinic in Phoenix?", "cvc");
  const investigation = runMarketInvestigation(plan);

  assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, ["38060"]);
  assert.ok(investigation.leads.length > 0);
  assert.ok(investigation.leads.every((lead) => lead.marketIds.includes("38060")));
  assert.equal(investigation.dataSnapshotVersion, "SRC-009-footprint+SRC-016-acs-2024");
});

test("different named CVC locations do not reuse the same result leads", () => {
  const phoenix = runMarketInvestigation(
    planEvaluation("Where should we investigate a new clinic in Phoenix?", "cvc"),
  );
  const seattle = runMarketInvestigation(
    planEvaluation("Where should we investigate a new clinic in Seattle?", "cvc"),
  );

  assert.ok(phoenix.leads.length > 0);
  assert.ok(phoenix.leads.every((lead) => lead.marketIds.includes("38060")));
  assert.equal(seattle.leads.length, 0);
  assert.notDeepEqual(
    phoenix.leads.map((lead) => lead.id),
    seattle.leads.map((lead) => lead.id),
  );
});
