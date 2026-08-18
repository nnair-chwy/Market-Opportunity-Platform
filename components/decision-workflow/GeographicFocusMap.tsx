"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import {
  MAINLAND_MARKET_BOUNDS,
  PUBLIC_MARKET_MAX_FIT_ZOOM,
  resolveMapTilerConfig,
  selectedMarketBounds,
} from "@/lib/data/cbsa-market-map";
import { publicMarketMapGeoJson } from "@/lib/data/public-market-ui";
import type { CbsaAcsMetricKey } from "@/lib/data/cbsa-acs";
import type { AskAiResponse } from "@/lib/ai/insights";
import type { GeographicFocus } from "@/lib/planning";
import { investigationLeadColor } from "@/lib/planning/lead-map";
import type { InvestigationLead, MarketInvestigation } from "@/lib/planning/market-investigation";
import {
  workspaceSnapshotDatasetSchema,
  type WorkspaceSnapshotDataset,
  type WorkspaceSnapshotDatasetId,
} from "@/lib/perspectives/workspace-snapshot";

const DEFAULT_STYLE_URL = "https://api.maptiler.com/maps/streets-v4/style.json";
const CBSA_SOURCE_ID = "review-focus-cbsa";
const CBSA_FILL_LAYER_ID = "review-focus-cbsa-fill";
const CBSA_OUTLINE_LAYER_ID = "review-focus-cbsa-outline";
const CBSA_SELECTED_LAYER_ID = "review-focus-cbsa-selected";
const CBSA_PERCENTILE_LAYER_ID = "review-focus-cbsa-percentile";
const CBSA_FINDING_LAYER_ID = "review-focus-cbsa-findings";
const CBSA_FINDING_LABEL_LAYER_ID = "review-focus-cbsa-finding-labels";
const CBSA_INSPECTED_LAYER_ID = "review-focus-cbsa-inspected";

type PercentileBand = "all" | "top_1" | "top_5" | "top_10" | "bottom_10";

type GeographicFocusMapProps = {
  focus: GeographicFocus;
  modeLabel: string;
  contextMetric?: CbsaAcsMetricKey;
  measureOrigin?: "Confirmed question measure" | "Supporting context measure";
  findings?: InvestigationLead[];
  selectedLeadId?: string | null;
  onSelectFinding?: (finding: InvestigationLead) => void;
  questionContext?: string;
  sourceIds?: string[];
  regionScores?: Record<string, RegionEvaluationScore>;
  workspaceDatasetId?: WorkspaceSnapshotDatasetId | null;
  evidenceStage?: MarketInvestigation["evidenceStage"];
};

export type RegionEvaluationScore = {
  score: number;
  band: {
    label: string;
    range: string;
    meaning: string;
  };
  interpretation: string;
  evidenceStatus: "Confirmed" | "Reported" | "Derived" | "Hypothesis" | "Unknown";
  sourceIds: string[];
  calculationVersion: string;
};

type RangeMeaning = {
  label: string;
  range: string;
  meaning: string;
};

const METRIC_LABELS: Record<CbsaAcsMetricKey, string> = {
  total_population: "Population",
  household_count: "Households",
  median_household_income: "Median household income",
  housing_unit_count: "Housing units",
  population_density: "Population density",
};

function percentileFilter(metric: CbsaAcsMetricKey, band: PercentileBand, values: number[]): FilterSpecification {
  if (band === "all" || values.length === 0) return ["all", ["has", metric], ["!=", ["get", metric], null]] as FilterSpecification;
  const thresholdAt = (share: number) => values[Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * share)))];
  if (band === "bottom_10") return ["<=", ["get", metric], thresholdAt(0.1)] as FilterSpecification;
  const share = band === "top_1" ? 0.99 : band === "top_5" ? 0.95 : 0.9;
  return [">=", ["get", metric], thresholdAt(share)] as FilterSpecification;
}

