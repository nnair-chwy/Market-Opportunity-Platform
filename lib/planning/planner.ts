import {
  assessCapabilityQuestion,
  type CapabilityQuestion,
} from "../capability-registry.ts";
import {
  evaluationPlanSchema,
  planningIntentSchema,
  type EvaluationPlan,
  type PlanningIntent,
  type PlannedAction,
} from "./contracts.ts";
import { derivePlanFindings, deriveResultWorkspaceType } from "./findings.ts";
import { extractRequestedPlaces, normalizeRequestedPlaces, resolveGeography } from "./geography.ts";
import { buildPlanSteps } from "./steps.ts";
import type { SelectedGeographicContext } from "./geographic-context.ts";
import { buildAnswerContract } from "./answer-contract.ts";
import { validateAnswerContract } from "./answer-contract-validator.ts";
import type { DecisionFramingProposal } from "./decision-framing.ts";
import type { PerspectiveViewId } from "../perspectives/contracts.ts";
import { getDefaultView, selectPerspectiveView } from "../perspectives/index.ts";

const MARKETING_INCREASE_SPEND_INTENT = /\b(?:increase|raise|grow|expand|add|allocate|shift|move)\w*\b[^?.]{0,64}\b(?:ad(?:vertising)?|media|paid[ -]?search)?\s*(?:spend|budget)\b|\b(?:spend|budget)\b[^?.]{0,64}\b(?:more(?!\s+than\b)|increase|raise|grow|expand|add|allocate|shift|move)\w*\b|\bspend\s+more(?!\s+than\b)\b[^?.]{0,32}\b(?:ads?|advertising|media|paid[ -]?search)\b/i;
const MARKETING_COST_INTENT = /\b(cost per click|cpc|ad cost|ad costs|paying|overpay\w*|paid too much|too much on ads?|spend(?:ing)? more than (?:we )?should|spend efficiency|budget efficiency|waste\w*|reduce\w* spend|decrease\w* spend|cut\w* spend)\b/;
const PRICING_INVESTIGATION_INTENT = /\b(competitor|availability|offers?|pricing)\w*\b.*\b(condition|economics?|investigat|signals?|validat|warrant)\w*\b|\b(investigat|validat|warrant)\w*\b.*\b(competitor|availability|offers?|pricing)\w*\b/;

function inferredViewId(question: string, perspectiveId: EvaluationPlan["perspectiveId"]): PerspectiveViewId | undefined {
  const value = question.toLowerCase();
  if (perspectiveId === "marketing") {
    if (MARKETING_INCREASE_SPEND_INTENT.test(value)) return "paid_search_response";
    if (MARKETING_COST_INTENT.test(value)) return "paid_search_cpc";
    if (/\b(click-through|click through|ctr)\b/.test(value)) return "paid_search_ctr";
    if (/\b(impressions?|delivery|reach)\b/.test(value)) return "paid_search_impressions";
    if (/\b(clicks?|response)\b/.test(value)) return "paid_search_response";
  }
  if (perspectiveId === "pricing") {
    if (/\b(observed price|offer price|price level)\b/.test(value)) return "observed_equalized_price";
    if (/\b(observation volume|observations?|coverage)\b/.test(value)) return "offer_observation_volume";
    if (/\b(assortment|breadth)\b/.test(value)) return "assortment_breadth";
    if (/\b(competitor availability|competitive availability)\b/.test(value)) return "competitor_availability";
  }
  return undefined;
}

function has(value: string, expression: RegExp) {
  return expression.test(value);
}

const DESCRIPTIVE_CLINIC_COMPARISON_METRICS: PlanningIntent["requestedMetrics"] = [
  "total_orders",
  "total_customers",
  "rx_orders",
  "net_sales",
  "rx_net_sales",
];

const NORMALIZED_QUERY_BY_SOURCE = {
  census: "regional_context_by_cbsa",
  regional: "regional_context_by_cbsa",
  clinic: "clinic_context_by_cbsa",
  google_ads: "google_ads_context_by_cbsa",
  consumer_insights: "consumer_insights_by_cbsa",
} as const;

const CONSUMER_INSIGHTS_QUERIES: PlanningIntent["selectedQueries"] = [
  "consumer_insights_by_cbsa",
  "brand_funnel_by_cbsa",
  "brand_relevance_drivers_by_cbsa",
  "brand_health_by_cbsa",
];

const CLINIC_LOCATION_DEFAULT_METRICS: PlanningIntent["requestedMetrics"] = [
  "total_population",
  "household_count",
  "median_household_income",
  "population_density",
  "active_customer_count",
  "active_customer_yoy_growth",
  "active_customers_per_1000_households",
  "regional_net_sales",
  "clinic_count",
  "total_customers",
  "total_orders",
  "net_sales",
];

function queryAwareClinicLocationIntent(question: string, intent: PlanningIntent): PlanningIntent {
  if (intent.topic !== "clinic_location") return intent;
  const hasNamedMarket = intent.requestedPlaces.length > 0;
  if (!hasNamedMarket) {
    return planningIntentSchema.parse({
      ...intent,
      selectedQueries: [],
      rankingMode: "none",
      sort: null,
      conciseInterpretation: "Review national CVC footprint and public market context as investigation leads, then identify the governed evidence required before any market screening or clinic-opening decision.",
    });
  }
  const sourceFamilies: PlanningIntent["sourceFamilies"] = ["census", "regional", "clinic"];
  if (intent.sourceFamilies.includes("google_ads") || /\b(google ads?|ad spend|advertising|media)\b/i.test(question)) sourceFamilies.push("google_ads");
  const selectedQueries: PlanningIntent["selectedQueries"] = ["regional_context_by_cbsa", "clinic_context_by_cbsa"];
  if (sourceFamilies.includes("google_ads")) selectedQueries.push("google_ads_context_by_cbsa");
  const requestedMetrics = [...new Set([...intent.requestedMetrics, ...CLINIC_LOCATION_DEFAULT_METRICS])].slice(0, 12) as PlanningIntent["requestedMetrics"];
  const placeLabel = intent.requestedPlaces.map((place) => place.name).join(" and ");
  return planningIntentSchema.parse({
    ...intent,
    requestedAction: intent.requestedAction === "approve" ? "approve" : "investigate",
    requestedMetrics,
    sourceFamilies,
    selectedQueries,
    rankingMode: "none",
    sort: null,
    conciseInterpretation: `Review connected market, regional, and aggregate clinic evidence for ${placeLabel}, then identify missing capacity, workforce, competitive, property, and economic evidence before considering a clinic.`,
  });
}

