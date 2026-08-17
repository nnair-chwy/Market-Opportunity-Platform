import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { filterByMaturityWindow, parseCvcPerformanceCsv } from "../adapters/cvc-performance/index.ts";
import {
  evidenceExecutionResponseSchema,
  type EvidenceExecutionResponse,
  type ExecutionEvidenceItem,
} from "../evidence-snapshot/contracts.ts";
import { executeEvidenceRequest, type EvidenceExecutionOptions } from "../evidence-snapshot/execute.ts";
import { loadSourceStatus, sourceFamily } from "../evidence-snapshot/source-status.ts";
import {
  DEMO_SNAPSHOT_VERSION,
  PHOENIX_DEMO_MARKET,
  SYNTHETIC_CLINIC_PERFORMANCE_SCENARIO,
} from "../demo/scenarios.ts";
import { publicMarkets } from "../data/public-market-ui.ts";
import { evaluationPlanSchema, type EvaluationPlan } from "./contracts.ts";
import { executeEvaluationPlan } from "./execution.ts";

export const PLAN_EXECUTION_QUERY_VERSION = "plan-evidence-dispatch-v1" as const;
export const PLAN_EXECUTION_CALCULATION_VERSION = "evidence-bundle-composition-v1" as const;

export const evaluationPlanExecutionRequestSchema = z.object({
  requestId: z.string().trim().min(1).max(160),
  plan: evaluationPlanSchema,
}).strict();

export type PlanExecutionOptions = EvidenceExecutionOptions & {
  requestedAt?: string;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function queryForCapability(capability: EvaluationPlan["capabilityId"]): EvidenceExecutionResponse["query"] {
  if (capability === "clinic_performance") return "clinic_performance_bundle";
  if (capability === "clinic_site_evaluation") return "clinic_site_evidence_bundle";
  if (capability === "local_growth_test") return "growth_test_bundle";
  return "market_context_bundle";
}

function responseBase(plan: EvaluationPlan, requestId: string, executionMode: EvidenceExecutionResponse["executionMode"]) {
  return {
    requestId,
    snapshotVersion: DEMO_SNAPSHOT_VERSION,
    queryVersion: PLAN_EXECUTION_QUERY_VERSION,
    calculationVersion: PLAN_EXECUTION_CALCULATION_VERSION,
    query: queryForCapability(plan.capabilityId),
    componentQueries: [] as EvidenceExecutionResponse["componentQueries"],
    capability: plan.capabilityId,
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    geographyIds: plan.geographyResolution.selectedCbsaCodes.map((code) => `cbsa:${code}`),
    missingApprovals: [...plan.missingApprovals],
    guardrails: [plan.evidenceBoundary],
    executionMode,
    errorCode: null,
    errorMessage: null,
  };
}

function blocked(plan: EvaluationPlan, requestId: string, reason: string): EvidenceExecutionResponse {
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(plan, requestId, "frozen_snapshot_demo"),
    status: "blocked",
    rows: [],
    evidenceBundle: [],
    sourceIds: [],
    qualityWarnings: ["No registered evidence query was executed."],
    missingEvidence: unique([...plan.missingEvidence, reason]),
    unknowns: [],
    allowedUse: "none",
    sensitivity: "internal",
  });
}

function failedFromComponent(plan: EvaluationPlan, component: EvidenceExecutionResponse): EvidenceExecutionResponse {
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(plan, component.requestId, component.executionMode),
    status: "failed",
    componentQueries: component.componentQueries,
    rows: [],
    evidenceBundle: [],
    sourceIds: component.sourceIds,
    qualityWarnings: component.qualityWarnings,
    missingEvidence: component.missingEvidence,
    unknowns: component.unknowns,
    allowedUse: "none",
    sensitivity: component.sensitivity,
    errorCode: component.errorCode ?? "COMPONENT_QUERY_FAILED",
    errorMessage: component.errorMessage ?? "A registered component query failed.",
  });
}

function blockedFromComponent(plan: EvaluationPlan, requestId: string, component: EvidenceExecutionResponse, reason: string): EvidenceExecutionResponse {
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(plan, requestId, component.executionMode),
    status: "blocked",
    componentQueries: component.componentQueries,
    rows: [],
    evidenceBundle: [],
    sourceIds: component.sourceIds,
    qualityWarnings: component.qualityWarnings,
    missingEvidence: unique([...plan.missingEvidence, ...component.missingEvidence, reason]),
    unknowns: component.unknowns,
    allowedUse: component.allowedUse,
    sensitivity: component.sensitivity,
    errorCode: null,
    errorMessage: null,
  });
}

