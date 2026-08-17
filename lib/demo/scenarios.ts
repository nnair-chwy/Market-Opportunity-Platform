import { evaluationPlanSchema, type EvaluationPlan, type PlanningIntent } from "../planning/contracts.ts";
import { compileEvaluationPlan, inferPlanningIntent } from "../planning/planner.ts";

export const DEMO_SNAPSHOT_VERSION = "clinic-market-demo-2026-08-17-v1" as const;

export const DEMO_QUESTIONS = {
  marketContext: "What is this market, what public or descriptive evidence exists, and what remains unknown?",
  clinicPerformance: "How is this clinic performing relative to an approved peer group, and how reliable is that comparison?",
  growthTest: "Is there a measurable regional opportunity, and what evidence and guardrails are required before testing it?",
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

function phoenixGeography(): EvaluationPlan["geographyResolution"] {
  return {
    mode: "single",
    places: [{
      requestedName: "Configured demo market",
      status: "resolved",
      cbsaCode: PHOENIX_DEMO_MARKET.cbsaCode,
      cbsaName: PHOENIX_DEMO_MARKET.cbsaName,
      candidates: [{ cbsaCode: PHOENIX_DEMO_MARKET.cbsaCode, cbsaName: PHOENIX_DEMO_MARKET.cbsaName }],
    }],
    selectedCbsaCodes: [PHOENIX_DEMO_MARKET.cbsaCode],
    message: `The approved local demo scenario resolves “this market” to ${PHOENIX_DEMO_MARKET.cbsaName} (CBSA ${PHOENIX_DEMO_MARKET.cbsaCode}).`,
  };
}

function localGrowthIntent(question: string): PlanningIntent {
  return {
    ...inferPlanningIntent(question),
    topic: "local_growth",
    geographyGrain: "cbsa",
    requestedAction: "investigate",
    requestedMeasure: "none",
    clarificationRequired: false,
    clarificationReason: "none",
    conciseInterpretation: `Assess a bounded regional growth-test question for ${PHOENIX_DEMO_MARKET.cbsaName} using the approved local demo scenario.`,
  };
}

export function planConfiguredDemoQuestion(question: string): EvaluationPlan | null {
  const questionId = demoQuestionId(question);
  if (!questionId) return null;

  const base = questionId === "growthTest"
    ? compileEvaluationPlan(question, localGrowthIntent(question), "deterministic_fallback", "marketing")
    : compileEvaluationPlan(question, inferPlanningIntent(question), "deterministic_fallback", questionId === "clinicPerformance" ? "cvc" : "marketing");

  if (questionId === "marketContext") {
    return evaluationPlanSchema.parse({
      ...base,
      planId: "plan-demo-market-context-phoenix",
      intent: {
        ...base.intent,
        conciseInterpretation: `Describe ${PHOENIX_DEMO_MARKET.cbsaName} using approved frozen customer aggregates and compatible public Census context.`,
      },
      geographyResolution: phoenixGeography(),
      status: "executable",
      evidenceBoundary: "The configured demo combines public Census context with approved aggregate frozen-snapshot observations for Phoenix. It does not score opportunity or authorize action.",
      steps: [
        { id: "interpret", label: "Interpret the question", detail: "Resolve the approved starter question to the configured Phoenix market-context scenario.", result: "Phoenix market context" },
        { id: "resolve-geography", label: "Resolve exact geography", detail: "Use the configured exact geography key cbsa:38060 without fuzzy matching.", result: "Phoenix-Mesa-Chandler, AZ" },
        { id: "query-evidence", label: "Query registered evidence", detail: "Read the frozen canonical Parquet observations and compatible public Census snapshot.", result: "Descriptive evidence bundle" },
        { id: "surface-gaps", label: "Surface evidence gaps", detail: "Preserve unavailable pricing and competitor evidence and unregistered regional SEO as missing evidence.", result: "Review packet with unknowns" },
      ],
      actions: [{
        ...base.actions[0],
        id: "review-phoenix-market-context",
        title: "Review Phoenix market context",
        summary: "Review source-backed Phoenix descriptive evidence alongside the missing market evidence that could change interpretation.",
        nextStep: "Decide which missing demand, competitive, pricing, or local search evidence is required before framing an opportunity claim.",
      }],
      findings: [
        { id: "interpreted-question", kind: "interpretation", title: "Configured market question", detail: "The approved demo question resolves to Phoenix-Mesa-Chandler, AZ." },
        { id: "geography-resolution", kind: "geography", title: "Exact CBSA geography", detail: "The registered geography key is cbsa:38060." },
        { id: "capability-route", kind: "capability", title: "Market-context capability", detail: "The route combines canonical aggregate observations with compatible public Census context." },
        { id: "execution-status", kind: "execution", title: "Registered local execution", detail: "DuckDB executes static queries against the validated frozen snapshot." },
        { id: "evidence-boundary", kind: "evidence", title: "Descriptive evidence only", detail: "The bundle does not produce an opportunity score or recommendation." },
      ],
    });
  }

  if (questionId === "clinicPerformance") {
    return evaluationPlanSchema.parse({
      ...base,
      planId: "plan-demo-clinic-performance-synthetic",
      status: "partially_executable",
      missingEvidence: ["Approved production clinic-performance comparison"],
      missingApprovals: ["Production clinic outcome definition approval", "Production peer-group approval"],
      evidenceBoundary: "The configured demo may calculate an illustrative rank only from the checked-in synthetic clinic fixture. It must remain labeled Hypothesis and cannot be used as a production clinic judgment.",
      steps: [
        { id: "interpret", label: "Interpret the question", detail: "Resolve the approved clinic-performance starter question to the synthetic comparison scenario.", result: "Synthetic South Clinic selected" },
        { id: "configure-comparison", label: "Configure peer comparison", detail: "Use all three synthetic clinics, completed appointments, and the shared 38-week maturity point.", result: "Three-clinic synthetic cohort" },
        { id: "calculate-rank", label: "Calculate illustrative rank", detail: "Sort the compatible fixture rows deterministically without AI scoring.", result: "Illustrative rank only" },
        { id: "surface-reliability", label: "Surface reliability limits", detail: "Keep production outcome and peer-group approvals visible.", result: "Hypothesis-labeled review packet" },
      ],
      actions: [{
        ...base.actions[0],
        id: "review-synthetic-clinic-comparison",
        title: "Review the synthetic clinic comparison",
        summary: "Use the synthetic result to review the workflow and define the approvals needed for a real clinic comparison.",
        nextStep: "Assign owners to approve the production outcome definition, maturity rule, peer group, and browser-safe aggregate before using real clinic data.",
      }],
      findings: [
        { id: "interpreted-question", kind: "interpretation", title: "Configured clinic question", detail: "The selected demo clinic is Synthetic South Clinic." },
        { id: "geography-resolution", kind: "geography", title: "Synthetic portfolio cohort", detail: "The comparison uses three synthetic clinics rather than a geographic market." },
        { id: "capability-route", kind: "capability", title: "Clinic-performance capability", detail: "The route uses the checked-in aggregate synthetic fixture." },
        { id: "execution-status", kind: "execution", title: "Illustrative calculation available", detail: "A deterministic rank may run only in synthetic demo mode." },
        { id: "evidence-boundary", kind: "evidence", title: "Production comparison unavailable", detail: "Real clinic evidence remains blocked from the browser and requires approved definitions." },
      ],
    });
  }

  return evaluationPlanSchema.parse({
    ...base,
    planId: "plan-demo-growth-test-phoenix",
    geographyResolution: phoenixGeography(),
    status: "partially_executable",
    missingEvidence: [
      "Approved regional Google Ads geography bridge",
      "Pre-period outcome and contamination assessment",
      "Approved test and control design",
    ],
    missingApprovals: ["Growth-test design approval", "Measurement and launch approval"],
    evidenceBoundary: "The configured demo may assemble Phoenix descriptive signals and unmatched Google Ads context. It cannot claim campaign causality, join Ads labels to CBSA 38060, or authorize a launch.",
    steps: [
      { id: "interpret", label: "Interpret the question", detail: "Resolve the approved growth-test starter question to the configured Phoenix scenario.", result: "Phoenix regional opportunity question" },
      { id: "resolve-geography", label: "Resolve exact geography", detail: "Use cbsa:38060 for canonical market evidence only.", result: "Phoenix-Mesa-Chandler, AZ" },
      { id: "query-signals", label: "Query descriptive signals", detail: "Read Phoenix regional customer observations and the separate Google Ads matched-location inventory.", result: "Unjoined descriptive evidence" },
      { id: "define-guardrails", label: "Define test gates", detail: "Preserve measurement, control, contamination, privacy, budget, and launch approvals as open gates.", result: "Pre-launch review packet" },
    ],
    actions: [{
      ...base.actions[0],
      id: "design-bounded-growth-test",
      title: "Define a bounded Phoenix growth test",
      summary: "Use the regional signals to frame a testable hypothesis while keeping unmatched advertising evidence separate.",
      nextStep: "Approve the outcome, pre-period, control, exposure, contamination, budget, privacy, stop conditions, and exact Google Ads geography bridge before launch.",
    }],
    findings: [
      { id: "interpreted-question", kind: "interpretation", title: "Configured growth question", detail: "The approved demo question resolves to Phoenix-Mesa-Chandler, AZ." },
      { id: "geography-resolution", kind: "geography", title: "Exact CBSA for market signals", detail: "Canonical regional evidence uses cbsa:38060; Google Ads labels remain unjoined." },
      { id: "capability-route", kind: "capability", title: "Growth-test capability", detail: "The route assembles descriptive signals and test-readiness gates without changing the planned production capability status." },
      { id: "execution-status", kind: "execution", title: "Frozen demo execution", detail: "Registered queries may run, but launch remains blocked by missing design and approval inputs." },
      { id: "evidence-boundary", kind: "evidence", title: "No causal or ranking claim", detail: "The bundle does not join Google Ads labels to Phoenix, rank regions, or authorize spend." },
    ],
  });
}
