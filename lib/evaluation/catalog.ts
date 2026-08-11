import type { EvidenceStatus } from "./contracts.ts";

export type CatalogEntry = {
  sourceId: string;
  name: string;
  entityGrain: string;
  geographicGrain: string;
  fields: string[];
  joinKeys: string[];
  temporalCoverage: string;
  freshness: string;
  snapshotVersion: string;
  evidenceStatus: EvidenceStatus;
  sensitivity: "public" | "internal";
  allowedUse: string;
  permittedOperators: string[];
  limitations: string[];
};

export const EVALUATION_DATA_CATALOG: readonly CatalogEntry[] = [
  {
    sourceId: "SRC-014", name: "Public CBSA universe", entityGrain: "CBSA", geographicGrain: "CBSA statistical area",
    fields: ["cbsa_code", "cbsa_name", "cbsa_type", "principal_cities", "component_counties"], joinKeys: ["cbsa_code"],
    temporalCoverage: "July 2023 delineation", freshness: "Versioned static reference", snapshotVersion: "cbsa-universe-2023-07",
    evidenceStatus: "Confirmed", sensitivity: "public", allowedUse: "market_context_only",
    permittedOperators: ["filter", "join", "select_parent_geography"], limitations: ["Not a trade area or scoring input."],
  },
  {
    sourceId: "SRC-015", name: "Public CBSA geometry", entityGrain: "CBSA", geographicGrain: "2024 cartographic boundary",
    fields: ["cbsa_code", "geometry", "aland", "awater"], joinKeys: ["cbsa_code"], temporalCoverage: "2024 boundary vintage",
    freshness: "Versioned static reference", snapshotVersion: "cbsa-geometry-2024", evidenceStatus: "Confirmed", sensitivity: "public",
    allowedUse: "market_context_only", permittedOperators: ["join", "clip_partition", "render_map"],
    limitations: ["Simplified display geometry is not authoritative land-area evidence."],
  },
  {
    sourceId: "SRC-016", name: "ACS CBSA context", entityGrain: "CBSA", geographicGrain: "CBSA",
    fields: ["total_population", "household_count", "median_household_income", "housing_unit_count", "population_density"], joinKeys: ["cbsa_code"],
    temporalCoverage: "2020–2024 ACS 5-year estimate", freshness: "Observed 2024-12-31", snapshotVersion: "cbsa-acs-2024",
    evidenceStatus: "Confirmed", sensitivity: "public", allowedUse: "market_context_only", permittedOperators: ["filter", "compare", "render_context"],
    limitations: ["Period estimates; no growth calculation without a boundary-compatibility rule."],
  },
  {
    sourceId: "SYN-MARKET-ATTRACTIVENESS-001", name: "Synthetic market attractiveness", entityGrain: "CBSA-like prototype market",
    geographicGrain: "CBSA when exact-linked", fields: ["metric_values", "score", "rank", "contributions", "sensitivity"], joinKeys: ["cbsa_code"],
    temporalCoverage: "Synthetic reporting snapshot", freshness: "Fixture version", snapshotVersion: "market-attractiveness-v1",
    evidenceStatus: "Hypothesis", sensitivity: "internal", allowedUse: "synthetic_prototype_only",
    permittedOperators: ["normalize", "weight", "rank", "sensitivity"], limitations: ["Synthetic values and unapproved criteria."],
  },
  {
    sourceId: "SYN-SEATTLE-SUBMARKET-001", name: "Seattle synthetic area evidence", entityGrain: "Synthetic analysis zone",
    geographicGrain: "Mutually exclusive zone clipped to CBSA 42660", fields: ["submarket_id", "metrics", "limitations", "hub"], joinKeys: ["submarket_id", "parent_cbsa_code"],
    temporalCoverage: "2026-08-03 fixture", freshness: "Fixture version", snapshotVersion: "seattle-market-deep-dive-2026-08-03-v2",
    evidenceStatus: "Hypothesis", sensitivity: "internal", allowedUse: "synthetic_prototype_only",
    permittedOperators: ["clip_partition", "normalize", "weight", "rank", "sensitivity", "disposition"],
    limitations: ["Illustrative analysis zones are not neighborhoods, trade areas, or real-estate submarkets."],
  },
  {
    sourceId: "SRC-017", name: "Minimized Esri demo snapshot", entityGrain: "Site and supplied trade-area record", geographicGrain: "Reported source relationship",
    fields: ["site_identity", "trade_area_context", "physical_site_evidence", "readiness"], joinKeys: ["site_id", "esri_id"],
    temporalCoverage: "Received 2026-07-30", freshness: "Observation dates incomplete", snapshotVersion: "esri-demo-2026-07-30",
    evidenceStatus: "Reported", sensitivity: "internal", allowedUse: "internal_demo_evidence_only", permittedOperators: ["validate", "render_evidence"],
    limitations: ["No scoring eligibility; trade-area method and observation dates are unresolved."],
  },
  {
    sourceId: "SRC-002", name: "Aggregate CVC performance CSV adapter", entityGrain: "Clinic-period aggregate", geographicGrain: "Clinic",
    fields: ["business_id", "opening_date", "weeks_since_opening", "completed_appointments", "unique_customers", "net_sales"], joinKeys: ["business_id"],
    temporalCoverage: "Comparable 12-week synthetic windows", freshness: "Extracted 2026-07-25", snapshotVersion: "cvc-performance-aggregate-fixture-v1",
    evidenceStatus: "Hypothesis", sensitivity: "internal", allowedUse: "synthetic_prototype_only",
    permittedOperators: ["eligibility", "filter_time", "aggregate", "select_peers", "compare", "validate", "disposition"],
    limitations: ["Aggregate synthetic fixture; outcome, maturity, cohort, and materiality definitions are unapproved."],
  },
  {
    sourceId: "SYN-DEMAND-COVERAGE-TEST-001", name: "Demand-to-coverage adaptability fixture", entityGrain: "Synthetic market", geographicGrain: "Prepared test geography",
    fields: ["demand", "coverage", "gap"], joinKeys: ["entityId"], temporalCoverage: "Fixed automated-test fixture", freshness: "Fixture version",
    snapshotVersion: "demand-coverage-test-v1", evidenceStatus: "Hypothesis", sensitivity: "internal", allowedUse: "automated_test_only",
    permittedOperators: ["derive_metric", "rank"], limitations: ["Not rendered as a polished demonstration and not valid for business decisions."],
  },
] as const;

export function matchCatalog(sourceIds: readonly string[], requiredFields: readonly string[]) {
  const entries = sourceIds.map((id) => EVALUATION_DATA_CATALOG.find((entry) => entry.sourceId === id)).filter((entry): entry is CatalogEntry => Boolean(entry));
  const availableFields = new Set(entries.flatMap((entry) => entry.fields));
  return { entries, missingSourceIds: sourceIds.filter((id) => !entries.some((entry) => entry.sourceId === id)), missingFields: requiredFields.filter((field) => !availableFields.has(field)) };
}
