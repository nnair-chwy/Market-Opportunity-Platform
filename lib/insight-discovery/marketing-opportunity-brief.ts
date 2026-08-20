import type { CurrentDataDiscoveryRun } from "./current-data-discovery.ts";
import { buildEmptyTeamOpportunityBrief, buildTeamOpportunityBrief, type TeamOpportunityBrief } from "./team-opportunity-brief.ts";

export const MARKETING_OPPORTUNITY_BRIEF_VERSION = "marketing-opportunity-brief-v2" as const;
export type MarketingOpportunityBrief = TeamOpportunityBrief;

/** Compatibility wrapper for the Marketing workspace while briefs become team-generic. */
export function buildMarketingOpportunityBrief(run?: CurrentDataDiscoveryRun): MarketingOpportunityBrief {
  return run ? buildTeamOpportunityBrief(run, "marketing") : buildEmptyTeamOpportunityBrief("marketing");
}
