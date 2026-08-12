import assert from "node:assert/strict";
import test from "node:test";
import topologyJson from "../data/public/census/cbsa-geometry/2024/markets.topo.json" with { type: "json" };
import acsSnapshotJson from "../data/public/census/cbsa-acs/2024/market-context.json" with { type: "json" };
import marketUniverseJson from "../data/public/census/cbsa-universe/2023-07/markets.json" with { type: "json" };
import { createPublicMarketRecords } from "../lib/data/cbsa-market-context.ts";
import type { CbsaAcsSnapshot } from "../lib/data/cbsa-acs/types.ts";
import type { CbsaUniverseSnapshot } from "../lib/data/cbsa-universe/types.ts";
import {
  geographicFocusSchema,
  planEvaluation,
  resolveGeographicFocus,
} from "../lib/planning/index.ts";

const universe = marketUniverseJson as CbsaUniverseSnapshot;
const acsSnapshot = acsSnapshotJson as CbsaAcsSnapshot;
const geometryCodes = new Set(
  (topologyJson as { objects: { markets: { geometries: Array<{ properties?: { cbsa_code?: string } }> } } })
    .objects.markets.geometries
    .map((item) => item.properties?.cbsa_code ?? ""),
);

const markets = createPublicMarketRecords(
  universe.markets,
  geometryCodes,
  new Map(acsSnapshot.markets.map((market) => [market.cbsa_code, market])),
);

test("explicit geography questions focus the named CBSA", () => {
  const plan = planEvaluation(
    "Which Seattle-area markets should we investigate for a future Chewy Vet Care clinic?",
  );
  const focus = resolveGeographicFocus(plan, markets);
  geographicFocusSchema.parse(focus);
  assert.equal(focus.state, "focused");
  assert.equal(focus.source, "question_geography");
  assert.deepEqual(focus.cbsaCodes, ["42660"]);
  assert.match(focus.label, /Seattle/i);
  assert.equal(focus.evidenceStatus, "Confirmed");
});

test("national questions derive map focus from the deterministic evaluation result", () => {
  const plan = planEvaluation("Which U.S. markets have the highest population density?");
  assert.ok(["national", "needs_selection"].includes(plan.geographyResolution.mode));
  assert.equal(plan.geographyResolution.selectedCbsaCodes.length, 0);

  const focus = resolveGeographicFocus(plan, markets);
  geographicFocusSchema.parse(focus);
  assert.equal(focus.state, "focused");
  assert.equal(focus.source, "evaluation_result");
  assert.equal(focus.evidenceStatus, "Derived");
  assert.deepEqual(focus.cbsaCodes, ["35620"]);
  assert.match(focus.label, /New York/i);
  assert.match(focus.message, /not a recommendation/i);
  assert.equal(focus.cbsaCodes.includes("42660"), false);
});

test("questions without reliable geography use the labeled fallback state", () => {
  const plan = planEvaluation("What should we do next?");
  const focus = resolveGeographicFocus(plan, markets);
  geographicFocusSchema.parse(focus);
  assert.equal(focus.state, "fallback");
  assert.equal(focus.source, "unavailable");
  assert.deepEqual(focus.cbsaCodes, []);
  assert.equal(focus.evidenceStatus, "Unknown");
  assert.match(focus.label, /unavailable/i);
  assert.match(focus.message, /rather than inventing|could not be matched|clarification|No reliable focus/i);
});
