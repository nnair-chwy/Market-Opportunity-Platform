import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { filterByMaturityWindow, parseCvcPerformanceCsv } from "../adapters/cvc-performance/index.ts";
import {
  evidenceExecutionResponseSchema,
  type EvidencePeriod,
  type EvidenceExecutionResponse,
  type ExecutionEvidenceItem,
} from "../evidence-snapshot/contracts.ts";
import { executeEvidenceRequest, type EvidenceExecutionOptions } from "../evidence-snapshot/execute.ts";
import { loadSourceStatus, sourceFamily } from "../evidence-snapshot/source-status.ts";
import { DEFAULT_NORMALIZED_SNAPSHOT_VERSION, type NormalizedQueryRequest, type NormalizedQueryResponse } from "../data-normalization/contracts.ts";
import { queryNormalizedMarketData } from "../data-normalization/query.ts";
import {
  DEMO_SNAPSHOT_VERSION,
  PHOENIX_DEMO_MARKET,
  SYNTHETIC_CLINIC_PERFORMANCE_SCENARIO,
} from "../demo/scenarios.ts";
import { publicMarkets } from "../data/public-market-ui.ts";
import { evaluationPlanSchema, type EvaluationPlan } from "./contracts.ts";
import { executeEvaluationPlan } from "./execution.ts";
import { METRIC_CATALOG, metricsForSourceFamilies } from "./metric-catalog.ts";

export const PLAN_EXECUTION_QUERY_VERSION = "plan-evidence-dispatch-v1" as const;
export const PLAN_EXECUTION_CALCULATION_VERSION = "evidence-bundle-composition-v1" as const;

export const evaluationPlanExecutionRequestSchema = z.object({
  requestId: z.string().trim().min(1).max(160),
  plan: evaluationPlanSchema,
}).strict();