function metricColorExpression(values: number[]) {
  const thresholdAt = (share: number) => values[Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * share)))] ?? 0;
  return [
    "interpolate", ["linear"], ["get", "__active_metric_value"],
    thresholdAt(0), "#edf4ff",
    thresholdAt(0.25), "#c9ddfa",
    thresholdAt(0.5), "#8db7ec",
    thresholdAt(0.75), "#4f87d5",
    thresholdAt(1), "#174e9a",
  ] as unknown as ExpressionSpecification;
}

function percentileRank(value: number, values: number[]) {
  const atOrBelow = values.filter((item) => item <= value).length;
  return Math.max(1, Math.round((atOrBelow / values.length) * 100));
}

function measureRange(percentile: number): RangeMeaning {
  if (percentile >= 81) return { label: "Higher range", range: "81st–100th percentile", meaning: "This measure is higher than it is in most metropolitan markets." };
  if (percentile >= 61) return { label: "Above typical", range: "61st–80th percentile", meaning: "This measure sits above the middle of the metropolitan-market distribution." };
  if (percentile >= 41) return { label: "Typical range", range: "41st–60th percentile", meaning: "This measure sits near the middle of the metropolitan-market distribution." };
  if (percentile >= 21) return { label: "Below typical", range: "21st–40th percentile", meaning: "This measure sits below the middle of the metropolitan-market distribution." };
  return { label: "Lower range", range: "1st–20th percentile", meaning: "This measure is lower than it is in most metropolitan markets." };
}

function focusFilter(codes: readonly string[]): FilterSpecification {
  return [
    "in",
    ["get", "cbsa_code"],
    ["literal", [...codes]],
  ] as FilterSpecification;
}

function sourceLabel(source: GeographicFocus["source"]) {
  switch (source) {
    case "question_geography":
      return "From question geography";
    case "evaluation_result":
      return "From evaluation result";
    case "action_plan":
      return "From action-plan geography";
    default:
      return "No reliable geography";
  }
}

