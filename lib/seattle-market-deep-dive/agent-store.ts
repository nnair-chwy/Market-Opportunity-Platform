import { seattleAgentRunSchema, type SeattleAgentRun } from "./agent-contracts.ts";

const processGlobal = globalThis as typeof globalThis & { __seattleMarketDeepDiveRuns?: Map<string, SeattleAgentRun> };
const runs = processGlobal.__seattleMarketDeepDiveRuns ?? new Map<string, SeattleAgentRun>();
processGlobal.__seattleMarketDeepDiveRuns = runs;

export function saveSeattleAgentRun(run: SeattleAgentRun) {
  const validated = seattleAgentRunSchema.parse(run);
  runs.set(validated.runId, structuredClone(validated));
  return structuredClone(validated);
}
export function getSeattleAgentRun(runId: string) {
  const run = runs.get(runId);
  return run ? structuredClone(run) : null;
}
export function clearSeattleAgentRunsForTests() { runs.clear(); }