export type PlanExecutionOptions = EvidenceExecutionOptions & {
  requestedAt?: string;
  normalizedSnapshotDir?: string;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function queryForPlan(plan: EvaluationPlan): EvidenceExecutionResponse["query"] {
  if (plan.intent.topic === "source_coverage") return "source_coverage_bundle";
  if (plan.intent.topic === "growth_test_screening") return "growth_test_screening_bundle";
  if (plan.intent.topic === "multi_market_comparison") return "multi_market_comparison_bundle";
  if (plan.intent.topic === "clinic_location" && plan.intent.selectedQueries.length) return "clinic_location_evidence_bundle";
  if (plan.intent.selectedQueries.length) return "normalized_evidence_bundle";
  if (plan.capabilityId === "clinic_performance") return "clinic_performance_bundle";
  if (plan.capabilityId === "clinic_site_evaluation") return "clinic_site_evidence_bundle";
  if (plan.capabilityId === "local_growth_test") return "growth_test_bundle";
  return "market_context_bundle";
}

function responseBase(plan: EvaluationPlan, requestId: string, executionMode: EvidenceExecutionResponse["executionMode"]) {
  return {
    requestId,
    snapshotVersion: DEMO_SNAPSHOT_VERSION,
    queryVersion: PLAN_EXECUTION_QUERY_VERSION,
    calculationVersion: PLAN_EXECUTION_CALCULATION_VERSION,
    query: queryForPlan(plan),
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
      period: item.observationStart && item.observationEnd
        ? { kind: "date_range" as const, start: item.observationStart.slice(0, 10), end: item.observationEnd.slice(0, 10), label: `${item.observationStart.slice(0, 10)} to ${item.observationEnd.slice(0, 10)}` }
        : item.observationEnd
          ? { kind: "as_of" as const, start: null, end: item.observationEnd.slice(0, 10), label: `As of ${item.observationEnd.slice(0, 10)}` }
          : { kind: "not_provided" as const, start: null, end: null, label: "Period not provided" },
      reportScope: null,
      currency: item.unit === "USD" ? "USD" : null,
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
    period: { kind: "date_range", start: row.observation_window_start, end: row.observation_window_end, label: `${row.observation_window_start} to ${row.observation_window_end}` },
    reportScope: "synthetic clinic peer comparison",
    currency: null,
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
    missingEvidence: unique([...plan.missingEvidence, "The supplied aggregate clinic files do not contain completed appointments by clinic at the configured shared 38-week maturity point."]),
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
  let normalizedAds: Awaited<ReturnType<typeof queryNormalizedMarketData>> | null = null;
  try {
    normalizedAds = await queryNormalizedMarketData({ requestId: `${requestId}:normalized-ads`, snapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION, query: "google_ads_context_by_cbsa", cbsaCode: PHOENIX_DEMO_MARKET.cbsaCode }, { snapshotDir: options.normalizedSnapshotDir });
  } catch {
    normalizedAds = null;
  }
  const inferredAds = normalizedAds?.rows.map((row) => ({
    evidenceId: `google-ads-inferred:${String(row.reportScope)}`,
    metricId: "google_ads.inferred_cbsa_spend",
    geographyId: PHOENIX_DEMO_MARKET.marketId,
    geographyLabel: PHOENIX_DEMO_MARKET.cbsaName,
    rawValue: typeof row.spend === "number" ? row.spend : null,
    structuredValue: row,
    unit: String(row.currency ?? "currency_units"),
    sourceId: String(row.sourceId ?? "GOOGLE-ADS-MATCHED-LOCATIONS-UNKNOWN"),
    snapshotId: normalizedAds!.snapshotVersion,
    evidenceStatus: "Hypothesis" as const,
    qualityStatus: "warning" as const,
    observationStart: typeof row.observationStart === "string" ? row.observationStart : null,
    observationEnd: typeof row.observationEnd === "string" ? row.observationEnd : null,
    period: {
      kind: "date_range" as const,
      start: String(row.observationStart).slice(0, 10),
      end: String(row.observationEnd).slice(0, 10),
      label: `${String(row.observationStart).slice(0, 10)} to ${String(row.observationEnd).slice(0, 10)}`,
    },
    reportScope: String(row.reportScope),
    currency: typeof row.currency === "string" ? row.currency : null,
    allowedUse: "local_demo_inferred_regional_context",
    sensitivity: "internal" as const,
    warning: "Phoenix is inferred from the Google Ads display label using Census geography context; this is not a provider-stable geography join.",
    origin: "frozen_csv_snapshot" as const,
  })) ?? [];
  const hasNormalizedAds = inferredAds.length > 0;
  const groupedAds = hasNormalizedAds ? inferredAds : ads.status === "failed" ? [] : [...new Set(ads.rows.map((row) => String(row.reportScope)))].sort().map((reportScope) => {
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
      period: rows.length
        ? { kind: "date_range" as const, start: String(rows[0]?.observationStart).slice(0, 10), end: String(rows[0]?.observationEnd).slice(0, 10), label: `${String(rows[0]?.observationStart).slice(0, 10)} to ${String(rows[0]?.observationEnd).slice(0, 10)}` }
        : { kind: "not_provided" as const, start: null, end: null, label: "Period not provided" },
      reportScope,
      currency: typeof rows[0]?.currency === "string" ? rows[0].currency : null,
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
    componentQueries: ["canonical_market_evidence", hasNormalizedAds ? "google_ads_context_by_cbsa" : "google_ads_matched_location_context"],
    rows: [...market.rows, ...(normalizedAds?.rows ?? [])],
    evidenceBundle,
    sourceIds: unique([...market.sourceIds, ...groupedAds.map((item) => item.sourceId)]),
    qualityWarnings: unique([...market.qualityWarnings, ...ads.qualityWarnings, ...(normalizedAds?.warnings ?? []), ...groupedAds.map((item) => item.warning)]),
    missingEvidence: unique([...plan.missingEvidence, ...market.missingEvidence, ...(hasNormalizedAds ? [] : ads.missingEvidence)]),
    unknowns: unique([...market.unknowns, ...(hasNormalizedAds ? ["The inferred Google Ads-to-CBSA relationship has not been validated against provider-stable geography IDs."] : ads.unknowns), "No causal claim can be made until a pre-period baseline, control design, exposure definition, outcome definition, and contamination checks are approved."]),
    allowedUse: hasNormalizedAds ? "regional_descriptive_context_and_inferred_google_ads_demo_context" : "regional_descriptive_context_and_unjoined_matched_location_context_only",
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
  if (component.status === "blocked") return blockedFromComponent(plan, requestId, component, "The configured snapshot does not contain a browser-eligible clinic aggregate.");
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(plan, requestId, component.executionMode),
    status: "partial",
    componentQueries: component.componentQueries,
    rows: component.rows,
    evidenceBundle: component.evidenceBundle,
    sourceIds: component.sourceIds,
    qualityWarnings: unique([...component.qualityWarnings, "Clinic data is shown only as an internal aggregate for the local demo."]),
    missingEvidence: unique([...plan.missingEvidence, ...component.missingEvidence]),
    unknowns: unique([...component.unknowns, "Aggregate clinic context does not establish site suitability or explain performance causally."]),
    allowedUse: "local_demo_aggregate_decision_support",
    sensitivity: "internal",
    guardrails: unique([...responseBase(plan, requestId, component.executionMode).guardrails, "Do not expose raw clinic rows or use this aggregate as a final site or operating decision."]),
    errorCode: null,
    errorMessage: null,
  });
}

function evidenceStatus(value: unknown): ExecutionEvidenceItem["evidenceStatus"] {
  return ["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"].includes(String(value))
    ? value as ExecutionEvidenceItem["evidenceStatus"]
    : "Derived";
}

function qualityStatus(value: unknown): ExecutionEvidenceItem["qualityStatus"] {
  return ["accepted", "valid", "warning", "rejected", "unknown"].includes(String(value))
    ? value as ExecutionEvidenceItem["qualityStatus"]
    : "accepted";
}

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedPeriod(row: Record<string, unknown>): EvidencePeriod {
  const start = typeof row.observationStart === "string" ? row.observationStart.slice(0, 10) : null;
  const end = typeof row.observationEnd === "string" ? row.observationEnd.slice(0, 10) : null;
  if (start && end) return { kind: "date_range", start, end, label: `${start} to ${end}` };
  const observedAt = typeof row.observedAt === "string" ? row.observedAt.slice(0, 10) : null;
  const reportingDate = typeof row.reportingDate === "string" ? row.reportingDate.slice(0, 10) : null;
  const asOf = observedAt ?? reportingDate;
  if (asOf) return { kind: "as_of", start: null, end: asOf, label: `As of ${asOf}` };
  const year = Number(row.year);
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    return { kind: "calendar_year", start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) };
  }
  if (typeof row.timeframe === "string" && row.timeframe.trim()) {
    return { kind: "timeframe", start: null, end: null, label: row.timeframe.trim() };
  }
  return { kind: "not_provided", start: null, end: null, label: "Period not provided" };
}

