import { z } from "zod";
import type { PublicMarketRecord } from "../data/cbsa-market-context.ts";
import type { CbsaAcsMetricKey } from "../data/cbsa-acs/index.ts";
import type { EvaluationPlan } from "./contracts.ts";

export const MARKET_CONTEXT_EXECUTION_VERSION = "market-context-execution-v1" as const;
export const MARKET_CONTEXT_SNAPSHOT_VERSION = "SRC-016:2024" as const;
export const MARKET_CONTEXT_CALCULATION_VERSION = "compare-cohort-percentile-v1" as const;

const evidenceStatusSchema = z.enum(["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"]);

export const executionEvidenceSchema = z.object({
  evidenceId: z.string().min(1),
  metricId: z.string().min(1),
  label: z.string().min(1),
  geographyId: z.string().min(1),
  geographyLabel: z.string().min(1),
  rawValue: z.number().finite().nullable(),
  unit: z.string().min(1),
  sourceId: z.string().min(1),
  snapshotId: z.string().min(1),
  evidenceStatus: evidenceStatusSchema,
  qualityStatus: z.enum(["accepted", "warning", "rejected", "unknown"]),
  availability: z.enum(["available", "missing", "unknown"]),
  observationStart: z.string().nullable(),
  observationEnd: z.string().nullable(),
  allowedUse: z.literal("market_context_only"),
  sensitivity: z.literal("public"),
  warning: z.string().nullable(),
}).strict();

export const executionComparisonSchema = z.object({
  cbsaCode: z.string().min(1),
  cbsaName: z.string().min(1),
  metricId: z.string().min(1),
  rawValue: z.number().finite(),
  unit: z.string().min(1),
  rank: z.number().int().positive(),
  percentile: z.number().finite().min(0).max(100),
  evidenceStatus: evidenceStatusSchema,
  sourceId: z.literal("SRC-016"),
}).strict();

export const evaluationExecutionResultSchema = z.object({
  executionId: z.string().min(1),
  executionVersion: z.literal(MARKET_CONTEXT_EXECUTION_VERSION),
  status: z.enum(["complete", "blocked", "research_needed"]),
  snapshotVersion: z.literal(MARKET_CONTEXT_SNAPSHOT_VERSION),
  calculationVersion: z.literal(MARKET_CONTEXT_CALCULATION_VERSION),
  evidenceBundle: z.array(executionEvidenceSchema),
  comparisons: z.array(executionComparisonSchema),
  supportedFindings: z.array(z.string().min(1)),
  contraryEvidence: z.array(z.string().min(1)),
  missingEvidence: z.array(z.string().min(1)),
  warnings: z.array(z.string().min(1)),
  confidence: z.enum(["High", "Medium", "Low"]),
  confidenceRationale: z.string().min(1),
}).strict();

export type EvaluationExecutionResult = z.infer<typeof evaluationExecutionResultSchema>;

const metricLabels: Record<CbsaAcsMetricKey, string> = {
  total_population: "Population",
  household_count: "Households",
  median_household_income: "Median household income",
  housing_unit_count: "Housing units",
  population_density: "Population density",
};

function selectedMarkets(plan: EvaluationPlan, markets: readonly PublicMarketRecord[]) {
  const codes = new Set(plan.geographyResolution.selectedCbsaCodes);
  const filtered = codes.size
    ? markets.filter((market) => codes.has(market.cbsa_code))
    : markets.filter((market) => market.cbsa_type === "metropolitan");
  return filtered.filter((market) => market.geometry_status === "available");
}

function blockedResult(plan: EvaluationPlan, reason: string): EvaluationExecutionResult {
  return evaluationExecutionResultSchema.parse({
    executionId: `execution-${plan.planId}`,
    executionVersion: MARKET_CONTEXT_EXECUTION_VERSION,
    status: "blocked",
    snapshotVersion: MARKET_CONTEXT_SNAPSHOT_VERSION,
    calculationVersion: MARKET_CONTEXT_CALCULATION_VERSION,
    evidenceBundle: [],
    comparisons: [],
    supportedFindings: [],
    contraryEvidence: [],
    missingEvidence: [reason],
    warnings: ["No deterministic calculation was run."],
    confidence: "Low",
    confidenceRationale: "The requested capability or required evidence is not executable in the approved local snapshot.",
  });
}

