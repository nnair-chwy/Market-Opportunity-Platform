import {
  evidenceExecutionResponseSchema,
  type EvidencePeriod,
  type EvidenceExecutionResponse,
  type ExecutionEvidenceItem,
} from "../evidence-snapshot/contracts.ts";
import type { EvaluationPlan } from "../planning/contracts.ts";
import {
  GOLDEN_QUESTION_EVIDENCE_CALCULATION_VERSION,
  GOLDEN_QUESTION_EVIDENCE_QUERY_VERSION,
  type GoldenQuestionEvidence,
  type GoldenQuestionFamily,
} from "./contracts.ts";

const SOURCE_BY_FAMILY = {
  marketing: "SRC-018",
  pricing: "SRC-025",
  cvc: "SRC-017",
} as const;

const METRIC_UNITS: Record<string, string> = {
  clicks: "clicks",
  impressions: "impressions",
  ctrPercent: "percent",
  cpcUsd: "USD",
  configuredConversions: "configured_conversions",
  configuredConversionRatePercent: "percent",
  costUsd: "USD",
  mappedPostalGeographies: "postal_geographies",
  cohortMedianCtrPercent: "percent",
  cohortMedianCpcUsd: "USD",
  cohortMedianConfiguredConversionRatePercent: "percent",
  conversionRateDifferenceVsMedianPercentagePoints: "percentage_points",
  documentedAvailabilityPercent: "percent",
  monitoredOfferRows: "offer_rows",
  summedDistinctSkuObservations: "summed_distinct_sku_observations",
  offerRowWeightedEqualizedPriceUsd: "USD",
  mappedZipGeographies: "zip_geographies",
  eligibleCohortMedianAvailabilityPercent: "percent",
  availabilityDifferenceVsMedianPercentagePoints: "percentage_points",
  metropolitanMedianOfferRows: "offer_rows",
  petHouseholds: "households",
  reportedVeterinaryClinicCount: "clinics",
  reportedPetHouseholdsPerClinic: "households_per_clinic",
  reportedChewyOnlineCustomers: "reported_customers",
  cohortMedianPetHouseholdsPerClinic: "households_per_clinic",
  cohortMedianChewyOnlineCustomers: "reported_customers",
  petHouseholdsPerClinicMultipleVsMedian: "multiple",
  exportedProductSkus: "product_skus",
  sourceUiProductEntries: "product_skus",
  productExportCoveragePercent: "percent",
  currentRegularExceptions: "exceptions",
};

export function goldenQuestionFamilyForPlan(plan: EvaluationPlan): GoldenQuestionFamily | null {
  if (plan.geographyResolution.selectedCbsaCodes.length) return null;
  const question = plan.originalQuestion.toLowerCase();
  const marketingSource = /\b(paid[ -]?search|google ads?|campaign|marketing)\b/.test(question);
  const marketingEvidenceQuestion = /\b(comparable|geograph|markets?|regional)\w*\b/.test(question)
    && /\b(response|outcomes?|validat|investigat|signals?)\w*\b/.test(question);
  const marketingLeverQuestion = /\b(where|increase|decrease|shift|reallocat|spend|budget)\w*\b/.test(question);
  if (plan.perspectiveId === "marketing" && marketingSource && (marketingEvidenceQuestion || marketingLeverQuestion)) return "marketing";
  if (plan.perspectiveId === "pricing"
    && /\b(competitor|availability|offers?|pricing)\w*\b/.test(question)
    && /\b(conditions?|economics?|investigat|signals?|regional|where)\w*\b/.test(question)) return "pricing";
  if (plan.perspectiveId === "cvc"
    && /\b(clinic|cvc|veterinar|footprint|pet households?|demand)\w*\b/.test(question)
    && /\b(contrast|access|investigat|signals?|markets?|where)\w*\b/.test(question)) return "cvc";
  return null;
}

function periodFor(family: GoldenQuestionFamily): EvidencePeriod {
  if (family === "marketing") return { kind: "date_range", start: "2026-07-14", end: "2026-08-12", label: "2026-07-14 through 2026-08-12" };
  if (family === "pricing") return { kind: "date_range", start: "2026-07-18", end: "2026-08-17", label: "Competitor observations from 2026-07-18 through 2026-08-17" };
  return { kind: "not_provided", start: null, end: null, label: "Observation date unknown; snapshot received 2026-07-30" };
}

