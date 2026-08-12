import assert from "node:assert/strict";
import test from "node:test";
import { planEvaluation } from "../lib/planning/index.ts";
import { answerInvestigationFollowUp, runMarketInvestigation } from "../lib/planning/market-investigation.ts";

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
