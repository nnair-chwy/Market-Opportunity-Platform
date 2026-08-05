"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { calculateScore } from "@/lib/scoring";
import { UnifiedEvaluatorMap } from "@/components/UnifiedEvaluatorMap";
import type { ResolvedAddress } from "@/lib/address-resolution";
import { currentClinics } from "@/lib/locations/map-data";
import { PublicMarketContext } from "@/components/PublicMarketContext";
import { PortfolioReadinessPanel } from "@/components/esri-readiness";
import { MarketTradeAreaProfile } from "@/components/esri-trade-area";
import { CandidateEvidenceWorkspace } from "@/components/esri-candidate-brief";
import { CandidateReviewAgent } from "@/components/agent-workspace";
import { CandidateBriefsWorkspace } from "@/components/location-workspace";
import { ScoringSandbox } from "@/components/scoring-sandbox";
import { MarketAttractivenessRanking } from "@/components/market-attractiveness";
import { SeattleMarketDeepDive } from "@/components/market-deep-dive";
import { seattleIllustrativeOverlay } from "@/lib/seattle-market-deep-dive";
import {
  MARKET_ATTRACTIVENESS_CONFIGURATION,
  canAddMarketToComparison,
  marketScoresByCbsaCode,
  syntheticMarketAttractivenessResults,
  syntheticMarketSnapshot,
  type MarketAttractivenessResult,
} from "@/lib/market-attractiveness";
import {
  AskAiPanel,
  type AskAiContext,
} from "@/components/AskAiPanel";
import {
  publicMarketMapGeoJson,
  publicMarkets,
} from "@/lib/data/public-market-ui";
import { resolveMapTilerConfig } from "@/lib/data/cbsa-market-map";
import type { CbsaAcsMetricKey } from "@/lib/data/cbsa-acs";
import {
  type UnifiedMapLocation,
} from "@/lib/locations/unified-map";
import {
  CURRENT_CLINIC_MARKET_IDS,
  INITIAL_MARKET_WORKFLOW_RECORDS,
  SYNTHETIC_CANDIDATE_MARKET_IDS,
  SYNTHETIC_MARKET_WORKFLOW_SOURCE,
  canEvaluateLocation,
  currentMarketIds,
  marketCategoryMap,
  matchesWorkflowCategory,
  type LocationMarketAssignment,
  type MarketWorkflowRecord,
  type WorkflowCategory,
} from "@/lib/workflow/market-workflow";

type WorkspaceMode = "markets" | "locations";
type LocationView =
  | "briefs"
  | "compare"
  | "sandbox"
  | "map"
  | "readiness"
  | "brief"
  | "agent";

function locationViewFromParam(view: string | null): LocationView {
  if (view === "compare") return "compare";
  if (view === "sandbox") return "sandbox";
  return "briefs";
}
type Panel = "overview" | "sources" | "assistant";
type EvidenceStatus = "Confirmed" | "Reported" | "Derived" | "Hypothesis" | "Unknown";

const mapTilerConfig = resolveMapTilerConfig(
  process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  process.env.NEXT_PUBLIC_MAPTILER_KEY,
);
const marketScores = marketScoresByCbsaCode(
  syntheticMarketSnapshot,
  syntheticMarketAttractivenessResults,
);
const marketScoreMetadata = {
  configurationVersion:
    MARKET_ATTRACTIVENESS_CONFIGURATION.configurationVersion,
  configurationFingerprint:
    syntheticMarketAttractivenessResults[0]?.configurationFingerprint ??
    "unavailable",
};
const marketComparisonResultByCode = new Map(
  syntheticMarketAttractivenessResults
    .filter((result) => result.cbsaCode)
    .map((result) => [result.cbsaCode!, result]),
);

type Metric = {
  id: string;
  label: string;
  value: number | null;
  display: string;
  weight: number;
  direction: "higher" | "lower";
  source: string;
  observed: string;
  quality: "Accepted" | "Warning";
};

type Candidate = {
  id: string;
  marketId: string | null;
  marketAssignment: LocationMarketAssignment;
  name: string;
  market: string;
  state: string;
  latitude: number;
  longitude: number;
  status: "Ready" | "Needs data" | "In review";
  note: string;
  address?: ResolvedAddress & {
    confirmedAt: string;
  };
  metrics: Metric[];
  evidence: Array<{
    id: string;
    title: string;
    status: EvidenceStatus;
    detail: string;
    observed: string;
  }>;
};

