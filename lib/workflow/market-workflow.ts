export type WorkflowCategory = "all" | "current" | "potential" | "evaluated";

export type MarketCategory =
  | Exclude<WorkflowCategory, "all">
  | "unclassified";

export type MarketReviewState =
  | "not_started"
  | "needs_evidence"
  | "in_review"
  | "complete";

export type MarketWorkflowRecord = {
  marketId: string;
  category: Exclude<MarketCategory, "unclassified" | "current">;
  reviewState: MarketReviewState;
  evidenceStatus: "Hypothesis";
  sourceId: string;
  updatedAt: string;
  reviewNote: string;
};

export type LocationMarketAssignment = {
  marketId: string | null;
  assignmentMethod:
    | "source_provided"
    | "derived"
    | "reviewer_confirmed"
    | "unassigned";
  sourceId: string | null;
  evidenceStatus:
    | "Confirmed"
    | "Reported"
    | "Derived"
    | "Hypothesis"
    | "Unknown";
  geographyVersion: string | null;
};

export const WORKFLOW_CATEGORY_COLORS: Record<MarketCategory, string> = {
  current: "#087f75",
  potential: "#6d4aff",
  evaluated: "#c35a05",
  unclassified: "#d1d5db",
};

export const SYNTHETIC_MARKET_WORKFLOW_SOURCE = "SYN-MARKET-WORKFLOW-01";

export const CURRENT_CLINIC_MARKET_IDS: Readonly<Record<string, string>> = {
  Atlanta: "12060",
  Austin: "12420",
  "Colorado Springs": "17820",
  Dallas: "19100",
  Denver: "19740",
  "Fort Collins": "22660",
  Houston: "26420",
  Jacksonville: "27260",
  Phoenix: "38060",
  "South Florida": "33100",
};

export const SYNTHETIC_CANDIDATE_MARKET_IDS: Readonly<
  Record<string, string>
> = {
  nashville: "34980",
  raleigh: "39580",
  sacramento: "40900",
  tampa: "45300",
};

export const INITIAL_MARKET_WORKFLOW_RECORDS: readonly MarketWorkflowRecord[] = [
  {
    marketId: "34980",
    category: "evaluated",
    reviewState: "complete",
    evidenceStatus: "Hypothesis",
    sourceId: SYNTHETIC_MARKET_WORKFLOW_SOURCE,
    updatedAt: "2026-07-30T00:00:00.000Z",
    reviewNote:
      "Synthetic completed market review used only to demonstrate the market-first workflow.",
  },
  ...["39580", "40900", "45300"].map(
    (marketId): MarketWorkflowRecord => ({
      marketId,
      category: "potential",
      reviewState: "needs_evidence",
      evidenceStatus: "Hypothesis",
      sourceId: SYNTHETIC_MARKET_WORKFLOW_SOURCE,
      updatedAt: "2026-07-30T00:00:00.000Z",
      reviewNote:
        "Synthetic potential-market status used only to demonstrate the market-first workflow.",
    }),
  ),
];

export function currentMarketIds(
  clinicMarkets: readonly string[],
): ReadonlySet<string> {
  return new Set(
    clinicMarkets
      .map((market) => CURRENT_CLINIC_MARKET_IDS[market])
      .filter((marketId): marketId is string => Boolean(marketId)),
  );
}

export function marketCategoryFor(
  marketId: string,
  currentIds: ReadonlySet<string>,
  workflowRecords: readonly MarketWorkflowRecord[],
): MarketCategory {
  if (currentIds.has(marketId)) return "current";
  const workflow = workflowRecords.find(
    (record) => record.marketId === marketId,
  );
  if (workflow?.reviewState === "complete") return "evaluated";
  if (workflow) return "potential";
  return "unclassified";
}

export function marketCategoryMap(
  marketIds: readonly string[],
  currentIds: ReadonlySet<string>,
  workflowRecords: readonly MarketWorkflowRecord[],
): Record<string, MarketCategory> {
  return Object.fromEntries(
    marketIds.map((marketId) => [
      marketId,
      marketCategoryFor(marketId, currentIds, workflowRecords),
    ]),
  );
}

export function matchesWorkflowCategory(
  category: MarketCategory,
  filter: WorkflowCategory,
): boolean {
  return filter === "all" || category === filter;
}

export function canEvaluateLocation(
  marketCategory: MarketCategory | null,
): boolean {
  return marketCategory === "evaluated" || marketCategory === "current";
}

export function validateLocationMarketInvariant(input: {
  locationCategory: Exclude<WorkflowCategory, "all">;
  marketId: string | null;
  marketCategory: MarketCategory | null;
  knownMarketIds: ReadonlySet<string>;
}): string[] {
  const issues: string[] = [];
  if (!input.marketId) {
    issues.push("Location does not have a stable parent market.");
    return issues;
  }
  if (!input.knownMarketIds.has(input.marketId)) {
    issues.push(`Parent market ${input.marketId} is not in the market universe.`);
    return issues;
  }
  if (input.locationCategory === "current" && input.marketCategory !== "current") {
    issues.push("A current location requires a current parent market.");
  }
  if (
    input.locationCategory === "evaluated" &&
    !canEvaluateLocation(input.marketCategory)
  ) {
    issues.push(
      "An evaluated location requires an evaluated or current parent market.",
    );
  }
  return issues;
}
