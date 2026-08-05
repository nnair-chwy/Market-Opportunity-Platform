import type { CbsaType } from "../cbsa-universe/index.ts";

export const CBSA_ACS_VINTAGE = 2024 as const;
export const CBSA_ACS_PERIOD_LABEL = "2020–2024 ACS 5-year estimate" as const;
export const CBSA_ACS_OBSERVED_AT = "2024-12-31" as const;
export const CBSA_ACS_SOURCE_ID = "SRC-016" as const;
export const CBSA_ACS_TRANSFORMATION_VERSION = "cbsa-acs-v1" as const;

export const CBSA_ACS_METRICS = {
  total_population: { metric_id: "census.total_population", variable: "B01003_001E", annotation: "B01003_001EA", unit: "people", evidence_status: "Confirmed" },
  household_count: { metric_id: "census.household_count", variable: "B11001_001E", annotation: "B11001_001EA", unit: "households", evidence_status: "Confirmed" },
  median_household_income: { metric_id: "census.median_household_income", variable: "B19013_001E", annotation: "B19013_001EA", unit: "usd", evidence_status: "Confirmed" },
  housing_unit_count: { metric_id: "census.housing_unit_count", variable: "B25001_001E", annotation: "B25001_001EA", unit: "housing_units", evidence_status: "Confirmed" },
} as const;

export type CbsaAcsDirectMetricKey = keyof typeof CBSA_ACS_METRICS;
export type CbsaAcsMetricKey = CbsaAcsDirectMetricKey | "population_density";

export type CbsaAcsMetric = {
  metric_id: string;
  raw_value: number | null;
  unit: string;
  source_id: typeof CBSA_ACS_SOURCE_ID;
  observed_at: typeof CBSA_ACS_OBSERVED_AT;
  geography: "cbsa";
  quality_status: "accepted" | "warning" | "rejected";
  evidence_status: "Confirmed" | "Derived";
  sensitivity: "public";
  allowed_use: "market_context_only";
  scoring_weight: "none";
  warning: string | null;
};

export type CbsaAcsMarket = {
  market_id: string;
  cbsa_code: string;
  cbsa_name: string;
  cbsa_type: CbsaType;
  census_geo_id: string;
  metrics: Record<CbsaAcsMetricKey, CbsaAcsMetric>;
};

export type CbsaAcsSnapshot = {
  schema_version: "1.0.0";
  transformation_version: typeof CBSA_ACS_TRANSFORMATION_VERSION;
  dataset: "acs/acs5";
  dataset_vintage: typeof CBSA_ACS_VINTAGE;
  estimate_period: typeof CBSA_ACS_PERIOD_LABEL;
  observed_at: typeof CBSA_ACS_OBSERVED_AT;
  source_id: typeof CBSA_ACS_SOURCE_ID;
  sensitivity: "public";
  allowed_use: "market_context_only";
  scoring_weight: "none";
  markets: CbsaAcsMarket[];
};

export type RejectedAcsRow = {
  row_number: number;
  cbsa_code: string | null;
  reasons: string[];
};

export type CbsaAcsTransformationResult = {
  snapshot: CbsaAcsSnapshot;
  rejected_rows: RejectedAcsRow[];
  counts: {
    input_rows: number;
    matched_rows: number;
    missing_markets: number;
    rejected_rows: number;
    unmatched_rows: number;
  };
};
