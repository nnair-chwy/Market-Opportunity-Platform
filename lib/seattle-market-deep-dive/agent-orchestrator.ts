import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  SEATTLE_AGENT_MAX_STEPS, SEATTLE_AGENT_MODEL, SEATTLE_AGENT_PROMPT_VERSION,
  SEATTLE_AGENT_RUN_VERSION, SEATTLE_AGENT_TOOL_VERSION, seattleAgentActionSchema,
  seattleAgentRunSchema, type SeattleAgentAction, type SeattleAgentRun, type SeattleAgentTool,
  type SegmentationDecision,
} from "./agent-contracts.ts";
import { assertSeattleToolPermitted, permittedSeattleTools } from "./agent-policy.ts";
import { getSeattleAgentRun, saveSeattleAgentRun } from "./agent-store.ts";
import { seattleDeepDiveManifest, seattleDemoBrokers, seattleSubmarkets } from "./data.ts";
import { compareSeattleSubmarkets } from "./scoring.ts";

const SYSTEM_INSTRUCTIONS = `Coordinate one bounded Seattle market deep-dive demo.
Choose exactly one tool from permittedTools. The application supplies all arguments and validates execution.
Never invent evidence, geography, people, firms, values, approvals, weights, or source IDs.
Never call a comparison before the analyst confirms the proposed demo segmentation.
Never describe a submarket as best or make a market-entry, broker-selection, property, or lease decision.
Return only the next structured action.`;

export type SeattleAgentModelCaller = (input: { run: SeattleAgentRun; permittedTools: SeattleAgentTool[] }) => Promise<SeattleAgentAction>;

async function callOpenAi(input: { run: SeattleAgentRun; permittedTools: SeattleAgentTool[] }) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1, timeout: 20_000 });
  const response = await client.responses.parse({
    model: SEATTLE_AGENT_MODEL, reasoning: { effort: "low" }, store: false,
    input: [
      { role: "developer", content: SYSTEM_INSTRUCTIONS },
      { role: "user", content: JSON.stringify({
        task: "Select the next permitted Seattle demo tool.",
        run: { status: input.run.status, completedTools: input.run.toolInvocations.filter((item) => item.status === "completed").map((item) => item.toolName) },
        permittedTools: input.permittedTools,
      }) },
    ],
    text: { format: zodTextFormat(seattleAgentActionSchema, "seattle_market_deep_dive_next_action") },
  });
  if (!response.output_parsed) throw new Error("OpenAI returned no structured Seattle agent action.");
  return seattleAgentActionSchema.parse(response.output_parsed);
}

const TOOL_STEP: Record<SeattleAgentTool, string> = {
  get_seattle_market_context: "market", get_proposed_submarkets: "segmentation",
  validate_submarket_evidence: "validation", compare_submarkets: "comparison",
  get_demo_broker_directory: "brokers", check_market_deep_dive_prerequisites: "prerequisites",
  draft_market_deep_dive: "packet",
};

function nowIso() { return new Date().toISOString(); }
function plannedSteps() {
  return [
    ["market", "Load bounded Seattle market context"], ["segmentation", "Review proposed demo submarkets"],
    ["validation", "Validate synthetic evidence"], ["comparison", "Compare confirmed demo submarkets"],
    ["brokers", "Load fictional broker research leads"], ["prerequisites", "Check packet prerequisites"],
    ["packet", "Draft the market deep-dive packet"],
  ].map(([stepId, label], index) => ({ stepId, label, status: index === 0 ? "active" as const : "pending" as const }));
}

function createRun(now: string): SeattleAgentRun {
  return seattleAgentRunSchema.parse({
    schemaVersion: SEATTLE_AGENT_RUN_VERSION, runId: `seattle-deep-dive-${crypto.randomUUID()}`,
    cbsaCode: "42660", marketName: "Seattle-Tacoma-Bellevue, WA", status: "planned",
    currentStep: "Load bounded Seattle market context", plannedSteps: plannedSteps(), toolInvocations: [],
    evidenceReceipts: [], requestedHumanDecisions: [], reviewerResponses: [], blockers: [], artifact: null,
    comparisonReady: false, brokerDirectoryReady: false, maxSteps: SEATTLE_AGENT_MAX_STEPS, stepCount: 0,
    modelVersion: SEATTLE_AGENT_MODEL, promptVersion: SEATTLE_AGENT_PROMPT_VERSION, toolContractVersion: SEATTLE_AGENT_TOOL_VERSION,
    createdAt: now, updatedAt: now, persistence: "process_local_prototype",
  });
}

function completeStep(run: SeattleAgentRun, tool: SeattleAgentTool) {
  const step = run.plannedSteps.find((item) => item.stepId === TOOL_STEP[tool]);
  if (step) step.status = "completed";
  const next = run.plannedSteps.find((item) => item.status === "pending");
  if (next) { next.status = "active"; run.currentStep = next.label; }
}

