import {
  ESRI_DEMO_TRANSFORMATION_VERSION,
  type EsriDemoManifest,
  type EsriSiteIdentity,
  type EsriSiteTradeAreaLink,
  type EsriTradeAreaMetric,
  type EsriTradeAreaRecord,
  type RelationshipReviewState,
  type SiteTradeAreaProfile,
  type TradeAreaContextObservation,
  type TradeAreaProfileSection,
  type TradeAreaProfileVariant,
} from "./types.ts";

const SECTION_BY_METRIC: Record<string, TradeAreaProfileSection> = {
  population: "market_household",
  population_growth: "market_household",
  households: "market_household",
  households_with_pets: "market_household",
  households_with_pets_index: "market_household",
  average_income: "market_household",
  median_income: "market_household",
  percent_income_over_75k: "market_household",
  percent_income_over_100k: "market_household",
  square_miles: "market_household",
  chewy_online_customers: "chewy_demand",
  chewy_online_autoship_customers: "chewy_demand",
  chewy_healthcare_sales: "chewy_demand",
  cvc_customer_percent: "chewy_demand",
  veterinary_clinic_count: "veterinary_supply",
  pet_households_per_clinic: "veterinary_supply",
};

const PERCENT_METRICS = new Set([
  "population_growth",
  "percent_income_over_75k",
  "percent_income_over_100k",
  "cvc_customer_percent",
]);

function relationshipState(
  link: EsriSiteTradeAreaLink,
): RelationshipReviewState {
  if (link.link_state === "synthetic_fallback") return "synthetic";
  if (link.link_state === "needs_review") return "review_required";
  if (link.link_state === "unassigned") return "unassigned";
  return "provisional";
}

function observationWarnings(metric: EsriTradeAreaMetric) {
  const warnings: string[] = [];
  if (metric.unit === null) warnings.push("Unit unknown");
  if (metric.observed_at === null) warnings.push("Observation date unknown");
  if (metric.geography_method === null) {
    warnings.push("Trade-area method unknown");
  }
  if (metric.raw_value === null) warnings.push("Value unavailable");
  if (
    metric.raw_value !== null &&
    PERCENT_METRICS.has(metric.metric_id) &&
    (metric.raw_value < -100 || metric.raw_value > 100)
  ) {
    warnings.push("Percentage is outside the accepted -100% to 100% range");
  }
  if (metric.metric_id === "pet_households_per_clinic") {
    warnings.push("Source formula is unconfirmed and was not recalculated");
  }
  return warnings;
}

function contextObservation(input: {
  site: EsriSiteIdentity;
  record: EsriTradeAreaRecord;
  link: EsriSiteTradeAreaLink;
  metric: EsriTradeAreaMetric;
  manifest: EsriDemoManifest;
}): TradeAreaContextObservation {
  const { site, record, link, metric, manifest } = input;
  if (metric.raw_value !== null && !Number.isFinite(metric.raw_value)) {
    throw new Error(
      `Trade-area metric ${metric.metric_id} for ${record.trade_area_id} is non-finite.`,
    );
  }
  const section = SECTION_BY_METRIC[metric.metric_id];
  if (!section) {
    throw new Error(
      `Trade-area metric ${metric.metric_id} is not approved for the profile contract.`,
    );
  }
  const warnings = observationWarnings(metric);
  const invalidPercentage = warnings.some((warning) =>
    warning.startsWith("Percentage is outside"),
  );
  return {
    site_id: site.site_id,
    trade_area_id: record.trade_area_id,
    trade_area_role: record.role,
    relationship_review_state: relationshipState(link),
    section,
    source_field: metric.source_field,
    metric_id: metric.metric_id,
    display_label: metric.label,
    raw_value: metric.raw_value,
    unit: metric.unit,
    source_id: metric.source_id,
    source_snapshot_id: manifest.snapshot_id,
    observed_at: metric.observed_at,
    received_at: metric.received_at,
    geography: "trade_area",
    geography_method: metric.geography_method,
    evidence_status: metric.evidence_status,
    quality_status:
      invalidPercentage || metric.quality_status === "rejected"
        ? "rejected"
        : warnings.length
          ? "warning"
          : "accepted",
    sensitivity: "internal",
    allowed_use: "internal_demo_evidence_only",
    transformation_version: ESRI_DEMO_TRANSFORMATION_VERSION,
    scoring_eligibility: "none",
    is_synthetic: record.is_synthetic,
    limitations: [...metric.limitations],
    warnings,
  };
}

function variantWarnings(
  record: EsriTradeAreaRecord,
  link: EsriSiteTradeAreaLink,
) {
  const warnings = new Set<string>();
  if (record.role === "unknown") warnings.add("Trade-area role unknown");
  if (!record.is_synthetic) {
    warnings.add("Trade-area method unknown");
    warnings.add("Observation date unknown");
  }
  if (link.link_state === "needs_review") {
    warnings.add(
      "Multiple source trade-area records share this site relationship; no primary variant was selected",
    );
  }
  if (link.link_state === "synthetic_fallback") {
    warnings.add(
      "Synthetic demonstration trade area; no source-provided relationship exists",
    );
  }
  return [...warnings];
}

