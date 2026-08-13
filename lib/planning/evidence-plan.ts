import { z } from "zod";
import type { AnalysisBrief } from "./analysis-brief.ts";
import type { EvaluationPlan } from "./contracts.ts";
import type { MarketInvestigation } from "./market-investigation.ts";

export type EvidenceAvailability = "available" | "partial" | "missing" | "incompatible";

export type StagedEvidence = {
  id: string;
  fileName: string | null;
  mediaType: string | null;
  sizeBytes: number | null;
  note: string;
  stagedAt: string;
  state: "staged_for_review";
};

export type EvidencePlanItem = {
  id: string;
  label: string;
  role: "analysis_input" | "validity_check" | "context_only";
  requiredFor: string;
  availability: EvidenceAvailability;
  sourceIds: string[];
  reason: string;
  allowedUse: string;
  nextAction: string;
  stagedEvidence: StagedEvidence[];
  correctionRequest: string | null;
};

export type EvidencePlan = {
  version: "evidence-plan-v0.1";
  planId: string;
  originalQuestion: string;
  perspectiveId: EvaluationPlan["perspectiveId"];
  items: EvidencePlanItem[];
};

export type EvaluationDefinitionDraft = {
  version: "evaluation-definition-v0.1";
  planId: string;
  question: string;
  analysisIntent: "exploration";
  geography: string;
  period: string;
  currentMethod: string;
  strongestAllowedConclusion: string;
  availableEvidenceIds: string[];
  stagedEvidenceIds: string[];
  blockers: string[];
  status: "partially_executable" | "needs_evidence";
  steps: string[];
};

export const evidencePlanSchema = z.object({
  version: z.literal("evidence-plan-v0.1"),
  planId: z.string().trim().min(1),
  originalQuestion: z.string().trim().min(1),
  perspectiveId: z.enum(["cvc", "marketing", "pricing"]),
  items: z.array(z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    role: z.enum(["analysis_input", "validity_check", "context_only"]),
    requiredFor: z.string().trim().min(1),
    availability: z.enum(["available", "partial", "missing", "incompatible"]),
    sourceIds: z.array(z.string().trim().min(1)),
    reason: z.string().trim().min(1),
    allowedUse: z.string().trim().min(1),
    nextAction: z.string().trim().min(1),
    stagedEvidence: z.array(z.object({
      id: z.string().trim().min(1),
      fileName: z.string().trim().min(1).nullable(),
      mediaType: z.string().trim().min(1).nullable(),
      sizeBytes: z.number().int().nonnegative().nullable(),
      note: z.string().trim().min(1),
      stagedAt: z.string().trim().min(1),
      state: z.literal("staged_for_review"),
    }).strict()),
    correctionRequest: z.string().trim().min(1).nullable(),
  }).strict()).min(1),
}).strict();

export const evaluationDefinitionDraftSchema = z.object({
  version: z.literal("evaluation-definition-v0.1"),
  planId: z.string().trim().min(1),
  question: z.string().trim().min(1),
  analysisIntent: z.literal("exploration"),
  geography: z.string().trim().min(1),
  period: z.string().trim().min(1),
  currentMethod: z.string().trim().min(1),
  strongestAllowedConclusion: z.string().trim().min(1),
  availableEvidenceIds: z.array(z.string().trim().min(1)),
  stagedEvidenceIds: z.array(z.string().trim().min(1)),
  blockers: z.array(z.string().trim().min(1)),
  status: z.enum(["partially_executable", "needs_evidence"]),
  steps: z.array(z.string().trim().min(1)).min(1),
}).strict();

function item(input: Omit<EvidencePlanItem, "stagedEvidence" | "correctionRequest">): EvidencePlanItem {
  return { ...input, stagedEvidence: [], correctionRequest: null };
}

const publicContext = () => item({
  id: "public_market_context",
  label: "Public market context",
  role: "context_only",
  requiredFor: "Same-grain structural context and map display",
  availability: "available",
  sourceIds: ["SRC-014", "SRC-015", "SRC-016"],
  reason: "Checked-in CBSA identities, boundaries, and ACS period estimates are connected.",
  allowedUse: "Market context only; no opportunity or recommendation scoring.",
  nextAction: "Keep geography, period, and public-context limitations visible.",
});