function lowLevelRequest(plan: EvaluationPlan, requestId: string, query: "canonical_market_evidence" | "canonical_clinic_performance", marketId: string) {
  return {
    requestId,
    snapshotVersion: DEMO_SNAPSHOT_VERSION,
    questionId: plan.planId,
    planId: plan.planId,
    requestedAt: "2026-08-17T00:00:00.000Z",
    executionMode: "frozen_snapshot_demo" as const,
    query,
    parameters: { marketId },
  } as const;
}

function publicMarketEvidence(plan: EvaluationPlan): { evidence: ExecutionEvidenceItem[]; rows: Record<string, unknown>[]; warnings: string[] } {
  const publicPlan = evaluationPlanSchema.parse({
    ...plan,
    intent: { ...plan.intent, requestedMeasure: "total_population" },
    capabilityId: "census_market_context",
    status: "executable",
  });
  const execution = executeEvaluationPlan(publicPlan, publicMarkets);
  return {
    evidence: execution.evidenceBundle.map((item) => ({
      evidenceId: item.evidenceId,
      metricId: item.metricId,
      geographyId: `cbsa:${item.geographyId}`,
      geographyLabel: item.geographyLabel,
      rawValue: item.rawValue,
      structuredValue: null,
      unit: item.unit,
      sourceId: item.sourceId,
      snapshotId: item.snapshotId,
      evidenceStatus: item.evidenceStatus,
      qualityStatus: item.qualityStatus,
      observationStart: item.observationStart,
      observationEnd: item.observationEnd,
      allowedUse: item.allowedUse,
      sensitivity: item.sensitivity,
      warning: item.warning,
      origin: "public_context" as const,
    })),
    rows: execution.comparisons.map((item) => ({ ...item, contextOnly: true })),
    warnings: execution.warnings,
  };
}

async function marketContextBundle(plan: EvaluationPlan, requestId: string, options: PlanExecutionOptions): Promise<EvidenceExecutionResponse> {
  const marketId = `cbsa:${plan.geographyResolution.selectedCbsaCodes[0]}`;
  const component = await executeEvidenceRequest(lowLevelRequest(plan, `${requestId}:market`, "canonical_market_evidence", marketId), options);
  if (component.status === "failed") return failedFromComponent(plan, component);
  if (component.status === "blocked") return blocked(plan, requestId, component.missingEvidence.join(" "));
  const publicContext = publicMarketEvidence(plan);
  const snapshotDir = resolve(options.snapshotDir ?? ".local-data/clinic-market-snapshot");
  const sources = await loadSourceStatus(snapshotDir);
  const seo = sourceFamily(sources, "seo");
  const pricing = sourceFamily(sources, "pricing");
  const competitor = sourceFamily(sources, "competitor");
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(plan, requestId, "frozen_snapshot_demo"),
    status: "partial",
    componentQueries: ["canonical_market_evidence"],
    rows: [...component.rows, ...publicContext.rows],
    evidenceBundle: [...component.evidenceBundle, ...publicContext.evidence],
    sourceIds: unique([...component.sourceIds, ...publicContext.evidence.map((item) => item.sourceId)]),
    qualityWarnings: unique([...component.qualityWarnings, ...publicContext.warnings]),
    missingEvidence: unique([
      ...component.missingEvidence,
      `SEO is ${seo.status} and is not available as regional evidence.`,
      `Pricing data is ${pricing.status} in the registered snapshot.`,
      `Competitor data is ${competitor.status} in the registered snapshot.`,
    ]),
    unknowns: unique([...component.unknowns, "Customer counts and Census context do not establish clinic demand, competitive intensity, price response, or causal growth opportunity."]),
    allowedUse: "market_context_and_approved_internal_descriptive_context_only",
    sensitivity: "internal",
    errorCode: null,
    errorMessage: null,
  });
}

