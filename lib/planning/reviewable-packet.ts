import { z } from "zod";
import { CAPABILITY_REGISTRY_VERSION } from "../capability-registry.ts";
import {
  evaluationPlanSchema,
  plannedActionSchema,
  type EvaluationPlan,
  type PlannedAction,
} from "./contracts.ts";
import type { InvestigationFollowUp, InvestigationLead, MarketInvestigation } from "./market-investigation.ts";
import type { AnalysisBrief } from "./analysis-brief.ts";
import type { InsightActionPlan } from "./insight-action-plan.ts";
import {
  evidencePlanSchema,
  evaluationDefinitionDraftSchema,
  type EvidencePlan,
  type EvaluationDefinitionDraft,
} from "./evidence-plan.ts";
import {
  evaluationExecutionResultSchema,
  type EvaluationExecutionResult,
} from "./execution.ts";
import { validationWorkplanSchema, type ValidationWorkplan } from "./validation-workplan.ts";
import {
  evidenceExecutionResponseSchema,
  type EvidenceExecutionResponse,
} from "../evidence-snapshot/contracts.ts";
import { METRIC_CATALOG } from "./metric-catalog.ts";
import {
  checkInvestigationCoverage,
  investigationCoverageReportSchema,
} from "./investigation-coverage.ts";
import {
  composeFinalAnswer,
  composedFinalAnswerSchema,
} from "./final-answer-composer.ts";
import { evidenceReconciliationReportSchema } from "./evidence-compatibility.ts";
import {
  answerEvaluationReportSchema,
  evaluateAnswerCompletion,
} from "./answer-evaluation.ts";

export const REVIEWABLE_ACTION_PACKET_VERSION = "reviewable-action-packet-v2" as const;
export const PACKET_SUMMARY_PROMPT_VERSION = "evaluation-packet-findings-summary-v3" as const;

export const packetAnswerSchema = z.object({
  version: z.literal("packet-answer-v1"),
  state: z.enum(["answered", "partial", "blocked", "unavailable"]),
  topic: evaluationPlanSchema.shape.intent.shape.topic,
  directAnswer: z.string().trim().min(1).max(1800),
  facts: z.array(z.object({
    evidenceId: z.string().trim().min(1),
    metricId: z.string().trim().min(1),
    metricLabel: z.string().trim().min(1),
    geographyId: z.string().trim().min(1).nullable(),
    geographyLabel: z.string().trim().min(1),
    rawValue: z.number().finite().nullable(),
    displayValue: z.string().trim().min(1),
    unit: z.string().trim().min(1).nullable(),
    periodLabel: z.string().trim().min(1),
    reportScope: z.string().trim().min(1).nullable(),
    sourceId: z.string().trim().min(1),
    evidenceStatus: z.enum(["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"]),
    warning: z.string().trim().min(1).nullable(),
  }).strict()).max(60),
  limitations: z.array(z.string().trim().min(1)).max(40),
  proposedAction: z.object({
    title: z.string().trim().min(1),
    owner: z.string().trim().min(1),
    nextStep: z.string().trim().min(1),
    requiresApproval: z.boolean(),
    kpi: z.string().trim().min(1).optional(),
    validationThreshold: z.string().trim().min(1).optional(),
    stopCondition: z.string().trim().min(1).optional(),
  }).strict(),
}).strict();

export type PacketAnswer = z.infer<typeof packetAnswerSchema>;

const insightActionPlanSchema = z.object({
  version: z.literal("1.0.0"),
  planId: z.string().trim().min(1),
  leadId: z.string().trim().min(1),
  marketName: z.string().trim().min(1),
  decisionOwner: z.string().trim().min(1),
  decisionDueDate: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
  whyNow: z.string().trim().min(1),
  whatThisInforms: z.array(z.string().trim().min(1)).min(1),
  workstreams: z.array(z.object({
    id: z.string().trim().min(1),
    sequence: z.number().int().positive(),
    title: z.string().trim().min(1),
    owner: z.string().trim().min(1),
    dueDate: z.string().trim().min(1),
    action: z.string().trim().min(1),
    deliverable: z.string().trim().min(1),
    completionCriteria: z.string().trim().min(1),
    // Optional on read so saved v1 packets remain valid; current builders always populate them.
    kpi: z.string().trim().min(1).optional(),
    validationThreshold: z.string().trim().min(1).optional(),
    stopCondition: z.string().trim().min(1).optional(),
    status: z.enum(["ready_to_start", "blocked_on_evidence"]),
  }).strict()).min(1),
  decisionRules: z.array(z.object({
    disposition: z.enum(["advance", "hold", "stop"]),
    rule: z.string().trim().min(1),
  }).strict()).length(3),
  stakeholders: z.array(z.string().trim().min(1)).min(1),
  longerTermConsiderations: z.array(z.string().trim().min(1)).min(1),
  sourcePattern: z.string().trim().min(1),
  // Optional on read so packets created before decision-grade lever metadata remain valid.
  lever: z.enum(["paid_search_spend_test", "pricing_test", "clinic_footprint_validation"]).optional(),
  actionReadiness: z.enum(["ready_for_bounded_test", "validation_required", "outcome_missing", "evidence_incompatible"]).optional(),
  confidence: z.enum(["High", "Medium", "Low"]).optional(),
  goalEvaluationStatus: z.enum(["pass", "partial", "fail"]).optional(),
  baseline: z.object({
    status: z.enum(["available", "partial", "missing"]),
    description: z.string().trim().min(1),
    evidenceIds: z.array(z.string().trim().min(1)),
  }).strict().optional(),
  kpi: z.string().trim().min(1).optional(),
  validationThreshold: z.string().trim().min(1).optional(),
  stopCondition: z.string().trim().min(1).optional(),
  sensitivityAndContraryEvidence: z.string().trim().min(1).optional(),
}).strict();

