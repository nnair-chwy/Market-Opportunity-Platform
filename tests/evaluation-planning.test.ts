import assert from "node:assert/strict";
import test from "node:test";
import {
  compileEvaluationPlan,
  evaluationPlanSchema,
  inferPlanningIntent,
  planEvaluation,
} from "../lib/planning/index.ts";

test("public market questions compile to governed Census context", () => {
  const plan = planEvaluation("Which U.S. markets have the highest population density?");
  assert.equal(plan.capabilityId, "census_market_context");
  assert.equal(plan.intent.requestedMeasure, "population_density");
  assert.equal(plan.status, "executable");
  assert.equal(plan.resultWorkspaceType, "adaptive_market_workspace");
  assert.ok(["national", "needs_selection"].includes(plan.geographyResolution.mode));
  assert.equal(plan.geographyResolution.selectedCbsaCodes.includes("42660"), false);
  assert.match(plan.evidenceBoundary, /does not rank business opportunity/i);
  assert.equal(plan.findings.some((finding) => /Three governed/i.test(finding.title)), false);
  assert.match(plan.findings.find((finding) => finding.kind === "actions")?.title ?? "", /Proposed action/);
  evaluationPlanSchema.parse(plan);
});

test("deterministic planning resolves ordinary Atlanta metro phrasing", () => {
  for (const question of [
    "What is the population of the Atlanta metro?",
    "What is the population of the Atlanta metropolitan area?",
    "What is the population of Atlanta, GA?",
    "What is the population of the Atlanta market?",
  ]) {
    const plan = planEvaluation(question);
    assert.equal(plan.intent.requestedPlaces[0]?.name, "Atlanta");
    assert.equal(plan.geographyResolution.mode, "single");
    assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, ["12060"]);
  }
});

test("AI geography text is normalized and resolved only through the question and CBSA universe", () => {
  const base = inferPlanningIntent("What is the population of the Atlanta metro?");

  const empty = compileEvaluationPlan(
    "What is the population of the Atlanta metro?",
    { ...base, requestedPlaces: [] },
    "ai_proposed",
  );
  assert.equal(empty.intent.requestedPlaces[0]?.name, "Atlanta");
  assert.deepEqual(empty.geographyResolution.selectedCbsaCodes, ["12060"]);

  for (const requestedPlaces of [
    [{ name: "Atlanta metro", stateHint: null }],
    [{ name: "Atlanta", stateHint: "GA" }],
  ]) {
    const plan = compileEvaluationPlan(
      "What is the population of the Atlanta metro?",
      { ...base, requestedPlaces },
      "ai_proposed",
    );
    assert.equal(plan.intent.requestedPlaces[0]?.name, "Atlanta");
    assert.deepEqual(plan.geographyResolution.selectedCbsaCodes, ["12060"]);
    assert.equal(plan.geographyResolution.places[0]?.cbsaCode, "12060");
  }
});

test("ambiguous and unavailable AI geography remains blocked without invented identifiers", () => {
  const ambiguousQuestion = "What is the population of Springfield?";
  const ambiguousIntent = inferPlanningIntent(ambiguousQuestion);
  const ambiguous = compileEvaluationPlan(
    ambiguousQuestion,
    { ...ambiguousIntent, requestedPlaces: [{ name: "Springfield metro", stateHint: null }] },
    "ai_proposed",
  );
  assert.equal(ambiguous.status, "blocked");
  assert.equal(ambiguous.geographyResolution.mode, "clarification");
  assert.deepEqual(ambiguous.geographyResolution.selectedCbsaCodes, []);
  assert.ok(ambiguous.geographyResolution.places[0]?.candidates.length);

  const unavailableQuestion = "What is the population of Atlantis metro?";
  const unavailableIntent = inferPlanningIntent(unavailableQuestion);
  const unavailable = compileEvaluationPlan(
    unavailableQuestion,
    { ...unavailableIntent, requestedPlaces: [{ name: "Atlantis metro", stateHint: null }] },
    "ai_proposed",
  );
  assert.equal(unavailable.status, "blocked");
  assert.equal(unavailable.geographyResolution.mode, "unavailable");
  assert.deepEqual(unavailable.geographyResolution.selectedCbsaCodes, []);
  assert.equal(unavailable.geographyResolution.places[0]?.cbsaCode, null);
});

