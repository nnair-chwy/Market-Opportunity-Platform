import { evaluationPlanSchema, type EvaluationPlan } from "../planning/contracts.ts";
import { buildAnswerContract } from "../planning/answer-contract.ts";
import { compileEvaluationPlan, inferPlanningIntent } from "../planning/planner.ts";

export const DEMO_SNAPSHOT_VERSION = "clinic-market-demo-2026-08-17-v1" as const;

export const DEMO_QUESTIONS = {
  marketContext: "Show regional, clinic, and Google Ads evidence for Atlanta.",
  clinicPerformance: "How is this clinic performing relative to an approved peer group, and how reliable is that comparison?",
  growthTest: "Rank regional growth-test candidates.",
} as const;

export const PHOENIX_DEMO_MARKET = {
  scenarioId: "phoenix-market-context-v1",
  marketId: "cbsa:38060",
  cbsaCode: "38060",
  cbsaName: "Phoenix-Mesa-Chandler, AZ",
} as const;

export const SYNTHETIC_CLINIC_PERFORMANCE_SCENARIO = {
  scenarioId: "synthetic-clinic-performance-v1",
  selectedClinicId: "SYN-CVC-003",
  peerClinicIds: ["SYN-CVC-001", "SYN-CVC-002", "SYN-CVC-003"],
  metricId: "completed_appointments",
  metricLabel: "Completed appointments",
  weeksSinceOpening: 38,
  calculationVersion: "synthetic-clinic-rank-v1",
} as const;

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function demoQuestionId(question: string): keyof typeof DEMO_QUESTIONS | null {
  const target = normalized(question);
  for (const [id, value] of Object.entries(DEMO_QUESTIONS)) {
    if (normalized(value) === target) return id as keyof typeof DEMO_QUESTIONS;
  }
  return null;
}

export function planConfiguredDemoQuestion(question: string): EvaluationPlan | null {
  const questionId = demoQuestionId(question);
  if (questionId !== "clinicPerformance") return null;

  const base = compileEvaluationPlan(question, inferPlanningIntent(question), "deterministic_fallback", "cvc");
  const configuredPlan = evaluationPlanSchema.parse({
    ...base,
    planId: "plan-demo-clinic-performance-synthetic",
    intent: {
      ...base.intent,
      clarificationRequired: false,
      clarificationReason: "none",
      conciseInterpretation: "Use the explicitly synthetic Synthetic South Clinic fixture and its three-clinic peer group only after the reviewer confirms that demo selection.",
    },
    geographyResolution: {
      mode: "national",
      places: [],
      selectedCbsaCodes: [],
      message: "This configured demonstration uses a synthetic clinic portfolio, not a silently inferred real market or clinic.",
    },
    status: "partially_executable",
    missingEvidence: ["Approved production clinic-performance comparison"],
    missingApprovals: ["Synthetic demo selection confirmation", "Production clinic outcome definition approval", "Production peer-group approval"],
    evidenceBoundary: "The configured demo may calculate an illustrative rank only from the checked-in synthetic clinic fixture after reviewer confirmation. It must remain labeled Hypothesis and cannot be used as a production clinic judgment.",
    steps: [
      { id: "interpret", label: "Interpret the question", detail: "Offer the explicitly synthetic clinic-performance scenario and require confirmation before execution.", result: "Synthetic South Clinic proposed, not silently selected" },
      { id: "confirm-synthetic-selection", label: "Confirm synthetic demo selection", detail: "Confirm Synthetic South Clinic, the three synthetic peers, completed appointments, and the shared 38-week maturity point.", result: "Reviewer confirmation required" },
      { id: "calculate-rank", label: "Calculate illustrative rank", detail: "Sort the compatible fixture rows deterministically without AI scoring.", result: "Illustrative rank only" },
      { id: "surface-reliability", label: "Surface reliability limits", detail: "Keep production outcome and peer-group approvals visible.", result: "Hypothesis-labeled review packet" },
    ],
    actions: [{
      ...base.actions[0],
      id: "review-synthetic-clinic-comparison",
      title: "Confirm and review the synthetic clinic comparison",
      summary: "Confirm the Synthetic South demo selection, then use the synthetic result to review the workflow and define the approvals needed for a real clinic comparison.",
      nextStep: "Confirm this synthetic scenario, then define a real outcome, maturity rule, and peer group before replacing the illustrative ranking.",
      requiresApproval: true,
    }],
    findings: [
      { id: "interpreted-question", kind: "interpretation", title: "Synthetic scenario awaiting confirmation", detail: "The proposed demo clinic is Synthetic South Clinic; it is not production evidence and must be confirmed before execution." },
      { id: "geography-resolution", kind: "geography", title: "Synthetic portfolio cohort", detail: "The comparison uses three synthetic clinics rather than a geographic market." },
      { id: "capability-route", kind: "capability", title: "Clinic-performance capability", detail: "The route uses the checked-in aggregate synthetic fixture." },
      { id: "execution-status", kind: "execution", title: "Illustrative calculation available after confirmation", detail: "A deterministic rank may run only in synthetic demo mode after the reviewer confirms the selection." },
      { id: "evidence-boundary", kind: "evidence", title: "Required comparison fields unavailable", detail: "Aggregate clinic evidence may be shown, but the supplied files do not contain completed appointments by clinic at the configured 38-week maturity point." },
    ],
  });
  return evaluationPlanSchema.parse({
    ...configuredPlan,
    answerContract: buildAnswerContract(configuredPlan),
  });
}
