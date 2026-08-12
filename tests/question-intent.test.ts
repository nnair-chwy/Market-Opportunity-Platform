import assert from "node:assert/strict";
import test from "node:test";
import { confirmQuestionIntent, interpretQuestionPrototype, makeQuestionIntentDecisionReady, proposedWeightTotal, questionIntentSchema } from "../lib/decision-agent/index.ts";

test("broad marketing question becomes a specific editable decision intent", () => {
  const intent = interpretQuestionPrototype("Where should we spend more?");
  assert.deepEqual(questionIntentSchema.parse(intent), intent);
  assert.match(intent.decision, /markets.*paid-marketing test/i);
  assert.match(intent.action, /do not authorize/i);
  assert.ok(intent.assumptions.length > 0);
  assert.ok(intent.ambiguities.some((item) => /KPI|budget/i.test(item)));
  assert.equal(intent.confirmation_status, "proposed");
});

test("broad clinic question becomes a bounded peer-review decision", () => {
  const intent = interpretQuestionPrototype("Which clinics need help?");
  assert.match(intent.decision, /mature clinics.*performance review/i);
  assert.equal(intent.entity, "Aggregate clinic-period");
  assert.match(intent.ambiguities.join(" "), /performance KPI/i);
  assert.equal(confirmQuestionIntent(intent).confirmation_status, "confirmed");
});

test("unsupported question asks for business meaning instead of inventing an evaluation", () => {
  const intent = interpretQuestionPrototype("What should we do next?");
  assert.match(intent.decision, /clarify/i);
  assert.match(intent.outcome, /not yet defined/i);
  assert.ok(intent.ambiguities.length > 0);
});

test("vague AI fields are replaced with specific editable domain assumptions", () => {
  const fallback = interpretQuestionPrototype("Where should we open the next clinic?");
  const refined = makeQuestionIntentDecisionReady("Where should we open the next clinic?", {
    ...fallback,
    decision: "Select a location for the next clinic opening",
    stakeholder: "not yet defined",
    entity: "next clinic",
    geography: "candidate geographies not yet defined",
    period: "decision timing and planning horizon not yet defined",
    outcome: "not yet defined; define the clinic-opening objective",
    denominator: "not yet defined",
    assumptions: ["No definition of clinic success has been provided"],
    ambiguities: ["Who has authority to make the final location decision"],
  });
  assert.match(refined.decision, /3–5 U\.S\. metro areas/i);
  assert.match(refined.outcome, /24 months after opening/i);
  assert.match(refined.action, /3–5 markets/i);
  assert.doesNotMatch(JSON.stringify(refined), /not yet defined/i);
  assert.ok(refined.assumptions.some((item) => /general-practice CVC clinic/i.test(item)));
  assert.equal(proposedWeightTotal(refined), 100);
  assert.deepEqual(refined.proposed_weights.map((item) => item.label), ["Patient demand", "Unmet access", "Veterinary whitespace", "Operating fit"]);
});

test("causal marketing and clinic peer review do not invent weighted recommendation scores", () => {
  assert.deepEqual(interpretQuestionPrototype("Where should we spend more?").proposed_weights, []);
  assert.deepEqual(interpretQuestionPrototype("Which clinics need help?").proposed_weights, []);
});

test("clinic whitespace remains a descriptive access-and-supply screen", () => {
  const intent = interpretQuestionPrototype("Where does Chewy have clinic whitespace today?");
  assert.match(intent.decision, /addressable pet demand.*current CVC access.*veterinary supply/i);
  assert.match(intent.action, /do not select a next-clinic market/i);
  assert.deepEqual(intent.proposed_weights.map((item) => item.weight_percent), [40, 35, 25]);
  assert.equal(proposedWeightTotal(intent), 100);
});

test("pricing questions use reported stakeholder research without claiming a production decision", () => {
  const intent = interpretQuestionPrototype("Where might regional pricing make sense?");
  assert.match(intent.decision, /regional-pricing experiment/i);
  assert.match(intent.ideal_evidence.join(" "), /competitor price.*ZIP sample/i);
  assert.match(intent.research_plan.join(" "), /Ram Shenoy/i);
  assert.deepEqual(intent.proposed_weights, []);
});