function domainLimitations(snapshot: GoldenQuestionEvidence, family: GoldenQuestionFamily) {
  const shared = snapshot.limitations.filter((item) => /every candidate/i.test(item));
  const matched = snapshot.limitations.filter((item) => {
    if (family === "marketing") return /marketing|postal-to-cbsa/i.test(item);
    if (family === "pricing") return /pricing/i.test(item);
    return /cvc|trade-area/i.test(item);
  });
  return [...new Set([...shared, ...matched])];
}

function missingEvidence(family: GoldenQuestionFamily) {
  if (family === "marketing") return [
    "Privacy-safe first-party regional outcomes and approved attribution/lag semantics are not connected to this snapshot.",
    "The postal-to-CBSA approximation is not an approved operational crosswalk.",
    "Pre-period comparability, power, contamination, and incrementality checks are required before recommending a spend change.",
  ];
  if (family === "pricing") return [
    "A privacy-safe local Chewy commercial outcome is not connected to this snapshot.",
    "Prior Pricing interventions, promotions, inventory, and representative-ZIP coverage are not fully excluded.",
    "The displayed lead is supported by one mapped ZIP geography and cannot establish a regional pricing opportunity.",
  ];
  return [
    "The trade-area observation date, construction method, clinic-count definition, metric ownership, and production reuse authority are unresolved.",
    "Clinic access, staffed capacity, appointments, veterinary supply, workforce, property feasibility, economics, and mature outcomes are not connected.",
  ];
}

function unknownsFor(family: GoldenQuestionFamily) {
  if (family === "marketing") return ["The observed response contrast may reflect campaign mix, targeting, auction conditions, or conversion configuration rather than incremental demand."];
  if (family === "pricing") return ["The availability contrast may reflect crawl coverage, assortment, competitor mix, timing, or match configuration rather than a pricing opportunity."];
  return ["The reported demand-to-footprint contrast does not establish reachable demand, capacity need, site feasibility, or clinic economics."];
}

function candidateGeography(candidate: Record<string, unknown>, family: GoldenQuestionFamily) {
  const geography = candidate.geography as Record<string, unknown>;
  if (family === "cvc") return {
    id: `site:${String(geography.siteId)}`,
    label: `${String(geography.siteName)} (${String(geography.marketLabel)})`,
  };
  return { id: `cbsa:${String(geography.id)}`, label: String(geography.name) };
}

function evidenceForCandidate(
  snapshot: GoldenQuestionEvidence,
  family: GoldenQuestionFamily,
  candidate: Record<string, unknown>,
  rank: number,
): ExecutionEvidenceItem[] {
  const geography = candidateGeography(candidate, family);
  const sourceId = SOURCE_BY_FAMILY[family];
  const sourceSnapshot = snapshot.sourceSnapshots[family];
  const period = periodFor(family);
  const metrics = candidate.metrics as Record<string, number>;
  const comparison = candidate.comparison as Record<string, number>;
  const shared = {
    geographyId: geography.id,
    geographyLabel: geography.label,
    sourceId,
    snapshotId: sourceSnapshot,
    qualityStatus: "warning" as const,
    observationStart: period.start,
    observationEnd: period.end,
    period,
    reportScope: `${family} golden-question investigation lead`,
    allowedUse: snapshot.allowedUse,
    sensitivity: "internal" as const,
    warning: domainLimitations(snapshot, family).join(" "),
    origin: "frozen_csv_snapshot" as const,
  };
  const structuredValue = {
    candidateRank: rank,
    cohort: String(candidate.cohort),
    observationWindow: String(candidate.observationWindow),
    selectionRule: snapshot.selectionRules[family],
    actionAuthority: snapshot.actionAuthority,
    scoringEligibility: snapshot.scoringEligibility,
    sourceSnapshot,
  };
  return [
    ...Object.entries(metrics).map(([metricId, rawValue]) => ({
      ...shared,
      evidenceId: `golden:${family}:${geography.id}:metric:${metricId}`,
      metricId: `golden.${family}.${metricId}`,
      rawValue,
      structuredValue,
      unit: METRIC_UNITS[metricId] ?? "value",
      currency: /Usd$/.test(metricId) ? "USD" : null,
      evidenceStatus: family === "cvc" ? "Reported" as const : "Derived" as const,
    })),
    ...Object.entries(comparison).map(([metricId, rawValue]) => ({
      ...shared,
      evidenceId: `golden:${family}:${geography.id}:comparison:${metricId}`,
      metricId: `golden.${family}.${metricId}`,
      rawValue,
      structuredValue,
      unit: METRIC_UNITS[metricId] ?? "value",
      currency: /Usd$/.test(metricId) ? "USD" : null,
      evidenceStatus: "Derived" as const,
    })),
  ];
}

