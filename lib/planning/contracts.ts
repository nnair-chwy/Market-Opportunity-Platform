import { z } from "zod";

export const requestedPlaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  stateHint: z.string().trim().length(2).nullable(),
}).strict();

export const planningIntentSchema = z.object({
  topic: z.enum([
    "market_context",
    "regional_context",
    "clinic_context",
    "google_ads_context",
    "source_coverage",
    "multi_source_evidence",
    "multi_market_comparison",
    "growth_test_screening",
    "clinic_location",
    "clinic_performance",
    "local_growth",
    "consumer_insights",
    "other",
  ]),
  geographyGrain: z.enum(["cbsa", "submarket", "site", "portfolio", "unknown"]),
  requestedAction: z.enum(["describe", "compare", "screen", "investigate", "approve"]),
  requestedMeasure: z.enum([
    "total_population",
    "household_count",
    "median_household_income",
    "housing_unit_count",
    "population_density",
    "none",
  ]),
  requestedMetrics: z.array(z.enum([
    "total_population",
    "household_count",
    "median_household_income",
    "housing_unit_count",
    "population_density",
    "active_customer_count",
    "prior_year_active_customer_count",
    "active_customer_yoy_growth",
    "active_customers_per_1000_households",
    "regional_net_sales",
    "clinic_count",
    "total_customers",
    "total_orders",
    "rx_orders",
    "net_sales",
    "rx_net_sales",
    "google_ads_spend",
    "google_ads_impressions",
    "google_ads_clicks",
    "google_ads_conversions",
    "source_coverage",
    "growth_test_screening_score",
    "consumer_bdi",
    "consumer_cdi",
    "brand_funnel",
    "brand_relevance",
    "brand_drivers",
    "generation_brand_health",
  ])).max(12),
  sourceFamilies: z.array(z.enum(["census", "regional", "clinic", "google_ads", "consumer_insights"])).max(5),
  selectedQueries: z.array(z.enum([
    "supported_regions",
    "regional_context_by_cbsa",
    "clinic_context_by_cbsa",
    "google_ads_context_by_cbsa",
    "normalization_coverage",
    "growth_test_screening",
    "consumer_insights_by_cbsa",
    "brand_funnel_by_cbsa",
    "brand_relevance_drivers_by_cbsa",
    "brand_health_by_cbsa",
  ])).max(5),
  sort: z.object({
    metric: z.string().trim().min(1),
    direction: z.enum(["asc", "desc"]),
  }).strict().nullable(),
  rankingMode: z.enum(["none", "growth_test_screening_v1"]),
  requestedPlaces: z.array(requestedPlaceSchema).max(6),
  clarificationRequired: z.boolean(),
  clarificationReason: z.enum([
    "none",
    "ambiguous_geography",
    "ambiguous_decision",
    "ambiguous_comparison_cohort",
    "ambiguous_requested_output",
  ]),
  conciseInterpretation: z.string().trim().min(1).max(240),
}).strict();

export const resolvedPlaceCandidateSchema = z.object({
  cbsaCode: z.string().trim().min(1).max(5),
  cbsaName: z.string().trim().min(1).max(180),
}).strict();

export const resolvedPlaceSchema = z.object({
  requestedName: z.string().trim().min(1).max(80),
  status: z.enum(["resolved", "ambiguous", "unavailable"]),
  cbsaCode: z.string().trim().min(1).max(5).nullable(),
  cbsaName: z.string().trim().min(1).max(180).nullable(),
  candidates: z.array(resolvedPlaceCandidateSchema).max(8),
}).strict();

export const geographyResolutionSchema = z.object({
  mode: z.enum([
    "national",
    "single",
    "compare",
    "needs_selection",
    "clarification",
    "unavailable",
  ]),
  places: z.array(resolvedPlaceSchema),
  selectedCbsaCodes: z.array(z.string().trim().min(1).max(5)).max(5),
  message: z.string().trim().min(1).max(400),
}).strict();

export const geographicFocusSchema = z.object({
  state: z.enum(["focused", "fallback"]),
  source: z.enum([
    "question_geography",
    "evaluation_result",
    "action_plan",
    "unavailable",
  ]),
  cbsaCodes: z.array(z.string().trim().min(1).max(5)).max(5),
  label: z.string().trim().min(1).max(240),
  evidenceStatus: z.enum(["Confirmed", "Derived", "Unknown"]),
  message: z.string().trim().min(1).max(500),
}).strict();

export const planStepSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  result: z.string().trim().min(1),
}).strict();