export function validatePlanningIntentConsistency(intent: PlanningIntent): string[] {
  const issues: string[] = [];
  const querySet = new Set(intent.selectedQueries);

  if (intent.topic === "multi_market_comparison") {
    if (intent.requestedAction !== "compare") issues.push("Multi-market comparison requires compare action.");
    if (intent.requestedPlaces.length < 2 || intent.requestedPlaces.length > 5) issues.push("Multi-market comparison requires two to five named markets.");
  }
  if (intent.topic === "multi_source_evidence" && intent.sourceFamilies.length < 2) {
    issues.push("Multi-source evidence requires at least two source families.");
  }
  if (intent.topic === "source_coverage" && !querySet.has("supported_regions")) {
    issues.push("Source coverage requires the supported-regions query.");
  }
  if (intent.topic === "consumer_insights") {
    if (!intent.sourceFamilies.includes("consumer_insights")) issues.push("Consumer-insights questions require the consumer_insights source family.");
    if (!intent.selectedQueries.some((query) => CONSUMER_INSIGHTS_QUERIES.includes(query))) issues.push("Consumer-insights questions require a registered consumer-insights query.");
    if (intent.rankingMode !== "none" || intent.sort !== null) issues.push("Consumer-insights review cannot carry a ranking mode or sort.");
  }
  if (intent.topic === "growth_test_screening") {
    if (intent.rankingMode !== "growth_test_screening_v1" || !querySet.has("growth_test_screening")) {
      issues.push("Growth screening requires its registered ranking mode and query.");
    }
  } else if (intent.rankingMode !== "none") {
    issues.push("Ranking mode is only valid for growth-test screening.");
  }
  if (intent.topic === "clinic_location") {
    if (intent.rankingMode !== "none" || intent.sort !== null) issues.push("Clinic-location evidence review cannot carry a ranking mode or sort.");
    if (intent.requestedPlaces.length) {
      if (!querySet.has("regional_context_by_cbsa") || !querySet.has("clinic_context_by_cbsa")) {
        issues.push("Named-market clinic-location review requires registered regional and clinic context queries.");
      }
      for (const family of ["census", "regional", "clinic"] as const) {
        if (!intent.sourceFamilies.includes(family)) issues.push(`Named-market clinic-location review requires the ${family} source family.`);
      }
    } else if (intent.selectedQueries.length) {
      issues.push("National clinic-location review cannot execute exact-CBSA queries without a selected geography.");
    }
  }
  for (const family of intent.sourceFamilies) {
    const expectedQuery = NORMALIZED_QUERY_BY_SOURCE[family];
    if (["regional_context", "clinic_context", "google_ads_context", "multi_source_evidence", "multi_market_comparison", "clinic_location"].includes(intent.topic)
      && intent.requestedPlaces.length > 0
      && !querySet.has(expectedQuery)) {
      issues.push(`${family} evidence requires ${expectedQuery}.`);
    }
  }
  return issues;
}

function decisionInterpretationForView(
  question: string,
  perspectiveId: EvaluationPlan["perspectiveId"],
  activeViewId: PerspectiveViewId | undefined,
  fallback: string,
) {
  const value = question.toLowerCase();

  if (perspectiveId === "marketing") {
    if (has(value, MARKETING_INCREASE_SPEND_INTENT)) {
      return "Find regions where paid-search response, efficient delivery, and scale support a bounded incremental-spend test. Validate orders, new customers, contribution, campaign comparability, and incrementality before a lasting budget change.";
    }
    if (activeViewId === "paid_search_cpc" || has(value, MARKETING_COST_INTENT)) {
      return "Identify regions where paid-search cost per click is high and attributed conversion efficiency is weak versus structurally comparable markets, then test campaign mix and commercial outcomes before calling it overpayment.";
    }
    if (activeViewId === "paid_search_ctr" || has(value, /\b(click-through|click through|ctr)\b/)) {
      return "Identify regions where paid-search click-through rate differs from comparable campaign and geography cohorts, then determine which audience, creative, and placement evidence could explain the contrast.";
    }
    if (activeViewId === "paid_search_impressions" || has(value, /\b(impressions?|delivery|reach)\b/)) {
      return "Identify regions where paid-search impression delivery is unusually high or low, then test whether demand, budget allocation, targeting, or auction availability explains the pattern.";
    }
    if (activeViewId === "paid_search_response" || has(value, /\b(clicks?|response)\b/)) {
      return "Identify regions where paid-search response differs from comparable geography cohorts, then determine which campaign, audience, and outcome evidence is needed to explain and validate the pattern.";
    }
  }

  if (perspectiveId === "pricing") {
    if (has(value, /\b(raise|raising|increase|increasing|higher)\b.{0,24}\b(prices?|pricing)\b|\b(prices?|pricing)\b.{0,24}\b(raise|raising|increase|increasing|higher)\b/)) {
      return "Identify regions where Chewy could evaluate raising prices, then test comparable current prices, customer demand and conversion, unit economics, competitive price position, and product comparability before recommending a change.";
    }
    if (activeViewId === "observed_equalized_price" || has(value, /\b(observed price|offer price|price level)\b/)) {
      return "Identify regions where observed equalized offer prices differ, then validate product comparability, observation coverage, timing, and business outcomes before recommending a pricing action.";
    }
    if (activeViewId === "offer_observation_volume" || has(value, /\b(observation volume|observations?|coverage)\b/)) {
      return "Identify regions with unusually strong or weak offer-observation coverage and determine whether the evidence is sufficient for a defensible regional pricing comparison.";
    }
    if (activeViewId === "assortment_breadth" || has(value, /\b(assortment|breadth)\b/)) {
      return "Identify regional differences in observed assortment breadth, then test whether retailer coverage, product mix, and observation quality explain the contrast.";
    }
    if (activeViewId === "competitor_availability" || has(value, /\b(competitor availability|competitive availability)\b/)) {
      return "Identify regions where monitored competitor availability differs, then validate retailer coverage, assortment comparability, and timing before drawing a pricing conclusion.";
    }
  }

  return fallback;
}

