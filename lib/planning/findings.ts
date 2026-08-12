import type {
  EvaluationPlan,
  GeographyResolution,
  PlanFinding,
  PlanningIntent,
  PlannedAction,
  ResultWorkspaceType,
} from "./contracts.ts";

type FindingInput = {
  intent: PlanningIntent;
  proposalMethod: EvaluationPlan["proposalMethod"];
  capabilityId: EvaluationPlan["capabilityId"];
  status: EvaluationPlan["status"];
  geography: GeographyResolution;
  actions: PlannedAction[];
  missingEvidence: string[];
  missingApprovals: string[];
  resultWorkspaceType: ResultWorkspaceType;
};

export function deriveResultWorkspaceType(input: {
  intent: PlanningIntent;
  capabilityId: EvaluationPlan["capabilityId"];
  status: EvaluationPlan["status"];
  geography: GeographyResolution;
}): ResultWorkspaceType {
  const { intent, capabilityId, geography } = input;
  if (
    intent.clarificationRequired
    || geography.mode === "clarification"
    || geography.mode === "unavailable"
  ) {
    return "clarification";
  }
  if (capabilityId === "clinic_performance" || capabilityId === "local_growth_test") {
    return "evidence_readiness";
  }
  if (capabilityId === "clinic_site_evaluation") {
    return "clinic_evaluation_surface";
  }
  return "adaptive_market_workspace";
}

export function derivePlanFindings(input: FindingInput): PlanFinding[] {
  const {
    intent,
    proposalMethod,
    capabilityId,
    status,
    geography,
    actions,
    missingEvidence,
    missingApprovals,
    resultWorkspaceType,
  } = input;

  const findings: PlanFinding[] = [
    {
      id: "interpreted-question",
      kind: "interpretation",
      title: "Interpreted question",
      detail: intent.conciseInterpretation,
    },
    {
      id: "geography-resolution",
      kind: "geography",
      title: geography.mode === "national" || geography.mode === "needs_selection"
        ? "National geography"
        : geography.mode === "compare"
          ? "Compare cohort resolved"
          : geography.mode === "single"
            ? "Market resolved"
            : "Geography needs clarification",
      detail: geography.message,
    },
    {
      id: "capability-route",
      kind: "capability",
      title: `Capability: ${capabilityId.replaceAll("_", " ")}`,
      detail: `Requested action ${intent.requestedAction.replaceAll("_", " ")} routes to the ${resultWorkspaceType.replaceAll("_", " ")} result. Plan method: ${proposalMethod === "ai_proposed" ? "AI-proposed intent" : "deterministic fallback"}.`,
    },
    {
      id: "execution-status",
      kind: "execution",
      title: `Execution ${status.replaceAll("_", " ")}`,
      detail: status === "executable"
        ? "Deterministic operators may run only inside the selected capability boundary. AI did not calculate rankings or scores."
        : status === "partially_executable"
          ? "A bounded prototype path is available, but consequential approvals or evidence gaps remain visible."
          : "The governed evaluation cannot execute until missing evidence and approvals are resolved.",
    },
  ];

  if (missingEvidence.length || missingApprovals.length) {
    findings.push({
      id: "missing-gates",
      kind: "evidence",
      title: "Missing evidence and approvals",
      detail: [
        missingEvidence.length ? `Evidence: ${missingEvidence.join("; ")}` : null,
        missingApprovals.length ? `Approvals: ${missingApprovals.join("; ")}` : null,
      ].filter(Boolean).join(" "),
    });
  } else if (capabilityId === "census_market_context" && resultWorkspaceType === "adaptive_market_workspace") {
    findings.push({
      id: "public-context-boundary",
      kind: "evidence",
      title: "Public context only",
      detail: "SRC-016 Census measures remain market_context_only with scoring eligibility none.",
    });
  }

  const proposed = actions[0];
  findings.push({
    id: "proposed-action",
    kind: "actions",
    title: "Proposed action",
    detail: proposed
      ? `${proposed.title}. ${proposed.nextStep}`
      : "No governed action was compiled for this plan.",
  });

  return findings.slice(0, 6);
}

export function packetSummaryFromPlan(plan: EvaluationPlan): string {
  if (plan.resultWorkspaceType === "clarification") {
    return "The question needs clarification before a governed evaluation can continue.";
  }
  if (plan.resultWorkspaceType === "evidence_readiness") {
    return "The interpreted question matches a capability that is blocked by missing evidence or approvals.";
  }
  if (plan.resultWorkspaceType === "clinic_evaluation_surface") {
    return "A bounded clinic evaluation path is available for accountable review using only permitted synthetic or approved fixtures.";
  }
  return "Governed market-context comparison is available on the adaptive national map without creating an opportunity score.";
}
