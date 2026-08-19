import type { PerspectiveId, PerspectiveViewId } from "../perspectives/contracts.ts";

export const QUESTION_REGISTRY_VERSION = "registered-questions-v2" as const;

export const QUESTION_TEXT = {
  cvcFootprintPatterns: "What clinic footprint patterns are worth investigating?",
  cvcFootprintComparison: "Which comparable metros have different CVC footprints, and what should we validate next?",
  marketingResponseConcentration: "Where is paid search response concentrated, and which regions need validation?",
  marketingResponseComparison: "Which comparable metros have different paid search response percentiles?",
  pricingAvailabilityDifferences: "Where does monitored competitor availability differ by region?",
  pricingAvailabilityComparison: "Which comparable metros have different competitor-availability percentiles?",
  goldenMarketingValidation: "Which comparable geographies show paid-search response worth validating with first-party outcomes?",
  goldenPricingInvestigation: "Where do observed competitor conditions and Chewy economics warrant investigation?",
  goldenCvcAccessInvestigation: "Which markets show demand/footprint contrasts worth deeper clinic-access investigation?",
  demoMarketContext: "Show regional, clinic, and Google Ads evidence for Atlanta.",
  demoClinicPerformance: "How is this clinic performing relative to an approved peer group, and how reliable is that comparison?",
  demoGrowthTest: "Rank regional growth-test candidates.",
} as const;

export type QuestionSupportLevel =
  | "available_now"
  | "partial_answer"
  | "more_evidence_required";

export type QuestionOrigin = "curated" | "configured_demo";

export type RequiredQuestionEvidence = {
  id: string;
  label: string;
  state: "connected" | "limited" | "missing";
};

export type RegisteredQuestion = {
  id: string;
  question: string;
  perspectiveId: PerspectiveId;
  viewId: PerspectiveViewId;
  intent: string;
  tags: readonly string[];
  requiredEvidence: readonly RequiredQuestionEvidence[];
  supportLevel: QuestionSupportLevel;
  supportSummary: string;
  investigationType: string;
  description: string;
  origin: QuestionOrigin;
  starter: boolean;
  geographicContext?: {
    cbsaCodes: readonly string[];
    placeNames: readonly string[];
  };
};