export const reviewableActionPacketSchema = z.object({
  packetKind: z.literal("draft_action_packet"),
  status: z.literal("draft_for_review"),
  reviewDisclaimer: z.string().trim().min(1),
  packetVersion: z.literal(REVIEWABLE_ACTION_PACKET_VERSION),
  planVersion: evaluationPlanSchema.shape.version,
  planId: z.string().trim().min(1),
  generatedAt: z.string().trim().min(1),
  proposalMethod: evaluationPlanSchema.shape.proposalMethod,
  originalQuestion: evaluationPlanSchema.shape.originalQuestion,
  perspectiveId: evaluationPlanSchema.shape.perspectiveId,
  geographicFocus: z.object({
    mode: evaluationPlanSchema.shape.geographyResolution.shape.mode,
    message: z.string().trim().min(1),
    selectedCbsaCodes: z.array(z.string().trim().min(1).max(5)).max(5),
    placeLabels: z.array(z.string().trim().min(1)).max(8),
  }).strict(),
  evidenceBoundary: evaluationPlanSchema.shape.evidenceBoundary,
  missingEvidence: evaluationPlanSchema.shape.missingEvidence,
  missingApprovals: evaluationPlanSchema.shape.missingApprovals,
  answerContract: evaluationPlanSchema.shape.answerContract,
  answerCoverage: investigationCoverageReportSchema,
  answerEvaluation: answerEvaluationReportSchema.optional(),
  finalAnswer: composedFinalAnswerSchema,
  calculationVersions: z.object({
    evaluationPlanVersion: evaluationPlanSchema.shape.version,
    capabilityRegistryVersion: z.literal(CAPABILITY_REGISTRY_VERSION),
    capabilityId: evaluationPlanSchema.shape.capabilityId,
    resultWorkspaceType: evaluationPlanSchema.shape.resultWorkspaceType,
    evidenceSourceIds: z.array(z.string().trim().min(1)).max(12),
    evidenceSnapshotIds: z.array(z.string().trim().min(1)).max(20),
    evidenceQueryVersion: z.string().trim().min(1).nullable(),
    evidenceCalculationVersion: z.string().trim().min(1).nullable(),
    executionMode: z.enum(["frozen_snapshot_demo", "synthetic_demo"]).nullable(),
  }).strict(),
  action: plannedActionSchema,
  packetAnswer: packetAnswerSchema,
  findings: evaluationPlanSchema.shape.findings,
  execution: evaluationExecutionResultSchema.nullable().optional(),
  evidenceExecution: evidenceExecutionResponseSchema.nullable().optional(),
  evidencePlan: evidencePlanSchema.optional(),
  evaluationDefinition: evaluationDefinitionDraftSchema.optional(),
  reviewContext: z.object({
    selectedLeadId: z.string().trim().min(1).nullable(),
    contextMetric: z.enum(["total_population", "household_count", "median_household_income", "housing_unit_count", "population_density"]),
  }).strict().optional(),
  analysisBrief: z.object({
    version: z.literal("1.0.0"),
    planId: z.string().trim().min(1),
    status: z.enum(["proposed", "confirmed"]),
    originalQuestion: evaluationPlanSchema.shape.originalQuestion,
    rewrittenQuestion: z.string().trim().min(1),
    perspectiveId: evaluationPlanSchema.shape.perspectiveId,
    geography: z.string().trim().min(1),
    timeframe: z.string().trim().min(1),
    assumptions: z.array(z.string().trim().min(1)),
    currentScreen: z.object({
      inputs: z.array(z.string().trim().min(1)),
      method: z.string().trim().min(1),
      considerationEditsRecalculate: z.boolean(),
      weightMode: z.enum(["none", "advisory", "fixed_calculation"]).optional(),
    }).strict(),
    queryContract: z.object({
      topic: evaluationPlanSchema.shape.intent.shape.topic,
      geographyIds: z.array(z.string().trim().min(1)),
      sourceFamilies: evaluationPlanSchema.shape.intent.shape.sourceFamilies,
      registeredQueries: evaluationPlanSchema.shape.intent.shape.selectedQueries,
      requestedMetrics: z.array(z.string().trim().min(1)),
      scoringVersion: z.string().trim().min(1).nullable(),
      missingDataRule: z.string().trim().min(1),
    }).strict().optional(),
    considerations: z.array(z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      metric: z.string().trim().min(1),
      role: z.enum(["weighted_preference", "validity_gate", "context_only"]),
      evidenceStatus: z.enum(["connected", "partial", "needed"]),
      weightPercent: z.number().min(0).max(100).nullable(),
      whyItMatters: z.string().trim().min(1),
    }).strict()).min(1),
    confirmedAt: z.string().trim().min(1).nullable(),
  }).strict().optional(),
  actionPlan: insightActionPlanSchema.optional(),
  validationWorkplan: validationWorkplanSchema.optional(),
  analysisAppendix: z.object({
    version: z.literal("1.0.0"),
    planId: z.string().trim().min(1),
    originalQuestion: evaluationPlanSchema.shape.originalQuestion,
    perspectiveId: evaluationPlanSchema.shape.perspectiveId,
    geography: z.enum(["CBSA", "supplied_trade_area"]),
    period: z.string().trim().min(1),
    dataSnapshotLabel: z.string().trim().min(1),
    dataSnapshotVersion: z.string().trim().min(1),
    readiness: z.object({
      label: z.enum(["Partial answer", "Context only"]),
      summary: z.string().trim().min(1),
      missing: z.array(z.string().trim().min(1)),
    }).strict(),
    toolsRun: z.array(z.string().trim().min(1)),
    measuresExamined: z.array(z.string().trim().min(1)),
    comparisonsExamined: z.number().int().nonnegative(),
    portfolioPattern: z.object({
      headline: z.string().trim().min(1),
      summary: z.string().trim().min(1),
      implication: z.string().trim().min(1),
      segments: z.array(z.object({
        label: z.string().trim().min(1),
        eligibleMarkets: z.number().int().nonnegative(),
        highCpcMarkets: z.number().int().nonnegative(),
        dualPressureMarkets: z.number().int().nonnegative(),
      }).strict()).min(1),
    }).strict().optional(),
    mediaScope: z.object({
      included: z.string().trim().min(1),
      excluded: z.array(z.string().trim().min(1)).min(1),
      bundlingRule: z.string().trim().min(1),
    }).strict().optional(),
    analystRevision: z.object({
      draftNumber: z.number().int().positive(),
      prompt: z.string().trim().min(1).max(600),
      summary: z.string().trim().min(1),
      effectOnRecommendation: z.string().trim().min(1),
      recommendedFollowUp: z.string().trim().min(1),
      evidenceRequest: z.string().trim().min(1),
      recommendationUpdate: z.string().trim().min(1),
    }).strict().optional(),
    screeningScope: z.object({
      marketUniverse: z.number().int().nonnegative(),
      eligibleCohort: z.string().trim().min(1),
      eligibleComparisons: z.number().int().nonnegative(),
      allMarketPairs: z.number().int().nonnegative(),
      selectionRule: z.string().trim().min(1),
      executionMode: z.literal("deterministic_local_snapshot"),
    }).strict(),
    leads: z.array(z.object({
      id: z.string().trim().min(1),
      marketIds: z.array(z.string().trim().min(1).max(120)).max(5),
      title: z.string().trim().min(1),
      observation: z.string().trim().min(1),
      businessMeaning: z.string().trim().min(1),
      method: z.string().trim().min(1),
      sampleSize: z.number().int().nonnegative(),
      strength: z.string().trim().min(1),
      challenge: z.string().trim().min(1),
      nextEvidence: z.string().trim().min(1),
      measureValue: z.object({
        label: z.string().trim().min(1),
        rawValue: z.number().finite(),
        formattedValue: z.string().trim().min(1),
        percentile: z.number().int().min(1).max(100),
        rangeMeaning: z.string().trim().min(1),
      }).strict().optional(),
      supportingMeasures: z.array(z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
        formattedValue: z.string().trim().min(1),
        percentile: z.number().int().min(1).max(100),
        rangeMeaning: z.string().trim().min(1),
        role: z.enum(["cost", "response", "attributed_outcome", "comparison", "market_context"]),
      }).strict()).optional(),
    }).strict()).max(10),
    rejectedPatterns: z.array(z.string().trim().min(1)),
    limitations: z.array(z.string().trim().min(1)),
    sourceIds: z.array(z.string().trim().min(1)),
    allowedUse: z.enum(["market_context_only", "internal_shadow_evaluation_only"]),
    scoringEligibility: z.literal("none"),
    evidenceStage: z.enum(["signal", "triangulated_finding"]),
    reconciliation: evidenceReconciliationReportSchema.optional(),
    nextPass: z.object({
      status: z.enum(["waiting_for_evidence", "ready_to_run"]),
      question: z.string().trim().min(1),
      evidenceNeeded: z.array(z.string().trim().min(1)).min(1),
      completionRule: z.string().trim().min(1),
    }).strict(),
    investigationPath: z.array(z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      purpose: z.string().trim().min(1),
      contributionToAnswer: z.string().trim().min(1),
      status: z.enum(["completed", "waiting_for_evidence", "pending"]),
      sourceIds: z.array(z.string().trim().min(1)),
      result: z.string().trim().min(1),
    }).strict()).min(1),
    formula: z.array(z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      weightPercent: z.number().min(0).max(100),
    }).strict()).optional(),
    followUps: z.array(z.object({
      id: z.string().trim().min(1),
      leadId: z.string().trim().min(1),
      question: z.string().trim().min(1),
      answer: z.string().trim().min(1),
    }).strict()),
  }).strict().optional(),
}).strict();

export type ReviewableActionPacket = z.infer<typeof reviewableActionPacketSchema>;

export const packetFindingsSummarySchema = z.object({
  title: z.literal("Findings and proposed action"),
  draftOnlyNotice: z.string().trim().min(1),
  origin: z.enum(["ai", "deterministic_fallback"]),
  state: z.enum([
    "available",
    "deterministic_fallback",
    "not_configured",
    "timeout",
    "provider_error",
    "invalid_structure",
    "validation_rejected",
  ]),
  modelVersion: z.string().trim().min(1).nullable(),
  promptVersion: z.literal(PACKET_SUMMARY_PROMPT_VERSION),
  summary: z.string().trim().min(1).max(1400),
  evidenceIndicates: z.string().trim().min(1).max(600).optional(),
  whyActionRelevant: z.string().trim().min(1).max(600).optional(),
  ownerNextStep: z.string().trim().min(1).max(600).optional(),
  remainsUnknown: z.string().trim().min(1).max(600).optional(),
}).strict();

export type PacketFindingsSummary = z.infer<typeof packetFindingsSummarySchema>;

function boundedSummaryText(value: string, maximum = 600) {
  const normalized = value.trim();
  if (normalized.length <= maximum) return normalized;
  const clipped = normalized.slice(0, maximum - 1);
  const lastWordBoundary = clipped.lastIndexOf(" ");
  const readableEnd = lastWordBoundary >= Math.floor(maximum * 0.7)
    ? lastWordBoundary
    : clipped.length;
  return `${clipped.slice(0, readableEnd).trimEnd()}…`;
}

function evidenceSourceIdsFor(plan: EvaluationPlan): string[] {
  if (plan.capabilityId === "census_market_context") {
    return ["SRC-014", "SRC-015", "SRC-016"];
  }
  if (plan.capabilityId === "clinic_site_evaluation") {
    return ["SRC-009", "SRC-014", "SRC-015", "SRC-016"];
  }
  if (plan.capabilityId === "consumer_insights") {
    return ["SRC-033"];
  }
  return [];
}

