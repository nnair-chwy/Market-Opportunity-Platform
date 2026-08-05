export type MarketCohort = "metropolitan" | "micropolitan";

export type MarketDimensionId =
  | "chewy_demand"
  | "market_capacity"
  | "veterinary_opportunity"
  | "chewy_clinic_engagement";

export type MarketMetricId =
  | "active_customers_per_1000_households"
  | "active_customer_count"
  | "active_customer_yoy_growth"
  | "total_households"
  | "avg_zip_median_household_income"
  | "clinics_per_10000_households"
  | "veterinarians_per_10000_households"
  | "corporate_clinic_share"
  | "practice_hub_clinic_share"
  | "clinic_orders_per_clinic";

export type MarketMetricValues = Record<MarketMetricId, number>;

export type SyntheticMarketRecord = {
  prototype_market_id: string;
  cbsa_code: string | null;
  cbsa_join_status: "exact_name" | "unmatched";
  cbsa_join_source_id: "SRC-014";
  cbsa_join_vintage: "2023-07";
  cbsa_name: string;
  cbsa_type: MarketCohort;
  reporting_date: string;
  evidence_status: "Hypothesis";
  scoring_eligibility: "synthetic_prototype_only";
  synthetic_method_version: string;
  synthetic_fields: string[];
  metrics: MarketMetricValues;
  source_values: Record<string, number | null>;
  sources: {
    customer: string;
    geography: string;
    household_income: string;
    clinic: string;
    population: string;
  };
};

export type SyntheticMarketSnapshot = {
  schema_version: "1.0.0";
  data_version: string;
  transformation_version: string;
  evidence_status: "Hypothesis";
  allowed_use: "synthetic_prototype_only";
  markets: SyntheticMarketRecord[];
};

export type MarketMetricDefinition = {
  metricId: MarketMetricId;
  label: string;
  description: string;
  dimensionId: MarketDimensionId;
  direction: "higher-is-better" | "lower-is-better";
  transform: "identity" | "log1p";
  unit:
    | "count"
    | "percent"
    | "usd"
    | "customers_per_1000_households"
    | "clinics_per_10000_households"
    | "veterinarians_per_10000_households"
    | "orders_per_clinic";
  weight: number;
  prototypeAssumption?: string;
};

export type MarketDimensionDefinition = {
  dimensionId: MarketDimensionId;
  label: string;
  weight: number;
  description: string;
};

export type MarketAttractivenessConfiguration = {
  configurationVersion: string;
  calculationVersion: string;
  normalizationVersion: string;
  status: "synthetic";
  label: string;
  expectedWeightTotal: 100;
  winsorLowerPercentile: number;
  winsorUpperPercentile: number;
  sensitivityStep: number;
  metrics: MarketMetricDefinition[];
  dimensions: MarketDimensionDefinition[];
  notes: string[];
};

export type MarketMetricResult = {
  metricId: MarketMetricId;
  label: string;
  dimensionId: MarketDimensionId;
  rawValue: number;
  transformedValue: number;
  winsorizedValue: number;
  winsorLowerBound: number;
  winsorUpperBound: number;
  normalizedScore: number;
  direction: MarketMetricDefinition["direction"];
  transform: MarketMetricDefinition["transform"];
  unit: MarketMetricDefinition["unit"];
  weight: number;
  contribution: number;
  prototypeAssumption: string | null;
};

export type MarketSubscore = {
  dimensionId: MarketDimensionId;
  label: string;
  weight: number;
  score: number;
  contribution: number;
};

export type MarketSensitivitySummary = {
  scenarioCount: number;
  baselineRank: number;
  bestRank: number;
  worstRank: number;
  rankRange: number;
  classification: "stable" | "moderately-sensitive" | "highly-sensitive";
};

export type MarketAttractivenessResult = {
  prototypeMarketId: string;
  cbsaCode: string | null;
  cbsaJoinStatus: SyntheticMarketRecord["cbsa_join_status"];
  cbsaJoinSourceId: SyntheticMarketRecord["cbsa_join_source_id"];
  cbsaJoinVintage: SyntheticMarketRecord["cbsa_join_vintage"];
  marketName: string;
  cohort: MarketCohort;
  reportingDate: string;
  evidenceStatus: "Hypothesis";
  allowedUse: "synthetic_prototype_only";
  dataVersion: string;
  configurationVersion: string;
  configurationFingerprint: string;
  calculationVersion: string;
  normalizationVersion: string;
  syntheticMethodVersion: string;
  syntheticFields: string[];
  metricResults: MarketMetricResult[];
  subscores: MarketSubscore[];
  overallScore: number;
  cohortRank: number;
  cohortPercentile: number;
  missingInputs: string[];
  excludedMetrics: string[];
  warnings: string[];
  sources: SyntheticMarketRecord["sources"];
  sensitivity: MarketSensitivitySummary;
};

export type MarketScoringValidationIssue = {
  code:
    | "invalid-weight-total"
    | "invalid-dimension-total"
    | "invalid-configuration"
    | "duplicate-market-id"
    | "invalid-market"
    | "missing-input"
    | "invalid-input"
    | "invalid-evidence-status"
    | "invalid-allowed-use";
  path: string;
  message: string;
};

export class MarketScoringValidationError extends Error {
  readonly issues: MarketScoringValidationIssue[];

  constructor(issues: MarketScoringValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "MarketScoringValidationError";
    this.issues = issues;
  }
}
