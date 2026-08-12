import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_COMPARISON_REGIONS,
  appendComparisonRegion,
  assertNoHiddenLayerScore,
  buildComparisonFingerprint,
  canAddRegionToComparison,
  clearComparisonRegions,
  coerceSupportedMapMode,
  createDefaultLayerVisibility,
  formatNullableMeasureValue,
  getPerspectiveView,
  layerVisibilityChangesScoringInputs,
  listApprovedMapLayers,
  preserveMissingNumeric,
  removeComparisonRegion,
  resolveApprovedMapLayer,
  resolveLayerForPresentation,
  resolveMapPresentation,
} from "../lib/perspectives/index.ts";

const household = resolveMapPresentation(
  getPerspectiveView("cvc", "household_demand"),
);

test("approved layers list the required View A layer kinds", () => {
  const layers = listApprovedMapLayers();
  assert.deepEqual(
    layers.map((layer) => layer.layerId),
    [
      "active_measure",
      "workflow_category",
      "current_locations",
      "public_context",
      "non_scored_unavailable",
    ],
  );
  assertNoHiddenLayerScore(layers);
  for (const layer of layers) {
    assert.equal(layer.contributesToHiddenScore, false);
    assert.equal(layer.visuallyDistinctFromScoredMeasures, true);
    assert.ok(layer.sourceIds.length > 0);
    assert.ok(layer.vintage.length > 0);
    assert.ok(layer.evidenceBoundary.length > 0);
  }
});

test("unsupported layers fail safely without inventing eligibility", () => {
  const unsupported = resolveApprovedMapLayer("secret_blended_score");
  assert.equal("status" in unsupported && unsupported.status, "unsupported");
  assert.match(
    "reason" in unsupported ? unsupported.reason : "",
    /not an approved regional data layer/i,
  );
});

test("compare mode accepts two through five regions and blocks a sixth", () => {
  const fingerprint = buildComparisonFingerprint({
    presentation: household,
    geographyGrain: "cbsa",
    vintage: "acs-2024-5yr",
    cohortId: "metropolitan-all",
  });
  let selected: string[] = [];
  for (const code of ["12060", "14460", "16980", "19100", "26420"]) {
    const eligibility = canAddRegionToComparison({
      regionId: code,
      selectedRegionIds: selected,
      activeFingerprint: fingerprint,
      candidateFingerprint: fingerprint,
    });
    assert.equal(eligibility.allowed, true);
    selected = appendComparisonRegion(selected, code);
  }
  assert.equal(selected.length, MAX_COMPARISON_REGIONS);
  const sixth = canAddRegionToComparison({
    regionId: "31080",
    selectedRegionIds: selected,
    activeFingerprint: fingerprint,
    candidateFingerprint: fingerprint,
  });
  assert.equal(sixth.allowed, false);
  assert.match(sixth.reason ?? "", /up to five regions/i);
  assert.deepEqual(appendComparisonRegion(selected, "31080"), selected);
});

test("removing and clearing comparison selections preserves analyst order for the rest", () => {
  let selected = ["12060", "14460", "16980"];
  selected = removeComparisonRegion(selected, "14460");
  assert.deepEqual(selected, ["12060", "16980"]);
  selected = clearComparisonRegions();
  assert.deepEqual(selected, []);
});

test("comparison requires compatible geography, measure, source, vintage, and cohort", () => {
  const active = buildComparisonFingerprint({
    presentation: household,
    geographyGrain: "cbsa",
    vintage: "acs-2024-5yr",
    cohortId: "metropolitan-all",
  });
  const incompatible = {
    ...active,
    cohortId: "all-current",
  };
  const result = canAddRegionToComparison({
    regionId: "12060",
    selectedRegionIds: [],
    activeFingerprint: active,
    candidateFingerprint: incompatible,
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? "", /matching geography, measure, source, vintage, and cohort/i);
});

test("missing numeric values stay null and never become zero", () => {
  assert.equal(preserveMissingNumeric(null), null);
  assert.equal(preserveMissingNumeric(undefined), null);
  assert.equal(preserveMissingNumeric(Number.NaN), null);
  assert.equal(preserveMissingNumeric(12.5), 12.5);
  assert.equal(formatNullableMeasureValue(null, () => "0"), "Unavailable");
  assert.equal(formatNullableMeasureValue(undefined, () => "0"), "Unavailable");
  assert.equal(formatNullableMeasureValue(42, (value) => String(value)), "42");
});

test("layer visibility never mutates scoring inputs or creates a hidden score", () => {
  const previous = createDefaultLayerVisibility();
  const next = { ...previous, active_measure: false, current_locations: false };
  assert.equal(layerVisibilityChangesScoringInputs(previous, next), false);
  const resolved = resolveLayerForPresentation("active_measure", household);
  assert.equal("status" in resolved, false);
  if (!("status" in resolved)) {
    assert.equal(resolved.contributesToHiddenScore, false);
  }
});

test("unsupported layer mode views coerce back to single", () => {
  const expansion = resolveMapPresentation(
    getPerspectiveView("cvc", "market_expansion_context"),
  );
  assert.equal(expansion.supportsLayerMode, false);
  assert.equal(coerceSupportedMapMode("layer", expansion), "single");
  assert.equal(coerceSupportedMapMode("compare", expansion), "compare");
  assert.equal(coerceSupportedMapMode("single", expansion), "single");
});
