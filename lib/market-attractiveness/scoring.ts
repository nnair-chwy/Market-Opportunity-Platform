import type {
  MarketAttractivenessConfiguration,
  MarketAttractivenessResult,
  MarketCohort,
  MarketDimensionId,
  MarketMetricDefinition,
  MarketMetricId,
  MarketMetricResult,
  MarketScoringValidationIssue,
  MarketSubscore,
  SyntheticMarketRecord,
  SyntheticMarketSnapshot,
} from "./types.ts";
import { MarketScoringValidationError } from "./types.ts";

const EPSILON = 1e-9;

type NormalizedMetric = Omit<MarketMetricResult, "weight" | "contribution">;
type NormalizedMarket = {
  market: SyntheticMarketRecord;
  metrics: Map<MarketMetricId, NormalizedMetric>;
};

function round(value: number, precision = 12): number {
  const factor = 10 ** precision;
  const result = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function quantile(sorted: readonly number[], percentile: number): number {
  if (!sorted.length) throw new Error("Cannot calculate a quantile without values.");
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
}

function transform(value: number, definition: MarketMetricDefinition): number {
  return definition.transform === "log1p" ? Math.log1p(value) : value;
}

function fingerprint(configuration: MarketAttractivenessConfiguration): string {
  const canonical = JSON.stringify({
    configurationVersion: configuration.configurationVersion,
    calculationVersion: configuration.calculationVersion,
    normalizationVersion: configuration.normalizationVersion,
    winsorLowerPercentile: configuration.winsorLowerPercentile,
    winsorUpperPercentile: configuration.winsorUpperPercentile,
    metrics: configuration.metrics.map((metric) => ({
      metricId: metric.metricId,
      dimensionId: metric.dimensionId,
      direction: metric.direction,
      transform: metric.transform,
      weight: metric.weight,
    })),
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function validateMarketAttractivenessConfiguration(
  configuration: MarketAttractivenessConfiguration,
): void {
  const issues: MarketScoringValidationIssue[] = [];
  const metricTotal = sum(configuration.metrics.map((metric) => metric.weight));
  if (Math.abs(metricTotal - configuration.expectedWeightTotal) > EPSILON) {
    issues.push({
      code: "invalid-weight-total",
      path: "metrics",
      message: `Metric weights total ${round(metricTotal)}; expected ${configuration.expectedWeightTotal}.`,
    });
  }
  const dimensionTotal = sum(
    configuration.dimensions.map((dimension) => dimension.weight),
  );
  if (Math.abs(dimensionTotal - configuration.expectedWeightTotal) > EPSILON) {
    issues.push({
      code: "invalid-dimension-total",
      path: "dimensions",
      message: `Dimension weights total ${round(dimensionTotal)}; expected ${configuration.expectedWeightTotal}.`,
    });
  }
  const metricIds = new Set<MarketMetricId>();
  for (const [index, metric] of configuration.metrics.entries()) {
    if (metricIds.has(metric.metricId)) {
      issues.push({
        code: "invalid-configuration",
        path: `metrics[${index}].metricId`,
        message: `Duplicate metric ${metric.metricId}.`,
      });
    }
    metricIds.add(metric.metricId);
    if (!Number.isFinite(metric.weight) || metric.weight < 0) {
      issues.push({
        code: "invalid-configuration",
        path: `metrics[${index}].weight`,
        message: "Weights must be finite and non-negative.",
      });
    }
  }
  for (const dimension of configuration.dimensions) {
    const configuredWeight = sum(
      configuration.metrics
        .filter((metric) => metric.dimensionId === dimension.dimensionId)
        .map((metric) => metric.weight),
    );
    if (Math.abs(configuredWeight - dimension.weight) > EPSILON) {
      issues.push({
        code: "invalid-dimension-total",
        path: `dimensions.${dimension.dimensionId}`,
        message: `Metric weights total ${round(configuredWeight)}; dimension weight is ${dimension.weight}.`,
      });
    }
  }
  if (
    configuration.winsorLowerPercentile < 0 ||
    configuration.winsorUpperPercentile > 1 ||
    configuration.winsorLowerPercentile >=
      configuration.winsorUpperPercentile
  ) {
    issues.push({
      code: "invalid-configuration",
      path: "winsorPercentiles",
      message: "Winsor percentiles must form an increasing interval within 0 and 1.",
    });
  }
  if (issues.length) throw new MarketScoringValidationError(issues);
}

export function validateSyntheticMarketSnapshot(
  snapshot: SyntheticMarketSnapshot,
  configuration: MarketAttractivenessConfiguration,
): void {
  const issues: MarketScoringValidationIssue[] = [];
  const ids = new Set<string>();
  for (const [index, market] of snapshot.markets.entries()) {
    const path = `markets[${index}]`;
    if (!market.prototype_market_id.trim()) {
      issues.push({
        code: "invalid-market",
        path: `${path}.prototype_market_id`,
        message: "A prototype market ID is required.",
      });
    } else if (ids.has(market.prototype_market_id)) {
      issues.push({
        code: "duplicate-market-id",
        path: `${path}.prototype_market_id`,
        message: `Duplicate market ID ${market.prototype_market_id}.`,
      });
    }
    ids.add(market.prototype_market_id);
    if (market.evidence_status !== "Hypothesis") {
      issues.push({
        code: "invalid-evidence-status",
        path: `${path}.evidence_status`,
        message: "Synthetic ranking inputs must be labeled Hypothesis.",
      });
    }
    if (market.scoring_eligibility !== "synthetic_prototype_only") {
      issues.push({
        code: "invalid-allowed-use",
        path: `${path}.scoring_eligibility`,
        message: "Only synthetic_prototype_only records may enter this scorer.",
      });
    }
    for (const metric of configuration.metrics) {
      const value = market.metrics[metric.metricId];
      if (value === undefined || value === null) {
        issues.push({
          code: "missing-input",
          path: `${path}.metrics.${metric.metricId}`,
          message: "A configured metric is missing.",
        });
      } else if (!Number.isFinite(value)) {
        issues.push({
          code: "invalid-input",
          path: `${path}.metrics.${metric.metricId}`,
          message: "Configured metrics must be finite.",
        });
      } else if (
        metric.metricId !== "active_customer_yoy_growth" &&
        value < 0
      ) {
        issues.push({
          code: "invalid-input",
          path: `${path}.metrics.${metric.metricId}`,
          message: "This configured metric cannot be negative.",
        });
      }
    }
  }
  if (!snapshot.markets.length) {
    issues.push({
      code: "invalid-market",
      path: "markets",
      message: "At least one market is required.",
    });
  }
  if (issues.length) throw new MarketScoringValidationError(issues);
}

function percentileScores(
  values: ReadonlyMap<string, number>,
): Map<string, number> {
  const ordered = [...values.entries()].sort(
    ([leftId, left], [rightId, right]) =>
      left - right || leftId.localeCompare(rightId),
  );
  const result = new Map<string, number>();
  if (ordered.length === 1) {
    result.set(ordered[0][0], 50);
    return result;
  }
  let index = 0;
  while (index < ordered.length) {
    let end = index;
    while (end + 1 < ordered.length && ordered[end + 1][1] === ordered[index][1]) {
      end += 1;
    }
    const averageRankIndex = (index + end) / 2;
    const percentile = (averageRankIndex / (ordered.length - 1)) * 100;
    for (let current = index; current <= end; current += 1) {
      result.set(ordered[current][0], percentile);
    }
    index = end + 1;
  }
  return result;
}

function normalizeMarkets(
  snapshot: SyntheticMarketSnapshot,
  configuration: MarketAttractivenessConfiguration,
): NormalizedMarket[] {
  const normalized = new Map<string, NormalizedMarket>(
    snapshot.markets.map((market) => [
      market.prototype_market_id,
      { market, metrics: new Map() },
    ]),
  );
  const cohorts: MarketCohort[] = ["metropolitan", "micropolitan"];

  for (const cohort of cohorts) {
    const cohortMarkets = snapshot.markets.filter(
      (market) => market.cbsa_type === cohort,
    );
    if (!cohortMarkets.length) continue;
    for (const definition of configuration.metrics) {
      const transformed = new Map(
        cohortMarkets.map((market) => [
          market.prototype_market_id,
          transform(market.metrics[definition.metricId], definition),
        ]),
      );
      const ordered = [...transformed.values()].sort((left, right) => left - right);
      const lowerBound = quantile(
        ordered,
        configuration.winsorLowerPercentile,
      );
      const upperBound = quantile(
        ordered,
        configuration.winsorUpperPercentile,
      );
      const winsorized = new Map(
        [...transformed.entries()].map(([marketId, value]) => [
          marketId,
          Math.min(upperBound, Math.max(lowerBound, value)),
        ]),
      );
      const percentiles = percentileScores(winsorized);

      for (const market of cohortMarkets) {
        const marketId = market.prototype_market_id;
        const basePercentile = percentiles.get(marketId);
        if (basePercentile === undefined) {
          throw new Error(`Missing percentile for ${marketId}.`);
        }
        const normalizedScore =
          definition.direction === "lower-is-better"
            ? 100 - basePercentile
            : basePercentile;
        normalized.get(marketId)!.metrics.set(definition.metricId, {
          metricId: definition.metricId,
          label: definition.label,
          dimensionId: definition.dimensionId,
          rawValue: market.metrics[definition.metricId],
          transformedValue: round(transformed.get(marketId)!),
          winsorizedValue: round(winsorized.get(marketId)!),
          winsorLowerBound: round(lowerBound),
          winsorUpperBound: round(upperBound),
          normalizedScore: round(normalizedScore),
          direction: definition.direction,
          transform: definition.transform,
          unit: definition.unit,
          prototypeAssumption: definition.prototypeAssumption ?? null,
        });
      }
    }
  }
  return [...normalized.values()];
}

function buildWeightedResults(
  normalizedMarkets: readonly NormalizedMarket[],
  snapshot: SyntheticMarketSnapshot,
  configuration: MarketAttractivenessConfiguration,
) {
  const configurationFingerprint = fingerprint(configuration);
  const results: MarketAttractivenessResult[] = normalizedMarkets.map(({ market, metrics }) => {
    const metricResults = configuration.metrics.map((definition) => {
      const normalizedMetric = metrics.get(definition.metricId);
      if (!normalizedMetric) {
        throw new Error(
          `Missing normalized metric ${definition.metricId} for ${market.prototype_market_id}.`,
        );
      }
      return {
        ...normalizedMetric,
        weight: definition.weight,
        contribution: round(
          (normalizedMetric.normalizedScore * definition.weight) / 100,
        ),
      };
    });
    const subscores: MarketSubscore[] = configuration.dimensions.map(
      (dimension) => {
        const contribution = round(
          sum(
            metricResults
              .filter((metric) => metric.dimensionId === dimension.dimensionId)
              .map((metric) => metric.contribution),
          ),
        );
        return {
          dimensionId: dimension.dimensionId,
          label: dimension.label,
          weight: dimension.weight,
          score: round((contribution / dimension.weight) * 100),
          contribution,
        };
      },
    );
    return {
      prototypeMarketId: market.prototype_market_id,
      cbsaCode: market.cbsa_code,
      cbsaJoinStatus: market.cbsa_join_status,
      cbsaJoinSourceId: market.cbsa_join_source_id,
      cbsaJoinVintage: market.cbsa_join_vintage,
      marketName: market.cbsa_name,
      cohort: market.cbsa_type,
      reportingDate: market.reporting_date,
      evidenceStatus: market.evidence_status,
      allowedUse: market.scoring_eligibility,
      dataVersion: snapshot.data_version,
      configurationVersion: configuration.configurationVersion,
      configurationFingerprint,
      calculationVersion: configuration.calculationVersion,
      normalizationVersion: configuration.normalizationVersion,
      syntheticMethodVersion: market.synthetic_method_version,
      syntheticFields: [...market.synthetic_fields],
      metricResults,
      subscores,
      overallScore: round(sum(metricResults.map((metric) => metric.contribution))),
      cohortRank: 0,
      cohortPercentile: 0,
      missingInputs: [],
      excludedMetrics: [],
      warnings: [
        "Synthetic prototype screening score, not a recommendation.",
        "Veterinary-opportunity directions are unapproved prototype assumptions.",
        market.cbsa_code
          ? "Public-map linkage uses an exact-name SRC-014 crosswalk; scoring inputs remain synthetic and separate."
          : "No exact SRC-014 CBSA match is available; this result is not rendered as a scored public-map boundary.",
      ],
      sources: market.sources,
      sensitivity: {
        scenarioCount: 0,
        baselineRank: 0,
        bestRank: 0,
        worstRank: 0,
        rankRange: 0,
        classification: "stable" as const,
      },
    };
  });

  for (const cohort of ["metropolitan", "micropolitan"] as const) {
    const cohortResults = results
      .filter((result) => result.cohort === cohort)
      .sort(
        (left, right) =>
          right.overallScore - left.overallScore ||
          left.marketName.localeCompare(right.marketName) ||
          left.prototypeMarketId.localeCompare(right.prototypeMarketId),
      );
    cohortResults.forEach((result, index) => {
      result.cohortRank = index + 1;
      result.cohortPercentile = round(
        cohortResults.length === 1
          ? 100
          : ((cohortResults.length - 1 - index) /
              (cohortResults.length - 1)) *
              100,
      );
      result.sensitivity.baselineRank = index + 1;
      result.sensitivity.bestRank = index + 1;
      result.sensitivity.worstRank = index + 1;
    });
  }
  return results;
}

function createSensitivityConfigurations(
  configuration: MarketAttractivenessConfiguration,
): MarketAttractivenessConfiguration[] {
  const scenarios: MarketAttractivenessConfiguration[] = [];
  for (const receiver of configuration.dimensions) {
    for (const donor of configuration.dimensions) {
      if (receiver.dimensionId === donor.dimensionId) continue;
      if (donor.weight < configuration.sensitivityStep) continue;
      const nextDimensionWeights = new Map<MarketDimensionId, number>(
        configuration.dimensions.map((dimension) => [
          dimension.dimensionId,
          dimension.weight,
        ]),
      );
      nextDimensionWeights.set(
        receiver.dimensionId,
        receiver.weight + configuration.sensitivityStep,
      );
      nextDimensionWeights.set(
        donor.dimensionId,
        donor.weight - configuration.sensitivityStep,
      );
      const metrics = configuration.metrics.map((metric) => {
        const baselineDimension = configuration.dimensions.find(
          (dimension) => dimension.dimensionId === metric.dimensionId,
        )!;
        const nextDimensionWeight = nextDimensionWeights.get(metric.dimensionId)!;
        return {
          ...metric,
          weight: (metric.weight / baselineDimension.weight) * nextDimensionWeight,
        };
      });
      scenarios.push({
        ...configuration,
        configurationVersion: `${configuration.configurationVersion}:sensitivity:${donor.dimensionId}-to-${receiver.dimensionId}`,
        metrics,
        dimensions: configuration.dimensions.map((dimension) => ({
          ...dimension,
          weight: nextDimensionWeights.get(dimension.dimensionId)!,
        })),
      });
    }
  }
  return scenarios;
}

function sensitivityClassification(
  rankRange: number,
): "stable" | "moderately-sensitive" | "highly-sensitive" {
  if (rankRange <= 5) return "stable";
  if (rankRange <= 20) return "moderately-sensitive";
  return "highly-sensitive";
}

export function scoreSyntheticMarkets(
  snapshot: SyntheticMarketSnapshot,
  configuration: MarketAttractivenessConfiguration,
): MarketAttractivenessResult[] {
  validateMarketAttractivenessConfiguration(configuration);
  validateSyntheticMarketSnapshot(snapshot, configuration);
  const normalizedMarkets = normalizeMarkets(snapshot, configuration);
  const baseline = buildWeightedResults(
    normalizedMarkets,
    snapshot,
    configuration,
  );
  const scenarios = createSensitivityConfigurations(configuration);
  const scenarioRanks = scenarios.map((scenario) => {
    validateMarketAttractivenessConfiguration(scenario);
    return new Map(
      buildWeightedResults(normalizedMarkets, snapshot, scenario).map((result) => [
        result.prototypeMarketId,
        result.cohortRank,
      ]),
    );
  });

  for (const result of baseline) {
    const ranks = [
      result.cohortRank,
      ...scenarioRanks.map(
        (scenario) => scenario.get(result.prototypeMarketId) ?? result.cohortRank,
      ),
    ];
    const bestRank = Math.min(...ranks);
    const worstRank = Math.max(...ranks);
    result.sensitivity = {
      scenarioCount: scenarios.length,
      baselineRank: result.cohortRank,
      bestRank,
      worstRank,
      rankRange: worstRank - bestRank,
      classification: sensitivityClassification(worstRank - bestRank),
    };
  }
  return baseline;
}

export function reconcileMarketResult(
  result: MarketAttractivenessResult,
): boolean {
  return (
    Math.abs(
      sum(result.metricResults.map((metric) => metric.contribution)) -
        result.overallScore,
    ) <= EPSILON
  );
}
