import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_CLINIC_MARKET_IDS,
  canEvaluateLocation,
  currentMarketIds,
  marketCategoryFor,
  validateLocationMarketInvariant,
  type MarketWorkflowRecord,
} from "../lib/workflow/market-workflow.ts";
import { currentClinics } from "../lib/locations/map-data.ts";

const knownMarkets = new Set(["current", "evaluated", "potential"]);
const workflow: MarketWorkflowRecord[] = [
  {
    marketId: "evaluated",
    category: "evaluated",
    reviewState: "complete",
    evidenceStatus: "Hypothesis",
    sourceId: "SYN",
    updatedAt: "2026-07-30T00:00:00.000Z",
    reviewNote: "Synthetic test record.",
  },
  {
    marketId: "potential",
    category: "potential",
    reviewState: "needs_evidence",
    evidenceStatus: "Hypothesis",
    sourceId: "SYN",
    updatedAt: "2026-07-30T00:00:00.000Z",
    reviewNote: "Synthetic test record.",
  },
];

test("current markets take precedence over workflow records", () => {
  assert.equal(
    marketCategoryFor("evaluated", new Set(["evaluated"]), workflow),
    "current",
  );
});

test("every current clinic fixture has an explicit parent market assignment", () => {
  const missing = currentClinics.filter(
    (clinic) => !CURRENT_CLINIC_MARKET_IDS[clinic.market],
  );
  assert.deepEqual(missing, []);
  assert.ok(
    currentMarketIds(currentClinics.map((clinic) => clinic.market)).size > 0,
  );
});

test("only current and evaluated markets allow location evaluation", () => {
  assert.equal(canEvaluateLocation("current"), true);
  assert.equal(canEvaluateLocation("evaluated"), true);
  assert.equal(canEvaluateLocation("potential"), false);
  assert.equal(canEvaluateLocation("unclassified"), false);
  assert.equal(canEvaluateLocation(null), false);
});

test("rejects evaluated locations without an eligible parent market", () => {
  assert.deepEqual(
    validateLocationMarketInvariant({
      locationCategory: "evaluated",
      marketId: "potential",
      marketCategory: "potential",
      knownMarketIds: knownMarkets,
    }),
    ["An evaluated location requires an evaluated or current parent market."],
  );
  assert.deepEqual(
    validateLocationMarketInvariant({
      locationCategory: "evaluated",
      marketId: null,
      marketCategory: null,
      knownMarketIds: knownMarkets,
    }),
    ["Location does not have a stable parent market."],
  );
});

test("rejects current locations whose parent market is not current", () => {
  assert.deepEqual(
    validateLocationMarketInvariant({
      locationCategory: "current",
      marketId: "evaluated",
      marketCategory: "evaluated",
      knownMarketIds: knownMarkets,
    }),
    ["A current location requires a current parent market."],
  );
});