function cvcItems(): EvidencePlanItem[] {
  return [
    item({ id: "published_cvc_footprint", label: "Published CVC clinic footprint", role: "context_only", requiredFor: "Identify footprint-versus-no-footprint contrasts", availability: "partial", sourceIds: ["SRC-009"], reason: "Public clinic points are mapped, but opening dates, capacity, maturity, service mix, and trade areas are absent.", allowedUse: "Published footprint context only.", nextAction: "Validate against a governed clinic master and capacity snapshot." }),
    item({ id: "addressable_pet_demand", label: "Addressable pet and customer demand", role: "analysis_input", requiredFor: "Measure demand rather than use households as a proxy", availability: "missing", sourceIds: [], reason: "No approved CBSA or governed ZIP-crosswalk demand package is connected.", allowedUse: "Unavailable; must not be imputed from Census households.", nextAction: "Request aggregate pet-household, customer penetration, bookings, and demand measures at compatible grain." }),
    item({ id: "clinic_access_capacity", label: "CVC access and staffed capacity", role: "analysis_input", requiredFor: "Measure reachable clinic access", availability: "missing", sourceIds: [], reason: "No approved trade areas, travel-time coverage, staffed hours, appointment availability, or utilization are connected.", allowedUse: "Unavailable; clinic count cannot substitute for access or capacity.", nextAction: "Request clinic open date, staffed capacity, appointment availability, and approved trade-area definitions." }),
    item({ id: "veterinary_supply", label: "Competitive veterinary supply", role: "analysis_input", requiredFor: "Distinguish CVC footprint gaps from overall veterinary whitespace", availability: "missing", sourceIds: [], reason: "No governed GP veterinary location, provider, service-mix, capacity, or availability package is connected.", allowedUse: "Unavailable.", nextAction: "Request competitor GP locations and capacity with compatible geography and period." }),
    item({ id: "feasibility_and_history", label: "Feasibility and historical outcomes", role: "validity_check", requiredFor: "Challenge whether a lead can advance", availability: "missing", sourceIds: [], reason: "Property, labor, permitting, economics, and mature-clinic outcome evidence are not connected.", allowedUse: "Required before advancement; not part of the public-context screen.", nextAction: "Assign owners for labor, real estate, clinic economics, and historical outcome evidence." }),
    publicContext(),
  ];
}

function marketingItems(): EvidencePlanItem[] {
  return [
    item({ id: "marketing_baseline", label: "Pre-period customer and outcome baseline", role: "analysis_input", requiredFor: "Evaluate peer balance and outcome stability", availability: "missing", sourceIds: ["SRC-004"], reason: "No approved market-level customer/outcome package is connected.", allowedUse: "Unavailable; public Census context cannot substitute for customer outcomes.", nextAction: "Request compatible pre-period customer mix, outcomes, trends, and sample sizes." }),
    item({ id: "media_exposure", label: "Media delivery, cost, and campaign history", role: "analysis_input", requiredFor: "Assess reach and contamination", availability: "missing", sourceIds: ["SRC-004"], reason: "Google Ads access exists outside the governed package boundary; no validated geographic export is connected.", allowedUse: "Evidence needed; do not infer exposure from population.", nextAction: "Stage a controlled geographic report with campaign and conversion-goal definitions for Nik's validation." }),
    item({ id: "test_validity", label: "Test/control validity rules", role: "validity_check", requiredFor: "Assign test and control geographies", availability: "missing", sourceIds: [], reason: "Experiment unit, contamination boundary, minimum sample, exclusions, and guardrails are unresolved.", allowedUse: "Human-confirmed definition required before test assignment.", nextAction: "Confirm channel, objective, attribution window, budget owner, exclusions, and success/stop rules." }),
    publicContext(),
  ];
}