async function syntheticClinicPerformanceBundle(plan: EvaluationPlan, requestId: string): Promise<EvidenceExecutionResponse> {
  if (plan.planId !== "plan-demo-clinic-performance-synthetic") return blocked(plan, requestId, "No approved peer group and outcome configuration was supplied for this clinic-performance question.");
  const csv = await readFile(new URL("../../data/fixtures/cvc-performance/aggregate-performance.synthetic.csv", import.meta.url), "utf8");
  const imported = parseCvcPerformanceCsv(csv);
  const scenario = SYNTHETIC_CLINIC_PERFORMANCE_SCENARIO;
  const outcomeRows = imported.records.filter((row) => row.metric_id === scenario.metricId && scenario.peerClinicIds.includes(row.business_id as typeof scenario.peerClinicIds[number]));
  const maturity = filterByMaturityWindow(outcomeRows, { minimumWeeksSinceOpening: scenario.weeksSinceOpening, maximumWeeksSinceOpening: scenario.weeksSinceOpening, version: "synthetic-exact-38-weeks-v1" });
  const ordered = [...maturity.included].sort((left, right) => right.aggregate_value - left.aggregate_value || left.business_id.localeCompare(right.business_id));
  if (ordered.length !== scenario.peerClinicIds.length) return blocked(plan, requestId, "The checked-in synthetic fixture does not contain the complete configured peer group at the shared maturity point.");
  const rows = ordered.map((row, index) => ({
    clinicId: row.business_id,
    clinicName: row.clinic_name,
    selected: row.business_id === scenario.selectedClinicId,
    metricId: row.metric_id,
    value: row.aggregate_value,
    unit: row.unit,
    weeksSinceOpening: row.weeks_since_opening,
    rank: index + 1,
    percentile: ordered.length === 1 ? 50 : ((ordered.length - 1 - index) / (ordered.length - 1)) * 100,
    evidenceStatus: "Hypothesis",
  }));
  const evidenceBundle: ExecutionEvidenceItem[] = ordered.map((row, index) => ({
    evidenceId: `synthetic-clinic-performance:${row.business_id}:${scenario.metricId}`,
    metricId: `synthetic.clinic_performance.${scenario.metricId}`,
    geographyId: row.business_id,
    geographyLabel: row.clinic_name,
    rawValue: row.aggregate_value,
    structuredValue: { rank: index + 1, peerCount: ordered.length, weeksSinceOpening: row.weeks_since_opening, selected: row.business_id === scenario.selectedClinicId },
    unit: row.unit,
    sourceId: row.source_id,
    snapshotId: scenario.scenarioId,
    evidenceStatus: "Hypothesis",
    qualityStatus: row.quality_status,
    observationStart: row.observation_window_start,
    observationEnd: row.observation_window_end,
    allowedUse: "synthetic_prototype_only",
    sensitivity: "internal",
    warning: row.quality_status === "warning" ? "The synthetic source row carries a warning quality status." : null,
    origin: "synthetic_demo_fixture",
  }));
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(plan, requestId, "synthetic_demo"),
    calculationVersion: scenario.calculationVersion,
    geographyIds: [...scenario.peerClinicIds],
    status: "partial",
    componentQueries: ["canonical_clinic_performance"],
    rows,
    evidenceBundle,
    sourceIds: unique(evidenceBundle.map((item) => item.sourceId)),
    qualityWarnings: unique([
      ...imported.findings.map((item) => item.message),
      ...maturity.findings.map((item) => item.message),
      "This is an illustrative ranking from a checked-in synthetic fixture, not an approved production comparison.",
    ]),
    missingEvidence: unique([...plan.missingEvidence, "An approved real clinic comparison remains unavailable at the browser and AI response boundary."]),
    unknowns: ["The synthetic rank does not establish how the selected clinic performs in the real portfolio or whether the cohort is operationally comparable."],
    allowedUse: "synthetic_prototype_only",
    sensitivity: "internal",
    guardrails: unique([...responseBase(plan, requestId, "synthetic_demo").guardrails, "Do not use this illustrative rank for personnel, operating, investment, or site decisions."]),
    errorCode: null,
    errorMessage: null,
  });
}

