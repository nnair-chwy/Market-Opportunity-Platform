import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  AGENT_MAX_STEPS,
  AGENT_MODEL,
  AGENT_PROMPT_VERSION,
  AGENT_RUN_SCHEMA_VERSION,
  AGENT_TOOL_CONTRACT_VERSION,
  agentModelActionSchema,
  agentRunSchema,
  continueAgentRunRequestSchema,
  type AgentModelAction,
  type AgentRun,
  type AgentStep,
  type AgentToolName,
  type ToolInvocation,
} from "./contracts.ts";
import { esriSiteIdentities, esriTradeAreaProfiles } from "../esri-demo/index.ts";
import {
  assertToolPermitted,
  permittedToolsForRun,
  transitionAgentRun,
} from "./policy.ts";
import { executeAgentTool, type DeterministicEvaluationInput } from "./tools.ts";
import { getAgentRun, saveAgentRun } from "./run-store.ts";

const AGENT_SYSTEM_INSTRUCTIONS = `You coordinate a bounded candidate-review workflow.

You may select only one tool from permittedTools. The application, not you, supplies tool arguments and decides whether execution is allowed.
Do not invent evidence, source IDs, values, approvals, calculations, weights, thresholds, or workflow states.
Do not recommend a site, lease, opening, ranking, or final decision.
Do not expose hidden reasoning. Return only a concise action explanation.
Choose finish only when permittedTools is empty.`;

export type AgentModelCaller = (input: {
  run: AgentRun;
  permittedTools: AgentToolName[];
}) => Promise<AgentModelAction>;

async function callOpenAi(input: {
  run: AgentRun;
  permittedTools: AgentToolName[];
}): Promise<AgentModelAction> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 20_000,
  });
  const response = await client.responses.parse({
    model: AGENT_MODEL,
    reasoning: { effort: "low" },
    store: false,
    input: [
      { role: "developer", content: AGENT_SYSTEM_INSTRUCTIONS },
      {
        role: "user",
        content: JSON.stringify({
          task: "Select the next permitted candidate-review tool.",
          run: {
            runId: input.run.runId,
            siteId: input.run.siteId,
            status: input.run.status,
            completedTools: input.run.toolInvocations
              .filter((item) => item.status === "completed")
              .map((item) => item.toolName),
            blockerCount: input.run.unresolvedBlockers.length,
            reviewerResponses: input.run.reviewerResponses.map((item) => ({
              decisionId: item.decisionId,
              decision: item.decision,
            })),
          },
          permittedTools: input.permittedTools,
        }),
      },
    ],
    text: {
      format: zodTextFormat(agentModelActionSchema, "candidate_review_next_action"),
    },
  });
  if (!response.output_parsed) {
    throw new Error("OpenAI returned no structured agent action.");
  }
  return agentModelActionSchema.parse(response.output_parsed);
}

function plannedSteps(): AgentStep[] {
  return [
    ["inspect", "Inspect candidate readiness"],
    ["collect", "Load approved candidate and market evidence"],
    ["validate", "Validate evidence and identify ambiguity"],
    ["review", "Request analyst confirmation when required"],
    ["request", "Prepare unresolved evidence requests"],
    ["prerequisites", "Check deterministic evaluation prerequisites"],
    ["packet", "Assemble the draft review packet"],
  ].map(([stepId, label], index) => ({
    stepId,
    label,
    status: index === 0 ? "active" : "pending",
  }));
}

function nowIso() {
  return new Date().toISOString();
}

function setStep(run: AgentRun, stepId: string, status: AgentStep["status"]) {
  const step = run.plannedSteps.find((item) => item.stepId === stepId);
  if (step) step.status = status;
}

const TOOL_STEP: Record<AgentToolName, string> = {
  get_candidate_readiness: "inspect",
  get_candidate_evidence: "collect",
  get_market_context: "collect",
  validate_candidate_evidence: "validate",
  compare_candidate_evidence: "collect",
  prepare_evidence_request: "request",
  check_evaluation_prerequisites: "prerequisites",
  run_deterministic_evaluation: "prerequisites",
  draft_review_brief: "packet",
};

