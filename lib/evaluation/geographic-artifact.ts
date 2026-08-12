import { z } from "zod";
import { publicMarkets } from "../data/public-market-ui.ts";
import { stateDogOwnership, statePetMarketSources } from "../data/state-dog-ownership.ts";
import type { AnalysisPlan } from "./analysis-plan.ts";
import {
  formatPublicMarketValue,
  publicMarketMeasure,
  type PublicMarketMeasureId,
} from "./geographic-measures.ts";

export const geographicArtifactRowSchema = z.object({
  entityId: z.string().min(1),
  entityLabel: z.string().min(1),
  rawValue: z.number().finite().nullable(),
  score: z.number().finite().min(0).max(100).nullable(),
  rank: z.number().int().positive().nullable(),
  displayValue: z.string().min(1),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

export const geographicArtifactSchema = z.object({
  schemaVersion: z.literal("geographic-artifact-v1"),
  artifactId: z.string().min(1),
  planId: z.string().min(1),
  question: z.string().min(1),
  title: z.string().min(1),
  geography: z.object({
    grain: z.enum(["us_state", "cbsa_market", "submarket", "zip", "trade_area", "site"]),
    label: z.string().min(1),
    sourceId: z.string().min(1),
    version: z.string().min(1),
  }),
  measure: z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    shortLabel: z.string().min(1),
    unit: z.string().min(1),
    formula: z.string().min(1),
    sourceIds: z.array(z.string().min(1)).min(1),
    sourceTitle: z.string().min(1),
    sourceUrl: z.string().url(),
    observedPeriod: z.string().min(1),
    evidenceStatus: z.enum(["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"]),
    allowedUse: z.string().min(1),
    limitation: z.string().min(1),
  }),
  comparison: z.object({
    cohort: z.string().min(1),
    direction: z.literal("descending"),
    tieBreak: z.string().min(1),
  }),
  rows: z.array(geographicArtifactRowSchema).min(1),
  defaultSelectedEntityId: z.string().nullable(),
  evidenceBoundary: z.string().min(1),
});

export type GeographicArtifact = z.infer<typeof geographicArtifactSchema>;
export type GeographicArtifactRow = z.infer<typeof geographicArtifactRowSchema>;
export type StatePetLayer = "dog" | "cat" | "dogIncome";

function percentile(index: number, count: number) {
  return count <= 1 ? 100 : Number((((count - 1 - index) / (count - 1)) * 100).toFixed(1));
}

export function publicMarketGeographicArtifact(
  plan: AnalysisPlan,
  measureId: PublicMarketMeasureId,
): GeographicArtifact {
  const measure = publicMarketMeasure(measureId);
  const observed = publicMarkets
    .map((market) => ({
      market,
      value: market.acs?.metrics[measure.metricKey].raw_value ?? null,
    }))
    .filter((item): item is { market: (typeof publicMarkets)[number]; value: number } => item.value !== null)
    .sort((a, b) => b.value - a.value || a.market.cbsa_name.localeCompare(b.market.cbsa_name) || a.market.cbsa_code.localeCompare(b.market.cbsa_code));
  const scoreByCode = new Map(observed.map((item, index) => [item.market.cbsa_code, percentile(index, observed.length)]));
  const rankByCode = new Map(observed.map((item, index) => [item.market.cbsa_code, index + 1]));
  const rows = publicMarkets
    .map((market) => {
      const rawValue = market.acs?.metrics[measure.metricKey].raw_value ?? null;
      return {
        entityId: market.cbsa_code,
        entityLabel: market.cbsa_name,
        rawValue,
        score: scoreByCode.get(market.cbsa_code) ?? null,
        rank: rankByCode.get(market.cbsa_code) ?? null,
        displayValue: rawValue === null ? "Unavailable" : formatPublicMarketValue(rawValue, measureId),
        attributes: { cbsaType: market.cbsa_type },
      };
    })
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || a.entityLabel.localeCompare(b.entityLabel));

  return geographicArtifactSchema.parse({
    schemaVersion: "geographic-artifact-v1",
    artifactId: `${plan.planId}:${measure.id}:${plan.originalQuestion}`,
    planId: plan.planId,
    question: plan.originalQuestion,
    title: `${measure.label} across U.S. Census markets`,
    geography: { grain: "cbsa_market", label: "U.S. Census Core Based Statistical Area", sourceId: "SRC-015", version: "cbsa-geometry-2024" },
    measure: {
      id: measure.id,
      label: measure.label,
      shortLabel: measure.shortLabel,
      unit: measure.unit,
      formula: `Observed ${measure.label.toLowerCase()} ranked across available CBSAs; equal values use market name and CBSA code as deterministic tie-breaks.`,
      sourceIds: [measure.sourceId],
      sourceTitle: measure.sourceTitle,
      sourceUrl: measure.sourceUrl,
      observedPeriod: "2020–2024 ACS five-year estimate",
      evidenceStatus: measure.evidenceStatus,
      allowedUse: measure.allowedUse,
      limitation: measure.limitation,
    },
    comparison: { cohort: "U.S. CBSAs with compatible observed values", direction: "descending", tieBreak: "Market name, then CBSA code" },
    rows,
    defaultSelectedEntityId: rows.find((row) => row.rawValue !== null)?.entityId ?? null,
    evidenceBoundary: plan.evidenceBoundary,
  });
}

