import { z } from "zod";

export const planningIntentSchema = z.object({
  topic: z.enum(["market_context", "clinic_location", "clinic_performance", "local_growth", "other"]),
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
  conciseInterpretation: z.string().trim().min(1).max(240),
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

export const evaluationPlanSchema = z.object({
  planId: z.string().trim().min(1),
  version: z.literal("1.0.0"),
  originalQuestion: z.string().trim().min(3).max(600),
  proposalMethod: z.enum(["ai_proposed", "deterministic_fallback"]),
  intent: planningIntentSchema,
  capabilityId: z.enum([
    "census_market_context",
    "clinic_performance",
    "clinic_site_evaluation",
    "local_growth_test",
  ]),
  geographyGrain: z.enum(["cbsa", "submarket", "site", "portfolio"]),
  status: z.enum(["executable", "partially_executable", "blocked"]),
  evidenceBoundary: z.string().trim().min(1),
  missingEvidence: z.array(z.string().trim().min(1)),
  missingApprovals: z.array(z.string().trim().min(1)),
  steps: z.array(planStepSchema).min(1),
  actions: z.array(plannedActionSchema).min(1),
}).strict();

export type PlanningIntent = z.infer<typeof planningIntentSchema>;
export type EvaluationPlan = z.infer<typeof evaluationPlanSchema>;
export type PlannedAction = z.infer<typeof plannedActionSchema>;

export const evaluationPlanRequestSchema = z.object({
  question: z.string().trim().min(3).max(600),
}).strict();

export const evaluationPlanResponseSchema = z.object({
  status: z.literal("ok"),
  plan: evaluationPlanSchema,
}).strict();
