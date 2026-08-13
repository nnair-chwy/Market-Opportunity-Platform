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

function cvcConsiderations(question: string): AnalysisConsideration[] {
  const weights = /veterinar|supply|access|whitespace/i.test(question)
    ? [30, 15, 45, 10]
    : /engagement|practice hub|clinic order/i.test(question)
      ? [30, 15, 15, 40]
      : /demand|growth|customer/i.test(question)
        ? [60, 20, 10, 10]
        : [45, 25, 20, 10];
  return [
    { id: "chewy_demand", label: "Chewy demand", metric: "Synthetic customer scale, penetration, and growth", role: "weighted_preference", evidenceStatus: "connected", weightPercent: weights[0], whyItMatters: "Tests whether a market has enough modeled Chewy demand to merit deeper clinic research." },
    { id: "market_capacity", label: "Market capacity", metric: "Household scale and income context", role: "weighted_preference", evidenceStatus: "connected", weightPercent: weights[1], whyItMatters: "Represents the size and purchasing-power context of the modeled market." },
    { id: "veterinary_opportunity", label: "Veterinary opportunity", metric: "Synthetic clinic supply, veterinarian availability, and corporate clinic share", role: "weighted_preference", evidenceStatus: "connected", weightPercent: weights[2], whyItMatters: "Balances modeled whitespace against the workforce needed to serve a market." },
    { id: "chewy_clinic_engagement", label: "Clinic engagement", metric: "Synthetic Practice Hub participation and clinic orders", role: "weighted_preference", evidenceStatus: "connected", weightPercent: weights[3], whyItMatters: "Tests whether Chewy already has modeled clinic relationships that could support validation." },
    { id: "operating_feasibility", label: "Operating feasibility", metric: "Staffing, property, permitting, capacity, and cost requirements", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "A promising market should not advance when a material operating requirement fails." },
    { id: "current_cvc_footprint", label: "Current CVC footprint", metric: "Published clinic locations mapped to metropolitan CBSAs", role: "validity_gate", evidenceStatus: "partial", weightPercent: null, whyItMatters: "A shortlist still needs approved trade-area and current-capacity validation before it can represent whitespace." },
    { id: "public_context", label: "Public market context", metric: "Population, households, income, and population density", role: "context_only", evidenceStatus: "connected", weightPercent: null, whyItMatters: "Supports interpretation and map context without entering the clinic screening score." },
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
    return "Identify the 3–5 U.S. metropolitan markets that should advance to detailed validation for the next CVC clinic, excluding markets with a mapped published CVC clinic.";
  }
  if (/veterinar|supply|access|whitespace/i.test(question)) {
    return "Identify the 3–5 U.S. metropolitan markets with the strongest modeled veterinary whitespace that should advance to demand, capacity, and operating-feasibility validation.";
  }
  if (/demand|growth|customer/i.test(question)) {
    return "Identify the 3–5 U.S. metropolitan markets with the strongest modeled Chewy demand that should advance to clinic demand and operating-feasibility validation.";
  }
  return plan.intent.conciseInterpretation;
}

export function buildAnalysisBrief(plan: EvaluationPlan, investigation: MarketInvestigation): AnalysisBrief {
  const considerations = plan.perspectiveId === "cvc"
    ? cvcConsiderations(`${plan.originalQuestion} ${plan.intent.conciseInterpretation}`)
    : plan.perspectiveId === "marketing"
      ? marketingConsiderations()
      : pricingConsiderations();
  const assumptions = plan.perspectiveId === "cvc"
    ? ["Use metropolitan CBSAs as the first comparison unit", "Treat every modeled business input as a synthetic prototype hypothesis", "Exclude markets with a mapped published CVC clinic before ranking", "Treat the shortlist as validation priority, not proof that a clinic should open"]
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
    timeframe: plan.perspectiveId === "cvc" ? "Synthetic snapshot dated 2026-07-31" : investigation.period,
    assumptions,
    currentScreen: {
      inputs: plan.perspectiveId === "cvc"
        ? considerations.filter((item) => item.role === "weighted_preference").map((item) => item.metric)
        : investigation.measuresExamined,
      method: plan.perspectiveId === "cvc"
        ? "Normalize each configured metric within the metropolitan cohort, apply the confirmed weights, run weight-sensitivity scenarios, and retain the five highest screening scores for validation."
        : investigation.screeningScope.selectionRule,
      considerationEditsRecalculate: plan.perspectiveId === "cvc",
    },
    considerations,
    confirmedAt: null,
  };
}

export function analysisBriefWeightTotal(brief: AnalysisBrief) {
  return brief.considerations.reduce((total, item) => total + (item.role === "weighted_preference" ? item.weightPercent ?? 0 : 0), 0);
}