export function executeEvaluationPlan(
  plan: EvaluationPlan,
  markets: readonly PublicMarketRecord[],
): EvaluationExecutionResult {
  if (plan.capabilityId !== "census_market_context" || plan.status === "blocked") {
    return blockedResult(plan, plan.missingEvidence[0] ?? "This capability is not executable in the approved local snapshot.");
  }
  if (plan.intent.requestedMeasure === "none") {
    return blockedResult(plan, "Select one supported Census market measure before execution.");
  }

  const metricKey = plan.intent.requestedMeasure as CbsaAcsMetricKey;
  const candidates = selectedMarkets(plan, markets);
  const observations = candidates.map((market) => market.acs?.metrics[metricKey] ?? null);
  const available = candidates
    .map((market, index) => ({ market, observation: observations[index] }))
    .filter((item): item is { market: PublicMarketRecord; observation: NonNullable<typeof item.observation> } =>
      item.observation?.raw_value !== null && item.observation?.raw_value !== undefined,
    );
  if (!available.length) return blockedResult(plan, `No accepted ${metricLabels[metricKey].toLowerCase()} observations are available for the resolved geography.`);

  const ordered = [...available].sort((left, right) =>
    (right.observation.raw_value as number) - (left.observation.raw_value as number)
    || left.market.cbsa_code.localeCompare(right.market.cbsa_code),
  );
  const evidenceBundle = available.map(({ market, observation }) => ({
    evidenceId: `${market.cbsa_code}:${observation.metric_id}`,
    metricId: observation.metric_id,
    label: metricLabels[metricKey],
    geographyId: market.cbsa_code,
    geographyLabel: market.cbsa_name,
    rawValue: observation.raw_value,
    unit: observation.unit,
    sourceId: observation.source_id,
    snapshotId: MARKET_CONTEXT_SNAPSHOT_VERSION,
    evidenceStatus: observation.evidence_status,
    qualityStatus: observation.quality_status,
    availability: "available" as const,
    observationStart: null,
    observationEnd: observation.observed_at,
    allowedUse: "market_context_only" as const,
    sensitivity: "public" as const,
    warning: observation.warning,
  }));
  const comparisons = ordered.map(({ market, observation }, index) => ({
    cbsaCode: market.cbsa_code,
    cbsaName: market.cbsa_name,
    metricId: observation.metric_id,
    rawValue: observation.raw_value as number,
    unit: observation.unit,
    rank: index + 1,
    percentile: ordered.length === 1 ? 50 : ((ordered.length - 1 - index) / (ordered.length - 1)) * 100,
    evidenceStatus: observation.evidence_status,
    sourceId: "SRC-016" as const,
  }));
  const missingCount = candidates.length - available.length;
  const warnings = [
    "CBSA boundaries are public statistical context, not trade areas, drive-time areas, or service areas.",
    ...(missingCount ? [`${missingCount} resolved market(s) had missing ${metricLabels[metricKey].toLowerCase()} evidence and were not ranked.`] : []),
  ];
  return evaluationExecutionResultSchema.parse({
    executionId: `execution-${plan.planId}`,
    executionVersion: MARKET_CONTEXT_EXECUTION_VERSION,
    status: "complete",
    snapshotVersion: MARKET_CONTEXT_SNAPSHOT_VERSION,
    calculationVersion: MARKET_CONTEXT_CALCULATION_VERSION,
    evidenceBundle,
    comparisons,
    supportedFindings: [`${comparisons.length} market(s) were compared on ${metricLabels[metricKey].toLowerCase()} using the approved ${MARKET_CONTEXT_SNAPSHOT_VERSION} snapshot.`],
    contraryEvidence: ["A higher public Census measure is descriptive context and does not establish clinic demand, capacity, or opportunity."],
    missingEvidence: missingCount ? [`${missingCount} market(s) have no usable ${metricLabels[metricKey].toLowerCase()} observation.`] : [],
    warnings,
    confidence: missingCount ? "Medium" : "High",
    confidenceRationale: missingCount
      ? "The deterministic comparison completed, but some resolved markets lacked the requested public measure."
      : "All resolved markets had accepted values for the requested public measure; interpretation remains market context only.",
  });
}