function receipt(run: SeattleAgentRun, label: string, sourceIds: string[], statuses: Array<"Confirmed" | "Derived" | "Hypothesis">, allowedUse: string, scoring: "none" | "synthetic_prototype_only", snapshots: string[], now: string) {
  run.evidenceReceipts.push({ receiptId: `${run.runId}-receipt-${run.evidenceReceipts.length + 1}`, label, sourceIds,
    evidenceStatuses: statuses, allowedUse, scoringEligibility: scoring, snapshotVersions: snapshots, recordedAt: now });
}

function executeTool(run: SeattleAgentRun, tool: SeattleAgentTool, now: string) {
  if (tool === "get_seattle_market_context") {
    receipt(run, "Seattle public market context", ["SRC-014", "SRC-015", "SRC-016"], ["Confirmed", "Derived"], "market_context_only", "none", ["cbsa-universe-2023-07", "cbsa-geometry-2024", "cbsa-acs-2024"], now);
    return { summary: "Loaded Seattle CBSA public context as non-scored market context.", sourceIds: ["SRC-014", "SRC-015", "SRC-016"] };
  }
  if (tool === "get_proposed_submarkets") {
    receipt(run, "Proposed Seattle demo segmentation", [seattleDeepDiveManifest.submarket_source_id], ["Hypothesis"], "synthetic_prototype_only", "none", [seattleDeepDiveManifest.fixture_version], now);
    run.requestedHumanDecisions.push({ decisionId: `${run.runId}-segmentation-review`, question: "Use these seven illustrative areas as comparison units for this process-local demo?",
      reason: "The overlapping areas use approximate public city-center hubs and are synthetic hypotheses, not approved boundaries. Analyst confirmation is required before comparison.",
      options: ["confirm", "reject", "leave_unresolved"], status: "pending" });
    run.status = "waiting_for_segmentation_review";
    const step = run.plannedSteps.find((item) => item.stepId === "segmentation"); if (step) step.status = "waiting";
    return { summary: `Loaded ${seattleSubmarkets.length} proposed illustrative demo areas and paused for analyst confirmation.`, sourceIds: [seattleDeepDiveManifest.submarket_source_id] };
  }
  if (tool === "validate_submarket_evidence") {
    receipt(run, "Synthetic submarket evidence validation", [seattleDeepDiveManifest.submarket_source_id], ["Derived", "Hypothesis"], "synthetic_prototype_only", "synthetic_prototype_only", [seattleDeepDiveManifest.fixture_version], now);
    return { summary: "Validated fixture shape, evidence status, missingness, metric bounds, and allowed use.", sourceIds: [seattleDeepDiveManifest.submarket_source_id] };
  }
  if (tool === "compare_submarkets") {
    const comparison = compareSeattleSubmarkets(seattleSubmarkets);
    run.comparisonReady = true;
    receipt(run, "Deterministic Seattle submarket comparison", [seattleDeepDiveManifest.submarket_source_id], ["Derived", "Hypothesis"], "synthetic_prototype_only", "synthetic_prototype_only", [comparison.calculationVersion], now);
    return { summary: `Compared ${comparison.scores.length} confirmed demo submarkets and identified three priorities under demo criteria.`, sourceIds: [seattleDeepDiveManifest.submarket_source_id] };
  }
  if (tool === "get_demo_broker_directory") {
    run.brokerDirectoryReady = true;
    receipt(run, "Fictional broker research leads", [seattleDeepDiveManifest.broker_source_id], ["Hypothesis"], "synthetic_prototype_only", "none", [seattleDeepDiveManifest.fixture_version], now);
    return { summary: `Loaded ${seattleDemoBrokers.length} fictional, unverified broker profiles for workflow demonstration only.`, sourceIds: [seattleDeepDiveManifest.broker_source_id] };
  }
  if (tool === "check_market_deep_dive_prerequisites") {
    if (!run.comparisonReady || !run.brokerDirectoryReady) run.blockers = ["Required demo outputs are incomplete."];
    return { summary: run.blockers.length ? "The packet has unresolved prerequisites." : "Confirmed that required synthetic demo outputs are present.", sourceIds: [seattleDeepDiveManifest.submarket_source_id, seattleDeepDiveManifest.broker_source_id] };
  }
  const comparison = compareSeattleSubmarkets(seattleSubmarkets);
  run.artifact = {
    artifactId: `${run.runId}-packet`, title: "Seattle market deep-dive demo packet",
    status: run.blockers.length ? "draft_blocked" : "draft_for_review",
    summary: "A bounded synthetic comparison with illustrative submarket areas and fictional broker research leads. It is not a market-entry or real-estate recommendation.",
    prioritySubmarketIds: comparison.prioritySubmarketIds, remainingItems: [
      "Approve a production submarket definition and boundary method.", "Confirm governed data availability and scoring weights.",
      "License and verify real broker data before outreach.",
    ], sourceIds: ["SRC-014", "SRC-015", "SRC-016", seattleDeepDiveManifest.submarket_source_id, seattleDeepDiveManifest.broker_source_id], generatedAt: now,
  };
  return { summary: "Prepared a draft Seattle deep-dive packet for human review.", sourceIds: run.artifact.sourceIds };
}