export function proposedActionFromPlan(plan: EvaluationPlan): PlannedAction {
  const action = plan.actions[0];
  const measurement = plan.perspectiveId === "marketing"
    ? {
      kpi: "Coverage of source-linked regional business outcomes and an approved comparison design for each validation market.",
      validationThreshold: "All candidate markets have comparable approved outcomes, geography, periods, and an owner-approved measurement rule.",
      stopCondition: "Stop before changing spend if outcomes, geography, comparison design, or approval is missing or incompatible.",
    }
    : plan.perspectiveId === "pricing"
      ? {
        kpi: "Representative geographic and matched-SKU coverage with compatible first-party outcomes.",
        validationThreshold: "Owner-approved ZIP coverage, SKU-match reliability, period comparability, and business-outcome gates are all met.",
        stopCondition: "Stop before changing price if coverage is unrepresentative, matches are unreliable, periods conflict, or outcomes are missing.",
      }
      : {
        kpi: "Completion of governed demand, capacity, competitive-access, property, and economics evidence for the selected market.",
        validationThreshold: "All required evidence workstreams meet owner-approved gates with no material stop condition.",
        stopCondition: "Stop before footprint action if any required evidence is unresolved or a capacity, workforce, access, property, or economics gate fails.",
      };
  return plannedActionSchema.parse({ ...action, ...measurement });
}

function packetMetricLabel(metricId: string) {
  const normalized = metricId.replace(/^normalized\./, "") as keyof typeof METRIC_CATALOG;
  if (METRIC_CATALOG[normalized]) return METRIC_CATALOG[normalized]!.label;
  if (metricId === "growth_test_screening.score") return "Growth-test screening score";
  if (metricId === "normalized.source_coverage") return "Requested source checks present";
  if (metricId.includes("completed_appointments")) return "Completed appointments";
  return metricId.replaceAll("_", " ").replaceAll(".", " ");
}

function packetDisplayValue(value: number | null, unit: string | null, currency: string | null) {
  if (value === null) return "Structured evidence available";
  if (unit === "ratio") return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
  if (unit === "currency_units" && currency) return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: unit?.includes("score") ? 1 : 2 }).format(value);
  return unit ? `${formatted} ${unit.replaceAll("_", " ")}` : formatted;
}

function factClause(fact: PacketAnswer["facts"][number]) {
  return `${fact.metricLabel}: ${fact.displayValue} (${fact.periodLabel}${fact.reportScope ? `, ${fact.reportScope}` : ""})`;
}

function querySpecificDirectAnswer(
  plan: EvaluationPlan,
  evidenceExecution: EvidenceExecutionResponse,
  facts: PacketAnswer["facts"],
): string {
  if (!facts.length) return `The registered execution returned no browser-eligible evidence for this question. ${evidenceExecution.missingEvidence.join(" ") || "The evidence gap remains explicit."}`;
  if (plan.intent.topic === "clinic_context") {
    return `${facts[0]!.geographyLabel} has ${facts.map(factClause).join("; ")}. These are aggregate clinic-market activity measures. Rx orders are the supplied prescription proxy, and the result is not a clinic-level operating performance judgment.`;
  }
  if (plan.intent.topic === "consumer_insights") {
    return `${facts[0]!.geographyLabel} has ${facts.map(factClause).join("; ")}. These are reported survey observations from the 2024 Brand Health Tracker, aligned from the source DMA to the selected CBSA through an intuitive Derived local-demo crosswalk. The evidence is descriptive context only and does not establish demand, market share, causality, or site suitability.`;
  }
  if (plan.intent.topic === "regional_context") {
    return `${facts[0]!.geographyLabel} has ${facts.map(factClause).join("; ")}. Customer context and calendar-year sales are separate descriptive observations and do not establish incremental regional opportunity.`;
  }
  if (plan.intent.topic === "google_ads_context") {
    return `${facts[0]!.geographyLabel} has ${facts.map(factClause).join("; ")}. Spend is intentionally separated by report scope, and the matched-location-to-CBSA mapping remains inferred demo context rather than a provider-stable geography join.`;
  }
  if (plan.intent.topic === "multi_market_comparison") {
    const groups = new Map<string, PacketAnswer["facts"]>();
    for (const fact of facts) groups.set(fact.geographyLabel, [...(groups.get(fact.geographyLabel) ?? []), fact]);
    const comparisons = [...groups.entries()].map(([market, marketFacts]) => `${market}: ${marketFacts.map(factClause).join("; ")}`);
    return `${comparisons.join(". ")}. This is a side-by-side comparison of descriptive aggregate clinic-market activity, not an approved clinic operating KPI, score, or winner.`;
  }
  if (plan.intent.topic === "multi_source_evidence") {
    const sourceCount = new Set(facts.map((fact) => fact.sourceId)).size;
    return `${facts[0]!.geographyLabel} has ${facts.length} canonical observations from ${sourceCount} registered sources. Highlights: ${facts.slice(0, 8).map(factClause).join("; ")}. Source periods, grains, and Ads geography quality remain separate and must be reconciled before forming one market hypothesis.`;
  }
  if (plan.intent.topic === "source_coverage") {
    const row = evidenceExecution.rows[0] ?? {};
    const status = (full: boolean, partial: boolean) => full ? "available" : partial ? "partial" : "missing";
    const census = status(row.hasCensus === true, false);
    const regional = status(row.hasMarketContext === true && row.hasRegionalDemand === true, row.hasMarketContext === true || row.hasRegionalDemand === true);
    const clinic = status(row.hasClinicProfile === true && row.hasClinicActivity === true, row.hasClinicProfile === true || row.hasClinicActivity === true);
    const ads = status(row.hasGoogleAds === true, false);
    return `${String(row.cbsaName ?? facts[0]!.geographyLabel)} source presence is Census: ${census}; regional: ${regional}; clinic: ${clinic}; Google Ads: ${ads}. Presence means a normalized source row exists. It does not establish freshness, completeness, quality, or market attractiveness.`;
  }
  if (plan.intent.topic === "growth_test_screening") {
    const top = evidenceExecution.rows.slice(0, 5).map((row) => `#${String(row.rank)} ${String(row.cbsaName)} (${Number(row.score).toFixed(1)})`);
    return `The fixed complete-case hypothesis screen ranks ${top.join("; ")}. Each score uses the registered 30/25/20/15/10 weights, incomplete markets are excluded without weight redistribution, and the rank does not authorize a test, campaign, clinic opening, or spend.`;
  }
  if (plan.intent.topic === "clinic_performance") {
    const selected = evidenceExecution.rows.find((row) => row.selected === true);
    return selected
      ? `${String(selected.clinicName)} is ${String(selected.rank)} of ${evidenceExecution.rows.length} in the explicitly synthetic peer group with ${new Intl.NumberFormat("en-US").format(Number(selected.value))} completed appointments at the shared 38-week maturity point. This is Hypothesis-only fixture output, not a real clinic performance judgment.`
      : "The synthetic peer fixture executed, but no selected clinic row was identified, so no clinic-specific rank is claimed.";
  }
  if (plan.intent.topic === "clinic_location") {
    const preferredMetrics = [
      "normalized.total_population",
      "normalized.household_count",
      "normalized.active_customer_count",
      "normalized.regional_net_sales",
      "normalized.clinic_count",
      "normalized.total_customers",
      "normalized.total_orders",
      "normalized.net_sales",
    ];
    const highlights = preferredMetrics.flatMap((metricId) => {
      const matches = facts.filter((fact) => fact.metricId === metricId);
      if (metricId === "normalized.regional_net_sales") return [matches.find((fact) => fact.periodLabel === "2025") ?? matches.at(-1)].filter(Boolean) as PacketAnswer["facts"];
      return matches.slice(0, 1);
    }).slice(0, 8);
    const available = highlights.length ? highlights.map(factClause).join("; ") : facts.slice(0, 8).map(factClause).join("; ");
    return `${facts[0]!.geographyLabel} has connected public and regional market context plus aggregate clinic activity. Available evidence includes ${available}. Still not connected are clinic access and staffed capacity, workforce, competitive veterinary access, property and trade-area feasibility, clinic economics, cannibalization, and an approved opening decision rule. This supports a bounded validation workplan, not site selection or approval to open a clinic.`;
  }
  return facts.slice(0, 8).map((fact) => `${fact.geographyLabel}: ${factClause(fact)} (${fact.sourceId}, ${fact.evidenceStatus})`).join(". ");
}

export function buildPacketAnswer(
  plan: EvaluationPlan,
  action: PlannedAction = proposedActionFromPlan(plan),
  evidenceExecution: EvidenceExecutionResponse | null = null,
): PacketAnswer {
  const facts = (evidenceExecution?.evidenceBundle ?? []).slice(0, 60).map((item) => ({
    evidenceId: item.evidenceId,
    metricId: item.metricId,
    metricLabel: packetMetricLabel(item.metricId),
    geographyId: item.geographyId,
    geographyLabel: item.geographyLabel,
    rawValue: item.rawValue,
    displayValue: packetDisplayValue(item.rawValue, item.unit, item.currency),
    unit: item.unit,
    periodLabel: item.period.label,
    reportScope: item.reportScope,
    sourceId: item.sourceId,
    evidenceStatus: item.evidenceStatus,
    warning: item.warning,
  }));
  const state: PacketAnswer["state"] = !evidenceExecution
    ? "unavailable"
    : evidenceExecution.status === "blocked" || evidenceExecution.status === "failed"
      ? "blocked"
      : evidenceExecution.status === "partial"
        ? "partial"
        : "answered";
  const directAnswer = evidenceExecution
    ? querySpecificDirectAnswer(plan, evidenceExecution, facts)
    : "The validated plan is available, but no registered evidence execution was supplied, so this packet does not claim an analytical answer.";
  const limitations = [...new Set([
    ...(evidenceExecution?.qualityWarnings ?? []),
    ...(evidenceExecution?.missingEvidence ?? []),
    ...(evidenceExecution?.unknowns ?? []),
    ...plan.missingEvidence,
    ...plan.missingApprovals,
  ])].slice(0, 40);

  return packetAnswerSchema.parse({
    version: "packet-answer-v1",
    state,
    topic: plan.intent.topic,
    directAnswer,
    facts,
    limitations,
    proposedAction: {
      title: action.title,
      owner: action.owner,
      nextStep: action.nextStep,
      requiresApproval: action.requiresApproval,
      kpi: action.kpi,
      validationThreshold: action.validationThreshold,
      stopCondition: action.stopCondition,
    },
  });
}

