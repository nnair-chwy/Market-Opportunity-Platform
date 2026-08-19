import type { EvaluationPlan } from "./contracts.ts";
import type { MarketInvestigation } from "./market-investigation.ts";
import { GROWTH_TEST_SCREENING_VERSION, GROWTH_TEST_SCREENING_WEIGHTS } from "../data-normalization/growth-screening-config.ts";
import { METRIC_CATALOG } from "./metric-catalog.ts";

export type AnalysisConsideration = {
  id: string;
  label: string;
  metric: string;
  role: "weighted_preference" | "validity_gate" | "context_only";
  evidenceStatus: "connected" | "partial" | "needed";
  weightPercent: number | null;
  whyItMatters: string;
};

export type AnalysisBrief = {
  version: "1.0.0";
  planId: string;
  status: "proposed" | "confirmed";
  originalQuestion: string;
  rewrittenQuestion: string;
  perspectiveId: EvaluationPlan["perspectiveId"];
  geography: string;
  timeframe: string;
  assumptions: string[];
  currentScreen: {
    inputs: string[];
    method: string;
    considerationEditsRecalculate: boolean;
    weightMode?: "none" | "advisory" | "fixed_calculation";
  };
  queryContract?: {
    topic: EvaluationPlan["intent"]["topic"];
    geographyIds: string[];
    sourceFamilies: EvaluationPlan["intent"]["sourceFamilies"];
    registeredQueries: EvaluationPlan["intent"]["selectedQueries"];
    requestedMetrics: string[];
    scoringVersion: string | null;
    missingDataRule: string;
  };
  considerations: AnalysisConsideration[];
  confirmedAt: string | null;
};

function cvcExplorationConsiderations(): AnalysisConsideration[] {
  return [
    { id: "current_cvc_footprint", label: "Current CVC footprint", metric: "Published clinic locations mapped to metropolitan CBSAs", role: "context_only", evidenceStatus: "partial", weightPercent: 15, whyItMatters: "Shows where the published footprint differs without treating clinic count as capacity or access." },
    { id: "public_market_context", label: "Public market context", metric: "Population, households, median income, and population density", role: "context_only", evidenceStatus: "connected", weightPercent: 15, whyItMatters: "Finds structurally comparable metros for a more useful footprint contrast." },
    { id: "comparison_validity", label: "Peer comparability", metric: "Same-grain market structure and alternate-peer stability", role: "validity_gate", evidenceStatus: "partial", weightPercent: 10, whyItMatters: "A contrast is only useful when the markets are similar enough for the comparison to be interpretable." },
    { id: "demand_capacity", label: "Demand and capacity", metric: "Chewy customer demand, clinic capacity, appointments, pet households, and trade-area access", role: "validity_gate", evidenceStatus: "needed", weightPercent: 35, whyItMatters: "A footprint difference cannot be called whitespace until demand and service capacity are verified." },
    { id: "operating_context", label: "Operating context", metric: "Veterinary workforce, property feasibility, economics, maturity, and cannibalization", role: "validity_gate", evidenceStatus: "needed", weightPercent: 25, whyItMatters: "Explains whether a visible contrast is actionable or simply reflects an operating constraint." },
  ];
}

function marketingConsiderations(): AnalysisConsideration[] {
  return [
    { id: "baseline_similarity", label: "Baseline similarity", metric: "Pre-period customer mix, outcomes, trend, and seasonality", role: "validity_gate", evidenceStatus: "needed", weightPercent: 30, whyItMatters: "Test and control markets must behave similarly before treatment." },
    { id: "media_isolation", label: "Media isolation", metric: "Campaign history, spillover, contamination risk, reach, frequency, and cost", role: "validity_gate", evidenceStatus: "needed", weightPercent: 25, whyItMatters: "A structural peer is not a valid control when exposure cannot be separated." },
    { id: "structural_peer", label: "Structural comparability", metric: "Population, households, income, and population density", role: "context_only", evidenceStatus: "connected", weightPercent: 20, whyItMatters: "Narrows the feasibility search before business outcomes are connected." },
    { id: "audience_concentration", label: "Audience concentration", metric: "Reachable customer and prospect concentration within the market", role: "context_only", evidenceStatus: "partial", weightPercent: 25, whyItMatters: "Similar market scale may require different channel, reach, delivery, or creative tactics." },
  ];
}

