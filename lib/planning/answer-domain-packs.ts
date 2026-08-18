import type { AnswerContract } from "./answer-contract.ts";

export const ANSWER_DOMAIN_PACK_VERSION = "answer-domain-packs-v1" as const;

export type AnswerDomainPack = {
  version: typeof ANSWER_DOMAIN_PACK_VERSION;
  perspectiveId: AnswerContract["perspectiveId"];
  label: string;
  primaryUser: string;
  decisionOwner: string;
  accountableReviewer: string;
  requirements: AnswerContract["domainRequirements"];
  prohibitedConclusion: string;
  exampleQuestions: readonly string[];
  exampleBoundedConclusions: readonly string[];
};

const packs: Record<AnswerContract["perspectiveId"], AnswerDomainPack> = {
  cvc: {
    version: ANSWER_DOMAIN_PACK_VERSION,
    perspectiveId: "cvc",
    label: "Clinic and market evaluation",
    primaryUser: "CVC strategy, real-estate, or clinic analyst",
    decisionOwner: "Authorized CVC business decision owner",
    accountableReviewer: "CVC Analytics, Finance, Real Estate, and the authorized decision owner",
    requirements: [
      { requirementId: "cvc_demand_outcome", label: "Demand and outcome", questionToAnswer: "What governed customer, appointment, performance, or pet-demand outcome makes the market or clinic relevant?", required: true, readiness: "documented_not_approved", sourceIds: ["SRC-002", "SRC-017"], ifUnmet: "Return a footprint or evidence-readiness finding, not a demand or performance conclusion." },
      { requirementId: "cvc_access_capacity", label: "Access and capacity", questionToAnswer: "What approved trade area, travel-time, staffed capacity, appointment availability, and maturity evidence explains service access?", required: true, readiness: "missing", sourceIds: ["SRC-004", "SRC-012", "SRC-017"], ifUnmet: "Do not treat clinic count or a public boundary as access, capacity, or a trade area." },
      { requirementId: "cvc_supply_feasibility", label: "Veterinary supply and feasibility", questionToAnswer: "What competitive supply, workforce, property, economics, regulatory, and physical-site constraints could invalidate the opportunity?", required: true, readiness: "documented_not_approved", sourceIds: ["SRC-003", "SRC-008", "SRC-011", "SRC-017"], ifUnmet: "Limit the answer to investigation leads and name the accountable validation owners." },
      { requirementId: "cvc_human_judgment", label: "Human decision boundary", questionToAnswer: "Which accountable reviewer must validate the evidence and any physical inspection before a site or opening decision?", required: true, readiness: "documented_not_approved", sourceIds: ["SRC-003", "SRC-006"], ifUnmet: "The answer may prepare review but cannot select a site, approve a lease, or authorize an opening." },
    ],
    prohibitedConclusion: "Do not approve a site, lease, clinic opening, staffing plan, or physical-site suitability.",
    exampleQuestions: [
      "Which comparable markets differ most in CVC footprint and governed demand?",
      "What additional evidence is required before reviewing this clinic candidate?",
    ],
    exampleBoundedConclusions: [
      "This pair is a source-linked investigation lead for accountable review, not a market or site recommendation.",
      "The current evidence supports a footprint diagnostic; access, demand, feasibility, and decision authority remain unresolved.",
    ],
  },
  marketing: {
    version: ANSWER_DOMAIN_PACK_VERSION,
    perspectiveId: "marketing",
    label: "Marketing opportunity and measurement",
    primaryUser: "Marketing strategy or measurement analyst",
    decisionOwner: "Authorized Marketing decision owner",
    accountableReviewer: "Marketing measurement owner, channel owner, and data governance",
    requirements: [
      { requirementId: "marketing_comparable_cohort", label: "Comparable campaign cohort", questionToAnswer: "Which account, entity, funnel, tactic, channel, audience, budget, creative, promotion, and outcome definitions make the compared markets compatible?", required: true, readiness: "documented_not_approved", sourceIds: ["SRC-018", "SRC-023"], ifUnmet: "Report descriptive delivery separately by cohort; do not blend accounts or funnels." },
      { requirementId: "marketing_geography", label: "Geography semantics and coverage", questionToAnswer: "Does the evidence represent configured targets, physical presence, location interest, DMA, or postal geography, and what remains unresolved?", required: true, readiness: "documented_not_approved", sourceIds: ["SRC-018", "SRC-019", "SRC-020"], ifUnmet: "Do not map the signal to CBSA or interpret missing geography as zero demand." },
      { requirementId: "marketing_business_outcome", label: "First-party business outcome", questionToAnswer: "What approved first-party outcome, denominator, conversion definition, attribution setting, and lag window determine success?", required: true, readiness: "documented_not_approved", sourceIds: ["SRC-021", "SRC-024"], ifUnmet: "Treat platform conversions as reported platform evidence, not total demand or incremental business impact." },
      { requirementId: "marketing_incrementality", label: "Incrementality and guardrails", questionToAnswer: "What pre-period balance, test/control design, power, contamination, channel-substitution, operational, success, stop, and rollback rules support causal interpretation?", required: true, readiness: "documented_not_approved", sourceIds: ["SRC-022", "SRC-024"], ifUnmet: "Recommend only experiment design or further validation, not a spend or campaign change." },
    ],
    prohibitedConclusion: "Do not claim causal lift, total demand, audience eligibility, or authorize a campaign or spend change.",
    exampleQuestions: [
      "Which DMAs are plausible candidates for a controlled paid-search test?",
      "Where does observed media delivery differ after controlling for campaign cohort?",
    ],
    exampleBoundedConclusions: [
      "These markets are candidates for a test-feasibility review; public similarity does not establish incrementality.",
      "The evidence supports a delivery diagnostic, not an authorized spend change.",
    ],
  },
  pricing: {
    version: ANSWER_DOMAIN_PACK_VERSION,
    perspectiveId: "pricing",
    label: "Regional pricing investigation",
    primaryUser: "Pricing strategy or analytics analyst",
    decisionOwner: "Authorized Pricing decision owner",
    accountableReviewer: "Pricing Analytics, Pricing Science, Finance, and the authorized pricing owner",
    requirements: [
      { requirementId: "pricing_competitor_condition", label: "Competitor price and availability", questionToAnswer: "What dated ZIP, SKU, competitor, availability, coupon, package-equalization, sampling-coverage, and freshness evidence defines the regional condition?", required: true, readiness: "documented_not_approved", sourceIds: ["SRC-025", "SRC-028", "SRC-030"], ifUnmet: "Do not claim the sample represents a complete local competitor census." },
      { requirementId: "pricing_chewy_economics", label: "Chewy price and economics", questionToAnswer: "What compatible dated Chewy price, promotion, product hierarchy, PSE cost, raw or modeled cost, and materiality evidence makes the gap commercially relevant?", required: true, readiness: "documented_not_approved", sourceIds: ["SRC-025", "SRC-026", "SRC-027"], ifUnmet: "Keep cost definitions separate and do not infer local margin from national SKU exposure." },
      { requirementId: "pricing_customer_outcome", label: "Geographic customer outcome", questionToAnswer: "What approved privacy-safe geographic sales, units, discount, return, contribution, and response outcome measures commercial impact?", required: true, readiness: "missing", sourceIds: ["SRC-031"], ifUnmet: "Return a competitor-condition diagnostic, not a profitability or customer-response conclusion." },
      { requirementId: "pricing_test_authority", label: "Sensitivity, test, and action authority", questionToAnswer: "What validated elasticity status, experiment design, guardrails, approval, success measure, stop rule, and rollback govern a price test?", required: true, readiness: "documented_not_approved", sourceIds: ["SRC-032"], ifUnmet: "Recommend investigation or a controlled-test design only; never an automatic price action." },
    ],
    prohibitedConclusion: "Do not claim local contribution profit, pricing power, or authorize an item or regional price change.",
    exampleQuestions: [
      "Where do dated competitor price and availability conditions warrant deeper investigation?",
      "Which regions could support a controlled price test after coverage and outcome validation?",
    ],
    exampleBoundedConclusions: [
      "The evidence supports a competitor-condition diagnostic, not a regional profitability claim.",
      "A controlled-test design may be prepared after outcome, elasticity, approval, and rollback requirements are validated.",
    ],
  },
};

export function getAnswerDomainPack(perspectiveId: AnswerContract["perspectiveId"]): AnswerDomainPack {
  return packs[perspectiveId];
}

export function listAnswerDomainPacks(): AnswerDomainPack[] {
  return [packs.cvc, packs.marketing, packs.pricing];
}