function sourceFamiliesForResponse(response: NormalizedQueryResponse) {
  if (response.query === "regional_context_by_cbsa") return new Set(["census", "regional"]);
  if (response.query === "clinic_context_by_cbsa") return new Set(["clinic"]);
  if (response.query === "google_ads_context_by_cbsa") return new Set(["google_ads"]);
  return new Set<string>();
}

function evidenceForNormalizedRows(plan: EvaluationPlan, response: NormalizedQueryResponse): ExecutionEvidenceItem[] {
  const responseFamilies = sourceFamiliesForResponse(response);
  const requested = plan.intent.requestedMetrics.filter((metric) => {
    const definition = METRIC_CATALOG[metric];
    return definition && responseFamilies.has(definition.sourceFamily);
  });
  const metrics = requested.length
    ? requested
    : metricsForSourceFamilies([...responseFamilies] as Array<"census" | "regional" | "clinic" | "google_ads">);
  const items: ExecutionEvidenceItem[] = [];
  for (const metric of metrics) {
    const definition = METRIC_CATALOG[metric];
    if (!definition) continue;
    const canonicalEvidenceType = definition.preferredEvidenceTypes.find((evidenceType) => response.rows.some((row) => {
      const rowType = typeof row.evidenceType === "string" ? row.evidenceType : "google_ads_context";
      return rowType === evidenceType && definition.fields.some((field) => numericValue(row[field]) !== null);
    }));
    response.rows.forEach((row, rowIndex) => {
      const rowType = typeof row.evidenceType === "string" ? row.evidenceType : "google_ads_context";
      if (canonicalEvidenceType && rowType !== canonicalEvidenceType) return;
      const field = definition.fields.find((candidate) => numericValue(row[candidate]) !== null);
      if (!field) return;
      const sourceId = typeof row.sourceId === "string" ? row.sourceId : response.sourceIds[0] ?? "NORMALIZED-MARKET-DATA";
      const cbsaCode = String(row.cbsaCode ?? response.cbsaCode ?? "unknown");
      const period = normalizedPeriod(row);
      const suffix = [rowType, period.label, row.reportScope, rowIndex].filter((value) => value !== null && value !== undefined).join(":");
      items.push({
        evidenceId: `normalized:${response.query}:${cbsaCode}:${metric}:${suffix}`,
        metricId: `normalized.${metric}`,
        geographyId: cbsaCode === "unknown" ? null : `cbsa:${cbsaCode}`,
        geographyLabel: String(row.cbsaName ?? cbsaCode),
        rawValue: numericValue(row[field]),
        structuredValue: row,
        unit: definition.unit,
        sourceId,
        snapshotId: response.snapshotVersion,
        evidenceStatus: evidenceStatus(row.evidenceStatus),
        qualityStatus: qualityStatus(row.qualityStatus ?? row.sourceQualityStatus),
        observationStart: period.start,
        observationEnd: period.end,
        period,
        reportScope: typeof row.reportScope === "string" ? row.reportScope : null,
        currency: typeof row.currency === "string" ? row.currency : null,
        allowedUse: typeof row.allowedUse === "string" ? row.allowedUse : response.allowedUse,
        sensitivity: row.sensitivity === "public" ? "public" : "internal",
        warning: typeof row.warning === "string" ? row.warning : null,
        origin: "frozen_csv_snapshot",
      });
    });
  }
  return items;
}

