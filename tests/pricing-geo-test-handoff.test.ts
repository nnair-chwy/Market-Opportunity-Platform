import assert from "node:assert/strict";
import test from "node:test";
import { buildPricingGeoTestHandoff, runCurrentDataInsightDiscovery } from "../lib/insight-discovery/index.ts";

test("pricing geo-test handoff keeps the demand test causal and cross-team", () => {
  const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T12:00:00.000Z" });
  const handoff = buildPricingGeoTestHandoff(run);

  assert.match(handoff.recommendation, /local-demand experiment/i);
  assert.match(handoff.recommendation, /do not change Chewy price/i);
  assert.match(handoff.testDesign.treatmentAndControl, /3 treatment and 3 matched-control/i);
  assert.match(handoff.testDesign.candidateMarkets, /8–12 PetSmart trade areas/i);
  assert.match(handoff.testDesign.pricingRole, /matched-SKU price index/i);
  assert.deepEqual(handoff.primaryOutcomes, [
    "Incremental Dog Food orders",
    "Incremental Dog Food sales",
    "Incremental contribution after media cost",
  ]);
  assert.match(handoff.evidenceBoundary, /not approval to change price or spend/i);
});

test("pricing geo-test handoff states the actual PetSmart and Petco evidence limitation", () => {
  const handoff = buildPricingGeoTestHandoff();
  const evidence = handoff.currentEvidence.join(" ");

  assert.match(evidence, /13 Petco Dog Food observations across 9 ZIPs/i);
  assert.match(evidence, /9 PetSmart observations across 7 ZIPs/i);
  assert.match(evidence, /April 21 to May 3, 2025/i);
  assert.match(evidence, /too sparse and stale/i);
});