export function buildTradeAreaProfiles(input: {
  sites: readonly EsriSiteIdentity[];
  links: readonly EsriSiteTradeAreaLink[];
  tradeAreas: readonly EsriTradeAreaRecord[];
  manifest: EsriDemoManifest;
}): SiteTradeAreaProfile[] {
  const { sites, links, tradeAreas, manifest } = input;
  if (manifest.scoring_eligibility !== "none") {
    throw new Error("Esri profile fixture must have no scoring eligibility.");
  }
  if (new Set(sites.map((site) => site.site_id)).size !== sites.length) {
    throw new Error("Esri profile fixture contains duplicate site IDs.");
  }
  if (
    new Set(tradeAreas.map((record) => record.trade_area_id)).size !==
    tradeAreas.length
  ) {
    throw new Error("Esri profile fixture contains duplicate trade-area IDs.");
  }
  const sitesById = new Map(sites.map((site) => [site.site_id, site]));
  const tradeAreasById = new Map(
    tradeAreas.map((record) => [record.trade_area_id, record]),
  );
  for (const link of links) {
    if (!sitesById.has(link.site_id)) {
      throw new Error(`Crosswalk references missing site ${link.site_id}.`);
    }
    if (!tradeAreasById.has(link.trade_area_id)) {
      throw new Error(
        `Crosswalk references missing trade area ${link.trade_area_id}.`,
      );
    }
  }
  return sites
    .map((site): SiteTradeAreaProfile => {
      const variants = links
        .filter((link) => link.site_id === site.site_id)
        .map((link): TradeAreaProfileVariant => {
          const record = tradeAreasById.get(link.trade_area_id)!;
          return {
            trade_area_id: record.trade_area_id,
            source_site_name: record.source_site_name,
            trade_area_role: record.role,
            link_state: link.link_state,
            relationship_review_state: relationshipState(link),
            evidence_status: record.evidence_status,
            is_synthetic: record.is_synthetic,
            observations: record.metrics
              .map((metric) =>
                contextObservation({ site, record, link, metric, manifest }),
              )
              .sort((left, right) =>
                left.metric_id.localeCompare(right.metric_id),
              ),
            warnings: variantWarnings(record, link),
          };
        })
        .sort((left, right) =>
          left.trade_area_id.localeCompare(right.trade_area_id),
        );
      return {
        site_id: site.site_id,
        site_name: site.site_name,
        brand: site.brand,
        cbsa_id: site.cbsa_id,
        market_name: site.market_name,
        state: site.state,
        latitude: site.latitude,
        longitude: site.longitude,
        variants,
        unavailable_evidence: [
          {
            field_group: "Age distribution",
            reason:
              "Age-band definitions, observation dates, and validation rules are not approved for display.",
            expected_source_or_owner: "GIS / data steward",
          },
          {
            field_group: "Income distribution",
            reason:
              "Income-band definitions and denominator are not approved for display.",
            expected_source_or_owner: "GIS / data steward",
          },
          {
            field_group: "Risk and labor context",
            reason:
              "Crime, environmental, and labor rank direction and definitions are unknown.",
            expected_source_or_owner: "Real Estate analytics",
          },
        ],
        source_snapshot_id: manifest.snapshot_id,
        sensitivity: "internal",
        allowed_use: "internal_demo_evidence_only",
        scoring_eligibility: "none",
      };
    })
    .sort(
      (left, right) =>
        left.site_name.localeCompare(right.site_name) ||
        left.site_id.localeCompare(right.site_id),
    );
}

export function validateDistributionBands(input: {
  values: Array<number | null>;
  expectedTotal?: number;
  tolerance?: number;
}) {
  const expectedTotal = input.expectedTotal ?? 100;
  const tolerance = input.tolerance ?? 1;
  if (input.values.some((value) => value === null)) {
    return { state: "incomplete" as const, total: null };
  }
  if (input.values.some((value) => !Number.isFinite(value))) {
    return { state: "rejected" as const, total: null };
  }
  const total = (input.values as number[]).reduce(
    (sum, value) => sum + value,
    0,
  );
  return {
    state:
      Math.abs(total - expectedTotal) <= tolerance
        ? ("accepted" as const)
        : ("warning" as const),
    total,
  };
}

export function comparisonWarnings(
  variants: readonly TradeAreaProfileVariant[],
) {
  const warnings = new Set<string>();
  if (variants.length > 1) {
    if (
      variants.some((variant) =>
        variant.observations.some(
          (observation) => observation.observed_at === null,
        ),
      )
    ) {
      warnings.add(
        "Observation dates are unknown, so temporal comparability is unconfirmed.",
      );
    }
    const methods = new Set(
      variants.flatMap((variant) =>
        variant.observations.map(
          (observation) => observation.geography_method ?? "unknown",
        ),
      ),
    );
    if (methods.size > 1 || methods.has("unknown")) {
      warnings.add(
        "Trade-area methods differ or are unknown, so geographic comparability is unconfirmed.",
      );
    }
    if (new Set(variants.map((variant) => variant.is_synthetic)).size > 1) {
      warnings.add("The comparison mixes supplied and synthetic evidence.");
    }
  }
  return [...warnings];
}
