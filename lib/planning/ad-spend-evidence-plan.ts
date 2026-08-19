import { z } from "zod";
import type { ExecutionEvidenceItem } from "../evidence-snapshot/contracts.ts";
import {
  evidenceReconciliationReportSchema,
  reconcileEvidenceCompatibility,
  type CrosswalkMetadata,
} from "./evidence-compatibility.ts";

export const AD_SPEND_EVIDENCE_PLAN_VERSION = "ad-spend-evidence-plan-v1" as const;

export const adSpendEvidenceClassSchema = z.enum([
  "recommendation_driver",
  "validity_gate",
  "context",
  "contradiction",
  "unavailable",
]);

const classifiedEvidenceSchema = z.object({
  evidenceId: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  metricId: z.string().trim().min(1),
  classification: adSpendEvidenceClassSchema,
  contribution: z.string().trim().min(1),
  usableForRecommendation: z.boolean(),
}).strict();

export const adSpendEvidencePlanSchema = z.object({
  version: z.literal(AD_SPEND_EVIDENCE_PLAN_VERSION),
  question: z.string().trim().min(3).max(600),
  decisionType: z.literal("ad_spend"),
  status: z.enum(["ready_for_controlled_test_review", "not_ready"]),
  evidence: z.array(classifiedEvidenceSchema),
  counts: z.object({
    recommendationDrivers: z.number().int().nonnegative(),
    validityGates: z.number().int().nonnegative(),
    context: z.number().int().nonnegative(),
    contradictions: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
  }).strict(),
  compatibility: evidenceReconciliationReportSchema,
  missingRequiredFields: z.array(z.object({
    field: z.string().trim().min(1),
    team: z.enum(["Marketing", "Finance", "Data Governance", "Marketing Science", "Operations"]),
    reason: z.string().trim().min(1),
  }).strict()),
  readinessReason: z.string().trim().min(1),
  conclusionBoundary: z.string().trim().min(1),
}).strict();

export type AdSpendEvidencePlan = z.infer<typeof adSpendEvidencePlanSchema>;

const DRIVER = /(completed_?orders?|regional_?orders?|new_?customers?|contribution|profit|net_?sales|incremental_?(orders?|customers?|contribution|revenue)|causal_?lift)/i;
const VALIDITY = /(campaign_?cohort|campaign_?taxonomy|attribution|lag_?window|geo(graphy)?_?coverage|location_?coverage|incrementality|experiment|test_?control|power|contamination|impression_?share|operational_?stability|sample_?size)/i;

const REQUIRED_FIELDS = [
  { field: "campaign_cohort_id", team: "Marketing" as const, reason: "Comparable account, campaign, channel, funnel, audience, budget, creative, promotion, and tactic cohort." },
  { field: "governed_geography_id", team: "Data Governance" as const, reason: "Stable DMA or postal identifier with physical-presence/configured-target semantics and coverage." },
  { field: "observation_period", team: "Data Governance" as const, reason: "Bounded and overlapping media and outcome periods." },
  { field: "paid_search_spend", team: "Marketing" as const, reason: "Spend at the governed geography, period, and comparable campaign cohort." },
  { field: "completed_orders", team: "Finance" as const, reason: "Privacy-safe completed orders at the same governed grain." },
  { field: "new_customers", team: "Finance" as const, reason: "Governed new-customer outcome and acquisition definition at the same grain." },
  { field: "contribution_profit", team: "Finance" as const, reason: "Owner-approved contribution definition at the same geography and period." },
  { field: "attribution_lag", team: "Marketing" as const, reason: "Approved conversion definition, attribution setting, and lag window." },
  { field: "test_control_design", team: "Marketing Science" as const, reason: "Pre-period balance, test/control assignment, power, contamination, success, stop, and rollback rules." },
  { field: "operational_guardrails", team: "Operations" as const, reason: "Inventory, capacity, channel-substitution, and rollback constraints." },
];

function text(item: ExecutionEvidenceItem) {
  return `${item.metricId} ${item.reportScope ?? ""} ${Object.keys(item.structuredValue ?? {}).join(" ")}`.toLowerCase();
}

function fieldPresent(field: string, evidence: ExecutionEvidenceItem[]) {
  const patterns: Record<string, RegExp> = {
    campaign_cohort_id: /(campaign_?cohort|campaign_?taxonomy)/i,
    governed_geography_id: /(geo(graphy)?_?coverage|location_?coverage)/i,
    observation_period: /./,
    paid_search_spend: /(paid_?search_?spend|google_?ads_?spend|ad_?spend)/i,
    completed_orders: /(completed_?orders?|regional_?orders?)/i,
    new_customers: /new_?customers?/i,
    contribution_profit: /(contribution|profit)/i,
    attribution_lag: /(attribution|lag_?window)/i,
    test_control_design: /(experiment|test_?control|power|contamination)/i,
    operational_guardrails: /(operational_?guardrails|operational_?stability|inventory_?capacity)/i,
  };
  if (field === "observation_period") return evidence.some((item) => item.period.start && item.period.end);
  return evidence.some((item) => patterns[field].test(text(item)) && item.rawValue !== null && !["rejected", "unknown"].includes(item.qualityStatus));
}