test("clinic approval requests preserve the human approval gate", () => {
  const plan = planEvaluation("Where should Chewy approve opening a new clinic?");
  assert.equal(plan.capabilityId, "clinic_site_evaluation");
  assert.equal(plan.resultWorkspaceType, "clinic_evaluation_surface");
  assert.equal(plan.actions.some((action) => action.requiresApproval), true);
  assert.match(plan.missingApprovals.join(" "), /material site decision approval/i);
  assert.ok(plan.steps.some((step) => /permitted evaluation|accountable review|evidence gates/i.test(step.label)));
});

test("campaign requests stop at unavailable governed evidence", () => {
  const plan = planEvaluation("Which markets should receive a new awareness campaign?");
  assert.equal(plan.capabilityId, "local_growth_test");
  assert.equal(plan.status, "blocked");
  assert.equal(plan.resultWorkspaceType, "evidence_readiness");
  assert.ok(plan.missingEvidence.length > 0);
  assert.ok(plan.steps.every((step) => !/Run deterministic operators/i.test(step.label)));
});

test("two materially different questions produce different plans and routes", () => {
  const density = planEvaluation("Compare Austin and Denver by population density.");
  const performance = planEvaluation("Why are operating clinics underperforming their peers?");
  assert.equal(density.capabilityId, "census_market_context");
  assert.equal(density.resultWorkspaceType, "adaptive_market_workspace");
  assert.equal(density.geographyResolution.mode, "compare");
  assert.deepEqual(density.geographyResolution.selectedCbsaCodes, ["12420", "19740"]);
  assert.equal(performance.capabilityId, "clinic_performance");
  assert.equal(performance.resultWorkspaceType, "evidence_readiness");
  assert.notEqual(density.steps.map((step) => step.id).join(","), performance.steps.map((step) => step.id).join(","));
});

test("Seattle is selected only when the question resolves it", () => {
  const seattle = planEvaluation("Which Seattle-area markets should we investigate for a future Chewy Vet Care clinic?");
  const national = planEvaluation("Which U.S. markets have the highest population density?");
  assert.equal(seattle.geographyResolution.mode, "single");
  assert.deepEqual(seattle.geographyResolution.selectedCbsaCodes, ["42660"]);
  assert.equal(national.geographyResolution.selectedCbsaCodes.includes("42660"), false);
});

test("named non-Seattle markets resolve and compare in question order", () => {
  const phoenix = planEvaluation("Should we approve a new campaign in Phoenix?");
  assert.equal(phoenix.capabilityId, "local_growth_test");
  assert.equal(phoenix.geographyResolution.mode, "single");
  assert.deepEqual(phoenix.geographyResolution.selectedCbsaCodes, ["38060"]);
  assert.equal(phoenix.resultWorkspaceType, "evidence_readiness");

  const compare = planEvaluation("Compare Austin and Denver by population density.");
  assert.deepEqual(compare.geographyResolution.selectedCbsaCodes, ["12420", "19740"]);
  assert.equal(compare.intent.requestedMeasure, "population_density");
});

test("ambiguous and unsupported questions show clarification or evidence readiness", () => {
  const vague = planEvaluation("What should we do next?");
  assert.equal(vague.resultWorkspaceType, "clarification");
  assert.equal(vague.intent.clarificationRequired, true);
  assert.equal(vague.status, "blocked");
  assert.match(vague.findings.map((finding) => finding.title).join(" "), /clarification|Interpreted|Capability/i);
  assert.equal(/actionable at the market and evidence level/i.test(vague.findings.map((f) => f.detail).join(" ")), false);

  const portland = inferPlanningIntent("Compare Portland markets by population.");
  const compiled = compileEvaluationPlan("Compare Portland markets by population.", {
    ...portland,
    requestedPlaces: [{ name: "Portland", stateHint: null }],
  });
  assert.equal(compiled.geographyResolution.mode, "clarification");
  assert.equal(compiled.resultWorkspaceType, "clarification");
});

