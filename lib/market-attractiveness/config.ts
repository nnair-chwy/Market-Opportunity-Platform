import type {
  MarketAttractivenessConfiguration,
  MarketDimensionDefinition,
  MarketMetricDefinition,
} from "./types.ts";

export const MARKET_ATTRACTIVENESS_CONFIGURATION_VERSION =
  "market-attractiveness-synthetic-v1" as const;
export const MARKET_ATTRACTIVENESS_CALCULATION_VERSION =
  "market-attractiveness-calculation-v1" as const;
export const MARKET_ATTRACTIVENESS_NORMALIZATION_VERSION =
  "cohort-winsorized-percentile-v1" as const;

export const MARKET_DIMENSIONS: readonly MarketDimensionDefinition[] = [
  {
    dimensionId: "chewy_demand",
    label: "Chewy demand",
    weight: 45,
    description: "Synthetic customer scale, penetration, and growth signals.",
  },
  {
    dimensionId: "market_capacity",
    label: "Market capacity",
    weight: 25,
    description: "Synthetic household scale and income context.",
  },
  {
    dimensionId: "veterinary_opportunity",
    label: "Veterinary opportunity",
    weight: 20,
    description:
      "Prototype supply, workforce, and ownership assumptions that require business review.",
  },
  {
    dimensionId: "chewy_clinic_engagement",
    label: "Chewy clinic engagement",
    weight: 10,
    description: "Synthetic Practice Hub and clinic-order engagement signals.",
  },
];

export const MARKET_METRICS: readonly MarketMetricDefinition[] = [
  {
    metricId: "active_customers_per_1000_households",
    label: "Active customers per 1,000 households",
    description: "Synthetic size-adjusted Chewy customer penetration.",
    dimensionId: "chewy_demand",
    direction: "higher-is-better",
    transform: "identity",
    unit: "customers_per_1000_households",
    weight: 25,
  },
  {
    metricId: "active_customer_count",
    label: "Active customer count",
    description: "Synthetic active Chewy customer scale.",
    dimensionId: "chewy_demand",
    direction: "higher-is-better",
    transform: "log1p",
    unit: "count",
    weight: 12,
  },
  {
    metricId: "active_customer_yoy_growth",
    label: "Year-over-year active-customer growth",
    description: "Rank-preserving synthetic customer-growth scenario.",
    dimensionId: "chewy_demand",
    direction: "higher-is-better",
    transform: "identity",
    unit: "percent",
    weight: 8,
    prototypeAssumption:
      "The observed ordering is recentered into a synthetic growth scenario.",
  },
  {
    metricId: "total_households",
    label: "Total households",
    description: "Synthetic or retained household scale.",
    dimensionId: "market_capacity",
    direction: "higher-is-better",
    transform: "log1p",
    unit: "count",
    weight: 15,
  },
  {
    metricId: "avg_zip_median_household_income",
    label: "Average ZIP median household income",
    description:
      "Average of represented ZIP median household incomes, not a CBSA median.",
    dimensionId: "market_capacity",
    direction: "higher-is-better",
    transform: "identity",
    unit: "usd",
    weight: 10,
    prototypeAssumption:
      "This average-of-ZIP-medians measure is used only for the synthetic demonstration.",
  },
  {
    metricId: "clinics_per_10000_households",
    label: "Clinics per 10,000 households",
    description: "Synthetic veterinary clinic supply intensity.",
    dimensionId: "veterinary_opportunity",
    direction: "lower-is-better",
    transform: "identity",
    unit: "clinics_per_10000_households",
    weight: 10,
    prototypeAssumption:
      "Lower clinic density is provisionally treated as whitespace, although it may also reflect weak support.",
  },
  {
    metricId: "veterinarians_per_10000_households",
    label: "Veterinarians per 10,000 households",
    description: "Synthetic veterinarian supply intensity.",
    dimensionId: "veterinary_opportunity",
    direction: "higher-is-better",
    transform: "identity",
    unit: "veterinarians_per_10000_households",
    weight: 5,
    prototypeAssumption:
      "Higher veterinarian density is provisionally treated as workforce availability.",
  },
  {
    metricId: "corporate_clinic_share",
    label: "Corporate clinic share",
    description: "Synthetic share of clinics classified as corporate.",
    dimensionId: "veterinary_opportunity",
    direction: "lower-is-better",
    transform: "identity",
    unit: "percent",
    weight: 5,
    prototypeAssumption:
      "Lower corporate share is provisionally treated as lower corporate competitive pressure.",
  },
  {
    metricId: "practice_hub_clinic_share",
    label: "Practice Hub clinic share",
    description: "Synthetic share of clinics represented in Practice Hub.",
    dimensionId: "chewy_clinic_engagement",
    direction: "higher-is-better",
    transform: "identity",
    unit: "percent",
    weight: 5,
    prototypeAssumption:
      "Higher Practice Hub share is provisionally treated as engagement rather than saturation.",
  },
  {
    metricId: "clinic_orders_per_clinic",
    label: "Clinic orders per clinic",
    description: "Synthetic clinic-order volume divided by clinic count.",
    dimensionId: "chewy_clinic_engagement",
    direction: "higher-is-better",
    transform: "log1p",
    unit: "orders_per_clinic",
    weight: 5,
    prototypeAssumption:
      "The order window and eligible clinic population are synthetic prototype assumptions.",
  },
];

export const MARKET_ATTRACTIVENESS_CONFIGURATION: MarketAttractivenessConfiguration = {
  configurationVersion: MARKET_ATTRACTIVENESS_CONFIGURATION_VERSION,
  calculationVersion: MARKET_ATTRACTIVENESS_CALCULATION_VERSION,
  normalizationVersion: MARKET_ATTRACTIVENESS_NORMALIZATION_VERSION,
  status: "synthetic",
  label: "Synthetic and unapproved market-attractiveness screening",
  expectedWeightTotal: 100,
  winsorLowerPercentile: 0.02,
  winsorUpperPercentile: 0.98,
  sensitivityStep: 5,
  metrics: [...MARKET_METRICS],
  dimensions: [...MARKET_DIMENSIONS],
  notes: [
    "This configuration supports screening demonstrations only.",
    "Metropolitan and micropolitan markets are normalized and ranked separately.",
    "Veterinary-opportunity directions are visible prototype assumptions.",
    "A higher score is not a site, lease, or opening recommendation.",
  ],
};