async function growthTestBundle(plan: EvaluationPlan, requestId: string, options: PlanExecutionOptions): Promise<EvidenceExecutionResponse> {
  if (plan.planId !== "plan-demo-growth-test-phoenix") return blocked(plan, requestId, "No registered frozen-snapshot growth-test scenario matches this question.");
  const marketId = PHOENIX_DEMO_MARKET.marketId;
  const market = await executeEvidenceRequest(lowLevelRequest(plan, `${requestId}:market`, "canonical_market_evidence", marketId), options);
  if (market.status === "failed") return failedFromComponent(plan, market);
  const ads = await executeEvidenceRequest({
    requestId: `${requestId}:ads`, snapshotVersion: DEMO_SNAPSHOT_VERSION, questionId: plan.planId, planId: plan.planId,
    requestedAt: options.requestedAt ?? "2026-08-17T00:00:00.000Z", executionMode: "frozen_snapshot_demo",
    query: "google_ads_matched_location_context", parameters: {},
  }, options);
  const groupedAds = ads.status === "failed" ? [] : [...new Set(ads.rows.map((row) => String(row.reportScope)))].sort().map((reportScope) => {
    const rows = ads.rows.filter((row) => String(row.reportScope) === reportScope);
    const sourceId = String(rows[0]?.sourceId ?? "GOOGLE-ADS-MATCHED-LOCATIONS-UNKNOWN");
    return {
      evidenceId: `google-ads-inventory:${reportScope}`,
      metricId: "google_ads.matched_location_observation_count",
      geographyId: null,
      geographyLabel: "Unjoined matched-location inventory",
      rawValue: rows.length,
      structuredValue: { reportScope, stableGeographyId: null, marketJoinEligibility: "blocked_missing_stable_geography_id" },
      unit: "matched_location_observations",
      sourceId,
      snapshotId: String(rows[0]?.snapshotId ?? DEMO_SNAPSHOT_VERSION),
      evidenceStatus: "Derived" as const,
      qualityStatus: "warning" as const,
      observationStart: rows.length ? String(rows[0]?.observationStart ?? "") : null,
      observationEnd: rows.length ? String(rows[0]?.observationEnd ?? "") : null,
      allowedUse: "matched_location_descriptive_context_only",
      sensitivity: "internal" as const,
      warning: "This inventory is not joined to Phoenix or any CBSA and cannot support regional ranking.",
      origin: "frozen_csv_snapshot" as const,
    };
  });
  const evidenceBundle = [...market.evidenceBundle, ...groupedAds];
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(plan, requestId, "frozen_snapshot_demo"),
    status: "partial",
    componentQueries: ["canonical_market_evidence", "google_ads_matched_location_context"],
    rows: market.rows,
    evidenceBundle,
    sourceIds: unique([...market.sourceIds, ...groupedAds.map((item) => item.sourceId)]),
    qualityWarnings: unique([...market.qualityWarnings, ...ads.qualityWarnings, ...groupedAds.map((item) => item.warning)]),
    missingEvidence: unique([...plan.missingEvidence, ...market.missingEvidence, ...ads.missingEvidence]),
    unknowns: unique([...market.unknowns, ...ads.unknowns, "No causal claim can be made until a pre-period baseline, control design, exposure definition, outcome definition, and contamination checks are approved."]),
    allowedUse: "regional_descriptive_context_and_unjoined_matched_location_context_only",
    sensitivity: "internal",
    guardrails: unique([...responseBase(plan, requestId, "frozen_snapshot_demo").guardrails, "Do not launch or rank regions from this bundle. Require approved test, control, measurement, budget, privacy, and stop conditions first."]),
    errorCode: null,
    errorMessage: null,
  });
}

async function clinicSiteBundle(plan: EvaluationPlan, requestId: string, options: PlanExecutionOptions): Promise<EvidenceExecutionResponse> {
  const code = plan.geographyResolution.selectedCbsaCodes[0];
  if (!code) return blocked(plan, requestId, "An exact CBSA is required before local clinic evidence retrieval.");
  const component = await executeEvidenceRequest(lowLevelRequest(plan, `${requestId}:clinic-site`, "canonical_clinic_performance", `cbsa:${code}`), options);
  if (component.status === "failed") return failedFromComponent(plan, component);
  return blockedFromComponent(plan, requestId, component, "The clinic evidence route cannot expose an approved aggregate result or produce a final site decision.");
}

export async function executeEvaluationPlanEvidence(input: unknown, options: PlanExecutionOptions = {}): Promise<EvidenceExecutionResponse> {
  const { requestId, plan } = evaluationPlanExecutionRequestSchema.parse(input);
  if (plan.status === "blocked") return blocked(plan, requestId, "The validated evaluation plan is blocked and was not executed.");
  if (["clarification", "unavailable", "needs_selection"].includes(plan.geographyResolution.mode)) return blocked(plan, requestId, "Resolve an exact supported geography before execution.");
  if (plan.capabilityId === "census_market_context") return marketContextBundle(plan, requestId, options);
  if (plan.capabilityId === "clinic_performance") return syntheticClinicPerformanceBundle(plan, requestId);
  if (plan.capabilityId === "local_growth_test") return growthTestBundle(plan, requestId, options);
  return clinicSiteBundle(plan, requestId, options);
}
