import { SEATTLE_AGENT_MAX_STEPS, type SeattleAgentRun, type SeattleAgentTool } from "./agent-contracts.ts";

function completed(run: SeattleAgentRun) {
  return new Set(run.toolInvocations.filter((item) => item.status === "completed").map((item) => item.toolName));
}

export function permittedSeattleTools(run: SeattleAgentRun): SeattleAgentTool[] {
  if (["completed", "blocked", "failed", "waiting_for_segmentation_review"].includes(run.status) || run.stepCount >= SEATTLE_AGENT_MAX_STEPS) return [];
  const done = completed(run);
  if (!done.has("get_seattle_market_context")) return ["get_seattle_market_context"];
  if (!done.has("get_proposed_submarkets")) return ["get_proposed_submarkets"];
  const confirmed = run.reviewerResponses.some((item) => item.decision === "confirm");
  if (!confirmed) return [];
  if (!done.has("validate_submarket_evidence")) return ["validate_submarket_evidence"];
  if (!done.has("compare_submarkets")) return ["compare_submarkets"];
  if (!done.has("get_demo_broker_directory")) return ["get_demo_broker_directory"];
  if (!done.has("check_market_deep_dive_prerequisites")) return ["check_market_deep_dive_prerequisites"];
  if (!done.has("draft_market_deep_dive")) return ["draft_market_deep_dive"];
  return [];
}

export function assertSeattleToolPermitted(run: SeattleAgentRun, tool: SeattleAgentTool) {
  if (!permittedSeattleTools(run).includes(tool)) throw new Error(`Tool ${tool} is not permitted for the current Seattle run state.`);
}