function sortComparisonRows(plan: EvaluationPlan, rows: Array<Record<string, unknown>>) {
  if (!plan.intent.sort) return rows;
  const direction = plan.intent.sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = typeof left.value === "number" ? left.value : null;
    const rightValue = typeof right.value === "number" ? right.value : null;
    if (leftValue === null && rightValue === null) return String(left.cbsaCode).localeCompare(String(right.cbsaCode));
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    return (leftValue - rightValue) * direction || String(left.cbsaCode).localeCompare(String(right.cbsaCode));
  });
}

async function normalizedEvidenceBundle(plan: EvaluationPlan, requestId: string, options: PlanExecutionOptions): Promise<EvidenceExecutionResponse> {
  const selectedQueries = plan.intent.selectedQueries as NormalizedQueryRequest["query"][];
  const requests: Array<{ code?: string; query: NormalizedQueryRequest["query"] }> = [];
  for (const query of selectedQueries) {
    if (["supported_regions", "normalization_coverage", "growth_test_screening"].includes(query)) requests.push({ query });
    else for (const code of plan.geographyResolution.selectedCbsaCodes) requests.push({ query, code });
  }
  const responses = await Promise.all(requests.map(({ query, code }, index) => queryNormalizedMarketData({
    requestId: `${requestId}:normalized:${index}`,
    snapshotVersion: DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
    query,
    ...(code ? { cbsaCode: code } : {}),
  }, { snapshotDir: options.normalizedSnapshotDir })));

  if (plan.intent.topic === "growth_test_screening") {
    const screening = responses[0];
    const topRows = screening?.rows ?? [];
    const evidenceBundle: ExecutionEvidenceItem[] = topRows.slice(0, 10).map((row) => ({
      evidenceId: `growth-screening:${String(row.cbsaCode)}`,
      metricId: "growth_test_screening.score",
      geographyId: `cbsa:${String(row.cbsaCode)}`,
      geographyLabel: String(row.cbsaName),
      rawValue: Number(row.score),
      structuredValue: row,
      unit: "score_0_to_100",
      sourceId: String(row.sourceIds).split(",")[0] || "NORMALIZED-MARKET-DATA",
      snapshotId: screening.snapshotVersion,
      evidenceStatus: "Hypothesis",
      qualityStatus: "warning",
      observationStart: "2024-01-01",
      observationEnd: "2026-08-16",
      period: { kind: "date_range", start: "2024-01-01", end: "2026-08-16", label: "2024-01-01 to 2026-08-16" },
      reportScope: "growth-test-screening-v1",
      currency: null,
      allowedUse: "local_demo_growth_test_screening_only",
      sensitivity: "internal",
      warning: "Hypothesis-only complete-case screening. This is not a market recommendation or causal result.",
      origin: "frozen_csv_snapshot",
    }));
    return evidenceExecutionResponseSchema.parse({
      ...responseBase(plan, requestId, "frozen_snapshot_demo"),
      snapshotVersion: screening.snapshotVersion,
      calculationVersion: String(screening.metadata.screeningVersion ?? screening.calculationVersion),
      status: "partial",
      componentQueries: ["growth_test_screening"],
      rows: topRows,
      evidenceBundle,
      sourceIds: unique(topRows.flatMap((row) => String(row.sourceIds ?? "").split(","))),
      qualityWarnings: screening.warnings,
      missingEvidence: [],
      unknowns: [`${String(screening.metadata.excludedMarketCount ?? 0)} markets were excluded for missing configured inputs.`, "A high screening score does not establish incrementality, feasibility, test validity, or launch readiness."],
      allowedUse: "local_demo_growth_test_screening_only",
      sensitivity: "internal",
      guardrails: unique([...responseBase(plan, requestId, "frozen_snapshot_demo").guardrails, "Do not use this screening rank to authorize campaign launch, spend, clinic opening, or a causal claim."]),
      errorCode: null,
      errorMessage: null,
    });
  }

  let evidenceBundle = responses.flatMap((response) => evidenceForNormalizedRows(plan, response));
  let rows: Array<Record<string, unknown>> = evidenceBundle.map((item) => ({
    cbsaCode: item.geographyId?.replace("cbsa:", "") ?? null,
    cbsaName: item.geographyLabel,
    metricId: item.metricId.replace("normalized.", ""),
    value: item.rawValue,
    unit: item.unit,
    period: item.period,
    reportScope: item.reportScope,
    currency: item.currency,
    evidenceStatus: item.evidenceStatus,
    qualityStatus: item.qualityStatus,
    sourceId: item.sourceId,
    warning: item.warning,
  }));
  if (plan.intent.topic === "source_coverage") {
    const requiredFlags = plan.intent.sourceFamilies.map((family) => family === "clinic" ? ["hasClinicProfile", "hasClinicActivity"] : family === "google_ads" ? ["hasGoogleAds"] : family === "regional" ? ["hasMarketContext", "hasRegionalDemand"] : ["hasCensus"]).flat();
    rows = responses.flatMap((response) => response.rows);
    if (plan.geographyResolution.selectedCbsaCodes.length) {
      const selectedCodes = new Set(plan.geographyResolution.selectedCbsaCodes);
      rows = rows.filter((row) => selectedCodes.has(String(row.cbsaCode)));
    } else {
      rows = rows.filter((row) => requiredFlags.every((flag) => row[flag] === true));
    }
    evidenceBundle = rows.slice(0, 25).map((row) => ({
      evidenceId: `source-coverage:${String(row.cbsaCode)}`,
      metricId: "normalized.source_coverage",
      geographyId: `cbsa:${String(row.cbsaCode)}`,
      geographyLabel: String(row.cbsaName),
      rawValue: requiredFlags.filter((flag) => row[flag] === true).length,
      structuredValue: row,
      unit: "required_source_checks_passed",
      sourceId: "SRC-019",
      snapshotId: responses[0]!.snapshotVersion,
      evidenceStatus: "Derived",
      qualityStatus: requiredFlags.every((flag) => row[flag] === true) ? "accepted" : "warning",
      observationStart: null,
      observationEnd: null,
      period: { kind: "not_provided", start: null, end: null, label: "Coverage presence in normalized snapshot" },
      reportScope: "normalized source coverage",
      currency: null,
      allowedUse: "local_demo_aggregate_decision_support",
      sensitivity: "internal",
      warning: "Source coverage indicates data presence only; it is not an opportunity or quality score.",
      origin: "frozen_csv_snapshot",
    }));
  }
  if (plan.intent.topic === "multi_market_comparison") {
    rows = sortComparisonRows(plan, evidenceBundle.map((item) => ({
      cbsaCode: item.geographyId?.replace("cbsa:", "") ?? null,
      cbsaName: item.geographyLabel,
      metricId: item.metricId.replace("normalized.", ""),
      value: item.rawValue,
      unit: item.unit,
      period: item.period,
      reportScope: item.reportScope,
      currency: item.currency,
      evidenceStatus: item.evidenceStatus,
      qualityStatus: item.qualityStatus,
      sourceId: item.sourceId,
      warning: item.warning,
    })));
  }
  const allWarnings = unique(responses.flatMap((response) => response.warnings));
  const sourceIds = unique(evidenceBundle.map((item) => item.sourceId));
  const presentMetrics = new Set(evidenceBundle.map((item) => item.metricId.replace("normalized.", "")));
  const missingRequestedMetrics = plan.intent.requestedMetrics
    .filter((metric) => METRIC_CATALOG[metric] && !presentMetrics.has(metric))
    .map((metric) => `The requested metric ${metric.replaceAll("_", " ")} is unavailable for the selected source and exact geography.`);
  const noRows = rows.length === 0;
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(plan, requestId, "frozen_snapshot_demo"),
    snapshotVersion: responses[0]?.snapshotVersion ?? DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
    calculationVersion: responses[0]?.calculationVersion ?? PLAN_EXECUTION_CALCULATION_VERSION,
    status: noRows || allWarnings.length || missingRequestedMetrics.length || plan.intent.topic === "clinic_location" ? "partial" : "complete",
    componentQueries: selectedQueries,
    rows,
    evidenceBundle,
    sourceIds,
    qualityWarnings: allWarnings,
    missingEvidence: unique([
      ...(noRows ? ["No rows matched the requested registered query and exact geography."] : []),
      ...missingRequestedMetrics,
      ...(plan.intent.topic === "clinic_location" ? plan.missingEvidence : []),
    ]),
    unknowns: unique([
      ...(plan.intent.sourceFamilies.includes("google_ads") ? ["Google Ads geography is inferred for the local demo and is not a provider-stable market join."] : []),
      ...(plan.intent.topic === "clinic_location" ? ["Connected aggregate market and clinic evidence does not establish site suitability, reachable capacity, clinic economics, or an opening decision."] : []),
    ]),
    allowedUse: "local_demo_aggregate_decision_support",
    sensitivity: "internal",
    guardrails: unique([...responseBase(plan, requestId, "frozen_snapshot_demo").guardrails, "Descriptive values and metric sorting do not create a universal market-attraction score or authorize action."]),
    errorCode: null,
    errorMessage: null,
  });
}

