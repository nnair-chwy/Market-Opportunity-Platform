import { createHash } from "node:crypto";
import { GROWTH_TEST_SCREENING_VERSION, GROWTH_TEST_SCREENING_WEIGHTS } from "./growth-screening-config.ts";

export { GROWTH_TEST_SCREENING_VERSION, GROWTH_TEST_SCREENING_WEIGHTS } from "./growth-screening-config.ts";

export const GROWTH_TEST_SCREENING_FINGERPRINT = createHash("sha256")
  .update(JSON.stringify({ version: GROWTH_TEST_SCREENING_VERSION, weights: GROWTH_TEST_SCREENING_WEIGHTS, normalization: "complete-cohort-lower-count-percentile-v1", tieBreak: "cbsa_code_ascending" }))
  .digest("hex");

export type GrowthScreeningInput = {
  cbsaCode: string;
  cbsaName: string;
  demand2024: number | null;
  demand2025: number | null;
  activeCustomersPer1000Households: number | null;
  activeCustomerYoyGrowth: number | null;
  veterinarySearchConversions: number | null;
  householdCount: number | null;
  sourceIds: string;
};

type MetricId = keyof typeof GROWTH_TEST_SCREENING_WEIGHTS;

export type GrowthScreeningResult = GrowthScreeningInput & {
  eligible: true;
  regionalDemandGrowth2024To2025: number;
  percentiles: Record<MetricId, number>;
  contributions: Record<MetricId, number>;
  score: number;
  rank: number;
  evidenceStatus: "Hypothesis";
  allowedUse: "local_demo_growth_test_screening_only";
  scoringVersion: typeof GROWTH_TEST_SCREENING_VERSION;
  configurationFingerprint: typeof GROWTH_TEST_SCREENING_FINGERPRINT;
};

export type GrowthScreeningExclusion = {
  cbsaCode: string;
  cbsaName: string;
  eligible: false;
  missingMetricIds: MetricId[];
};

function percentile(values: number[], value: number) {
  if (values.length <= 1) return 50;
  return values.filter((candidate) => candidate < value).length / (values.length - 1) * 100;
}

export function calculateGrowthTestScreening(inputs: GrowthScreeningInput[]) {
  const prepared = inputs.map((input) => ({
    ...input,
    regionalDemandGrowth2024To2025: input.demand2024 !== null && input.demand2024 !== 0 && input.demand2025 !== null
      ? (input.demand2025 - input.demand2024) / Math.abs(input.demand2024)
      : null,
  }));
  const metricIds = Object.keys(GROWTH_TEST_SCREENING_WEIGHTS) as MetricId[];
  const excluded: GrowthScreeningExclusion[] = [];
  const complete = prepared.filter((row) => {
    const missingMetricIds = metricIds.filter((metric) => row[metric] === null || !Number.isFinite(row[metric]));
    if (missingMetricIds.length) excluded.push({ cbsaCode: row.cbsaCode, cbsaName: row.cbsaName, eligible: false, missingMetricIds });
    return missingMetricIds.length === 0;
  }) as Array<typeof prepared[number] & Record<MetricId, number>>;
  const distributions = Object.fromEntries(metricIds.map((metric) => [metric, complete.map((row) => row[metric])])) as Record<MetricId, number[]>;
  const scored = complete.map((row) => {
    const percentiles = Object.fromEntries(metricIds.map((metric) => [metric, percentile(distributions[metric], row[metric])])) as Record<MetricId, number>;
    const contributions = Object.fromEntries(metricIds.map((metric) => [metric, percentiles[metric] * GROWTH_TEST_SCREENING_WEIGHTS[metric]])) as Record<MetricId, number>;
    return {
      ...row,
      eligible: true as const,
      percentiles,
      contributions,
      score: metricIds.reduce((sum, metric) => sum + contributions[metric], 0),
      rank: 0,
      evidenceStatus: "Hypothesis" as const,
      allowedUse: "local_demo_growth_test_screening_only" as const,
      scoringVersion: GROWTH_TEST_SCREENING_VERSION,
      configurationFingerprint: GROWTH_TEST_SCREENING_FINGERPRINT,
    };
  }).sort((left, right) => right.score - left.score || left.cbsaCode.localeCompare(right.cbsaCode));
  scored.forEach((row, index) => { row.rank = index + 1; });
  excluded.sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode));
  return { included: scored as GrowthScreeningResult[], excluded };
}
