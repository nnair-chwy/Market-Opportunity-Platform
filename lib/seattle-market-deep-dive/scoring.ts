import {
  SEATTLE_DEEP_DIVE_CALCULATION_VERSION,
  SEATTLE_SUBMARKET_METRICS,
} from "./config.ts";
import type {
  SeattleSubmarket,
  SeattleSubmarketScore,
  SubmarketMetricDefinition,
  SubmarketMetricId,
} from "./types.ts";

export type SeattleSubmarketComparison = {
  calculationVersion: typeof SEATTLE_DEEP_DIVE_CALCULATION_VERSION;
  scores: SeattleSubmarketScore[];
  prioritySubmarketIds: string[];
  languageBoundary: "priority_under_demo_criteria";
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function validateMetrics(metrics: readonly SubmarketMetricDefinition[]) {
  const ids = new Set<SubmarketMetricId>();
  let weightTotal = 0;
  for (const metric of metrics) {
    if (ids.has(metric.metricId)) throw new Error(`Duplicate Seattle metric: ${metric.metricId}`);
    if (!Number.isFinite(metric.weight) || metric.weight < 0) {
      throw new Error(`Invalid Seattle metric weight: ${metric.metricId}`);
    }
    ids.add(metric.metricId);
    weightTotal += metric.weight;
  }
  if (Math.abs(weightTotal - 100) > 1e-9) {
    throw new Error(`Seattle metric weights must total 100; received ${weightTotal}.`);
  }
}

function calculateTotals(
  submarkets: readonly SeattleSubmarket[],
  metrics: readonly SubmarketMetricDefinition[],
) {
  return submarkets.map((submarket) => {
    const availableWeight = metrics.reduce((total, metric) => {
      const value = submarket.metrics[metric.metricId];
      if (value !== null && !Number.isFinite(value)) {
        throw new Error(`Non-finite value for ${submarket.submarket_id}:${metric.metricId}`);
      }
      return value === null ? total : total + metric.weight;
    }, 0);
    const metricResults = metrics.map((metric) => {
      const rawValue = submarket.metrics[metric.metricId];
      if (rawValue === null) {
        return {
          metricId: metric.metricId,
          label: metric.label,
          rawValue: null,
          normalizedValue: null,
          configuredWeight: metric.weight,
          effectiveWeight: 0,
          contribution: null,
          state: "missing" as const,
        };
      }
      const effectiveWeight = availableWeight === 0 ? 0 : (metric.weight / availableWeight) * 100;
      return {
        metricId: metric.metricId,
        label: metric.label,
        rawValue,
        normalizedValue: rawValue,
        configuredWeight: metric.weight,
        effectiveWeight: round(effectiveWeight),
        contribution: round((rawValue * effectiveWeight) / 100),
        state: "available" as const,
      };
    });
    return {
      submarket,
      metricResults,
      total: round(metricResults.reduce((sum, metric) => sum + (metric.contribution ?? 0), 0)),
      coveragePercent: round(availableWeight),
    };
  });
}

function rankTotals(totals: ReturnType<typeof calculateTotals>) {
  return [...totals]
    .sort((left, right) => right.total - left.total || left.submarket.submarket_id.localeCompare(right.submarket.submarket_id))
    .map((result, index) => ({ ...result, rank: index + 1 }));
}

function sensitivityScenarios(metrics: readonly SubmarketMetricDefinition[]) {
  return metrics.flatMap((focusMetric) => [-5, 5].map((delta) => {
    const otherTotal = 100 - focusMetric.weight;
    return metrics.map((metric) => {
      if (metric.metricId === focusMetric.metricId) return { ...metric, weight: metric.weight + delta };
      return { ...metric, weight: metric.weight - (delta * metric.weight) / otherTotal };
    });
  }));
}

export function compareSeattleSubmarkets(
  submarkets: readonly SeattleSubmarket[],
  metrics: readonly SubmarketMetricDefinition[] = SEATTLE_SUBMARKET_METRICS,
): SeattleSubmarketComparison {
  validateMetrics(metrics);
  if (new Set(submarkets.map((item) => item.submarket_id)).size !== submarkets.length) {
    throw new Error("Seattle comparison requires unique submarket IDs.");
  }
  const baseline = rankTotals(calculateTotals(submarkets, metrics));
  const scenarioRanks = new Map<string, number[]>();
  for (const scenario of sensitivityScenarios(metrics)) {
    for (const result of rankTotals(calculateTotals(submarkets, scenario))) {
      const ranks = scenarioRanks.get(result.submarket.submarket_id) ?? [];
      ranks.push(result.rank);
      scenarioRanks.set(result.submarket.submarket_id, ranks);
    }
  }
  const scores = baseline.map((result) => {
    const ranks = scenarioRanks.get(result.submarket.submarket_id) ?? [result.rank];
    const bestRank = Math.min(result.rank, ...ranks);
    const worstRank = Math.max(result.rank, ...ranks);
    return {
      submarketId: result.submarket.submarket_id,
      label: result.submarket.label,
      overallScore: result.total,
      priorityRank: result.rank,
      coveragePercent: result.coveragePercent,
      metricResults: result.metricResults,
      missingInputs: result.metricResults.filter((metric) => metric.state === "missing").map((metric) => metric.metricId),
      sensitivity: { baselineRank: result.rank, bestRank, worstRank, rankRange: worstRank - bestRank },
      evidenceStatus: "Hypothesis" as const,
      sourceId: result.submarket.source_id,
      allowedUse: "synthetic_prototype_only" as const,
    };
  });
  return {
    calculationVersion: SEATTLE_DEEP_DIVE_CALCULATION_VERSION,
    scores,
    prioritySubmarketIds: scores.slice(0, 3).map((score) => score.submarketId),
    languageBoundary: "priority_under_demo_criteria",
  };
}
