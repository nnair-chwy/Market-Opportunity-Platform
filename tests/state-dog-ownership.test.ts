import assert from "node:assert/strict";
import test from "node:test";
import { stateDogOwnership, stateDogOwnershipSource } from "../lib/data/state-dog-ownership.ts";

test("restored state pet context covers every state and DC without imputing missing survey values", () => {
  assert.equal(stateDogOwnership.length, 51);
  assert.equal(new Set(stateDogOwnership.map((item) => item.fips)).size, 51);
  assert.equal(stateDogOwnership.find((item) => item.code === "ID")?.relativePercentile, 100);
  assert.equal(stateDogOwnership.find((item) => item.code === "AK")?.householdRate, null);
  assert.equal(stateDogOwnership.find((item) => item.code === "HI")?.relativePercentile, null);
  assert.equal(stateDogOwnershipSource.allowedUse, "coarse_market_context_only");
});