function pricingConsiderations(): AnalysisConsideration[] {
  return [
    { id: "price_exposure", label: "Price and promotion exposure", metric: "Observed item-level price and promotion by geography and period", role: "validity_gate", evidenceStatus: "needed", weightPercent: 25, whyItMatters: "Regional response cannot be interpreted without knowing what customers actually saw." },
    { id: "customer_response", label: "Customer response", metric: "Conversion, units, retention, substitution, and elasticity at compatible grain", role: "validity_gate", evidenceStatus: "needed", weightPercent: 35, whyItMatters: "Separates price response from a coincident difference in market composition." },
    { id: "competitive_context", label: "Competitive context", metric: "Competitor price, assortment, availability, and delivery proposition", role: "context_only", evidenceStatus: "needed", weightPercent: 25, whyItMatters: "A regional pricing pattern can reflect a different competitive environment." },
    { id: "market_context", label: "Market context", metric: "Income, household scale, and density", role: "context_only", evidenceStatus: "connected", weightPercent: 15, whyItMatters: "Describes the market but cannot substitute for governed pricing evidence." },
  ];
}

function cvcExplorationQuestion(plan: EvaluationPlan) {
  const question = plan.originalQuestion;
  if (/veterinar|supply|access|whitespace/i.test(question)) {
    return "Find metro footprint contrasts worth validating for veterinary access or whitespace, while keeping demand, clinic capacity, and workforce as required evidence gaps.";
  }
  if (/demand|growth|customer/i.test(question)) {
    return "Find metro footprint contrasts worth validating against governed Chewy demand and clinic capacity; do not substitute household context for customer or pet demand.";
  }
  return plan.intent.conciseInterpretation;
}

