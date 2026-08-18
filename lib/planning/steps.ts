import type {
  EvaluationPlan,
  GeographyResolution,
  PlanningIntent,
  PlanStep,
} from "./contracts.ts";

type StepInput = {
  intent: PlanningIntent;
  capabilityId: EvaluationPlan["capabilityId"];
  status: EvaluationPlan["status"];
  geography: GeographyResolution;
  missingEvidence: string[];
  missingApprovals: string[];
};

function step(
  id: string,
  label: string,
  detail: string,
  result: string,
): PlanStep {
  return { id, label, detail, result };
}

export function buildPlanSteps(input: StepInput): PlanStep[] {
  const { intent, capabilityId, status, geography, missingEvidence, missingApprovals } = input;
  const interpret = step(
    "interpret",
    "Interpret the question",
    intent.conciseInterpretation,
    intent.clarificationRequired
      ? `Clarification flagged: ${intent.clarificationReason.replaceAll("_", " ")}`
      : `${intent.topic.replaceAll("_", " ")} · ${intent.requestedAction}`,
  );
  const resolveGeography = step(
    "resolve-geography",
    "Resolve geography and cohort",
    geography.message,
    geography.mode === "compare"
      ? `${geography.selectedCbsaCodes.length} markets queued for compare`
      : geography.mode === "single"
        ? `Selected CBSA ${geography.selectedCbsaCodes[0]}`
        : geography.mode.replaceAll("_", " "),
  );

  if (
    intent.clarificationRequired
    || geography.mode === "clarification"
    || geography.mode === "unavailable"
  ) {
    return [
      interpret,
      resolveGeography,
      step(
        "capability-gap",
        "Check capability coverage",
        "Pause before selecting an executable path while the question or geography remains unresolved.",
        "Clarification required before execution",
      ),
      step(
        "clarify-next-step",
        "Request clarification",
        "Ask the analyst to name the decision, geography or cohort, and required output, then resubmit.",
        "Clarification packet prepared",
      ),
    ];
  }

  if (capabilityId === "census_market_context") {
    const measureLabel = intent.requestedMeasure === "none"
      ? "No Census measure requested"
      : intent.requestedMeasure.replaceAll("_", " ");
    return [
      interpret,
      resolveGeography,
      step(
        "validate-measure",
        "Validate requested measure",
        `Confirm the requested public measure stays inside the SRC-016 market-context contract.`,
        measureLabel,
      ),
      step(
        "calculate-context",
        "Calculate deterministic comparison",
        status === "executable"
          ? "Run compare_cohort percentiles only for markets with observed values in the selected cohort."
          : "Deterministic Census comparison remains blocked until geography and measure gates pass.",
        status === "executable" ? "Public percentile comparison ready" : "Calculation not started",
      ),
      step(
        "present-context",
        "Present market context",
        "Open the adaptive national market workspace without converting context into an opportunity score.",
        "Market-context packet prepared",
      ),
    ];
  }

  if (capabilityId === "clinic_site_evaluation") {
    return [
      interpret,
      step(
        "resolve-site-scope",
        "Resolve market and site scope",
        geography.message,
        geography.selectedCbsaCodes.length
          ? `Scope anchored to ${geography.selectedCbsaCodes.join(", ")}`
          : "Market or site scope still required",
      ),
      step(
        "inspect-evidence-gates",
        "Inspect evidence gates",
        "Check governed evidence availability and material approval requirements before any ranking.",
        missingEvidence.length || missingApprovals.length
          ? "Gates remain visible"
          : "Evidence gates satisfied",
      ),
      step(
        "run-permitted-evaluation",
        "Run only permitted evaluation",
        status === "blocked"
          ? "No clinic-location ranking runs while required evidence or approvals are missing."
          : "Use only governed, source-linked evidence for the permitted output.",
        status === "blocked" ? "Evaluation not executed" : `Status: ${status.replaceAll("_", " ")}`,
      ),
      step(
        "accountable-review",
        "Prepare accountable review",
        "Package the bounded clinic evaluation surface for human review without authorizing a lease or opening.",
        "Clinic review packet prepared",
      ),
    ];
  }

  if (capabilityId === "clinic_performance") {
    return [
      interpret,
      step(
        "resolve-portfolio-scope",
        "Resolve portfolio scope",
        "Operating-clinic comparisons require an approved portfolio grain and outcome definition.",
        intent.geographyGrain === "portfolio" ? "Portfolio scope identified" : "Portfolio scope unclear",
      ),
      step(
        "report-aggregate-evidence",
        "Report aggregate evidence readiness",
        missingEvidence.length
          ? `Unavailable evidence: ${missingEvidence.join("; ")}.`
          : "Approved aggregate clinic-performance evidence is not connected.",
        status === "blocked" ? "Aggregate evidence unavailable" : "Evidence review required",
      ),
      step(
        "execution-boundary",
        "Keep execution boundary explicit",
        "Do not calculate peer underperformance until the capability registry permits the comparison.",
        "No unsupported performance ranking",
      ),
    ];
  }

  if (capabilityId === "consumer_insights") {
    return [
      interpret,
      resolveGeography,
      step(
        "validate-consumer-snapshot",
        "Validate consumer-insights snapshot",
        "Confirm the dated survey wave, source provenance, sample, missingness, and requested BDI/CDI or brand-health measures.",
        "Normalized snapshot and registered queries validated",
      ),
      step(
        "align-dma-to-cbsa",
        "Align DMA to CBSA",
        "Use the versioned intuitive metro-name crosswalk and preserve its Derived status, confidence, and owner-review state.",
        "Intuitive local-demo geography alignment visible",
      ),
      step(
        "prepare-consumer-review",
        "Prepare consumer-insights review",
        "Return source-linked descriptive evidence without scoring, causal interpretation, or site-selection action.",
        status === "blocked" ? "Review blocked by geography" : "Consumer-insights packet prepared",
      ),
    ];
  }

  if (capabilityId === "local_growth_test") {
    return [
      interpret,
      resolveGeography,
      step(
        "inspect-growth-inputs",
        "Inspect approved growth inputs",
        missingEvidence.length
          ? `Missing inputs: ${missingEvidence.join("; ")}.`
          : "Confirm approved campaign and audience inputs before any growth test.",
        "Growth inputs inspected",
      ),
      step(
        "report-planned-status",
        "Report planned or blocked status",
        status === "blocked"
          ? "Local growth testing remains planned until approved measurement evidence and approvals exist."
          : "Execute only the registry-permitted growth output.",
        status.replaceAll("_", " "),
      ),
    ];
  }

  return [
    interpret,
    resolveGeography,
    step(
      "capability-gap",
      "Check capability coverage",
      "The request does not yet match a connected governed evaluation path.",
      "No executable capability selected",
    ),
    step(
      "clarify-next-step",
      "Request clarification",
      "Ask the analyst to name the decision, geography, and required output before compiling a packet.",
      "Clarification required",
    ),
  ];
}
