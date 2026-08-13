"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import {
  MAINLAND_MARKET_BOUNDS,
  PUBLIC_MARKET_MAX_FIT_ZOOM,
  resolveMapTilerConfig,
  selectedMarketBounds,
} from "@/lib/data/cbsa-market-map";
import { publicMarketMapGeoJson } from "@/lib/data/public-market-ui";
import type { CbsaAcsMetricKey } from "@/lib/data/cbsa-acs";
import type { GeographicFocus } from "@/lib/planning";
import { investigationLeadColor } from "@/lib/planning/lead-map";
import type { InvestigationLead } from "@/lib/planning/market-investigation";

const DEFAULT_STYLE_URL = "https://api.maptiler.com/maps/streets-v4/style.json";
const CBSA_SOURCE_ID = "review-focus-cbsa";
const CBSA_FILL_LAYER_ID = "review-focus-cbsa-fill";
const CBSA_OUTLINE_LAYER_ID = "review-focus-cbsa-outline";
const CBSA_SELECTED_LAYER_ID = "review-focus-cbsa-selected";
const CBSA_PERCENTILE_LAYER_ID = "review-focus-cbsa-percentile";
const CBSA_FINDING_LAYER_ID = "review-focus-cbsa-findings";

type PercentileBand = "all" | "top_1" | "top_5" | "top_10" | "bottom_10";

type GeographicFocusMapProps = {
  focus: GeographicFocus;
  modeLabel: string;
  contextMetric?: CbsaAcsMetricKey;
  findings?: InvestigationLead[];
  selectedLeadId?: string | null;
};

const METRIC_LABELS: Record<CbsaAcsMetricKey, string> = {
  total_population: "Population",
  household_count: "Households",
  median_household_income: "Median household income",
  housing_unit_count: "Housing units",
  population_density: "Population density",
};

function percentileFilter(metric: CbsaAcsMetricKey, band: PercentileBand, values: number[]): FilterSpecification {
  if (band === "all" || values.length === 0) return ["==", ["get", "cbsa_code"], ""] as FilterSpecification;
  const thresholdAt = (share: number) => values[Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * share)))];
  if (band === "bottom_10") return ["<=", ["get", metric], thresholdAt(0.1)] as FilterSpecification;
  const share = band === "top_1" ? 0.99 : band === "top_5" ? 0.95 : 0.9;
  return [">=", ["get", metric], thresholdAt(share)] as FilterSpecification;
}

