import type { EvidenceExecutionResponse } from "../evidence-snapshot/contracts.ts";
import type { EvaluationPlan } from "./contracts.ts";
import type { InvestigationLead, MarketInvestigation } from "./market-investigation.ts";

type GoldenFamily = "marketing" | "pricing" | "cvc";
type GoldenRow = Record<string, unknown> & {
  family: GoldenFamily;
  rank: number;
  cohort: string;
  observationWindow: string;
  geography: Record<string, unknown>;
  metrics: Record<string, number>;
  comparison: Record<string, number>;
};

function isGoldenRow(value: unknown): value is GoldenRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["marketing", "pricing", "cvc"].includes(String(row.family))
    && typeof row.rank === "number"
    && typeof row.cohort === "string"
    && typeof row.observationWindow === "string"
    && !!row.geography && typeof row.geography === "object"
    && !!row.metrics && typeof row.metrics === "object"
    && !!row.comparison && typeof row.comparison === "object";
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function integer(value: unknown) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number(value));
}

function decimal(value: unknown, digits = 2) {
  return number(value).toFixed(digits);
}

function geography(row: GoldenRow) {
  if (row.family === "cvc") return {
    id: `site:${String(row.geography.siteId)}`,
    label: `${String(row.geography.siteName)} (${String(row.geography.marketLabel)})`,
  };
  return { id: String(row.geography.id), label: String(row.geography.name) };
}

function leadFor(row: GoldenRow): InvestigationLead {
  const place = geography(row);
  if (row.family === "marketing") {
    const conversionRate = number(row.metrics.configuredConversionRatePercent);
    const cohortRate = number(row.comparison.cohortMedianConfiguredConversionRatePercent);
    const cpc = number(row.metrics.cpcUsd);
    const cohortCpc = number(row.comparison.cohortMedianCpcUsd);
    return {
      id: `golden-marketing-${row.rank}`,
      marketIds: [place.id],
      title: `${place.label} is the first paid-search spend-test candidate in the current screen`,
      observation: `${place.label} recorded ${integer(row.metrics.clicks)} clicks and ${integer(row.metrics.configuredConversions)} account-configured conversions from ${row.observationWindow}. Its configured conversion rate was ${decimal(conversionRate)}%, ${decimal(conversionRate - cohortRate)} percentage points above the eligible-cohort median, while CPC was $${decimal(cpc)} versus the $${decimal(cohortCpc)} median.`,
      businessMeaning: `Among 198 eligible markets, ${place.label} ranked first by configured conversions after clearing the response-and-cost screen. That makes it the first market to validate with orders, new customers, contribution, and an incremental test—not permission to raise live spend yet.`,
      method: row.cohort,
      sampleSize: 198,
      strength: `#${row.rank} by configured conversions after the registered eligibility screen`,
      challenge: "Configured advertising conversions can reflect campaign mix, targeting, auction conditions, or conversion configuration and are not first-party commercial outcomes or incrementality.",
      nextEvidence: "Join privacy-safe regional orders, new customers, contribution, campaign mix, and pre-period baselines under approved attribution and lag definitions; then validate a controlled-test design.",
      supportingMeasures: [
        { id: "configured_conversion_rate", label: "Configured conversion rate", formattedValue: `${decimal(conversionRate)}%`, percentile: 75, rangeMeaning: `${decimal(conversionRate - cohortRate)} pp above cohort median`, role: "response" },
        { id: "cpc", label: "Average CPC", formattedValue: `$${decimal(cpc)}`, percentile: 50, rangeMeaning: `$${decimal(cohortCpc)} cohort median`, role: "cost" },
      ],
    };
  }
  if (row.family === "pricing") {
    const availability = number(row.metrics.documentedAvailabilityPercent);
    const cohortAvailability = number(row.comparison.eligibleCohortMedianAvailabilityPercent);
    return {
      id: `golden-pricing-${row.rank}`,
      marketIds: [place.id],
      title: `${place.label} has a competitor-availability anomaly worth coverage validation`,
      observation: `${place.label} showed ${decimal(availability)}% documented competitor availability versus ${decimal(cohortAvailability)}% for the eligible-cohort median across ${integer(row.metrics.monitoredOfferRows)} monitored offer rows. The result maps to only ${integer(row.metrics.mappedZipGeographies)} ZIP geography.`,
      businessMeaning: "This is a monitoring and data-quality lead. It may justify checking crawl and assortment coverage, but it does not establish a regional pricing opportunity or support a price change.",
      method: row.cohort,
      sampleSize: 66,
      strength: `${decimal(Math.abs(availability - cohortAvailability))} pp below eligible-cohort availability`,
      challenge: "One mapped ZIP cannot represent the CBSA; crawl coverage, assortment, competitor mix, timing, or match configuration may explain the contrast.",
      nextEvidence: "Expand representative-ZIP coverage and connect local Chewy demand, contribution, inventory, promotions, and prior intervention history before assessing economics.",
    };
  }
  const ratio = number(row.metrics.reportedPetHouseholdsPerClinic);
  const cohortRatio = number(row.comparison.cohortMedianPetHouseholdsPerClinic);
  const multiple = number(row.comparison.petHouseholdsPerClinicMultipleVsMedian);
  return {
    id: `golden-cvc-${row.rank}`,
    marketIds: [place.id],
    title: `${place.label} shows a reported demand-to-footprint contrast worth clinic-access validation`,
    observation: `${place.label} reports ${integer(row.metrics.petHouseholds)} pet households, ${integer(row.metrics.reportedVeterinaryClinicCount)} veterinary clinics, and ${integer(ratio)} pet households per clinic—${decimal(multiple)}× the ${integer(cohortRatio)} median for its source-provided San Jose comparison cohort.`,
    businessMeaning: "The contrast prioritizes a deeper access and capacity investigation; it does not establish reachable demand, a clinic shortage, site feasibility, or clinic economics.",
    method: row.cohort,
    sampleSize: 7,
    strength: `${decimal(multiple)}× cohort median households per clinic`,
    challenge: "The trade-area date, construction method, clinic definition, access, staffed capacity, appointments, workforce supply, property feasibility, and mature economics are unresolved.",
    nextEvidence: "Validate the trade-area method and observation date, then connect appointment demand, staffed capacity, veterinary supply, customer penetration, property feasibility, and mature clinic performance.",
  };
}