export async function advanceSeattleAgentRun(initial: SeattleAgentRun, options: { callModel?: SeattleAgentModelCaller; now?: () => string } = {}) {
  const run = structuredClone(initial); const now = options.now ?? nowIso; const callModel = options.callModel ?? callOpenAi;
  if (run.status === "planned") run.status = "collecting";
  try {
    while (!["completed", "blocked", "failed", "waiting_for_segmentation_review"].includes(run.status)) {
      if (run.stepCount >= run.maxSteps) throw new Error("Seattle deep dive reached its maximum tool count.");
      const permittedTools = permittedSeattleTools(run); if (!permittedTools.length) break;
      const action = seattleAgentActionSchema.parse(await callModel({ run, permittedTools }));
      assertSeattleToolPermitted(run, action.toolName);
      const startedAt = now(); const invocation: SeattleAgentRun["toolInvocations"][number] = { invocationId: `${run.runId}-tool-${run.stepCount + 1}`, toolName: action.toolName,
        status: "started", summary: action.explanation, sourceIds: [], startedAt, completedAt: null };
      run.toolInvocations.push(invocation); run.stepCount += 1;
      if (action.toolName === "validate_submarket_evidence") run.status = "validating";
      if (action.toolName === "compare_submarkets") run.status = "comparing";
      if (action.toolName === "get_demo_broker_directory") run.status = "preparing_broker_research";
      if (action.toolName === "draft_market_deep_dive") run.status = "drafting";
      const result = executeTool(run, action.toolName, now()); invocation.status = "completed"; invocation.summary = result.summary;
      invocation.sourceIds = result.sourceIds; invocation.completedAt = now();
      if (action.toolName !== "get_proposed_submarkets") completeStep(run, action.toolName);
      run.updatedAt = now();
      if (action.toolName === "get_proposed_submarkets") break;
      if (action.toolName === "draft_market_deep_dive") { run.status = run.blockers.length ? "blocked" : "completed"; run.currentStep = "Draft packet prepared for human review"; break; }
    }
  } catch (error) { run.status = "failed"; run.currentStep = "Run failed safely"; run.blockers = [error instanceof Error ? error.message : "Unexpected Seattle agent failure."]; run.updatedAt = now(); }
  return saveSeattleAgentRun(run);
}

export async function startSeattleAgentRun(options: { callModel?: SeattleAgentModelCaller; now?: () => string } = {}) {
  const now = options.now ?? nowIso; return advanceSeattleAgentRun(saveSeattleAgentRun(createRun(now())), options);
}

export async function continueSeattleAgentRun(runId: string, input: { decisionId: string; decision: SegmentationDecision; note?: string | null }, options: { callModel?: SeattleAgentModelCaller; now?: () => string } = {}) {
  const run = getSeattleAgentRun(runId); if (!run) throw new Error("Seattle market deep-dive run not found.");
  if (run.status !== "waiting_for_segmentation_review") throw new Error("Seattle run is not waiting for segmentation review.");
  const request = run.requestedHumanDecisions.find((item) => item.decisionId === input.decisionId && item.status === "pending");
  if (!request) throw new Error("Segmentation decision is not pending.");
  const now = options.now ?? nowIso; request.status = "answered";
  run.reviewerResponses.push({ decisionId: request.decisionId, decision: input.decision, note: input.note ?? null, respondedAt: now() });
  const step = run.plannedSteps.find((item) => item.stepId === "segmentation");
  if (input.decision !== "confirm") {
    if (step) step.status = "blocked"; run.status = "blocked";
    run.blockers = [input.decision === "reject" ? "The analyst rejected the proposed demo segmentation." : "The proposed demo segmentation remains unresolved."];
    run.currentStep = run.blockers[0]; run.updatedAt = now(); return saveSeattleAgentRun(run);
  }
  if (step) step.status = "completed"; const next = run.plannedSteps.find((item) => item.stepId === "validation"); if (next) next.status = "active";
  run.status = "validating"; run.currentStep = "Validate synthetic evidence"; run.updatedAt = now(); saveSeattleAgentRun(run);
  return advanceSeattleAgentRun(run, options);
}