export function actionForInvestigationLead(
  action: PlannedAction,
  investigation: MarketInvestigation | null,
  lead: InvestigationLead | null,
): PlannedAction {
  if (!investigation || !lead) return action;
  return plannedActionSchema.parse({
    ...action,
    title: `Validate ${lead.title}`,
    summary: lead.businessMeaning,
    confidence: investigation.evidenceStage === "triangulated_finding" ? action.confidence : "Low",
    evidence: [
      `Observed signal: ${lead.observation}`,
      `Selection method: ${lead.method}`,
      `Evidence boundary: ${lead.challenge}`,
    ],
    tradeoffs: [
      lead.challenge,
      ...investigation.limitations.slice(0, 2),
    ],
    nextStep: lead.nextEvidence,
  });
}

export function assembleReviewableActionPacket(
  plan: EvaluationPlan,
  action: PlannedAction = proposedActionFromPlan(plan),
  generatedAt = new Date().toISOString(),
  investigation?: MarketInvestigation,
  followUps: InvestigationFollowUp[] = [],
  analysisBrief?: AnalysisBrief,
  evidencePlan?: EvidencePlan,
  evaluationDefinition?: EvaluationDefinitionDraft,
  reviewContext?: { selectedLeadId: string | null; contextMetric: "total_population" | "household_count" | "median_household_income" | "housing_unit_count" | "population_density" },
  actionPlan?: InsightActionPlan,
  execution: EvaluationExecutionResult | null = null,
  validationWorkplan?: ValidationWorkplan,
  evidenceExecution: EvidenceExecutionResponse | null = null,
): ReviewableActionPacket {
  const placeLabels = plan.geographyResolution.places
    .map((place) => place.cbsaName ?? place.requestedName)
    .filter(Boolean);

  if (investigation && (investigation.planId !== plan.planId || investigation.originalQuestion !== plan.originalQuestion)) {
    throw new Error("The investigation does not belong to this evaluation plan.");
  }
  if (analysisBrief && (analysisBrief.planId !== plan.planId || analysisBrief.originalQuestion !== plan.originalQuestion)) {
    throw new Error("The analysis brief does not belong to this evaluation plan.");
  }
  if (evidencePlan && (evidencePlan.planId !== plan.planId || evidencePlan.originalQuestion !== plan.originalQuestion)) {
    throw new Error("The evidence plan does not belong to this evaluation plan.");
  }
  if (evaluationDefinition && evaluationDefinition.planId !== plan.planId) {
    throw new Error("The evaluation definition does not belong to this evaluation plan.");
  }
  if (reviewContext?.selectedLeadId && !investigation?.leads.some((lead) => lead.id === reviewContext.selectedLeadId)) {
    throw new Error("The selected lead does not belong to this investigation.");
  }
  if (actionPlan && (actionPlan.planId !== plan.planId || !investigation?.leads.some((lead) => lead.id === actionPlan.leadId))) {
    throw new Error("The action plan does not belong to this evaluation plan and investigation.");
  }
  const answerCoverage = checkInvestigationCoverage(plan, investigation, action);
  const answerEvaluation = evaluateAnswerCompletion(plan, investigation, answerCoverage, action);
  const finalAnswer = composeFinalAnswer(plan, investigation, action, answerCoverage);
  const packetInvestigation = investigation && answerEvaluation.overallStatus !== "pass"
    ? {
        ...investigation,
        nextPass: {
          status: "waiting_for_evidence" as const,
          question: answerEvaluation.nextPass.question,
          evidenceNeeded: answerEvaluation.nextPass.evidenceNeeded,
          completionRule: answerEvaluation.nextPass.completionRule,
        },
      }
    : investigation;

  return reviewableActionPacketSchema.parse({
    packetKind: "draft_action_packet",
    status: "draft_for_review",
    reviewDisclaimer:
      "This file is a draft action packet for human review only. Downloading it does not approve, authorize, or execute any real-estate, campaign, spend, or business action, and it was not sent by email, Slack, or any external channel.",
    packetVersion: REVIEWABLE_ACTION_PACKET_VERSION,
    planVersion: plan.version,
    planId: plan.planId,
    generatedAt,
    proposalMethod: plan.proposalMethod,
    originalQuestion: plan.originalQuestion,
    perspectiveId: plan.perspectiveId,
    geographicFocus: {
      mode: plan.geographyResolution.mode,
      message: plan.geographyResolution.message,
      selectedCbsaCodes: plan.geographyResolution.selectedCbsaCodes,
      placeLabels,
    },
    evidenceBoundary: plan.evidenceBoundary,
    missingEvidence: [...new Set([...plan.missingEvidence, ...(evidenceExecution?.missingEvidence ?? []), ...(evidenceExecution?.unknowns ?? [])])],
    missingApprovals: [...new Set([...plan.missingApprovals, ...(evidenceExecution?.missingApprovals ?? [])])],
    answerContract: plan.answerContract,
    answerCoverage,
    answerEvaluation,
    finalAnswer,
    calculationVersions: {
      evaluationPlanVersion: plan.version,
      capabilityRegistryVersion: CAPABILITY_REGISTRY_VERSION,
      capabilityId: plan.capabilityId,
      resultWorkspaceType: plan.resultWorkspaceType,
      evidenceSourceIds: evidenceExecution?.sourceIds ?? evidenceSourceIdsFor(plan),
      evidenceSnapshotIds: evidenceExecution ? [...new Set([evidenceExecution.snapshotVersion, ...evidenceExecution.evidenceBundle.map((item) => item.snapshotId)])] : [],
      evidenceQueryVersion: evidenceExecution?.queryVersion ?? null,
      evidenceCalculationVersion: evidenceExecution?.calculationVersion ?? null,
      executionMode: evidenceExecution?.executionMode ?? null,
    },
    action,
    packetAnswer: buildPacketAnswer(plan, action, evidenceExecution),
    findings: plan.findings,
    execution,
    evidenceExecution,
    evidencePlan,
    evaluationDefinition,
    reviewContext,
    analysisBrief,
    actionPlan,
    validationWorkplan,
    analysisAppendix: packetInvestigation ? { ...packetInvestigation, followUps } : undefined,
  });
}

function bulletList(items: string[], emptyLabel: string) {
  if (!items.length) return `- ${emptyLabel}`;
  return items.map((item) => `- ${item}`).join("\n");
}