function sameMembers(left: string[], right: string[]) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function mentionsResolvedMarket(plan: EvaluationPlan, rewrittenQuestion: string) {
  const place = plan.geographyResolution.places.find((item) => item.status === "resolved");
  if (!place) return true;
  const normalizedQuestion = rewrittenQuestion.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const aliases = [
    place.requestedName,
    place.cbsaName?.split(",")[0],
    ...(place.cbsaName?.split(",")[0]?.split(/[-–]/) ?? []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
    .filter((value) => value.length >= 3);
  return aliases.some((alias) => normalizedQuestion.includes(alias));
}

export function validateAnalysisBriefConsistency(plan: EvaluationPlan, brief: AnalysisBrief): string[] {
  const issues: string[] = [];
  if (brief.planId !== plan.planId || brief.originalQuestion !== plan.originalQuestion) issues.push("The analysis brief does not belong to the validated plan.");
  if (brief.perspectiveId !== plan.perspectiveId) issues.push("The analysis brief perspective differs from the validated plan.");
  if (!brief.queryContract) {
    if (plan.intent.selectedQueries.length || plan.intent.topic === "clinic_location") issues.push("The analysis brief is missing the structured query contract required by the plan.");
    return issues;
  }
  const expectedGeographyIds = plan.geographyResolution.selectedCbsaCodes.map((code) => `cbsa:${code}`);
  if (brief.queryContract.topic !== plan.intent.topic) issues.push("The analysis brief topic differs from the validated plan.");
  if (!sameMembers(brief.queryContract.geographyIds, expectedGeographyIds)) issues.push("The analysis brief geography IDs differ from the validated plan.");
  if (!sameMembers(brief.queryContract.sourceFamilies, plan.intent.sourceFamilies)) issues.push("The analysis brief source families differ from the validated plan.");
  if (!sameMembers(brief.queryContract.registeredQueries, plan.intent.selectedQueries)) issues.push("The analysis brief registered queries differ from the executable plan.");
  if (!sameMembers(brief.queryContract.requestedMetrics, plan.intent.requestedMetrics)) issues.push("The analysis brief requested metrics differ from the validated plan.");
  if (plan.intent.rankingMode === "none" && brief.queryContract.scoringVersion !== null) issues.push("A non-ranking plan cannot carry a scoring version.");
  if (plan.intent.rankingMode === "none" && /\b(rank|ranking|top\s+\d|which\s+\d+|3[–-]5)\b/i.test(brief.rewrittenQuestion)) issues.push("The interpreted question introduces ranking language without a registered ranking mode.");
  if (plan.geographyResolution.mode === "single") {
    if (!mentionsResolvedMarket(plan, brief.rewrittenQuestion)) issues.push("The interpreted question omits the resolved named market.");
  }
  return issues;
}

function clinicLocationQuestionBrief(plan: EvaluationPlan, investigation: MarketInvestigation): AnalysisBrief {
  const resolvedMarkets = plan.geographyResolution.places
    .filter((place) => place.status === "resolved")
    .map((place) => place.cbsaName ?? place.requestedName);
  const marketLabel = resolvedMarkets.length ? resolvedMarkets.join(" and ") : "U.S. metropolitan markets";
  const namedMarket = plan.geographyResolution.selectedCbsaCodes.length > 0;
  const adsIncluded = plan.intent.sourceFamilies.includes("google_ads");
  const rewrittenQuestion = namedMarket
    ? `What connected market, regional, and aggregate clinic evidence is available for ${marketLabel}, and what capacity, workforce, competitive access, property, and economic evidence remains unknown before considering a new CVC clinic?`
    : "What national CVC footprint and public market context can be reviewed as investigation leads, and what governed demand, capacity, workforce, property, economic, and approval evidence is required before any market screening?";
  const timeframe = namedMarket
    ? `Source-native periods: public and regional context, annual regional demand, aggregate clinic timeframe${adsIncluded ? ", and Google Ads report period" : ""}`
    : investigation.period;
  const considerations: AnalysisConsideration[] = [
    { id: "connected_market_context", label: "Market and regional context", metric: "Public Census context plus registered regional customer and sales aggregates", role: "context_only", evidenceStatus: namedMarket ? "connected" : "partial", weightPercent: null, whyItMatters: "Describes the selected market without treating households or current sales as incremental clinic demand." },
    { id: "connected_clinic_activity", label: "Aggregate clinic activity", metric: "Registered clinic profile, customer, order, and sales aggregates", role: "context_only", evidenceStatus: namedMarket ? "connected" : "partial", weightPercent: null, whyItMatters: "Provides descriptive clinic-market activity but not site suitability, clinic capacity, or a mature operating outcome." },
    { id: "capacity_access", label: "Capacity and access", metric: "Staffed capacity, appointments, utilization, service mix, and approved trade areas", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "Clinic counts and aggregate activity cannot substitute for reachable service capacity." },
    { id: "workforce_competition", label: "Workforce and competitive access", metric: "Veterinary workforce, competitive supply, service mix, and local availability", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "A visible footprint difference may reflect staffing or competitive constraints rather than opportunity." },
    { id: "property_economics", label: "Property and economics", metric: "Property feasibility, permitting, trade area, economics, cannibalization, and mature outcomes", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "These inputs are required before a market investigation can advance toward a site or opening decision." },
  ];
  if (adsIncluded) considerations.splice(2, 0, { id: "marketing_context", label: "Marketing context", metric: "Google Ads matched-location aggregates with inferred CBSA mapping", role: "context_only", evidenceStatus: "partial", weightPercent: null, whyItMatters: "Adds descriptive search context while preserving that the market mapping is inferred for the demo." });
  const brief: AnalysisBrief = {
    version: "1.0.0",
    planId: plan.planId,
    status: "proposed",
    originalQuestion: plan.originalQuestion,
    rewrittenQuestion,
    perspectiveId: plan.perspectiveId,
    geography: namedMarket ? plan.geographyResolution.message : "U.S. metropolitan CBSAs; no market has been selected",
    timeframe,
    assumptions: namedMarket
      ? ["Use only the exact CBSA IDs resolved by the planner", "Preserve source-native periods and missing values", "Treat connected evidence as descriptive context and stop before site screening or opening approval"]
      : ["Do not rank or select markets without a registered deterministic screening contract", "Treat footprint and public market context as investigation leads only", "Require a named geography before exact-CBSA evidence execution"],
    currentScreen: {
      inputs: plan.intent.selectedQueries.length ? plan.intent.selectedQueries.map((query) => `Registered query: ${query}`) : investigation.measuresExamined,
      method: namedMarket
        ? "Run the registered exact-CBSA regional and clinic context queries, preserve source-native periods, and report missing opening-decision evidence without a score."
        : "Review connected national footprint and public market context without producing a rank, shortlist, or opening recommendation.",
      considerationEditsRecalculate: false,
      weightMode: "none",
    },
    queryContract: {
      topic: plan.intent.topic,
      geographyIds: plan.geographyResolution.selectedCbsaCodes.map((code) => `cbsa:${code}`),
      sourceFamilies: plan.intent.sourceFamilies,
      registeredQueries: plan.intent.selectedQueries,
      requestedMetrics: [...plan.intent.requestedMetrics],
      scoringVersion: null,
      missingDataRule: "Preserve missing values and list unavailable capacity, workforce, competitive, property, economic, and approval evidence explicitly.",
    },
    considerations,
    confirmedAt: null,
  };
  const issues = validateAnalysisBriefConsistency(plan, brief);
  if (issues.length) throw new Error(`Inconsistent clinic-location analysis brief: ${issues.join(" ")}`);
  return brief;
}

function normalizedQuestionBrief(plan: EvaluationPlan, investigation: MarketInvestigation): AnalysisBrief | null {
  if (!plan.intent.selectedQueries.length) return null;
  const metricLabels = plan.intent.requestedMetrics.map((metric) => metric === "rx_orders"
    ? "Clinic Rx orders (the supplied proxy for prescriptions)"
    : METRIC_CATALOG[metric]?.label ?? metric.replaceAll("_", " "));
  const screening = plan.intent.rankingMode === "growth_test_screening_v1";
  const placeNames = plan.geographyResolution.places
    .filter((place) => place.status === "resolved")
    .map((place) => place.cbsaName ?? place.requestedName);
  const placeLabel = placeNames.length ? placeNames.join(" and ") : "the complete eligible normalized-market cohort";
  const sourceLabels = plan.intent.sourceFamilies.map((family) => family === "google_ads" ? "Google Ads matched-location aggregates" : family === "clinic" ? "aggregate clinic activity" : family === "regional" ? "regional customer and demand aggregates" : family === "consumer_insights" ? "Brand Health Tracker consumer-insights aggregates" : "public Census context");

  const rewrittenQuestion = plan.intent.topic === "clinic_context"
    ? `Report ${metricLabels.join(", ")} for ${placeLabel}, with source, period, quality, and missingness visible.`
    : plan.intent.topic === "regional_context"
      ? `Report ${metricLabels.join(", ")} for ${placeLabel}, keeping the market-context as-of date separate from calendar-year regional sales.`
      : plan.intent.topic === "google_ads_context"
        ? `Report ${metricLabels.join(", ")} for ${placeLabel} by Ads report scope and date range, with the inferred CBSA mapping clearly labeled.`
        : plan.intent.topic === "multi_market_comparison"
          ? `Compare ${placeLabel} on ${metricLabels.join(", ")} as descriptive aggregate clinic-market activity, not as an approved operating KPI.`
          : plan.intent.topic === "multi_source_evidence"
            ? `Assemble ${sourceLabels.join(", ")} for ${placeLabel}, preserving each source's own period, provenance, and limitations.`
            : plan.intent.topic === "source_coverage"
              ? `Report which normalized source families are present or absent for ${placeLabel}; data presence is not data quality or market attractiveness.`
              : screening
                ? "Rank complete-evidence regional growth-test candidates with the fixed registered hypothesis score, show every contribution and exclusion, and stop before test or spend approval."
                : plan.intent.conciseInterpretation;

  const timeframe = plan.intent.topic === "clinic_context" || plan.intent.topic === "multi_market_comparison"
    ? "Clinic activity timeframe: Pre-PH in the supplied aggregate snapshot"
    : plan.intent.topic === "regional_context"
      ? "Market context as of 2026-07-31; regional demand by calendar year 2024, 2025, and partial 2026"
      : plan.intent.topic === "google_ads_context"
        ? "Google Ads report period: 2026-07-18 to 2026-08-16"
        : plan.intent.topic === "multi_source_evidence"
          ? "Source-native periods: market context as of 2026-07-31, regional demand by year, clinic timeframe Pre-PH, and Ads 2026-07-18 to 2026-08-16"
          : plan.intent.topic === "source_coverage"
            ? "Presence in normalized snapshot normalized-market-data-2026-08-17-v1"
            : screening
              ? "2024 to 2025 regional demand, market context as of 2026-07-31, and 2026-07-18 to 2026-08-16 Google Ads reports"
              : investigation.period;

  const growthConsiderations: AnalysisConsideration[] = [
    { id: "regionalDemandGrowth2024To2025", label: "Regional demand growth", metric: "2024 to 2025 regional net-sales growth", role: "weighted_preference", evidenceStatus: "connected", weightPercent: GROWTH_TEST_SCREENING_WEIGHTS.regionalDemandGrowth2024To2025 * 100, whyItMatters: "Measures directional change in the supplied regional demand aggregate." },
    { id: "activeCustomersPer1000Households", label: "Customer concentration", metric: "Active customers per 1,000 households", role: "weighted_preference", evidenceStatus: "connected", weightPercent: GROWTH_TEST_SCREENING_WEIGHTS.activeCustomersPer1000Households * 100, whyItMatters: "Adds a scale-adjusted customer-context signal." },
    { id: "activeCustomerYoyGrowth", label: "Active-customer growth", metric: "Active-customer year-over-year growth", role: "weighted_preference", evidenceStatus: "connected", weightPercent: GROWTH_TEST_SCREENING_WEIGHTS.activeCustomerYoyGrowth * 100, whyItMatters: "Adds a second directional customer signal without claiming causality." },
    { id: "veterinarySearchConversions", label: "Veterinary search conversions", metric: "Google Ads veterinary-search conversions", role: "weighted_preference", evidenceStatus: "partial", weightPercent: GROWTH_TEST_SCREENING_WEIGHTS.veterinarySearchConversions * 100, whyItMatters: "Adds an intent signal, with inferred demo geography kept visible." },
    { id: "householdCount", label: "Household scale", metric: "Public Census household count", role: "weighted_preference", evidenceStatus: "connected", weightPercent: GROWTH_TEST_SCREENING_WEIGHTS.householdCount * 100, whyItMatters: "Adds market scale as context rather than treating households as demand." },
  ];
  const descriptiveConsiderations: AnalysisConsideration[] = [
    { id: "question_metrics", label: "Requested measures", metric: metricLabels.join(", ") || sourceLabels.join(", "), role: "context_only", evidenceStatus: "connected", weightPercent: null, whyItMatters: "The response must stay faithful to the measures and sources named in the question." },
    { id: "geography_quality", label: "Geography quality", metric: `Exact CBSA IDs: ${plan.geographyResolution.selectedCbsaCodes.join(", ") || "national registered cohort"}`, role: "validity_gate", evidenceStatus: plan.intent.sourceFamilies.includes("google_ads") ? "partial" : "connected", weightPercent: null, whyItMatters: "A value attached to the wrong market would invalidate the result." },
    { id: "period_and_scope", label: "Period and scope", metric: timeframe, role: "validity_gate", evidenceStatus: "connected", weightPercent: null, whyItMatters: "Values from different source periods must not be represented as one simultaneous observation." },
    { id: "missingness", label: "Completeness", metric: plan.intent.topic === "source_coverage" ? "Present and absent source flags" : "Null and unavailable values retained", role: "validity_gate", evidenceStatus: "partial", weightPercent: null, whyItMatters: "Missing values are shown or excluded, never silently imputed." },
  ];
  return {
    version: "1.0.0",
    planId: plan.planId,
    status: "proposed",
    originalQuestion: plan.originalQuestion,
    rewrittenQuestion,
    perspectiveId: plan.perspectiveId,
    geography: plan.geographyResolution.message,
    timeframe,
    assumptions: screening
      ? ["Use only markets with all five configured screening inputs", "Do not redistribute weights when a market is incomplete", "Treat the score and rank as Hypothesis evidence for local demonstration only"]
      : ["Use exact resolved CBSA identifiers from the planner", "Preserve nulls and inferred-geography warnings", "Treat every result as descriptive evidence rather than a causal or final decision"],
    currentScreen: {
      inputs: [...sourceLabels, ...plan.intent.selectedQueries.map((query) => `Registered query: ${query}`)],
      method: screening
        ? `${GROWTH_TEST_SCREENING_VERSION}: fixed 30/25/20/15/10 lower-count percentile weights, complete-case exclusion, and CBSA-code tie-breaking`
        : plan.intent.topic === "source_coverage"
          ? "Return source-presence flags for the named CBSA without converting coverage into a quality or opportunity score"
          : `Return ${metricLabels.join(", ") || "canonical source-native metrics"} with deterministic source precedence and no hidden composite score`,
      considerationEditsRecalculate: false,
      weightMode: screening ? "fixed_calculation" : "none",
    },
    queryContract: {
      topic: plan.intent.topic,
      geographyIds: plan.geographyResolution.selectedCbsaCodes.map((code) => `cbsa:${code}`),
      sourceFamilies: plan.intent.sourceFamilies,
      registeredQueries: plan.intent.selectedQueries,
      requestedMetrics: [...plan.intent.requestedMetrics],
      scoringVersion: screening ? GROWTH_TEST_SCREENING_VERSION : null,
      missingDataRule: screening ? "Exclude any market missing a configured input; do not renormalize weights." : "Preserve missing values and return an explicit missing-evidence statement.",
    },
    considerations: screening ? growthConsiderations : descriptiveConsiderations,
    confirmedAt: null,
  };
}

function configuredDemoBrief(plan: EvaluationPlan): AnalysisBrief | null {
  if (plan.planId === "plan-demo-market-context-phoenix") return {
    version: "1.0.0", planId: plan.planId, status: "proposed", originalQuestion: plan.originalQuestion,
    rewrittenQuestion: plan.intent.conciseInterpretation, perspectiveId: plan.perspectiveId,
    geography: plan.geographyResolution.message, timeframe: "Frozen regional snapshot through 2026-07-31 plus 2024 ACS context",
    assumptions: ["Use CBSA 38060 as the configured demo market", "Treat customer and Census measures as descriptive context", "Keep missing SEO, pricing, competitor, campaign, capacity, and outcome evidence visible"],
    currentScreen: { inputs: ["Phoenix aggregate customer observations", "Public ACS market context", "Registered source-status manifest"], method: "Registered exact-CBSA evidence retrieval with no opportunity score", considerationEditsRecalculate: false },
    considerations: [
      { id: "regional_customer_context", label: "Regional customer context", metric: "Active customers, prior-year customers, year-over-year growth, and customers per 1,000 households", role: "context_only", evidenceStatus: "connected", weightPercent: null, whyItMatters: "Describes the current market without asserting incremental demand." },
      { id: "public_market_context", label: "Public market context", metric: "Population and households for CBSA 38060", role: "context_only", evidenceStatus: "connected", weightPercent: null, whyItMatters: "Provides a compatible public denominator and market description." },
      { id: "missing_market_evidence", label: "Missing market evidence", metric: "Regional SEO, pricing, competitor, clinic capacity, and campaign outcomes", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "These gaps could materially change an opportunity interpretation." },
    ], confirmedAt: null,
  };
  if (plan.planId === "plan-demo-clinic-performance-synthetic") return {
    version: "1.0.0", planId: plan.planId, status: "proposed", originalQuestion: plan.originalQuestion,
    rewrittenQuestion: "Compare Synthetic South Clinic with the three-clinic synthetic peer group on completed appointments at 38 weeks since opening, then assess the limits of that comparison.",
    perspectiveId: plan.perspectiveId, geography: "Synthetic three-clinic portfolio cohort", timeframe: "Shared 38-week maturity point in the checked-in synthetic fixture",
    assumptions: ["Use completed appointments as the configured demo outcome", "Use all three synthetic clinics as the illustrative peer group", "Do not treat the result as a production clinic judgment"],
    currentScreen: { inputs: ["Synthetic aggregate clinic fixture", "Completed appointments", "Exact 38-week maturity rule"], method: "Deterministic rank within a compatible three-row synthetic cohort", considerationEditsRecalculate: false },
    considerations: [
      { id: "outcome", label: "Outcome", metric: "Completed appointments", role: "validity_gate", evidenceStatus: "partial", weightPercent: null, whyItMatters: "The demo outcome is explicit, but its production definition is not approved." },
      { id: "peer_group", label: "Peer group", metric: "SYN-CVC-001, SYN-CVC-002, and SYN-CVC-003", role: "validity_gate", evidenceStatus: "partial", weightPercent: null, whyItMatters: "The illustrative cohort is explicit, but the production peer-group rule is not approved." },
      { id: "maturity", label: "Maturity", metric: "38 weeks since opening", role: "validity_gate", evidenceStatus: "connected", weightPercent: null, whyItMatters: "A shared maturity point prevents an incompatible age comparison in the fixture." },
      { id: "quality", label: "Quality", metric: "Source quality status and warnings", role: "validity_gate", evidenceStatus: "partial", weightPercent: null, whyItMatters: "The selected synthetic clinic carries a warning that must remain visible." },
    ], confirmedAt: null,
  };
  if (plan.planId === "plan-demo-growth-test-phoenix") return {
    version: "1.0.0", planId: plan.planId, status: "proposed", originalQuestion: plan.originalQuestion,
    rewrittenQuestion: plan.intent.conciseInterpretation, perspectiveId: plan.perspectiveId,
    geography: plan.geographyResolution.message, timeframe: "Frozen regional snapshot through 2026-07-31 and Google Ads matched-location reports through 2026-08-16",
    assumptions: ["Use Phoenix signals as descriptive opportunity context", "Treat the intuitive Google Ads-to-Phoenix mapping as Hypothesis evidence", "Stop before launch, spend, activation, ranking, or causal claims"],
    currentScreen: { inputs: ["Phoenix aggregate customer observations", "Census-assisted inferred Google Ads context", "Open test and measurement gates"], method: "Descriptive evidence assembly, visible geography inference, and launch-readiness gating", considerationEditsRecalculate: false },
    considerations: [
      { id: "regional_signal", label: "Regional signal", metric: "Active-customer growth and customer concentration", role: "context_only", evidenceStatus: "connected", weightPercent: null, whyItMatters: "Frames a measurable hypothesis without proving incremental opportunity." },
      { id: "ads_geography", label: "Advertising geography", metric: "Inferred Phoenix mapping with provider-stable geography still missing", role: "validity_gate", evidenceStatus: "partial", weightPercent: null, whyItMatters: "The demo may use a visible intuitive mapping, but ranking or production use still requires a stable or reviewed bridge." },
      { id: "measurement", label: "Measurement design", metric: "Pre-period, outcome, exposure, control, contamination, and stop conditions", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "A descriptive signal cannot establish causal lift or test validity." },
      { id: "approvals", label: "Launch approvals", metric: "Design, measurement, privacy, budget, and activation approval", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "The demo must stop before any campaign activation or spend authorization." },
    ], confirmedAt: null,
  };
  return null;
}

export function buildAnalysisBrief(plan: EvaluationPlan, investigation: MarketInvestigation): AnalysisBrief {
  const demoBrief = configuredDemoBrief(plan);
  if (demoBrief) return demoBrief;
  if (plan.intent.topic === "clinic_location") return clinicLocationQuestionBrief(plan, investigation);
  const normalizedBrief = normalizedQuestionBrief(plan, investigation);
  if (normalizedBrief) return normalizedBrief;
  const considerations = plan.perspectiveId === "cvc"
    ? cvcExplorationConsiderations()
    : plan.perspectiveId === "marketing"
      ? marketingConsiderations()
      : pricingConsiderations();
  const assumptions = plan.perspectiveId === "cvc"
    ? ["Use metropolitan CBSAs as the first comparison unit", "Treat mapped clinics as published footprint—not verified capacity or access", "Keep Census measures as market context rather than demand", "Return investigation leads rather than an opportunity ranking"]
    : plan.perspectiveId === "marketing"
      ? ["Use metropolitan CBSAs as the first peer-search unit", "Treat structural peers as feasibility leads, not assigned test or control markets", "Require pre-period outcomes and exposure checks before experiment design"]
      : ["Use metropolitan CBSAs as the initial comparison unit", "Do not infer elasticity from public context", "Require compatible price exposure and customer outcomes before recommending a regional strategy"];

  return {
    version: "1.0.0",
    planId: plan.planId,
    status: "proposed",
    originalQuestion: plan.originalQuestion,
    rewrittenQuestion: plan.perspectiveId === "cvc" ? cvcExplorationQuestion(plan) : plan.intent.conciseInterpretation,
    perspectiveId: plan.perspectiveId,
    geography: plan.geographyResolution.mode === "national" ? "U.S. metropolitan CBSAs" : plan.geographyResolution.message,
    timeframe: investigation.period,
    assumptions,
    currentScreen: {
      inputs: investigation.measuresExamined,
      method: investigation.screeningScope.selectionRule,
      considerationEditsRecalculate: false,
    },
    considerations,
    confirmedAt: null,
  };
}

export function analysisBriefWeightTotal(brief: AnalysisBrief) {
  return brief.considerations.reduce((total, item) => total + (item.weightPercent ?? 0), 0);
}
