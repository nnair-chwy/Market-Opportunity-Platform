import {
  PERSPECTIVE_CATALOG_VERSION,
  perspectiveCatalogSchema,
  type PerspectiveCatalog,
  type PerspectiveDefinition,
  type PerspectiveId,
  type PerspectiveMeasureId,
  type PerspectiveView,
  type PerspectiveViewId,
} from "./contracts.ts";

function unavailableLegend(title: string) {
  return {
    title,
    lowLabel: "Unavailable",
    midLabel: "—",
    highLabel: "Unavailable",
    unscoredLabel: "Evidence needed",
    showGradient: false,
  };
}

function censusLegend(title: string) {
  return {
    title,
    lowLabel: "Lower 0",
    midLabel: "50",
    highLabel: "Higher 100",
    unscoredLabel: "Not scored",
    showGradient: true,
  };
}

function workspaceSnapshotView(input: {
  perspectiveId: "pricing" | "marketing";
  viewId: PerspectiveViewId;
  label: string;
  activeMeasure: PerspectiveMeasureId;
  datasetId:
    | "pricing_competitor_availability"
    | "pricing_observed_equalized_price"
    | "pricing_offer_observation_volume"
    | "pricing_assortment_breadth"
    | "marketing_paid_search_response"
    | "marketing_paid_search_impressions"
    | "marketing_paid_search_ctr"
    | "marketing_paid_search_cpc";
  valueFormat: "number" | "percent" | "currency";
  sourceIds: string[];
  mapTitle: string;
  sourceLabel: string;
  evidenceBoundary: string;
  legendTitle: string;
}): PerspectiveView {
  return {
    perspectiveId: input.perspectiveId,
    viewId: input.viewId,
    label: input.label,
    activeMeasure: input.activeMeasure,
    geographyGrain: "cbsa",
    sourceIds: input.sourceIds,
    evidenceStatus: "Derived",
    evidenceAvailability: "available",
    allowedUse: "internal_demo_evidence_only",
    scoringEligibility: "none",
    mapTitle: input.mapTitle,
    sourceLabel: input.sourceLabel,
    evidenceBoundary: input.evidenceBoundary,
    legend: censusLegend(input.legendTitle),
    emptyState: {
      title: `${input.label} snapshot unavailable`,
      message: "Build the approved local perspective-map snapshot before opening this view. Missing regions remain unscored.",
    },
    supportedQuestionTypes: ["describe", "compare", "investigate"],
    supportsComparison: true,
    supportsLayerMode: false,
    mapBinding: {
      kind: "workspace_snapshot",
      datasetId: input.datasetId,
      valueFormat: input.valueFormat,
    },
  };
}

function unavailableView(input: {
  perspectiveId: PerspectiveId;
  viewId: PerspectiveViewId;
  label: string;
  activeMeasure: PerspectiveMeasureId;
  sourceIds: string[];
  mapTitle: string;
  sourceLabel: string;
  evidenceBoundary: string;
  emptyTitle: string;
  emptyMessage: string;
  supportsComparison?: boolean;
  supportsLayerMode?: boolean;
}): PerspectiveView {
  return {
    perspectiveId: input.perspectiveId,
    viewId: input.viewId,
    label: input.label,
    activeMeasure: input.activeMeasure,
    geographyGrain: "cbsa",
    sourceIds: input.sourceIds,
    evidenceStatus: "Unknown",
    evidenceAvailability: "evidence_needed",
    allowedUse: "decision_support_draft",
    scoringEligibility: "none",
    mapTitle: input.mapTitle,
    sourceLabel: input.sourceLabel,
    evidenceBoundary: input.evidenceBoundary,
    legend: unavailableLegend(input.label),
    emptyState: {
      title: input.emptyTitle,
      message: input.emptyMessage,
    },
    supportedQuestionTypes: ["describe", "investigate"],
    supportsComparison: input.supportsComparison ?? false,
    supportsLayerMode: input.supportsLayerMode ?? false,
    mapBinding: { kind: "unavailable" },
  };
}