export function inferPlanningIntent(question: string): PlanningIntent {
  const value = question.toLowerCase();
  const growthLanguage = has(value, /\b(ad|ads|adwords|campaign|advertis\w*|paid search|promotion|growth test|marketing|media|test market|control market|reach)\b/);
  const consumerInsights = has(value, /\b(consumer insights?|consumer awareness|brand health|brand-health|bdi|cdi|brand funnel|brand relevance|brand drivers?|relevance drivers?|brand awareness|brand development(?: and category development)? index(?:es)?|category development index(?:es)?|familiarity|consideration|usage p12m|gen ?z|millennials?)\b/)
    || (has(value, /\bawareness\b/) && !growthLanguage);
  const clinic = has(value, /\b(clinic|clinics|vet care|veterinary)\b/);
  const performance = clinic && has(value, /\b(performance|peer|underperform|operating)\b/);
  const clinicMetric = has(value, /\b(rx|prescription|prescriptions|clinic orders?|clinic sales?|clinic customers?|total orders?|total customers?)\b/);
  const ads = has(value, /\b(google ads?|ads?|ad spend|advertising|impressions?|clicks?|conversions?)\b/);
  const coverage = has(value, /\b(coverage|available sources?|data availability|have both|has both)\b/)
    || has(value, /\bwhat evidence (?:is|are) available\b/)
    || has(value, /\bwhat (?:data|evidence) (?:is|are) available\b/)
    || has(value, /\bwhich (?:markets?|regions?|metros?|cbsas?) (?:have|has|contain|include)\b[^?.]{0,120}\b(?:data|evidence|sources?)\b/);
  const growth = growthLanguage || has(value, /\bawareness\b/);
  const growthScreening = has(value, /\b(strongest|rank|ranking|prioriti[sz]e|screen|candidates?)\b/)
    && has(value, /\b(growth|regional opportunity|test market|growth test)\b/);
  const growthDecision = has(value, /\b(geo.?test|test markets?|acquisition efficiency|incrementality|causal lift)\b/);
  const pricing = has(value, /\b(prices?|pricing|elasticity|promo)\b/);
  const location = clinic && has(value, /\b(open|opening|location|site|where|investigate)\b/) && !performance;
  const vague = has(value, /\bwhat should we do next\b/) || has(value, /\bwhat next\b/);
  const requestedMeasure: PlanningIntent["requestedMeasure"] = has(value, /\bdens/) ? "population_density"
      : has(value, /\bincome|affluence|ability to pay/) ? "median_household_income"
        : has(value, /\bhousehold/) ? "household_count"
          : has(value, /\bhousing/) ? "housing_unit_count"
            : has(value, /\bpopulation|people|resident|market size/) ? "total_population"
              : "none";
  const requestedMetrics: PlanningIntent["requestedMetrics"] = [];
  const addMetric = (metric: PlanningIntent["requestedMetrics"][number], expression: RegExp) => {
    if (has(value, expression) && !requestedMetrics.includes(metric)) requestedMetrics.push(metric);
  };
  if (requestedMeasure !== "none") requestedMetrics.push(requestedMeasure);
  addMetric("active_customer_yoy_growth", /\b(active customer|customer).{0,12}(grow\w*|yoy|year.over.year)|\bgrow\w*.{0,12}(active customer|customer)/);
  addMetric("active_customers_per_1000_households", /\bcustomers?.{0,18}(per|\/).{0,8}(1,?000|thousand).{0,10}households?|\bcustomer concentration/);
  addMetric("active_customer_count", /\bactive customers?\b/);
  addMetric("prior_year_active_customer_count", /\bprior.year customers?\b/);
  addMetric("regional_net_sales", /\bregional (?:net )?sales\b/);
  addMetric("clinic_count", /\bclinic count|number of clinics\b/);
  addMetric("total_customers", /\b(?:aggregate |total )?clinic customers?|\btotal customers?\b/);
  addMetric("total_orders", /\b(?:aggregate |total )?clinic orders?|\btotal orders?\b/);
  addMetric("rx_orders", /\b(rx|prescription|prescriptions) orders?\b|\bprescriptions?\b/);
  if (!has(value, /\bregional (?:net )?sales\b/)) addMetric("net_sales", /\bclinic (?:net )?sales\b|\bnet sales\b/);
  addMetric("rx_net_sales", /\b(rx|prescription) (?:net )?sales\b/);
  if (clinic && has(value, /\bcustomers?\b/) && !requestedMetrics.includes("total_customers")) requestedMetrics.push("total_customers");
  if (clinic && has(value, /\bsales?\b/) && !requestedMetrics.includes("net_sales")) requestedMetrics.push("net_sales");
  if (clinic && has(value, /\bprescriptions?\b/) && has(value, /\bsales?\b/) && !requestedMetrics.includes("rx_net_sales")) requestedMetrics.push("rx_net_sales");
  addMetric("google_ads_spend", /\b(google ads?|ad|advertising) spend\b/);
  if (ads && /\b(spend|budget)\b/.test(value) && !requestedMetrics.includes("google_ads_spend")) requestedMetrics.push("google_ads_spend");
  addMetric("google_ads_impressions", /\bimpressions?\b/);
  addMetric("google_ads_clicks", /\bclicks?\b/);
  addMetric("google_ads_conversions", /\bconversions?\b/);
  addMetric("consumer_bdi", /\bbdi\b|brand development(?: and category development)? index(?:es)?\b/);
  addMetric("consumer_cdi", /\bcdi\b|category development index(?:es)?\b/);
  addMetric("brand_funnel", /\bbrand funnel|awareness|familiarity|consideration|usage p12m\b/);
  addMetric("brand_relevance", /\bbrand relevance|relevance score\b/);
  addMetric("brand_drivers", /\bbrand drivers?|\bdrivers?\b|driver ranking|reasons? customers? choose\b/);
  addMetric("generation_brand_health", /\bgeneration|gen ?z|millennials?\b/);
  if (coverage) requestedMetrics.push("source_coverage");
  if (growthScreening) requestedMetrics.push("growth_test_screening_score");
  const requestedAction: PlanningIntent["requestedAction"] = coverage ? "describe"
    : has(value, /\b(approve|authorize|sign)\b/) ? "approve"
    : has(value, /\b(why|driver|investigate|underperform)\b/) ? "investigate"
      : has(value, /\b(compare|versus| vs |relative to)\b/) ? "compare"
        : has(value, /\b(best|which|strongest|rank|ranking|screen|prioritize|prioritise|where)\b/) ? "screen"
          : "describe";
  const requestedPlaces = extractRequestedPlaces(question);
  const multiMarket = requestedPlaces.length >= 2 && requestedAction === "compare";
  const mentionsRegional = has(value, /\b(regional|market|metro|cbsa|population|household|housing|income|density|city)\b/);
  if (has(value, /\bregional\b/) && has(value, /\bcustomers?\b/) && !requestedMetrics.includes("active_customer_count")) requestedMetrics.push("active_customer_count");
  if (has(value, /\bregional\b/) && has(value, /\b(?:net )?sales\b/) && !requestedMetrics.includes("regional_net_sales")) requestedMetrics.push("regional_net_sales");
  if (multiMarket && performance && !requestedMetrics.length) requestedMetrics.push(...DESCRIPTIVE_CLINIC_COMPARISON_METRICS);
  const sourceFamilies: PlanningIntent["sourceFamilies"] = [];
  if (requestedMeasure !== "none") sourceFamilies.push("census");
  if ((has(value, /\bregional\b/) && !pricing) || has(value, /\bmarket\b(?=.{0,20}\b(evidence|context|signals?)\b)/) || requestedMetrics.some((metric) => ["active_customer_count", "prior_year_active_customer_count", "active_customer_yoy_growth", "active_customers_per_1000_households", "regional_net_sales"].includes(metric))) sourceFamilies.push("regional");
  if (clinic || clinicMetric || requestedMetrics.some((metric) => ["clinic_count", "total_customers", "total_orders", "rx_orders"].includes(metric))) sourceFamilies.push("clinic");
  if (ads || requestedMetrics.some((metric) => metric.startsWith("google_ads_"))) sourceFamilies.push("google_ads");
  if (consumerInsights) sourceFamilies.push("consumer_insights");
  if (has(value, /\bevidence\b/) && has(value, /\bmarket\b/) && (sourceFamilies.includes("clinic") || sourceFamilies.includes("google_ads"))) sourceFamilies.push("regional");
  if (coverage && sourceFamilies.length === 0) sourceFamilies.push("census", "regional", "clinic", "google_ads");
  const uniqueSourceFamilies = [...new Set(sourceFamilies)];
  const explicitMultiSource = has(value, /\b(evidence|signals?|context)\b/) && uniqueSourceFamilies.length >= 2;
  const ambiguousEvidenceScope = has(value, /\b(market|regional)\b/) && has(value, /\b(evidence|signals?|context)\b/)
    && uniqueSourceFamilies.length < 2 && requestedMetrics.length === 0 && requestedMeasure === "none";
  const topic: PlanningIntent["topic"] = consumerInsights ? "consumer_insights"
    : growthScreening ? "growth_test_screening"
    : coverage ? "source_coverage"
      : growthDecision ? "local_growth"
      : multiMarket ? "multi_market_comparison"
            : explicitMultiSource ? "multi_source_evidence"
              : performance ? "clinic_performance"
                : location ? "clinic_location"
              : ads && requestedPlaces.length > 0 ? "google_ads_context"
                : clinicMetric || (clinic && requestedMetrics.length > 0) ? "clinic_context"
                  : pricing && (requestedAction === "screen" || requestedAction === "approve") ? "other"
                  : (mentionsRegional || uniqueSourceFamilies.includes("regional")) ? (uniqueSourceFamilies.includes("regional") ? "regional_context" : "market_context")
                    : growth ? "local_growth"
        : vague ? "other"
          : "other";
  const selectedQueries: PlanningIntent["selectedQueries"] = topic === "consumer_insights"
    ? [
        requestedMetrics.some((metric) => ["consumer_bdi", "consumer_cdi"].includes(metric)) || (requestedMetrics.length === 0 && !has(value, /\bbrand health\b/)) ? "consumer_insights_by_cbsa" : null,
        requestedMetrics.includes("brand_funnel") ? "brand_funnel_by_cbsa" : null,
        requestedMetrics.some((metric) => ["brand_relevance", "brand_drivers"].includes(metric)) ? "brand_relevance_drivers_by_cbsa" : null,
        requestedMetrics.includes("generation_brand_health") || (requestedMetrics.length === 0 && has(value, /\bbrand health\b/)) ? "brand_health_by_cbsa" : null,
      ].filter((query): query is PlanningIntent["selectedQueries"][number] => query !== null)
    : topic === "source_coverage" ? ["supported_regions"]
    : topic === "growth_test_screening" ? ["growth_test_screening"]
      : ["regional_context", "clinic_context", "google_ads_context", "multi_source_evidence", "multi_market_comparison"].includes(topic)
        ? uniqueSourceFamilies.flatMap((family) => family === "clinic" ? ["clinic_context_by_cbsa" as const]
        : family === "google_ads" ? ["google_ads_context_by_cbsa" as const]
          : family === "regional" || family === "census" ? ["regional_context_by_cbsa" as const] : [])
        : [];
  const uniqueQueries = [...new Set(selectedQueries)];
  const geographyGrain: PlanningIntent["geographyGrain"] = topic === "clinic_performance" ? "portfolio"
    : has(value, /\bsubmarket\b/) || (requestedPlaces.some((place) => /seattle/i.test(place.name)) && location)
      ? "submarket"
      : has(value, /\b(site|property|parcel)\b/) ? "site"
        : topic === "other" && !requestedPlaces.length ? "unknown"
          : "cbsa";
  const unresolvedContext = requestedPlaces.length === 0
    && (has(value, /\b(this|the selected|current) market\b/)
      || has(value, /\b(this|the selected|current) clinic\b/)
      || (has(value, /\bregional opportunity\b/) && !growthScreening));
  const clarificationRequired = vague
    || unresolvedContext
    || requestedPlaces.length > 5
    || (consumerInsights && requestedPlaces.length === 0)
    || ambiguousEvidenceScope
    || (requestedAction === "compare" && requestedPlaces.length < 2 && !performance && !has(value, /\b(u\.s\.|us |national|across)\b/))
    || topic === "other";
  const clarificationReason: PlanningIntent["clarificationReason"] = requestedPlaces.length > 5
    ? "ambiguous_comparison_cohort"
    : unresolvedContext
      ? "ambiguous_geography"
    : consumerInsights && requestedPlaces.length === 0
      ? "ambiguous_geography"
    : ambiguousEvidenceScope
      ? "ambiguous_requested_output"
    : vague || topic === "other"
    ? "ambiguous_decision"
    : requestedAction === "compare" && requestedPlaces.length < 2
      ? "ambiguous_comparison_cohort"
      : "none";
  const placeLabel = requestedPlaces.length
    ? requestedPlaces.map((place) => place.name).join(" and ")
    : "national CBSA context";
  const conciseInterpretation = unresolvedContext
    ? "Clarify the intended market or clinic before compiling evidence; no default geography or clinic is assumed."
    : topic === "other" || vague
    ? "Clarify the decision, geography, and required output before compiling a governed evaluation."
    : topic === "consumer_insights"
      ? `Review ${requestedMetrics.map((metric) => metric.replaceAll("_", " ")).join(", ") || "consumer and brand-health measures"} for ${placeLabel} using the normalized DMA snapshot and its intuitive CBSA alignment.`
      : topic === "clinic_performance"
      ? "Investigate operating-clinic performance against peers once approved aggregate evidence exists."
      : topic === "clinic_context"
        ? `Describe the requested aggregate clinic measures for ${placeLabel}; prescriptions are represented only by the supplied Rx-order fields.`
        : topic === "regional_context"
          ? `Describe the requested regional measures for ${placeLabel} from the registered normalized market context.`
        : topic === "google_ads_context"
          ? `Describe the requested Google Ads measures for ${placeLabel} using visibly inferred demo geography.`
          : topic === "source_coverage"
            ? "Identify markets with the requested normalized source coverage without treating coverage as opportunity."
            : topic === "multi_source_evidence"
              ? `Assemble ${uniqueSourceFamilies.join(", ")} evidence for ${placeLabel} while preserving each source's limitations.`
              : topic === "multi_market_comparison"
                ? `Compare ${placeLabel} on ${requestedMetrics.map((metric) => metric.replaceAll("_", " ")).join(", ") || "the requested compatible measures"}; this is descriptive aggregate clinic-market activity, not an approved operating KPI.`
                : topic === "growth_test_screening"
                  ? "Rank complete-evidence markets with the fixed growth-test-screening-v1 hypothesis score, report exclusions, and stop before launch or spend decisions."
      : topic === "local_growth"
        ? `Assess a local growth or campaign question for ${placeLabel} against approved measurement gates.`
        : topic === "clinic_location"
          ? `Investigate clinic-location evidence for ${placeLabel} using published footprint and governed public context, with missing business evidence kept visible.`
          : requestedAction === "compare"
            ? `Compare ${placeLabel} using the requested public market measure.`
            : `Describe ${placeLabel} with governed public market context.`;

  const explicitSort = requestedAction === "compare" && requestedMetrics.length === 1 && has(value, /\b(sort|rank|ranking|highest|lowest|ascending|descending|largest|smallest)\b/)
    ? { metric: requestedMetrics[0], direction: has(value, /\b(lowest|ascending|smallest)\b/) ? "asc" as const : "desc" as const }
    : null;

  return queryAwareClinicLocationIntent(question, planningIntentSchema.parse({
    topic,
    geographyGrain,
    requestedAction,
    requestedMeasure,
    requestedMetrics: [...new Set(requestedMetrics)],
    sourceFamilies: uniqueSourceFamilies,
    selectedQueries: uniqueQueries,
    sort: explicitSort,
    rankingMode: growthScreening ? "growth_test_screening_v1" : "none",
    requestedPlaces,
    clarificationRequired: clarificationRequired && clarificationReason !== "none",
    clarificationReason: clarificationRequired ? clarificationReason : "none",
    conciseInterpretation,
  }));
}

