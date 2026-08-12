import marketUniverseJson from "../../data/public/census/cbsa-universe/2023-07/markets.json" with { type: "json" };
import type { CbsaUniverseSnapshot } from "../data/cbsa-universe/index.ts";
import {
  discoveryActivityEventSchema,
  discoveryStageReceiptSchema,
  marketScanStatusSchema,
  portfolioMetricsSchema,
  type DiscoveryActivityEvent,
  type DiscoveryRun,
  type DiscoveryStageReceipt,
  type MarketScanState,
  type MarketScanStatus,
  type Opportunity,
  type PortfolioMetrics,
} from "./contracts.ts";

const publicMarkets = (marketUniverseJson as CbsaUniverseSnapshot).markets;

const SYNTHETIC_EXCEPTIONS: Readonly<Record<string, {
  scanState: Exclude<MarketScanState, "pending" | "scanned_no_signal" | "opportunity_qualified" | "failed">;
  detail: string;
}>> = {
  "16980": {
    scanState: "blocked_stale",
    detail: "Synthetic signal withheld because the required observation is outside its freshness window.",
  },
  "12060": {
    scanState: "blocked_missing",
    detail: "Synthetic signal withheld because a required eligibility observation is missing.",
  },
  "19740": {
    scanState: "duplicate_suppressed",
    detail: "Synthetic candidate matched an existing fingerprint and was suppressed.",
  },
  "38060": {
    scanState: "quarantined",
    detail: "Synthetic observation failed the intake contract and was quarantined for review.",
  },
};

const ACTIVITY_ORDER = ["42660", "16980", "12060", "19740", "38060"] as const;

function pendingStatus(market: (typeof publicMarkets)[number]): MarketScanStatus {
  return marketScanStatusSchema.parse({
    marketId: market.market_id,
    cbsaCode: market.cbsa_code,
    marketName: market.cbsa_name,
    stateCodes: market.state_codes,
    scanState: "pending",
    opportunityCount: 0,
    detail: "Market is registered in the public CBSA monitoring universe and has not been scanned in this session.",
    observedAt: null,
    evidenceStatus: "Unknown",
    allowedUse: "synthetic_prototype_only",
    scoringEligibility: "none",
  });
}

function completedStatus(
  market: (typeof publicMarkets)[number],
  completedAt: string,
  opportunities: readonly Opportunity[],
): MarketScanStatus {
  const marketOpportunities = opportunities.filter(
    (opportunity) => opportunity.regionId === market.market_id,
  );
  const exception = SYNTHETIC_EXCEPTIONS[market.cbsa_code];
  const isSeattle = market.cbsa_code === "42660";
  const scanState: MarketScanState = isSeattle && marketOpportunities.length
    ? "opportunity_qualified"
    : exception?.scanState ?? "scanned_no_signal";
  const detail = isSeattle && marketOpportunities.length
    ? `${marketOpportunities.length} synthetic sector opportunities passed deterministic qualification and await human review.`
    : exception?.detail ?? "Synthetic scan completed with no qualifying opportunity.";

  return marketScanStatusSchema.parse({
    marketId: market.market_id,
    cbsaCode: market.cbsa_code,
    marketName: market.cbsa_name,
    stateCodes: market.state_codes,
    scanState,
    opportunityCount: marketOpportunities.length,
    detail,
    observedAt: completedAt,
    evidenceStatus: isSeattle || exception ? "Hypothesis" : "Derived",
    allowedUse: "synthetic_prototype_only",
    scoringEligibility: "none",
  });
}

