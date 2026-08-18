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
import { buildAnswerContract } from "./answer-contract.ts";
import { validateAnswerContract } from "./answer-contract-validator.ts";
import type { DecisionFramingProposal } from "./decision-framing.ts";
import type { PerspectiveViewId } from "../perspectives/contracts.ts";
import { getDefaultView, selectPerspectiveView } from "../perspectives/index.ts";

const MARKETING_COST_INTENT = /\b(cost per click|cpc|ad cost|ad costs|ad spend|media spend|spend|spending|paying|overpay\w*|paid too much|too much on ads?|spend efficiency|budget efficiency)\b/;

function inferredViewId(question: string, perspectiveId: EvaluationPlan["perspectiveId"]): PerspectiveViewId | undefined {
  const value = question.toLowerCase();
  if (perspectiveId === "marketing") {
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

function decisionInterpretationForView(
  question: string,
  perspectiveId: EvaluationPlan["perspectiveId"],
  activeViewId: PerspectiveViewId | undefined,
  fallback: string,
) {
  const value = question.toLowerCase();

  if (perspectiveId === "marketing") {
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
  const clinic = has(value, /\b(clinic|clinics|vet care|veterinary)\b/);
  const performance = clinic && has(value, /\b(performance|peer|underperform|operating)\b/);
  const growth = has(value, /\b(ad|ads|adwords|campaign|advertis\w*|paid search|promotion|awareness|growth test|marketing|media|test market|control market|reach)\b/);
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
  framingProposal?: DecisionFramingProposal,
  activeViewId?: PerspectiveViewId,
): EvaluationPlan {
  const normalizedIntent = planningIntentSchema.parse({
    ...intent,
    requestedPlaces: normalizeRequestedPlaces(question, intent.requestedPlaces),
  });
  const resolvedPerspectiveId: EvaluationPlan["perspectiveId"] = perspectiveId
    ?? (normalizedIntent.topic === "clinic_location" || normalizedIntent.topic === "clinic_performance" || /\b(clinic|clinics|cvc|veterinar|vet)\b/i.test(question)
      ? "cvc"
      : normalizedIntent.topic === "local_growth"
        ? "marketing"
        : /\b(price|pricing|elasticity|promo)\b/i.test(question)
          ? "pricing"
          : "marketing");
  const questionViewId = inferredViewId(question, resolvedPerspectiveId);
  const selectedViewId = questionViewId ?? activeViewId ?? getDefaultView(resolvedPerspectiveId).viewId;
  const selectedViewResult = selectPerspectiveView(resolvedPerspectiveId, selectedViewId);
  const selectedView = "status" in selectedViewResult ? getDefaultView(resolvedPerspectiveId) : selectedViewResult;
  const exploratoryQuestion = /\b(comparable|which|where|patterns?|worth investigating|differ)\b/i.test(question);
  const canAssumeNationalCohort = exploratoryQuestion
    && normalizedIntent.requestedPlaces.length === 0
    && (perspectiveId !== undefined || /\b(marketing|campaign|media|ads?|advertis\w*|paid search|test market|control market|clinic|cvc|veterinar|vet)\b/i.test(question))
    && (resolvedPerspectiveId === "marketing" || resolvedPerspectiveId === "cvc")
    && normalizedIntent.requestedAction !== "approve";
  const viewAwareInterpretation = decisionInterpretationForView(
    question,
    resolvedPerspectiveId,
    activeViewId,
    normalizedIntent.conciseInterpretation,
  );
  const effectiveIntent = planningIntentSchema.parse(canAssumeNationalCohort ? {
    ...normalizedIntent,
    topic: resolvedPerspectiveId === "cvc" ? "clinic_location" : "local_growth",
    geographyGrain: "cbsa",
    requestedAction: normalizedIntent.requestedAction === "describe" ? "investigate" : normalizedIntent.requestedAction,
    requestedMeasure: normalizedIntent.requestedMeasure,
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
    ...normalizedIntent,
    conciseInterpretation: viewAwareInterpretation,
  });
  const requirement = requirementFor(effectiveIntent);
  const assessment = assessCapabilityQuestion({
    question,
    requirements: [requirement],
    availableEvidenceIds: [],
    satisfiedApprovalIds: [],
  });
  const geography = resolveGeography(effectiveIntent);
  const status: EvaluationPlan["status"] = effectiveIntent.clarificationRequired || geography.mode === "clarification" || geography.mode === "unavailable"
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
      datasetId: selectedView.mapBinding.kind === "workspace_snapshot" ? selectedView.mapBinding.datasetId : null,
      sourceIds: selectedView.sourceIds,
      selectionReason: questionViewId ? "question_inference" : activeViewId ? "explicit_view" : "perspective_default",
      evidenceBoundary: selectedView.evidenceBoundary,
    },
    status,
    evidenceBoundary: requirement.capabilityId === "census_market_context"
      ? "Public Census context describes compatible market measures. It does not rank business opportunity or authorize action."
      : selectedView.mapBinding.kind === "workspace_snapshot"
        ? selectedView.evidenceBoundary
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
  activeViewId?: PerspectiveViewId,
) {
  return compileEvaluationPlan(question, inferPlanningIntent(question), "deterministic_fallback", perspectiveId, undefined, activeViewId);
}