function percentileRank(value: number, values: number[]) {
  const atOrBelow = values.filter((item) => item <= value).length;
  return Math.max(1, Math.round((atOrBelow / values.length) * 100));
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
  findings = [],
  selectedLeadId = null,
}: GeographicFocusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "basemap_unavailable">("loading");
  const [percentileBand, setPercentileBand] = useState<PercentileBand>("all");
  const metricValues = useMemo(() => publicMarketMapGeoJson.features
    .map((item) => item.properties[contextMetric])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right), [contextMetric]);
  const findingsGeoJson = useMemo(() => {
    const findingByCode = new Map<string, { id: string; index: number; title: string; color: string; memberCount: number }>();
    findings.forEach((finding, index) => {
      finding.marketIds.forEach((code) => {
        if (!findingByCode.has(code)) {
          findingByCode.set(code, {
            id: finding.id,
            index,
            title: finding.title,
            color: investigationLeadColor(index),
            memberCount: finding.marketIds.length,
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
            ...(finding ? {
              finding_id: finding.id,
              finding_index: finding.index,
              finding_title: finding.title,
              finding_color: finding.color,
              finding_member_count: finding.memberCount,
            } : {}),
          },
        };
      }),
    };
  }, [findings]);
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
    if (findings.length > 0) setPercentileBand("all");
  }, [findings.length]);

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
            filter: percentileFilter(contextMetric, "all", metricValues),
            paint: {
              "fill-color": "#f29d49",
              "fill-opacity": 0.38,
            },
          });
          map.addLayer({
            id: CBSA_FINDING_LAYER_ID,
            type: "fill",
            source: CBSA_SOURCE_ID,
            filter: ["has", "finding_index"] as FilterSpecification,
            paint: {
              "fill-color": ["get", "finding_color"],
              "fill-opacity": 0.58,
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
          setLoadState("ready");
        });
        map.on("mouseenter", CBSA_FILL_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", CBSA_FILL_LAYER_ID, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", CBSA_FILL_LAYER_ID, (event: MapLayerMouseEvent) => {
          const properties = event.features?.[0]?.properties;
          const value = Number(properties?.[contextMetric]);
          if (!properties) return;
          const popup = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = String(properties.cbsa_name ?? "Selected market");
          const detail = document.createElement("p");
          const findingIndex = Number(properties.finding_index);
          if (Number.isFinite(findingIndex)) {
            const finding = document.createElement("small");
            const memberCount = Number(properties.finding_member_count);
            finding.textContent = `Finding ${findingIndex + 1} · ${memberCount === 1 ? "individual market" : `${memberCount}-market pair`}`;
            finding.style.color = String(properties.finding_color ?? "#2f6bdb");
            finding.style.fontWeight = "800";
            popup.append(title, finding);
          } else {
            popup.append(title);
          }
          if (Number.isFinite(value)) {
            const percentile = percentileRank(value, metricValues);
            detail.textContent = `${METRIC_LABELS[contextMetric]}: ${formatMetricValue(contextMetric, value)} · ${percentile >= 50 ? `top ${101 - percentile}%` : `bottom ${percentile}%`} of markets`;
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
  }, [config, contextMetric, findingsGeoJson, interactiveEnabled, metricValues]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadState !== "ready" || !map.getLayer(CBSA_PERCENTILE_LAYER_ID)) return;
    map.setFilter(CBSA_PERCENTILE_LAYER_ID, percentileFilter(contextMetric, percentileBand, metricValues));
  }, [contextMetric, loadState, metricValues, percentileBand]);

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
      map.fitBounds(MAINLAND_MARKET_BOUNDS, { padding: 30, duration: 700 });
      const source = map.getSource(CBSA_SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(findingsGeoJson);
      return;
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
          <span>{findings.length ? "Findings map" : "Geographic focus"}</span>
          <strong>{findings.length ? `${findings.length} findings · ${findingMarketCount} markets` : focus.label}</strong>
          <small className="geographic-focus-evidence">
            Evidence status: {focus.evidenceStatus}
            {" · "}
            {sourceLabel(focus.source)}
          </small>
        </div>
        <div className="geographic-focus-controls">
          <small>{modeLabel}</small>
          <label>
            <span>{findings.length ? `${METRIC_LABELS[contextMetric]} context` : `${METRIC_LABELS[contextMetric]} range`}</span>
            <select value={percentileBand} onChange={(event) => setPercentileBand(event.target.value as PercentileBand)}>
              <option value="all">{findings.length ? "No context overlay" : "Selected lead only"}</option>
              <option value="top_1">Top 1%</option>
              <option value="top_5">Top 5%</option>
              <option value="top_10">Top 10%</option>
              <option value="bottom_10">Bottom 10%</option>
            </select>
          </label>
        </div>
      </div>
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
      {findings.length ? (
        <div className="geographic-focus-findings-legend" aria-label="Finding colors">
          {findings.map((finding, index) => (
            <span key={finding.id} className={finding.id === selectedLeadId ? "selected" : undefined}>
              <i style={{ background: investigationLeadColor(index) }} />
              Finding {index + 1}
              <small>{finding.marketIds.length === 1 ? "individual" : "pair"}</small>
            </span>
          ))}
        </div>
      ) : null}
      <p className="geographic-focus-note">{findings.length
        ? "Every finding is mapped. Markets in the same pair share a color; the selected finding has a stronger outline."
        : focus.message}</p>
      <small className="geographic-focus-provenance">
        Public CBSA context only (SRC-014 / SRC-015 / SRC-016). Geographic context map — not a score, ranking, or recommendation.
      </small>
    </section>
  );
}

function formatMetricValue(metric: CbsaAcsMetricKey, value: number) {
  if (metric === "median_household_income") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: metric === "population_density" ? 1 : 0 }).format(value);
}