export function formatReviewableActionPacketDocument(packet: ReviewableActionPacket): string {
  const action = packet.action;
  const focusPlaces = packet.geographicFocus.placeLabels.length
    ? packet.geographicFocus.placeLabels.join("; ")
    : "No named place labels";
  const cbsa = packet.geographicFocus.selectedCbsaCodes.length
    ? packet.geographicFocus.selectedCbsaCodes.join(", ")
    : "None selected";

  const framingSections = packet.analysisBrief ? [
    "## Confirmed analysis framing",
    `- Status: ${packet.analysisBrief.status}`,
    `- Rewritten question: ${packet.analysisBrief.rewrittenQuestion}`,
    `- Perspective: ${packet.analysisBrief.perspectiveId}`,
    `- Geography: ${packet.analysisBrief.geography}`,
    `- Timeframe: ${packet.analysisBrief.timeframe}`,
    "",
    "### Working assumptions",
    bulletList(packet.analysisBrief.assumptions, "None listed"),
    "",
    "### Confirmed calculation mechanics",
    `- Inputs: ${packet.analysisBrief.currentScreen.inputs.join("; ")}`,
    `- Method: ${packet.analysisBrief.currentScreen.method}`,
    `- Human consideration edits recalculate this screen: ${packet.analysisBrief.currentScreen.considerationEditsRecalculate ? "yes" : "no"}`,
    "",
    "### Considerations",
    ...packet.analysisBrief.considerations.flatMap((item) => [
      `- ${item.label}: ${item.metric}`,
      `  - Role: ${item.role.replaceAll("_", " ")}; evidence: ${item.evidenceStatus}; weight: ${item.weightPercent === null ? "not weighted" : `${item.weightPercent}%`}`,
      `  - Why it matters: ${item.whyItMatters}`,
    ]),
    "",
  ] : [];
  const answerContractSections = [
    "## Final-answer contract",
    `- Contract version: ${packet.answerContract.version}`,
    `- Answer mode: ${packet.answerContract.answerMode.replaceAll("_", " ")}`,
    `- Framing origin: ${packet.answerContract.framingProposal.origin.replaceAll("_", " ")}${packet.answerContract.framingProposal.modelVersion ? ` (${packet.answerContract.framingProposal.modelVersion})` : ""}`,
    `- Primary user: ${packet.answerContract.audience.primaryUser}`,
    `- Decision owner: ${packet.answerContract.audience.decisionOwner}`,
    `- Accountable reviewer: ${packet.answerContract.audience.accountableReviewer}`,
    `- Unit of analysis: ${packet.answerContract.decisionFrame.unitOfAnalysis}`,
    `- Strongest permitted conclusion: ${packet.answerContract.strongestPermittedConclusion}`,
    `- Fallback outcome: ${packet.answerContract.fallbackOutcome.replaceAll("_", " ")}`,
    `- Unresolved framing questions: ${packet.answerContract.framingProposal.unresolvedQuestions.join("; ") || "None"}`,
    "",
    "### Required answer sections",
    ...packet.answerContract.requiredSections.map((section) => `- ${section.label}: ${section.purpose}`),
    "",
    `### ${packet.answerContract.perspectiveId.toUpperCase()} answer requirements`,
    ...packet.answerContract.domainRequirements.flatMap((requirement) => [
      `- ${requirement.label}: ${requirement.readiness.replaceAll("_", " ")}`,
      `  - Must answer: ${requirement.questionToAnswer}`,
      `  - Sources: ${requirement.sourceIds.join(", ") || "No governed source identified"}`,
      `  - If unmet: ${requirement.ifUnmet}`,
    ]),
    "",
    "### Completion criteria",
    ...packet.answerContract.completionCriteria.map((criterion) => `- ${criterion.label}`),
    "",
    "### Prohibited conclusions",
    ...packet.answerContract.prohibitedConclusions.map((conclusion) => `- ${conclusion}`),
    "",
  ];
  const answerCoverageSections = [
    "## Investigation coverage against the answer contract",
    `- Coverage version: ${packet.answerCoverage.version}`,
    `- Overall status: ${packet.answerCoverage.overallStatus}`,
    `- Required items covered: ${packet.answerCoverage.coveredRequiredCount} of ${packet.answerCoverage.requiredCount}`,
    `- Strongest supported conclusion: ${packet.answerCoverage.permittedConclusion}`,
    "",
    "### Required answer-section coverage",
    ...packet.answerCoverage.sectionCoverage.map((item) => `- ${item.label}: ${item.status} — ${item.explanation}`),
    "",
    "### Domain-requirement coverage",
    ...packet.answerCoverage.domainCoverage.map((item) => `- ${item.label}: ${item.status} — ${item.explanation}`),
    "",
  ];
  const answerEvaluationSections = packet.answerEvaluation ? [
    "## Confirmed-goal completion check",
    `- Evaluation version: ${packet.answerEvaluation.version}`,
    `- Overall status: ${packet.answerEvaluation.overallStatus}`,
    `- Criteria passed: ${packet.answerEvaluation.passedCount} of ${packet.answerEvaluation.criterionCount}`,
    ...packet.answerEvaluation.criteria.map((criterion) => `- ${criterion.label}: ${criterion.status} — ${criterion.explanation}${criterion.evidenceIds.length ? ` [${criterion.evidenceIds.join(", ")}]` : ""}`),
    "",
    "### Bounded next pass",
    `- Status: ${packet.answerEvaluation.nextPass.status.replaceAll("_", " ")}`,
    `- Question: ${packet.answerEvaluation.nextPass.question}`,
    `- Completion rule: ${packet.answerEvaluation.nextPass.completionRule}`,
    ...packet.answerEvaluation.nextPass.evidenceNeeded.map((item) => `- Evidence needed: ${item}`),
    "",
  ] : [];
  const finalAnswerSections = [
    "## Contract-complete draft answer",
    `- Status: ${packet.finalAnswer.status.replaceAll("_", " ")}`,
    `- Composer version: ${packet.finalAnswer.version}`,
    `- Review required by: ${packet.finalAnswer.reviewRequiredBy}`,
    "",
    packet.finalAnswer.disclaimer,
    "",
    ...packet.finalAnswer.sections.flatMap((section) => [
      `### ${section.label} — ${section.supportStatus}`,
      section.content,
      ...(section.sourceIds.length ? [`Sources: ${section.sourceIds.join(", ")}`] : []),
      "",
    ]),
  ];
  const evidencePlanningSections = packet.evidencePlan && packet.evaluationDefinition ? [
    "## Evidence readiness and generated execution plan",
    `- Status: ${packet.evaluationDefinition.status.replaceAll("_", " ")}`,
    `- Strongest allowed conclusion: ${packet.evaluationDefinition.strongestAllowedConclusion}`,
    `- Available evidence: ${packet.evaluationDefinition.availableEvidenceIds.join(", ") || "None"}`,
    `- Staged for validation (not used): ${packet.evaluationDefinition.stagedEvidenceIds.join(", ") || "None"}`,
    "",
    "### Evidence needs",
    ...packet.evidencePlan.items.flatMap((item) => [
      `- ${item.label}: ${item.availability}`,
      `  - Needed for: ${item.requiredFor}`,
      `  - Allowed use: ${item.allowedUse}`,
      `  - Next: ${item.nextAction}`,
      ...(item.correctionRequest ? [`  - Correction requested: ${item.correctionRequest}`] : []),
    ]),
    "",
    "### Execution steps",
    ...packet.evaluationDefinition.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "### Blockers",
    bulletList(packet.evaluationDefinition.blockers, "None listed"),
    "",
  ] : [];
  const selectedLead = packet.reviewContext?.selectedLeadId
    ? packet.analysisAppendix?.leads.find((lead) => lead.id === packet.reviewContext?.selectedLeadId)
    : undefined;
  const reviewContextSections = packet.reviewContext ? [
    "## Saved review context",
    `- Selected lead: ${selectedLead?.title ?? "No lead selected"}`,
    `- Map context measure: ${packet.reviewContext.contextMetric.replaceAll("_", " ")}`,
    ...(selectedLead ? [
      `- Selected observation: ${selectedLead.observation}`,
      `- Selected boundary: ${selectedLead.challenge}`,
      `- Selected evidence to check next: ${selectedLead.nextEvidence}`,
    ] : []),
    "",
  ] : [];
  const analysisSections = packet.analysisAppendix ? [
    "## Analyst screening",
    `- Perspective: ${packet.analysisAppendix.perspectiveId}`,
    `- Coverage: ${packet.analysisAppendix.comparisonsExamined.toLocaleString()} comparisons screened; ${packet.analysisAppendix.leads.length} review leads kept`,
    `- Screening universe: ${packet.analysisAppendix.screeningScope.marketUniverse} metros; ${packet.analysisAppendix.screeningScope.eligibleComparisons.toLocaleString()} eligible comparisons of ${packet.analysisAppendix.screeningScope.allMarketPairs.toLocaleString()} possible metro pairs`,
    `- Selection rule: ${packet.analysisAppendix.screeningScope.selectionRule}`,
    `- Execution mode: ${packet.analysisAppendix.screeningScope.executionMode.replaceAll("_", " ")}`,
    `- Period: ${packet.analysisAppendix.period}`,
    `- Data snapshot: ${packet.analysisAppendix.dataSnapshotLabel} (${packet.analysisAppendix.dataSnapshotVersion})`,
    `- Measures examined: ${packet.analysisAppendix.measuresExamined.join("; ")}`,
    `- Process: ${packet.analysisAppendix.toolsRun.join(" → ")}`,
    `- Readiness: ${packet.analysisAppendix.readiness.label} — ${packet.analysisAppendix.readiness.summary}`,
    ...(packet.analysisAppendix.reconciliation ? [
      `- Evidence compatibility: ${packet.analysisAppendix.reconciliation.status.replaceAll("_", " ")} (${packet.analysisAppendix.reconciliation.summary.errorCount} errors; ${packet.analysisAppendix.reconciliation.summary.warningCount} warnings)`,
      `- Compatibility boundary: ${packet.analysisAppendix.reconciliation.conclusionBoundary}`,
      ...packet.analysisAppendix.reconciliation.issues.map((item) => `- Reconciliation ${item.severity}: ${item.message}`),
    ] : []),
    ...(packet.analysisAppendix.portfolioPattern ? [
      `- Portfolio pattern: ${packet.analysisAppendix.portfolioPattern.headline}. ${packet.analysisAppendix.portfolioPattern.summary}`,
      `- Pattern boundary: ${packet.analysisAppendix.portfolioPattern.implication}`,
    ] : []),
    ...(packet.analysisAppendix.mediaScope ? [
      `- Media included: ${packet.analysisAppendix.mediaScope.included}`,
      `- Channel bundling rule: ${packet.analysisAppendix.mediaScope.bundlingRule}`,
      `- Media not included: ${packet.analysisAppendix.mediaScope.excluded.join("; ")}`,
    ] : []),
    ...(packet.analysisAppendix.analystRevision ? [
      `- Draft ${packet.analysisAppendix.analystRevision.draftNumber} analyst direction: ${packet.analysisAppendix.analystRevision.prompt}`,
      `- Revision summary: ${packet.analysisAppendix.analystRevision.summary}`,
      `- Revision effect: ${packet.analysisAppendix.analystRevision.effectOnRecommendation}`,
      `- Updated recommendation: ${packet.analysisAppendix.analystRevision.recommendationUpdate}`,
      `- New evidence request: ${packet.analysisAppendix.analystRevision.evidenceRequest}`,
      `- Recommended follow-up: ${packet.analysisAppendix.analystRevision.recommendedFollowUp}`,
    ] : []),
    `- Source IDs: ${packet.analysisAppendix.sourceIds.join(", ")}`,
    ...(packet.analysisAppendix.formula?.length ? [
      `- Confirmed formula: ${packet.analysisAppendix.formula.map((item) => `${item.label} ${item.weightPercent}%`).join("; ")}`,
    ] : []),
    "",
    "### Question-specific leads",
    ...packet.analysisAppendix.leads.flatMap((lead, index) => [
      `#### ${index + 1}. ${lead.title}`,
      `- Observation: ${lead.observation}`,
      `- Why it matters: ${lead.businessMeaning}`,
      `- Method: ${lead.method}`,
      `- Strength: ${lead.strength} (n=${lead.sampleSize})`,
      `- Boundary: ${lead.challenge}`,
      `- Evidence to check next: ${lead.nextEvidence}`,
      "",
    ]),
    "### Rejected patterns and limitations",
    bulletList(packet.analysisAppendix.rejectedPatterns, "None listed"),
    "",
    bulletList(packet.analysisAppendix.limitations, "None listed"),
    "",
    ...(packet.analysisAppendix.followUps.length ? [
      "### Lead-scoped follow-ups",
      ...packet.analysisAppendix.followUps.flatMap((turn) => [
        `- Question: ${turn.question}`,
        `- Answer: ${turn.answer}`,
      ]),
      "",
    ] : []),
  ] : [];
  const validationWorkplanSections = packet.validationWorkplan ? [
    "## Market-validation workplan",
    `- Title: ${packet.validationWorkplan.title}`,
    `- Objective: ${packet.validationWorkplan.objective}`,
    `- Accountable owner: ${packet.validationWorkplan.accountableOwner}`,
    `- Proposed action: ${packet.validationWorkplan.proposedAction}`,
    "",
    "### What this informs",
    bulletList(packet.validationWorkplan.whatThisInforms, "None listed"),
    "",
    "### Evidence inventory",
    ...packet.validationWorkplan.evidence.flatMap((item) => [
      `- ${item.label}: ${item.status.replaceAll("_", " ")}`,
      `  - Owner: ${item.owner}; grain: ${item.expectedGrain}; source: ${item.sourceId ?? "not connected"}; observation date: ${item.observationDate ?? "unknown"}`,
      `  - Allowed use: ${item.allowedUse}`,
      `  - Why needed: ${item.whyNeeded}`,
    ]),
    "",
    "### Workstreams",
    ...packet.validationWorkplan.workstreams.flatMap((workstream) => [
      `#### ${workstream.sequence}. ${workstream.title}`,
      `- Status: ${workstream.status.replaceAll("_", " ")}`,
      `- Owner: ${workstream.owner}`,
      `- Action: ${workstream.action}`,
      `- Evidence: ${workstream.evidenceIds.join(", ")}`,
      `- Deliverable: ${workstream.deliverable}`,
      `- Done when: ${workstream.completionCriteria}`,
      ...(workstream.kpi ? [`- KPI: ${workstream.kpi}`] : []),
      ...(workstream.validationThreshold ? [`- Validation threshold: ${workstream.validationThreshold}`] : []),
      ...(workstream.stopCondition ? [`- Stop condition: ${workstream.stopCondition}`] : []),
      "",
    ]),
    "### Validation disposition rules",
    ...packet.validationWorkplan.decisionRules.map((item) => `- ${item.disposition[0].toUpperCase()}${item.disposition.slice(1)}: ${item.rule}`),
    "",
    "### Limitations",
    bulletList(packet.validationWorkplan.limitations, "None listed"),
    "",
  ] : [];

  const actionPlanSections = packet.actionPlan ? [
    "## Decision handoff",
    `- Recommendation: ${packet.actionPlan.recommendation}`,
    ...(packet.actionPlan.lever ? [`- Lever: ${packet.actionPlan.lever.replaceAll("_", " ")}`] : []),
    ...(packet.actionPlan.actionReadiness ? [`- Action readiness: ${packet.actionPlan.actionReadiness.replaceAll("_", " ")}`] : []),
    ...(packet.actionPlan.confidence ? [`- Confidence: ${packet.actionPlan.confidence}`] : []),
    ...(packet.actionPlan.goalEvaluationStatus ? [`- Goal evaluation: ${packet.actionPlan.goalEvaluationStatus}`] : []),
    `- Market: ${packet.actionPlan.marketName}`,
    `- Decision owner: ${packet.actionPlan.decisionOwner}`,
    `- Decision review date: ${packet.actionPlan.decisionDueDate}`,
    `- Why now: ${packet.actionPlan.whyNow}`,
    ...(packet.actionPlan.baseline ? [`- Baseline (${packet.actionPlan.baseline.status}): ${packet.actionPlan.baseline.description} [${packet.actionPlan.baseline.evidenceIds.join(", ")}]`] : []),
    ...(packet.actionPlan.kpi ? [`- KPI: ${packet.actionPlan.kpi}`] : []),
    ...(packet.actionPlan.validationThreshold ? [`- Validation threshold: ${packet.actionPlan.validationThreshold}`] : []),
    ...(packet.actionPlan.stopCondition ? [`- Stop condition: ${packet.actionPlan.stopCondition}`] : []),
    ...(packet.actionPlan.sensitivityAndContraryEvidence ? [`- Sensitivity and contrary evidence: ${packet.actionPlan.sensitivityAndContraryEvidence}`] : []),
    "",
    "### What this will inform",
    bulletList(packet.actionPlan.whatThisInforms, "None listed"),
    "",
    "### Do this next",
    `- ${packet.actionPlan.workstreams[0].title}`,
    `  - Owner: ${packet.actionPlan.workstreams[0].owner}`,
    `  - Due: ${packet.actionPlan.workstreams[0].dueDate}`,
    `  - Action: ${packet.actionPlan.workstreams[0].action}`,
    `  - Deliverable: ${packet.actionPlan.workstreams[0].deliverable}`,
    `  - Done when: ${packet.actionPlan.workstreams[0].completionCriteria}`,
    ...(packet.actionPlan.workstreams[0].kpi ? [`  - KPI: ${packet.actionPlan.workstreams[0].kpi}`] : []),
    ...(packet.actionPlan.workstreams[0].validationThreshold ? [`  - Validation threshold: ${packet.actionPlan.workstreams[0].validationThreshold}`] : []),
    ...(packet.actionPlan.workstreams[0].stopCondition ? [`  - Stop condition: ${packet.actionPlan.workstreams[0].stopCondition}`] : []),
    "",
    "### Validation workplan",
    ...packet.actionPlan.workstreams.flatMap((workstream) => [
      `#### ${workstream.sequence}. ${workstream.title}`,
      `- Status: ${workstream.status.replaceAll("_", " ")}`,
      `- Owner: ${workstream.owner}`,
      `- Due: ${workstream.dueDate}`,
      `- Action: ${workstream.action}`,
      `- Deliverable: ${workstream.deliverable}`,
      `- Done when: ${workstream.completionCriteria}`,
      ...(workstream.kpi ? [`- KPI: ${workstream.kpi}`] : []),
      ...(workstream.validationThreshold ? [`- Validation threshold: ${workstream.validationThreshold}`] : []),
      ...(workstream.stopCondition ? [`- Stop condition: ${workstream.stopCondition}`] : []),
      "",
    ]),
    "### Decision rules",
    ...packet.actionPlan.decisionRules.map((item) => `- ${item.disposition[0].toUpperCase()}${item.disposition.slice(1)}: ${item.rule}`),
    "",
    "### Stakeholders to involve",
    bulletList(packet.actionPlan.stakeholders, "None listed"),
    "",
    "### Longer-term considerations",
    bulletList(packet.actionPlan.longerTermConsiderations, "None listed"),
    "",
    `Research structure used: ${packet.actionPlan.sourcePattern}`,
    "",
  ] : [];
  const evidenceExecutionSections = packet.evidenceExecution ? [
    "## Executed evidence bundle",
    `- Status: ${packet.evidenceExecution.status}`,
    `- Execution mode: ${packet.evidenceExecution.executionMode.replaceAll("_", " ")}`,
    `- Query: ${packet.evidenceExecution.query}`,
    `- Allowed use: ${packet.evidenceExecution.allowedUse}`,
    `- Sensitivity: ${packet.evidenceExecution.sensitivity}`,
    "",
    ...(packet.evidenceExecution.agenticLifecycle ? [
      "### Investigation lifecycle",
      `- Status: ${packet.evidenceExecution.agenticLifecycle.status.replaceAll("_", " ")}`,
      `- Goal check: ${packet.evidenceExecution.agenticLifecycle.finalAnswerStatus}`,
      `- Stop reason: ${packet.evidenceExecution.agenticLifecycle.stopReason}`,
      ...packet.evidenceExecution.agenticLifecycle.passes.map((pass) => `- Pass ${pass.iteration}: ${pass.selectedQueries.join(", ")} · ${pass.addedEvidenceCount} new evidence item(s) · answer ${pass.answerStatus}`),
      "",
    ] : []),
    "### Evidence items",
    ...packet.evidenceExecution.evidenceBundle.flatMap((item) => [
      `- ${item.metricId}: ${item.rawValue ?? "structured value"} ${item.unit ?? ""}`.trim(),
      `  - Evidence ID: ${item.evidenceId}`,
      `  - Source ID: ${item.sourceId}`,
      `  - Snapshot ID: ${item.snapshotId}`,
      `  - Evidence status: ${item.evidenceStatus}`,
      `  - Quality status: ${item.qualityStatus}`,
      `  - Period: ${item.period.label}`,
      `  - Report scope: ${item.reportScope ?? "Not supplied"}`,
      `  - Currency: ${item.currency ?? "Not applicable or not supplied"}`,
      `  - Allowed use: ${item.allowedUse}`,
      ...(item.warning ? [`  - Warning: ${item.warning}`] : []),
    ]),
    "",
    "### Quality warnings",
    bulletList(packet.evidenceExecution.qualityWarnings, "None listed"),
    "",
    "### Unknowns and guardrails",
    bulletList(packet.evidenceExecution.unknowns, "None listed"),
    "",
    bulletList(packet.evidenceExecution.guardrails, "None listed"),
    "",
  ] : [];
  const packetAnswerSections = [
    "## Evidence-backed answer",
    `- State: ${packet.packetAnswer.state}`,
    packet.packetAnswer.directAnswer,
    "",
    "### Source-backed facts",
    ...(packet.packetAnswer.facts.length ? packet.packetAnswer.facts.flatMap((fact) => [
      `- ${fact.geographyLabel}: ${fact.metricLabel} = ${fact.displayValue}`,
      `  - Period: ${fact.periodLabel}${fact.reportScope ? `; scope: ${fact.reportScope}` : ""}`,
      `  - Source: ${fact.sourceId}; evidence status: ${fact.evidenceStatus}`,
      ...(fact.warning ? [`  - Warning: ${fact.warning}`] : []),
    ]) : ["- No executed facts are available."]),
    "",
    "### Answer limitations",
    bulletList(packet.packetAnswer.limitations, "None listed"),
    "",
  ];

  return [
    "# Draft action packet (reviewable)",
    "",
    packet.reviewDisclaimer,
    "",
    "## Status",
    `- Packet status: ${packet.status.replaceAll("_", " ")}`,
    `- Packet kind: ${packet.packetKind.replaceAll("_", " ")}`,
    `- Packet version: ${packet.packetVersion}`,
    `- Plan version: ${packet.planVersion}`,
    `- Plan ID: ${packet.planId}`,
    `- Generated at: ${packet.generatedAt}`,
    `- Proposal method: ${packet.proposalMethod.replaceAll("_", " ")}`,
    "",
    "## Original question",
    packet.originalQuestion,
    `Perspective: ${packet.perspectiveId}`,
    "",
    "## Geographic focus",
    `- Mode: ${packet.geographicFocus.mode.replaceAll("_", " ")}`,
    `- Message: ${packet.geographicFocus.message}`,
    `- Selected CBSA codes: ${cbsa}`,
    `- Places: ${focusPlaces}`,
    "",
    "## Evidence boundary",
    packet.evidenceBoundary,
    "",
    ...packetAnswerSections,
    "## Missing evidence",
    bulletList(packet.missingEvidence, "None listed"),
    "",
    "## Missing approvals",
    bulletList(packet.missingApprovals, "None listed"),
    "",
    "## Calculation and evidence versions",
    `- Evaluation plan version: ${packet.calculationVersions.evaluationPlanVersion}`,
    `- Capability registry version: ${packet.calculationVersions.capabilityRegistryVersion}`,
    `- Capability: ${packet.calculationVersions.capabilityId}`,
    `- Result workspace: ${packet.calculationVersions.resultWorkspaceType}`,
    `- Evidence source IDs: ${packet.calculationVersions.evidenceSourceIds.join(", ") || "None declared"}`,
    `- Evidence snapshot IDs: ${packet.calculationVersions.evidenceSnapshotIds.join(", ") || "None declared"}`,
    `- Evidence query version: ${packet.calculationVersions.evidenceQueryVersion ?? "None declared"}`,
    `- Evidence calculation version: ${packet.calculationVersions.evidenceCalculationVersion ?? "None declared"}`,
    `- Execution mode: ${packet.calculationVersions.executionMode?.replaceAll("_", " ") ?? "None declared"}`,
    "",
    ...evidenceExecutionSections,
    ...(!packet.actionPlan && !packet.validationWorkplan ? [
      "## Proposed action",
      `- Title: ${action.title}`,
      `- Summary: ${action.summary}`,
      `- Owner: ${action.owner}`,
      `- Timing: ${action.timing}`,
      `- Confidence: ${action.confidence}`,
      `- Next step: ${action.nextStep}`,
      `- Output ID: ${action.outputId}`,
      `- Requires approval: ${action.requiresApproval ? "yes" : "no"}`,
      "",
      "### Evidence considered",
      bulletList(action.evidence, "None listed"),
      "",
      "### Tradeoffs",
      bulletList(action.tradeoffs, "None listed"),
      "",
    ] : []),
    ...validationWorkplanSections,
    ...actionPlanSections,
    ...answerContractSections,
    ...answerCoverageSections,
    ...answerEvaluationSections,
    ...finalAnswerSections,
    ...framingSections,
    ...evidencePlanningSections,
    ...reviewContextSections,
    ...analysisSections,
    "## Structured findings",
    ...packet.findings.flatMap((finding) => [
      `### ${finding.title}`,
      finding.detail,
      "",
    ]),
    "## Structured packet (JSON)",
    "```json",
    JSON.stringify(packet, null, 2),
    "```",
    "",
  ].join("\n");
}