function requirementFor(intent: PlanningIntent): CapabilityQuestion["requirements"][number] {
  if (intent.topic === "consumer_insights") {
    return {
      capabilityId: "consumer_insights",
      outputId: intent.requestedMetrics.some((metric) => ["brand_funnel", "brand_relevance", "brand_drivers", "generation_brand_health"].includes(metric)) ? "brand_health_review" : "consumer_insights_profile",
      geographyGrain: "cbsa",
    };
  }
  if (intent.topic === "multi_market_comparison" && intent.sourceFamilies.includes("clinic")) {
    return { capabilityId: "clinic_site_evaluation", outputId: "candidate_site_comparison", geographyGrain: "cbsa" };
  }
  if (intent.topic === "clinic_performance") {
    return { capabilityId: "clinic_performance", outputId: "clinic_outcome_comparison", geographyGrain: "portfolio" };
  }
  if (intent.topic === "clinic_location" && intent.geographyGrain !== "cbsa") {
    return {
      capabilityId: "clinic_site_evaluation",
      outputId: "candidate_site_comparison",
      geographyGrain: intent.geographyGrain === "submarket" ? "submarket" : "site",
    };
  }
  if (intent.topic === "clinic_location") {
    return {
      capabilityId: "clinic_site_evaluation",
      outputId: intent.requestedAction === "approve" ? "final_site_decision" : "market_ranking",
      geographyGrain: "cbsa",
    };
  }
  if (intent.topic === "local_growth") {
    return { capabilityId: "local_growth_test", outputId: "growth_test_measurement", geographyGrain: "market" };
  }
  if (intent.topic === "clinic_context") {
    return { capabilityId: "clinic_site_evaluation", outputId: "candidate_site_comparison", geographyGrain: "cbsa" };
  }
  if (intent.topic === "google_ads_context" || intent.topic === "growth_test_screening") {
    return { capabilityId: "local_growth_test", outputId: "growth_test_measurement", geographyGrain: "market" };
  }
  return { capabilityId: "census_market_context", outputId: "market_context_profile", geographyGrain: "cbsa" };
}

function isNormalizedDemoTopic(topic: PlanningIntent["topic"]) {
  return [
    "regional_context",
    "clinic_context",
    "google_ads_context",
    "source_coverage",
    "multi_source_evidence",
    "multi_market_comparison",
    "growth_test_screening",
    "clinic_location",
    "consumer_insights",
  ].includes(topic);
}

