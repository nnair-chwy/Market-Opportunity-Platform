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
    considerationEditsRecalculate: false;
  };
  considerations: AnalysisConsideration[];
  confirmedAt: string | null;
};

function cvcConsiderations(): AnalysisConsideration[] {
  return [
    { id: "demand", label: "Addressable demand", metric: "Addressable pet households and aggregate Chewy customer presence", role: "weighted_preference", evidenceStatus: "needed", weightPercent: 40, whyItMatters: "A footprint gap matters only where the potential need is large enough to investigate." },
    { id: "access_gap", label: "CVC access gap", metric: "Addressable demand outside approved current-clinic coverage", role: "weighted_preference", evidenceStatus: "partial", weightPercent: 35, whyItMatters: "Separates published footprint whitespace from demand that current clinics may already cover." },
    { id: "veterinary_supply", label: "Veterinary supply", metric: "Relevant clinic capacity per 10,000 addressable pet households", role: "weighted_preference", evidenceStatus: "needed", weightPercent: 25, whyItMatters: "Distinguishes a CVC footprint gap from a market already served by veterinary capacity." },
    { id: "operating_feasibility", label: "Operating feasibility", metric: "Staffing, property, permitting, capacity, and cost requirements", role: "validity_gate", evidenceStatus: "needed", weightPercent: null, whyItMatters: "A promising market should not advance when a material operating requirement fails." },
    { id: "public_context", label: "Public market context", metric: "Population, households, income, and population density", role: "context_only", evidenceStatus: "connected", weightPercent: null, whyItMatters: "Provides same-grain context but is not pet demand or a clinic-opportunity score." },
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

export function buildAnalysisBrief(plan: EvaluationPlan, investigation: MarketInvestigation): AnalysisBrief {
  const considerations = plan.perspectiveId === "cvc"
    ? cvcConsiderations()
    : plan.perspectiveId === "marketing"
      ? marketingConsiderations()
      : pricingConsiderations();
  const assumptions = plan.perspectiveId === "cvc"
    ? ["Use metropolitan CBSAs as the first comparison unit", "Treat footprint whitespace as an investigation lead, not proof that a clinic should open", "Keep public context separate from pet demand and veterinary capacity"]
    : plan.perspectiveId === "marketing"
      ? ["Use metropolitan CBSAs as the first peer-search unit", "Treat structural peers as feasibility leads, not assigned test or control markets", "Require pre-period outcomes and exposure checks before experiment design"]
      : ["Use metropolitan CBSAs as the initial comparison unit", "Do not infer elasticity from public context", "Require compatible price exposure and customer outcomes before recommending a regional strategy"];

  return {
    version: "1.0.0",
    planId: plan.planId,
    status: "proposed",
    originalQuestion: plan.originalQuestion,
    rewrittenQuestion: plan.intent.conciseInterpretation,
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