const pricingViews: PerspectiveView[] = [
  workspaceSnapshotView({
    perspectiveId: "pricing",
    viewId: "competitor_availability",
    label: "Competitor availability",
    activeMeasure: "pricing.competitor_availability",
    datasetId: "pricing_competitor_availability",
    valueFormat: "percent",
    sourceIds: ["SRC-025", "SRC-028", "SRC-030"],
    mapTitle: "Observed competitor availability",
    sourceLabel: "SRC-004 monitored competitor offers · 30-day snapshot",
    evidenceBoundary: "Derived from monitored competitor offers assigned from ZIP/ZCTA centroids to CBSAs. Coverage is not comprehensive, does not measure demand, and cannot authorize a price change.",
    legendTitle: "Availability percentile",
  }),
  workspaceSnapshotView({
    perspectiveId: "pricing",
    viewId: "observed_equalized_price",
    label: "Observed offer price",
    activeMeasure: "pricing.observed_equalized_price",
    datasetId: "pricing_observed_equalized_price",
    valueFormat: "currency",
    sourceIds: ["SRC-025", "SRC-028"],
    mapTitle: "Observed equalized offer price",
    sourceLabel: "SRC-025/SRC-028 monitored competitor offers · 30-day snapshot",
    evidenceBoundary: "Offer-row-weighted equalized price reflects the monitored product and category mix. It is not a matched-basket price index, price gap, elasticity estimate, or price recommendation.",
    legendTitle: "Observed price percentile",
  }),
  workspaceSnapshotView({
    perspectiveId: "pricing",
    viewId: "offer_observation_volume",
    label: "Offer observations",
    activeMeasure: "pricing.offer_observation_volume",
    datasetId: "pricing_offer_observation_volume",
    valueFormat: "number",
    sourceIds: ["SRC-025", "SRC-028"],
    mapTitle: "Monitored competitor offer volume",
    sourceLabel: "SRC-025/SRC-028 monitored offer rows · 30-day snapshot",
    evidenceBoundary: "Offer-row volume describes monitoring depth and data coverage. It is not competitor market share, assortment quality, customer demand, price response, or an opportunity score.",
    legendTitle: "Offer-volume percentile",
  }),
  workspaceSnapshotView({
    perspectiveId: "pricing",
    viewId: "assortment_breadth",
    label: "Observed assortment",
    activeMeasure: "pricing.assortment_breadth",
    datasetId: "pricing_assortment_breadth",
    valueFormat: "number",
    sourceIds: ["SRC-025", "SRC-028"],
    mapTitle: "Observed competitor assortment breadth",
    sourceLabel: "SRC-025/SRC-028 distinct monitored SKU counts · 30-day snapshot",
    evidenceBoundary: "Distinct-SKU counts are summed across monitored ZIP, competitor, and category rows and may repeat a SKU across geographies. They measure observed monitoring breadth, not complete local assortment or customer choice.",
    legendTitle: "Assortment breadth percentile",
  }),
  unavailableView({
    perspectiveId: "pricing",
    viewId: "price_index",
    label: "Price index",
    activeMeasure: "pricing.price_index",
    sourceIds: ["SRC-004"],
    mapTitle: "Price index by region",
    sourceLabel: "Approved regional price index not connected",
    evidenceBoundary: "Price index remains evidence-needed. No pricing score or recommendation is calculated.",
    emptyTitle: "Price index unavailable",
    emptyMessage: "An approved regional price-index source, owner, and freshness rule are required before this view can render values.",
    supportsComparison: true,
  }),
  unavailableView({
    perspectiveId: "pricing",
    viewId: "competitive_price_gaps",
    label: "Competitive price gaps",
    activeMeasure: "pricing.competitive_price_gaps",
    sourceIds: ["SRC-004"],
    mapTitle: "Competitive price gaps by region",
    sourceLabel: "Competitive price evidence not connected",
    evidenceBoundary: "Competitive price gaps are not approved for map calculation. Public Census context cannot fill this view.",
    emptyTitle: "Competitive price gaps unavailable",
    emptyMessage: "Competitive assortment and price-observation definitions are unresolved, so this view stays empty.",
  }),
  unavailableView({
    perspectiveId: "pricing",
    viewId: "promotion_intensity",
    label: "Promotion intensity",
    activeMeasure: "pricing.promotion_intensity",
    sourceIds: ["SRC-004"],
    mapTitle: "Promotion intensity by region",
    sourceLabel: "Promotion intensity evidence not connected",
    evidenceBoundary: "Promotion intensity is perspective-specific and is not inferred from marketing or CVC measures.",
    emptyTitle: "Promotion intensity unavailable",
    emptyMessage: "Approved promotion definitions, channel scope, and aggregation rules are required before values can appear.",
  }),
  unavailableView({
    perspectiveId: "pricing",
    viewId: "price_elasticity_context",
    label: "Price elasticity context",
    activeMeasure: "pricing.price_elasticity_context",
    sourceIds: ["SRC-004"],
    mapTitle: "Price elasticity context by region",
    sourceLabel: "Elasticity context not connected",
    evidenceBoundary: "Elasticity context cannot be invented. This view does not create a universal opportunity score.",
    emptyTitle: "Price elasticity context unavailable",
    emptyMessage: "Elasticity models and approved regional inputs are not connected to this workspace.",
  }),
  unavailableView({
    perspectiveId: "pricing",
    viewId: "margin_contribution_context",
    label: "Margin or contribution context",
    activeMeasure: "pricing.margin_contribution_context",
    sourceIds: ["SRC-002"],
    mapTitle: "Margin or contribution context by region",
    sourceLabel: "Margin contribution evidence not connected",
    evidenceBoundary: "Margin or contribution context stays non-scored and unavailable until an approved finance measure is connected.",
    emptyTitle: "Margin context unavailable",
    emptyMessage: "Contribution and margin definitions remain outside the approved opening-page evidence set.",
  }),
  unavailableView({
    perspectiveId: "pricing",
    viewId: "price_opportunity_by_region",
    label: "Price opportunity by region",
    activeMeasure: "pricing.price_opportunity_by_region",
    sourceIds: ["SRC-004"],
    mapTitle: "Price opportunity by region",
    sourceLabel: "Price opportunity evidence not connected",
    evidenceBoundary: "Price opportunity is not a universal score and cannot borrow Marketing or CVC measures.",
    emptyTitle: "Price opportunity unavailable",
    emptyMessage: "No approved price-opportunity formula or source is available for regional rendering.",
    supportsComparison: true,
  }),
].filter((view) => view.evidenceAvailability === "available");

