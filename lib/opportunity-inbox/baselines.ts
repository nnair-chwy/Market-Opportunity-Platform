import type { PlaybookDefinition, SignalEvent } from "./contracts.ts";

export type PlaybookCondition = PlaybookDefinition["conditions"][number];

/** Evaluates one explicit synthetic threshold without coercing missing values. */
export function conditionPasses(
  condition: PlaybookCondition,
  event: SignalEvent | undefined,
): boolean | null {
  if (!event || event.rawValue === null) return null;
  if (condition.operator === "gte") return event.rawValue >= condition.threshold;
  if (condition.operator === "lte") return event.rawValue <= condition.threshold;
  return event.rawValue === condition.threshold;
}

export function conditionForMetric(
  playbook: PlaybookDefinition,
  metricId: string,
): PlaybookCondition | undefined {
  return playbook.conditions.find((condition) => condition.metricId === metricId);
}