function updatePlanAfterTool(run: AgentRun, toolName: AgentToolName) {
  const stepId = TOOL_STEP[toolName];
  if (toolName === "get_candidate_evidence" || toolName === "get_market_context") {
    const completed = new Set(
      run.toolInvocations
        .filter((item) => item.status === "completed")
        .map((item) => item.toolName),
    );
    if (completed.has("get_candidate_evidence") && completed.has("get_market_context")) {
      setStep(run, "collect", "completed");
    }
  } else {
    setStep(run, stepId, "completed");
  }
  if (!run.completedSteps.includes(stepId) && run.plannedSteps.find((item) => item.stepId === stepId)?.status === "completed") {
    run.completedSteps.push(stepId);
  }
  const next = run.plannedSteps.find((item) => item.status === "pending");
  if (next) {
    next.status = "active";
    run.currentStep = next.label;
  }
}

function createRun(siteId: string, now: string): AgentRun {
  const site = esriSiteIdentities.find((item) => item.site_id === siteId);
  if (!site) throw new Error("The requested candidate is not in the approved fixture.");
  const runId = `candidate-review-${crypto.randomUUID()}`;
  return agentRunSchema.parse({
    schemaVersion: AGENT_RUN_SCHEMA_VERSION,
    runId,
    siteId,
    siteLabel: site.site_name,
    status: "planned",
    currentStep: "Inspect candidate readiness",
    plannedSteps: plannedSteps(),
    completedSteps: [],
    toolInvocations: [],
    evidenceReceipts: [],
    unresolvedBlockers: [],
    requestedHumanDecisions: [],
    reviewerResponses: [],
    sourceSnapshotVersions: [],
    modelVersion: AGENT_MODEL,
    promptVersion: AGENT_PROMPT_VERSION,
    toolContractVersion: AGENT_TOOL_CONTRACT_VERSION,
    generatedArtifactId: null,
    artifact: null,
    evaluationStatus: "not_checked",
    evaluationResultVersion: null,
    maxSteps: AGENT_MAX_STEPS,
    stepCount: 0,
    createdAt: now,
    updatedAt: now,
    persistence: "process_local_prototype",
  });
}

function applyToolResult(
  run: AgentRun,
  toolName: AgentToolName,
  result: ReturnType<typeof executeAgentTool>,
) {
  if (result.receipt) {
    run.evidenceReceipts.push(result.receipt);
    run.sourceSnapshotVersions = [
      ...new Set([...run.sourceSnapshotVersions, ...result.receipt.snapshotVersions]),
    ];
  }
  if (result.blockers.length) {
    run.unresolvedBlockers = result.blockers;
  }
  if (result.humanDecision) {
    run.requestedHumanDecisions.push(result.humanDecision);
    setStep(run, "review", "waiting");
  }
  if (toolName === "check_evaluation_prerequisites") {
    run.evaluationStatus = result.blockers.length ? "blocked" : "ready";
  }
  if (toolName === "run_deterministic_evaluation") {
    run.evaluationStatus = "completed";
    run.evaluationResultVersion = result.receipt?.snapshotVersions[0] ?? null;
  }
  if (result.artifact) {
    run.artifact = result.artifact;
    run.generatedArtifactId = result.artifact.artifactId;
  }
}

