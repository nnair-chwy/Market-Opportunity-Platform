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
import { extractRequestedPlaces, resolveGeography } from "./geography.ts";
import { buildPlanSteps } from "./steps.ts";

function has(value: string, expression: RegExp) {
  return expression.test(value);
}

export function inferPlanningIntent(question: string): PlanningIntent {
  const value = question.toLowerCase();
  const clinic = has(value, /\b(clinic|clinics|vet care|veterinary)\b/);
  const performance = clinic && has(value, /\b(performance|peer|underperform|operating)\b/);
  const growth = has(value, /\b(campaign|advertis|promotion|awareness|growth test|marketing|media|test market|control market|reach)\b/);
  const location = clinic && has(value, /\b(open|opening|location|site|market|where|investigate)\b/) && !performance;
  const vague = has(value, /\bwhat should we do next\b/) || has(value, /\bwhat next\b/);
  const requestedMeasure: PlanningIntent["requestedMeasure"] = performance || growth || vague
    ? "none"
    : has(value, /\bdens/) ? "population_density"
      : has(value, /\bincome|affluence|ability to pay/) ? "median_household_income"
        : has(value, /\bhousehold/) ? "household_count"
          : has(value, /\bhousing/) ? "housing_unit_count"
            : has(value, /\bpopulation|people|resident|market size/) ? "total_population"
              : location ? "none" : "total_population";
  const requestedAction: PlanningIntent["requestedAction"] = has(value, /\b(approve|authorize|sign)\b/) ? "approve"
    : has(value, /\b(why|driver|investigate|underperform)\b/) ? "investigate"
      : has(value, /\b(best|which|screen|prioritize|where)\b/) ? "screen"
        : has(value, /\b(compare|versus| vs )\b/) ? "compare"
          : "describe";
  const topic: PlanningIntent["topic"] = performance ? "clinic_performance"
    : location ? "clinic_location"
      : growth ? "local_growth"
        : vague ? "other"
          : has(value, /\b(market|metro|city|population|household|income|density|cbsa)\b/) ? "market_context"
            : "other";
  const requestedPlaces = extractRequestedPlaces(question);
  const geographyGrain: PlanningIntent["geographyGrain"] = performance ? "portfolio"
    : has(value, /\bsubmarket\b/) || (requestedPlaces.some((place) => /seattle/i.test(place.name)) && location)
      ? "submarket"
      : has(value, /\b(site|property|parcel)\b/) ? "site"
        : topic === "other" && !requestedPlaces.length ? "unknown"
          : "cbsa";
  const clarificationRequired = vague
    || (requestedAction === "compare" && requestedPlaces.length < 2 && topic === "market_context" && !has(value, /\b(u\.s\.|us |national|across)\b/))
    || topic === "other";
  const clarificationReason: PlanningIntent["clarificationReason"] = vague || topic === "other"
    ? "ambiguous_decision"
    : requestedAction === "compare" && requestedPlaces.length < 2
      ? "ambiguous_comparison_cohort"
      : "none";
  const placeLabel = requestedPlaces.length
    ? requestedPlaces.map((place) => place.name).join(" and ")
    : "national CBSA context";
  const conciseInterpretation = topic === "other" || vague
    ? "Clarify the decision, geography, and required output before compiling a governed evaluation."
    : topic === "clinic_performance"
      ? "Investigate operating-clinic performance against peers once approved aggregate evidence exists."
      : topic === "local_growth"
        ? `Assess a local growth or campaign question for ${placeLabel} against approved measurement gates.`
        : topic === "clinic_location"
          ? `Investigate clinic-location evidence for ${placeLabel} using published footprint and governed public context, with missing business evidence kept visible.`
          : requestedAction === "compare"
            ? `Compare ${placeLabel} using the requested public market measure.`
            : `Describe ${placeLabel} with governed public market context.`;

  return planningIntentSchema.parse({
    topic,
    geographyGrain,
    requestedAction,
    requestedMeasure,
    requestedPlaces,
    clarificationRequired: clarificationRequired && clarificationReason !== "none",
    clarificationReason: clarificationRequired ? clarificationReason : "none",
    conciseInterpretation,
  });
}

