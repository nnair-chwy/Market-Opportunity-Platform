import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalysisBrief } from "../lib/planning/analysis-brief.ts";
import {
  buildEvidencePlan,
  generateEvaluationDefinitionDraft,
  requestEvidenceCorrection,
  stageEvidence,
} from "../lib/planning/evidence-plan.ts";
import { runMarketInvestigation } from "../lib/planning/market-investigation.ts";
import { planEvaluation } from "../lib/planning/planner.ts";

function contextFor(question: string, perspective: "cvc" | "marketing" | "pricing") {
  const plan = planEvaluation(question, perspective);
  const investigation = runMarketInvestigation(plan);
  const brief = buildAnalysisBrief(plan, investigation);
  return { plan, investigation, brief };
}

test("CVC evidence plan separates usable context from missing decision evidence", () => {
  const { plan, investigation, brief } = contextFor("Where does clinic access differ from addressable demand?", "cvc");
  const evidencePlan = buildEvidencePlan(plan);
  assert.equal(evidencePlan.items.find((item) => item.id === "public_market_context")?.availability, "available");
  assert.equal(evidencePlan.items.find((item) => item.id === "published_cvc_footprint")?.availability, "partial");
  assert.equal(evidencePlan.items.find((item) => item.id === "addressable_pet_demand")?.availability, "missing");
  const definition = generateEvaluationDefinitionDraft(brief, investigation, evidencePlan);
  assert.equal(definition.status, "partially_executable");
  assert.match(definition.strongestAllowedConclusion, /no access, demand, causal, or opportunity conclusion/i);
  assert.ok(definition.blockers.some((blocker) => /Addressable pet and customer demand/.test(blocker)));
});

test("staged evidence remains quarantined and does not become available", () => {
  const { plan, investigation, brief } = contextFor("Which markets could support a valid marketing test?", "marketing");
  const initial = buildEvidencePlan(plan);
  const staged = stageEvidence(initial, "media_exposure", {
    id: "staged-google-ads",
    fileName: "geo-report.csv",
    mediaType: "text/csv",
    sizeBytes: 1024,
    note: "Campaign geography export awaiting grain and conversion-goal validation.",
    stagedAt: "2026-08-13T19:00:00.000Z",
    state: "staged_for_review",
  });
  assert.equal(staged.items.find((item) => item.id === "media_exposure")?.availability, "missing");
  const definition = generateEvaluationDefinitionDraft(brief, investigation, staged);
  assert.deepEqual(definition.stagedEvidenceIds, ["staged-google-ads"]);
  assert.ok(!definition.availableEvidenceIds.includes("media_exposure"));
  assert.ok(definition.steps.some((step) => /quarantined/i.test(step)));
});

test("human correction requests are preserved without rewriting evidence status", () => {
  const { plan } = contextFor("Where might regional pricing response differ?", "pricing");
  const initial = buildEvidencePlan(plan);
  const corrected = requestEvidenceCorrection(initial, "price_exposure", "Ram's governed export is available in the pricing workspace.");
  const priceExposure = corrected.items.find((item) => item.id === "price_exposure");
  assert.equal(priceExposure?.availability, "missing");
  assert.match(priceExposure?.correctionRequest ?? "", /Ram's governed export/);
  assert.equal(corrected.items.find((item) => item.id === "public_market_context")?.availability, "incompatible");
});

test("generated definition follows the human-confirmed framing exactly", () => {
  const { plan, investigation, brief } = contextFor("Where is CVC whitespace?", "cvc");
  const confirmed = {
    ...brief,
    status: "confirmed" as const,
    rewrittenQuestion: "Compare published CVC footprint with public market context, then identify validation leads only.",
    confirmedAt: "2026-08-13T19:00:00.000Z",
  };
  const definition = generateEvaluationDefinitionDraft(confirmed, investigation, buildEvidencePlan(plan));
  assert.equal(definition.question, confirmed.rewrittenQuestion);
  assert.equal(definition.currentMethod, investigation.screeningScope.selectionRule);
});
