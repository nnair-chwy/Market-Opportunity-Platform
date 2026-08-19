import assert from "node:assert/strict";
import test from "node:test";
import {
  ANSWER_CONTRACT_VERSION,
  answerContractSchema,
  assembleReviewableActionPacket,
  formatReviewableActionPacketDocument,
  planEvaluation,
} from "../lib/planning/index.ts";

test("every plan defines the same required answer structure before investigation", () => {
  const plans = [
    planEvaluation("Describe the population of the Dallas metro."),
    planEvaluation("Which comparable markets differ most in CVC footprint?", "cvc"),
    planEvaluation("Which DMAs should receive more paid-search spend?", "marketing"),
    planEvaluation("Where should Chewy change regional prices?", "pricing"),
  ];

  for (const plan of plans) {
    const contract = answerContractSchema.parse(plan.answerContract);
    assert.equal(contract.version, ANSWER_CONTRACT_VERSION);
    assert.equal(contract.planId, plan.planId);
    assert.equal(contract.requiredSections.length, 7);
    assert.deepEqual(contract.requiredSections.map((section) => section.sectionId), [
      "direct_answer",
      "evidence_findings",
      "contrary_evidence",
      "uncertainty",
      "missing_evidence",
      "source_and_version_notes",
      "permitted_next_action",
    ]);
    assert.equal(contract.claimRules.sourceIdsRequiredForFactualClaims, true);
    assert.equal(contract.claimRules.numericClaimsMustResolveToStructuredEvidence, true);
    assert.ok(contract.completionCriteria.some((criterion) => criterion.criterionId === "covers_domain_requirements"));
  }
});

test("Clinic contract requires demand, capacity, feasibility, and accountable review", () => {
  const contract = planEvaluation("Which comparable markets differ most in clinic footprint and demand?", "cvc").answerContract;
  assert.equal(contract.perspectiveId, "cvc");
  assert.deepEqual(contract.domainRequirements.map((item) => item.requirementId), [
    "cvc_demand_outcome",
    "cvc_access_capacity",
    "cvc_supply_feasibility",
    "cvc_human_judgment",
  ]);
  assert.match(contract.strongestPermittedConclusion, /clinic|market|review/i);
  assert.match(contract.prohibitedConclusions.join(" "), /lease|opening/i);
});

test("Marketing contract preserves geography semantics and requires incrementality evidence", () => {
  const contract = planEvaluation("Which DMAs should receive more paid-search spend?", "marketing").answerContract;
  assert.equal(contract.answerMode, "investigation");
  assert.equal(contract.fallbackOutcome, "draft_for_review");
  assert.ok(contract.domainRequirements.some((item) => item.requirementId === "marketing_geography" && item.sourceIds.includes("SRC-019")));
  assert.ok(contract.domainRequirements.some((item) => item.requirementId === "marketing_incrementality" && item.sourceIds.includes("SRC-022")));
  assert.ok(contract.domainRequirements.every((item) => item.readiness !== "connected"));
  assert.match(contract.prohibitedConclusions.join(" "), /causal lift|spend change/i);
});

test("Pricing contract distinguishes a competitor diagnostic from local profit and price action", () => {
  const contract = planEvaluation("Where should Chewy change regional prices?", "pricing").answerContract;
  assert.equal(contract.perspectiveId, "pricing");
  assert.ok(contract.domainRequirements.some((item) => item.requirementId === "pricing_competitor_condition" && item.readiness === "documented_not_approved"));
  assert.ok(contract.domainRequirements.some((item) => item.requirementId === "pricing_customer_outcome" && item.readiness === "missing"));
  assert.match(contract.strongestPermittedConclusion, /clarification/i);
  assert.match(contract.prohibitedConclusions.join(" "), /contribution profit|price change/i);
});

test("ambiguous questions define a clarification answer instead of an investigation", () => {
  const contract = planEvaluation("What should we do next?").answerContract;
  assert.equal(contract.answerMode, "clarification");
  assert.equal(contract.fallbackOutcome, "clarification");
  assert.match(contract.strongestPermittedConclusion, /clarification/i);
});

test("the reviewable packet retains the exact pre-investigation answer contract", () => {
  const plan = planEvaluation("Which DMAs should receive more paid-search spend?", "marketing");
  const packet = assembleReviewableActionPacket(plan);
  assert.deepEqual(packet.answerContract, plan.answerContract);
  const document = formatReviewableActionPacketDocument(packet);
  assert.match(document, /Final-answer contract/);
  assert.match(document, /Required answer sections/);
  assert.match(document, /Marketing answer requirements/i);
  assert.match(document, /documented not approved/i);
  assert.match(document, /Prohibited conclusions/);
});

test("answer contract rejects duplicate domain requirement identifiers", () => {
  const contract = planEvaluation("Which DMAs should receive more paid-search spend?", "marketing").answerContract;
  assert.throws(() => answerContractSchema.parse({
    ...contract,
    domainRequirements: [contract.domainRequirements[0], contract.domainRequirements[0], contract.domainRequirements[1]],
  }), /unique/i);
});