function normalizedActionFor(intent: PlanningIntent): PlannedAction {
  const places = intent.requestedPlaces.map((place) => place.name).join(" and ") || "the eligible market cohort";
  const registeredEvidence = intent.selectedQueries.length
    ? intent.selectedQueries.map((query) => `Registered query: ${query}`)
    : [`Selected governed evidence: ${intent.conciseInterpretation}`];
  if (intent.topic === "clinic_location") return {
    id: "review-clinic-location-evidence",
    title: `Review clinic-location evidence for ${places}`,
    summary: "Review connected market, regional, and aggregate clinic evidence, then assign the missing capacity, workforce, competitive, property, and economics validation work.",
    owner: "CVC Strategy and Real Estate Analytics",
    timing: "Before site screening or opening approval",
    confidence: "Low",
    evidence: registeredEvidence,
    tradeoffs: ["Aggregate market and clinic activity does not establish site suitability", "No approved capacity, workforce, property, competitive-access, or clinic-economics evidence is connected"],
    nextStep: "Validate the connected Phoenix evidence and assign owners to collect capacity, workforce, competitive access, property and trade-area feasibility, economics, and accountable approval requirements.",
    outputId: "candidate_site_comparison",
    requiresApproval: intent.requestedAction === "approve",
  };
  if (intent.topic === "clinic_context") return {
    id: "review-clinic-context",
    title: `Review aggregate clinic activity for ${places}`,
    summary: "Confirm the reported clinic activity period and decide whether these descriptive aggregates are sufficient to frame a narrower operating question.",
    owner: "CVC Analytics",
    timing: "After evidence review",
    confidence: "Medium",
    evidence: registeredEvidence,
    tradeoffs: ["Aggregate market activity is not a clinic-level operating KPI", "Rx orders are a supplied prescription proxy, not a complete prescription outcome"],
    nextStep: "Validate the clinic activity timeframe and metric definitions, then specify any clinic-level outcome, maturity rule, and peer group needed for a real performance comparison.",
    outputId: "candidate_site_comparison",
    requiresApproval: false,
  };
  if (intent.topic === "regional_context") return {
    id: "review-regional-context",
    title: `Review regional customer and sales context for ${places}`,
    summary: "Review customer context and calendar-year regional sales as separate descriptive observations before forming an opportunity hypothesis.",
    owner: "Market Intelligence",
    timing: "After evidence review",
    confidence: "Medium",
    evidence: registeredEvidence,
    tradeoffs: ["Different source periods must remain separate", "Regional customer and sales levels do not establish incrementality"],
    nextStep: "Confirm period completeness and metric definitions, then identify the outcome or comparison baseline required for the intended decision.",
    outputId: "market_context_profile",
    requiresApproval: false,
  };
  if (intent.topic === "google_ads_context") return {
    id: "review-google-ads-context",
    title: `Review Google Ads scope and geography for ${places}`,
    summary: "Compare spend by report scope while keeping the matched-location-to-CBSA inference visible.",
    owner: "Marketing Science",
    timing: "Before using Ads evidence in a regional test",
    confidence: "Low",
    evidence: registeredEvidence,
    tradeoffs: ["Matched-location labels are not provider-stable market keys", "Spend alone does not measure incremental demand or test validity"],
    nextStep: "Review the two Ads report scopes and confirm a stable or human-reviewed geography bridge before using the values for regional selection or measurement.",
    outputId: "growth_test_measurement",
    requiresApproval: false,
  };
  if (intent.topic === "consumer_insights") return {
    id: "review-consumer-insights",
    title: `Review consumer and brand-health evidence for ${places}`,
    summary: "Inspect the dated DMA survey profile and brand-health measures after deterministic intuitive alignment to the selected CBSA market.",
    owner: "Consumer Insights and Market Intelligence",
    timing: "Before using the evidence in a market or growth discussion",
    confidence: "Medium",
    evidence: registeredEvidence,
    tradeoffs: ["The survey is dated 2024 evidence", "DMA-to-CBSA alignment is intuitive Derived context and requires owner review", "The measures are descriptive and not site-scoring inputs"],
    nextStep: "Review the source slide, sample, missingness, and DMA-to-CBSA mapping, then confirm whether a governed current refresh or licensed crosswalk is needed.",
    outputId: intent.requestedMetrics.some((metric) => ["brand_funnel", "brand_relevance", "brand_drivers", "generation_brand_health"].includes(metric)) ? "brand_health_review" : "consumer_insights_profile",
    requiresApproval: false,
  };
  if (intent.topic === "multi_market_comparison") {
    const clinicComparison = intent.sourceFamilies.includes("clinic");
    return {
      id: clinicComparison ? "review-descriptive-clinic-market-comparison" : "review-descriptive-market-comparison",
      title: clinicComparison
        ? `Review the descriptive clinic-market comparison for ${places}`
        : `Review the descriptive market comparison for ${places}`,
      summary: clinicComparison
        ? "Compare the five aggregate clinic activity measures market by market without converting them into an operating score or winner."
        : "Compare the requested governed measures market by market without converting them into an opportunity score or business recommendation.",
      owner: clinicComparison ? "CVC Analytics" : "Market Intelligence",
      timing: "After evidence review",
      confidence: "Medium",
      evidence: registeredEvidence,
      tradeoffs: clinicComparison
        ? ["Market aggregates do not measure individual clinic performance", "No approved KPI, maturity adjustment, or peer rule is applied"]
        : ["Descriptive differences do not establish business impact", "Source coverage, timing, and metric comparability remain visible"],
      nextStep: clinicComparison
        ? "Confirm that the source period and market aggregates are comparable, then define an approved clinic-level KPI and peer rule if a performance conclusion is needed."
        : "Confirm that source periods, geography, coverage, and metric definitions are comparable before drawing a narrower business conclusion.",
      outputId: clinicComparison ? "candidate_site_comparison" : "market_context_profile",
      requiresApproval: false,
    };
  }
  if (intent.topic === "multi_source_evidence") return {
    id: "reconcile-multi-source-evidence",
    title: `Reconcile regional, clinic, and Ads evidence for ${places}`,
    summary: "Review each source on its own period and scope, then identify which gaps prevent a combined market hypothesis.",
    owner: "Market Intelligence with CVC Analytics and Marketing Science",
    timing: "Before cross-source interpretation",
    confidence: "Low",
    evidence: registeredEvidence,
    tradeoffs: ["Source periods and grains differ", "Inferred Ads geography cannot be treated as a confirmed join"],
    nextStep: "Align the decision period, review the Ads geography mapping, and document which regional and clinic measures are compatible before combining them into a test hypothesis.",
    outputId: "market_context_profile",
    requiresApproval: false,
  };
  if (intent.topic === "source_coverage") return {
    id: "review-source-coverage-gaps",
    title: `Review evidence presence and gaps for ${places}`,
    summary: "Use source-presence flags to decide what evidence can be reviewed next, without interpreting coverage as quality or attractiveness.",
    owner: "Data Product and Market Intelligence",
    timing: "Before analytical scoping",
    confidence: "High",
    evidence: registeredEvidence,
    tradeoffs: ["Presence does not establish completeness or correctness", "Coverage is not an opportunity score"],
    nextStep: "Inspect the present source families for freshness, grain, and metric usability, then request only the missing evidence required by the intended decision.",
    outputId: "market_context_profile",
    requiresApproval: false,
  };
  return {
    id: "review-growth-test-screening",
    title: "Review growth-test screening hypotheses",
    summary: "Review score contributions, exclusions, and inferred Ads geography before selecting any market for test-design validation.",
    owner: "Marketing Science and Program Leadership",
    timing: "Before test-market selection or spend",
    confidence: "Low",
    evidence: registeredEvidence,
    tradeoffs: ["Complete-case screening excludes markets with missing inputs", "The fixed score is Hypothesis evidence and is not a launch recommendation"],
    nextStep: "Review the top candidates and excluded markets, then define outcome, control, exposure, contamination, budget, privacy, and stop rules before proposing a test.",
    outputId: "growth_test_measurement",
    requiresApproval: false,
  };
}

