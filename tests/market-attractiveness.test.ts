import assert from "node:assert/strict";
import test from "node:test";

import snapshotJson from "../data/synthetic/market-attractiveness/v1/markets.json" with { type: "json" };
import { MARKET_ATTRACTIVENESS_CONFIGURATION } from "../lib/market-attractiveness/config.ts";
import {
  reconcileMarketResult,
  scoreSyntheticMarkets,
  validateSyntheticMarketSnapshot,
} from "../lib/market-attractiveness/scoring.ts";
import {
  MARKET_SCORE_COLORS,
  marketScoreColor,
  marketScoreMatchExpression,
  marketScoresByCbsaCode,
} from "../lib/market-attractiveness/map.ts";
import {
  buildMarketComparisonAskAiContext,
  canAddMarketToComparison,
} from "../lib/market-attractiveness/comparison.ts";
import type {
  MarketAttractivenessConfiguration,
  MarketMetricId,
  SyntheticMarketRecord,
  SyntheticMarketSnapshot,
} from "../lib/market-attractiveness/types.ts";

const snapshot = snapshotJson as unknown as SyntheticMarketSnapshot;

function cloneSnapshot(value = snapshot): SyntheticMarketSnapshot {
  return structuredClone(value);
}

function makeMarket(
  id: string,
  name: string,
  cohort: "metropolitan" | "micropolitan",
  overrides: Partial<Record<MarketMetricId, number>> = {},
): SyntheticMarketRecord {
  return {
    prototype_market_id: id,
    cbsa_code: null,
    cbsa_join_status: "unmatched",
    cbsa_join_source_id: "SRC-014",
    cbsa_join_vintage: "2023-07",
    cbsa_name: name,
    cbsa_type: cohort,
    reporting_date: "2026-07-31",
    evidence_status: "Hypothesis",
    scoring_eligibility: "synthetic_prototype_only",
    synthetic_method_version: "test-v1",
    synthetic_fields: [],
    metrics: {
      active_customers_per_1000_households: 20,
      active_customer_count: 1_000,
      active_customer_yoy_growth: 0.02,
      total_households: 10_000,
      avg_zip_median_household_income: 80_000,
      clinics_per_10000_households: 4,
      veterinarians_per_10000_households: 8,
      corporate_clinic_share: 0.25,
      practice_hub_clinic_share: 0.15,
      clinic_orders_per_clinic: 100,
      ...overrides,
    },
    source_values: {},
    sources: {
      customer: "test",
      geography: "test",
      household_income: "test",
      clinic: "test",
      population: "test",
    },
  };
}

function smallSnapshot(markets: SyntheticMarketRecord[]): SyntheticMarketSnapshot {
  return {
    schema_version: "1.0.0",
    data_version: "test-data-v1",
    transformation_version: "test-transform-v1",
    evidence_status: "Hypothesis",
    allowed_use: "synthetic_prototype_only",
    markets,
  };
}

test("loads the complete synthetic snapshot with unique market IDs", () => {
  assert.equal(snapshot.markets.length, 917);
  assert.equal(
    new Set(snapshot.markets.map((market) => market.prototype_market_id)).size,
    917,
  );
  assert.doesNotThrow(() =>
    validateSyntheticMarketSnapshot(snapshot, MARKET_ATTRACTIVENESS_CONFIGURATION),
  );
});

test("maps scores to public geometry only through explicit CBSA codes", () => {
  const results = scoreSyntheticMarkets(
    snapshot,
    MARKET_ATTRACTIVENESS_CONFIGURATION,
  );
  const scores = marketScoresByCbsaCode(snapshot, results);
  const mappedRecords = snapshot.markets.filter((market) => market.cbsa_code);
  assert.equal(Object.keys(scores).length, mappedRecords.length);
  assert.equal(mappedRecords.length, 802);
  assert.equal(
    snapshot.markets.filter((market) => market.cbsa_join_status === "unmatched")
      .length,
    115,
  );
  assert.ok(
    Object.keys(scores).every((code) => /^\d{5}$/.test(code)),
  );
});