function finalAnswerSection(
  packet: ReviewableActionPacket,
  sectionId: ReviewableActionPacket["finalAnswer"]["sections"][number]["sectionId"],
) {
  return packet.finalAnswer.sections.find((section) => section.sectionId === sectionId);
}

export function formatDecisionBriefDocument(packet: ReviewableActionPacket): string {
  const directAnswer = finalAnswerSection(packet, "direct_answer");
  const nextAction = finalAnswerSection(packet, "permitted_next_action");
  const owner = packet.actionPlan?.decisionOwner ?? packet.action.owner;
  const reviewDate = packet.actionPlan?.decisionDueDate ?? packet.action.timing;
  const recommendation = packet.actionPlan?.recommendation ?? packet.action.summary;
  const places = packet.geographicFocus.placeLabels.join("; ") || packet.geographicFocus.message;
  const coveragePercent = packet.answerCoverage.requiredCount
    ? Math.round((packet.answerCoverage.coveredRequiredCount / packet.answerCoverage.requiredCount) * 100)
    : 0;
  const isDecisionReady = packet.answerCoverage.overallStatus === "complete";
  const evidenceLabel = packet.analysisAppendix?.evidenceStage === "triangulated_finding"
    ? "Triangulated findings"
    : "Screening signals—not final findings";
  const selectedLead = packet.reviewContext?.selectedLeadId
    ? packet.analysisAppendix?.leads.find((lead) => lead.id === packet.reviewContext?.selectedLeadId)
    : packet.analysisAppendix?.leads[0];
  const orderedLeads = packet.analysisAppendix
    ? [
      ...(selectedLead ? [selectedLead] : []),
      ...packet.analysisAppendix.leads.filter((lead) => lead.id !== selectedLead?.id),
    ].slice(0, 4)
    : [];
  const unmetRequirements = packet.answerCoverage.domainCoverage
    .filter((item) => item.required && item.status !== "covered" && item.status !== "not_applicable")
    .slice(0, 5);
  const challengeNotes = Array.from(new Set([
    ...(selectedLead?.challenge ? [selectedLead.challenge] : []),
    ...(packet.analysisAppendix?.rejectedPatterns ?? []),
    ...(packet.analysisAppendix?.limitations ?? []),
  ])).slice(0, 4);
  const firstWorkstream = packet.actionPlan?.workstreams[0];
  const firstValidationWorkstream = packet.validationWorkplan?.workstreams[0];
  const sourceIds = packet.analysisAppendix?.sourceIds
    ?? packet.calculationVersions.evidenceSourceIds;
  const decisionStatus = isDecisionReady
    ? "Ready for accountable review"
    : "Research needed before a decision-level recommendation";
  const boundedRecommendation = isDecisionReady
    ? recommendation
    : `Do not treat the current ${packet.analysisAppendix?.evidenceStage === "signal" ? "screening signal" : "partial evidence"} as authorization for a material action. ${recommendation}`;

  return [
    `# Decision brief: ${packet.originalQuestion}`,
    "",
    `> **${decisionStatus}.** ${packet.reviewDisclaimer}`,
    "",
    "## Recommendation",
    boundedRecommendation,
    "",
    `- **Decision owner:** ${owner}`,
    `- **Review timing:** ${reviewDate}`,
    `- **Geography:** ${places}`,
    `- **Evidence coverage:** ${packet.answerCoverage.coveredRequiredCount} of ${packet.answerCoverage.requiredCount} required items (${coveragePercent}%)`,
    "",
    "## What the evidence supports",
    directAnswer?.content ?? packet.answerCoverage.permittedConclusion,
    "",
    ...(packet.analysisAppendix?.portfolioPattern ? [
      "## Portfolio pattern",
      `**${packet.analysisAppendix.portfolioPattern.headline}.**`,
      packet.analysisAppendix.portfolioPattern.summary,
      "",
      packet.analysisAppendix.portfolioPattern.implication,
      "",
    ] : []),
    ...(packet.analysisAppendix?.analystRevision ? [
      `## Draft ${packet.analysisAppendix.analystRevision.draftNumber} analyst revision`,
      `**Direction:** ${packet.analysisAppendix.analystRevision.prompt}`,
      "",
      `**What changed:** ${packet.analysisAppendix.analystRevision.summary}`,
      "",
      packet.analysisAppendix.analystRevision.effectOnRecommendation,
      "",
      `**Updated recommendation:** ${packet.analysisAppendix.analystRevision.recommendationUpdate}`,
      "",
      `**New evidence request:** ${packet.analysisAppendix.analystRevision.evidenceRequest}`,
      "",
      `**Recommended follow-up:** ${packet.analysisAppendix.analystRevision.recommendedFollowUp}`,
      "",
    ] : []),
    `## ${evidenceLabel}`,
    ...(orderedLeads.length ? orderedLeads.flatMap((lead) => [
      `### ${lead.title}`,
      `- **Observed:** ${lead.observation}`,
      `- **Why it matters:** ${lead.businessMeaning}`,
      `- **Interpretation boundary:** ${lead.challenge}`,
      "",
    ]) : ["No question-compatible regional finding was produced from the permitted evidence.", ""]),
    "## What is still unknown",
    ...(unmetRequirements.length
      ? unmetRequirements.map((item) => `- **${item.label}:** ${item.explanation}`)
      : ["- No required evidence gap remains in the answer contract."]),
    "",
    "## Checks that could change the conclusion",
    ...(challengeNotes.length ? challengeNotes.map((item) => `- ${item}`) : ["- No additional challenge was recorded."]),
    "",
    "## Recommended next action",
    ...(firstWorkstream ? [
      `**${firstWorkstream.title}**`,
      "",
      `- **Owner:** ${firstWorkstream.owner}`,
      `- **Due:** ${firstWorkstream.dueDate}`,
      `- **Action:** ${firstWorkstream.action}`,
      `- **Deliverable:** ${firstWorkstream.deliverable}`,
      `- **Done when:** ${firstWorkstream.completionCriteria}`,
      ...(firstWorkstream.kpi ? [`- **KPI:** ${firstWorkstream.kpi}`] : []),
      ...(firstWorkstream.validationThreshold ? [`- **Validation threshold:** ${firstWorkstream.validationThreshold}`] : []),
      ...(firstWorkstream.stopCondition ? [`- **Stop condition:** ${firstWorkstream.stopCondition}`] : []),
    ] : firstValidationWorkstream ? [
      `**${firstValidationWorkstream.title}**`,
      "",
      `- **Owner:** ${firstValidationWorkstream.owner}`,
      `- **Action:** ${firstValidationWorkstream.action}`,
      `- **Deliverable:** ${firstValidationWorkstream.deliverable}`,
      `- **Done when:** ${firstValidationWorkstream.completionCriteria}`,
      ...(firstValidationWorkstream.kpi ? [`- **KPI:** ${firstValidationWorkstream.kpi}`] : []),
      ...(firstValidationWorkstream.validationThreshold ? [`- **Validation threshold:** ${firstValidationWorkstream.validationThreshold}`] : []),
      ...(firstValidationWorkstream.stopCondition ? [`- **Stop condition:** ${firstValidationWorkstream.stopCondition}`] : []),
    ] : [
      nextAction?.content ?? `${packet.action.owner} should ${packet.action.nextStep}`,
      ...(packet.action.kpi ? [`- **KPI:** ${packet.action.kpi}`] : []),
      ...(packet.action.validationThreshold ? [`- **Validation threshold:** ${packet.action.validationThreshold}`] : []),
      ...(packet.action.stopCondition ? [`- **Stop condition:** ${packet.action.stopCondition}`] : []),
    ]),
    "",
    "## Evidence and review record",
    `- **Answer status:** ${packet.finalAnswer.status.replaceAll("_", " ")}`,
    `- **Strongest permitted conclusion:** ${packet.finalAnswer.strongestSupportedConclusion}`,
    `- **Sources:** ${sourceIds.join(", ") || "No governed source recorded"}`,
    `- **Snapshot:** ${packet.analysisAppendix ? `${packet.analysisAppendix.dataSnapshotLabel} (${packet.analysisAppendix.dataSnapshotVersion})` : "See audit appendix"}`,
    `- **Accountable reviewer:** ${packet.finalAnswer.reviewRequiredBy}`,
    "",
    "---",
    "The audit appendix contains the full answer contract, calculation method, coverage checks, limitations, source versions, and structured record.",
    "",
  ].join("\n");
}