function requirementFor(intent: PlanningIntent): CapabilityQuestion["requirements"][number] {
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
  return { capabilityId: "census_market_context", outputId: "market_context_profile", geographyGrain: "cbsa" };
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
        : "Review the bounded clinic evaluation surface with source-linked limitations.",
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
): EvaluationPlan {
  const resolvedPerspectiveId: EvaluationPlan["perspectiveId"] = perspectiveId
    ?? (intent.topic === "clinic_location" || intent.topic === "clinic_performance" || /\b(clinic|clinics|cvc|veterinar|vet)\b/i.test(question)
      ? "cvc"
      : intent.topic === "local_growth"
        ? "marketing"
        : /\b(price|pricing|elasticity|promo)\b/i.test(question)
          ? "pricing"
          : "marketing");
  const exploratoryQuestion = /\b(comparable|which|where|patterns?|worth investigating|differ)\b/i.test(question);
  const canAssumeNationalCohort = exploratoryQuestion
    && intent.requestedPlaces.length === 0
    && (perspectiveId !== undefined || /\b(marketing|campaign|media|test market|control market|clinic|cvc|veterinar|vet)\b/i.test(question))
    && (resolvedPerspectiveId === "marketing" || resolvedPerspectiveId === "cvc")
    && intent.requestedAction !== "approve";
  const effectiveIntent = planningIntentSchema.parse(canAssumeNationalCohort ? {
    ...intent,
    topic: resolvedPerspectiveId === "cvc" ? "clinic_location" : "local_growth",
    geographyGrain: "cbsa",
    requestedAction: intent.requestedAction === "describe" ? "investigate" : intent.requestedAction,
    clarificationRequired: false,
    clarificationReason: "none",
    conciseInterpretation: resolvedPerspectiveId === "cvc"
      ? "Screen national metro markets for question-specific CVC footprint contrasts, then identify the evidence needed to validate each lead."
      : "Screen national metro markets for structurally comparable peers and regional contrasts, then identify the evidence needed to validate each lead.",
  } : intent);
  const requirement = requirementFor(effectiveIntent);
  const assessment = assessCapabilityQuestion({
    question,
    requirements: [requirement],
    availableEvidenceIds: [],
    satisfiedApprovalIds: [],
  });
  const geography = resolveGeography(effectiveIntent);
  const status: EvaluationPlan["status"] = geography.mode === "clarification" || geography.mode === "unavailable"
    ? "blocked"
    : assessment.outcome === "supported"
      ? "executable"
      : assessment.outcome === "partially_supported"
        ? "partially_executable"
        : "blocked";
  const resultWorkspaceType = deriveResultWorkspaceType({
    intent: effectiveIntent,
    capabilityId: requirement.capabilityId,
    status,
    geography,
  });
  const actions = actionsFor(effectiveIntent, assessment, geography, resultWorkspaceType);
  const findings = derivePlanFindings({
    intent: effectiveIntent,
    proposalMethod,
    capabilityId: requirement.capabilityId,
    status,
    geography,
    actions,
    missingEvidence: assessment.missingEvidence,
    missingApprovals: assessment.missingApprovals,
    resultWorkspaceType,
  });

  return evaluationPlanSchema.parse({
    planId: `plan-${effectiveIntent.topic}-${geography.mode}-${requirement.capabilityId}`,
    version: "1.0.0",
    originalQuestion: question,
    perspectiveId: resolvedPerspectiveId,
    proposalMethod,
    intent: effectiveIntent,
    capabilityId: requirement.capabilityId,
    geographyGrain: requirement.geographyGrain === "market" ? "cbsa" : requirement.geographyGrain,
    geographyResolution: geography,
    resultWorkspaceType,
    status,
    evidenceBoundary: requirement.capabilityId === "census_market_context"
      ? "Public Census context describes compatible market measures. It does not rank business opportunity or authorize action."
      : "Only registry-supported prototype outputs may run. Consequential actions remain gated by approved evidence and human authority.",
    missingEvidence: assessment.missingEvidence,
    missingApprovals: assessment.missingApprovals,
    steps: buildPlanSteps({
      intent: effectiveIntent,
      capabilityId: requirement.capabilityId,
      status,
      geography,
      missingEvidence: assessment.missingEvidence,
      missingApprovals: assessment.missingApprovals,
    }),
    actions,
    findings,
  });
}

export function planEvaluation(question: string, perspectiveId?: EvaluationPlan["perspectiveId"]) {
  return compileEvaluationPlan(question, inferPlanningIntent(question), "deterministic_fallback", perspectiveId);
}
