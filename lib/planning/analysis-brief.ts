import type { EvaluationPlan } from "./contracts.ts";
import type { MarketInvestigation } from "./market-investigation.ts";

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
  };
  considerations: AnalysisConsideration[];
  confirmedAt: string | null;
};

function cvcExplorationConsiderations(): AnalysisConsideration[] {
  return [
    { id: "current_cvc_footprint", label: "Current CVC footprint", metric: "Published clinic locations mapped to metropolitan CBSAs", role: "context_only", evidenceStatus: "partial", weightPercent: null, whyItMatters: "Shows where the published footprint differs without treating clinic count as capacity or access." },
    { id: "public_market_context", label: "Public market context", metric: "Population, households, median income, and population density", role: "context_only", evidenceStatus: "connected", weightPercent: null, whyItMatters: "Finds structurally comparable metros for a more useful footprint contrast." },
    { id: "comparison_validity", label: "Peer comparability", metric: "Same-grain market structure and alternate-peer stability", role: "validity_gate", evidenceStatus: "partial", weightPercent: null, whyItMatters: "A contrast is only useful when the markets are similar enough for the comparison to be interpretable." },
    { id: "demand_capacity", label: "Demand and capacity", metric: "Chewy customer demand, clinic capacity, appointments, pet households, and trade-area access", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "A footprint difference cannot be called whitespace until demand and service capacity are verified." },
    { id: "operating_context", label: "Operating context", metric: "Veterinary workforce, property feasibility, economics, maturity, and cannibalization", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "Explains whether a visible contrast is actionable or simply reflects an operating constraint." },
  ];
}

function marketingConsiderations(): AnalysisConsideration[] {
  return [
    { id: "baseline_similarity", label: "Baseline similarity", metric: "Pre-period customer mix, outcomes, trend, and seasonality", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "Test and control markets must behave similarly before treatment." },
    { id: "media_isolation", label: "Media isolation", metric: "Campaign history, spillover, contamination risk, reach, frequency, and cost", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "A structural peer is not a valid control when exposure cannot be separated." },
    { id: "structural_peer", label: "Structural comparability", metric: "Population, households, income, and population density", role: "context_only", evidenceStatus: "connected", weightPercent: null, whyItMatters: "Narrows the feasibility search before business outcomes are connected." },
    { id: "audience_concentration", label: "Audience concentration", metric: "Reachable customer and prospect concentration within the market", role: "context_only", evidenceStatus: "partial", weightPercent: null, whyItMatters: "Similar market scale may require different channel, reach, delivery, or creative tactics." },
  ];
}

function pricingConsiderations(): AnalysisConsideration[] {
  return [
    { id: "price_exposure", label: "Price and promotion exposure", metric: "Observed item-level price and promotion by geography and period", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "Regional response cannot be interpreted without knowing what customers actually saw." },
    { id: "customer_response", label: "Customer response", metric: "Conversion, units, retention, substitution, and elasticity at compatible grain", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "Separates price response from a coincident difference in market composition." },
    { id: "competitive_context", label: "Competitive context", metric: "Competitor price, assortment, availability, and delivery proposition", role: "context_only", evidenceStatus: "needed", weightPercent: null, whyItMatters: "A regional pricing pattern can reflect a different competitive environment." },
    { id: "market_context", label: "Market context", metric: "Income, household scale, and density", role: "context_only", evidenceStatus: "connected", weightPercent: null, whyItMatters: "Describes the market but cannot substitute for governed pricing evidence." },
  ];
}

function cvcRewrittenQuestion(plan: EvaluationPlan) {
  const question = plan.originalQuestion;
  if (/open|next\s+(?:cvc\s+)?clinic|location/i.test(question)) {
    return "Which 3–5 U.S. metro areas should be investigated first as candidates for the next CVC clinic, based on the evidence currently connected—and what demand, capacity, workforce, property, and economic evidence must be validated before selecting a location?";
  }
  if (/veterinar|supply|access|whitespace/i.test(question)) {
    return "Find metro footprint contrasts worth validating for veterinary access or whitespace, while keeping demand, clinic capacity, and workforce as required evidence gaps.";
  }
  if (/demand|growth|customer/i.test(question)) {
    return "Find metro footprint contrasts worth validating against governed Chewy demand and clinic capacity; do not substitute household context for customer or pet demand.";
  }
  return plan.intent.conciseInterpretation;
}

export function buildAnalysisBrief(plan: EvaluationPlan, investigation: MarketInvestigation): AnalysisBrief {
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
    rewrittenQuestion: plan.perspectiveId === "cvc" ? cvcRewrittenQuestion(plan) : plan.intent.conciseInterpretation,
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
  return brief.considerations.reduce((total, item) => total + (item.role === "weighted_preference" ? item.weightPercent ?? 0 : 0), 0);
}
