import assert from "node:assert/strict";
import test from "node:test";
import { goldenQuestionEvidenceSchema, type GoldenQuestionFamily } from "../lib/golden-question-evidence/contracts.ts";
import { goldenQuestionFamilyForPlan } from "../lib/golden-question-evidence/execute.ts";
import { loadGoldenQuestionEvidence } from "../lib/golden-question-evidence/load.ts";
import type { EvaluationPlan } from "../lib/planning/contracts.ts";
import { executeEvaluationPlanEvidence } from "../lib/planning/execute-plan.ts";
import { planEvaluation } from "../lib/planning/planner.ts";

const QUESTIONS = {
  marketing: "Which comparable geographies show paid-search response worth validating with first-party outcomes?",
  pricing: "Where do observed competitor conditions and Chewy economics warrant investigation?",
  cvc: "Which markets show demand/footprint contrasts worth deeper clinic-access investigation?",
} as const;

function executableGoldenPlan(family: GoldenQuestionFamily): EvaluationPlan {
  const activeView = family === "marketing"
    ? "paid_search_response"
    : family === "pricing"
      ? "competitor_availability"
      : "market_expansion_context";
  const plan = planEvaluation(QUESTIONS[family], family, [], activeView);
  assert.equal(plan.status, "partially_executable");
  assert.equal(plan.geographyResolution.mode, "national");
  return plan;
}

test("loads the checked-in golden evidence through a strict typed contract", async () => {
  const snapshot = await loadGoldenQuestionEvidence();
  assert.equal(snapshot.snapshotId, "golden-question-evidence-2026-08-18-v1");
  assert.equal(snapshot.actionAuthority, "investigation_leads_only_no_material_action");
  assert.deepEqual(Object.fromEntries(Object.entries(snapshot.candidates).map(([family, rows]) => [family, rows.length])), {
    marketing: 5,
    pricing: 1,
    cvc: 1,
  });
  assert.equal(goldenQuestionEvidenceSchema.safeParse({ ...snapshot, actionAuthority: "change_price" }).success, false);
});

test("recognizes only national question families and does not replace exact-geography execution", () => {
  for (const family of ["marketing", "pricing", "cvc"] as const) {
    const plan = executableGoldenPlan(family);
    assert.equal(goldenQuestionFamilyForPlan(plan), family);
    assert.equal(goldenQuestionFamilyForPlan({
      ...plan,
      geographyResolution: {
        mode: "single",
        places: [],
        selectedCbsaCodes: ["37980"],
        message: "Philadelphia selected.",
      },
    }), null);
  }
});

test("executes the Marketing golden family as partial evidence with periods, coverage, and no spend authority", async () => {
  const plan = executableGoldenPlan("marketing");
  const response = await executeEvaluationPlanEvidence({ requestId: "golden-marketing", plan });
  assert.equal(response.status, "partial");
  assert.equal(response.snapshotVersion, "golden-question-evidence-2026-08-18-v1");
  assert.equal(response.geographyIds.length, 5);
  assert.deepEqual(response.sourceIds, ["SRC-018"]);
  assert.equal(response.allowedUse, "internal_shadow_evaluation_only");
  assert.ok(response.evidenceBundle.every((item) => item.period.kind === "date_range"));
  assert.ok(response.evidenceBundle.every((item) => item.evidenceStatus === "Derived"));
  assert.ok(response.rows.every((row) => row.actionAuthority === "investigation_leads_only_no_material_action"));
  assert.ok(response.rows.every((row) => Number((row.metrics as Record<string, number>).mappedPostalGeographies) >= 10));
  assert.match(response.missingEvidence.join(" "), /first-party regional outcomes/i);
  assert.match(response.guardrails.join(" "), /cannot authorize.*spend/i);
});

test("routes the paid-search spend starter to the bounded Marketing evidence instead of an empty normalized snapshot", async () => {
  const plan = planEvaluation("Where should we increase paid search spend?", "marketing", [], "paid_search_response");
  assert.equal(plan.status, "partially_executable");
  assert.equal(goldenQuestionFamilyForPlan(plan), "marketing");
  const response = await executeEvaluationPlanEvidence({ requestId: "golden-marketing-spend", plan });
  assert.equal(response.status, "partial");
  assert.ok(response.evidenceBundle.length > 0);
  assert.match(response.guardrails.join(" "), /cannot authorize.*spend/i);
});

test("routes a plain-language ads expansion question to the bounded Marketing candidates", async () => {
  const plan = planEvaluation("where should we spend more on ads", "marketing", [], "paid_search_cpc");
  assert.equal(plan.evidenceSelection.viewId, "paid_search_response");
  assert.equal(goldenQuestionFamilyForPlan(plan), "marketing");
  const response = await executeEvaluationPlanEvidence({ requestId: "golden-marketing-plain-language", plan });
  assert.equal(response.status, "partial");
  assert.equal(response.geographyIds.length, 5);
});

test("keeps the Pricing lead a one-ZIP monitoring investigation rather than a price recommendation", async () => {
  const plan = executableGoldenPlan("pricing");
  const response = await executeEvaluationPlanEvidence({ requestId: "golden-pricing", plan });
  assert.equal(response.status, "partial");
  assert.deepEqual(response.geographyIds, ["cbsa:28100"]);
  assert.deepEqual(response.sourceIds, ["SRC-025", "SRC-036"]);
  assert.ok(response.evidenceBundle.some((item) => item.metricId === "golden.pricing.zeus.exportedProductSkus" && item.geographyId === "national:us"));
  assert.ok(response.evidenceBundle.some((item) => item.metricId === "golden.pricing.zeus.currentRegularExceptions"));
  assert.equal((response.rows[0]?.metrics as Record<string, number>).mappedZipGeographies, 1);
  assert.match(response.qualityWarnings.join(" "), /competitor-monitoring aggregates/i);
  assert.match(response.missingEvidence.join(" "), /one mapped ZIP/i);
  assert.match(response.unknowns.join(" "), /crawl coverage|assortment/i);
});

test("keeps the CVC lead at supplied-trade-area grain with an unknown observation date", async () => {
  const plan = executableGoldenPlan("cvc");
  const response = await executeEvaluationPlanEvidence({ requestId: "golden-cvc", plan });
  assert.equal(response.status, "partial");
  assert.deepEqual(response.sourceIds, ["SRC-017"]);
  assert.match(response.geographyIds[0] ?? "", /^site:esri-site-/);
  assert.ok(response.evidenceBundle.every((item) => item.period.kind === "not_provided"));
  assert.ok(response.evidenceBundle.some((item) => item.evidenceStatus === "Reported"));
  assert.ok(response.evidenceBundle.some((item) => item.evidenceStatus === "Derived"));
  assert.match(response.missingEvidence.join(" "), /capacity.*appointments.*veterinary supply/i);
  assert.match(response.unknowns.join(" "), /does not establish.*site feasibility/i);
});

test("preserves the blocked-plan execution boundary even for a matching golden prompt", async () => {
  const plan = { ...executableGoldenPlan("marketing"), status: "blocked" as const };
  const response = await executeEvaluationPlanEvidence({ requestId: "golden-blocked", plan });
  assert.equal(response.status, "blocked");
  assert.equal(response.evidenceBundle.length, 0);
  assert.match(response.missingEvidence.join(" "), /plan is blocked/i);
});