export async function executeEvaluationPlanEvidence(input: unknown, options: PlanExecutionOptions = {}): Promise<EvidenceExecutionResponse> {
  const { requestId, plan } = evaluationPlanExecutionRequestSchema.parse(input);
  if (plan.status === "blocked") return blocked(plan, requestId, "The validated evaluation plan is blocked and was not executed.");
  const nationalRegisteredQuery = plan.intent.topic === "source_coverage" || plan.intent.topic === "growth_test_screening";
  if (["clarification", "unavailable", "needs_selection"].includes(plan.geographyResolution.mode) && !nationalRegisteredQuery) return blocked(plan, requestId, "Resolve an exact supported geography before execution.");
  if (plan.intent.selectedQueries.length) {
    try {
      return await normalizedEvidenceBundle(plan, requestId, options);
    } catch (error) {
      return evidenceExecutionResponseSchema.parse({
        ...responseBase(plan, requestId, "frozen_snapshot_demo"), status: "failed", rows: [], evidenceBundle: [], sourceIds: [], qualityWarnings: [], missingEvidence: [], unknowns: [], allowedUse: "none", sensitivity: "internal",
        errorCode: "NORMALIZED_QUERY_FAILED", errorMessage: error instanceof Error && !error.message.includes("/") ? error.message : "The registered normalized query failed.",
      });
    }
  }
  if (plan.capabilityId === "census_market_context") return marketContextBundle(plan, requestId, options);
  if (plan.capabilityId === "clinic_performance") return syntheticClinicPerformanceBundle(plan, requestId);
  if (plan.capabilityId === "local_growth_test") return growthTestBundle(plan, requestId, options);
  return clinicSiteBundle(plan, requestId, options);
}