/**
 * Builds a cross-team evidence plan only for ad-spend decisions. It classifies
 * evidence but never invents geography joins, periods, outcome definitions,
 * or causal authority.
 */
export function buildAdSpendEvidencePlan(input: {
  question: string;
  evidence: ExecutionEvidenceItem[];
  crosswalks?: CrosswalkMetadata[];
  missingEvidence?: string[];
}): AdSpendEvidencePlan {
  if (!/\b(ad spend|advertising spend|media spend|paid search|campaign budget|search spend|spend more|increase\w* (?:ad|advertising|media|paid search)?\s*spend|ads?)\b/i.test(input.question)) {
    throw new Error("The ad-spend evidence planner accepts ad-spend decisions only.");
  }
  const compatibility = reconcileEvidenceCompatibility(input.evidence, {
    operation: "join",
    crosswalks: input.crosswalks,
    missingEvidence: input.missingEvidence,
  });
  const contradictionIds = new Set(compatibility.issues.filter((issue) => issue.type === "contradiction" || issue.type === "metric_definition_conflict" || issue.type === "unit_conflict").flatMap((issue) => issue.evidenceIds));
  const unavailableIds = new Set(compatibility.issues.filter((issue) => issue.type === "missing_value").flatMap((issue) => issue.evidenceIds));
  const evidence = input.evidence.map((item) => {
    const description = text(item);
    let classification: z.infer<typeof adSpendEvidenceClassSchema>;
    let contribution: string;
    if (["confidential", "restricted"].includes(item.sensitivity) || ["rejected", "unknown"].includes(item.qualityStatus) || unavailableIds.has(item.evidenceId)) {
      classification = "unavailable";
      contribution = "Unavailable for recommendation use because the value, quality, or browser-safe sensitivity gate is not satisfied.";
    } else if (contradictionIds.has(item.evidenceId)) {
      classification = "contradiction";
      contribution = "Challenges another observation at the same geography and period; retain both values until definition and precedence are resolved.";
    } else if (VALIDITY.test(description)) {
      classification = "validity_gate";
      contribution = "Tests whether campaign cohort, geography, attribution, volume, experiment, or operational conditions permit interpretation.";
    } else if (DRIVER.test(description)) {
      classification = "recommendation_driver";
      contribution = "Measures a first-party commercial or incremental outcome that could support a bounded test recommendation when all validity gates pass.";
    } else {
      classification = "context";
      contribution = "Provides delivery, cost, response, or market context but cannot independently justify changing spend.";
    }
    const usableForRecommendation = classification === "recommendation_driver" && compatibility.status === "compatible";
    return classifiedEvidenceSchema.parse({ evidenceId: item.evidenceId, sourceId: item.sourceId, metricId: item.metricId, classification, contribution, usableForRecommendation });
  });
  const missingRequiredFields = REQUIRED_FIELDS.filter((requirement) => !fieldPresent(requirement.field, input.evidence));
  const drivers = evidence.filter((item) => item.classification === "recommendation_driver");
  const gates = evidence.filter((item) => item.classification === "validity_gate");
  const contradictions = evidence.filter((item) => item.classification === "contradiction");
  const unavailable = evidence.filter((item) => item.classification === "unavailable");
  const ready = compatibility.status === "compatible" && drivers.length > 0 && gates.length > 0 && !contradictions.length && !unavailable.length && !missingRequiredFields.length;
  return adSpendEvidencePlanSchema.parse({
    version: AD_SPEND_EVIDENCE_PLAN_VERSION,
    question: input.question,
    decisionType: "ad_spend",
    status: ready ? "ready_for_controlled_test_review" : "not_ready",
    evidence,
    counts: {
      recommendationDrivers: drivers.length,
      validityGates: gates.length,
      context: evidence.filter((item) => item.classification === "context").length,
      contradictions: contradictions.length,
      unavailable: unavailable.length,
    },
    compatibility,
    missingRequiredFields,
    readinessReason: ready
      ? "Compatible first-party outcomes and validity gates cover the required ad-spend fields; the result may proceed to accountable controlled-test review, not an automatic spend change."
      : `${compatibility.status === "compatible" ? "Evidence compatibility did not identify a join blocker" : compatibility.canCombine ? "Evidence has unresolved geography, time, definition, or quality warnings" : "Evidence cannot be combined under the attached geography/time contracts"}; ${missingRequiredFields.length} required field(s), ${contradictions.length} contradiction(s), and ${unavailable.length} unavailable item(s) remain.`,
    conclusionBoundary: "Recommendation drivers may support only a controlled-test review after every validity gate passes. Context cannot become a driver, and no spend or campaign change is authorized.",
  });
}