const marketingViews: PerspectiveView[] = [
  workspaceSnapshotView({
    perspectiveId: "marketing",
    viewId: "paid_search_response",
    label: "Paid search response",
    activeMeasure: "marketing.paid_search_response",
    datasetId: "marketing_paid_search_response",
    valueFormat: "number",
    sourceIds: ["SRC-018"],
    mapTitle: "Paid search response by region",
    sourceLabel: "SRC-018 retail matched-postal clicks · 30-day snapshot",
    evidenceBoundary: "Ad-mediated clicks are campaign-conditioned and assigned from ZIP/ZCTA centroids to CBSAs. They are not total demand, unique reach, incrementality, or a budget recommendation.",
    legendTitle: "Paid search response percentile",
  }),
  workspaceSnapshotView({
    perspectiveId: "marketing",
    viewId: "paid_search_impressions",
    label: "Search impressions",
    activeMeasure: "marketing.paid_search_impressions",
    datasetId: "marketing_paid_search_impressions",
    valueFormat: "number",
    sourceIds: ["SRC-018"],
    mapTitle: "Paid search impressions by region",
    sourceLabel: "SRC-018 retail matched-postal impressions · 30-day snapshot",
    evidenceBoundary: "Impressions are campaign-conditioned delivery, not unique reach, addressable demand, awareness lift, or a budget recommendation.",
    legendTitle: "Impression percentile",
  }),
  workspaceSnapshotView({
    perspectiveId: "marketing",
    viewId: "paid_search_ctr",
    label: "Click-through rate",
    activeMeasure: "marketing.paid_search_ctr",
    datasetId: "marketing_paid_search_ctr",
    valueFormat: "percent",
    sourceIds: ["SRC-018"],
    mapTitle: "Paid search click-through rate by region",
    sourceLabel: "SRC-018 retail matched-postal clicks ÷ impressions · 30-day snapshot",
    evidenceBoundary: "Click-through rate reflects campaign mix, bids, creative, inventory, and platform geography semantics. It is not incrementality, conversion quality, or total customer demand.",
    legendTitle: "Click-through-rate percentile",
  }),
  workspaceSnapshotView({
    perspectiveId: "marketing",
    viewId: "paid_search_cpc",
    label: "Average cost per click",
    activeMeasure: "marketing.paid_search_cpc",
    datasetId: "marketing_paid_search_cpc",
    valueFormat: "currency",
    sourceIds: ["SRC-018"],
    mapTitle: "Paid search cost per click by region",
    sourceLabel: "SRC-018 retail matched-postal cost ÷ clicks · 30-day snapshot",
    evidenceBoundary: "Average cost per click is a platform delivery measure conditioned on campaign setup and auction mix. It does not establish acquisition efficiency, profit, incrementality, or budget authority.",
    legendTitle: "Cost-per-click percentile",
  }),
  unavailableView({
    perspectiveId: "marketing",
    viewId: "customer_demand",
    label: "Customer demand",
    activeMeasure: "marketing.customer_demand",
    sourceIds: ["SRC-020", "SRC-021", "SRC-023"],
    mapTitle: "Customer demand by region",
    sourceLabel: "Customer demand evidence not connected",
    evidenceBoundary: "Customer demand is marketing-specific. Public Census population is market context only and does not enter this measure.",
    emptyTitle: "Customer demand unavailable",
    emptyMessage: "Approved aggregate customer-demand evidence is required before this marketing view can render values.",
    supportsComparison: true,
  }),
  unavailableView({
    perspectiveId: "marketing",
    viewId: "acquisition_efficiency",
    label: "Acquisition efficiency",
    activeMeasure: "marketing.acquisition_efficiency",
    sourceIds: ["SRC-018", "SRC-020", "SRC-021", "SRC-023"],
    mapTitle: "Acquisition efficiency by region",
    sourceLabel: "Acquisition efficiency evidence not connected",
    evidenceBoundary: "Acquisition efficiency stays evidence-needed and never becomes a cross-perspective score.",
    emptyTitle: "Acquisition efficiency unavailable",
    emptyMessage: "Approved acquisition-cost and conversion inputs are not connected for regional comparison.",
  }),
  unavailableView({
    perspectiveId: "marketing",
    viewId: "campaign_reach",
    label: "Campaign reach",
    activeMeasure: "marketing.campaign_reach",
    sourceIds: ["SRC-018", "SRC-020", "SRC-023"],
    mapTitle: "Campaign reach by region",
    sourceLabel: "Campaign reach evidence not connected",
    evidenceBoundary: "Campaign reach cannot be inferred from public Census or CVC clinic context.",
    emptyTitle: "Campaign reach unavailable",
    emptyMessage: "Channel reach, saturation, and exclusion rules remain unresolved for this view.",
  }),
  unavailableView({
    perspectiveId: "marketing",
    viewId: "conversion_booking_rate",
    label: "Conversion or booking rate",
    activeMeasure: "marketing.conversion_booking_rate",
    sourceIds: ["SRC-018", "SRC-021", "SRC-023"],
    mapTitle: "Conversion or booking rate by region",
    sourceLabel: "Conversion or booking evidence not connected",
    evidenceBoundary: "Conversion or booking rate is unavailable and is not substituted with synthetic values.",
    emptyTitle: "Conversion rate unavailable",
    emptyMessage: "An approved conversion or booking definition and aggregate export are required.",
  }),
  unavailableView({
    perspectiveId: "marketing",
    viewId: "local_engagement",
    label: "Local engagement",
    activeMeasure: "marketing.local_engagement",
    sourceIds: ["SRC-007"],
    mapTitle: "Local engagement by region",
    sourceLabel: "Local engagement evidence not connected",
    evidenceBoundary: "Local engagement remains qualitative or unapproved until an aggregate measure is governed.",
    emptyTitle: "Local engagement unavailable",
    emptyMessage: "Approved engagement measures are not connected to the opening-page map.",
  }),
  unavailableView({
    perspectiveId: "marketing",
    viewId: "marketing_opportunity_by_region",
    label: "Marketing opportunity by region",
    activeMeasure: "marketing.marketing_opportunity_by_region",
    sourceIds: ["SRC-018", "SRC-020", "SRC-021", "SRC-023"],
    mapTitle: "Marketing opportunity by region",
    sourceLabel: "Marketing opportunity evidence not connected",
    evidenceBoundary: "No universal opportunity score is created. Marketing opportunity stays perspective-local and evidence-needed.",
    emptyTitle: "Marketing opportunity unavailable",
    emptyMessage: "This view does not invent a marketing opportunity score from Census or CVC measures.",
    supportsComparison: true,
  }),
].filter((view) => view.evidenceAvailability === "available");