test("AI-proposed and deterministic-fallback modes remain visible on compiled plans", () => {
  const fallback = planEvaluation("Compare Austin and Denver by population density.");
  const ai = compileEvaluationPlan(
    "Compare Austin and Denver by population density.",
    fallback.intent,
    "ai_proposed",
  );
  assert.equal(fallback.proposalMethod, "deterministic_fallback");
  assert.equal(ai.proposalMethod, "ai_proposed");
  assert.match(ai.findings.find((finding) => finding.kind === "capability")?.detail ?? "", /AI-proposed intent/);
  assert.match(fallback.findings.find((finding) => finding.kind === "capability")?.detail ?? "", /deterministic fallback/);
});

test("clinic performance, clinic location, local growth, and Census context use different workflows", () => {
  const plans = [
    planEvaluation("Which Seattle-area markets should we investigate for a future Chewy Vet Care clinic?"),
    planEvaluation("Compare Austin and Denver by population density."),
    planEvaluation("Why are operating clinics underperforming their peers?"),
    planEvaluation("Should we approve a new campaign in Phoenix?"),
  ];
  const signatures = plans.map((plan) => `${plan.capabilityId}|${plan.resultWorkspaceType}|${plan.steps.map((step) => step.id).join(">")}`);
  assert.equal(new Set(signatures).size, signatures.length);
  assert.ok(plans.every((plan) => plan.findings.some((finding) => finding.kind === "actions" && finding.title === "Proposed action")));
  assert.ok(plans.some((plan) => plan.missingEvidence.length > 0 || plan.missingApprovals.length > 0));
});

test("exploratory CVC and Marketing questions assume a national cohort instead of asking for one", () => {
  const marketing = planEvaluation("Which comparable markets could support a valid marketing test, and what makes them different?", "marketing");
  const cvc = planEvaluation("Which comparable markets differ most in clinic footprint and demand, and why?", "cvc");
  assert.equal(marketing.geographyResolution.mode, "national");
  assert.equal(marketing.intent.clarificationRequired, false);
  assert.equal(marketing.actions[0].id, "review-marketing-market-leads");
  assert.equal(cvc.geographyResolution.mode, "national");
  assert.equal(cvc.intent.clarificationRequired, false);
  assert.equal(cvc.actions[0].id, "review-cvc-market-leads");
});

test("Google Ads questions route to blocked Marketing evidence readiness", () => {
  const national = planEvaluation(
    "Which U.S. DMAs show promising Google Ads demand and acquisition efficiency?",
    "marketing",
  );
  assert.equal(national.intent.topic, "local_growth");
  assert.equal(national.intent.requestedMeasure, "none");
  assert.equal(national.capabilityId, "local_growth_test");
  assert.equal(national.status, "blocked");
  assert.equal(national.resultWorkspaceType, "evidence_readiness");
  assert.match(national.missingEvidence.join(" "), /weekly DMA campaign aggregate/i);
  assert.match(national.missingEvidence.join(" "), /first-party regional outcome/i);
  assert.match(national.missingEvidence.join(" "), /campaign taxonomy/i);
  assert.match(national.missingEvidence.join(" "), /DMA-to-market/i);
  assert.match(national.missingEvidence.join(" "), /attribution.*lag/i);
  assert.match(national.missingEvidence.join(" "), /geo-experiment design/i);
  assert.match(national.missingApprovals.join(" "), /growth-test measurement approval/i);
  assert.equal(national.actions.some((action) => /increase.*spend/i.test(action.title)), false);

  const compare = planEvaluation(
    "Compare Phoenix and Seattle as geo-test markets using Google Ads performance.",
    "marketing",
  );
  assert.equal(compare.intent.topic, "local_growth");
  assert.equal(compare.geographyResolution.mode, "compare");
  assert.equal(compare.capabilityId, "local_growth_test");
  assert.equal(compare.status, "blocked");
  assert.equal(compare.resultWorkspaceType, "evidence_readiness");
});