export function reviewableActionPacketFilename(packet: ReviewableActionPacket): string {
  const stamp = packet.generatedAt.slice(0, 10);
  const slug = packet.action.id.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `draft-action-packet-${slug}-${stamp}.docx`;
}

export function decisionBriefFilename(packet: ReviewableActionPacket): string {
  const stamp = packet.generatedAt.slice(0, 10);
  const slug = packet.action.id.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `draft-decision-brief-${slug}-${stamp}.docx`;
}

function downloadBlob(blob: Blob, filename: string) {
  if (typeof document === "undefined") {
    throw new Error("Document download requires a browser document.");
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function downloadWordPacket(packet: ReviewableActionPacket, kind: "decision_brief" | "audit_appendix", filename: string) {
  const response = await fetch("/api/exports/docx", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ packet, kind }),
  });
  if (!response.ok) throw new Error("The Word report could not be generated.");
  downloadBlob(await response.blob(), filename);
}

export async function downloadDecisionBrief(packet: ReviewableActionPacket) {
  await downloadWordPacket(packet, "decision_brief", decisionBriefFilename(packet));
}

export async function downloadReviewableActionPacket(packet: ReviewableActionPacket) {
  await downloadWordPacket(packet, "audit_appendix", reviewableActionPacketFilename(packet));
}

