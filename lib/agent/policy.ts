import {
  AGENT_MAX_STEPS,
  TERMINAL_RUN_STATUSES,
  type AgentRun,
  type AgentRunStatus,
  type AgentToolName,
} from "./contracts.ts";

const ALLOWED_TRANSITIONS: Record<AgentRunStatus, readonly AgentRunStatus[]> = {
  planned: ["collecting", "failed"],
  collecting: ["collecting", "validating", "failed"],
  validating: [
    "validating",
    "waiting_for_review",
    "ready_for_evaluation",
    "completed",
    "blocked",
    "failed",
  ],
  waiting_for_review: ["validating", "blocked", "failed"],
  ready_for_evaluation: ["completed", "blocked", "failed"],
  completed: [],
  blocked: [],
  failed: [],
};

export function canTransitionAgentRun(
  from: AgentRunStatus,
  to: AgentRunStatus,
) {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionAgentRun(run: AgentRun, status: AgentRunStatus) {
  if (!canTransitionAgentRun(run.status, status)) {
    throw new Error(`Prohibited agent state transition: ${run.status} to ${status}.`);
  }
  run.status = status;
}

function completedTools(run: AgentRun) {
  return new Set(
    run.toolInvocations
      .filter((item) => item.status === "completed")
      .map((item) => item.toolName),
  );
}

export function permittedToolsForRun(run: AgentRun): AgentToolName[] {
  if (
    TERMINAL_RUN_STATUSES.includes(run.status) ||
    run.status === "waiting_for_review" ||
    run.stepCount >= Math.min(run.maxSteps, AGENT_MAX_STEPS)
  ) {
    return [];
  }
  const completed = completedTools(run);
  if (!completed.has("get_candidate_readiness")) {
    return ["get_candidate_readiness"];
  }
  const collection: AgentToolName[] = [];
  if (!completed.has("get_candidate_evidence")) {
    collection.push("get_candidate_evidence");
  }
  if (!completed.has("get_market_context")) {
    collection.push("get_market_context");
  }
  if (collection.length) return collection;
  if (!completed.has("validate_candidate_evidence")) {
    return ["validate_candidate_evidence"];
  }
  if (!completed.has("prepare_evidence_request")) {
    return ["prepare_evidence_request"];
  }
  if (!completed.has("check_evaluation_prerequisites")) {
    return ["check_evaluation_prerequisites"];
  }
  if (
    run.evaluationStatus === "ready" &&
    !completed.has("run_deterministic_evaluation")
  ) {
    return ["run_deterministic_evaluation"];
  }
  if (!completed.has("draft_review_brief")) {
    return ["draft_review_brief"];
  }
  return [];
}

export function assertToolPermitted(run: AgentRun, toolName: AgentToolName) {
  const permitted = permittedToolsForRun(run);
  if (!permitted.includes(toolName)) {
    throw new Error(`Tool ${toolName} is not permitted for the current run state.`);
  }
}