const initialCandidates: Candidate[] = [
  {
    id: "nashville",
    marketId: SYNTHETIC_CANDIDATE_MARKET_IDS.nashville,
    marketAssignment: {
      marketId: SYNTHETIC_CANDIDATE_MARKET_IDS.nashville,
      assignmentMethod: "source_provided",
      sourceId: "SYN-CANDIDATE-MARKET-01",
      evidenceStatus: "Hypothesis",
      geographyVersion: "cbsa-2023-07",
    },
    name: "Nashville East",
    market: "Nashville",
    state: "TN",
    latitude: 36.1745,
    longitude: -86.7679,
    status: "Ready",
    note: "Balanced demand and access signals with a visible staffing constraint to validate.",
    metrics: [
      { id: "demand", label: "Customer demand", value: 90, display: "90 / 100", weight: 30, direction: "higher", source: "SYN-DEM-01", observed: "Jul 18, 2026", quality: "Accepted" },
      { id: "competition", label: "Competitive intensity", value: 30, display: "30 / 100", weight: 20, direction: "lower", source: "SYN-COMP-01", observed: "Jul 16, 2026", quality: "Accepted" },
      { id: "population", label: "Population density", value: 80, display: "80 / 100", weight: 15, direction: "higher", source: "SYN-POP-01", observed: "Jul 1, 2026", quality: "Accepted" },
      { id: "drive", label: "30-min drive coverage", value: 85, display: "85 / 100", weight: 20, direction: "higher", source: "SYN-GEO-01", observed: "Jul 20, 2026", quality: "Accepted" },
      { id: "foot", label: "Foot traffic proxy", value: 80, display: "80 / 100", weight: 10, direction: "higher", source: "SYN-FOOT-01", observed: "Jul 14, 2026", quality: "Accepted" },
      { id: "staff", label: "Staffing feasibility", value: 80, display: "Needs validation", weight: 5, direction: "higher", source: "SYN-OPS-01", observed: "Jul 21, 2026", quality: "Warning" },
    ],
    evidence: [
      { id: "SYN-DEM-01", title: "Aggregated customer demand index", status: "Hypothesis", detail: "Synthetic market-level index for prototype evaluation. No customer-level coordinates.", observed: "Jul 18, 2026" },
      { id: "SYN-GEO-01", title: "Drive-time coverage output", status: "Derived", detail: "Synthetic 30-minute coverage calculation used only to demonstrate the workflow.", observed: "Jul 20, 2026" },
      { id: "SYN-COMP-01", title: "Veterinary competition inventory", status: "Reported", detail: "Synthetic competitor count and intensity. Esri access is not assumed.", observed: "Jul 16, 2026" },
      { id: "SYN-OPS-01", title: "Local staffing feasibility note", status: "Unknown", detail: "Formula and accountable owner still require confirmation.", observed: "Jul 21, 2026" },
    ],
  },
  {
    id: "raleigh",
    marketId: SYNTHETIC_CANDIDATE_MARKET_IDS.raleigh,
    marketAssignment: {
      marketId: SYNTHETIC_CANDIDATE_MARKET_IDS.raleigh,
      assignmentMethod: "source_provided",
      sourceId: "SYN-CANDIDATE-MARKET-01",
      evidenceStatus: "Hypothesis",
      geographyVersion: "cbsa-2023-07",
    },
    name: "Raleigh North",
    market: "Raleigh",
    state: "NC",
    latitude: 35.8102,
    longitude: -78.6382,
    status: "Needs data",
    note: "Promising demand profile, but foot traffic evidence is missing.",
    metrics: [
      { id: "demand", label: "Customer demand", value: 81, display: "81 / 100", weight: 30, direction: "higher", source: "SYN-DEM-02", observed: "Jul 18, 2026", quality: "Accepted" },
      { id: "competition", label: "Competitive intensity", value: 54, display: "54 / 100", weight: 20, direction: "lower", source: "SYN-COMP-02", observed: "Jul 16, 2026", quality: "Accepted" },
      { id: "population", label: "Population density", value: 78, display: "78 / 100", weight: 15, direction: "higher", source: "SYN-POP-02", observed: "Jul 1, 2026", quality: "Accepted" },
      { id: "drive", label: "30-min drive coverage", value: 76, display: "76 / 100", weight: 20, direction: "higher", source: "SYN-GEO-02", observed: "Jul 20, 2026", quality: "Accepted" },
      { id: "foot", label: "Foot traffic proxy", value: null, display: "Missing", weight: 10, direction: "higher", source: "SYN-FOOT-02", observed: "Not observed", quality: "Warning" },
      { id: "staff", label: "Staffing feasibility", value: 72, display: "72 / 100", weight: 5, direction: "higher", source: "SYN-OPS-02", observed: "Jul 21, 2026", quality: "Accepted" },
    ],
    evidence: [
      { id: "SYN-DEM-02", title: "Aggregated customer demand index", status: "Hypothesis", detail: "Synthetic market-level index for prototype evaluation.", observed: "Jul 18, 2026" },
      { id: "SYN-FOOT-02", title: "Foot traffic proxy", status: "Unknown", detail: "No approved synthetic observation loaded for this candidate.", observed: "Not observed" },
    ],
  },
  {
    id: "sacramento",
    marketId: SYNTHETIC_CANDIDATE_MARKET_IDS.sacramento,
    marketAssignment: {
      marketId: SYNTHETIC_CANDIDATE_MARKET_IDS.sacramento,
      assignmentMethod: "source_provided",
      sourceId: "SYN-CANDIDATE-MARKET-01",
      evidenceStatus: "Hypothesis",
      geographyVersion: "cbsa-2023-07",
    },
    name: "Sacramento Central",
    market: "Sacramento",
    state: "CA",
    latitude: 38.5816,
    longitude: -121.4944,
    status: "In review",
    note: "Strong demand, with higher competitive intensity and access tradeoffs.",
    metrics: [
      { id: "demand", label: "Customer demand", value: 89, display: "89 / 100", weight: 30, direction: "higher", source: "SYN-DEM-03", observed: "Jul 18, 2026", quality: "Accepted" },
      { id: "competition", label: "Competitive intensity", value: 69, display: "69 / 100", weight: 20, direction: "lower", source: "SYN-COMP-03", observed: "Jul 16, 2026", quality: "Accepted" },
      { id: "population", label: "Population density", value: 83, display: "83 / 100", weight: 15, direction: "higher", source: "SYN-POP-03", observed: "Jul 1, 2026", quality: "Accepted" },
      { id: "drive", label: "30-min drive coverage", value: 64, display: "64 / 100", weight: 20, direction: "higher", source: "SYN-GEO-03", observed: "Jul 20, 2026", quality: "Accepted" },
      { id: "foot", label: "Foot traffic proxy", value: 78, display: "78 / 100", weight: 10, direction: "higher", source: "SYN-FOOT-03", observed: "Jul 14, 2026", quality: "Accepted" },
      { id: "staff", label: "Staffing feasibility", value: 66, display: "66 / 100", weight: 5, direction: "higher", source: "SYN-OPS-03", observed: "Jul 21, 2026", quality: "Accepted" },
    ],
    evidence: [
      { id: "SYN-DEM-03", title: "Aggregated customer demand index", status: "Hypothesis", detail: "Synthetic market-level index for prototype evaluation.", observed: "Jul 18, 2026" },
      { id: "SYN-COMP-03", title: "Veterinary competition inventory", status: "Reported", detail: "Synthetic competitive intensity for workflow testing.", observed: "Jul 16, 2026" },
    ],
  },
  {
    id: "tampa",
    marketId: SYNTHETIC_CANDIDATE_MARKET_IDS.tampa,
    marketAssignment: {
      marketId: SYNTHETIC_CANDIDATE_MARKET_IDS.tampa,
      assignmentMethod: "source_provided",
      sourceId: "SYN-CANDIDATE-MARKET-01",
      evidenceStatus: "Hypothesis",
      geographyVersion: "cbsa-2023-07",
    },
    name: "Tampa Westshore",
    market: "Tampa",
    state: "FL",
    latitude: 27.9517,
    longitude: -82.524,
    status: "Ready",
    note: "Good coverage and demand, with a moderate competition signal.",
    metrics: [
      { id: "demand", label: "Customer demand", value: 84, display: "84 / 100", weight: 30, direction: "higher", source: "SYN-DEM-04", observed: "Jul 18, 2026", quality: "Accepted" },
      { id: "competition", label: "Competitive intensity", value: 51, display: "51 / 100", weight: 20, direction: "lower", source: "SYN-COMP-04", observed: "Jul 16, 2026", quality: "Accepted" },
      { id: "population", label: "Population density", value: 72, display: "72 / 100", weight: 15, direction: "higher", source: "SYN-POP-04", observed: "Jul 1, 2026", quality: "Accepted" },
      { id: "drive", label: "30-min drive coverage", value: 85, display: "85 / 100", weight: 20, direction: "higher", source: "SYN-GEO-04", observed: "Jul 20, 2026", quality: "Accepted" },
      { id: "foot", label: "Foot traffic proxy", value: 69, display: "69 / 100", weight: 10, direction: "higher", source: "SYN-FOOT-04", observed: "Jul 14, 2026", quality: "Accepted" },
      { id: "staff", label: "Staffing feasibility", value: 74, display: "74 / 100", weight: 5, direction: "higher", source: "SYN-OPS-04", observed: "Jul 21, 2026", quality: "Accepted" },
    ],
    evidence: [
      { id: "SYN-DEM-04", title: "Aggregated customer demand index", status: "Hypothesis", detail: "Synthetic market-level index for prototype evaluation.", observed: "Jul 18, 2026" },
      { id: "SYN-GEO-04", title: "Drive-time coverage output", status: "Derived", detail: "Synthetic coverage result for workflow testing.", observed: "Jul 20, 2026" },
    ],
  },
];

function emptyCandidateMetrics(): Metric[] {
  return [
    { id: "demand", label: "Customer demand", value: null, display: "Missing", weight: 30, direction: "higher", source: "Not loaded", observed: "Not observed", quality: "Warning" },
    { id: "competition", label: "Competitive intensity", value: null, display: "Missing", weight: 20, direction: "lower", source: "Not loaded", observed: "Not observed", quality: "Warning" },
    { id: "population", label: "Population density", value: null, display: "Missing", weight: 15, direction: "higher", source: "Not loaded", observed: "Not observed", quality: "Warning" },
    { id: "drive", label: "30-min drive coverage", value: null, display: "Missing", weight: 20, direction: "higher", source: "Not loaded", observed: "Not observed", quality: "Warning" },
    { id: "foot", label: "Foot traffic proxy", value: null, display: "Missing", weight: 10, direction: "higher", source: "Not loaded", observed: "Not observed", quality: "Warning" },
    { id: "staff", label: "Staffing feasibility", value: null, display: "Missing", weight: 5, direction: "higher", source: "Not loaded", observed: "Not observed", quality: "Warning" },
  ];
}

function addressKey(address: string) {
  return address.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreTone(score: number) {
  if (score >= 80) return "strong";
  if (score >= 70) return "moderate";
  return "watch";
}

function formatContextValue(value: number | null, unit: string) {
  if (value === null) return "Unavailable";
  if (unit === "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: unit.includes("square") ? 1 : 0,
  }).format(value);
}

function relativeStanding(
  value: number | null,
  values: Array<number | null>,
) {
  if (value === null) return null;
  const available = values.filter(
    (candidate): candidate is number => candidate !== null,
  );
  if (!available.length) return null;
  return Math.round(
    (available.filter((candidate) => candidate <= value).length /
      available.length) *
      100,
  );
}

