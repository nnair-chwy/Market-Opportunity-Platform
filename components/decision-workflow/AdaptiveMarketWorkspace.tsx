"use client";

import { useEffect, useMemo, useState } from "react";
import { UnifiedEvaluatorMap } from "@/components/UnifiedEvaluatorMap";
import {
  PUBLIC_MARKET_METRICS,
  publicMarketMapGeoJson,
  publicMarkets,
} from "@/lib/data/public-market-ui";
import { resolveMapTilerConfig } from "@/lib/data/cbsa-market-map";
import type { CbsaAcsMetricKey } from "@/lib/data/cbsa-acs";
import type { WorkspaceSnapshotDataset } from "@/lib/perspectives/workspace-snapshot";
import { compare_cohort, DETERMINISTIC_OPERATOR_VERSION } from "@/lib/evaluation-operators";
import { currentClinics } from "@/lib/locations/map-data";
import type { UnifiedMapLocation } from "@/lib/locations/unified-map";
import {
  APPROVED_MAP_LAYER_IDS,
  MAX_COMPARISON_REGIONS,
  appendComparisonRegion,
  assertMeasureIsolation,
  assertNoHiddenLayerScore,
  buildComparisonFingerprint,
  canAddRegionToComparison,
  clearComparisonRegions,
  createDefaultLayerVisibility,
  formatNullableMeasureValue,
  getDefaultView,
  layerVisibilityChangesScoringInputs,
  listApprovedMapLayers,
  preserveMissingNumeric,
  removeComparisonRegion,
  resolveLayerForPresentation,
  resolveMapPresentation,
  type ApprovedMapLayerId,
  type MapViewMode,
  type PerspectiveView,
} from "@/lib/perspectives";
import {
  CURRENT_CLINIC_MARKET_IDS,
  INITIAL_MARKET_WORKFLOW_RECORDS,
  currentMarketIds,
  marketCategoryMap,
  matchesWorkflowCategory,
  type WorkflowCategory,
} from "@/lib/workflow/market-workflow";

const mapConfig = resolveMapTilerConfig(
  process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  process.env.NEXT_PUBLIC_MAPTILER_KEY,
);

function formatValue(value: number | null, metric: CbsaAcsMetricKey) {
  return formatNullableMeasureValue(value, (finite) => {
    if (metric === "median_household_income") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(finite);
    }
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: metric === "population_density" ? 1 : 0,
    }).format(finite);
  });
}

function percentilePhrase(percentile: number | undefined) {
  if (percentile === undefined) return "No comparable-market percentile is available.";
  if (percentile >= 80) return `It is in the higher range at percentile ${percentile.toFixed(1)}.`;
  if (percentile <= 20) return `It is in the lower range at percentile ${percentile.toFixed(1)}.`;
  return `It is near the middle of measured markets at percentile ${percentile.toFixed(1)}.`;
}

function measureInterpretation(input: {
  viewId: PerspectiveView["viewId"];
  formattedValue: string;
  percentile: number | undefined;
  contributingGeographies: number | null;
  clinicCount: number;
}) {
  const position = percentilePhrase(input.percentile);
  const coverage = input.contributingGeographies === null
    ? ""
    : ` across ${input.contributingGeographies.toLocaleString()} mapped postal ${input.contributingGeographies === 1 ? "area" : "areas"}`;
  switch (input.viewId) {
    case "clinic_footprint":
      return `${input.clinicCount} published CVC ${input.clinicCount === 1 ? "clinic is" : "clinics are"} mapped to this metro. This is footprint presence—not capacity, access, performance, or whitespace.`;
    case "household_demand":
      return `${input.formattedValue} households live in this metro. ${position} Household count describes market scale; it does not estimate pet-owning households or clinic demand.`;
    case "market_expansion_context":
      return `The metro has ${input.formattedValue} residents per square mile. ${position} Density describes market concentration, not expansion attractiveness.`;
    case "competitor_availability":
      return `${input.formattedValue} of monitored competitor offer rows were recorded as available${coverage}. ${position} This reflects the monitored sample, not complete market availability.`;
    case "observed_equalized_price":
      return `Observed competitor offers averaged ${input.formattedValue} after package-size equalization${coverage}. ${position} A same-SKU Chewy benchmark is not joined here, so this view cannot yet calculate how much competitors are above or below Chewy.`;
    case "offer_observation_volume":
      return `${input.formattedValue} competitor offer rows were observed${coverage}. ${position} This measures monitoring depth—not demand or competitor share.`;
    case "assortment_breadth":
      return `${input.formattedValue} distinct-SKU observations were recorded${coverage}. ${position} SKUs can repeat across geography and competitor rows, so this is observed breadth rather than complete local assortment.`;
    case "paid_search_response":
      return `${input.formattedValue} paid-search clicks were attributed to this metro${coverage}. ${position} Click volume closely follows delivery scale in this snapshot; use click-through rate to judge response independent of impressions.`;
    case "paid_search_impressions":
      return `${input.formattedValue} paid-search impressions were attributed to this metro${coverage}. ${position} This is delivery volume—not unique reach or response efficiency.`;
    case "paid_search_ctr":
      return `${input.formattedValue} of delivered impressions resulted in clicks${coverage}. ${position} This is platform response efficiency, not conversion quality or incrementality.`;
    case "paid_search_cpc":
      return `The account paid ${input.formattedValue} per click on average in this metro${coverage}. ${position} Compare conversion and commercial outcomes before treating higher cost as overspend.`;
    default:
      return `${input.formattedValue} is the active regional measure. ${position}`;
  }
}

const clinicLocations: readonly UnifiedMapLocation[] = currentClinics.map((clinic) => ({
  id: clinic.id,
  marketId: CURRENT_CLINIC_MARKET_IDS[clinic.market] ?? null,
  name: clinic.name,
  market: clinic.market,
  city: clinic.city,
  state: clinic.state,
  latitude: clinic.latitude,
  longitude: clinic.longitude,
  category: "current",
  evidenceStatus: "Confirmed",
  sourceId: "SRC-009",
  statusLabel: "Confirmed public clinic; coordinates derived from its public address",
  address: clinic.address,
}));