function actionsFor(
  intent: PlanningIntent,
  assessment: ReturnType<typeof assessCapabilityQuestion>,
  geography: ReturnType<typeof resolveGeography>,
  resultWorkspaceType: EvaluationPlan["resultWorkspaceType"],
): PlannedAction[] {
  if (resultWorkspaceType === "clarification") {
    return [{
      id: "clarify-question",
      title: "Clarify the evaluation question",
      summary: geography.message,
      owner: "Requesting analyst",
      timing: "Before evaluation",
      confidence: "High",
      evidence: ["Validated planning intent", "Capability registry boundary"],
      tradeoffs: ["Delays compilation", "Prevents unsupported routing"],
      nextStep: "Name the decision, geography or cohort, and required output, then resubmit.",
      outputId: "market_context_profile",
      requiresApproval: false,
    }];
  }

  if (isNormalizedDemoTopic(intent.topic) && (intent.topic !== "clinic_location" || intent.selectedQueries.length > 0)) {
    return [normalizedActionFor(intent)];
  }

  const context: PlannedAction = {
    id: "public-market-context",
    title: geography.mode === "compare"
      ? "Compare resolved markets on the national map"
      : geography.mode === "single"
        ? "Inspect the resolved market context"
        : "Explore governed market context",
    summary: geography.mode === "national" || geography.mode === "needs_selection"
      ? "Use the full national map and choose a market when selection is required."
      : geography.message,
    owner: "Market Intelligence",
    timing: "Available now",
    confidence: "High",
    evidence: ["Validated public Census aggregates", "Compatible CBSA geography", "Deterministic percentile comparison"],
    tradeoffs: ["Context is not an opportunity score", "Market boundaries are not trade areas"],
    nextStep: geography.selectedCbsaCodes.length
      ? "Verify the source boundary, then inspect the resolved market measure."
      : "Select a measure and market, then verify the source and evidence boundary.",
    outputId: "market_context_profile",
    requiresApproval: false,
  };

  if (intent.topic === "market_context") return [context];

  if (resultWorkspaceType === "evidence_readiness") {
    const gates: PlannedAction = {
      id: "resolve-evidence-gates",
      title: "Resolve evidence and approval gates",
      summary: assessment.message,
      owner: "Accountable decision owner",
      timing: "Before prioritization",
      confidence: "Medium",
      evidence: assessment.missingEvidence.length ? assessment.missingEvidence : ["Capability registry assessment"],
      tradeoffs: ["Delays a consequential comparison", "Prevents unsupported data or approvals from being inferred"],
      nextStep: "Assign owners to each missing evidence item and approval, then rerun the question.",
      outputId: requirementFor(intent).outputId,
      requiresApproval: assessment.missingApprovals.length > 0 || intent.requestedAction === "approve",
    };
    if ((intent.topic === "local_growth" || intent.topic === "clinic_location") && intent.requestedAction !== "approve") {
      const clinic = intent.topic === "clinic_location";
      return [{
        id: clinic ? "review-cvc-market-leads" : "review-marketing-market-leads",
        title: clinic ? "Review CVC market investigation leads" : "Review comparable-market investigation leads",
        summary: clinic
          ? "Screen published CVC footprint contrasts against compatible public market context, then choose which leads deserve governed validation."
          : "Screen structurally comparable metros and concentration contrasts, then choose which pairs deserve test-and-control feasibility checks.",
        owner: clinic ? "CVC Strategy and Real Estate Analytics" : "Marketing Science",
        timing: "Available now as exploratory context",
        confidence: "Medium",
        evidence: clinic
          ? ["Published CVC clinic footprint", "Validated public Census aggregates", "Compatible CBSA geography"]
          : ["Validated public Census aggregates", "Compatible CBSA geography", "Deterministic peer screening"],
        tradeoffs: clinic
          ? ["Households are not pet demand", "Footprint is not access, capacity, or opportunity"]
          : ["Structural similarity is not experiment validity", "No customer outcome, media, or conversion evidence is connected"],
        nextStep: clinic
          ? "Select a question-specific lead and validate it with pet demand, clinic capacity, veterinary supply, and property feasibility."
          : "Select a question-specific lead and validate it with pre-period outcomes, customer mix, media history, cost, and contamination checks.",
        outputId: "market_context_profile",
        requiresApproval: false,
      }, gates];
    }
    return [gates];
  }

  if (intent.topic === "clinic_location") {
    const clinicAction: PlannedAction = {
      id: "bounded-clinic-review",
      title: "Open bounded clinic evaluation",
      summary: assessment.message,
      owner: "Real Estate Analytics",
      timing: assessment.outcome === "blocked" ? "After gates clear" : "Evidence review available",
      confidence: "Medium",
      evidence: assessment.missingEvidence.length
        ? assessment.missingEvidence
        : ["Published clinic footprint", "Capability registry assessment"],
      tradeoffs: [
        "No opportunity ranking is produced without governed business evidence",
        "Public Census context cannot enter site scoring",
      ],
      nextStep: assessment.missingApprovals.length
        ? "Keep the material approval gate visible and request the governed evidence required for a decision."
        : "Validate the bounded clinic evidence, source periods, and limitations, then define the demand, capacity, workforce, property, and economic checks required before any site recommendation.",
      outputId: requirementFor(intent).outputId,
      requiresApproval: assessment.missingApprovals.length > 0 || intent.requestedAction === "approve",
    };
    if ((geography.mode === "national" || geography.mode === "needs_selection") && intent.requestedAction !== "approve") {
      return [{
        id: "review-cvc-market-leads",
        title: "Review CVC market investigation leads",
        summary: "Screen published CVC footprint contrasts against compatible public market context, then choose which leads deserve governed validation.",
        owner: "CVC Strategy and Real Estate Analytics",
        timing: "Available now as exploratory context",
        confidence: "Medium",
        evidence: ["Published CVC clinic footprint", "Validated public Census aggregates", "Compatible CBSA geography"],
        tradeoffs: ["Households are not pet demand", "Footprint is not access, capacity, or opportunity"],
        nextStep: "Select a question-specific lead and validate it with pet demand, clinic capacity, veterinary supply, and property feasibility.",
        outputId: "market_context_profile",
        requiresApproval: false,
      }, clinicAction];
    }
    return geography.mode === "single" || geography.mode === "compare"
      ? [clinicAction, context]
      : [clinicAction];
  }

  return [context];
}

