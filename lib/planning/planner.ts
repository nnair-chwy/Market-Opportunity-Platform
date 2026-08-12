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

const STEP_TEMPLATE = [
  { id: "interpret", label: "Interpret the question", detail: "Identify the decision, geography, requested output, and decision boundary.", result: "Decision scope identified" },
  { id: "capabilities", label: "Check available capabilities", detail: "Match the request to the versioned capability registry.", result: "Capability coverage mapped" },
  { id: "evidence", label: "Validate evidence", detail: "Keep missing, unavailable, and unapproved evidence explicit.", result: "Evidence gates evaluated" },
  { id: "calculate", label: "Run deterministic operators", detail: "Use only permitted joins, comparisons, rankings, thresholds, and formulas.", result: "Bounded result prepared" },
  { id: "packet", label: "Prepare accountable review", detail: "Package findings, blockers, provenance, and the required human approval.", result: "Draft packet ready" },
] as const;

function has(value: string, expression: RegExp) {
  return expression.test(value);
}

export function inferPlanningIntent(question: string): PlanningIntent {
  const value = question.toLowerCase();
  const clinic = has(value, /\b(clinic|clinics|vet care|veterinary)\b/);
  const performance = clinic && has(value, /\b(performance|peer|underperform|operating)\b/);
  const growth = has(value, /\b(campaign|advertis|promotion|awareness|growth test)\b/);
  const location = clinic && has(value, /\b(open|opening|location|site|market|where)\b/) && !performance;
  const requestedMeasure: PlanningIntent["requestedMeasure"] = has(value, /\bdens/) ? "population_density"
    : has(value, /\bincome|affluence|ability to pay/) ? "median_household_income"
      : has(value, /\bhousehold/) ? "household_count"
        : has(value, /\bhousing/) ? "housing_unit_count"
          : has(value, /\bpopulation|people|resident|market size/) ? "total_population"
            : "total_population";
  const requestedAction: PlanningIntent["requestedAction"] = has(value, /\b(approve|authorize|sign|open)\b/) ? "approve"
    : has(value, /\b(why|driver|investigate)\b/) ? "investigate"
      : has(value, /\b(best|which|screen|prioritize|where)\b/) ? "screen"
        : has(value, /\b(compare|versus| vs )\b/) ? "compare"
          : "describe";
  const topic: PlanningIntent["topic"] = performance ? "clinic_performance"
    : location ? "clinic_location"
      : growth ? "local_growth"
        : has(value, /\b(market|metro|city|population|household|income|density)\b/) ? "market_context"
          : "other";
  const geographyGrain: PlanningIntent["geographyGrain"] = performance ? "portfolio"
    : has(value, /\b(submarket|seattle)\b/) ? "submarket"
      : has(value, /\b(site|property|parcel)\b/) ? "site"
        : topic === "other" ? "unknown" : "cbsa";
  return planningIntentSchema.parse({
    topic,
    geographyGrain,
    requestedAction,
    requestedMeasure,
    conciseInterpretation: topic === "other"
      ? "The requested decision does not yet match an available governed evaluation."
      : `Evaluate ${topic.replaceAll("_", " ")} at the ${geographyGrain.replaceAll("_", " ")} level.`,
  });
}

function requirementFor(intent: PlanningIntent): CapabilityQuestion["requirements"][number] {
  if (intent.topic === "clinic_performance") return { capabilityId: "clinic_performance", outputId: "clinic_outcome_comparison", geographyGrain: "portfolio" };
  if (intent.topic === "clinic_location" && intent.geographyGrain !== "cbsa") return { capabilityId: "clinic_site_evaluation", outputId: "candidate_site_comparison", geographyGrain: intent.geographyGrain === "submarket" ? "submarket" : "site" };
  if (intent.topic === "clinic_location") return { capabilityId: "clinic_site_evaluation", outputId: intent.requestedAction === "approve" ? "final_site_decision" : "market_ranking", geographyGrain: "cbsa" };
  if (intent.topic === "local_growth") return { capabilityId: "local_growth_test", outputId: "growth_test_measurement", geographyGrain: "market" };
  return { capabilityId: "census_market_context", outputId: "market_context_profile", geographyGrain: "cbsa" };
}

function actionsFor(intent: PlanningIntent, assessment: ReturnType<typeof assessCapabilityQuestion>): PlannedAction[] {
  const context: PlannedAction = {
    id: "public-market-context",
    title: "Explore governed market context",
    summary: "Use the full national map to filter, scale, rank, and inspect one compatible Census measure.",
    owner: "Market Intelligence",
    timing: "Available now",
    confidence: "High",
    evidence: ["Validated public Census aggregates", "Compatible CBSA geography", "Deterministic percentile comparison"],
    tradeoffs: ["Context is not an opportunity score", "Market boundaries are not trade areas"],
    nextStep: "Select a measure and market, then verify the source and evidence boundary.",
    outputId: "market_context_profile",
    requiresApproval: false,
  };
  if (intent.topic === "market_context" || intent.topic === "other") return [context];
  const blocked: PlannedAction = {
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
  return [context, blocked];
}

export function compileEvaluationPlan(question: string, intent: PlanningIntent, proposalMethod: EvaluationPlan["proposalMethod"] = "deterministic_fallback"): EvaluationPlan {
  const requirement = requirementFor(intent);
  const assessment = assessCapabilityQuestion({ question, requirements: [requirement], availableEvidenceIds: [], satisfiedApprovalIds: [] });
  return evaluationPlanSchema.parse({
    planId: `plan-${intent.topic}-${intent.geographyGrain}`,
    version: "1.0.0",
    originalQuestion: question,
    proposalMethod,
    intent,
    capabilityId: requirement.capabilityId,
    geographyGrain: requirement.geographyGrain === "market" ? "cbsa" : requirement.geographyGrain,
    status: assessment.outcome === "supported" ? "executable" : assessment.outcome === "partially_supported" ? "partially_executable" : "blocked",
    evidenceBoundary: requirement.capabilityId === "census_market_context"
      ? "Public Census context describes compatible market measures. It does not rank business opportunity or authorize action."
      : "Only registry-supported prototype outputs may run. Consequential actions remain gated by approved evidence and human authority.",
    missingEvidence: assessment.missingEvidence,
    missingApprovals: assessment.missingApprovals,
    steps: STEP_TEMPLATE,
    actions: actionsFor(intent, assessment),
  });
}

export function planEvaluation(question: string) {
  return compileEvaluationPlan(question, inferPlanningIntent(question));
}