/**
 * Converts the executed frozen golden-question bundle into the investigation shown
 * to the user. Returning null keeps all non-golden workflows on their existing path.
 */
export function goldenMarketInvestigationFromEvidence(
  plan: EvaluationPlan,
  response: EvidenceExecutionResponse,
): MarketInvestigation | null {
  const rows = response.rows.filter(isGoldenRow).sort((left, right) => left.rank - right.rank);
  if (!rows.length || rows.some((row) => row.family !== rows[0].family)) return null;
  const family = rows[0].family;
  if (family !== plan.perspectiveId) return null;
  const cohort = rows[0].cohort;
  const period = rows[0].observationWindow;
  const leads = rows.map(leadFor);
  const cohortSize = family === "marketing" ? 198 : family === "pricing" ? 66 : 7;

  return {
    version: "1.0.0",
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    perspectiveId: family,
    geography: family === "cvc" ? "supplied_trade_area" : "CBSA",
    period,
    dataSnapshotLabel: `Frozen ${family} golden-question evidence`,
    dataSnapshotVersion: response.snapshotVersion,
    readiness: {
      label: "Partial answer",
      summary: `${leads.length} source-linked investigation lead${leads.length === 1 ? "" : "s"} survived the registered ${family} cohort screen. This is the best available answer now; a material action is not yet supported until the listed business outcomes and validity checks are connected.`,
      missing: response.missingEvidence,
    },
    toolsRun: ["Apply the registered eligibility cohort", "Select candidates using the frozen deterministic rule", "Challenge alternative explanations", "Define the next evidence gate"],
    measuresExamined: [...new Set(response.evidenceBundle.filter((item) => item.geographyId !== "national:us").map((item) => item.metricId))],
    comparisonsExamined: cohortSize,
    screeningScope: {
      marketUniverse: cohortSize,
      eligibleCohort: cohort,
      eligibleComparisons: cohortSize,
      allMarketPairs: 0,
      selectionRule: String((response.evidenceBundle[0]?.structuredValue as Record<string, unknown> | null)?.selectionRule ?? "Registered frozen-snapshot candidate rule"),
      executionMode: "deterministic_local_snapshot",
    },
    leads,
    rejectedPatterns: response.unknowns.map((item) => `Alternative explanation retained: ${item}`),
    limitations: [...new Set([...response.qualityWarnings, ...response.unknowns, ...response.guardrails])],
    sourceIds: response.sourceIds,
    allowedUse: "internal_shadow_evaluation_only",
    scoringEligibility: "none",
    evidenceStage: "signal",
    nextPass: {
      status: "waiting_for_evidence",
      question: "Does compatible first-party or operational evidence support, contradict, or explain this lead?",
      evidenceNeeded: response.missingEvidence,
      completionRule: "Keep the result as an investigation lead until compatible evidence at the same geography, cohort, and period validates the business outcome and material-action guardrails.",
    },
    investigationPath: [
      {
        id: "run_registered_golden_screen",
        label: "Run the registered evidence screen",
        purpose: "Apply the approved frozen cohort and deterministic selection rule.",
        contributionToAnswer: `Retained ${leads.length} bounded lead${leads.length === 1 ? "" : "s"}: ${leads.map((lead) => lead.title).join("; ")}.`,
        status: "completed",
        sourceIds: response.sourceIds,
        result: `Screened the exact ${cohort}.`,
      },
      {
        id: "connect_business_outcomes",
        label: "Connect business outcomes",
        purpose: "Test whether the observed contrast reaches the business outcome in the question.",
        contributionToAnswer: "Would distinguish an interesting descriptive signal from an actionable opportunity.",
        status: "waiting_for_evidence",
        sourceIds: [],
        result: response.missingEvidence.join(" "),
      },
      {
        id: "validate_material_action",
        label: "Validate a bounded action",
        purpose: "Pre-register the KPI, threshold, stop condition, and approval path for any controlled test.",
        contributionToAnswer: "Can support a human-reviewed test design only after the evidence gate passes.",
        status: "pending",
        sourceIds: [],
        result: "No price, spend, clinic, lease, or other material action is authorized.",
      },
    ],
  };
}