type AdaptiveMarketWorkspaceProps = {
  initialMetric?: CbsaAcsMetricKey;
  initialSelectedCode?: string | null;
  initialComparisonCodes?: readonly string[];
  selectionPrompt?: string | null;
  opening?: boolean;
  metric?: CbsaAcsMetricKey;
  onMetricChange?: (metric: CbsaAcsMetricKey) => void;
  includeMicropolitan?: boolean;
  onIncludeMicropolitanChange?: (value: boolean) => void;
  category?: WorkflowCategory;
  onCategoryChange?: (category: WorkflowCategory) => void;
  activeView?: PerspectiveView;
  comparisonView?: PerspectiveView | null;
  mapMode?: MapViewMode;
  showLayerManager?: boolean;
};

export function AdaptiveMarketWorkspace({
  initialMetric = "total_population",
  initialSelectedCode = null,
  initialComparisonCodes = [],
  selectionPrompt = null,
  opening = false,
  metric: controlledMetric,
  onMetricChange,
  includeMicropolitan: controlledIncludeMicropolitan,
  onIncludeMicropolitanChange,
  category: controlledCategory,
  onCategoryChange,
  activeView,
  comparisonView = null,
  mapMode = "single",
  showLayerManager = false,
}: AdaptiveMarketWorkspaceProps) {
  const [metricState, setMetricState] = useState<CbsaAcsMetricKey>(initialMetric);
  const [includeMicropolitanState, setIncludeMicropolitanState] = useState(false);
  const [categoryState, setCategoryState] = useState<WorkflowCategory>("all");
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState(initialSelectedCode ?? "");
  const [comparisonCodes, setComparisonCodes] = useState<string[]>(() => [...initialComparisonCodes]);
  const [layerVisibility, setLayerVisibility] = useState(createDefaultLayerVisibility);
  const [unsupportedLayerMessage, setUnsupportedLayerMessage] = useState<string | null>(null);
  const [swipePercent, setSwipePercent] = useState(50);
  const [mapHelpOpen, setMapHelpOpen] = useState(false);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<WorkspaceSnapshotDataset | null>(null);
  const [workspaceSnapshotState, setWorkspaceSnapshotState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [comparisonWorkspaceSnapshot, setComparisonWorkspaceSnapshot] = useState<WorkspaceSnapshotDataset | null>(null);

  const presentation = useMemo(() => {
    const view = activeView ?? getDefaultView("cvc");
    assertMeasureIsolation(view.activeMeasure, view.perspectiveId);
    return resolveMapPresentation(view);
  }, [activeView]);
  const comparisonPresentation = useMemo(
    () => (comparisonView ? resolveMapPresentation(comparisonView) : null),
    [comparisonView],
  );

  useEffect(() => {
    const binding = presentation.mapBinding;
    if (binding.kind !== "workspace_snapshot") {
      setWorkspaceSnapshot(null);
      setWorkspaceSnapshotState("idle");
      return;
    }
    const controller = new AbortController();
    setWorkspaceSnapshot(null);
    setWorkspaceSnapshotState("loading");
    fetch(`/api/perspective-map-data/${binding.datasetId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("snapshot unavailable");
        return response.json() as Promise<WorkspaceSnapshotDataset>;
      })
      .then((snapshot) => {
        setWorkspaceSnapshot(snapshot);
        setWorkspaceSnapshotState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setWorkspaceSnapshotState("unavailable");
      });
    return () => controller.abort();
  }, [presentation.mapBinding]);

  useEffect(() => {
    const binding = comparisonPresentation?.mapBinding;
    if (binding?.kind !== "workspace_snapshot") {
      setComparisonWorkspaceSnapshot(null);
      return;
    }
    const controller = new AbortController();
    setComparisonWorkspaceSnapshot(null);
    fetch(`/api/perspective-map-data/${binding.datasetId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("comparison snapshot unavailable");
        return response.json() as Promise<WorkspaceSnapshotDataset>;
      })
      .then(setComparisonWorkspaceSnapshot)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setComparisonWorkspaceSnapshot(null);
      });
    return () => controller.abort();
  }, [comparisonPresentation?.mapBinding]);

  const censusMetric =
    presentation.mapBinding.kind === "census_percentile"
      ? presentation.mapBinding.censusMetric
      : controlledMetric ?? metricState;
  const metric = censusMetric;
  const includeMicropolitan = controlledIncludeMicropolitan ?? includeMicropolitanState;
  const category = controlledCategory ?? categoryState;
  const presentationReady =
    presentation.evidenceAvailability === "available" &&
    presentation.mapBinding.kind !== "unavailable";
  const mapReady = presentationReady && (
    presentation.mapBinding.kind !== "workspace_snapshot" || workspaceSnapshotState === "ready"
  );
  const showCensusChoropleth =
    mapReady &&
    presentation.mapBinding.kind === "census_percentile" &&
    layerVisibility.active_measure;
  const showWorkspaceChoropleth =
    mapReady &&
    presentation.mapBinding.kind === "workspace_snapshot" &&
    Boolean(workspaceSnapshot) &&
    layerVisibility.active_measure;
  const showActiveChoropleth = showCensusChoropleth || showWorkspaceChoropleth;
  const showClinicOverlay =
    presentation.mapBinding.kind === "clinic_locations" ||
    Boolean(layerVisibility.current_locations && presentation.supportsLayerMode);
  const compareEnabled = mapMode === "compare" && presentation.supportsComparison;

  function setMetric(value: CbsaAcsMetricKey) {
    setMetricState(value);
    onMetricChange?.(value);
  }

  function setIncludeMicropolitan(value: boolean) {
    setIncludeMicropolitanState(value);
    onIncludeMicropolitanChange?.(value);
  }

  function setCategory(value: WorkflowCategory) {
    setCategoryState(value);
    onCategoryChange?.(value);
  }

  const categories = useMemo(
    () =>
      marketCategoryMap(
        publicMarkets.map((market) => market.cbsa_code),
        currentMarketIds(currentClinics.map((clinic) => clinic.market)),
        INITIAL_MARKET_WORKFLOW_RECORDS,
      ),
    [],
  );

  const cohort = useMemo(
    () =>
      publicMarkets.filter(
        (market) =>
          (includeMicropolitan || market.cbsa_type === "metropolitan") &&
          matchesWorkflowCategory(categories[market.cbsa_code] ?? "unclassified", category),
      ),
    [categories, category, includeMicropolitan],
  );

  const cohortId = `${includeMicropolitan ? "all" : "metropolitan"}-${category}`;
  const comparisonVintage =
    presentation.mapBinding.kind === "census_percentile"
      ? "acs-2024-5yr"
      : presentation.mapBinding.kind === "clinic_locations"
        ? "public-clinic-directory"
        : presentation.mapBinding.kind === "workspace_snapshot"
          ? workspaceSnapshot?.snapshotId ?? "workspace-snapshot-loading"
          : "unavailable";
  const activeFingerprint = useMemo(
    () =>
      buildComparisonFingerprint({
        presentation,
        geographyGrain: activeView?.geographyGrain ?? "cbsa",
        vintage: comparisonVintage,
        cohortId,
      }),
    [activeView?.geographyGrain, cohortId, comparisonVintage, presentation],
  );

  const comparisons = useMemo(() => {
    const binding = presentation.mapBinding;
    if (!showActiveChoropleth) {
      return [];
    }
    assertMeasureIsolation(presentation.measureId, presentation.perspectiveId);
    const workspaceValues = new Map(
      workspaceSnapshot?.values.map((item) => [item.cbsaCode, item.rawValue]) ?? [],
    );
    const entities = cohort.flatMap((market) => {
      const raw = binding.kind === "census_percentile"
        ? preserveMissingNumeric(market.acs?.metrics[binding.censusMetric].raw_value)
        : binding.kind === "workspace_snapshot"
          ? preserveMissingNumeric(workspaceValues.get(market.cbsa_code))
          : null;
      return raw === null
        ? []
        : [
            {
              entityId: market.cbsa_code,
              cohortId,
              value: raw,
              provenance: {
                sourceIds: [...presentation.sourceIds],
                inputVersion: binding.kind === "workspace_snapshot"
                  ? workspaceSnapshot?.snapshotId ?? "workspace-snapshot"
                  : "acs-2024-5yr",
                transformationVersion: binding.kind === "workspace_snapshot"
                  ? workspaceSnapshot?.transformationVersion ?? "workspace-snapshot-v1"
                  : "public-percentile-v1",
              },
            },
          ];
    });
    if (!entities.length) return [];
    return compare_cohort({
      operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
      decisionLayer: "market_attractiveness",
      comparisonVersion: binding.kind === "workspace_snapshot"
        ? `${binding.datasetId}-${workspaceSnapshot?.transformationVersion ?? "v1"}`
        : `public-census-${binding.kind === "census_percentile" ? binding.censusMetric : "unknown"}-v1`,
      cohortId,
      direction: "higher_is_better",
      entities,
    });
  }, [
    cohort,
    cohortId,
    presentation.mapBinding,
    presentation.measureId,
    presentation.perspectiveId,
    showActiveChoropleth,
    workspaceSnapshot,
  ]);

  const viewComparisonScores = useMemo(() => {
    const binding = comparisonPresentation?.mapBinding;
    if (
      mapMode !== "single" ||
      !comparisonPresentation ||
      comparisonPresentation.evidenceAvailability !== "available" ||
      (binding?.kind !== "census_percentile" && binding?.kind !== "workspace_snapshot") ||
      (binding.kind === "workspace_snapshot" && !comparisonWorkspaceSnapshot)
    ) {
      return null;
    }
    assertMeasureIsolation(
      comparisonPresentation.measureId,
      comparisonPresentation.perspectiveId,
    );
    const comparisonWorkspaceValues = new Map(
      comparisonWorkspaceSnapshot?.values.map((item) => [item.cbsaCode, item.rawValue]) ?? [],
    );
    const entities = cohort.flatMap((market) => {
      const raw = binding.kind === "census_percentile"
        ? preserveMissingNumeric(market.acs?.metrics[binding.censusMetric].raw_value)
        : preserveMissingNumeric(comparisonWorkspaceValues.get(market.cbsa_code));
      return raw === null
        ? []
        : [{
            entityId: market.cbsa_code,
            cohortId,
            value: raw,
            provenance: {
              sourceIds: [...comparisonPresentation.sourceIds],
              inputVersion: binding.kind === "workspace_snapshot"
                ? comparisonWorkspaceSnapshot?.snapshotId ?? "workspace-snapshot"
                : "acs-2024-5yr",
              transformationVersion: binding.kind === "workspace_snapshot"
                ? comparisonWorkspaceSnapshot?.transformationVersion ?? "workspace-snapshot-v1"
                : "public-percentile-v1",
            },
          }];
    });
    if (!entities.length) return {};
    const compared = compare_cohort({
      operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
      decisionLayer: "market_attractiveness",
      comparisonVersion: binding.kind === "workspace_snapshot"
        ? `${binding.datasetId}-${comparisonWorkspaceSnapshot?.transformationVersion ?? "v1"}`
        : `public-census-${binding.censusMetric}-v1`,
      cohortId,
      direction: "higher_is_better",
      entities,
    });
    return Object.fromEntries(compared.map((item) => [item.entityId, item.percentile]));
  }, [cohort, cohortId, comparisonPresentation, comparisonWorkspaceSnapshot, mapMode]);
  const viewComparisonEnabled = Boolean(
    comparisonPresentation &&
    viewComparisonScores &&
    presentation.mapBinding.kind === comparisonPresentation.mapBinding.kind &&
    (presentation.mapBinding.kind === "census_percentile" || presentation.mapBinding.kind === "workspace_snapshot"),
  );

  const scores = useMemo(
    () =>
      showActiveChoropleth
        ? Object.fromEntries(comparisons.map((item) => [item.entityId, item.percentile]))
        : {},
    [comparisons, showActiveChoropleth],
  );
  const ranks = useMemo(
    () => new Map(comparisons.map((item) => [item.entityId, item.rank])),
    [comparisons],
  );
  const visibleCodes = useMemo(
    () => new Set(cohort.map((market) => market.cbsa_code)),
    [cohort],
  );
  const activeSelectedCode =
    selectedCode && visibleCodes.has(selectedCode) ? selectedCode : "";
  const selected = publicMarkets.find((market) => market.cbsa_code === activeSelectedCode) ?? null;
  const selectedPercentile = showActiveChoropleth
    ? scores[activeSelectedCode]
    : undefined;
  const selectedRank = ranks.get(activeSelectedCode);
  const workspaceObservationByCode = useMemo(
    () => new Map(workspaceSnapshot?.values.map((item) => [item.cbsaCode, item]) ?? []),
    [workspaceSnapshot],
  );
  const workspaceValueByCode = useMemo(
    () => new Map([...workspaceObservationByCode].map(([code, item]) => [code, item.rawValue])),
    [workspaceObservationByCode],
  );
  const selectedRaw = presentation.mapBinding.kind === "workspace_snapshot"
    ? preserveMissingNumeric(workspaceValueByCode.get(activeSelectedCode))
    : preserveMissingNumeric(selected?.acs?.metrics[metric].raw_value);
  const selectedValue = selectedRaw;
  const metricOption = presentation.mapBinding.kind === "workspace_snapshot"
    ? { key: metric, label: workspaceSnapshot?.valueLabel ?? presentation.legend.title }
    : PUBLIC_MARKET_METRICS.find((item) => item.key === metric) ?? PUBLIC_MARKET_METRICS[0];
  const formatActiveValue = (value: number | null) => {
    if (presentation.mapBinding.kind !== "workspace_snapshot") return formatValue(value, metric);
    if (value === null) return "Unavailable";
    if (presentation.mapBinding.valueFormat === "percent") return `${value.toFixed(1)}%`;
    if (presentation.mapBinding.valueFormat === "currency") {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  };
  const selectedClinicCount = clinicLocations.filter((location) => location.marketId === activeSelectedCode).length;
  const selectedMeasureLabel = presentation.viewId === "clinic_footprint"
    ? "Published CVC clinics"
    : metricOption.label;
  const selectedFormattedValue = presentation.viewId === "clinic_footprint"
    ? selectedClinicCount.toLocaleString()
    : showActiveChoropleth
      ? formatActiveValue(selectedValue)
      : mapReady
        ? "Context only"
        : "Unavailable";
  const selectedInterpretation = selected
    ? measureInterpretation({
        viewId: presentation.viewId,
        formattedValue: selectedFormattedValue,
        percentile: selectedPercentile,
        contributingGeographies: workspaceObservationByCode.get(activeSelectedCode)?.contributingGeographies ?? null,
        clinicCount: selectedClinicCount,
      })
    : null;
  const marketDetailByCode = Object.fromEntries(cohort.map((market) => {
    const code = market.cbsa_code;
    const observation = workspaceObservationByCode.get(code);
    const rawValue = presentation.mapBinding.kind === "workspace_snapshot"
      ? preserveMissingNumeric(observation?.rawValue)
      : preserveMissingNumeric(market.acs?.metrics[metric].raw_value);
    const clinicCount = clinicLocations.filter((location) => location.marketId === code).length;
    const formattedValue = presentation.viewId === "clinic_footprint"
      ? clinicCount.toLocaleString()
      : formatActiveValue(rawValue);
    return [code, {
      valueLabel: presentation.viewId === "clinic_footprint" ? "Published CVC clinics" : metricOption.label,
      formattedValue,
      interpretation: measureInterpretation({
        viewId: presentation.viewId,
        formattedValue,
        percentile: scores[code],
        contributingGeographies: observation?.contributingGeographies ?? null,
        clinicCount,
      }),
    }];
  }));
  const comparisonMarkets = comparisonCodes.flatMap((code) => {
    const market = publicMarkets.find((item) => item.cbsa_code === code);
    const rawValue = presentation.mapBinding.kind === "workspace_snapshot"
      ? preserveMissingNumeric(workspaceValueByCode.get(code))
      : preserveMissingNumeric(market?.acs?.metrics[metric].raw_value);
    return market
      ? [
          {
            code,
            name: market.cbsa_name,
            rawValue,
            percentile: scores[code],
            rank: ranks.get(code),
          },
        ]
      : [];
  });
  const listed = cohort
    .filter((market) =>
      `${market.cbsa_name} ${market.cbsa_code}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort(
      (left, right) =>
        (ranks.get(left.cbsa_code) ?? Number.MAX_SAFE_INTEGER) -
        (ranks.get(right.cbsa_code) ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, 100);

  const candidateFingerprint = presentation.supportsComparison
    ? activeFingerprint
    : null;
  const comparisonEligibility = canAddRegionToComparison({
    regionId: activeSelectedCode,
    selectedRegionIds: comparisonCodes,
    activeFingerprint,
    candidateFingerprint,
  });

  function addSelected() {
    if (!compareEnabled || !comparisonEligibility.allowed || !activeSelectedCode) {
      return;
    }
    setComparisonCodes((current) => appendComparisonRegion(current, activeSelectedCode));
  }

  function toggleLayer(layerId: ApprovedMapLayerId) {
    const resolved = resolveLayerForPresentation(layerId, presentation);
    if ("status" in resolved) {
      setUnsupportedLayerMessage(resolved.reason);
      return;
    }
    setUnsupportedLayerMessage(null);
    setLayerVisibility((current) => {
      const next = { ...current, [layerId]: !current[layerId] };
      if (layerVisibilityChangesScoringInputs(current, next)) {
        return current;
      }
      return next;
    });
  }

  const approvedLayers = listApprovedMapLayers();
  assertNoHiddenLayerScore(approvedLayers);
  const layerEntries = APPROVED_MAP_LAYER_IDS.map((layerId) => {
    const resolved = resolveLayerForPresentation(layerId, presentation);
    return { layerId, resolved, enabled: layerVisibility[layerId] };
  });

  const scoreLabel = presentation.legend.title;
  const scoreBoundary = presentation.evidenceBoundary;
  const scoreMetadata = {
    configurationVersion: showWorkspaceChoropleth
      ? workspaceSnapshot?.transformationVersion ?? "workspace-snapshot-v1"
      : showCensusChoropleth
        ? "public-percentile-v1"
        : presentation.evidenceAvailability,
    configurationFingerprint: presentation.sourceIds.join(" · "),
  };
  const comparisonStatus = compareEnabled
    ? `${comparisonCodes.length} of ${MAX_COMPARISON_REGIONS} regions selected · up to five regions`
    : "Comparison mode is off";

  const secondaryMetric =
    comparisonPresentation?.mapBinding.kind === "census_percentile"
      ? comparisonPresentation.mapBinding.censusMetric
      : null;
  const secondaryMetricOption = secondaryMetric
    ? PUBLIC_MARKET_METRICS.find((item) => item.key === secondaryMetric) ?? null
    : null;
  const comparisonWorkspaceValueByCode = useMemo(
    () => new Map(comparisonWorkspaceSnapshot?.values.map((item) => [item.cbsaCode, item.rawValue]) ?? []),
    [comparisonWorkspaceSnapshot],
  );
  const secondarySelectedValue = comparisonPresentation?.mapBinding.kind === "workspace_snapshot"
    ? preserveMissingNumeric(comparisonWorkspaceValueByCode.get(activeSelectedCode))
    : secondaryMetric
      ? preserveMissingNumeric(selected?.acs?.metrics[secondaryMetric].raw_value)
      : null;
  const secondaryLabel = comparisonPresentation?.mapBinding.kind === "workspace_snapshot"
    ? comparisonWorkspaceSnapshot?.valueLabel ?? comparisonPresentation.legend.title
    : secondaryMetricOption?.label ?? comparisonPresentation?.legend.title ?? "View B";
  const formatSecondaryValue = (value: number | null) => {
    const binding = comparisonPresentation?.mapBinding;
    if (binding?.kind !== "workspace_snapshot") {
      return secondaryMetric ? formatValue(value, secondaryMetric) : "Unavailable";
    }
    if (value === null) return "Unavailable";
    if (binding.valueFormat === "percent") return `${value.toFixed(1)}%`;
    if (binding.valueFormat === "currency") {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  };
  const comparisonMarketDetailByCode = comparisonPresentation
    ? Object.fromEntries(cohort.map((market) => {
        const code = market.cbsa_code;
        const observation = comparisonWorkspaceSnapshot?.values.find((item) => item.cbsaCode === code);
        const rawValue = comparisonPresentation.mapBinding.kind === "workspace_snapshot"
          ? preserveMissingNumeric(observation?.rawValue)
          : secondaryMetric
            ? preserveMissingNumeric(market.acs?.metrics[secondaryMetric].raw_value)
            : null;
        const formattedValue = formatSecondaryValue(rawValue);
        return [code, {
          valueLabel: secondaryLabel,
          formattedValue,
          interpretation: measureInterpretation({
            viewId: comparisonPresentation.viewId,
            formattedValue,
            percentile: viewComparisonScores?.[code],
            contributingGeographies: observation?.contributingGeographies ?? null,
            clinicCount: clinicLocations.filter((location) => location.marketId === code).length,
          }),
        }];
      }))
    : {};
  const comparisonAnchor = comparisonMarkets[0] ?? null;
  const comparisonLeader = comparisonMarkets.reduce<(typeof comparisonMarkets)[number] | null>(
    (leader, market) =>
      market.percentile !== undefined &&
      (leader?.percentile === undefined || market.percentile > leader.percentile)
        ? market
        : leader,
    null,
  );
  const optionalLayerEntries = layerEntries.filter(
    ({ layerId }) =>
      layerId === "workflow_category" ||
      (layerId === "current_locations" &&
        presentation.mapBinding.kind !== "clinic_locations") ||
      layerId === "non_scored_unavailable",
  );
  const mapVisibleCodes = layerVisibility.non_scored_unavailable
    ? visibleCodes
    : new Set([...visibleCodes].filter((code) => scores[code] !== undefined));
  const visibleCategories = layerVisibility.workflow_category ? categories : {};

  return (
    <section
      className={`adaptive-market-workspace ${opening ? "opening-market-surface" : ""}`}
      aria-labelledby="adaptive-map-title"
      data-perspective={presentation.perspectiveId}
      data-view={presentation.viewId}
      data-measure={presentation.measureId}
      data-map-mode={mapMode}
      data-evidence-availability={presentation.evidenceAvailability}
      data-allowed-use={presentation.allowedUse}
      data-scoring-eligibility={presentation.scoringEligibility}
    >
      <header className="adaptive-map-header">
        <div>
          <span className="eyebrow">Interactive evidence map</span>
          <h2 id="adaptive-map-title">{presentation.mapTitle}</h2>
          <p>{presentation.sourceLabel}</p>
        </div>
        <div className="adaptive-map-controls">
          {presentation.mapBinding.kind === "workspace_snapshot" ? (
            <label>
              Measure
              <select value={presentation.mapBinding.datasetId} disabled>
                <option value={presentation.mapBinding.datasetId}>{metricOption.label}</option>
              </select>
            </label>
          ) : showCensusChoropleth || presentation.mapBinding.kind === "census_percentile" ? (
            <label>
              Measure
              <select
                value={metric}
                onChange={(event) => setMetric(event.target.value as CbsaAcsMetricKey)}
                disabled={Boolean(activeView)}
              >
                {PUBLIC_MARKET_METRICS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Workflow
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as WorkflowCategory);
                setComparisonCodes(clearComparisonRegions());
              }}
            >
              {["all", "current", "potential", "evaluated"].map((item) => (
                <option key={item} value={item}>
                  {item[0].toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="adaptive-check">
            <input
              type="checkbox"
              checked={includeMicropolitan}
              onChange={(event) => {
                setIncludeMicropolitan(event.target.checked);
                setComparisonCodes(clearComparisonRegions());
              }}
            />
            Include micropolitan
          </label>
        </div>
      </header>

      {opening ? (
        <div className="adaptive-opening-info-stack" aria-label="Map context help">
          <div className="adaptive-opening-disclosure">
            <button
              className="adaptive-map-help-trigger"
              type="button"
              aria-label={mapHelpOpen ? "Hide map context and legend" : "Show map context and legend"}
              aria-expanded={mapHelpOpen}
              aria-controls="adaptive-opening-map-help"
              onClick={() => setMapHelpOpen((open) => !open)}
            >?</button>
            {mapHelpOpen ? <div id="adaptive-opening-map-help" className="adaptive-opening-help-panel">
            <div className="adaptive-opening-map-chrome" role="status">
              <strong id="adaptive-opening-map-title">{presentation.mapTitle}</strong>
              <span>{presentation.sourceLabel}</span>
              {workspaceSnapshot ? (
                <small className="adaptive-snapshot-coverage">
                  {workspaceSnapshot.coverage.mappedCbsaCount} CBSAs · {Math.round(workspaceSnapshot.coverage.mappedValueShare * 100)}% of source value mapped · {workspaceSnapshot.transformationVersion}
                </small>
              ) : null}
              {mapMode === "single" && selected ? (
                <dl className="adaptive-single-summary" data-view-a-mode="single">
                  <div>
                    <dt>Active region</dt>
                    <dd>{selected.cbsa_name}</dd>
                  </div>
                  <div>
                    <dt>{viewComparisonEnabled ? "View A · " : ""}{selectedMeasureLabel}</dt>
                    <dd>{selectedFormattedValue}</dd>
                  </div>
                  {viewComparisonEnabled && comparisonPresentation ? (
                    <div className="adaptive-single-secondary-value">
                      <dt>View B · {secondaryLabel}</dt>
                      <dd>{formatSecondaryValue(secondarySelectedValue)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Percentile</dt>
                    <dd>
                      {selectedPercentile === undefined
                        ? showActiveChoropleth
                          ? "Unavailable"
                          : "Not scored"
                        : selectedPercentile.toFixed(1)}
                    </dd>
                  </div>
                  <div>
                    <dt>Rank</dt>
                    <dd>
                      {showActiveChoropleth && selectedRank
                        ? `${selectedRank} of ${comparisons.length}`
                        : "Unavailable"}
                    </dd>
                  </div>
                </dl>
              ) : null}
              {mapMode === "single" && !selected && !viewComparisonEnabled ? (
                <small className="adaptive-map-prompt">Click a market to see its value, percentile, rank, and evidence source.</small>
              ) : null}
              {mapMode === "single" && selected ? (
                <small className="adaptive-percentile-disclaimer">
                  {viewComparisonEnabled
                    ? "Selecting a market updates both views. It does not add the market to Compare regions."
                    : "Percentile is market context only — not an opportunity score or recommendation."}
                </small>
              ) : null}
              {mapMode === "single" && viewComparisonEnabled && !selected ? (
                <small className="adaptive-map-prompt">
                  Drag the divider to compare View A and View B. Click a market to inspect both values.
                </small>
              ) : null}
            </div>
            <div className="workflow-map-legend market-score-legend adaptive-opening-context-legend" aria-label={`${scoreLabel} legend`}>
              <strong>{scoreLabel}</strong>
              {presentation.legend.showGradient ? <>
                <div className="market-score-gradient" aria-hidden="true" />
                <div className="market-score-scale"><span>{presentation.legend.lowLabel}</span><span>{presentation.legend.midLabel}</span><span>{presentation.legend.highLabel}</span></div>
              </> : null}
              <div>
                <i className="adaptive-not-scored-swatch" />
                {presentation.legend.unscoredLabel}
              </div>
              <small>{scoreMetadata.configurationVersion} · {scoreMetadata.configurationFingerprint}</small>
              <small>{scoreBoundary}</small>
            </div>
            </div> : null}
          </div>
        </div>
      ) : null}

      {opening && mapMode === "compare" && !showLayerManager ? (
        <div
          className="adaptive-view-a-panel adaptive-compare-panel"
          data-view-a-mode="compare"
          aria-label="Compare regions"
        >
          <div className="adaptive-compare-intent">
            <span className="eyebrow">Compare the same evidence</span>
            <strong>See how selected regions differ</strong>
            <p>
              Every region uses {metricOption.label.toLowerCase()}, the same source,
              vintage, and market cohort. This comparison does not choose a winner.
            </p>
          </div>
          <ol className="adaptive-compare-steps" aria-label="How to compare regions">
            <li data-complete={Boolean(activeSelectedCode)}>
              <b>1</b><span>Click a region to preview it.</span>
            </li>
            <li data-complete={comparisonCodes.length > 0}>
              <b>2</b><span>Add the previewed region to the set.</span>
            </li>
            <li data-complete={comparisonCodes.length >= 2}>
              <b>3</b><span>Add at least two regions to see differences.</span>
            </li>
          </ol>
          <div className="adaptive-compare-status" aria-live="polite">
            <strong>
              {comparisonCodes.length < 2
                ? `${2 - comparisonCodes.length} more region${comparisonCodes.length === 1 ? "" : "s"} needed`
                : `Comparison ready · ${comparisonCodes.length} of ${MAX_COMPARISON_REGIONS}`}
            </strong>
            <span>Minimum 2 · maximum 5 · kept in selection order</span>
          </div>
          <div className="adaptive-compare-chips" role="list">
            {comparisonMarkets.map((market, index) => (
              <div
                key={market.code}
                role="listitem"
                className={
                  activeSelectedCode === market.code
                    ? "adaptive-compare-chip active"
                    : "adaptive-compare-chip"
                }
              >
                <button type="button" onClick={() => setSelectedCode(market.code)}>
                  <span>{index + 1}. {market.name}</span>
                  <b>{market.percentile === undefined ? "—" : market.percentile.toFixed(1)}</b>
                </button>
                <button
                  type="button"
                  className="adaptive-compare-remove"
                  aria-label={`Remove ${market.name} from comparison`}
                  onClick={() => {
                    setComparisonCodes((current) =>
                      removeComparisonRegion(current, market.code),
                    );
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ))}
          </div>
          <div className="adaptive-compare-actions">
            <button
              type="button"
              className="primary-action"
              onClick={addSelected}
              disabled={!comparisonEligibility.allowed}
            >
              {selected ? `Add ${selected.cbsa_name}` : "Select a region on the map"}
            </button>
            <button
              type="button"
              onClick={() => setComparisonCodes(clearComparisonRegions())}
              disabled={!comparisonCodes.length}
            >
              Clear comparison
            </button>
          </div>
          {!comparisonEligibility.allowed && comparisonEligibility.reason ? (
            <small role="status">{comparisonEligibility.reason}</small>
          ) : null}
          {selected && comparisonEligibility.allowed ? (
            <small role="status">
              {selected.cbsa_name} is previewed, not added yet. Use the button above to add it.
            </small>
          ) : null}
          {comparisonMarkets.length >= 2 ? (
            <div className="adaptive-compare-result" aria-live="polite">
              <div>
                <span className="eyebrow">Result</span>
                <strong>
                  {comparisonLeader
                    ? `${comparisonLeader.name} has the highest ${metricOption.label.toLowerCase()} percentile in this set.`
                    : "The selected regions are ready for review."}
                </strong>
                <small>
                  This result describes one measure only. It is not an opportunity score or recommendation.
                </small>
              </div>
              <div className="adaptive-compare-table" role="table" aria-label="Regional comparison result">
                <div role="row" className="adaptive-compare-table-head">
                  <span role="columnheader">Region</span>
                  <span role="columnheader">Value</span>
                  <span role="columnheader">Pct.</span>
                  <span role="columnheader">vs. first</span>
                </div>
                {comparisonMarkets.map((market, index) => {
                  const difference =
                    market.percentile === undefined || comparisonAnchor?.percentile === undefined
                      ? null
                      : market.percentile - comparisonAnchor.percentile;
                  return (
                    <div role="row" key={market.code}>
                      <span role="cell">{index + 1}. {market.name}</span>
                      <span role="cell">{formatActiveValue(market.rawValue)}</span>
                      <span role="cell">{market.percentile?.toFixed(1) ?? "—"}</span>
                      <span role="cell">
                        {difference === null ? "—" : index === 0 ? "Baseline" : `${difference > 0 ? "+" : ""}${difference.toFixed(1)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {opening && showLayerManager ? (
        <div
          className="adaptive-view-a-panel adaptive-layer-panel"
          id="adaptive-map-layer-manager"
          data-layer-manager="true"
          aria-label="Map layers"
        >
          <div className="adaptive-layer-heading">
            <span className="eyebrow">Map display</span>
            <strong>Map layers</strong>
            <p>Add context around the primary measure. Layers never blend into a score.</p>
          </div>
          <div className="adaptive-primary-layer">
            <span className="adaptive-layer-symbol measure" aria-hidden="true" />
            <div>
              <small>Primary measure · always on</small>
              <strong>{metricOption.label}</strong>
            </div>
          </div>
          <ul className="adaptive-layer-list">
            {optionalLayerEntries.map(({ layerId, resolved, enabled }) => {
              if ("status" in resolved) {
                return (
                  <li key={layerId} data-layer-id={layerId}>
                    <label>
                      <input
                        type="checkbox"
                        checked={false}
                        disabled
                        onChange={() => toggleLayer(layerId)}
                      />
                      <span>Unavailable overlay</span>
                    </label>
                    <small className="adaptive-layer-unsupported" role="status">
                      {resolved.reason}
                    </small>
                  </li>
                );
              }
              const layer = resolved;
              return (
                <li key={layerId} data-layer-id={layerId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleLayer(layerId)}
                    />
                    <span className={`adaptive-layer-symbol ${layerId}`} aria-hidden="true" />
                    <span>{layer.label}</span>
                  </label>
                  <small className="adaptive-layer-description">{layer.legendLabel}</small>
                  <details className="adaptive-layer-meta">
                    <summary>Source details</summary>
                    <span>{layer.sourceIds.join(" · ")} · {layer.vintage}</span>
                    <span>{layer.evidenceStatus} · context only</span>
                    <small>{layer.evidenceBoundary}</small>
                  </details>
                </li>
              );
            })}
          </ul>
          {unsupportedLayerMessage ? (
            <small className="adaptive-layer-unsupported" role="status">
              {unsupportedLayerMessage}
            </small>
          ) : null}
          <small data-hidden-score="false">Showing or hiding a layer changes the map display only—not calculations, rankings, or conclusions.</small>
        </div>
      ) : null}

      {!mapReady ? (
        <div className="adaptive-view-unavailable" role="status" aria-live="polite">
          <strong>{workspaceSnapshotState === "loading" ? "Loading approved local snapshot" : presentation.emptyState.title}</strong>
          <p>{workspaceSnapshotState === "loading" ? "Preparing the source-linked regional view without filling missing markets." : presentation.emptyState.message}</p>
          <small>{presentation.evidenceBoundary}</small>
        </div>
      ) : null}

      <UnifiedEvaluatorMap
        config={mapConfig}
        collection={publicMarketMapGeoJson}
        visibleMarketCodes={mapVisibleCodes}
        selectedMarketCode={activeSelectedCode}
        comparisonMarkets={compareEnabled ? comparisonMarkets : []}
        comparisonAddEligibility={{
          allowed: compareEnabled && comparisonEligibility.allowed,
          reason: !compareEnabled
            ? "Switch to Compare mode to build a comparison set."
            : comparisonEligibility.reason,
        }}
        comparisonStatus={comparisonStatus}
        workspaceMode="markets"
        marketCategories={visibleCategories}
        marketScores={scores}
        marketScoreMetadata={scoreMetadata}
        marketScoreLabel={scoreLabel}
        marketScoreBoundary={scoreBoundary}
        marketDetailByCode={marketDetailByCode}
        hideLegend={opening}
        secondaryMarketScores={viewComparisonScores}
        secondaryMarketScoreLabel={
          viewComparisonEnabled ? comparisonPresentation?.legend.title ?? null : null
        }
        secondaryMarketDetailByCode={comparisonMarketDetailByCode}
        swipePercent={swipePercent}
        onSwipePercentChange={setSwipePercent}
        locations={showClinicOverlay ? clinicLocations : []}
        selectedLocationId={null}
        onChooseMarket={setSelectedCode}
        onAddMarketToComparison={addSelected}
        onRemoveMarketFromComparison={(code) =>
          setComparisonCodes((current) => removeComparisonRegion(current, code))
        }
        onClearMarketComparison={() => setComparisonCodes(clearComparisonRegions())}
        onOpenMarketComparison={() =>
          document.getElementById("adaptive-market-detail")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
        onChooseLocation={() => undefined}
        onReset={() => setSelectedCode("")}
      />

      <div className="adaptive-market-detail" id="adaptive-market-detail">
        <aside>
          <label>
            Find a market
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or CBSA code"
            />
          </label>
          <div className="adaptive-market-list" role="listbox" aria-label="Ranked market list">
            {listed.map((market) => (
              <button
                key={market.cbsa_code}
                type="button"
                role="option"
                aria-selected={activeSelectedCode === market.cbsa_code}
                className={activeSelectedCode === market.cbsa_code ? "active" : ""}
                onClick={() => setSelectedCode(market.cbsa_code)}
              >
                <span>
                  <strong>{market.cbsa_name}</strong>
                  <small>CBSA {market.cbsa_code}</small>
                </span>
                <b>
                  {scores[market.cbsa_code] === undefined
                    ? "—"
                    : scores[market.cbsa_code].toFixed(1)}
                </b>
              </button>
            ))}
          </div>
        </aside>
        <article data-selected-market-detail="true">
          {selected ? (
            <>
              <span className="eyebrow">Selected market</span>
              <h3>{selected.cbsa_name}</h3>
              <dl>
                <div>
                  <dt>{selectedMeasureLabel}</dt>
                  <dd>{selectedFormattedValue}</dd>
                </div>
                <div>
                  <dt>Percentile</dt>
                  <dd>
                    {selectedPercentile === undefined
                      ? showActiveChoropleth
                        ? "Unavailable"
                        : "Not scored"
                      : selectedPercentile.toFixed(1)}
                  </dd>
                </div>
                <div>
                  <dt>Rank</dt>
                  <dd>
                    {showActiveChoropleth && selectedRank
                      ? `${selectedRank} of ${comparisons.length}`
                      : "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>
                    {presentation.evidenceAvailability === "available"
                      ? `${presentation.sourceLabel}`
                      : presentation.emptyState.title}
                  </dd>
                </div>
              </dl>
              {selectedInterpretation ? (
                <section className="adaptive-measure-reading" aria-label="Selected measure interpretation">
                  <strong>What this measure says</strong>
                  <p>{selectedInterpretation}</p>
                </section>
              ) : null}
              {compareEnabled ? (
                <button
                  className="primary-action"
                  type="button"
                  onClick={addSelected}
                  disabled={!comparisonEligibility.allowed}
                >
                  Add to comparison
                </button>
              ) : null}
              <p className="adaptive-boundary">{presentation.evidenceBoundary}</p>
              <p className="adaptive-percentile-disclaimer">
                Percentile is market context only — not an opportunity score or recommendation.
              </p>
            </>
          ) : (
            <p>{selectionPrompt ?? "Select a visible market on the map or list."}</p>
          )}
        </article>
        <article data-comparison-detail="true">
          <span className="eyebrow">Comparison set</span>
          <h3>
            {comparisonMarkets.length
              ? `${comparisonMarkets.length} of ${MAX_COMPARISON_REGIONS} regions`
              : "No regions added"}
          </h3>
          <p>Up to five regions · preserved in analyst selection order</p>
          {comparisonMarkets.map((market) => (
            <button
              className="adaptive-compare-row"
              type="button"
              key={market.code}
              onClick={() => setSelectedCode(market.code)}
            >
              <span>{market.name}</span>
              <b>
                {scores[market.code] === undefined ? "—" : scores[market.code].toFixed(1)}
              </b>
              <i
                role="button"
                tabIndex={0}
                aria-label={`Remove ${market.name} from comparison`}
                onClick={(event) => {
                  event.stopPropagation();
                  setComparisonCodes((current) =>
                    removeComparisonRegion(current, market.code),
                  );
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    setComparisonCodes((current) =>
                      removeComparisonRegion(current, market.code),
                    );
                  }
                }}
              >
                ×
              </i>
            </button>
          ))}
          <button
            type="button"
            disabled={!comparisonCodes.length}
            onClick={() => setComparisonCodes(clearComparisonRegions())}
          >
            Clear comparison
          </button>
        </article>
      </div>
    </section>
  );
}