function buildStageReceipts(
  run: DiscoveryRun | null,
  statuses: readonly MarketScanStatus[],
  opportunities: readonly Opportunity[],
): DiscoveryStageReceipt[] {
  if (!run) {
    return [
      ["ingest", "Ingest", "Awaiting a synthetic discovery run."],
      ["validate", "Validate", "No intake receipts recorded."],
      ["detect", "Detect", "No market scan recorded."],
      ["qualify", "Qualify", "No qualification results recorded."],
      ["route", "Prepare", "No opportunities prepared for review."],
    ].map(([stageId, label, detail]) => discoveryStageReceiptSchema.parse({
      stageId,
      label,
      count: 0,
      unit: "records",
      status: "pending",
      detail,
    }));
  }

  const warnings = run.quarantinedObservations > 0;
  return [
    discoveryStageReceiptSchema.parse({
      stageId: "ingest",
      label: "Ingest",
      count: run.acceptedObservations + run.quarantinedObservations,
      unit: "observations",
      status: warnings ? "completed_with_warnings" : "completed",
      detail: `${run.acceptedObservations} accepted and ${run.quarantinedObservations} quarantined.`,
    }),
    discoveryStageReceiptSchema.parse({
      stageId: "validate",
      label: "Validate",
      count: run.acceptedObservations,
      unit: "validated observations",
      status: warnings ? "completed_with_warnings" : "completed",
      detail: `${run.duplicateObservations} duplicate observations suppressed.`,
    }),
    discoveryStageReceiptSchema.parse({
      stageId: "detect",
      label: "Scan markets",
      count: statuses.filter((status) => status.scanState !== "pending").length,
      unit: "markets",
      status: "completed",
      detail: "The full registered CBSA universe received a deterministic synthetic scan receipt.",
    }),
    discoveryStageReceiptSchema.parse({
      stageId: "qualify",
      label: "Qualify",
      count: statuses.filter((status) => status.scanState === "opportunity_qualified").length,
      unit: "markets",
      status: warnings ? "completed_with_warnings" : "completed",
      detail: `${Object.keys(SYNTHETIC_EXCEPTIONS).length} synthetic exception markets were withheld or suppressed.`,
    }),
    discoveryStageReceiptSchema.parse({
      stageId: "route",
      label: "Prepare review",
      count: opportunities.length,
      unit: "opportunities",
      status: "completed",
      detail: "Qualified opportunities were prepared for accountable human review. Nothing was sent.",
    }),
  ];
}

function buildActivity(
  run: DiscoveryRun | null,
  statuses: readonly MarketScanStatus[],
): DiscoveryActivityEvent[] {
  if (!run) return [];
  const byCode = new Map(statuses.map((status) => [status.cbsaCode, status]));
  return ACTIVITY_ORDER.flatMap((code, index) => {
    const status = byCode.get(code);
    if (!status) return [];
    const titleByState: Partial<Record<MarketScanState, string>> = {
      opportunity_qualified: "Opportunity qualified for review",
      blocked_stale: "Candidate blocked by stale evidence",
      blocked_missing: "Candidate blocked by missing evidence",
      duplicate_suppressed: "Duplicate candidate suppressed",
      quarantined: "Observation quarantined",
    };
    return [discoveryActivityEventSchema.parse({
      eventId: `${run.runId}:market:${code}`,
      marketId: status.marketId,
      marketName: status.marketName,
      scanState: status.scanState,
      occurredAt: new Date(new Date(run.completedAt).getTime() - index * 1_000).toISOString(),
      title: titleByState[status.scanState] ?? "Market scan completed",
      detail: status.detail,
      evidenceStatus: status.evidenceStatus === "Derived" ? "Derived" : "Hypothesis",
    })];
  });
}

export function buildNationalMonitoringSnapshot(
  run: DiscoveryRun | null,
  opportunities: readonly Opportunity[],
): {
  marketStatuses: MarketScanStatus[];
  stageReceipts: DiscoveryStageReceipt[];
  activityEvents: DiscoveryActivityEvent[];
  portfolioMetrics: PortfolioMetrics;
} {
  const marketStatuses = publicMarkets.map((market) => run
    ? completedStatus(market, run.completedAt, opportunities)
    : pendingStatus(market));
  const scannedMarkets = marketStatuses.filter((status) => status.scanState !== "pending").length;
  const qualifiedMarkets = marketStatuses.filter((status) => status.scanState === "opportunity_qualified").length;
  const exceptionMarkets = marketStatuses.filter((status) =>
    ["blocked_stale", "blocked_missing", "duplicate_suppressed", "quarantined", "failed"].includes(status.scanState)
  ).length;
  const portfolioMetrics = portfolioMetricsSchema.parse({
    monitoredMarkets: marketStatuses.length,
    scannedMarkets,
    qualifiedMarkets,
    activeOpportunities: opportunities.length,
    exceptionMarkets,
    lastCompletedAt: run?.completedAt ?? null,
  });

  return {
    marketStatuses,
    stageReceipts: buildStageReceipts(run, marketStatuses, opportunities),
    activityEvents: buildActivity(run, marketStatuses),
    portfolioMetrics,
  };
}
