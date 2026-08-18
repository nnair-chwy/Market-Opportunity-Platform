import { z } from "zod";
import { evidenceStatusSchema, geographyGrainSchema } from "../evaluation-contracts.ts";

export const PERSPECTIVE_CATALOG_VERSION = "1.0.0" as const;

export const perspectiveIdSchema = z.enum(["pricing", "marketing", "cvc"]);
export type PerspectiveId = z.infer<typeof perspectiveIdSchema>;

export const perspectiveViewIdSchema = z.enum([
  "competitor_availability",
  "observed_equalized_price",
  "offer_observation_volume",
  "assortment_breadth",
  "price_index",
  "competitive_price_gaps",
  "promotion_intensity",
  "price_elasticity_context",
  "margin_contribution_context",
  "price_opportunity_by_region",
  "paid_search_response",
  "paid_search_impressions",
  "paid_search_ctr",
  "paid_search_cpc",
  "customer_demand",
  "acquisition_efficiency",
  "campaign_reach",
  "conversion_booking_rate",
  "local_engagement",
  "marketing_opportunity_by_region",
  "clinic_footprint",
  "pet_ownership",
  "household_demand",
  "access_and_pet_demand",
  "clinic_performance_context",
  "market_expansion_context",
]);
export type PerspectiveViewId = z.infer<typeof perspectiveViewIdSchema>;

export const perspectiveMeasureIdSchema = z.enum([
  "pricing.competitor_availability",
  "pricing.observed_equalized_price",
  "pricing.offer_observation_volume",
  "pricing.assortment_breadth",
  "pricing.price_index",
  "pricing.competitive_price_gaps",
  "pricing.promotion_intensity",
  "pricing.price_elasticity_context",
  "pricing.margin_contribution_context",
  "pricing.price_opportunity_by_region",
  "marketing.paid_search_response",
  "marketing.paid_search_impressions",
  "marketing.paid_search_ctr",
  "marketing.paid_search_cpc",
  "marketing.customer_demand",
  "marketing.acquisition_efficiency",
  "marketing.campaign_reach",
  "marketing.conversion_booking_rate",
  "marketing.local_engagement",
  "marketing.marketing_opportunity_by_region",
  "cvc.clinic_footprint",
  "cvc.pet_ownership",
  "cvc.household_demand",
  "cvc.access_and_pet_demand",
  "cvc.clinic_performance_context",
  "cvc.market_expansion_context",
]);
export type PerspectiveMeasureId = z.infer<typeof perspectiveMeasureIdSchema>;

export const viewEvidenceAvailabilitySchema = z.enum([
  "available",
  "unavailable",
  "evidence_needed",
]);
export type ViewEvidenceAvailability = z.infer<typeof viewEvidenceAvailabilitySchema>;

export const allowedUseSchema = z.enum([
  "market_context_only",
  "synthetic_prototype_only",
  "internal_demo_evidence_only",
  "decision_support_draft",
]);
export type AllowedUse = z.infer<typeof allowedUseSchema>;

export const scoringEligibilitySchema = z.enum([
  "none",
  "synthetic_prototype_only",
  "eligible",
]);
export type ScoringEligibility = z.infer<typeof scoringEligibilitySchema>;

export const mapBindingSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("census_percentile"),
    censusMetric: z.enum([
      "total_population",
      "household_count",
      "median_household_income",
      "housing_unit_count",
      "population_density",
    ]),
  }).strict(),
  z.object({
    kind: z.literal("clinic_locations"),
  }).strict(),
  z.object({
    kind: z.literal("workspace_snapshot"),
    datasetId: z.enum([
      "pricing_competitor_availability",
      "pricing_observed_equalized_price",
      "pricing_offer_observation_volume",
      "pricing_assortment_breadth",
      "marketing_paid_search_response",
      "marketing_paid_search_impressions",
      "marketing_paid_search_ctr",
      "marketing_paid_search_cpc",
    ]),
    valueFormat: z.enum(["number", "percent", "currency"]),
  }).strict(),
  z.object({
    kind: z.literal("unavailable"),
  }).strict(),
]);
export type MapBinding = z.infer<typeof mapBindingSchema>;

export const legendConfigurationSchema = z.object({
  title: z.string().trim().min(1).max(120),
  lowLabel: z.string().trim().min(1).max(40),
  midLabel: z.string().trim().min(1).max(40),
  highLabel: z.string().trim().min(1).max(40),
  unscoredLabel: z.string().trim().min(1).max(40),
  showGradient: z.boolean(),
}).strict();
export type LegendConfiguration = z.infer<typeof legendConfigurationSchema>;

export const emptyStateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(500),
}).strict();
export type EmptyState = z.infer<typeof emptyStateSchema>;