export function GeographicFocusMap({
  focus,
  modeLabel,
  contextMetric = "household_count",
  measureOrigin = "Supporting context measure",
  findings = [],
  selectedLeadId = null,
  onSelectFinding,
  questionContext = "",
  sourceIds = ["SRC-016"],
  regionScores = {},
  workspaceDatasetId = null,
  evidenceStage = "signal",
}: GeographicFocusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "basemap_unavailable">("loading");
  const [percentileBand, setPercentileBand] = useState<PercentileBand>("all");
  const [filteredFindingId, setFilteredFindingId] = useState<string | null>(selectedLeadId);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string | null>(null);
  const [regionExplanation, setRegionExplanation] = useState<AskAiResponse | null>(null);
  const [regionExplanationState, setRegionExplanationState] = useState<"idle" | "loading" | "error">("idle");
  const [regionExplanationError, setRegionExplanationError] = useState<string | null>(null);
  const [workspaceDataset, setWorkspaceDataset] = useState<WorkspaceSnapshotDataset | null>(null);
  const previousSelectedLeadIdRef = useRef(selectedLeadId);
  useEffect(() => {
    if (!workspaceDatasetId) {
      setWorkspaceDataset(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/perspective-map-data/${workspaceDatasetId}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Snapshot unavailable")))
      .then((payload) => setWorkspaceDataset(workspaceSnapshotDatasetSchema.parse(payload)))
      .catch((error) => { if (!(error instanceof DOMException && error.name === "AbortError")) setWorkspaceDataset(null); });
    return () => controller.abort();
  }, [workspaceDatasetId]);
  const workspaceValueByCode = useMemo(
    () => new Map((workspaceDataset?.values ?? []).map((item) => [item.cbsaCode, item.rawValue])),
    [workspaceDataset],
  );
  const metricValues = useMemo(() => (workspaceDataset
    ? workspaceDataset.values.map((item) => item.rawValue)
    : publicMarketMapGeoJson.features.map((item) => item.properties[contextMetric])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)))
    .sort((left, right) => left - right), [contextMetric, workspaceDataset]);
  const activeMeasureLabel = workspaceDataset?.valueLabel ?? METRIC_LABELS[contextMetric];
  const activeSourceIds = workspaceDataset?.sourceIds ?? ["SRC-016"];
  const evidenceTerm = evidenceStage === "signal" ? "Signal" : "Finding";
  const formatActiveValue = (value: number) => workspaceDataset?.valueFormat === "currency"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
    : workspaceDataset?.valueFormat === "percent"
      ? `${value.toFixed(1)}%`
      : workspaceDataset ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value) : formatMetricValue(contextMetric, value);
  const findingsGeoJson = useMemo(() => {
    const findingByCode = new Map<string, { id: string; index: number; title: string; color: string; memberCount: number; memberLabel: string }>();
    findings.forEach((finding, index) => {
      finding.marketIds.forEach((code, marketIndex) => {
        if (!findingByCode.has(code)) {
          findingByCode.set(code, {
            id: finding.id,
            index,
            title: finding.title,
            color: investigationLeadColor(index),
            memberCount: finding.marketIds.length,
            memberLabel: String.fromCharCode(65 + marketIndex),
          });
        }
      });
    });
    return {
      ...publicMarketMapGeoJson,
      features: publicMarketMapGeoJson.features.map((feature) => {
        const finding = findingByCode.get(feature.properties.cbsa_code);
        return {
          ...feature,
          properties: {
            ...feature.properties,
            __active_metric_value: workspaceDataset
              ? workspaceValueByCode.get(feature.properties.cbsa_code) ?? null
              : feature.properties[contextMetric],
            ...(finding ? {
              finding_id: finding.id,
              finding_index: finding.index,
              finding_title: finding.title,
              finding_color: finding.color,
              finding_member_count: finding.memberCount,
              finding_member_label: finding.memberLabel,
            } : {}),
          },
        };
      }),
    };
  }, [contextMetric, findings, workspaceDataset, workspaceValueByCode]);
  const findingMarketCount = useMemo(() => new Set(findings.flatMap((finding) => finding.marketIds)).size, [findings]);
  const didInitializeFindingsRef = useRef(false);
  const config = useMemo(
    () => resolveMapTilerConfig(
      process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_STYLE_URL,
      process.env.NEXT_PUBLIC_MAPTILER_KEY,
    ),
    [],
  );
  const focusCbsaCodesRef = useRef(focus.cbsaCodes);
  focusCbsaCodesRef.current = focus.cbsaCodes;
  const interactiveEnabled = focus.state === "focused";

  useEffect(() => {
    if (findings.length > 0) {
      setPercentileBand("all");
      setFilteredFindingId(null);
    }
  }, [findings.length]);

  useEffect(() => {
    if (previousSelectedLeadIdRef.current === selectedLeadId) return;
    previousSelectedLeadIdRef.current = selectedLeadId;
    setFilteredFindingId(selectedLeadId);
  }, [selectedLeadId]);

  useEffect(() => {
    if (!interactiveEnabled) {
      mapRef.current?.remove();
      mapRef.current = null;
      setLoadState("basemap_unavailable");
      return;
    }
    if (config.status !== "configured") {
      setLoadState("basemap_unavailable");
      return;
    }
    if (!containerRef.current) {
      setLoadState("basemap_unavailable");
      return;
    }

    const styleUrl = config.styleUrl;
    let disposed = false;
    setLoadState("loading");

    async function initialize() {
      try {
        const { AttributionControl, Map, NavigationControl, Popup } = await import("maplibre-gl");
        if (disposed || !containerRef.current) return;

        const map = new Map({
          container: containerRef.current,
          style: styleUrl,
          bounds: MAINLAND_MARKET_BOUNDS,
          fitBoundsOptions: { padding: 36 },
          maxBounds: MAINLAND_MARKET_BOUNDS,
          maxZoom: PUBLIC_MARKET_MAX_FIT_ZOOM,
          renderWorldCopies: false,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new AttributionControl({ compact: true }), "bottom-right");

        map.once("load", () => {
          if (disposed) return;
          const initialFocus = focusCbsaCodesRef.current;
          map.addSource(CBSA_SOURCE_ID, {
            type: "geojson",
            data: findingsGeoJson,
          });
          map.addLayer({
            id: CBSA_FILL_LAYER_ID,
            type: "fill",
            source: CBSA_SOURCE_ID,
            paint: {
              "fill-color": "#c9d8ef",
              "fill-opacity": 0.12,
            },
          });
          map.addLayer({
            id: CBSA_OUTLINE_LAYER_ID,
            type: "line",
            source: CBSA_SOURCE_ID,
            paint: {
              "line-color": "#8ea3c4",
              "line-width": 0.35,
              "line-opacity": 0.35,
            },
          });
          map.addLayer({
            id: CBSA_PERCENTILE_LAYER_ID,
            type: "fill",
            source: CBSA_SOURCE_ID,
            filter: percentileFilter("__active_metric_value" as CbsaAcsMetricKey, "all", metricValues),
            paint: {
              "fill-color": metricColorExpression(metricValues),
              "fill-opacity": 0.56,
            },
          });
          map.addLayer({
            id: CBSA_FINDING_LAYER_ID,
            type: "fill",
            source: CBSA_SOURCE_ID,
            filter: ["has", "finding_index"] as FilterSpecification,
            paint: {
              "fill-color": ["get", "finding_color"],
              "fill-opacity": 0.16,
              "fill-outline-color": ["get", "finding_color"],
            },
          });
          map.addLayer({
            id: CBSA_SELECTED_LAYER_ID,
            type: "line",
            source: CBSA_SOURCE_ID,
            filter: initialFocus.length
              ? focusFilter(initialFocus)
              : (["==", ["get", "cbsa_code"], ""] as FilterSpecification),
            paint: {
              "line-color": ["coalesce", ["get", "finding_color"], "#173f7a"],
              "line-width": 3.25,
              "line-opacity": 1,
            },
          });
          map.addLayer({
            id: CBSA_INSPECTED_LAYER_ID,
            type: "line",
            source: CBSA_SOURCE_ID,
            filter: ["==", ["get", "cbsa_code"], ""] as FilterSpecification,
            paint: {
              "line-color": "#d8a414",
              "line-width": 4.5,
              "line-opacity": 1,
            },
          });
          map.addLayer({
            id: CBSA_FINDING_LABEL_LAYER_ID,
            type: "symbol",
            source: CBSA_SOURCE_ID,
            filter: ["has", "finding_index"] as FilterSpecification,
            layout: {
              "text-field": ["get", "finding_member_label"],
              "text-font": ["Open Sans Bold"],
              "text-size": 13,
              "text-allow-overlap": true,
            },
            paint: {
              "text-color": "#172842",
              "text-halo-color": "#ffffff",
              "text-halo-width": 2,
            },
          });
          setLoadState("ready");
        });
        map.on("mouseenter", CBSA_FILL_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", CBSA_FILL_LAYER_ID, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", CBSA_FILL_LAYER_ID, (event: MapLayerMouseEvent) => {
          const properties = event.features?.[0]?.properties;
          const value = Number(properties?.__active_metric_value);
          if (!properties) return;
          setSelectedRegionCode(String(properties.cbsa_code ?? ""));
          const popup = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = String(properties.cbsa_name ?? "Selected market");
          const detail = document.createElement("p");
          const findingIndex = Number(properties.finding_index);
          if (Number.isFinite(findingIndex)) {
            const finding = document.createElement("small");
            const memberCount = Number(properties.finding_member_count);
            finding.textContent = `${evidenceTerm} ${findingIndex + 1} · ${memberCount === 1 ? "individual market" : `${memberCount}-market pair`}`;
            finding.style.color = String(properties.finding_color ?? "#2f6bdb");
            finding.style.fontWeight = "800";
            popup.append(title, finding);
            const lead = findings[findingIndex];
            if (lead) {
              const interpretation = document.createElement("p");
              interpretation.textContent = lead.observation;
              popup.append(interpretation);
            }
          } else {
            popup.append(title);
          }
          if (Number.isFinite(value)) {
            const percentile = percentileRank(value, metricValues);
            detail.textContent = `${activeMeasureLabel}: ${formatActiveValue(value)} · ${percentile >= 50 ? `top ${101 - percentile}%` : `bottom ${percentile}%`} of markets`;
            popup.append(detail);
          } else {
            detail.textContent = "No compatible value is available for this market.";
            popup.append(detail);
          }
          new Popup({ closeButton: true, offset: 8 }).setLngLat(event.lngLat).setDOMContent(popup).addTo(map);
        });
        map.on("error", () => {
          if (!disposed) setLoadState("basemap_unavailable");
        });
      } catch {
        if (!disposed) setLoadState("basemap_unavailable");
      }
    }

    void initialize();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [activeMeasureLabel, config, contextMetric, evidenceTerm, findingsGeoJson, interactiveEnabled, metricValues, workspaceDataset]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadState !== "ready" || !map.getLayer(CBSA_PERCENTILE_LAYER_ID)) return;
    map.setFilter(CBSA_PERCENTILE_LAYER_ID, percentileFilter("__active_metric_value" as CbsaAcsMetricKey, percentileBand, metricValues));
  }, [loadState, metricValues, percentileBand]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadState !== "ready" || !map.getLayer(CBSA_FINDING_LAYER_ID)) return;
    const filter = filteredFindingId
      ? (["==", ["get", "finding_id"], filteredFindingId] as FilterSpecification)
      : (["has", "finding_index"] as FilterSpecification);
    map.setFilter(CBSA_FINDING_LAYER_ID, filter);
    if (map.getLayer(CBSA_FINDING_LABEL_LAYER_ID)) map.setFilter(CBSA_FINDING_LABEL_LAYER_ID, filter);
  }, [filteredFindingId, loadState]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadState !== "ready" || !map.getLayer(CBSA_INSPECTED_LAYER_ID)) return;
    map.setFilter(
      CBSA_INSPECTED_LAYER_ID,
      selectedRegionCode
        ? (["==", ["get", "cbsa_code"], selectedRegionCode] as FilterSpecification)
        : (["==", ["get", "cbsa_code"], ""] as FilterSpecification),
    );
  }, [loadState, selectedRegionCode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadState !== "ready" || focus.state !== "focused") return;

    const selected = map.getLayer(CBSA_SELECTED_LAYER_ID);
    if (selected) {
      map.setFilter(
        CBSA_SELECTED_LAYER_ID,
        focus.cbsaCodes.length
          ? focusFilter(focus.cbsaCodes)
          : (["==", ["get", "cbsa_code"], ""] as FilterSpecification),
      );
    }

    if (findings.length > 0 && !didInitializeFindingsRef.current) {
      didInitializeFindingsRef.current = true;
      const source = map.getSource(CBSA_SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(findingsGeoJson);
      if (!selectedLeadId) {
        map.fitBounds(MAINLAND_MARKET_BOUNDS, { padding: 30, duration: 700 });
        return;
      }
    }

    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const code of focus.cbsaCodes) {
      const bounds = selectedMarketBounds(publicMarketMapGeoJson, code);
      if (!bounds) continue;
      west = Math.min(west, bounds[0][0]);
      south = Math.min(south, bounds[0][1]);
      east = Math.max(east, bounds[1][0]);
      north = Math.max(north, bounds[1][1]);
    }
    if ([west, south, east, north].every(Number.isFinite)) {
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 48, duration: 700, maxZoom: PUBLIC_MARKET_MAX_FIT_ZOOM },
      );
    }

    const source = map.getSource(CBSA_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(findingsGeoJson);
  }, [findings.length, findingsGeoJson, focus.cbsaCodes, focus.state, loadState, selectedLeadId]);

  const geographyFallback = focus.state === "fallback";
  const basemapFallback = interactiveEnabled && loadState === "basemap_unavailable";
  const selectedFinding = findings.find((finding) => finding.id === filteredFindingId)
    ?? findings.find((finding) => finding.id === selectedLeadId)
    ?? null;
  const selectedFindingNumber = selectedFinding
    ? findings.findIndex((finding) => finding.id === selectedFinding.id) + 1
    : null;
  const selectedRegionFeature = selectedRegionCode
    ? publicMarketMapGeoJson.features.find((feature) => feature.properties.cbsa_code === selectedRegionCode)
    : null;
  const selectedRegionValue = selectedRegionCode
    ? workspaceDataset ? workspaceValueByCode.get(selectedRegionCode) : selectedRegionFeature?.properties[contextMetric]
    : undefined;
  const selectedRegionPercentile = typeof selectedRegionValue === "number"
    ? percentileRank(selectedRegionValue, metricValues)
    : null;
  const selectedRegionFinding = selectedRegionCode
    ? findings.find((finding) => finding.marketIds.includes(selectedRegionCode)) ?? null
    : null;
  const selectedRegionScore = selectedRegionCode ? regionScores[selectedRegionCode] ?? null : null;
  const selectedRegionRange = selectedRegionPercentile === null ? null : measureRange(selectedRegionPercentile);

  useEffect(() => {
    setRegionExplanation(null);
    setRegionExplanationState("idle");
    setRegionExplanationError(null);
  }, [contextMetric, questionContext, selectedRegionCode]);

  async function explainSelectedRegion() {
    if (!selectedRegionFeature || selectedRegionPercentile === null || typeof selectedRegionValue !== "number" || regionExplanationState === "loading") return;
    const regionName = selectedRegionFeature.properties.cbsa_name;
    const compatibleSourceIds = [...new Set([...activeSourceIds, ...sourceIds, ...(selectedRegionScore?.sourceIds ?? [])])];
    const insights = [
      {
        title: `${activeMeasureLabel} position`,
        detail: `${regionName} has ${formatActiveValue(selectedRegionValue)} for ${activeMeasureLabel.toLowerCase()} and sits at the ${selectedRegionPercentile}th percentile among metropolitan markets. ${selectedRegionRange?.label}: ${selectedRegionRange?.meaning}`,
        status: "Derived" as const,
        sourceIds: activeSourceIds,
        tone: "neutral" as const,
      },
      ...(selectedRegionScore ? [{
        title: `Approved evaluation score: ${selectedRegionScore.score}`,
        detail: `${selectedRegionScore.band.label} (${selectedRegionScore.band.range}). ${selectedRegionScore.band.meaning} Analyst interpretation: ${selectedRegionScore.interpretation}`,
        status: selectedRegionScore.evidenceStatus,
        sourceIds: selectedRegionScore.sourceIds,
        tone: "neutral" as const,
      }] : [{
        title: "Evaluation score not calculated",
        detail: "This investigation is not authorized to calculate an attractiveness score. The percentile describes the active measure only and is not a market recommendation.",
        status: "Confirmed" as const,
        sourceIds: [] as string[],
        tone: "caution" as const,
      }]),
      ...(selectedRegionFinding ? [{
        title: selectedRegionFinding.title,
        detail: `${selectedRegionFinding.observation} Why it matters: ${selectedRegionFinding.businessMeaning} Validation boundary: ${selectedRegionFinding.challenge} Next evidence: ${selectedRegionFinding.nextEvidence}`,
        status: "Derived" as const,
        sourceIds: compatibleSourceIds,
        tone: "neutral" as const,
      }] : []),
    ];

    setRegionExplanationState("loading");
    setRegionExplanationError(null);
    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: `Using the confirmed question as context, explain what stands out about ${regionName}, what its ${selectedRegionScore ? "score band" : "measure range"} means, and what should be validated next.`,
          context: {
            id: `region-${selectedRegionFeature.properties.cbsa_code}`,
            kind: "location",
            title: regionName,
            subtitle: questionContext || `Review ${regionName} in the current investigation`,
            overview: `Question context: ${questionContext || "No additional question context supplied."}`,
            insights,
            warnings: ["Do not convert the active-measure percentile into an attractiveness score or recommendation."],
            limitations: [selectedRegionFinding?.challenge ?? "No question-compatible finding was retained for this region."],
            suggestedQuestions: [],
          },
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || typeof payload !== "object" || payload === null || !("answer" in payload)) {
        const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "The region explanation could not be generated.";
        throw new Error(message);
      }
      setRegionExplanation(payload as AskAiResponse);
      setRegionExplanationState("idle");
    } catch (error) {
      setRegionExplanationState("error");
      setRegionExplanationError(error instanceof Error ? error.message : "The region explanation could not be generated.");
    }
  }

  return (
    <section
      className="geographic-focus-map"
      aria-label="Geographic focus map"
      data-focus-state={focus.state}
      data-focus-source={focus.source}
      data-evidence-status={focus.evidenceStatus}
    >
      <div className="geographic-focus-toolbar">
        <div>
          <span>{findings.length ? "Answer map" : "Geographic focus"}</span>
          <strong>{selectedFinding ? selectedFinding.title : findings.length ? `${findings.length} ${evidenceTerm.toLowerCase()}s · ${findingMarketCount} markets` : focus.label}</strong>
          <small className="geographic-focus-evidence">
            {measureOrigin}: {activeMeasureLabel}
            {" · "}
            Evidence status: {focus.evidenceStatus}
            {" · "}
            {sourceLabel(focus.source)}
          </small>
        </div>
        <div className="geographic-focus-controls">
          <small>{modeLabel}</small>
          <label>
            <span>{findings.length ? `${activeMeasureLabel} context` : `${activeMeasureLabel} range`}</span>
            <select value={percentileBand} onChange={(event) => setPercentileBand(event.target.value as PercentileBand)}>
              <option value="all">All markets</option>
              <option value="top_1">Top 1%</option>
              <option value="top_5">Top 5%</option>
              <option value="top_10">Top 10%</option>
              <option value="bottom_10">Bottom 10%</option>
            </select>
          </label>
        </div>
      </div>
      <div className="geographic-focus-scale" aria-label={`${activeMeasureLabel} color scale`}>
        <span>Lower {activeMeasureLabel.toLowerCase()}</span><i /><span>Higher {activeMeasureLabel.toLowerCase()}</span>
        <small>Blue intensity shows the active measure. Yellow outline shows the region opened for analysis.</small>
      </div>
      {selectedFinding ? (
        <section className="geographic-focus-answer" aria-label={`Selected ${evidenceTerm.toLowerCase()} shown on the map`} data-answer-visual="selected-finding">
          <div>
            <span>{evidenceTerm} {selectedFindingNumber} shown</span>
            <strong>{selectedFinding.observation}</strong>
          </div>
          <p><b>Why it matters</b>{selectedFinding.businessMeaning}</p>
          <small>Markets are labeled A/B in the same order used by the {evidenceTerm.toLowerCase()}. Select another {evidenceTerm.toLowerCase()} below to redraw the answer.</small>
        </section>
      ) : null}
      <div
        className="geographic-focus-frame"
        data-map-frame={geographyFallback || basemapFallback ? "fallback" : "focused"}
      >
        {geographyFallback ? (
          <div
            className="geographic-focus-fallback"
            aria-label="Geographic focus unavailable fallback map"
            data-fallback-reason="unreliable_geography"
          >
            <img src="/us-map.svg" alt="" aria-hidden="true" />
            <div className="geographic-focus-fallback-banner" role="status">
              <strong>No reliable geographic focus</strong>
              <span>Context map withheld rather than inventing a location.</span>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              className="geographic-focus-maplibre"
              hidden={basemapFallback}
              role="region"
              aria-label="Focused geographic context map"
            />
            {basemapFallback ? (
              <div
                className="geographic-focus-fallback"
                aria-label="Basemap unavailable fallback"
                data-fallback-reason="basemap_unavailable"
              >
                <img src="/us-map.svg" alt="" aria-hidden="true" />
                <div className="geographic-focus-fallback-banner" role="status">
                  <strong>Interactive basemap unavailable</strong>
                  <span>
                    Focus remains {focus.label}. No substitute market was invented.
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      {selectedRegionFeature ? (
        <section className="geographic-region-analysis" aria-live="polite" aria-label="Selected region analysis">
          <header>
            <div><span>Region analysis</span><strong>{selectedRegionFeature.properties.cbsa_name}</strong></div>
            <div className="geographic-region-analysis-actions">
              <button className="geographic-region-explain" type="button" onClick={() => void explainSelectedRegion()} disabled={regionExplanationState === "loading"}>
                {regionExplanationState === "loading" ? "Explaining…" : regionExplanation ? "Explain again" : "Tell me more"}
              </button>
              <button type="button" onClick={() => setSelectedRegionCode(null)} aria-label="Close region analysis">×</button>
            </div>
          </header>
          <div className="geographic-region-analysis-grid">
            <div><span>Evaluation score</span><b>{selectedRegionScore ? `${selectedRegionScore.score} · ${selectedRegionScore.band.label}` : "Not calculated"}</b><small>{selectedRegionScore ? `${selectedRegionScore.band.range} · ${selectedRegionScore.calculationVersion}` : "This investigation is not authorized to score market attractiveness."}</small></div>
            <div><span>{activeMeasureLabel} range</span><b>{selectedRegionRange?.label ?? "Unavailable"}</b><small>{typeof selectedRegionValue === "number" ? `${formatActiveValue(selectedRegionValue)} · ${selectedRegionRange?.range} · ${activeSourceIds.join(" · ")}` : "No compatible value or percentile"}{selectedRegionRange ? ` ${selectedRegionRange.meaning}` : ""}</small></div>
            <div><span>Analyst interpretation</span><b>{selectedRegionFinding?.title ?? `Not retained as a ${evidenceTerm.toLowerCase()}`}</b><small>{selectedRegionFinding?.observation ?? `This region is visible for measure context, but the investigation did not retain a question-compatible ${evidenceTerm.toLowerCase()} for it.`}</small></div>
            <div><span>Decision boundary</span><b>{selectedRegionFinding ? "Investigation lead" : "Context only"}</b><small>{selectedRegionFinding?.challenge ?? "The active measure alone does not support an attractiveness or business recommendation."}</small></div>
          </div>
          {regionExplanation ? (
            <div className="geographic-region-explanation" data-region-explanation="ready">
              <span>AI explanation · Draft for review</span>
              {regionExplanation.items.map((item, index) => <p key={`${item.question ?? "answer"}-${index}`}>{item.answer}<small>{item.evidenceStatus}{item.sourceIds.length ? ` · ${item.sourceIds.join(" · ")}` : " · No source loaded"}</small></p>)}
              {regionExplanation.limitations.length ? <small>Limitation: {regionExplanation.limitations.join(" ")}</small> : null}
            </div>
          ) : null}
          {regionExplanationError ? <p className="geographic-region-explanation-error" role="alert">{regionExplanationError}</p> : null}
        </section>
      ) : null}
      {findings.length ? (
        <div className="geographic-focus-findings-legend" aria-label="Finding colors">
          {findings.map((finding, index) => (
            <button
              key={finding.id}
              type="button"
              className={finding.id === filteredFindingId ? "selected" : undefined}
              aria-pressed={finding.id === filteredFindingId}
              onClick={() => {
                if (finding.id === filteredFindingId) {
                  setFilteredFindingId(null);
                  return;
                }
                setFilteredFindingId(finding.id);
                onSelectFinding?.(finding);
              }}
            >
              <i style={{ background: investigationLeadColor(index) }} />
              {evidenceTerm} {index + 1}
              <small>{finding.marketIds.length === 1 ? "individual" : "pair"}</small>
            </button>
          ))}
        </div>
      ) : null}
      <p className="geographic-focus-note">{findings.length
        ? filteredFindingId
          ? `The map is focused on ${evidenceTerm} ${findings.findIndex((finding) => finding.id === filteredFindingId) + 1}. Select it again to show every retained ${evidenceTerm.toLowerCase()}.`
          : `Every retained ${evidenceTerm.toLowerCase()} is mapped. Select one to turn it into the active visual answer.`
        : focus.message}</p>
      <small className="geographic-focus-provenance">
        {workspaceDataset
          ? `${workspaceDataset.label} (${workspaceDataset.sourceIds.join(" / ")}; ${workspaceDataset.snapshotId}). Descriptive evidence — not a score, ranking, or recommendation.`
          : "Public CBSA context only (SRC-014 / SRC-015 / SRC-016). Geographic context map — not a score, ranking, or recommendation."}
      </small>
    </section>
  );
}

function formatMetricValue(metric: CbsaAcsMetricKey, value: number) {
  if (metric === "median_household_income") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: metric === "population_density" ? 1 : 0 }).format(value);
}