export async function advanceAgentRun(
  initialRun: AgentRun,
  options: {
    callModel?: AgentModelCaller;
    deterministicEvaluation?: DeterministicEvaluationInput;
    now?: () => string;
  } = {},
) {
  const run = structuredClone(initialRun);
  const callModel = options.callModel ?? callOpenAi;
  const now = options.now ?? nowIso;
  if (run.status === "planned") transitionAgentRun(run, "collecting");

  try {
    while (true) {
      if (run.status === "waiting_for_review" || ["completed", "blocked", "failed"].includes(run.status)) {
        break;
      }
      if (run.stepCount >= run.maxSteps) {
        throw new Error("Candidate review reached the maximum permitted step count.");
      }
      const permittedTools = permittedToolsForRun(run);
      if (!permittedTools.length) break;
      const action = agentModelActionSchema.parse(await callModel({ run, permittedTools }));
      if (action.action !== "call_tool" || !action.toolName) {
        throw new Error("The agent attempted to finish before the bounded workflow was complete.");
      }
      assertToolPermitted(run, action.toolName);
      const startedAt = now();
      const invocation: ToolInvocation = {
        invocationId: `${run.runId}-tool-${run.stepCount + 1}`,
        toolName: action.toolName,
        status: "started",
        summary: action.explanation,
        sourceIds: [],
        startedAt,
        completedAt: null,
      };
      run.toolInvocations.push(invocation);
      run.stepCount += 1;
      if (["validate_candidate_evidence", "prepare_evidence_request", "check_evaluation_prerequisites"].includes(action.toolName)) {
        if (run.status === "collecting") transitionAgentRun(run, "validating");
      }
      const result = executeAgentTool(run, action.toolName, {
        now,
        deterministicEvaluation: options.deterministicEvaluation,
      });
      invocation.status = "completed";
      invocation.summary = result.summary;
      invocation.sourceIds = result.sourceIds;
      invocation.completedAt = now();
      applyToolResult(run, action.toolName, result);
      updatePlanAfterTool(run, action.toolName);
      run.updatedAt = now();

      if (result.humanDecision) {
        transitionAgentRun(run, "waiting_for_review");
        run.currentStep = "Waiting for analyst confirmation";
        break;
      }
      if (action.toolName === "check_evaluation_prerequisites" && !result.blockers.length) {
        transitionAgentRun(run, "ready_for_evaluation");
      }
      if (action.toolName === "draft_review_brief") {
        transitionAgentRun(run, run.unresolvedBlockers.length ? "blocked" : "completed");
        run.currentStep = run.unresolvedBlockers.length
          ? "Draft packet prepared with unresolved blockers"
          : "Draft packet prepared for human review";
        break;
      }
    }
  } catch {
    if (!["completed", "blocked", "failed"].includes(run.status)) {
      transitionAgentRun(run, "failed");
    }
    setStep(run, run.plannedSteps.find((item) => item.status === "active")?.stepId ?? "packet", "blocked");
    run.currentStep = "The review run stopped safely";
    run.unresolvedBlockers.push({
      blockerId: `${run.runId}-controlled-error`,
      label: "Agent run could not continue",
      detail: "The bounded agent could not produce a supported next action.",
      sourceIds: [],
      resolution: "Verify server-side model access and retry the review run.",
    });
    run.updatedAt = now();
  }
  return saveAgentRun(agentRunSchema.parse(run));
}

export async function startAgentRun(
  siteId: string,
  options: Parameters<typeof advanceAgentRun>[1] = {},
) {
  const now = options.now ?? nowIso;
  const run = createRun(siteId, now());
  saveAgentRun(run);
  return advanceAgentRun(run, options);
}

export async function continueAgentRun(
  runId: string,
  input: unknown,
  options: Parameters<typeof advanceAgentRun>[1] = {},
) {
  const run = getAgentRun(runId);
  if (!run) throw new Error("Candidate review run was not found in this process.");
  if (run.status !== "waiting_for_review") {
    throw new Error("Candidate review run is not waiting for analyst review.");
  }
  const response = continueAgentRunRequestSchema.parse(input);
  const request = run.requestedHumanDecisions.find(
    (item) => item.decisionId === response.decisionId && item.status === "pending",
  );
  if (!request) throw new Error("The requested analyst decision is not pending.");
  const profile = esriTradeAreaProfiles.find((item) => item.site_id === run.siteId);
  const selected = response.selectedTradeAreaId ?? null;
  if (response.decision === "confirm") {
    if (!selected || !profile?.variants.some((item) => item.trade_area_id === selected)) {
      throw new Error("Confirming requires one of the supplied trade-area variants.");
    }
  } else if (selected) {
    throw new Error("Reject and leave unresolved cannot select a trade-area variant.");
  }
  const now = options.now ?? nowIso;
  request.status = "answered";
  run.reviewerResponses.push({
    decisionId: response.decisionId,
    decision: response.decision,
    selectedTradeAreaId: selected,
    note: response.note ?? null,
    respondedAt: now(),
  });
  setStep(run, "review", "completed");
  if (!run.completedSteps.includes("review")) run.completedSteps.push("review");
  transitionAgentRun(run, "validating");
  run.currentStep = "Incorporating analyst review";
  run.updatedAt = now();
  saveAgentRun(run);
  return advanceAgentRun(run, { ...options, now });
}
