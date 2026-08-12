import type { Opportunity } from "./contracts.ts";

export type OpportunityBlocker = {
  id: string;
  label: string;
  reason: string;
  sourceIds: string[];
};

export function getOpportunityBlockers(opportunity: Opportunity): OpportunityBlocker[] {
  if (opportunity.actionPacket) {
    return opportunity.actionPacket.remainingBlockers
      .filter((blocker) => blocker.state === "open")
      .map((blocker) => ({
        id: blocker.blockerId,
        label: blocker.label,
        reason: blocker.reason,
        sourceIds: blocker.evidenceIds,
      }));
  }

  return opportunity.evidence.flatMap((evidence) => {
    const reasons = [
      evidence.rawValue === null ? "Required value is missing." : null,
      evidence.freshnessState === "stale" ? "Evidence is outside the configured freshness window." : null,
      evidence.qualityStatus !== "accepted" ? `Quality status is ${evidence.qualityStatus}.` : null,
    ].filter((reason): reason is string => Boolean(reason));

    if (!reasons.length) return [];
    return [{
      id: `evidence:${evidence.observationId}`,
      label: evidence.label,
      reason: reasons.join(" "),
      sourceIds: [evidence.sourceId],
    }];
  });
}

export function summarizeSectorOpportunities(opportunities: Opportunity[]) {
  const blockerCount = opportunities.reduce(
    (total, opportunity) => total + getOpportunityBlockers(opportunity).length,
    0,
  );
  const averageCoverage = opportunities.length
    ? opportunities.reduce((total, opportunity) => total + opportunity.evidenceCoverage, 0) / opportunities.length
    : 0;

  return {
    activeCount: opportunities.length,
    blockerCount,
    averageCoverage,
    needsAttentionCount: opportunities.filter((opportunity) =>
      ["blocked", "needs_review", "stopped"].includes(opportunity.state),
    ).length,
  };
}