export function deterministicFindingsAndProposalSummary(
  plan: EvaluationPlan,
  action: PlannedAction = proposedActionFromPlan(plan),
  evidenceExecution: EvidenceExecutionResponse | null = null,
): PacketFindingsSummary {
  const answer = buildPacketAnswer(plan, action, evidenceExecution);
  const factSummary = answer.facts.slice(0, 3).map((fact) => `${fact.geographyLabel} ${fact.metricLabel}: ${fact.displayValue} (${fact.periodLabel}, ${fact.sourceId})`).join("; ");
  const limitation = answer.limitations[0] ?? plan.evidenceBoundary;
  const evidenceStatement = factSummary ? `Executed evidence: ${factSummary}.` : answer.directAnswer;

  return packetFindingsSummarySchema.parse({
    title: "Findings and proposed action",
    draftOnlyNotice:
      "Draft summary for human review only. It restates the validated plan and proposed action packet and is not a final real-estate or business decision.",
    origin: "deterministic_fallback",
    state: "deterministic_fallback",
    modelVersion: null,
    promptVersion: PACKET_SUMMARY_PROMPT_VERSION,
    summary: `${evidenceStatement} Proposed next step: ${action.owner} should ${action.nextStep} Key limitation: ${limitation} This draft does not approve spend, leases, openings, campaigns, or other material actions.`.slice(0, 1400),
    evidenceIndicates: boundedSummaryText(evidenceStatement),
    whyActionRelevant: boundedSummaryText(`${action.title}: ${action.summary}`),
    ownerNextStep: boundedSummaryText(`${action.owner} should ${action.nextStep} Timing: ${action.timing}.`),
    remainsUnknown: boundedSummaryText(`Missing evidence: ${answer.limitations.join("; ") || plan.evidenceBoundary}`),
  });
}
