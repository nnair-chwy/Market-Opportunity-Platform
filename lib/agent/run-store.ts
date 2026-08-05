import { agentRunSchema, type AgentRun } from "./contracts.ts";

const processGlobal = globalThis as typeof globalThis & {
  __candidateReviewAgentRuns?: Map<string, AgentRun>;
};
const runs =
  processGlobal.__candidateReviewAgentRuns ?? new Map<string, AgentRun>();
processGlobal.__candidateReviewAgentRuns = runs;

export function saveAgentRun(run: AgentRun) {
  const validated = agentRunSchema.parse(run);
  runs.set(validated.runId, structuredClone(validated));
  return structuredClone(validated);
}

export function getAgentRun(runId: string) {
  const run = runs.get(runId);
  return run ? structuredClone(run) : null;
}

export function clearAgentRunsForTests() {
  runs.clear();
}
