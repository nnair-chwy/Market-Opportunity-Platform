import assert from "node:assert/strict";
import test from "node:test";
import { getApprovedPricingEconomicsSnapshot } from "../lib/pricing-economics/approved-snapshot.ts";
import { regionalPricingOutcomeSnapshotSchema } from "../lib/pricing-economics/contracts.ts";

test("approved Chewy economics snapshot is minimized, registered, and bounded to national materiality", () => {
  const snapshot = getApprovedPricingEconomicsSnapshot();
  assert.equal(snapshot.datasetId, "pricing_chewy_economics_daily_v1");
  assert.equal(snapshot.geography, "US");
  assert.equal(snapshot.privacy.containsDirectIdentifiers, false);
  assert.equal(snapshot.privacy.containsCustomerGeography, false);
  assert.ok(snapshot.coverage.inputRows > snapshot.coverage.outputCategories);
  assert.ok(snapshot.categories.length > 0 && snapshot.categories.length < 20);
  assert.match(snapshot.limitations.join(" "), /cannot answer regional demand, local profitability/i);
  assert.equal(snapshot.coverage.rowsWithNonZeroSales, 0);
});

test("regional Chewy outcome contract rejects small cells and retained postal geography", () => {
  const result = regionalPricingOutcomeSnapshotSchema.safeParse({
    version: "1.0.0",
    datasetId: "pricing_chewy_geo_outcome_weekly_v1",
    snapshotId: "unsafe-example",
    sourceIds: ["SRC-031"],
    outputGrain: "week_x_cbsa_x_top_level_merchandise_category",
    minimumDistinctOrders: 10,
    rows: [],
    privacy: { directIdentifiersRetained: false, postalCodesRetained: true, smallCellsSuppressed: false },
    allowedUse: "internal_shadow_regional_outcome_validation_only",
    limitations: ["Example"],
  });
  assert.equal(result.success, false);
});
