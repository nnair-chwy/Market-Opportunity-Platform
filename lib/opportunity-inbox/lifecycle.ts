import {
  opportunitySchema,
  type Opportunity,
} from "./contracts.ts";

export function isOpportunityExpired(
  opportunity: Opportunity,
  effectiveAt: string,
): boolean {
  return new Date(opportunity.expiresAt).getTime() <= new Date(effectiveAt).getTime();
}

/** Returns a new expired record and preserves its prior evidence and receipts. */
export function expireOpportunity(
  opportunity: Opportunity,
  effectiveAt: string,
): Opportunity {
  if (!isOpportunityExpired(opportunity, effectiveAt) || opportunity.state === "expired") {
    return structuredClone(opportunity);
  }
  return opportunitySchema.parse({
    ...structuredClone(opportunity),
    state: "expired",
    updatedAt: effectiveAt,
  });
}

export function isHistoricalOpportunity(opportunity: Opportunity): boolean {
  return ["dismissed", "expired", "actioned"].includes(opportunity.state);
}

export function mergeOpportunityUpdate(
  current: Opportunity,
  incoming: Opportunity,
): Opportunity {
  return opportunitySchema.parse({
    ...incoming,
    opportunityId: current.opportunityId,
    reviewDecisions: current.reviewDecisions,
    deliveryReceipts: current.deliveryReceipts,
    humanDisposition: current.humanDisposition,
    state: isHistoricalOpportunity(current) ? current.state : incoming.state,
  });
}

export function isWithinCooldown(
  priorDetectedAt: string,
  incomingDetectedAt: string,
  cooldownDays: number,
): boolean {
  const elapsed = new Date(incomingDetectedAt).getTime() - new Date(priorDetectedAt).getTime();
  return elapsed >= 0 && elapsed < cooldownDays * 86_400_000;
}
