import type { CurrentDataDiscoveryRun } from "./current-data-discovery.ts";

export const MARKETING_OPPORTUNITY_BRIEF_VERSION = "marketing-opportunity-brief-v1" as const;

export type MarketingOpportunityBrief = {
  version: typeof MARKETING_OPPORTUNITY_BRIEF_VERSION;
  title: string;
  preparedFor: string;
  recipientRole: string;
  recommendation: string;
  why: string;
  opportunityMoves: Array<{ market: string; decision: string; evidence: string; action: string }>;
  portfolioImplications: string[];
  primaryOutcomes: string[];
  evidenceNeededToScale: string[];
  decisionRules: { scale: string; protect: string; split: string; stop: string };
  evidenceBoundary: string;
  sourceIds: string[];
};

function adaptiveFinding(run: CurrentDataDiscoveryRun | undefined, fragment: string) {
  return run?.adaptiveDiscovery.findings.find((finding) => finding.id.includes(fragment));
}

function findingText(run: CurrentDataDiscoveryRun | undefined, fragment: string, fallback: string) {
  return adaptiveFinding(run, fragment)?.implication ?? fallback;
}

function actionText(run: CurrentDataDiscoveryRun | undefined, fragment: string, fallback: string) {
  return adaptiveFinding(run, fragment)?.proposedAction ?? fallback;
}

/** A cross-market Marketing opportunity readout for Costa, not a project handoff. */
export function buildMarketingOpportunityBrief(run?: CurrentDataDiscoveryRun): MarketingOpportunityBrief {
  return {
    version: MARKETING_OPPORTUNITY_BRIEF_VERSION,
    title: "The regional Marketing opportunities worth acting on next",
    preparedFor: "Costa Angelakis",
    recipientRole: "Growth Marketing and regional test planning",
    recommendation: "Protect Louisville and Lubbock from broad efficiency cuts and use them as the first candidate markets for incremental paid-search testing. Keep Retail and Pharmacy decisions separate in Wilkes-Barre, where the accounts point in opposite directions. For CVC growth, test Paid Search first in Denver or Fort Lauderdale instead of spreading incremental budget evenly across channels.",
    why: "These are the strongest patterns that repeat across accounts or connect media spend to a downstream operating outcome. They are more useful than a list of low-CPA markets because they distinguish where a regional decision can be shared across businesses, where it must remain account-specific, and where the next dollar should be tested against appointments rather than clicks.",
    opportunityMoves: [
      {
        market: "Louisville, KY",
        decision: "Protect and test for scalable growth",
        evidence: findingText(run, "joint_opportunity:louisville", "Retail cost per attributed conversion is 32.8% lower than its eligible-DMA median and Pharmacy is 20.4% lower than its median."),
        action: actionText(run, "joint_opportunity:louisville", "Protect current efficient investment and use Louisville as a candidate in the next approved cross-account incrementality test."),
      },
      {
        market: "Lubbock, TX",
        decision: "Protect and test for scalable growth",
        evidence: findingText(run, "joint_opportunity:lubbock", "Retail CPA is 26.8% below its eligible-DMA median and Pharmacy CPA is 29.8% below its median."),
        action: actionText(run, "joint_opportunity:lubbock", "Protect current efficient investment and use Lubbock as a candidate in the next approved cross-account incrementality test."),
      },
      {
        market: "Wilkes-Barre–Scranton, PA",
        decision: "Do not make one blended regional budget decision",
        evidence: findingText(run, "contradiction:wilkes", "Retail CPA is 13.7% below its median while Pharmacy CPA is 97.7% above its median."),
        action: actionText(run, "contradiction:wilkes", "Preserve the efficient Retail account and diagnose Pharmacy separately before its next allocation cycle."),
      },
      {
        market: "Denver and Fort Lauderdale CVC",
        decision: "Test Paid Search before broad channel expansion",
        evidence: `${findingText(run, "channel-mix:denver:chewy-paid-search", "Denver Paid Search produced 5× its proportional share of completed appointments.")} ${findingText(run, "channel-mix:fort-lauderdale:chewy-paid-search", "Fort Lauderdale Paid Search produced 3.9× its proportional share of completed appointments.")}`,
        action: "Use Paid Search as the treatment channel in the next capacity-cleared CVC incrementality test; hold other channel allocations stable and judge the result on incremental appointments, new-to-Chewy customers, sales, and contribution.",
      },
    ],
    portfolioImplications: [
      "Do not cut every market above a national efficiency threshold; Louisville and Lubbock are consistently favorable across two distinct acquisition accounts.",
      "Do not combine account performance when the direction differs; Wilkes-Barre shows why one regional score can destroy useful signal.",
      "For clinic growth, downstream appointment response is a stronger allocation clue than clicks or attributed conversions alone.",
    ],
    primaryOutcomes: ["Incremental new customers", "Incremental orders or completed appointments", "Incremental contribution after media cost", "Retention or repeat behavior"],
    evidenceNeededToScale: [
      "Same-period market × account spend, new customers, orders, and contribution",
      "Matched controls and pre-period trends for the selected test markets",
      "CVC staffed appointment capacity and current clinic maturity",
      "Campaign, query, audience, creative, and conversion-action mix for contradictory markets",
    ],
    decisionRules: {
      scale: "Scale only when the matched-control result shows incremental customers or appointments and positive contribution after media cost.",
      protect: "Protect a market from broad cuts when the advantage repeats across independent accounts and clears minimum volume gates.",
      split: "Split the decision by account or business when the regional signals point in opposite directions.",
      stop: "Stop or reverse when the advantage disappears on first-party outcomes, capacity is constrained, or contribution is negative.",
    },
    evidenceBoundary: "These findings prioritize where Marketing should test, protect, or separate decisions. They do not claim that historical attributed efficiency will persist at higher spend, and they do not authorize an automatic budget change.",
    sourceIds: ["SRC-018", "tableau-cvc-metro-outcomes-v1"],
  };
}
