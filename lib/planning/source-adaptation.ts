import { createHash } from "node:crypto";
import { z } from "zod";
import type { SourceAdaptationReadiness } from "../evidence-snapshot/contracts.ts";
import type { AnswerEvaluationReport } from "./answer-evaluation.ts";
import type { EvaluationPlan } from "./contracts.ts";
import { applyUsedSourceAdaptation } from "./source-adaptation-plan.ts";

export const dynamicSourceConsiderationSchema = z.object({
  candidateId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  sourceIds: z.array(z.string().trim().min(1)).min(1),
  status: z.enum(["compatible", "incompatible"]),
  reason: z.string().trim().min(1),
  addressesRequirementIds: z.array(z.string().trim().min(1)),
}).strict();
export type DynamicSourceConsideration = z.infer<typeof dynamicSourceConsiderationSchema>;

type FieldRequirement = SourceAdaptationReadiness["nextRequiredDataset"]["fields"][number];

const REQUIRED_FIELDS: Record<string, Array<Omit<FieldRequirement, "requirementId">>> = {
  marketing_comparable_cohort: [
    { field: "campaign_cohort_id", label: "Comparable campaign cohort", description: "Stable account, campaign, channel, funnel, tactic, audience, budget, creative, and promotion cohort." },
  ],
  marketing_geography: [
    { field: "geography_id", label: "Governed geography ID", description: "Approved DMA or postal identifier with physical-presence/configured-target semantics and coverage." },
  ],
  marketing_business_outcome: [
    { field: "observation_period", label: "Observation period", description: "Bounded outcome window with attribution and lag semantics." },
    { field: "completed_orders", label: "Completed orders", description: "Privacy-safe aggregate completed-order count at the governed geography and period." },
    { field: "new_customers", label: "New customers", description: "Governed new-customer count and acquisition definition at the same grain." },
    { field: "contribution_profit", label: "Contribution profit", description: "Owner-approved aggregate contribution definition at the same geography and period." },
  ],
  marketing_incrementality: [
    { field: "experiment_cohort", label: "Test/control cohort", description: "Pre-period, treatment/control, power, contamination, success, stop, and rollback fields." },
  ],
  pricing_competitor_condition: [
    { field: "zip_code", label: "ZIP code", description: "Governed five-digit observation geography." },
    { field: "product_part_number", label: "Product ID", description: "Stable matched Chewy/competitor product identifier." },
    { field: "competitor_offer_date", label: "Competitor offer date", description: "Observation date used for freshness and comparable-window checks." },
    { field: "competitor_price_availability", label: "Competitor price and availability", description: "Package-equalized offer, availability, coupon, competitor, and sampling coverage." },
  ],
  pricing_chewy_economics: [
    { field: "chewy_price_cost", label: "Chewy price and cost", description: "Dated price, promotion, product hierarchy, PSE cost definition, and materiality." },
  ],
  pricing_customer_outcome: [
    { field: "regional_commercial_outcome", label: "Regional commercial outcome", description: "Privacy-safe sales, units, discount, return, contribution, and response at the same geography and period." },
  ],
  pricing_test_authority: [
    { field: "test_guardrails", label: "Test authority and guardrails", description: "Elasticity status, approval, success metric, stop rule, and rollback." },
  ],
  cvc_demand_outcome: [
    { field: "clinic_or_service_geography_id", label: "Clinic or service geography", description: "Governed clinic or approved aggregate service geography." },
    { field: "observation_period", label: "Observation period", description: "Bounded demand or performance window." },
    { field: "governed_demand_outcome", label: "Demand outcome", description: "Approved customer, appointment, performance, or pet-demand aggregate." },
  ],
  cvc_access_capacity: [
    { field: "staffed_capacity", label: "Staffed capacity", description: "Staffed or schedulable hours or slots by clinic/service geography and period." },
    { field: "appointment_availability", label: "Appointment availability", description: "Governed available/booked/completed appointment counts and status semantics." },
    { field: "trade_area_or_drive_time", label: "Trade area or drive time", description: "Owner-approved service-area relationship and version." },
  ],
  cvc_supply_feasibility: [
    { field: "supply_feasibility", label: "Supply and feasibility", description: "Competitive supply, workforce, property, economics, regulatory, and physical-site constraints." },
  ],
  cvc_human_judgment: [
    { field: "accountable_review", label: "Accountable review", description: "Reviewer, inspection, approval state, and decision boundary." },
  ],
};

export function registryFingerprint(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function adaptPlanForUsedSources(plan: EvaluationPlan, used: DynamicSourceConsideration[]): EvaluationPlan {
  return applyUsedSourceAdaptation(plan, used.map((source) => ({ ...source, decision: "used" as const })));
}

export function buildSourceAdaptationReadiness(input: {
  plan: EvaluationPlan;
  registryVersion: string;
  registryFingerprint: string;
  considerations: DynamicSourceConsideration[];
  usedCandidateEvidence: Map<string, string[]>;
  evaluation: AnswerEvaluationReport;
}): SourceAdaptationReadiness {
  const sources = input.considerations.map((item) => {
    const evidenceIds = input.usedCandidateEvidence.get(item.candidateId) ?? [];
    const decision = evidenceIds.length ? "used" as const : item.status === "incompatible" ? "incompatible" as const : "available_not_run" as const;
    const reason = evidenceIds.length
      ? `${evidenceIds.length} question-compatible aggregate evidence item(s) were added and checked against the original goal.`
      : item.status === "incompatible" ? item.reason : "The reviewed source was compatible but was not reached before the bounded investigation stopped.";
    return {
      candidateId: item.candidateId,
      label: item.label,
      sourceIds: item.sourceIds,
      decision,
      reason,
      addressesRequirementIds: item.addressesRequirementIds,
      evidenceIds,
    };
  });
  const usedRequirementIds = new Set(sources.filter((item) => item.decision === "used").flatMap((item) => item.addressesRequirementIds));
  const unmetRequirements = input.plan.answerContract.domainRequirements.filter((item) => item.required && item.readiness !== "not_applicable" && !usedRequirementIds.has(item.requirementId));
  const fields = unmetRequirements.flatMap((requirement) => (REQUIRED_FIELDS[requirement.requirementId] ?? [{ field: requirement.requirementId, label: requirement.label, description: requirement.questionToAnswer }])
    .map((field) => ({ ...field, requirementId: requirement.requirementId })));
  const usedCount = sources.filter((item) => item.decision === "used").length;
  return {
    version: "source-adaptation-readiness-v1",
    originalGoal: input.plan.originalQuestion,
    registryVersion: input.registryVersion,
    registryFingerprint: input.registryFingerprint,
    status: usedCount ? "adapted_with_new_evidence" : sources.length ? "reviewed_sources_considered" : "no_compatible_reviewed_source",
    sources,
    goalCheck: {
      status: input.evaluation.overallStatus,
      explanation: input.evaluation.overallStatus === "pass"
        ? "The adapted answer passed every completion check for the original question."
        : `The original question was re-checked after adaptation; ${input.evaluation.unmetCriterionIds.length} completion check(s) remain unmet.`,
      unmetCriterionIds: input.evaluation.unmetCriterionIds,
    },
    nextRequiredDataset: {
      reason: fields.length ? "These exact fields are still required to satisfy the original answer contract." : "No additional dataset field is required; accountable review remains.",
      fields,
    },
  };
}