test("uses one stable score scale for MapLibre and SVG fallback colors", () => {
  assert.equal(marketScoreColor(0), MARKET_SCORE_COLORS.low);
  assert.equal(marketScoreColor(100), MARKET_SCORE_COLORS.high);
  assert.equal(marketScoreColor(null), MARKET_SCORE_COLORS.notScored);
  assert.equal(marketScoreColor(Number.NaN), MARKET_SCORE_COLORS.notScored);

  // Mid-band scores (where most markets land) must stay visually distinct.
  assert.notEqual(marketScoreColor(30), marketScoreColor(50));
  assert.notEqual(marketScoreColor(50), marketScoreColor(70));

  const expression = marketScoreMatchExpression("markets", {
    "10100": 0,
    "10140": 100,
  });
  assert.deepEqual(expression, [
    "match",
    ["get", "cbsa_code"],
    "10100",
    marketScoreColor(0),
    "10140",
    marketScoreColor(100),
    MARKET_SCORE_COLORS.notScored,
  ]);
  assert.deepEqual(marketScoreMatchExpression("locations", {}), [
    "literal",
    "#e5e7eb",
  ]);
});

test("limits market comparisons to five results from one scoring cohort", () => {
  const results = scoreSyntheticMarkets(
    snapshot,
    MARKET_ATTRACTIVENESS_CONFIGURATION,
  ).filter((result) => result.cbsaCode);
  const metro = results.filter((result) => result.cohort === "metropolitan");
  const micro = results.find((result) => result.cohort === "micropolitan")!;

  assert.deepEqual(canAddMarketToComparison(metro[1], [metro[0]]), {
    allowed: true,
    reason: null,
  });
  assert.equal(
    canAddMarketToComparison(micro, [metro[0]]).allowed,
    false,
  );
  assert.match(
    canAddMarketToComparison(micro, [metro[0]]).reason ?? "",
    /normalized separately/,
  );
  assert.equal(
    canAddMarketToComparison(metro[5], metro.slice(0, 5)).allowed,
    false,
  );
});