function pricingItems(): EvidencePlanItem[] {
  return [
    item({ id: "price_exposure", label: "Regional price and promotion exposure", role: "analysis_input", requiredFor: "Describe the treatment customers saw", availability: "missing", sourceIds: ["SRC-004"], reason: "No governed regional price/promotion package is connected.", allowedUse: "Unavailable.", nextAction: "Request item, geography, timestamp, price, promotion, availability, and price-driver fields." }),
    item({ id: "customer_response", label: "Customer and business response", role: "analysis_input", requiredFor: "Evaluate conversion, units, retention, substitution, and margin", availability: "missing", sourceIds: ["SRC-002", "SRC-004"], reason: "No compatible outcome and denominator package is connected.", allowedUse: "Unavailable; elasticity cannot be inferred from demographics.", nextAction: "Confirm outcome, denominator, observation window, and aggregate export owner." }),
    item({ id: "competitive_context", label: "Competitor relevance and availability", role: "validity_check", requiredFor: "Compare like products and meaningful competitors", availability: "missing", sourceIds: ["SRC-004"], reason: "Competitor relevance, landed-price definition, sampling coverage, and substitutes are unresolved.", allowedUse: "Evidence needed before regional pattern claims.", nextAction: "Request the competitor-relevance framework and representative sampling design." }),
    { ...publicContext(), availability: "incompatible", reason: "Public market context is connected but cannot answer pricing response or elasticity.", nextAction: "Use only as labeled context after compatible pricing evidence is validated." },
  ];
}

export function buildEvidencePlan(plan: EvaluationPlan): EvidencePlan {
  return {
    version: "evidence-plan-v0.1",
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    perspectiveId: plan.perspectiveId,
    items: plan.perspectiveId === "cvc" ? cvcItems() : plan.perspectiveId === "marketing" ? marketingItems() : pricingItems(),
  };
}

export function stageEvidence(plan: EvidencePlan, evidenceId: string, staged: StagedEvidence): EvidencePlan {
  return {
    ...plan,
    items: plan.items.map((entry) => entry.id === evidenceId
      ? { ...entry, stagedEvidence: [...entry.stagedEvidence, staged] }
      : entry),
  };
}

export function requestEvidenceCorrection(plan: EvidencePlan, evidenceId: string, correctionRequest: string): EvidencePlan {
  return {
    ...plan,
    items: plan.items.map((entry) => entry.id === evidenceId
      ? { ...entry, correctionRequest: correctionRequest.trim() || null }
      : entry),
  };
}

export function generateEvaluationDefinitionDraft(
  brief: AnalysisBrief,
  investigation: MarketInvestigation,
  evidencePlan: EvidencePlan,
): EvaluationDefinitionDraft {
  const available = evidencePlan.items.filter((entry) => entry.availability === "available" || entry.availability === "partial");
  const staged = evidencePlan.items.flatMap((entry) => entry.stagedEvidence.map((stagedItem) => stagedItem.id));
  const blockers = evidencePlan.items
    .filter((entry) => entry.role !== "context_only" && (entry.availability === "missing" || entry.availability === "incompatible"))
    .map((entry) => `${entry.label}: ${entry.reason}`);
  return {
    version: "evaluation-definition-v0.1",
    planId: brief.planId,
    question: brief.rewrittenQuestion,
    analysisIntent: "exploration",
    geography: brief.geography,
    period: brief.timeframe,
    currentMethod: investigation.screeningScope.selectionRule,
    strongestAllowedConclusion: investigation.readiness.label === "Partial answer"
      ? "Question-specific validation leads from published footprint and public market context; no access, demand, causal, or opportunity conclusion."
      : "Evidence-readiness finding only; no question-specific market conclusion.",
    availableEvidenceIds: available.map((entry) => entry.id),
    stagedEvidenceIds: staged,
    blockers,
    status: available.length ? "partially_executable" : "needs_evidence",
    steps: [
      "Use the human-confirmed question, geography, assumptions, and consideration roles.",
      "Run only the deterministic public-context screen supported by connected evidence.",
      "Keep staged evidence quarantined until its grain, period, definitions, quality, and allowed use are validated.",
      "Return validation leads with missing evidence and method limitations.",
      "Create a new definition and rerun after Nik's validator accepts compatible source packages.",
    ],
  };
}