const registry = [
  {
    id: "cvc-footprint-patterns",
    question: QUESTION_TEXT.cvcFootprintPatterns,
    perspectiveId: "cvc",
    viewId: "clinic_footprint",
    intent: "clinic_footprint_investigation",
    tags: ["clinic", "footprint", "patterns", "markets", "investigate"],
    requiredEvidence: [
      { id: "SRC-009", label: "Public CVC clinic footprint", state: "connected" },
    ],
    supportLevel: "available_now",
    supportSummary: "Descriptive clinic-footprint investigation is available; expansion or capacity conclusions are not.",
    investigationType: "Footprint investigation",
    description: "Find geographic clinic-footprint patterns and frame the next validation step.",
    origin: "curated",
    starter: true,
  },
  {
    id: "cvc-footprint-comparison",
    question: QUESTION_TEXT.cvcFootprintComparison,
    perspectiveId: "cvc",
    viewId: "clinic_footprint",
    intent: "clinic_footprint_comparison",
    tags: ["clinic", "cvc", "footprint", "compare", "metro", "validate"],
    requiredEvidence: [
      { id: "SRC-009", label: "Public CVC clinic footprint", state: "connected" },
      { id: "SRC-014", label: "Comparable CBSA geography", state: "connected" },
    ],
    supportLevel: "available_now",
    supportSummary: "Same-cohort footprint comparison is available; demand, capacity, and site conclusions require more evidence.",
    investigationType: "Market comparison",
    description: "Compare selected metros on public clinic footprint without creating an expansion score.",
    origin: "curated",
    starter: true,
  },
  {
    id: "marketing-response-concentration",
    question: QUESTION_TEXT.marketingResponseConcentration,
    perspectiveId: "marketing",
    viewId: "paid_search_response",
    intent: "paid_search_response_investigation",
    tags: ["marketing", "paid", "search", "response", "clicks", "concentration", "validate"],
    requiredEvidence: [
      { id: "SRC-018", label: "Matched-postal paid-search response", state: "connected" },
    ],
    supportLevel: "available_now",
    supportSummary: "Descriptive paid-search response is available; incrementality and spend changes are not supported.",
    investigationType: "Response investigation",
    description: "Locate concentrated paid-search response and identify regions that warrant validation.",
    origin: "curated",
    starter: true,
  },
  {
    id: "marketing-response-comparison",
    question: QUESTION_TEXT.marketingResponseComparison,
    perspectiveId: "marketing",
    viewId: "paid_search_response",
    intent: "paid_search_response_comparison",
    tags: ["marketing", "paid", "search", "response", "percentile", "compare", "metro"],
    requiredEvidence: [
      { id: "SRC-018", label: "Matched-postal paid-search response", state: "connected" },
      { id: "SRC-014", label: "Comparable CBSA geography", state: "connected" },
    ],
    supportLevel: "available_now",
    supportSummary: "Same-cohort paid-search response comparison is available; conversion quality and causal lift remain unresolved.",
    investigationType: "Market comparison",
    description: "Compare selected metros using the connected paid-search response snapshot.",
    origin: "curated",
    starter: true,
  },
  {
    id: "pricing-availability-differences",
    question: QUESTION_TEXT.pricingAvailabilityDifferences,
    perspectiveId: "pricing",
    viewId: "competitor_availability",
    intent: "competitor_availability_investigation",
    tags: ["pricing", "competitor", "availability", "regional", "monitoring", "investigate"],
    requiredEvidence: [
      { id: "SRC-025", label: "Competitor ZIP offer history", state: "connected" },
    ],
    supportLevel: "available_now",
    supportSummary: "Observed competitor availability can be investigated; a Chewy price change is not supported.",
    investigationType: "Competitor monitoring investigation",
    description: "Find regional differences in monitored competitor availability and coverage.",
    origin: "curated",
    starter: true,
  },
  {
    id: "pricing-availability-comparison",
    question: QUESTION_TEXT.pricingAvailabilityComparison,
    perspectiveId: "pricing",
    viewId: "competitor_availability",
    intent: "competitor_availability_comparison",
    tags: ["pricing", "competitor", "availability", "percentile", "compare", "metro"],
    requiredEvidence: [
      { id: "SRC-025", label: "Competitor ZIP offer history", state: "connected" },
      { id: "SRC-014", label: "Comparable CBSA geography", state: "connected" },
    ],
    supportLevel: "available_now",
    supportSummary: "Same-cohort monitoring comparison is available; coverage does not establish local demand or pricing opportunity.",
    investigationType: "Market comparison",
    description: "Compare selected metros on monitored competitor-availability percentiles.",
    origin: "curated",
    starter: true,
  },
  {
    id: "pricing-material-price-change",
    question: "Where should Chewy change price by region?",
    perspectiveId: "pricing",
    viewId: "price_opportunity_by_region",
    intent: "regional_price_action",
    tags: ["pricing", "price", "change", "region", "action", "opportunity"],
    requiredEvidence: [
      { id: "SRC-025", label: "Competitor ZIP offer history", state: "connected" },
      { id: "OQ-045", label: "Privacy-safe regional contribution outcome", state: "missing" },
      { id: "OQ-046", label: "Prior pricing interventions and controls", state: "missing" },
    ],
    supportLevel: "more_evidence_required",
    supportSummary: "Monitoring conditions can be described, but a regional price change requires local outcomes, intervention history, and approved guardrails.",
    investigationType: "Regional price action",
    description: "Assess whether evidence is sufficient to support a regional price action.",
    origin: "curated",
    starter: false,
  },
  {
    id: "golden-marketing-validation",
    question: QUESTION_TEXT.goldenMarketingValidation,
    perspectiveId: "marketing",
    viewId: "paid_search_response",
    intent: "paid_search_outcome_validation",
    tags: ["marketing", "paid", "search", "response", "comparable", "geography", "first-party", "outcomes", "validate"],
    requiredEvidence: [
      { id: "SRC-018", label: "Matched-postal paid-search response", state: "connected" },
      { id: "OQ-039", label: "Approved first-party regional outcome", state: "missing" },
    ],
    supportLevel: "partial_answer",
    supportSummary: "Philadelphia and San Antonio can be identified as validation leads; spend changes require first-party outcomes and a controlled test.",
    investigationType: "Paid-search validation lead",
    description: "Find comparable geographies with paid-search response worth validating against business outcomes.",
    origin: "curated",
    starter: false,
  },
  {
    id: "golden-pricing-investigation",
    question: QUESTION_TEXT.goldenPricingInvestigation,
    perspectiveId: "pricing",
    viewId: "competitor_availability",
    intent: "competitor_economics_investigation",
    tags: ["pricing", "competitor", "conditions", "chewy", "economics", "investigate", "kankakee"],
    requiredEvidence: [
      { id: "SRC-025", label: "Competitor ZIP offer history", state: "limited" },
      { id: "SRC-036", label: "Zeus national product coverage", state: "connected" },
      { id: "OQ-045", label: "Privacy-safe regional contribution outcome", state: "missing" },
    ],
    supportLevel: "partial_answer",
    supportSummary: "Kankakee can be monitored as a one-ZIP lead with national Zeus context; local economics and price action remain unsupported.",
    investigationType: "Pricing investigation lead",
    description: "Identify monitored competitor conditions that warrant deeper validation with Chewy economics.",
    origin: "curated",
    starter: false,
  },
  {
    id: "golden-cvc-access-investigation",
    question: QUESTION_TEXT.goldenCvcAccessInvestigation,
    perspectiveId: "cvc",
    viewId: "market_expansion_context",
    intent: "clinic_access_investigation",
    tags: ["cvc", "clinic", "access", "demand", "footprint", "contrast", "market", "santa", "clara"],
    requiredEvidence: [
      { id: "SRC-009", label: "Public CVC clinic footprint", state: "connected" },
      { id: "SRC-016", label: "Public market context", state: "connected" },
      { id: "OQ-010", label: "Capacity, workforce, property, and site constraints", state: "missing" },
    ],
    supportLevel: "partial_answer",
    supportSummary: "Santa Clara can be surfaced as a research lead; demand, capacity, site feasibility, and economics must be validated before footprint action.",
    investigationType: "Clinic-access investigation lead",
    description: "Find demand and footprint contrasts that warrant deeper clinic-access validation.",
    origin: "curated",
    starter: false,
  },
  {
    id: "marketing-material-spend-change",
    question: "Where should we increase paid search spend?",
    perspectiveId: "marketing",
    viewId: "marketing_opportunity_by_region",
    intent: "regional_spend_action",
    tags: ["marketing", "paid", "search", "spend", "increase", "region", "action"],
    requiredEvidence: [
      { id: "SRC-018", label: "Paid-search delivery evidence", state: "connected" },
      { id: "OQ-039", label: "Approved first-party regional outcome", state: "missing" },
      { id: "OQ-049", label: "Approved experiment design and guardrails", state: "missing" },
    ],
    supportLevel: "more_evidence_required",
    supportSummary: "Delivery signals can identify validation leads, but increasing spend requires first-party outcomes and an approved test design.",
    investigationType: "Regional spend action",
    description: "Assess whether a region has enough evidence to support a paid-search spend change.",
    origin: "curated",
    starter: false,
  },
  {
    id: "cvc-material-footprint-change",
    question: "Which markets should we prioritize for a new clinic?",
    perspectiveId: "cvc",
    viewId: "market_expansion_context",
    intent: "clinic_footprint_action",
    tags: ["cvc", "clinic", "new", "market", "prioritize", "expansion", "action"],
    requiredEvidence: [
      { id: "SRC-016", label: "Public market context", state: "connected" },
      { id: "OQ-004", label: "Approved mature-clinic outcome", state: "missing" },
      { id: "OQ-010", label: "Capacity, workforce, property, and site constraints", state: "missing" },
    ],
    supportLevel: "more_evidence_required",
    supportSummary: "Market context can frame an investigation, but clinic prioritization requires demand, capacity, feasibility, economics, and approved outcomes.",
    investigationType: "Clinic expansion action",
    description: "Assess whether evidence is sufficient to prioritize a market for clinic expansion.",
    origin: "curated",
    starter: false,
  },
  {
    id: "demo-atlanta-market-context",
    question: QUESTION_TEXT.demoMarketContext,
    perspectiveId: "cvc",
    viewId: "household_demand",
    intent: "multi_source_market_context",
    tags: ["atlanta", "regional", "clinic", "google", "ads", "evidence", "context"],
    requiredEvidence: [
      { id: "SRC-016", label: "Regional Census context", state: "connected" },
      { id: "SRC-034", label: "Aggregate clinic context", state: "connected" },
      { id: "SRC-018", label: "Inferred Google Ads context", state: "limited" },
    ],
    supportLevel: "partial_answer",
    supportSummary: "Regional, clinic, and inferred advertising context can be shown; geography and outcome limitations remain visible.",
    investigationType: "Multi-source market context",
    description: "Run the configured Atlanta question across regional, clinic, and Google Ads evidence.",
    origin: "configured_demo",
    starter: false,
    geographicContext: { cbsaCodes: ["12060"], placeNames: ["Atlanta"] },
  },
  {
    id: "demo-synthetic-clinic-performance",
    question: QUESTION_TEXT.demoClinicPerformance,
    perspectiveId: "cvc",
    viewId: "clinic_performance_context",
    intent: "clinic_performance_comparison",
    tags: ["clinic", "performance", "peer", "reliability", "compare", "synthetic"],
    requiredEvidence: [
      { id: "SYN-CVC-CLINIC-PERFORMANCE", label: "Synthetic clinic-performance cohort", state: "limited" },
      { id: "OQ-004", label: "Approved production outcome and maturity rule", state: "missing" },
    ],
    supportLevel: "partial_answer",
    supportSummary: "A synthetic workflow demonstration is available; production clinic-performance judgment requires approved outcomes and peers.",
    investigationType: "Synthetic clinic comparison",
    description: "Demonstrate a deterministic clinic peer comparison with explicit synthetic labeling.",
    origin: "configured_demo",
    starter: false,
  },
  {
    id: "demo-regional-growth-test",
    question: QUESTION_TEXT.demoGrowthTest,
    perspectiveId: "marketing",
    viewId: "marketing_opportunity_by_region",
    intent: "growth_test_screening",
    tags: ["marketing", "growth", "test", "regional", "rank", "candidate", "screen"],
    requiredEvidence: [
      { id: "SRC-034", label: "Normalized aggregate market evidence", state: "limited" },
      { id: "OQ-049", label: "Approved growth-test objective and design", state: "missing" },
    ],
    supportLevel: "partial_answer",
    supportSummary: "A hypothesis-only screening can run; market selection, launch, and spend authority remain unsupported.",
    investigationType: "Growth-test screening",
    description: "Run the configured hypothesis-only regional growth-test screening workflow.",
    origin: "configured_demo",
    starter: false,
  },
] as const satisfies readonly RegisteredQuestion[];

export const REGISTERED_QUESTIONS: readonly RegisteredQuestion[] = registry;

export function listRegisteredQuestions(): readonly RegisteredQuestion[] {
  return REGISTERED_QUESTIONS;
}

export function getRegisteredQuestion(id: string): RegisteredQuestion | null {
  return REGISTERED_QUESTIONS.find((item) => item.id === id) ?? null;
}

export function listStarterQuestions(perspectiveId: PerspectiveId): readonly RegisteredQuestion[] {
  return REGISTERED_QUESTIONS.filter(
    (item) => item.starter && item.perspectiveId === perspectiveId,
  );
}