function pricingOperationalEvidence(snapshot: GoldenQuestionEvidence): ExecutionEvidenceItem[] {
  const context = snapshot.operationalContext.pricing;
  const period: EvidencePeriod = { kind: "as_of", start: null, end: context.snapshotDate, label: `As of ${context.snapshotDate}` };
  const warning = "National Zeus context has no destination geography. The product export is capped and the exception export is a current-state REGULAR view, not decision history.";
  const metrics = {
    exportedProductSkus: context.exportedProductSkus,
    sourceUiProductEntries: context.sourceUiProductEntries,
    productExportCoveragePercent: context.productExportCoveragePercent,
    currentRegularExceptions: context.currentRegularExceptions,
  };
  return Object.entries(metrics).map(([metricId, rawValue]) => ({
    evidenceId: `golden:pricing:national:zeus:${metricId}`,
    metricId: `golden.pricing.zeus.${metricId}`,
    geographyId: "national:us",
    geographyLabel: "United States (national SKU context)",
    rawValue,
    structuredValue: {
      productExportCompleteness: context.productExportCompleteness,
      exceptionExportCompleteness: context.exceptionExportCompleteness,
      actionAuthority: snapshot.actionAuthority,
    },
    unit: METRIC_UNITS[metricId] ?? "value",
    sourceId: "SRC-036",
    snapshotId: snapshot.sourceSnapshots.zeus,
    evidenceStatus: metricId === "productExportCoveragePercent" ? "Derived" as const : "Reported" as const,
    qualityStatus: "warning" as const,
    observationStart: null,
    observationEnd: context.snapshotDate,
    period,
    reportScope: "national Zeus current-state operational context",
    currency: null,
    allowedUse: context.allowedUse,
    sensitivity: "internal" as const,
    warning,
    origin: "frozen_csv_snapshot" as const,
  }));
}

export function executeGoldenQuestionEvidence(
  plan: EvaluationPlan,
  requestId: string,
  snapshot: GoldenQuestionEvidence,
  family: GoldenQuestionFamily,
): EvidenceExecutionResponse {
  const candidates = snapshot.candidates[family] as Array<Record<string, unknown>>;
  const evidenceBundle = [
    ...candidates.flatMap((candidate, index) => evidenceForCandidate(snapshot, family, candidate, index + 1)),
    ...(family === "pricing" ? pricingOperationalEvidence(snapshot) : []),
  ];
  const geographyIds = candidates.map((candidate) => candidateGeography(candidate, family).id);
  const warnings = domainLimitations(snapshot, family);
  return evidenceExecutionResponseSchema.parse({
    requestId,
    status: "partial",
    snapshotVersion: snapshot.snapshotId,
    queryVersion: GOLDEN_QUESTION_EVIDENCE_QUERY_VERSION,
    calculationVersion: GOLDEN_QUESTION_EVIDENCE_CALCULATION_VERSION,
    query: family === "marketing" ? "growth_test_bundle" : family === "cvc" ? "clinic_site_evidence_bundle" : "market_context_bundle",
    componentQueries: [],
    capability: plan.capabilityId,
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    geographyIds,
    missingApprovals: plan.missingApprovals,
    guardrails: [
      plan.evidenceBoundary,
      snapshot.actionAuthority,
      snapshot.selectionRules[family],
      "This response may support investigation or controlled-test design only; it cannot authorize price, spend, clinic, lease, or other material action.",
    ],
    rows: candidates.map((candidate, index) => ({
      family,
      rank: index + 1,
      ...candidate,
      sourceId: SOURCE_BY_FAMILY[family],
      sourceSnapshot: snapshot.sourceSnapshots[family],
      allowedUse: snapshot.allowedUse,
      actionAuthority: snapshot.actionAuthority,
    })),
    evidenceBundle,
    sourceIds: family === "pricing" ? [SOURCE_BY_FAMILY[family], "SRC-036"] : [SOURCE_BY_FAMILY[family]],
    qualityWarnings: warnings,
    missingEvidence: [...new Set([...plan.missingEvidence, ...missingEvidence(family)])],
    unknowns: unknownsFor(family),
    allowedUse: snapshot.allowedUse,
    sensitivity: "internal",
    executionMode: "frozen_snapshot_demo",
    errorCode: null,
    errorMessage: null,
  });
}
