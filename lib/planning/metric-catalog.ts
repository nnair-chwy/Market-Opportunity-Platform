import type { PlanningIntent } from "./contracts.ts";

export type RequestedMetric = PlanningIntent["requestedMetrics"][number];
export type EvidenceSourceFamily = "census" | "regional" | "clinic" | "google_ads";

export type MetricDefinition = {
  label: string;
  sourceFamily: EvidenceSourceFamily;
  fields: readonly string[];
  unit: string;
  preferredEvidenceTypes: readonly string[];
};

export const METRIC_CATALOG: Partial<Record<RequestedMetric, MetricDefinition>> = {
  total_population: { label: "Population", sourceFamily: "census", fields: ["totalPopulation", "populationEstimate"], unit: "people", preferredEvidenceTypes: ["census_market_context", "cbsa_population"] },
  household_count: { label: "Households", sourceFamily: "census", fields: ["householdCount", "totalHouseholds", "estimatedHouseholds"], unit: "households", preferredEvidenceTypes: ["census_market_context", "market_context", "zip_context"] },
  median_household_income: { label: "Median household income", sourceFamily: "census", fields: ["medianHouseholdIncome", "householdWeightedMedianIncomeProxy"], unit: "currency_units", preferredEvidenceTypes: ["census_market_context", "zip_context"] },
  housing_unit_count: { label: "Housing units", sourceFamily: "census", fields: ["housingUnits"], unit: "housing_units", preferredEvidenceTypes: ["census_market_context"] },
  population_density: { label: "Population density", sourceFamily: "census", fields: ["populationDensity"], unit: "people_per_square_mile", preferredEvidenceTypes: ["census_market_context"] },
  active_customer_count: { label: "Active customers", sourceFamily: "regional", fields: ["activeCustomerCount"], unit: "customers", preferredEvidenceTypes: ["market_context"] },
  prior_year_active_customer_count: { label: "Prior-year active customers", sourceFamily: "regional", fields: ["priorYearActiveCustomerCount"], unit: "customers", preferredEvidenceTypes: ["market_context"] },
  active_customer_yoy_growth: { label: "Active-customer year-over-year growth", sourceFamily: "regional", fields: ["activeCustomerYoyGrowth"], unit: "ratio", preferredEvidenceTypes: ["market_context"] },
  active_customers_per_1000_households: { label: "Active customers per 1,000 households", sourceFamily: "regional", fields: ["activeCustomersPer1000Households"], unit: "customers_per_1000_households", preferredEvidenceTypes: ["market_context"] },
  regional_net_sales: { label: "Regional net sales excluding refunds", sourceFamily: "regional", fields: ["netSalesExcludingRefunds"], unit: "currency_units", preferredEvidenceTypes: ["regional_demand"] },
  clinic_count: { label: "Clinic count", sourceFamily: "clinic", fields: ["clinicCount"], unit: "clinics", preferredEvidenceTypes: ["clinic_activity", "clinic_profile"] },
  total_customers: { label: "Clinic customers", sourceFamily: "clinic", fields: ["totalCustomers"], unit: "customers", preferredEvidenceTypes: ["clinic_activity"] },
  total_orders: { label: "Clinic orders", sourceFamily: "clinic", fields: ["totalOrders"], unit: "orders", preferredEvidenceTypes: ["clinic_activity", "clinic_profile"] },
  rx_orders: { label: "Clinic Rx orders", sourceFamily: "clinic", fields: ["rxOrders"], unit: "rx_orders", preferredEvidenceTypes: ["clinic_activity"] },
  net_sales: { label: "Clinic net sales", sourceFamily: "clinic", fields: ["netSales"], unit: "currency_units", preferredEvidenceTypes: ["clinic_activity"] },
  rx_net_sales: { label: "Clinic Rx net sales", sourceFamily: "clinic", fields: ["rxNetSales"], unit: "currency_units", preferredEvidenceTypes: ["clinic_activity"] },
  google_ads_spend: { label: "Google Ads spend", sourceFamily: "google_ads", fields: ["spend"], unit: "currency_units", preferredEvidenceTypes: ["google_ads_context"] },
  google_ads_impressions: { label: "Google Ads impressions", sourceFamily: "google_ads", fields: ["impressions"], unit: "impressions", preferredEvidenceTypes: ["google_ads_context"] },
  google_ads_clicks: { label: "Google Ads clicks", sourceFamily: "google_ads", fields: ["clicks"], unit: "clicks", preferredEvidenceTypes: ["google_ads_context"] },
  google_ads_conversions: { label: "Google Ads conversions", sourceFamily: "google_ads", fields: ["conversions"], unit: "conversions", preferredEvidenceTypes: ["google_ads_context"] },
};

export function metricsForSourceFamilies(sourceFamilies: readonly EvidenceSourceFamily[]): RequestedMetric[] {
  const included = new Set(sourceFamilies);
  return (Object.entries(METRIC_CATALOG) as Array<[RequestedMetric, MetricDefinition]>)
    .filter(([, definition]) => included.has(definition.sourceFamily))
    .map(([metric]) => metric);
}