export const plannedActionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  owner: z.string().trim().min(1),
  timing: z.string().trim().min(1),
  confidence: z.enum(["High", "Medium", "Low"]),
  evidence: z.array(z.string().trim().min(1)).min(1),
  tradeoffs: z.array(z.string().trim().min(1)).min(1),
  nextStep: z.string().trim().min(1),
  outputId: z.string().trim().min(1),
  requiresApproval: z.boolean(),
}).strict();

export const planFindingSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.enum([
    "interpretation",
    "geography",
    "capability",
    "execution",
    "evidence",
    "actions",
  ]),
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(400),
}).strict();

export const resultWorkspaceTypeSchema = z.enum([
  "adaptive_market_workspace",
  "clinic_evaluation_surface",
  "clarification",
  "evidence_readiness",
]);

export const evaluationPlanSchema = z.object({
  planId: z.string().trim().min(1),
  version: z.literal("1.0.0"),
  originalQuestion: z.string().trim().min(3).max(600),
  perspectiveId: z.enum(["pricing", "marketing", "cvc"]),
  proposalMethod: z.enum(["ai_proposed", "deterministic_fallback"]),
  intent: planningIntentSchema,
  capabilityId: z.enum([
    "census_market_context",
    "clinic_performance",
    "clinic_site_evaluation",
    "local_growth_test",
    "consumer_insights",
  ]),
  geographyGrain: z.enum(["cbsa", "submarket", "site", "portfolio"]),
  geographyResolution: geographyResolutionSchema,
  resultWorkspaceType: resultWorkspaceTypeSchema,
  status: z.enum(["executable", "partially_executable", "blocked"]),
  evidenceBoundary: z.string().trim().min(1),
  missingEvidence: z.array(z.string().trim().min(1)),
  missingApprovals: z.array(z.string().trim().min(1)),
  steps: z.array(planStepSchema).min(1),
  actions: z.array(plannedActionSchema).min(1),
  findings: z.array(planFindingSchema).min(1).max(6),
}).strict();

export const sisterGeographySignalSchema = z.object({
  id: z.enum(["shared_state", "matching_cbsa_type"]),
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(120).nullable(),
  status: z.enum(["Confirmed", "Derived", "Reported", "Hypothesis", "Unknown"]),
  sourceId: z.string().trim().min(1).max(40),
}).strict();

export const sisterGeographySuggestionSchema = z.object({
  cbsaCode: z.string().trim().min(1).max(5),
  cbsaName: z.string().trim().min(1).max(180),
  principalCityLabel: z.string().trim().min(1).max(80),
  whySuggested: z.string().trim().min(1).max(400),
  signals: z.array(sisterGeographySignalSchema).min(1).max(4),
  evidenceStatus: z.enum(["Confirmed", "Derived", "Reported", "Hypothesis", "Unknown"]),
  uncertainty: z.string().trim().min(1).max(400),
  sourceIds: z.array(z.string().trim().min(1).max(40)).min(1),
  ruleId: z.string().trim().min(1).max(80),
  allowedUse: z.literal("market_context_only"),
  scoringEligibility: z.literal("none"),
}).strict();

export type PlanningIntent = z.infer<typeof planningIntentSchema>;
export type RequestedPlace = z.infer<typeof requestedPlaceSchema>;
export type GeographyResolution = z.infer<typeof geographyResolutionSchema>;
export type GeographicFocus = z.infer<typeof geographicFocusSchema>;
export type EvaluationPlan = z.infer<typeof evaluationPlanSchema>;
export type PlannedAction = z.infer<typeof plannedActionSchema>;
export type PlanFinding = z.infer<typeof planFindingSchema>;
export type PlanStep = z.infer<typeof planStepSchema>;
export type ResultWorkspaceType = z.infer<typeof resultWorkspaceTypeSchema>;
export type SisterGeographySignal = z.infer<typeof sisterGeographySignalSchema>;
export type SisterGeographySuggestion = z.infer<typeof sisterGeographySuggestionSchema>;

export const evaluationPlanRequestSchema = z.object({
  question: z.string().trim().min(3).max(600),
  perspectiveId: z.enum(["pricing", "marketing", "cvc"]).optional(),
  selectedCbsaCodes: z.array(z.string().trim().regex(/^\d{5}$/)).max(3).default([]),
}).strict();

export const evaluationPlanResponseSchema = z.object({
  status: z.literal("ok"),
  plan: evaluationPlanSchema,
}).strict();

export const evaluationPlanErrorSchema = z.object({
  status: z.literal("error"),
  message: z.string().trim().min(1).max(400),
}).strict();
