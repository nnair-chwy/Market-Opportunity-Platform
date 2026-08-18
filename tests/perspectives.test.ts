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
    "Competitor availability",
    "Observed offer price",
    "Offer observations",
    "Observed assortment",
  ],
  marketing: [
    "Paid search response",
    "Search impressions",
    "Click-through rate",
    "Average cost per click",
  ],
  cvc: [
    "Clinic footprint",
    "Household demand",
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
  assert.equal(defaults.pricing, "competitor_availability");
  assert.equal(defaults.marketing, "paid_search_response");
  assert.equal(defaults.cvc, "household_demand");
  assert.notEqual(defaults.pricing, defaults.marketing);
  assert.notEqual(defaults.marketing, defaults.cvc);
  const pricingDefault = resolveMapPresentation(getDefaultView("pricing"));
  const marketingDefault = resolveMapPresentation(getDefaultView("marketing"));
  assert.equal(pricingDefault.mapBinding.kind, "workspace_snapshot");
  assert.equal(marketingDefault.mapBinding.kind, "workspace_snapshot");
  assert.equal(pricingDefault.scoringEligibility, "none");
  assert.equal(marketingDefault.scoringEligibility, "none");
});

test("changing a view updates map title, measure, legend, and evidence boundary", () => {
  const household = resolveMapPresentation(getPerspectiveView("cvc", "household_demand"));
  const expansion = resolveMapPresentation(getPerspectiveView("cvc", "market_expansion_context"));
  const price = resolveMapPresentation(getPerspectiveView("pricing", "observed_equalized_price"));

  assert.equal(household.mapTitle, "Household demand context");
  assert.equal(household.measureId, "cvc.household_demand");
  assert.match(household.legend.title, /Household percentile/i);
  assert.match(household.evidenceBoundary, /market context only/i);

  assert.equal(expansion.mapTitle, "Market expansion context");
  assert.equal(expansion.measureId, "cvc.market_expansion_context");
  assert.match(expansion.legend.title, /Population-density percentile/i);
  assert.equal(expansion.mapBinding.kind, "census_percentile");
  if (expansion.mapBinding.kind === "census_percentile") {
    assert.equal(expansion.mapBinding.censusMetric, "population_density");
  }
  assert.notEqual(expansion.evidenceBoundary, household.evidenceBoundary);

  assert.equal(price.mapTitle, "Observed equalized offer price");
  assert.equal(price.measureId, "pricing.observed_equalized_price");
  assert.equal(price.evidenceAvailability, "available");
  assert.equal(price.mapBinding.kind, "workspace_snapshot");
});

test("unsupported or unavailable views fail safely without inventing values", () => {
  const unknown = selectPerspectiveView("cvc", "price_index");
  assert.equal("status" in unknown && unknown.status, "unavailable");

  const unavailable = selectPerspectiveView("pricing", "price_opportunity_by_region");
  assert.equal("status" in unavailable && unavailable.status, "unavailable");
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
