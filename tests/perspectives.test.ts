import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMeasureIsolation,
  createDefaultActiveViews,
  getDefaultView,
  getPerspectiveView,
  hasUniversalScoreField,
  isPublicContextNonScored,
  listPerspectives,
  listViewsForPerspective,
  measureBelongsToPerspective,
  perspectiveCatalog,
  perspectiveCatalogSchema,
  resolveMapPresentation,
  selectPerspectiveView,
  type PerspectiveId,
  type PerspectiveMeasureId,
} from "../lib/perspectives/index.ts";
import { planEvaluation } from "../lib/planning/index.ts";

const EXPECTED_VIEWS: Record<PerspectiveId, string[]> = {
  pricing: [
    "Price index",
    "Competitive price gaps",
    "Promotion intensity",
    "Price elasticity context",
    "Margin or contribution context",
    "Price opportunity by region",
  ],
  marketing: [
    "Customer demand",
    "Acquisition efficiency",
    "Campaign reach",
    "Conversion or booking rate",
    "Local engagement",
    "Marketing opportunity by region",
  ],
  cvc: [
    "Clinic footprint",
    "Pet ownership",
    "Household demand",
    "Access and pet demand",
    "Clinic performance context",
    "Market expansion context",
  ],
};

test("perspective catalog validates Pricing, Marketing, and CVC with typed views", () => {
  assert.equal(perspectiveCatalogSchema.safeParse(perspectiveCatalog).success, true);
  assert.deepEqual(
    listPerspectives().map((item) => item.label),
    ["Pricing", "Marketing", "CVC"],
  );
  for (const [perspectiveId, labels] of Object.entries(EXPECTED_VIEWS) as Array<
    [PerspectiveId, string[]]
  >) {
    assert.deepEqual(
      listViewsForPerspective(perspectiveId).map((view) => view.label),
      labels,
    );
  }
});

test("each perspective keeps an independent default active view", () => {
  const defaults = createDefaultActiveViews();
  assert.equal(defaults.pricing, "price_index");
  assert.equal(defaults.marketing, "customer_demand");
  assert.equal(defaults.cvc, "household_demand");
  assert.notEqual(defaults.pricing, defaults.marketing);
  assert.notEqual(defaults.marketing, defaults.cvc);
});

test("changing a view updates map title, measure, legend, and evidence boundary", () => {
  const household = resolveMapPresentation(getPerspectiveView("cvc", "household_demand"));
  const expansion = resolveMapPresentation(getPerspectiveView("cvc", "market_expansion_context"));
  const price = resolveMapPresentation(getPerspectiveView("pricing", "price_index"));

  assert.equal(household.mapTitle, "Household demand context");
  assert.equal(household.measureId, "cvc.household_demand");
  assert.match(household.legend.title, /Household percentile/i);
  assert.match(household.evidenceBoundary, /market context only/i);

  assert.equal(expansion.mapTitle, "Market expansion context");
  assert.equal(expansion.measureId, "cvc.market_expansion_context");
  assert.match(expansion.legend.title, /Population percentile/i);
  assert.notEqual(expansion.evidenceBoundary, household.evidenceBoundary);

  assert.equal(price.mapTitle, "Price index by region");
  assert.equal(price.measureId, "pricing.price_index");
  assert.equal(price.evidenceAvailability, "evidence_needed");
  assert.equal(price.mapBinding.kind, "unavailable");
});

test("unsupported or unavailable views fail safely without inventing values", () => {
  const unknown = selectPerspectiveView("cvc", "price_index");
  assert.equal("status" in unknown && unknown.status, "unavailable");

  const unavailable = resolveMapPresentation(getPerspectiveView("marketing", "campaign_reach"));
  assert.equal(unavailable.evidenceAvailability, "evidence_needed");
  assert.equal(unavailable.mapBinding.kind, "unavailable");
  assert.equal(unavailable.scoringEligibility, "none");
  assert.match(unavailable.emptyState.title, /unavailable/i);
});

test("perspective-specific measures cannot enter another perspective", () => {
  const pricingMeasure: PerspectiveMeasureId = "pricing.price_index";
  const marketingMeasure: PerspectiveMeasureId = "marketing.customer_demand";

  assert.equal(measureBelongsToPerspective(pricingMeasure, "pricing"), true);
  assert.equal(measureBelongsToPerspective(pricingMeasure, "marketing"), false);
  assert.equal(measureBelongsToPerspective(marketingMeasure, "cvc"), false);

  assert.throws(() => assertMeasureIsolation(pricingMeasure, "cvc"));
  assert.throws(() => assertMeasureIsolation(marketingMeasure, "pricing"));

  for (const perspective of listPerspectives()) {
    for (const view of perspective.views) {
      assert.equal(measureBelongsToPerspective(view.activeMeasure, perspective.perspectiveId), true);
      assertMeasureIsolation(view.activeMeasure, perspective.perspectiveId);
    }
  }
});

test("no universal score field is created across perspectives", () => {
  for (const perspective of listPerspectives()) {
    for (const view of perspective.views) {
      const presentation = resolveMapPresentation(view);
      assert.equal(hasUniversalScoreField(presentation), false);
      assert.doesNotMatch(presentation.measureId, /universal/i);
      assert.doesNotMatch(JSON.stringify(presentation), /universal_score|cross_perspective_score/i);
    }
  }
});

test("public Census context remains visibly non-scored", () => {
  const household = getPerspectiveView("cvc", "household_demand");
  const expansion = getPerspectiveView("cvc", "market_expansion_context");
  assert.equal(household.allowedUse, "market_context_only");
  assert.equal(expansion.allowedUse, "market_context_only");
  assert.equal(isPublicContextNonScored(household), true);
  assert.equal(isPublicContextNonScored(expansion), true);
  assert.equal(household.scoringEligibility, "none");
  assert.equal(expansion.scoringEligibility, "none");
  assert.match(resolveMapPresentation(household).sourceLabel, /market context only/i);
  assert.match(resolveMapPresentation(expansion).evidenceBoundary, /opportunity score/i);
});

test("default CVC household view remains available for the opening map", () => {
  const view = getDefaultView("cvc");
  assert.equal(view.viewId, "household_demand");
  assert.equal(view.mapBinding.kind, "census_percentile");
  if (view.mapBinding.kind === "census_percentile") {
    assert.equal(view.mapBinding.censusMetric, "household_count");
  }
});

test("governed planning still compiles without a cross-perspective score", () => {
  const plan = planEvaluation("Which U.S. markets have the highest population density?");
  assert.equal(plan.capabilityId, "census_market_context");
  assert.equal(plan.status, "executable");
  assert.doesNotMatch(JSON.stringify(plan), /universal_score|cross_perspective_score/i);
  assert.match(plan.evidenceBoundary, /does not rank business opportunity/i);
});