test("builds Ask AI context only from the selected comparison", () => {
  const results = scoreSyntheticMarkets(
    snapshot,
    MARKET_ATTRACTIVENESS_CONFIGURATION,
  ).filter(
    (result) => result.cbsaCode && result.cohort === "metropolitan",
  );
  const selected = [results[0], results[1], results[2]];
  const context = buildMarketComparisonAskAiContext(selected)!;

  assert.equal(context.id.includes(selected[0].cbsaCode!), true);
  assert.equal(context.insights.length, 4);
  const contextText = context.insights
    .map((insight) => `${insight.title}\n${insight.detail}`)
    .join("\n");
  for (const result of selected) {
    assert.match(
      contextText,
      new RegExp(result.marketName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    const marketInsight = context.insights.find(
      (insight) => insight.title === result.marketName,
    )!;
    assert.match(marketInsight.detail, /Largest supplied metric contributions/);
    assert.match(marketInsight.detail, /Weakest supplied metric contributions/);
    assert.ok(marketInsight.detail.length <= 1_200);
    const highestContributions = [...result.metricResults]
      .sort((left, right) => right.contribution - left.contribution)
      .slice(0, 3);
    const lowestContributions = [...result.metricResults]
      .sort((left, right) => left.contribution - right.contribution)
      .slice(0, 3);
    for (const metric of [...highestContributions, ...lowestContributions]) {
      assert.match(
        marketInsight.detail,
        new RegExp(metric.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
    }
  }
  assert.equal(
    context.insights.some((insight) =>
      insight.detail.includes(results[3].marketName),
    ),
    false,
  );
  const singleContext = buildMarketComparisonAskAiContext([selected[0]])!;
  assert.equal(singleContext.title, `Review ${selected[0].marketName}`);
  assert.equal(singleContext.insights.length, 1);
  assert.match(singleContext.overview, /this result/);
  assert.equal(buildMarketComparisonAskAiContext([]), null);
});

test("configuration weights sum to 100 overall and by dimension", () => {
  const configuration = MARKET_ATTRACTIVENESS_CONFIGURATION;
  assert.equal(
    configuration.metrics.reduce((sum, metric) => sum + metric.weight, 0),
    100,
  );
  for (const dimension of configuration.dimensions) {
    assert.equal(
      configuration.metrics
        .filter((metric) => metric.dimensionId === dimension.dimensionId)
        .reduce((sum, metric) => sum + metric.weight, 0),
      dimension.weight,
    );
  }
});

test("every score is bounded and reconciles to its visible contributions", () => {
  const results = scoreSyntheticMarkets(snapshot, MARKET_ATTRACTIVENESS_CONFIGURATION);
  assert.equal(results.length, 917);
  for (const result of results) {
    assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
    assert.ok(result.subscores.every((subscore) => subscore.score >= 0 && subscore.score <= 100));
    assert.equal(reconcileMarketResult(result), true);
    assert.deepEqual(result.missingInputs, []);
    assert.deepEqual(result.excludedMetrics, []);
    assert.equal(result.allowedUse, "synthetic_prototype_only");
  }
});

test("ranks metropolitan and micropolitan markets independently", () => {
  const results = scoreSyntheticMarkets(snapshot, MARKET_ATTRACTIVENESS_CONFIGURATION);
  for (const cohort of ["metropolitan", "micropolitan"] as const) {
    const cohortResults = results.filter((result) => result.cohort === cohort);
    assert.deepEqual(
      cohortResults.map((result) => result.cohortRank).sort((a, b) => a - b),
      Array.from({ length: cohortResults.length }, (_, index) => index + 1),
    );
  }
});

test("produces identical results on repeated runs without mutating inputs", () => {
  const beforeSnapshot = cloneSnapshot();
  const beforeConfiguration = structuredClone(MARKET_ATTRACTIVENESS_CONFIGURATION);
  const first = scoreSyntheticMarkets(snapshot, MARKET_ATTRACTIVENESS_CONFIGURATION);
  const second = scoreSyntheticMarkets(snapshot, MARKET_ATTRACTIVENESS_CONFIGURATION);
  assert.deepEqual(first, second);
  assert.deepEqual(snapshot, beforeSnapshot);
  assert.deepEqual(MARKET_ATTRACTIVENESS_CONFIGURATION, beforeConfiguration);
});

test("reverses lower-is-better metrics", () => {
  const testSnapshot = smallSnapshot([
    makeMarket("low", "Low supply", "metropolitan", {
      clinics_per_10000_households: 1,
    }),
    makeMarket("high", "High supply", "metropolitan", {
      clinics_per_10000_households: 10,
    }),
  ]);
  const results = scoreSyntheticMarkets(testSnapshot, MARKET_ATTRACTIVENESS_CONFIGURATION);
  const low = results.find((result) => result.prototypeMarketId === "low")!;
  const high = results.find((result) => result.prototypeMarketId === "high")!;
  const metric = (result: typeof low) =>
    result.metricResults.find(
      (candidate) => candidate.metricId === "clinics_per_10000_households",
    )!;
  assert.ok(metric(low).normalizedScore > metric(high).normalizedScore);
  assert.equal(metric(low).direction, "lower-is-better");
});

test("calculates winsor bounds separately by cohort", () => {
  const testSnapshot = smallSnapshot([
    makeMarket("metro-a", "Metro A", "metropolitan", { active_customer_count: 10 }),
    makeMarket("metro-b", "Metro B", "metropolitan", { active_customer_count: 100 }),
    makeMarket("micro-a", "Micro A", "micropolitan", { active_customer_count: 10_000 }),
    makeMarket("micro-b", "Micro B", "micropolitan", { active_customer_count: 100_000 }),
  ]);
  const results = scoreSyntheticMarkets(testSnapshot, MARKET_ATTRACTIVENESS_CONFIGURATION);
  const bound = (id: string) =>
    results
      .find((result) => result.prototypeMarketId === id)!
      .metricResults.find((metric) => metric.metricId === "active_customer_count")!
      .winsorUpperBound;
  assert.notEqual(bound("metro-a"), bound("micro-a"));
  assert.equal(bound("metro-a"), bound("metro-b"));
  assert.equal(bound("micro-a"), bound("micro-b"));
});

test("uses deterministic alphabetical tie breaks within a cohort", () => {
  const testSnapshot = smallSnapshot([
    makeMarket("z", "Zulu", "metropolitan"),
    makeMarket("a", "Alpha", "metropolitan"),
  ]);
  const results = scoreSyntheticMarkets(testSnapshot, MARKET_ATTRACTIVENESS_CONFIGURATION);
  assert.equal(results.find((result) => result.marketName === "Alpha")!.cohortRank, 1);
  assert.equal(results.find((result) => result.marketName === "Zulu")!.cohortRank, 2);
});

test("rejects a missing configured input and ignores source-prefixed values", () => {
  const invalid = cloneSnapshot(smallSnapshot([makeMarket("a", "Alpha", "metropolitan")]));
  invalid.markets[0].source_values.source_active_customer_count = 999_999;
  delete (invalid.markets[0].metrics as Partial<Record<MarketMetricId, number>>)
    .active_customer_count;
  assert.throws(
    () => scoreSyntheticMarkets(invalid, MARKET_ATTRACTIVENESS_CONFIGURATION),
    /active_customer_count: A configured metric is missing/,
  );
  assert.ok(
    MARKET_ATTRACTIVENESS_CONFIGURATION.metrics.every(
      (metric) => !metric.metricId.startsWith("source_"),
    ),
  );
});

test("accepts negative growth but rejects negative non-growth metrics", () => {
  const negativeGrowth = smallSnapshot([
    makeMarket("a", "Alpha", "metropolitan", {
      active_customer_yoy_growth: -0.08,
    }),
  ]);
  assert.doesNotThrow(() =>
    scoreSyntheticMarkets(negativeGrowth, MARKET_ATTRACTIVENESS_CONFIGURATION),
  );

  const negativeHouseholds = cloneSnapshot(negativeGrowth);
  negativeHouseholds.markets[0].metrics.total_households = -1;
  assert.throws(
    () =>
      scoreSyntheticMarkets(
        negativeHouseholds,
        MARKET_ATTRACTIVENESS_CONFIGURATION,
      ),
    /total_households: This configured metric cannot be negative/,
  );
});

test("sensitivity analysis preserves baseline scores and reports 12 scenarios", () => {
  const results = scoreSyntheticMarkets(snapshot, MARKET_ATTRACTIVENESS_CONFIGURATION);
  assert.ok(results.every((result) => result.sensitivity.scenarioCount === 12));
  assert.ok(
    results.every(
      (result) =>
        result.sensitivity.bestRank <= result.cohortRank &&
        result.sensitivity.worstRank >= result.cohortRank,
    ),
  );
});

test("configuration remains explicit and replaceable", () => {
  const adjusted = structuredClone(
    MARKET_ATTRACTIVENESS_CONFIGURATION,
  ) as MarketAttractivenessConfiguration;
  adjusted.configurationVersion = "test-rebalanced-v1";
  adjusted.metrics.find((metric) => metric.metricId === "active_customer_count")!.weight = 17;
  adjusted.metrics.find((metric) => metric.metricId === "active_customers_per_1000_households")!.weight = 20;
  const result = scoreSyntheticMarkets(snapshot, adjusted)[0];
  assert.equal(result.configurationVersion, "test-rebalanced-v1");
  assert.notEqual(result.configurationFingerprint, "");
});