export function statePetGeographicArtifact(plan: AnalysisPlan, layer: StatePetLayer): GeographicArtifact {
  const ownership = statePetMarketSources.ownership;
  const isCat = layer === "cat";
  const isCrossover = layer === "dogIncome";
  const measure = isCrossover
    ? {
        id: "dog_income_proxy",
        label: "Dog ownership × income proxy",
        shortLabel: "Dog × income",
        unit: "percentile proxy score",
        formula: statePetMarketSources.crossoverFormula,
        sourceIds: [ownership.sourceId, statePetMarketSources.income.sourceId],
        sourceTitle: `${ownership.title} + ${statePetMarketSources.income.title}`,
        sourceUrl: statePetMarketSources.income.url,
        observedPeriod: "2016 ownership estimate + 2020–2024 ACS income estimate",
        evidenceStatus: "Derived" as const,
        limitation: statePetMarketSources.crossoverLimitation,
      }
    : {
        id: isCat ? "cat_ownership" : "dog_ownership",
        label: isCat ? "Cat ownership" : "Dog ownership",
        shortLabel: isCat ? "Cat ownership" : "Dog ownership",
        unit: "% of households",
        formula: ownership.scoreFormula,
        sourceIds: [ownership.sourceId],
        sourceTitle: ownership.title,
        sourceUrl: ownership.url,
        observedPeriod: "2016 survey estimate",
        evidenceStatus: "Reported" as const,
        limitation: ownership.limitation,
      };
  const rows = stateDogOwnership
    .map((state) => {
      const rawValue = isCrossover ? state.dogIncomeProxyScore : isCat ? state.catHouseholdRate : state.householdRate;
      const score = isCrossover ? state.dogIncomeProxyScore : isCat ? state.catRelativeScore : state.relativeScore;
      const rank = isCrossover ? state.dogIncomeProxyRank : isCat ? state.catRank : state.rank;
      return {
        entityId: state.fips,
        entityLabel: state.name,
        rawValue,
        score,
        rank,
        displayValue: rawValue === null ? "Not reported" : isCrossover ? rawValue.toFixed(0) : `${rawValue.toFixed(1)}%`,
        attributes: { stateCode: state.code, householdIncome: state.medianHouseholdIncome, incomeScore: state.incomeRelativeScore },
      };
    })
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || a.entityLabel.localeCompare(b.entityLabel));

  return geographicArtifactSchema.parse({
    schemaVersion: "geographic-artifact-v1",
    artifactId: `${plan.planId}:${measure.id}:${plan.originalQuestion}`,
    planId: plan.planId,
    question: plan.originalQuestion,
    title: `${measure.label} across U.S. states`,
    geography: { grain: "us_state", label: "U.S. state and District of Columbia", sourceId: "US-ATLAS-STATES-10M", version: "states-10m-v3" },
    measure: { ...measure, allowedUse: "public_context_only" },
    comparison: { cohort: "States and DC with a reported compatible value", direction: "descending", tieBreak: "State name" },
    rows,
    defaultSelectedEntityId: rows.find((row) => row.rawValue !== null)?.entityId ?? null,
    evidenceBoundary: plan.evidenceBoundary,
  });
}