export function compileEvaluationPlan(
  question: string,
  intent: PlanningIntent,
  proposalMethod: EvaluationPlan["proposalMethod"] = "deterministic_fallback",
  perspectiveId?: EvaluationPlan["perspectiveId"],
  selectedGeographicContext: readonly SelectedGeographicContext[] = [],
  framingProposal?: DecisionFramingProposal,
  activeViewId?: PerspectiveViewId,
): EvaluationPlan {
  const queryNormalizedIntent = queryAwareClinicLocationIntent(question, planningIntentSchema.parse({
    ...intent,
    requestedPlaces: normalizeRequestedPlaces(question, intent.requestedPlaces),
  }));
  const boundedPricingInvestigation = perspectiveId === "pricing"
    && queryNormalizedIntent.requestedAction !== "approve"
    && PRICING_INVESTIGATION_INTENT.test(question.toLowerCase());
  const boundedMarketingInvestigation = perspectiveId === "marketing"
    && queryNormalizedIntent.requestedAction !== "approve"
    && /\b(paid[ -]?search|google ads?|campaign|marketing)\b/i.test(question)
    && /\b(comparable|geograph|markets?|regional)\w*\b/i.test(question)
    && /\b(response|outcomes?|validat|investigat|signals?)\w*\b/i.test(question);
  const boundedMarketingLever = (perspectiveId === "marketing" || queryNormalizedIntent.topic === "local_growth")
    && queryNormalizedIntent.requestedAction !== "approve"
    && /\b(?:ads?|advertising|paid[ -]?search|campaign|media)\b/i.test(question)
    && /\b(?:spend|budget|increase|decrease|shift|reallocat|more)\w*\b/i.test(question);
  const normalizedIntent = planningIntentSchema.parse(
    boundedPricingInvestigation
      ? {
          ...queryNormalizedIntent,
          topic: "market_context",
          geographyGrain: "cbsa",
          requestedAction: "investigate",
          clarificationRequired: false,
          clarificationReason: "none",
          conciseInterpretation: "Investigate observed regional competitor conditions, coverage, and current commercial context, then identify the outcome and guardrail evidence required before any pricing action.",
        }
      : boundedMarketingLever
        ? {
            ...queryNormalizedIntent,
            topic: "local_growth",
            geographyGrain: "cbsa",
            requestedAction: queryNormalizedIntent.requestedAction === "describe" ? "investigate" : queryNormalizedIntent.requestedAction,
            clarificationRequired: false,
            clarificationReason: "none",
          }
      : perspectiveId && activeViewId && queryNormalizedIntent.topic === "other"
      ? {
          ...queryNormalizedIntent,
          clarificationRequired: false,
          clarificationReason: "none",
        }
      : queryNormalizedIntent,
  );
  const consistencyIssues = validatePlanningIntentConsistency(normalizedIntent);
  const validatedIntent = consistencyIssues.length
    ? planningIntentSchema.parse({
        ...normalizedIntent,
        clarificationRequired: true,
        clarificationReason: normalizedIntent.topic === "multi_market_comparison"
          ? "ambiguous_comparison_cohort"
          : "ambiguous_requested_output",
        conciseInterpretation: "Clarify the request because its topic, sources, geography, metrics, or registered queries do not form a consistent executable plan.",
      })
    : normalizedIntent;
  const resolvedPerspectiveId: EvaluationPlan["perspectiveId"] = perspectiveId
    ?? (validatedIntent.topic === "clinic_location" || validatedIntent.topic === "clinic_performance" || /\b(clinic|clinics|cvc|veterinar|vet)\b/i.test(question)
      ? "cvc"
      : validatedIntent.topic === "local_growth"
        ? "marketing"
        : /\b(prices?|pricing|elasticity|promo)\b/i.test(question)
          ? "pricing"
          : "marketing");
  const questionViewId = inferredViewId(question, resolvedPerspectiveId);
  const selectedViewId = questionViewId ?? activeViewId ?? getDefaultView(resolvedPerspectiveId).viewId;
  const selectedViewResult = selectPerspectiveView(resolvedPerspectiveId, selectedViewId);
  const selectedView = "status" in selectedViewResult ? getDefaultView(resolvedPerspectiveId) : selectedViewResult;
  const questionSelectsPublicMeasure = validatedIntent.requestedMeasure !== "none"
    && validatedIntent.sourceFamilies.includes("census")
    && !questionViewId;
  const materialActionRequest = resolvedPerspectiveId === "pricing"
    ? /\b(change|set|raise|lower|increase|decrease|recommend)\w*\b.*\b(prices?|pricing)\b|\b(prices?|pricing)\b.*\b(change|set|raise|lower|increase|decrease|recommend)\w*\b/i.test(question)
    : resolvedPerspectiveId === "marketing"
      ? /\b(increase|decrease|change|shift|allocate|recommend)\w*\b.*\b(spend|budget)\b|\b(spend|budget)\b.*\b(increase|decrease|change|shift|allocate|recommend)\w*\b/i.test(question)
      : /\b(open|approve|prioriti[sz]e|build|lease|recommend)\w*\b.*\b(clinic|site|footprint)\b|\b(clinic|site|footprint)\b.*\b(open|approve|prioriti[sz]e|build|lease|recommend)\w*\b/i.test(question);
  const exploratoryQuestion = /\b(comparable|which|where|patterns?|worth investigating|differ)\b/i.test(question);
  const canAssumeNationalCohort = exploratoryQuestion
    && validatedIntent.selectedQueries.length === 0
    && validatedIntent.topic !== "source_coverage"
    && !(questionSelectsPublicMeasure && resolvedPerspectiveId !== "cvc")
    && validatedIntent.requestedPlaces.length === 0
    && (perspectiveId !== undefined || /\b(marketing|campaign|media|ads?|advertis\w*|paid[ -]?search|test market|control market|clinic|cvc|veterinar|vet)\b/i.test(question))
    && (resolvedPerspectiveId === "marketing" || resolvedPerspectiveId === "cvc")
    && !(resolvedPerspectiveId === "cvc" && validatedIntent.topic === "local_growth")
    && validatedIntent.requestedAction !== "approve";
  const viewAwareInterpretation = decisionInterpretationForView(
    question,
    resolvedPerspectiveId,
    activeViewId,
    validatedIntent.conciseInterpretation,
  );
  const effectiveIntent = planningIntentSchema.parse(canAssumeNationalCohort ? {
    ...validatedIntent,
    topic: resolvedPerspectiveId === "cvc" ? "clinic_location" : "local_growth",
    geographyGrain: "cbsa",
    requestedAction: validatedIntent.requestedAction === "describe" ? "investigate" : validatedIntent.requestedAction,
    requestedMeasure: validatedIntent.requestedMeasure,
    clarificationRequired: false,
    clarificationReason: "none",
    conciseInterpretation: resolvedPerspectiveId === "cvc"
      ? "Screen national metro markets for question-specific CVC footprint contrasts, then identify the evidence needed to validate each lead."
      : decisionInterpretationForView(
        question,
        resolvedPerspectiveId,
        activeViewId,
        "Screen national metro markets for structurally comparable peers and regional contrasts, then identify the evidence needed to validate each lead.",
      ),
  } : {
    ...validatedIntent,
    conciseInterpretation: viewAwareInterpretation,
  });
  const requirement = requirementFor(effectiveIntent);
  const assessment = assessCapabilityQuestion({
    question,
    requirements: [requirement],
    availableEvidenceIds: [],
    satisfiedApprovalIds: [],
  });
  const resolvedGeography = resolveGeography(effectiveIntent);
  const geography = selectedGeographicContext.length
    ? {
        mode: selectedGeographicContext.length === 1 ? "single" as const : "compare" as const,
        places: selectedGeographicContext.map((context) => ({
          requestedName: context.cbsaName,
          status: "resolved" as const,
          cbsaCode: context.cbsaCode,
          cbsaName: context.cbsaName,
          candidates: [{ cbsaCode: context.cbsaCode, cbsaName: context.cbsaName }],
        })),
        selectedCbsaCodes: selectedGeographicContext.map((context) => context.cbsaCode),
        message: selectedGeographicContext.length === 1
          ? `Focus the workspace on ${selectedGeographicContext[0].cbsaName} (CBSA ${selectedGeographicContext[0].cbsaCode}).`
          : `Compare ${selectedGeographicContext.map((context) => context.cbsaName).join(", ")} in the analyst-selected order.`,
      }
    : resolvedGeography;
  const normalizedDemoExecutable = isNormalizedDemoTopic(effectiveIntent.topic)
    && (effectiveIntent.topic === "source_coverage" || effectiveIntent.topic === "growth_test_screening" || geography.selectedCbsaCodes.length > 0);
  const hasExploratoryEvidence = selectedView.mapBinding.kind === "workspace_snapshot"
    || (effectiveIntent.topic === "clinic_location" && (geography.mode === "national" || geography.mode === "needs_selection"));
  const boundedMaterialInvestigation = materialActionRequest
    && effectiveIntent.requestedAction !== "approve"
    && (selectedView.mapBinding.kind === "workspace_snapshot" || effectiveIntent.topic === "clinic_location");
  const hardExecutionBlock = effectiveIntent.requestedAction === "approve"
    || effectiveIntent.topic === "clinic_performance";
  const status: EvaluationPlan["status"] = effectiveIntent.clarificationRequired || geography.mode === "clarification" || geography.mode === "unavailable"
    ? "blocked"
    : hardExecutionBlock
      ? "blocked"
    : boundedMaterialInvestigation || boundedPricingInvestigation
      ? "partially_executable"
    : effectiveIntent.topic === "clinic_location" && !effectiveIntent.selectedQueries.length && (geography.mode === "national" || geography.mode === "needs_selection")
      ? "partially_executable"
    : normalizedDemoExecutable
      ? effectiveIntent.topic === "growth_test_screening" || effectiveIntent.topic === "google_ads_context" || effectiveIntent.topic === "multi_source_evidence" || effectiveIntent.topic === "clinic_location"
        ? "partially_executable"
        : "executable"
    : assessment.outcome === "supported"
      ? "executable"
      : assessment.outcome === "partially_supported"
        ? "partially_executable"
        : !hardExecutionBlock && hasExploratoryEvidence
          ? "partially_executable"
        : "blocked";
  const resultWorkspaceType = deriveResultWorkspaceType({
    intent: effectiveIntent,
    capabilityId: requirement.capabilityId,
    status,
    geography,
  });
  const clinicLocationMissingEvidence = [
    "Clinic access, staffed capacity, availability, utilization, and approved trade areas are not connected.",
    "Veterinary workforce and competitive access evidence are not connected.",
    "Property, permitting, trade-area feasibility, and physical-site constraints are not connected.",
    "Clinic economics, cannibalization, mature outcomes, and an approved opening rule are not connected.",
  ];
  const pricingInvestigationMissingEvidence = [
    "A privacy-safe regional Chewy commercial outcome is not connected.",
    "Representative-ZIP coverage, matched-SKU reliability, prior interventions, promotions, and inventory controls require validation.",
    "Elasticity, test guardrails, rollback rules, and authorized Pricing approval are required before a price change.",
  ];
  const missingEvidence = boundedPricingInvestigation
    ? pricingInvestigationMissingEvidence
    : normalizedDemoExecutable
    ? effectiveIntent.topic === "clinic_location" ? clinicLocationMissingEvidence : []
    : assessment.missingEvidence;
  const missingApprovals = normalizedDemoExecutable
    ? effectiveIntent.topic === "clinic_location" && effectiveIntent.requestedAction === "approve"
      ? ["Accountable material clinic-opening approval remains required after evidence validation."]
      : []
    : assessment.missingApprovals;
  const actions: PlannedAction[] = boundedPricingInvestigation ? [{
    id: "review-pricing-investigation-leads",
    title: "Review regional competitor-condition leads",
    summary: "Review dated competitor-condition and monitoring-coverage contrasts, then validate product matching, commercial outcomes, prior interventions, and guardrails.",
    owner: "Pricing Analytics and Pricing Science",
    timing: "Before proposing any controlled price test or price change",
    confidence: "Low",
    evidence: [`Selected evidence: ${selectedView.label}`, ...selectedView.sourceIds],
    tradeoffs: ["Observed competitor conditions may reflect monitoring coverage or assortment mix", "No regional Chewy outcome or causal price response is established"],
    nextStep: "Validate representative ZIP and matched-SKU coverage, connect privacy-safe regional outcomes and intervention history, then decide whether a controlled-test design is warranted.",
    outputId: "market_context_profile",
    requiresApproval: false,
  }] : boundedMarketingInvestigation ? [{
    id: "review-marketing-response-leads",
    title: "Review comparable paid-search response leads",
    summary: "Review aggregate response contrasts and identify which comparable markets warrant first-party outcome validation.",
    owner: "Marketing Science",
    timing: "Available now as an investigation lead review",
    confidence: "Low",
    evidence: [`Selected evidence: ${selectedView.label}`, ...selectedView.sourceIds],
    tradeoffs: ["Response metrics are not incremental business outcomes", "The postal-to-CBSA bridge is not yet an approved operational crosswalk"],
    nextStep: "Validate campaign comparability and join privacy-safe regional outcomes before proposing a controlled test or spend change.",
    outputId: "growth_test_measurement",
    requiresApproval: false,
  }] : actionsFor(effectiveIntent, assessment, geography, resultWorkspaceType);
  const findings = derivePlanFindings({
    intent: effectiveIntent,
    proposalMethod,
    capabilityId: requirement.capabilityId,
    status,
    geography,
    actions,
    missingEvidence,
    missingApprovals,
    resultWorkspaceType,
  });

  const planWithoutAnswerContract: Omit<EvaluationPlan, "answerContract"> = {
    planId: `plan-${effectiveIntent.topic}-${geography.mode}-${requirement.capabilityId}-${selectedView.viewId}`,
    version: "1.1.0",
    originalQuestion: question,
    perspectiveId: resolvedPerspectiveId,
    proposalMethod,
    intent: effectiveIntent,
    capabilityId: requirement.capabilityId,
    geographyGrain: requirement.geographyGrain === "market" ? "cbsa" : requirement.geographyGrain,
    geographyResolution: geography,
    resultWorkspaceType,
    evidenceSelection: {
      viewId: selectedView.viewId,
      measureId: selectedView.activeMeasure,
      datasetId: questionSelectsPublicMeasure
        ? null
        : selectedView.mapBinding.kind === "workspace_snapshot" ? selectedView.mapBinding.datasetId : null,
      sourceIds: questionSelectsPublicMeasure ? ["SRC-016"] : selectedView.sourceIds,
      selectionReason: questionSelectsPublicMeasure ? "question_inference" : questionViewId ? "question_inference" : activeViewId ? "explicit_view" : "perspective_default",
      evidenceBoundary: questionSelectsPublicMeasure
        ? "The explicitly requested public Census measure is descriptive market context only. It cannot be replaced by the active business view or treated as an opportunity score."
        : selectedView.evidenceBoundary,
    },
    status,
    evidenceBoundary: boundedMaterialInvestigation
      ? `${selectedView.evidenceBoundary} The requested material action is treated as an investigation goal only: the result may identify validation or controlled-test candidates, but it cannot authorize a spend, price, site, lease, or opening change.`
      : boundedPricingInvestigation
      ? `${selectedView.evidenceBoundary} The result may prioritize investigation only and cannot authorize a regional or item price change.`
      : effectiveIntent.topic === "clinic_location"
      ? "Connected market, regional, and aggregate clinic evidence supports a bounded investigation only. It does not establish site suitability or authorize a clinic opening."
      : requirement.capabilityId === "census_market_context"
      ? "Public Census context describes compatible market measures. It does not rank business opportunity or authorize action."
      : selectedView.mapBinding.kind === "workspace_snapshot"
        ? selectedView.evidenceBoundary
      : "Only registry-supported prototype outputs may run. Consequential actions remain gated by approved evidence and human authority.",
    missingEvidence,
    missingApprovals,
    steps: buildPlanSteps({
      intent: effectiveIntent,
      capabilityId: requirement.capabilityId,
      status,
      geography,
      missingEvidence,
      missingApprovals,
    }),
    actions,
    findings,
  };

  const answerContract = buildAnswerContract(planWithoutAnswerContract, framingProposal);
  const validation = validateAnswerContract(answerContract, {
    planId: planWithoutAnswerContract.planId,
    perspectiveId: planWithoutAnswerContract.perspectiveId,
  });
  if (!validation.valid) {
    throw new Error(`The compiled answer contract failed validation: ${validation.issues.map((item) => item.message).join("; ")}`);
  }

  return evaluationPlanSchema.parse({
    ...planWithoutAnswerContract,
    answerContract,
  });
}

export function planEvaluation(
  question: string,
  perspectiveId?: EvaluationPlan["perspectiveId"],
  selectedGeographicContextOrActiveView: readonly SelectedGeographicContext[] | PerspectiveViewId = [],
  activeViewId?: PerspectiveViewId,
) {
  const selectedGeographicContext = typeof selectedGeographicContextOrActiveView === "string"
    ? []
    : selectedGeographicContextOrActiveView;
  const selectedActiveViewId = typeof selectedGeographicContextOrActiveView === "string"
    ? selectedGeographicContextOrActiveView
    : activeViewId;
  return compileEvaluationPlan(
    question,
    inferPlanningIntent(question),
    "deterministic_fallback",
    perspectiveId,
    selectedGeographicContext,
    undefined,
    selectedActiveViewId,
  );
}