export const supportedQuestionTypeSchema = z.enum([
  "describe",
  "compare",
  "screen",
  "investigate",
  "approve",
]);
export type SupportedQuestionType = z.infer<typeof supportedQuestionTypeSchema>;

export const perspectiveViewSchema = z.object({
  perspectiveId: perspectiveIdSchema,
  viewId: perspectiveViewIdSchema,
  label: z.string().trim().min(1).max(80),
  activeMeasure: perspectiveMeasureIdSchema,
  geographyGrain: geographyGrainSchema,
  sourceIds: z.array(z.string().trim().min(1).max(180)).min(1),
  evidenceStatus: evidenceStatusSchema,
  evidenceAvailability: viewEvidenceAvailabilitySchema,
  allowedUse: allowedUseSchema,
  scoringEligibility: scoringEligibilitySchema,
  mapTitle: z.string().trim().min(1).max(160),
  sourceLabel: z.string().trim().min(1).max(180),
  evidenceBoundary: z.string().trim().min(1).max(600),
  legend: legendConfigurationSchema,
  emptyState: emptyStateSchema,
  supportedQuestionTypes: z.array(supportedQuestionTypeSchema).min(1),
  supportsComparison: z.boolean(),
  supportsLayerMode: z.boolean(),
  mapBinding: mapBindingSchema,
}).strict().superRefine((view, context) => {
  const expectedPrefix = `${view.perspectiveId}.`;
  if (!view.activeMeasure.startsWith(expectedPrefix)) {
    context.addIssue({
      code: "custom",
      path: ["activeMeasure"],
      message: "A view measure must stay inside its perspective namespace.",
    });
  }
  if (view.scoringEligibility !== "none" && view.allowedUse === "market_context_only") {
    context.addIssue({
      code: "custom",
      path: ["scoringEligibility"],
      message: "Public market context cannot become score-eligible.",
    });
  }
  if (
    view.mapBinding.kind !== "unavailable" &&
    view.evidenceAvailability !== "available"
  ) {
    context.addIssue({
      code: "custom",
      path: ["mapBinding"],
      message: "Only available views may bind a map measure or clinic overlay.",
    });
  }
  if (
    view.mapBinding.kind === "unavailable" &&
    view.evidenceAvailability === "available"
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidenceAvailability"],
      message: "Available views must declare a concrete map binding.",
    });
  }
});
export type PerspectiveView = z.infer<typeof perspectiveViewSchema>;

export const perspectiveDefinitionSchema = z.object({
  perspectiveId: perspectiveIdSchema,
  label: z.string().trim().min(1).max(40),
  defaultViewId: perspectiveViewIdSchema,
  views: z.array(perspectiveViewSchema).min(1),
}).strict().superRefine((perspective, context) => {
  const viewIds = perspective.views.map((view) => view.viewId);
  if (new Set(viewIds).size !== viewIds.length) {
    context.addIssue({
      code: "custom",
      path: ["views"],
      message: "View identifiers must be unique within a perspective.",
    });
  }
  if (!viewIds.includes(perspective.defaultViewId)) {
    context.addIssue({
      code: "custom",
      path: ["defaultViewId"],
      message: "The default view must belong to the perspective.",
    });
  }
  perspective.views.forEach((view, index) => {
    if (view.perspectiveId !== perspective.perspectiveId) {
      context.addIssue({
        code: "custom",
        path: ["views", index, "perspectiveId"],
        message: "Nested views must match the parent perspective.",
      });
    }
  });
});
export type PerspectiveDefinition = z.infer<typeof perspectiveDefinitionSchema>;

export const perspectiveCatalogSchema = z.object({
  version: z.literal(PERSPECTIVE_CATALOG_VERSION),
  perspectives: z.array(perspectiveDefinitionSchema).length(3),
}).strict().superRefine((catalog, context) => {
  const ids = catalog.perspectives.map((item) => item.perspectiveId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: "custom",
      path: ["perspectives"],
      message: "Perspective identifiers must be unique.",
    });
  }
  for (const required of ["pricing", "marketing", "cvc"] as const) {
    if (!ids.includes(required)) {
      context.addIssue({
        code: "custom",
        path: ["perspectives"],
        message: `Missing required perspective: ${required}.`,
      });
    }
  }
});
export type PerspectiveCatalog = z.infer<typeof perspectiveCatalogSchema>;

export type MapPresentation = {
  perspectiveId: PerspectiveId;
  viewId: PerspectiveViewId;
  measureId: PerspectiveMeasureId;
  mapTitle: string;
  sourceLabel: string;
  evidenceBoundary: string;
  legend: LegendConfiguration;
  emptyState: EmptyState;
  evidenceAvailability: ViewEvidenceAvailability;
  allowedUse: AllowedUse;
  scoringEligibility: ScoringEligibility;
  sourceIds: readonly string[];
  mapBinding: MapBinding;
  supportsComparison: boolean;
  supportsLayerMode: boolean;
};