export default function Home() {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>("markets");
  const [locationView, setLocationView] = useState<LocationView>("briefs");
  const [readinessSiteId, setReadinessSiteId] = useState("");
  const [evidenceBriefSiteId, setEvidenceBriefSiteId] = useState("");
  const [agentReviewSiteId, setAgentReviewSiteId] = useState("");
  const [marketCategory, setMarketCategory] =
    useState<WorkflowCategory>("all");
  const [locationCategory, setLocationCategory] =
    useState<WorkflowCategory>("all");
  const [marketWorkflowRecords] = useState<MarketWorkflowRecord[]>([
    ...INITIAL_MARKET_WORKFLOW_RECORDS,
  ]);
  const [selectedId, setSelectedId] = useState("raleigh");
  const [panel, setPanel] = useState<Panel>("overview");
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMapLocationId, setSelectedMapLocationId] =
    useState<string | null>(null);
  const [selectedMarketCode, setSelectedMarketCode] = useState("");
  const [marketComparisonCodes, setMarketComparisonCodes] = useState<string[]>([]);
  const [marketComparisonStatus, setMarketComparisonStatus] = useState("");
  const [seattleDeepDiveOpen, setSeattleDeepDiveOpen] = useState(false);
  const [activeSeattleSubmarketId, setActiveSeattleSubmarketId] = useState<string | null>(null);
  const [locationMarketScope, setLocationMarketScope] =
    useState<string | null>(null);
  const selectedMarketMetric: CbsaAcsMetricKey = "total_population";
  const [includeMicropolitan, setIncludeMicropolitan] = useState(false);
  const [evaluated, setEvaluated] = useState<Record<string, number>>({
    nashville: calculateScore(candidates[0].metrics),
  });
  const [showAddressFlow, setShowAddressFlow] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [addressMatch, setAddressMatch] = useState<ResolvedAddress | null>(null);
  const [addressStatus, setAddressStatus] = useState<
    "entry" | "resolving" | "confirm" | "error"
  >("entry");
  const [addressMessage, setAddressMessage] = useState("");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    if (parameters.get("workspace") !== "locations") return;

    const navigationTimer = window.setTimeout(() => {
      setWorkspaceMode("locations");
      setLocationView(locationViewFromParam(parameters.get("view")));
    }, 0);

    return () => window.clearTimeout(navigationTimer);
  }, []);

  function chooseMarket(code: string) {
    setMarketComparisonStatus("");
    setSelectedMarketCode(code);
    setSeattleDeepDiveOpen(false);
    setActiveSeattleSubmarketId(null);
  }

  function addActiveMarketToComparison() {
    const activeResult = marketComparisonResultByCode.get(selectedMarketCode) ?? null;
    const selectedResults = marketComparisonCodes
      .map((code) => marketComparisonResultByCode.get(code))
      .filter((result): result is MarketAttractivenessResult => Boolean(result));
    const eligibility = canAddMarketToComparison(activeResult, selectedResults);
    if (!activeResult?.cbsaCode || !eligibility.allowed) {
      setMarketComparisonStatus(
        eligibility.reason ?? "Select a scored market before adding it.",
      );
      return;
    }
    setMarketComparisonCodes((current) => [...current, activeResult.cbsaCode!]);
    setMarketComparisonStatus(
      `${activeResult.marketName} added as market ${marketComparisonCodes.length + 1}.`,
    );
  }

  function removeMarketFromComparison(code: string) {
    const result = marketComparisonResultByCode.get(code);
    setMarketComparisonCodes((current) =>
      current.filter((selectedCode) => selectedCode !== code),
    );
    setMarketComparisonStatus(
      `${result?.marketName ?? "Market"} removed from the comparison.`,
    );
  }

  function clearMarketComparison() {
    if (!marketComparisonCodes.length) return;
    setMarketComparisonCodes([]);
    setMarketComparisonStatus("Market comparison cleared.");
  }

  function openMarketComparison() {
    document.getElementById("market-comparison")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }

  const selected = candidates.find((candidate) => candidate.id === selectedId)!;
  const selectedScore = evaluated[selected.id];
  const warnings = selected.metrics.filter((metric) => metric.quality === "Warning");
  const availableWeight = selected.metrics
    .filter((metric) => metric.value !== null)
    .reduce((sum, metric) => sum + metric.weight, 0);
  const hasLocationEvidence = availableWeight > 0;

  const currentIds = useMemo(
    () => currentMarketIds(currentClinics.map((clinic) => clinic.market)),
    [],
  );
  const marketCategories = useMemo(
    () =>
      marketCategoryMap(
        publicMarkets.map((market) => market.cbsa_code),
        currentIds,
        marketWorkflowRecords,
      ),
    [currentIds, marketWorkflowRecords],
  );
  const selectedParentCategory = selected.marketId
    ? marketCategories[selected.marketId] ?? "unclassified"
    : null;
  const marketAllowsEvaluation = canEvaluateLocation(selectedParentCategory);
  const canEvaluate = hasLocationEvidence && marketAllowsEvaluation;

  const visibleCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const categoryCandidates = candidates.filter((candidate) => {
      const category = evaluated[candidate.id] ? "evaluated" : "potential";
      return (
        (locationCategory === "all" || locationCategory === category) &&
        (!locationMarketScope || candidate.marketId === locationMarketScope)
      );
    });
    if (!query) return categoryCandidates;
    return categoryCandidates.filter((candidate) =>
      `${candidate.name} ${candidate.market} ${candidate.state}`
        .toLowerCase()
        .includes(query),
    );
  }, [
    candidates,
    evaluated,
    locationCategory,
    locationMarketScope,
    searchQuery,
  ]);

  const visibleClinics = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (
      locationCategory !== "all" &&
      locationCategory !== "current"
    ) {
      return [];
    }
    return currentClinics.filter((clinic) => {
      const clinicMarketId = CURRENT_CLINIC_MARKET_IDS[clinic.market] ?? null;
      if (locationMarketScope && clinicMarketId !== locationMarketScope) {
        return false;
      }
      return (
        !query ||
        `${clinic.name} ${clinic.market} ${clinic.city} ${clinic.state} ${clinic.address}`
          .toLowerCase()
          .includes(query)
      );
    });
  }, [locationCategory, locationMarketScope, searchQuery]);

  const allMapLocations = useMemo<UnifiedMapLocation[]>(
    () => [
      ...currentClinics.map((clinic) => ({
        id: clinic.id,
        marketId: CURRENT_CLINIC_MARKET_IDS[clinic.market] ?? null,
        name: clinic.name,
        market: clinic.market,
        city: clinic.city,
        state: clinic.state,
        latitude: clinic.latitude,
        longitude: clinic.longitude,
        category: "current" as const,
        evidenceStatus: "Confirmed" as const,
        sourceId: "SRC-009",
        statusLabel:
          "Confirmed public clinic; coordinates derived from its public address",
        address: clinic.address,
      })),
      ...candidates.map((candidate) => {
        const score = evaluated[candidate.id];
        const category = score ? "evaluated" : "potential";
        return {
          id: candidate.id,
          marketId: candidate.marketId,
          name: candidate.name,
          market: candidate.market,
          city: candidate.address?.city ?? candidate.market,
          state: candidate.state,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          category,
          evidenceStatus: candidate.address
            ? ("Derived" as const)
            : ("Hypothesis" as const),
          sourceId: candidate.address?.sourceId ?? `SYN-${candidate.id}`,
          statusLabel: score
            ? "Structured evaluation completed; not approved or recommended"
            : candidate.address
              ? "Census-matched proposed location"
              : "Synthetic proposed location",
          ...(candidate.address
            ? { address: candidate.address.matchedAddress }
            : {}),
          ...(score ? { score } : {}),
        } satisfies UnifiedMapLocation;
      }),
    ],
    [candidates, evaluated],
  );

  const mapLocations = useMemo(
    () =>
      workspaceMode === "markets"
        ? []
        : allMapLocations.filter(
            (location) =>
              (locationCategory === "all" ||
                location.category === locationCategory) &&
              (!locationMarketScope ||
                location.marketId === locationMarketScope),
          ),
    [
      allMapLocations,
      locationCategory,
      locationMarketScope,
      workspaceMode,
    ],
  );

  const visibleMarketCodes = useMemo(
    () =>
      new Set(
        publicMarkets
          .filter(
            (market) =>
              includeMicropolitan || market.cbsa_type === "metropolitan",
          )
          .filter((market) =>
            workspaceMode === "markets"
              ? matchesWorkflowCategory(
                  marketCategories[market.cbsa_code] ?? "unclassified",
                  marketCategory,
                )
              : !locationMarketScope ||
                market.cbsa_code === locationMarketScope,
          )
          .map((market) => market.cbsa_code),
      ),
    [
      includeMicropolitan,
      locationMarketScope,
      marketCategories,
      marketCategory,
      workspaceMode,
    ],
  );

  const marketCounts = useMemo(
    () => {
      const countableMarkets = publicMarkets.filter(
        (market) =>
          includeMicropolitan || market.cbsa_type === "metropolitan",
      );
      return {
      all: countableMarkets.length,
      current: countableMarkets.filter(
        (market) => marketCategories[market.cbsa_code] === "current",
      ).length,
      potential: countableMarkets.filter(
        (market) => marketCategories[market.cbsa_code] === "potential",
      ).length,
      evaluated: countableMarkets.filter(
        (market) => marketCategories[market.cbsa_code] === "evaluated",
      ).length,
      };
    },
    [includeMicropolitan, marketCategories],
  );

  const locationCounts = useMemo(
    () => {
      const countableLocations = allMapLocations.filter(
        (location) =>
          !locationMarketScope ||
          location.marketId === locationMarketScope,
      );
      return {
        all: countableLocations.length,
        current: countableLocations.filter(
          (location) => location.category === "current",
        ).length,
        potential: countableLocations.filter(
          (location) => location.category === "potential",
        ).length,
        evaluated: countableLocations.filter(
          (location) => location.category === "evaluated",
        ).length,
      };
    },
    [allMapLocations, locationMarketScope],
  );
  const scopedMarket = locationMarketScope
    ? publicMarkets.find(
        (market) => market.cbsa_code === locationMarketScope,
      ) ?? null
    : null;
  const selectedClinic =
    currentClinics.find((clinic) => clinic.id === selectedClinicId) ?? null;
  const selectedMarket =
    publicMarkets.find((market) => market.cbsa_code === selectedMarketCode) ??
    null;
  const selectedMarketComparisonResults = marketComparisonCodes
    .map((code) => marketComparisonResultByCode.get(code))
    .filter((result): result is MarketAttractivenessResult => Boolean(result));
  const activeMarketComparisonResult =
    marketComparisonResultByCode.get(selectedMarketCode) ?? null;
  const marketComparisonEligibility = canAddMarketToComparison(
    activeMarketComparisonResult,
    selectedMarketComparisonResults,
  );
  const marketComparisonMarkets = selectedMarketComparisonResults.map((result) => ({
    code: result.cbsaCode!,
    name: result.marketName,
  }));
  const selectedMapLocation =
    allMapLocations.find(
      (location) => location.id === selectedMapLocationId,
    ) ?? null;

  const mapAiContext: AskAiContext | null = (() => {
    if (workspaceMode === "markets") {
      if (!selectedMarket) return null;
      const population =
        selectedMarket.acs?.metrics.total_population.raw_value ?? null;
      const income =
        selectedMarket.acs?.metrics.median_household_income.raw_value ?? null;
      const density =
        selectedMarket.acs?.metrics.population_density.raw_value ?? null;
      const populationStanding = relativeStanding(
        population,
        publicMarkets.map(
          (market) =>
            market.acs?.metrics.total_population.raw_value ?? null,
        ),
      );
      const densityStanding = relativeStanding(
        density,
        publicMarkets.map(
          (market) =>
            market.acs?.metrics.population_density.raw_value ?? null,
        ),
      );
      const workflowCategory =
        marketCategories[selectedMarket.cbsa_code] ?? "unclassified";

      return {
        id: `market-${selectedMarket.cbsa_code}`,
        kind: "market",
        title: selectedMarket.cbsa_name,
        subtitle: `${selectedMarket.cbsa_type === "metropolitan" ? "Metropolitan" : "Micropolitan"} market · ${workflowCategory} workflow`,
        overview:
          "I can connect the selected market’s public context, relative standing, workflow state, and evidence gaps without turning Census context into a score.",
        insights: [
          {
            title: "Market scale",
            detail:
              population === null
                ? "Population is unavailable in the approved public context."
                : `${formatContextValue(population, "people")} people in the 2020–2024 ACS estimate${populationStanding === null ? "." : `, at or above ${populationStanding}% of markets in this mainland reference set.`}`,
            status: populationStanding === null ? "Confirmed" : "Derived",
            sourceIds: ["SRC-016"],
            tone: populationStanding !== null && populationStanding >= 75
              ? "positive"
              : "neutral",
          },
          {
            title: "Household context",
            detail:
              income === null
                ? "Median household income is unavailable."
                : `${formatContextValue(income, "usd")} median household income for the ACS estimate period.`,
            status: "Confirmed",
            sourceIds: ["SRC-016"],
            tone: "neutral",
          },
          {
            title: "Geographic concentration",
            detail:
              density === null
                ? "Population density cannot be calculated from the available inputs."
                : `${formatContextValue(density, "people per square mile")} people per square mile${densityStanding === null ? "." : `, at or above ${densityStanding}% of reference markets.`}`,
            status: "Derived",
            sourceIds: ["SRC-015", "SRC-016"],
            tone:
              densityStanding !== null && densityStanding >= 75
                ? "positive"
                : "neutral",
          },
          {
            title: "Review readiness",
            detail:
              workflowCategory === "current" ||
              workflowCategory === "evaluated"
                ? `The market is ${workflowCategory}, so linked candidate locations may proceed to evidence review.`
                : `The market is ${workflowCategory}; the evidence and reviewer rule needed to complete market review are not yet approved.`,
            status:
              workflowCategory === "unclassified" ? "Unknown" : "Hypothesis",
            sourceIds:
              workflowCategory === "unclassified"
                ? []
                : [SYNTHETIC_MARKET_WORKFLOW_SOURCE],
            tone:
              workflowCategory === "current" ||
              workflowCategory === "evaluated"
                ? "positive"
                : "caution",
          },
        ],
        warnings: [
          "ACS values are market context only and have no scoring weight",
          ...(workflowCategory === "unclassified"
            ? ["No market workflow classification is recorded"]
            : []),
        ],
        limitations: [
          "these CBSA boundaries are statistical areas, not trade areas or drive-time coverage",
          "population growth is not calculated without an approved boundary-compatibility rule",
        ],
        suggestedQuestions: [
          "What stands out about this market?",
          "What evidence is still missing?",
          "What should the market review investigate?",
        ],
      };
    }

    if (!selectedMapLocation) return null;
    if (selectedMapLocation.category === "current") {
      return {
        id: `location-${selectedMapLocation.id}`,
        kind: "location",
        title: selectedMapLocation.name,
        subtitle: `Current clinic · ${selectedMapLocation.city}, ${selectedMapLocation.state}`,
        overview:
          "This view confirms the public clinic location and parent-market context, but it does not include approved performance or site-evaluation evidence.",
        insights: [
          {
            title: "Operating location",
            detail:
              selectedMapLocation.address ??
              "A public clinic record is available without a display address.",
            status: "Confirmed",
            sourceIds: ["SRC-009"],
            tone: "neutral",
          },
          {
            title: "Evaluation coverage",
            detail:
              "No approved performance metrics, score, constraints, or outcome comparison are loaded for this clinic.",
            status: "Unknown",
            sourceIds: [],
            tone: "caution",
          },
        ],
        warnings: [
          "Do not infer clinic performance from public location data",
        ],
        limitations: [
          "public location confirmation does not provide operational, financial, lease, or local-demand evidence",
        ],
        suggestedQuestions: [
          "What can we confirm here?",
          "What evidence is missing?",
          "What would make this comparable?",
        ],
      };
    }

    const candidate = candidates.find(
      (item) => item.id === selectedMapLocation.id,
    );
    if (!candidate) return null;
    const score = evaluated[candidate.id] ?? null;
    const availableMetrics = candidate.metrics.filter(
      (metric) => metric.value !== null,
    );
    const rankedContributions = [...availableMetrics].sort((left, right) => {
      const leftNormalized =
        left.direction === "lower" ? 100 - left.value! : left.value!;
      const rightNormalized =
        right.direction === "lower" ? 100 - right.value! : right.value!;
      return (
        rightNormalized * right.weight - leftNormalized * left.weight
      );
    });
    const strongest = rankedContributions[0] ?? null;
    const weakest = rankedContributions.at(-1) ?? null;
    const missing = candidate.metrics.filter(
      (metric) => metric.value === null,
    );
    const candidateWarnings = candidate.metrics.filter(
      (metric) => metric.quality === "Warning",
    );

    return {
      id: `location-${candidate.id}-${score ?? "unevaluated"}`,
      kind: "location",
      title: candidate.name,
      subtitle: `${candidate.market}, ${candidate.state} · ${score === null ? candidate.status : `Evaluated ${score}/100`}`,
      overview:
        score === null
          ? "I can inspect the candidate’s loaded evidence and gaps now. A deterministic evaluation must run before I explain a score."
          : `The deterministic result is ${score}/100 with ${availableMetrics.reduce((total, metric) => total + metric.weight, 0)}% data coverage. I can explain the visible contributions and review gaps, but I do not produce the score.`,
      insights: [
        ...(strongest
          ? [
              {
                title: "Strongest visible contribution",
                detail: `${strongest.label} is ${strongest.display} with a ${strongest.weight}% demonstration weight.`,
                status: "Hypothesis" as const,
                sourceIds: [strongest.source],
                tone: "positive" as const,
              },
            ]
          : []),
        ...(weakest
          ? [
              {
                title: "Tradeoff to review",
                detail: `${weakest.label} is the weakest available weighted contribution in this candidate’s current structured result.`,
                status: "Derived" as const,
                sourceIds: [weakest.source],
                tone: "caution" as const,
              },
            ]
          : []),
        {
          title: "Evidence coverage",
          detail: missing.length
            ? `${missing.map((metric) => metric.label).join(", ")} ${missing.length === 1 ? "is" : "are"} missing and remain excluded.`
            : "All six demonstration metrics are present. Production data approval is still unresolved.",
          status: missing.length ? "Unknown" : "Hypothesis",
          sourceIds: missing.length ? [] : candidate.evidence.map((item) => item.id),
          tone: missing.length ? "caution" : "neutral",
        },
        {
          title: "Human review boundary",
          detail:
            "Physical-site, lease, regulatory, staffing-owner, and local-market diligence remain outside this result.",
          status: "Unknown",
          sourceIds: [],
          tone: "caution",
        },
      ],
      warnings: candidateWarnings.map(
        (warning) => `${warning.label} is flagged for review`,
      ),
      limitations: [
        "the candidate and demonstration criteria are synthetic or session-only",
        "a higher score is not a recommendation to select or lease the site",
      ],
      suggestedQuestions: [
        "Why does this location stand out?",
        "What could change this view?",
        "What diligence should happen next?",
      ],
    };
  })();

  function chooseCandidate(id: string) {
    const candidate = candidates.find((item) => item.id === id);
    setSelectedId(id);
    setSelectedMapLocationId(id);
    setSelectedClinicId(null);
    if (candidate?.marketId) chooseMarket(candidate.marketId);
    setPanel("overview");
  }

  function runEvaluation() {
    if (!canEvaluate) return;
    const score = calculateScore(selected.metrics);
    setEvaluated((current) => ({ ...current, [selected.id]: score }));
    setSelectedMapLocationId(selected.id);
    setLocationCategory("evaluated");
    setPanel("overview");
  }

  function chooseMapLocation(location: UnifiedMapLocation) {
    setSelectedMapLocationId(location.id);
    if (location.marketId) chooseMarket(location.marketId);
    if (location.category === "current") {
      setSelectedClinicId(location.id);
      return;
    }
    chooseCandidate(location.id);
  }

  function viewLocationsInMarket(marketId: string) {
    chooseMarket(marketId);
    setLocationMarketScope(marketId);
    setWorkspaceMode("locations");
    setLocationView("briefs");
    setSelectedMapLocationId(null);
    setSelectedClinicId(null);
    setSearchQuery("");
  }

  function closeAddressFlow() {
    if (addressStatus === "resolving") return;
    setShowAddressFlow(false);
  }

  async function resolveAddress(event: FormEvent) {
    event.preventDefault();
    const address = addressInput.trim();
    if (!address) {
      setAddressStatus("error");
      setAddressMessage("Enter a complete U.S. street address.");
      return;
    }

    setAddressStatus("resolving");
    setAddressMessage("");
    setAddressMatch(null);

    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const result = (await response.json()) as {
        status?: string;
        match?: ResolvedAddress;
        message?: string;
      };

      if (!response.ok || result.status !== "matched" || !result.match) {
        setAddressStatus("error");
        setAddressMessage(
          result.message ??
            "No address match was found. Check the address and try again.",
        );
        return;
      }

      setAddressMatch(result.match);
      setAddressStatus("confirm");
    } catch {
      setAddressStatus("error");
      setAddressMessage(
        "The address service could not be reached. Try again later.",
      );
    }
  }

  function confirmProposedLocation() {
    if (!addressMatch) return;

    const normalizedMatch = addressKey(addressMatch.matchedAddress);
    const duplicateCandidate = candidates.some(
      (candidate) =>
        candidate.address &&
        addressKey(candidate.address.matchedAddress) === normalizedMatch,
    );
    const duplicateClinic = currentClinics.some(
      (clinic) => addressKey(clinic.address) === normalizedMatch,
    );
    if (duplicateCandidate || duplicateClinic) {
      setAddressStatus("error");
      setAddressMessage(
        "This address is already represented as a current or proposed location.",
      );
      return;
    }

    const confirmedAt = new Date().toISOString();
    const id = `proposed-${Date.now().toString(36)}`;
    const name =
      candidateName.trim() || `${addressMatch.city} proposed location`;
    const assignedMarketId = locationMarketScope;
    const assignedMarket = assignedMarketId
      ? publicMarkets.find(
          (market) => market.cbsa_code === assignedMarketId,
        )
      : null;
    const proposedCandidate: Candidate = {
      id,
      marketId: assignedMarketId,
      marketAssignment: {
        marketId: assignedMarketId,
        assignmentMethod: assignedMarketId
          ? "reviewer_confirmed"
          : "unassigned",
        sourceId: assignedMarketId
          ? SYNTHETIC_MARKET_WORKFLOW_SOURCE
          : null,
        evidenceStatus: assignedMarketId ? "Hypothesis" : "Unknown",
        geographyVersion: assignedMarketId ? "cbsa-2023-07" : null,
      },
      name,
      market: assignedMarket?.cbsa_name ?? "Unassigned market",
      state: addressMatch.state,
      latitude: addressMatch.latitude,
      longitude: addressMatch.longitude,
      status: "Needs data",
      note:
        "The reviewer confirmed the intended Census address match. Evaluation is blocked until approved evidence is loaded and validated.",
      address: { ...addressMatch, confirmedAt },
      metrics: emptyCandidateMetrics(),
      evidence: [
        {
          id: addressMatch.sourceId,
          title: "Census-matched candidate address",
          status: "Derived",
          detail:
            "The reviewer selected this geocoder match. It does not verify deliverability, building existence, lease suitability, or clinic feasibility.",
          observed: new Date(addressMatch.resolvedAt).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" },
          ),
        },
      ],
    };

    setCandidates((current) => [...current, proposedCandidate]);
    setSelectedId(id);
    setSelectedMapLocationId(id);
    setWorkspaceMode("locations");
    setLocationCategory("potential");
    setPanel("overview");
    setShowAddressFlow(false);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Clinic Location Evaluator home">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>
            <strong>Clinic Location Evaluator</strong>
            <small>Evidence-backed decision support</small>
          </span>
        </a>
        <div className="topbar-actions">
          <span className="prototype-badge">Synthetic prototype</span>
          <button className="icon-button" aria-label="Notifications">2</button>
          <div className="avatar" aria-label="User profile">NN</div>
        </div>
      </header>

      <section className="workspace" id="top">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">
              {workspaceMode === "markets"
                ? "Market-first workflow"
                : locationView === "compare"
                  ? "Location comparison"
                  : locationView === "sandbox"
                    ? "Isolated configuration sandbox"
                    : "Agentic candidate briefs"}
            </p>
            <h1>
              {workspaceMode === "markets"
                ? "Evaluate the market before the location"
                : locationView === "compare"
                  ? "Compare potential locations"
                  : locationView === "sandbox"
                    ? "Explore scoring sensitivity"
                    : "Prepare candidate briefs for human review"}
            </h1>
            <p>
              {workspaceMode === "markets"
                ? "Review workflow status and versioned public context without turning Census evidence into a score, rank, or recommendation."
                : locationView === "compare"
                  ? "Compare the same source-linked evidence fields in analyst selection order without producing a winner or recommendation."
                  : locationView === "sandbox"
                    ? "Adjust bounded demonstration settings to inspect deterministic score and preference-rank changes. No setting is saved or approved."
                    : "Choose a potential location, run the bounded review agent, and inspect the resulting draft evidence document."}
            </p>
          </div>
        </div>

        <div
          className="workspace-tabs"
          role="tablist"
          aria-label="Evaluator workspaces"
        >
          <button
            className={workspaceMode === "markets" ? "active" : ""}
            onClick={() => {
              setWorkspaceMode("markets");
              setSelectedMapLocationId(null);
            }}
            role="tab"
            aria-selected={workspaceMode === "markets"}
          >
            Markets
          </button>
          <button
            className={workspaceMode === "locations" ? "active" : ""}
            onClick={() => {
              setWorkspaceMode("locations");
              setLocationView("briefs");
              setLocationMarketScope(null);
            }}
            role="tab"
            aria-selected={workspaceMode === "locations"}
          >
            Locations
          </button>
        </div>

        {workspaceMode === "locations" ? (
          <div
            className="location-subview-tabs"
            role="tablist"
            aria-label="Location workspace views"
          >
            <button
              className={locationView === "briefs" ? "active" : ""}
              onClick={() => setLocationView("briefs")}
              role="tab"
              aria-selected={locationView === "briefs"}
            >
              Candidate briefs
            </button>
            <button
              className={locationView === "compare" ? "active" : ""}
              onClick={() => {
                setLocationView("compare");
                setSelectedMapLocationId(null);
                setSelectedClinicId(null);
              }}
              role="tab"
              aria-selected={locationView === "compare"}
            >
              Compare locations
            </button>
            <button
              className={locationView === "sandbox" ? "active" : ""}
              onClick={() => {
                setLocationView("sandbox");
                setSelectedMapLocationId(null);
                setSelectedClinicId(null);
              }}
              role="tab"
              aria-selected={locationView === "sandbox"}
            >
              Scoring sandbox
            </button>
          </div>
        ) : null}

        {workspaceMode === "markets" ? (
          <div
            className="view-tabs workflow-category-tabs"
            role="tablist"
            aria-label={`${workspaceMode === "markets" ? "Market" : "Location"} workflow categories`}
          >
          {(["all", "current", "potential", "evaluated"] as const).map(
            (category) => {
              const active =
                workspaceMode === "markets"
                  ? marketCategory === category
                  : locationCategory === category;
              const counts =
                workspaceMode === "markets" ? marketCounts : locationCounts;
              return (
                <button
                  key={category}
                  className={active ? "active" : ""}
                  onClick={() => {
                    if (workspaceMode === "markets") {
                      setMarketCategory(category);
                      if (
                        selectedMarketCode &&
                        !matchesWorkflowCategory(
                          marketCategories[selectedMarketCode] ??
                            "unclassified",
                          category,
                        )
                      ) {
                        chooseMarket("");
                      }
                    } else {
                      setLocationCategory(category);
                    }
                    setSelectedMapLocationId(null);
                    setSelectedClinicId(null);
                  }}
                  role="tab"
                  aria-selected={active}
                >
                  {category[0].toUpperCase() + category.slice(1)}{" "}
                  <span>{counts[category]}</span>
                </button>
              );
            },
          )}
          </div>
        ) : null}

        {workspaceMode === "markets" ? (
          <UnifiedEvaluatorMap
            config={mapTilerConfig}
            collection={publicMarketMapGeoJson}
            visibleMarketCodes={visibleMarketCodes}
            selectedMarketCode={selectedMarketCode}
            comparisonMarkets={marketComparisonMarkets}
            comparisonAddEligibility={marketComparisonEligibility}
            comparisonStatus={marketComparisonStatus}
            workspaceMode={workspaceMode}
            marketCategories={marketCategories}
            marketScores={marketScores}
            marketScoreMetadata={marketScoreMetadata}
            locations={mapLocations}
            selectedLocationId={selectedMapLocationId}
            seattleDeepDiveOverlay={
              seattleDeepDiveOpen && selectedMarketCode === "42660"
                ? seattleIllustrativeOverlay
                : null
            }
            activeSeattleSubmarketId={activeSeattleSubmarketId}
            onChooseSeattleSubmarket={setActiveSeattleSubmarketId}
            onChooseMarket={(code) => {
              chooseMarket(code);
            }}
            onAddMarketToComparison={addActiveMarketToComparison}
            onRemoveMarketFromComparison={removeMarketFromComparison}
            onClearMarketComparison={clearMarketComparison}
            onOpenMarketComparison={openMarketComparison}
            onChooseLocation={chooseMapLocation}
            onReset={() => {
              setSelectedMapLocationId(null);
            }}
          />
        ) : null}

        {workspaceMode === "locations" && locationView === "briefs" ? (
          <CandidateBriefsWorkspace
            key={evidenceBriefSiteId || "candidate-briefs-workspace"}
            initialSiteId={evidenceBriefSiteId}
            onOpenMarket={(code) => {
              chooseMarket(code);
              setWorkspaceMode("markets");
              setSelectedMapLocationId(null);
              setSelectedClinicId(null);
            }}
          />
        ) : workspaceMode === "locations" && locationView === "compare" ? (
          <CandidateEvidenceWorkspace
            key="location-comparison-workspace"
            initialMode="compare"
            showModeTabs={false}
            showWorkspaceIntroduction={false}
            heading="Compare locations"
            onOpenMarket={(code) => {
              chooseMarket(code);
              setWorkspaceMode("markets");
              setSelectedMapLocationId(null);
              setSelectedClinicId(null);
            }}
          />
        ) : workspaceMode === "locations" && locationView === "sandbox" ? (
          <ScoringSandbox showIntroduction={false} />
        ) : workspaceMode === "locations" && locationView === "readiness" ? (
          <PortfolioReadinessPanel
            initialSiteId={readinessSiteId}
            onPrepareReview={(siteId) => {
              setAgentReviewSiteId(siteId);
              setLocationView("agent");
              setSelectedMapLocationId(null);
              setSelectedClinicId(null);
            }}
            onOpenBrief={(siteId) => {
              setEvidenceBriefSiteId(siteId);
              setLocationView("brief");
              setSelectedMapLocationId(null);
              setSelectedClinicId(null);
            }}
            onOpenMarket={(code) => {
              chooseMarket(code);
              setLocationView("map");
              setWorkspaceMode("markets");
              setSelectedMapLocationId(null);
            }}
          />
        ) : workspaceMode === "locations" && locationView === "brief" ? (
          <CandidateEvidenceWorkspace
            key={evidenceBriefSiteId || "candidate-evidence-workspace"}
            initialSiteId={evidenceBriefSiteId}
            onContinueReview={(siteId) => {
              setAgentReviewSiteId(siteId);
              setLocationView("agent");
              setSelectedMapLocationId(null);
              setSelectedClinicId(null);
            }}
            onOpenReadiness={(siteId) => {
              setReadinessSiteId(siteId);
              setLocationView("readiness");
              setSelectedMapLocationId(null);
              setSelectedClinicId(null);
            }}
            onOpenMarket={(code) => {
              chooseMarket(code);
              setLocationView("map");
              setWorkspaceMode("markets");
              setSelectedMapLocationId(null);
              setSelectedClinicId(null);
            }}
          />
        ) : workspaceMode === "locations" && locationView === "agent" ? (
          <CandidateReviewAgent
            key={agentReviewSiteId || "candidate-review-agent"}
            siteId={agentReviewSiteId}
            onOpenReadiness={(siteId) => {
              setReadinessSiteId(siteId);
              setLocationView("readiness");
              setSelectedMapLocationId(null);
              setSelectedClinicId(null);
            }}
            onOpenBrief={(siteId) => {
              setEvidenceBriefSiteId(siteId);
              setLocationView("brief");
              setSelectedMapLocationId(null);
              setSelectedClinicId(null);
            }}
            onOpenMarket={(code) => {
              chooseMarket(code);
              setLocationView("map");
              setWorkspaceMode("markets");
              setSelectedMapLocationId(null);
              setSelectedClinicId(null);
            }}
          />
        ) : workspaceMode === "markets" ? (
          seattleDeepDiveOpen && selectedMarketCode === "42660" ? (
            <SeattleMarketDeepDive
              activeSubmarketId={activeSeattleSubmarketId}
              onActiveSubmarketChange={setActiveSeattleSubmarketId}
              onBack={() => {
                setSeattleDeepDiveOpen(false);
                setActiveSeattleSubmarketId(null);
              }}
            />
          ) : <>
            {selectedMarketCode === "42660" ? (
              <section className="seattle-deep-dive-entry" aria-label="Seattle market deep dive demo">
                <div>
                  <strong>Explore Seattle below the market level</strong>
                  <span>Review a synthetic submarket comparison and fictional broker research workflow.</span>
                </div>
                <button type="button" onClick={() => {
                  setActiveSeattleSubmarketId(null);
                  setSeattleDeepDiveOpen(true);
                }}>
                  Prepare Seattle market deep dive
                </button>
              </section>
            ) : null}
            <MarketAttractivenessRanking />
            <PublicMarketContext
              selectedCode={selectedMarketCode}
              selectedMetric={selectedMarketMetric}
              includeMicropolitan={includeMicropolitan}
              category={marketCategory}
              marketCategories={marketCategories}
              onChooseMarket={chooseMarket}
              comparisonCodes={marketComparisonCodes}
              onAddActiveMarket={addActiveMarketToComparison}
              onRemoveComparisonMarket={removeMarketFromComparison}
              onIncludeMicropolitanChange={setIncludeMicropolitan}
            />
            <MarketTradeAreaProfile
              marketCode={selectedMarketCode}
              onOpenReadiness={(siteId) => {
                setEvidenceBriefSiteId(siteId);
                setLocationView("briefs");
                setWorkspaceMode("locations");
                setSelectedMapLocationId(null);
                setSelectedClinicId(null);
              }}
              onOpenLocations={viewLocationsInMarket}
            />
          </>
        ) : (
          <div className="unified-panel-layout">
            <aside
              className="location-list unified-side-panel"
              aria-label={`${locationCategory} location list`}
            >
              {scopedMarket ? (
                <div className="market-scope-banner">
                  <button
                    onClick={() => {
                      setWorkspaceMode("markets");
                      chooseMarket(scopedMarket.cbsa_code);
                    }}
                  >
                    ← Back to market
                  </button>
                  <div>
                    <span>Markets / {scopedMarket.cbsa_name} / Locations</span>
                    <strong>
                      {marketCategories[scopedMarket.cbsa_code]?.toUpperCase()}
                    </strong>
                  </div>
                  <button onClick={() => setLocationMarketScope(null)}>
                    Clear market filter
                  </button>
                </div>
              ) : null}
              <div className="list-heading">
                <div>
                  <h2>{locationCategory[0].toUpperCase() + locationCategory.slice(1)} locations</h2>
                  <p>
                    Current clinics and synthetic or session-only candidates,
                    filtered by parent market when selected
                  </p>
                </div>
              </div>
              <div className="location-search-toolbar">
                <label className="search-field">
                  <span aria-hidden="true">⌕</span>
                  <input
                    aria-label="Search locations"
                    placeholder="Search clinic, candidate, market, city, or state"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>
              </div>

              <div className="list-scroll">
                {visibleClinics.map((clinic) => (
                      <button
                        className={`candidate-row clinic-row ${
                          selectedClinicId === clinic.id ? "active" : ""
                        }`}
                        key={clinic.id}
                        aria-label={`Focus ${clinic.name}, ${clinic.city}, ${clinic.state} on the unified map`}
                        onClick={() => {
                          setSelectedClinicId(clinic.id);
                          setSelectedMapLocationId(clinic.id);
                          chooseMarket(
                            CURRENT_CLINIC_MARKET_IDS[clinic.market] ?? "",
                          );
                        }}
                      >
                        <div>
                          <strong>{clinic.name}</strong>
                          <small>
                            {clinic.city}, {clinic.state}
                          </small>
                          <small className="clinic-address">
                            {clinic.address}
                          </small>
                        </div>
                        <span className="location-arrow" aria-hidden="true">
                          ›
                        </span>
                      </button>
                    ))}
                {visibleCandidates.map((candidate) => {
                    const score = evaluated[candidate.id];
                    return (
                      <button
                        className={`candidate-row ${
                          selected.id === candidate.id ? "active" : ""
                        }`}
                        key={candidate.id}
                        aria-label={`Focus ${candidate.name}, ${candidate.market}, ${candidate.state} on the unified map`}
                        onClick={() => chooseCandidate(candidate.id)}
                      >
                        <div>
                          <strong>{candidate.name}</strong>
                          <small>
                            {candidate.market}, {candidate.state}
                          </small>
                          <small>
                            {candidate.address
                              ? "Census-matched proposal"
                              : "Synthetic candidate"}
                          </small>
                        </div>
                        {score ? (
                          <span
                            className={`score-chip ${scoreTone(score)}`}
                            aria-label={`Evaluation score ${score}; not approved or recommended`}
                          >
                            {score}
                          </span>
                        ) : (
                          <span className="pending-chip">
                            {candidate.status}
                          </span>
                        )}
                      </button>
                    );
                  })}
                {!visibleClinics.length && !visibleCandidates.length ? (
                  <div className="empty-state">
                    No locations match this category, market, and search.
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        )}
      </section>

      {workspaceMode === "locations" &&
        locationView === "map" &&
        selectedMapLocationId === selected.id &&
        !selectedClinicId && (
        <section className="detail-section" aria-labelledby="detail-title">
          <div className="detail-header">
            <div>
              <p className="eyebrow">Candidate evaluation</p>
              <h2 id="detail-title">{selected.name}</h2>
              <p>
                {selected.market}, {selected.state}
                {selected.address ? (
                  <>
                    <span>•</span> {selected.address.matchedAddress}
                  </>
                ) : (
                  <>
                    <span>•</span> Synthetic site ID CVC-{selected.id.toUpperCase()}-01
                  </>
                )}
              </p>
              <div className="candidate-market-context">
                <span>
                  Parent market:{" "}
                  <strong>
                    {selected.marketId
                      ? selectedParentCategory?.toUpperCase()
                      : "UNASSIGNED"}
                  </strong>
                </span>
                {selected.marketId ? (
                  <button
                    onClick={() => {
                      chooseMarket(selected.marketId!);
                      setWorkspaceMode("markets");
                    }}
                  >
                    Review market
                  </button>
                ) : null}
              </div>
            </div>
            <div className="score-summary">
              {selectedScore ? (
                <>
                  <div className={`score-ring ${scoreTone(selectedScore)}`}>
                    <strong>{selectedScore}</strong><small>/100</small>
                  </div>
                  <div><strong>Evaluation complete</strong><small>Config CVC-SYN-v0.1</small></div>
                </>
              ) : (
                <div className="evaluation-action">
                  <button
                    className="primary-button large"
                    disabled={!canEvaluate}
                    onClick={runEvaluation}
                  >
                    Run evaluation
                  </button>
                  {!canEvaluate ? (
                    <>
                      <small>
                        {!selected.marketId
                          ? "Assign and confirm this location’s market before evaluation."
                          : !marketAllowsEvaluation
                            ? "Evaluate this market before evaluating its locations."
                            : "Load validated evidence before evaluation."}
                      </small>
                      {selected.marketId && !marketAllowsEvaluation ? (
                        <button
                          className="text-button"
                          onClick={() => {
                            chooseMarket(selected.marketId!);
                            setWorkspaceMode("markets");
                          }}
                        >
                          Review market first
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="detail-tabs" role="tablist" aria-label="Candidate details">
            <button className={panel === "overview" ? "active" : ""} onClick={() => setPanel("overview")} role="tab">Evaluation</button>
            <button className={panel === "sources" ? "active" : ""} onClick={() => setPanel("sources")} role="tab">Source data <span>{selected.evidence.length}</span></button>
            <button className={panel === "assistant" ? "active" : ""} onClick={() => setPanel("assistant")} role="tab">Ask AI</button>
          </div>

          {panel === "overview" && (
            <div className="evaluation-grid">
              <div className="evaluation-main">
                <div className="section-title">
                  <div><h3>Score contribution</h3><p>Deterministic weighted model with visible inputs</p></div>
                  <span className="version-pill">100% total weight</span>
                </div>
                <div className="metric-table">
                  <div className="metric-head"><span>Metric</span><span>Raw value</span><span>Weight</span><span>Contribution</span></div>
                  {selected.metrics.map((metric) => {
                    const normalized = metric.value === null ? null : metric.direction === "lower" ? 100 - metric.value : metric.value;
                    const contribution = normalized === null ? null : (normalized * metric.weight) / 100;
                    return (
                      <div className="metric-row" key={metric.id}>
                        <div>
                          <strong>{metric.label}</strong>
                          <small>{metric.source} · {metric.observed}</small>
                        </div>
                        <span className={metric.quality === "Warning" ? "warning-text" : ""}>{metric.display}</span>
                        <span>{metric.weight}%</span>
                        <div className="contribution">
                          <div><i style={{ width: `${contribution ? Math.min(contribution * 3.2, 100) : 0}%` }} /></div>
                          <strong>{contribution === null ? "Excluded" : contribution.toFixed(1)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <aside className="review-card">
                <div className="review-icon">◎</div>
                <h3>What the result says</h3>
                <p>{selected.note}</p>
                <div className="review-stat"><span>Data coverage</span><strong>{availableWeight}%</strong></div>
                <div className="review-stat"><span>Quality warnings</span><strong className={warnings.length ? "warning-text" : ""}>{warnings.length}</strong></div>
                <div className="review-stat"><span>Scoring version</span><strong>v0.1</strong></div>
                {warnings.length > 0 && (
                  <div className="warning-box">
                    <strong>Review required</strong>
                    <p>{warnings.map((warning) => warning.label).join(", ")} must be resolved or explicitly accepted.</p>
                  </div>
                )}
                <button className="secondary-button" onClick={() => setPanel("assistant")}>Ask about this result</button>
                <small className="human-boundary">A human decision owner makes the final site decision.</small>
              </aside>
            </div>
          )}

          {panel === "sources" && (
            <div className="source-panel">
              <div className="section-title">
                <div><h3>Source documentation and data</h3><p>Every factual input keeps a source ID, status, and observation date.</p></div>
                <span className="version-pill">
                  {selected.address ? "Census match only" : "Synthetic data only"}
                </span>
              </div>
              <div className="source-list">
                {selected.evidence.map((source) => (
                  <article className="source-row" key={source.id}>
                    <div className="file-icon">▤</div>
                    <div>
                      <div className="source-title"><strong>{source.title}</strong><span className={`evidence-status ${source.status.toLowerCase()}`}>{source.status}</span></div>
                      <p>{source.detail}</p>
                      <small>{source.id} · Observed {source.observed}</small>
                    </div>
                    <button aria-label={`Open ${source.title}`}>↗</button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {panel === "assistant" && (
            <AskAiPanel
              key={`detail-${mapAiContext?.id ?? selected.id}`}
              context={mapAiContext}
              emptyTitle={`Ask about ${selected.name}`}
              emptyMessage="Select this candidate on the map to load its structured evidence context."
            />
          )}
        </section>
      )}

      {workspaceMode === "locations" && selectedClinic ? (
        <section className="detail-section" aria-labelledby="clinic-detail-title">
          <div className="detail-header">
            <div>
              <p className="eyebrow">Current location</p>
              <h2 id="clinic-detail-title">{selectedClinic.name}</h2>
              <p>{selectedClinic.address}</p>
              <div className="candidate-market-context">
                <span>
                  Parent market: <strong>CURRENT</strong>
                </span>
                <button
                  onClick={() => {
                    const marketId =
                      CURRENT_CLINIC_MARKET_IDS[selectedClinic.market];
                    if (marketId) {
                      chooseMarket(marketId);
                      setWorkspaceMode("markets");
                    }
                  }}
                >
                  Review market
                </button>
              </div>
            </div>
            <span
              className="workflow-status-chip current"
              style={{ "--status-color": "#087f75" } as React.CSSProperties}
            >
              Current
            </span>
          </div>
          <div className="current-location-detail">
            <div>
              <span>Location status</span>
              <strong>Current clinic</strong>
            </div>
            <div>
              <span>Evidence</span>
              <strong>Confirmed · SRC-009</strong>
            </div>
            <div>
              <span>Market prerequisite</span>
              <strong>Satisfied by Current market</strong>
            </div>
          </div>
          <p className="human-boundary">
            Public clinic presence does not establish performance, suitability,
            or approval for another candidate location.
          </p>
        </section>
      ) : null}

      {showAddressFlow ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeAddressFlow();
          }}
        >
          <section
            className="address-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-dialog-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">New proposed location</p>
                <h2 id="address-dialog-title">
                  {addressStatus === "confirm"
                    ? "Confirm the address match"
                    : "Enter a candidate address"}
                </h2>
              </div>
              <button
                className="dialog-close"
                aria-label="Close address entry"
                disabled={addressStatus === "resolving"}
                onClick={closeAddressFlow}
              >
                ×
              </button>
            </div>

            {addressStatus === "confirm" && addressMatch ? (
              <div className="address-confirmation">
                <div className="match-card">
                  <span className="match-label">Census-matched address</span>
                  <strong>{addressMatch.matchedAddress}</strong>
                  <small>
                    {addressMatch.latitude.toFixed(5)},{" "}
                    {addressMatch.longitude.toFixed(5)}
                  </small>
                </div>
                <div className="address-caveat">
                  <strong>Parent market</strong>
                  <p>
                    {scopedMarket
                      ? `${scopedMarket.cbsa_name} will be stored as a reviewer-confirmed, Hypothesis market assignment for this session.`
                      : "No market is selected. The location will remain unassigned and cannot be evaluated until its parent market is confirmed."}
                  </p>
                </div>
                <div className="address-caveat">
                  <strong>What you are confirming</strong>
                  <p>
                    This is the address you intended to evaluate. The match does
                    not confirm deliverability, an existing structure, lease
                    availability, or clinic suitability.
                  </p>
                </div>
                <div className="dialog-actions">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setAddressStatus("entry");
                      setAddressMatch(null);
                    }}
                  >
                    Edit address
                  </button>
                  <button
                    className="primary-button"
                    onClick={confirmProposedLocation}
                  >
                    Confirm proposed location
                  </button>
                </div>
              </div>
            ) : (
              <form className="address-form" onSubmit={resolveAddress}>
                <label>
                  Candidate name <span>Optional</span>
                  <input
                    value={candidateName}
                    onChange={(event) => setCandidateName(event.target.value)}
                    placeholder="Example: River District"
                    maxLength={80}
                  />
                </label>
                <label>
                  U.S. street address
                  <input
                    autoFocus
                    value={addressInput}
                    onChange={(event) => setAddressInput(event.target.value)}
                    placeholder="4600 Silver Hill Rd, Washington, DC 20233"
                    maxLength={240}
                    required
                  />
                </label>
                <div className="safe-address-note">
                  Use a synthetic, public, or otherwise approved address. Do not
                  enter a confidential pipeline address in this prototype.
                </div>
                {addressStatus === "error" ? (
                  <div className="address-error" role="alert">
                    {addressMessage}
                  </div>
                ) : null}
                <div className="dialog-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={addressStatus === "resolving"}
                    onClick={closeAddressFlow}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={addressStatus === "resolving"}
                  >
                    {addressStatus === "resolving"
                      ? "Matching address…"
                      : "Find address"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
