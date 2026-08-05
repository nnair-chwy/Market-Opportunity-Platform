import type { CensusMetricId } from "./types.ts";

export type CensusVariableDefinition = {
  metricId: Exclude<CensusMetricId, "census.population_density">;
  variableId: string;
  annotationVariableId: string;
  unit: "people" | "households" | "usd" | "housing_units";
  label: string;
};

export const CENSUS_VARIABLE_CATALOG = {
  "census.total_population": {
    metricId: "census.total_population",
    variableId: "B01003_001E",
    annotationVariableId: "B01003_001EA",
    unit: "people",
    label: "Total population",
  },
  "census.household_count": {
    metricId: "census.household_count",
    variableId: "B11001_001E",
    annotationVariableId: "B11001_001EA",
    unit: "households",
    label: "Households",
  },
  "census.median_household_income": {
    metricId: "census.median_household_income",
    variableId: "B19013_001E",
    annotationVariableId: "B19013_001EA",
    unit: "usd",
    label: "Median household income in the past 12 months",
  },
  "census.housing_unit_count": {
    metricId: "census.housing_unit_count",
    variableId: "B25001_001E",
    annotationVariableId: "B25001_001EA",
    unit: "housing_units",
    label: "Housing units",
  },
} as const satisfies Record<
  Exclude<CensusMetricId, "census.population_density">,
  CensusVariableDefinition
>;

export const DEFAULT_CENSUS_METRICS = Object.freeze([
  "census.total_population",
  "census.household_count",
  "census.median_household_income",
  "census.housing_unit_count",
] as const satisfies readonly CensusMetricId[]);

export function isDirectCensusMetric(
  metricId: CensusMetricId,
): metricId is keyof typeof CENSUS_VARIABLE_CATALOG {
  return metricId !== "census.population_density";
}