const cvcViews: PerspectiveView[] = [
  {
    perspectiveId: "cvc",
    viewId: "clinic_footprint",
    label: "Clinic footprint",
    activeMeasure: "cvc.clinic_footprint",
    geographyGrain: "site",
    sourceIds: ["SRC-009"],
    evidenceStatus: "Confirmed",
    evidenceAvailability: "available",
    allowedUse: "market_context_only",
    scoringEligibility: "none",
    mapTitle: "Current clinic footprint",
    sourceLabel: "SRC-009 public clinic locations",
    evidenceBoundary: "Clinic pins are public location context only. They do not create a clinic score, pricing score, or marketing score.",
    legend: {
      title: "Clinic footprint",
      lowLabel: "No score",
      midLabel: "Locations",
      highLabel: "No score",
      unscoredLabel: "Public clinics",
      showGradient: false,
    },
    emptyState: {
      title: "No clinic locations in view",
      message: "Confirmed public clinic locations will appear when the map cohort includes those markets.",
    },
    supportedQuestionTypes: ["describe", "compare", "investigate"],
    supportsComparison: true,
    supportsLayerMode: true,
    mapBinding: { kind: "clinic_locations" },
  },
  unavailableView({
    perspectiveId: "cvc",
    viewId: "pet_ownership",
    label: "Pet ownership",
    activeMeasure: "cvc.pet_ownership",
    sourceIds: ["SRC-017"],
    mapTitle: "Pet ownership by region",
    sourceLabel: "Approved pet-ownership measure not connected",
    evidenceBoundary: "Pet ownership is evidence-needed. Household Census counts are not a pet-ownership substitute.",
    emptyTitle: "Pet ownership unavailable",
    emptyMessage: "An approved pet-ownership definition, denominator, and source remain unresolved.",
  }),
  {
    perspectiveId: "cvc",
    viewId: "household_demand",
    label: "Household demand",
    activeMeasure: "cvc.household_demand",
    geographyGrain: "cbsa",
    sourceIds: ["SRC-016"],
    evidenceStatus: "Confirmed",
    evidenceAvailability: "available",
    allowedUse: "market_context_only",
    scoringEligibility: "none",
    mapTitle: "Household demand context",
    sourceLabel: "SRC-016 ACS household count · market context only",
    evidenceBoundary: "Public ACS household counts are market context only. They are not a clinic score, pricing recommendation, marketing recommendation, or opportunity score.",
    legend: censusLegend("Household percentile"),
    emptyState: {
      title: "Household values unavailable",
      message: "Markets without an ACS household observation remain unscored and unranked.",
    },
    supportedQuestionTypes: ["describe", "compare", "investigate"],
    supportsComparison: true,
    supportsLayerMode: true,
    mapBinding: { kind: "census_percentile", censusMetric: "household_count" },
  },
  unavailableView({
    perspectiveId: "cvc",
    viewId: "access_and_pet_demand",
    label: "Access and pet demand",
    activeMeasure: "cvc.access_and_pet_demand",
    sourceIds: ["SRC-016", "SRC-017"],
    mapTitle: "Access and pet demand",
    sourceLabel: "Combined access and pet-demand evidence not approved",
    evidenceBoundary: "Access and pet demand cannot be assembled from public Census alone. No synthetic blend is shown.",
    emptyTitle: "Access and pet demand unavailable",
    emptyMessage: "Approved access and pet-demand measures are required before this combined CVC view can render.",
    supportsComparison: true,
  }),
  unavailableView({
    perspectiveId: "cvc",
    viewId: "clinic_performance_context",
    label: "Clinic performance context",
    activeMeasure: "cvc.clinic_performance_context",
    sourceIds: ["SRC-002"],
    mapTitle: "Clinic performance context",
    sourceLabel: "Clinic performance descriptive evidence",
    evidenceBoundary: "Clinic performance is available as descriptive evidence; scoring eligibility requires an approved aggregate export, outcome definition, and owner approval.",
    emptyTitle: "Clinic performance evidence needed",
    emptyMessage: "No approved aggregate clinic-performance observations are loaded for this view. No values are imputed.",
  }),
  {
    perspectiveId: "cvc",
    viewId: "market_expansion_context",
    label: "Market expansion context",
    activeMeasure: "cvc.market_expansion_context",
    geographyGrain: "cbsa",
    sourceIds: ["SRC-016"],
    evidenceStatus: "Confirmed",
    evidenceAvailability: "available",
    allowedUse: "market_context_only",
    scoringEligibility: "none",
    mapTitle: "Market expansion context",
    sourceLabel: "SRC-016 ACS population density · market context only",
    evidenceBoundary: "Population-density percentiles describe how concentrated a market is. They do not measure pet demand, clinic access, site feasibility, or an expansion-opportunity score.",
    legend: censusLegend("Population-density percentile"),
    emptyState: {
      title: "Population values unavailable",
      message: "Markets without an ACS population observation remain unscored and unranked.",
    },
    supportedQuestionTypes: ["describe", "compare", "investigate"],
    supportsComparison: true,
    supportsLayerMode: false,
    mapBinding: { kind: "census_percentile", censusMetric: "population_density" },
  },
].filter((view) => view.evidenceAvailability === "available");

const perspectiveDefinitions: PerspectiveDefinition[] = [
  {
    perspectiveId: "pricing",
    label: "Pricing",
    defaultViewId: "competitor_availability",
    views: pricingViews,
  },
  {
    perspectiveId: "marketing",
    label: "Marketing",
    defaultViewId: "paid_search_response",
    views: marketingViews,
  },
  {
    perspectiveId: "cvc",
    label: "CVC",
    defaultViewId: "household_demand",
    views: cvcViews,
  },
];

export const perspectiveCatalog: PerspectiveCatalog = perspectiveCatalogSchema.parse({
  version: PERSPECTIVE_CATALOG_VERSION,
  perspectives: perspectiveDefinitions,
});
