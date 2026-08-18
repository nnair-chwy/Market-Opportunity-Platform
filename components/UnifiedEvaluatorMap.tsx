"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoCentroid, geoPath } from "d3-geo";
import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import {
  isKeyboardSelectionKey,
} from "@/lib/data/cbsa-market-context";
import {
  MAINLAND_MARKET_BOUNDS,
  PUBLIC_MARKET_MAX_FIT_ZOOM,
  selectedMarketBounds,
  type PublicBasemapConfig,
  type PublicMarketMapFeatureCollection,
} from "@/lib/data/cbsa-market-map";
import {
  locationsToGeoJson,
  unifiedLocationAriaLabel,
  type UnifiedLocationCategory,
  type UnifiedMapLocation,
} from "@/lib/locations/unified-map";
import {
  MARKET_SCORE_COLORS,
  MARKET_SCORE_FILL_OPACITY,
  marketScoreColor,
  marketScoreMatchExpression,
  type MarketComparisonEligibility,
} from "@/lib/market-attractiveness";
import {
  WORKFLOW_CATEGORY_COLORS,
  type MarketCategory,
} from "@/lib/workflow/market-workflow";
import type { SeattleIllustrativeOverlay } from "@/lib/seattle-market-deep-dive/geometry";

const CBSA_SOURCE_ID = "unified-public-cbsa";
const CBSA_FILL_LAYER_ID = "unified-public-cbsa-fill";
const CBSA_OUTLINE_LAYER_ID = "unified-public-cbsa-outline";
const CBSA_COMPARISON_LAYER_ID = "unified-public-cbsa-comparison";
const CBSA_SELECTED_LAYER_ID = "unified-public-cbsa-selected";
const SECONDARY_CBSA_SOURCE_ID = "unified-secondary-public-cbsa";
const SECONDARY_CBSA_FILL_LAYER_ID = "unified-secondary-public-cbsa-fill";
const SECONDARY_CBSA_OUTLINE_LAYER_ID = "unified-secondary-public-cbsa-outline";
const SEATTLE_OVERLAY_SOURCE_ID = "seattle-illustrative-submarkets";
const SEATTLE_AREA_FILL_LAYER_ID = "seattle-illustrative-area-fill";
const SEATTLE_AREA_LINE_LAYER_ID = "seattle-illustrative-area-line";
const SEATTLE_HUB_LAYER_ID = "seattle-illustrative-hub";
const SEATTLE_HUB_NUMBER_LAYER_ID = "seattle-illustrative-hub-number";
const SEATTLE_HUB_LABEL_LAYER_ID = "seattle-illustrative-hub-label";
const LOCATION_SOURCE_IDS: Record<UnifiedLocationCategory, string> = {
  current: "unified-current-locations",
  potential: "unified-potential-locations",
  evaluated: "unified-evaluated-locations",
};
const MAP_WIDTH = 975;
const MAP_HEIGHT = 610;
const NATIONAL_VIEW_BOX = `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`;
const fallbackProjection = geoAlbersUsa()
  .scale(1300)
  .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
const fallbackPath = geoPath(fallbackProjection);

type UnifiedEvaluatorMapProps = {
  config: PublicBasemapConfig;
  collection: PublicMarketMapFeatureCollection;
  visibleMarketCodes: ReadonlySet<string>;
  selectedMarketCode: string;
  comparisonMarkets: readonly { code: string; name: string }[];
  comparisonAddEligibility: MarketComparisonEligibility;
  comparisonStatus: string;
  workspaceMode: "markets" | "locations";
  marketCategories: Readonly<Record<string, MarketCategory>>;
  marketScores: Readonly<Record<string, number>>;
  marketScoreMetadata: {
    configurationVersion: string;
    configurationFingerprint: string;
  };
  marketScoreLabel?: string;
  marketScoreBoundary?: string;
  marketDetailByCode?: Readonly<Record<string, {
    valueLabel: string;
    formattedValue: string;
    interpretation: string;
  }>>;
  hideLegend?: boolean;
  secondaryMarketScores?: Readonly<Record<string, number>> | null;
  secondaryMarketScoreLabel?: string | null;
  secondaryMarketDetailByCode?: Readonly<Record<string, {
    valueLabel: string;
    formattedValue: string;
    interpretation: string;
  }>>;
  swipePercent?: number;
  onSwipePercentChange?: (value: number) => void;
  locations: readonly UnifiedMapLocation[];
  selectedLocationId: string | null;
  seattleDeepDiveOverlay?: SeattleIllustrativeOverlay | null;
  activeSeattleSubmarketId?: string | null;
  onChooseSeattleSubmarket?: (submarketId: string) => void;
  onChooseMarket: (code: string) => void;
  onAddMarketToComparison: () => void;
  onRemoveMarketFromComparison: (code: string) => void;
  onClearMarketComparison: () => void;
  onOpenMarketComparison: () => void;
  onChooseLocation: (location: UnifiedMapLocation) => void;
  onReset: () => void;
};

const SECONDARY_SCORE_COLORS = {
  notScored: "#eee9d8",
  low: "#fff7cf",
  lowMid: "#f9e58c",
  mid: "#efc94c",
  highMid: "#c99a18",
  high: "#7f5d00",
} as const;

function secondaryScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return SECONDARY_SCORE_COLORS.notScored;
  }
  const bounded = Math.min(100, Math.max(0, score));
  if (bounded <= 20) return SECONDARY_SCORE_COLORS.low;
  if (bounded <= 40) return SECONDARY_SCORE_COLORS.lowMid;
  if (bounded <= 60) return SECONDARY_SCORE_COLORS.mid;
  if (bounded <= 80) return SECONDARY_SCORE_COLORS.highMid;
  return SECONDARY_SCORE_COLORS.high;
}

function secondaryScoreFillExpression(
  scores: Readonly<Record<string, number>>,
): ExpressionSpecification {
  const expression: unknown[] = ["match", ["get", "cbsa_code"]];
  for (const [cbsaCode, score] of Object.entries(scores)) {
    expression.push(cbsaCode, secondaryScoreColor(score));
  }
  expression.push(SECONDARY_SCORE_COLORS.notScored);
  return expression as ExpressionSpecification;
}

function visibilityFilter(codes: ReadonlySet<string>): FilterSpecification {
  return [
    "in",
    ["get", "cbsa_code"],
    ["literal", [...codes].sort()],
  ] as FilterSpecification;
}

function selectedFilter(
  codes: ReadonlySet<string>,
  selectedCode: string,
): FilterSpecification {
  return [
    "all",
    visibilityFilter(codes),
    ["==", ["get", "cbsa_code"], selectedCode],
  ] as FilterSpecification;
}

function comparisonFilter(
  codes: ReadonlySet<string>,
  comparisonCodes: readonly string[],
): FilterSpecification {
  return [
    "all",
    visibilityFilter(codes),
    ["in", ["get", "cbsa_code"], ["literal", comparisonCodes]],
  ] as FilterSpecification;
}

export function marketScoreFillExpression(
  workspaceMode: "markets" | "locations",
  scores: Readonly<Record<string, number>>,
): ExpressionSpecification {
  return marketScoreMatchExpression(
    workspaceMode,
    scores,
  ) as ExpressionSpecification;
}

function firstSymbolLayer(map: MapLibreMap): string | undefined {
  return map
    .getStyle()
    .layers?.find((layer) => layer.type === "symbol")
    ?.id;
}

function constrainMapToMainland(map: MapLibreMap): void {
  map.setMaxBounds(MAINLAND_MARKET_BOUNDS);
  const nationalCamera = map.cameraForBounds(MAINLAND_MARKET_BOUNDS, {
    padding: 20,
  });
  if (nationalCamera && Number.isFinite(nationalCamera.zoom)) {
    map.setMinZoom(nationalCamera.zoom);
  }
}

function fallbackViewBox(
  collection: PublicMarketMapFeatureCollection,
  selectedMarketCode: string,
  selectedLocation: UnifiedMapLocation | null,
): string {
  if (selectedLocation) {
    const point = fallbackProjection([
      selectedLocation.longitude,
      selectedLocation.latitude,
    ]);
    if (point) {
      const width = 150;
      const height = width / (MAP_WIDTH / MAP_HEIGHT);
      return `${point[0] - width / 2} ${point[1] - height / 2} ${width} ${height}`;
    }
  }
  const selected = collection.features.find(
    (feature) => feature.properties.cbsa_code === selectedMarketCode,
  );
  if (!selected) return NATIONAL_VIEW_BOX;
  const [[x0, y0], [x1, y1]] = fallbackPath.bounds(selected);
  const width = Math.max((x1 - x0) * 1.8, 150);
  const height = width / (MAP_WIDTH / MAP_HEIGHT);
  return `${(x0 + x1 - width) / 2} ${(y0 + y1 - height) / 2} ${width} ${height}`;
}

export function UnifiedEvaluatorMap({
  config,
  collection,
  visibleMarketCodes,
  selectedMarketCode,
  comparisonMarkets,
  comparisonAddEligibility,
  comparisonStatus,
  workspaceMode,
  marketCategories,
  marketScores,
  marketScoreMetadata,
  marketScoreLabel = "Synthetic attractiveness score",
  marketScoreBoundary = "Synthetic screening only. Not a market recommendation.",
  marketDetailByCode = {},
  hideLegend = false,
  secondaryMarketScores = null,
  secondaryMarketScoreLabel = null,
  secondaryMarketDetailByCode = {},
  swipePercent = 50,
  onSwipePercentChange,
  locations,
  selectedLocationId,
  seattleDeepDiveOverlay = null,
  activeSeattleSubmarketId = null,
  onChooseSeattleSubmarket,
  onChooseMarket,
  onAddMarketToComparison,
  onRemoveMarketFromComparison,
  onClearMarketComparison,
  onOpenMarketComparison,
  onChooseLocation,
  onReset,
}: UnifiedEvaluatorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const secondaryContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const secondaryMapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Map<string, MapLibreMarker>>(new Map());
  const comparisonMarkerRefs = useRef<Map<string, MapLibreMarker>>(new Map());
  const callbacksRef = useRef({ onChooseMarket, onChooseLocation });
  const marketDetailsRef = useRef({ marketScores, marketCategories, marketScoreLabel, marketScoreBoundary, marketDetailByCode });
  const swipeDetailsRef = useRef({
    enabled: false,
    secondaryMarketScoreLabel,
    secondaryMarketDetailByCode,
  });
  const seattleOverlayRef = useRef(seattleDeepDiveOverlay);
  const seattleOverlayCallbackRef = useRef(onChooseSeattleSubmarket);
  const locationsRef = useRef(locations);
  const initialViewRef = useRef({
    visibleMarketCodes,
    selectedMarketCode,
    workspaceMode,
    marketCategories,
    marketScores,
  });
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [fallbackResetSelectionKey, setFallbackResetSelectionKey] =
    useState<string | null>(null);

  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? null;
  const visibleLocations = useMemo(() => locations, [locations]);
  const comparisonCodes = comparisonMarkets.map((market) => market.code);
  const comparisonIndexByCode = new Map(
    comparisonCodes.map((code, index) => [code, index + 1]),
  );
  const selectedMarketFeature = collection.features.find(
    (feature) => feature.properties.cbsa_code === selectedMarketCode,
  );
  const useFallback = config.status !== "configured" || loadFailed;
  const swipeEnabled =
    workspaceMode === "markets" &&
    Boolean(secondaryMarketScores && secondaryMarketScoreLabel);
  const selectionKey = `${selectedMarketCode}:${selectedLocationId ?? ""}`;
  const fallbackNational = fallbackResetSelectionKey === selectionKey;

  useEffect(() => {
    callbacksRef.current = { onChooseMarket, onChooseLocation };
    locationsRef.current = locations;
  }, [locations, onChooseLocation, onChooseMarket]);

  useEffect(() => {
    marketDetailsRef.current = { marketScores, marketCategories, marketScoreLabel, marketScoreBoundary, marketDetailByCode };
  }, [marketCategories, marketDetailByCode, marketScoreBoundary, marketScoreLabel, marketScores]);

  useEffect(() => {
    swipeDetailsRef.current = {
      enabled: swipeEnabled,
      secondaryMarketScoreLabel,
      secondaryMarketDetailByCode,
    };
  }, [secondaryMarketDetailByCode, secondaryMarketScoreLabel, swipeEnabled]);

  useEffect(() => {
    seattleOverlayRef.current = seattleDeepDiveOverlay;
    seattleOverlayCallbackRef.current = onChooseSeattleSubmarket;
  }, [onChooseSeattleSubmarket, seattleDeepDiveOverlay]);

  useEffect(() => {
    if (
      config.status !== "configured" ||
      loadFailed ||
      !containerRef.current
    ) {
      return;
    }
    const configuredStyleUrl = config.styleUrl;
    const markers = markerRefs.current;
    const comparisonMarkers = comparisonMarkerRefs.current;
    let disposed = false;
    let styleReady = false;

    async function initialize() {
      try {
        const { AttributionControl, Map, NavigationControl, Popup } =
          await import("maplibre-gl");
        if (disposed || !containerRef.current) return;

        const map = new Map({
          container: containerRef.current,
          style: configuredStyleUrl,
          bounds: MAINLAND_MARKET_BOUNDS,
          fitBoundsOptions: { padding: 20 },
          maxBounds: MAINLAND_MARKET_BOUNDS,
          maxZoom: 14,
          renderWorldCopies: false,
          attributionControl: false,
        });
        mapRef.current = map;
        constrainMapToMainland(map);
        map.on("resize", () => constrainMapToMainland(map));
        map.addControl(
          new NavigationControl({ showCompass: false }),
          "top-right",
        );
        map.addControl(
          new AttributionControl({
            compact: true,
            customAttribution: [
              "CBSA: U.S. Census Bureau SRC-014/SRC-015",
              "ACS: U.S. Census Bureau SRC-016",
            ],
          }),
        );

        map.once("load", () => {
          if (disposed) return;
          styleReady = true;
          const initial = initialViewRef.current;
          map.addSource(CBSA_SOURCE_ID, {
            type: "geojson",
            data: collection,
            generateId: false,
          });
          const beforeId = firstSymbolLayer(map);
          map.addLayer(
            {
              id: CBSA_FILL_LAYER_ID,
              type: "fill",
              source: CBSA_SOURCE_ID,
              filter: visibilityFilter(initial.visibleMarketCodes),
              paint: {
                "fill-color": marketScoreFillExpression(
                  initial.workspaceMode,
                  initial.marketScores,
                ),
                "fill-opacity": MARKET_SCORE_FILL_OPACITY,
              },
            },
            beforeId,
          );

          map.addSource(SEATTLE_OVERLAY_SOURCE_ID, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            generateId: false,
          });
          map.addLayer({
            id: SEATTLE_AREA_FILL_LAYER_ID,
            type: "fill",
            source: SEATTLE_OVERLAY_SOURCE_ID,
            filter: ["==", ["get", "feature_kind"], "illustrative_area"],
            layout: { visibility: "none" },
            paint: {
              "fill-color": ["get", "color"],
              "fill-opacity": 0.2,
            },
          }, beforeId);
          map.addLayer({
            id: SEATTLE_AREA_LINE_LAYER_ID,
            type: "line",
            source: SEATTLE_OVERLAY_SOURCE_ID,
            filter: ["==", ["get", "feature_kind"], "illustrative_area"],
            layout: { visibility: "none" },
            paint: {
              "line-color": ["get", "color"],
              "line-width": 2,
              "line-opacity": 0.9,
              "line-dasharray": [3, 2],
            },
          }, beforeId);
          map.addLayer({
            id: SEATTLE_HUB_LAYER_ID,
            type: "circle",
            source: SEATTLE_OVERLAY_SOURCE_ID,
            filter: ["==", ["get", "feature_kind"], "illustrative_hub"],
            layout: { visibility: "none" },
            paint: {
              "circle-radius": 12,
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
          }, beforeId);
          map.addLayer({
            id: SEATTLE_HUB_NUMBER_LAYER_ID,
            type: "symbol",
            source: SEATTLE_OVERLAY_SOURCE_ID,
            filter: ["==", ["get", "feature_kind"], "illustrative_hub"],
            layout: {
              visibility: "none",
              "text-field": ["to-string", ["get", "display_number"]],
              "text-size": 12,
              "text-font": ["Open Sans Bold"],
              "text-allow-overlap": true,
            },
            paint: { "text-color": "#ffffff" },
          }, beforeId);
          map.addLayer({
            id: SEATTLE_HUB_LABEL_LAYER_ID,
            type: "symbol",
            source: SEATTLE_OVERLAY_SOURCE_ID,
            filter: ["==", ["get", "feature_kind"], "illustrative_hub"],
            layout: {
              visibility: "none",
              "text-field": ["get", "short_label"],
              "text-size": 12,
              "text-offset": [0, 1.6],
              "text-anchor": "top",
              "text-allow-overlap": false,
            },
            paint: {
              "text-color": "#142033",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.5,
            },
          }, beforeId);
          map.addLayer(
            {
              id: CBSA_OUTLINE_LAYER_ID,
              type: "line",
              source: CBSA_SOURCE_ID,
              filter: visibilityFilter(initial.visibleMarketCodes),
              paint: {
                "line-color": "#526174",
                "line-opacity": 0.78,
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  2,
                  0.45,
                  8,
                  1.25,
                ],
              },
            },
            beforeId,
          );
          map.addLayer(
            {
              id: CBSA_COMPARISON_LAYER_ID,
              type: "line",
              source: CBSA_SOURCE_ID,
              filter: comparisonFilter(initial.visibleMarketCodes, []),
              paint: {
                "line-color": "#b56a12",
                "line-width": 3,
                "line-dasharray": [2, 1.2],
              },
            },
            beforeId,
          );
          map.addLayer(
            {
              id: CBSA_SELECTED_LAYER_ID,
              type: "line",
              source: CBSA_SOURCE_ID,
              filter: selectedFilter(
                initial.visibleMarketCodes,
                initial.selectedMarketCode,
              ),
              paint: {
                "line-color": "#092d63",
                "line-width": 4,
              },
            },
            beforeId,
          );

          for (const category of Object.keys(
            LOCATION_SOURCE_IDS,
          ) as UnifiedLocationCategory[]) {
            map.addSource(LOCATION_SOURCE_IDS[category], {
              type: "geojson",
              data: locationsToGeoJson(locationsRef.current, category),
              generateId: false,
            });
          }

          map.on("click", CBSA_FILL_LAYER_ID, (event) => {
            if (seattleOverlayRef.current) return;
            const code = event.features?.[0]?.properties?.cbsa_code;
            if (typeof code === "string") {
              callbacksRef.current.onChooseMarket(code);
              const properties = event.features?.[0]?.properties;
              const details = marketDetailsRef.current;
              const score = details.marketScores[code];
              const marketDetail = details.marketDetailByCode[code];
              if (swipeDetailsRef.current.enabled) return;
              const popup = document.createElement("div");
              popup.className = "unified-map-region-detail";
              const title = document.createElement("strong");
              title.textContent = String(properties?.cbsa_name ?? "Selected market");
              popup.append(title);
              const value = document.createElement("p");
              value.textContent = marketDetail
                ? `${marketDetail.valueLabel}: ${marketDetail.formattedValue}`
                : score === undefined
                  ? "No value is available for the active view."
                  : `${details.marketScoreLabel}: ${score.toFixed(1)}`;
              const interpretation = document.createElement("p");
              interpretation.textContent = marketDetail?.interpretation ?? "";
              const category = document.createElement("p");
              category.textContent = `Market status: ${details.marketCategories[code] ?? "context only"}`;
              const boundary = document.createElement("small");
              boundary.textContent = details.marketScoreBoundary;
              popup.append(value);
              if (marketDetail) popup.append(interpretation);
              popup.append(category, boundary);
              new Popup({ closeButton: true, offset: 8 })
                .setLngLat(event.lngLat)
                .setDOMContent(popup)
                .addTo(map);
            }
          });
          map.on("mouseenter", CBSA_FILL_LAYER_ID, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", CBSA_FILL_LAYER_ID, () => {
            map.getCanvas().style.cursor = "";
          });
          const chooseSeattleArea = (event: { features?: Array<{ properties?: { submarket_id?: unknown } }> }) => {
            const submarketId = event.features?.[0]?.properties?.submarket_id;
            if (typeof submarketId === "string") seattleOverlayCallbackRef.current?.(submarketId);
          };
          for (const layerId of [SEATTLE_AREA_FILL_LAYER_ID, SEATTLE_HUB_LAYER_ID]) {
            map.on("click", layerId, chooseSeattleArea);
            map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
          }
          setReady(true);
        });

        map.on("error", () => {
          if (!styleReady && !disposed) setLoadFailed(true);
        });
      } catch {
        if (!disposed) setLoadFailed(true);
      }
    }

    void initialize();
    return () => {
      disposed = true;
      setReady(false);
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      for (const marker of comparisonMarkers.values()) marker.remove();
      comparisonMarkers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [collection, config, loadFailed]);

  useEffect(() => {
    if (
      !swipeEnabled ||
      config.status !== "configured" ||
      loadFailed ||
      !ready ||
      !secondaryContainerRef.current ||
      !secondaryMarketScores
    ) {
      secondaryMapRef.current?.remove();
      secondaryMapRef.current = null;
      return;
    }
    const configuredStyleUrl = config.styleUrl;
    const primaryMap = mapRef.current;
    let disposed = false;
    let secondaryMap: MapLibreMap | null = null;
    let synchronizeCamera: (() => void) | null = null;

    async function initializeSecondaryMap() {
      const { Map } = await import("maplibre-gl");
      if (disposed || !secondaryContainerRef.current || !primaryMap) return;
      secondaryMap = new Map({
        container: secondaryContainerRef.current,
        style: configuredStyleUrl,
        center: primaryMap.getCenter(),
        zoom: primaryMap.getZoom(),
        bearing: primaryMap.getBearing(),
        pitch: primaryMap.getPitch(),
        maxBounds: MAINLAND_MARKET_BOUNDS,
        maxZoom: 14,
        renderWorldCopies: false,
        interactive: false,
        attributionControl: false,
      });
      secondaryMapRef.current = secondaryMap;
      secondaryMap.once("load", () => {
        if (disposed || !secondaryMap) return;
        secondaryMap.addSource(SECONDARY_CBSA_SOURCE_ID, {
          type: "geojson",
          data: collection,
          generateId: false,
        });
        const beforeId = firstSymbolLayer(secondaryMap);
        secondaryMap.addLayer(
          {
            id: SECONDARY_CBSA_FILL_LAYER_ID,
            type: "fill",
            source: SECONDARY_CBSA_SOURCE_ID,
            filter: visibilityFilter(visibleMarketCodes),
            paint: {
              "fill-color": secondaryScoreFillExpression(secondaryMarketScores),
              "fill-opacity": MARKET_SCORE_FILL_OPACITY,
            },
          },
          beforeId,
        );
        secondaryMap.addLayer(
          {
            id: SECONDARY_CBSA_OUTLINE_LAYER_ID,
            type: "line",
            source: SECONDARY_CBSA_SOURCE_ID,
            filter: visibilityFilter(visibleMarketCodes),
            paint: {
              "line-color": "#80620b",
              "line-opacity": 0.76,
              "line-width": 0.7,
            },
          },
          beforeId,
        );
      });
      synchronizeCamera = () => {
        if (!secondaryMap || !primaryMap) return;
        secondaryMap.jumpTo({
          center: primaryMap.getCenter(),
          zoom: primaryMap.getZoom(),
          bearing: primaryMap.getBearing(),
          pitch: primaryMap.getPitch(),
        });
      };
      primaryMap.on("move", synchronizeCamera);
      primaryMap.on("resize", synchronizeCamera);
    }

    void initializeSecondaryMap();
    return () => {
      disposed = true;
      if (primaryMap && synchronizeCamera) {
        primaryMap.off("move", synchronizeCamera);
        primaryMap.off("resize", synchronizeCamera);
      }
      secondaryMap?.remove();
      if (secondaryMapRef.current === secondaryMap) secondaryMapRef.current = null;
    };
  }, [
    collection,
    config,
    loadFailed,
    ready,
    secondaryMarketScores,
    secondaryMarketScoreLabel,
    swipeEnabled,
    visibleMarketCodes,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource(SEATTLE_OVERLAY_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(seattleDeepDiveOverlay ?? { type: "FeatureCollection", features: [] });
    const visibility = seattleDeepDiveOverlay ? "visible" : "none";
    for (const layerId of [
      SEATTLE_AREA_FILL_LAYER_ID,
      SEATTLE_AREA_LINE_LAYER_ID,
      SEATTLE_HUB_LAYER_ID,
      SEATTLE_HUB_NUMBER_LAYER_ID,
      SEATTLE_HUB_LABEL_LAYER_ID,
    ]) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
    }
    if (!seattleDeepDiveOverlay) return;
    map.setPaintProperty(SEATTLE_AREA_FILL_LAYER_ID, "fill-opacity", [
      "case",
      ["==", ["get", "submarket_id"], activeSeattleSubmarketId ?? ""],
      0.46,
      0.2,
    ]);
    map.setPaintProperty(SEATTLE_AREA_LINE_LAYER_ID, "line-width", [
      "case",
      ["==", ["get", "submarket_id"], activeSeattleSubmarketId ?? ""],
      4,
      2,
    ]);
    map.setPaintProperty(SEATTLE_HUB_LAYER_ID, "circle-radius", [
      "case",
      ["==", ["get", "submarket_id"], activeSeattleSubmarketId ?? ""],
      16,
      12,
    ]);
  }, [activeSeattleSubmarketId, ready, seattleDeepDiveOverlay]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    map.setFilter(
      CBSA_FILL_LAYER_ID,
      visibilityFilter(visibleMarketCodes),
    );
    map.setFilter(
      CBSA_OUTLINE_LAYER_ID,
      visibilityFilter(visibleMarketCodes),
    );
    map.setFilter(
      CBSA_COMPARISON_LAYER_ID,
      comparisonFilter(visibleMarketCodes, comparisonCodes),
    );
    map.setFilter(
      CBSA_SELECTED_LAYER_ID,
      selectedFilter(visibleMarketCodes, selectedMarketCode),
    );
    map.setPaintProperty(
      CBSA_FILL_LAYER_ID,
      "fill-color",
      marketScoreFillExpression(workspaceMode, marketScores),
    );
  }, [
    comparisonCodes,
    marketCategories,
    marketScores,
    comparisonMarkets,
    ready,
    selectedMarketCode,
    visibleMarketCodes,
    workspaceMode,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;

    async function syncComparisonMarkers() {
      const { Marker } = await import("maplibre-gl");
      const activeMap = mapRef.current;
      if (cancelled || !activeMap) return;

      for (const marker of comparisonMarkerRefs.current.values()) marker.remove();
      comparisonMarkerRefs.current.clear();
      if (workspaceMode !== "markets") return;

      for (const [index, comparisonMarket] of comparisonMarkets.entries()) {
        const feature = collection.features.find(
          (candidate) =>
            candidate.properties.cbsa_code === comparisonMarket.code,
        );
        if (!feature) continue;
        const [longitude, latitude] = geoCentroid(feature);
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
        const element = document.createElement("div");
        element.className = "comparison-map-number";
        element.textContent = String(index + 1);
        element.setAttribute(
          "aria-label",
          `${comparisonMarket.name}, comparison market ${index + 1}`,
        );
        element.setAttribute("role", "img");
        const marker = new Marker({ element, anchor: "center" })
          .setLngLat([longitude, latitude])
          .addTo(activeMap);
        comparisonMarkerRefs.current.set(comparisonMarket.code, marker);
      }
    }

    void syncComparisonMarkers();
    return () => {
      cancelled = true;
    };
  }, [collection, comparisonMarkets, ready, workspaceMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedMarketCode || swipeEnabled) return;
    const bounds = selectedMarketBounds(collection, selectedMarketCode);
    if (!bounds) return;
    map.fitBounds(bounds, {
      padding: window.innerWidth <= 680 ? 28 : 64,
      maxZoom: PUBLIC_MARKET_MAX_FIT_ZOOM,
      duration: 650,
    });
  }, [collection, ready, selectedMarketCode, swipeEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedLocation) return;
    map.easeTo({
      center: [selectedLocation.longitude, selectedLocation.latitude],
      zoom: Math.max(map.getZoom(), 10),
      duration: 650,
    });
  }, [ready, selectedLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;

    async function syncLocations() {
      const { Marker, Popup } = await import("maplibre-gl");
      const activeMap = mapRef.current;
      if (cancelled || !activeMap) return;

      for (const category of Object.keys(
        LOCATION_SOURCE_IDS,
      ) as UnifiedLocationCategory[]) {
        const source = activeMap.getSource(
          LOCATION_SOURCE_IDS[category],
        ) as GeoJSONSource | undefined;
        source?.setData(locationsToGeoJson(locations, category));
      }

      for (const marker of markerRefs.current.values()) marker.remove();
      markerRefs.current.clear();

      for (const location of visibleLocations) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = `unified-map-marker ${location.category}${
          selectedLocationId === location.id ? " selected" : ""
        }`;
        element.setAttribute("aria-label", unifiedLocationAriaLabel(location));
        element.setAttribute(
          "aria-pressed",
          String(selectedLocationId === location.id),
        );
        element.title = `${location.name} · ${location.statusLabel}`;
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          callbacksRef.current.onChooseLocation(location);
          const popup = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = location.name;
          const place = document.createElement("p");
          place.textContent = [location.address, `${location.city}, ${location.state}`].filter(Boolean).join(" · ");
          const status = document.createElement("p");
          status.textContent = `${location.statusLabel} · ${location.evidenceStatus}`;
          const source = document.createElement("small");
          source.textContent = `Source: ${location.sourceId}`;
          popup.append(title, place, status, source);
          new Popup({ closeButton: true, offset: 12 })
            .setLngLat([location.longitude, location.latitude])
            .setDOMContent(popup)
            .addTo(activeMap);
        });
        const marker = new Marker({ element, anchor: "center" })
          .setLngLat([location.longitude, location.latitude])
          .addTo(activeMap);
        markerRefs.current.set(`${location.category}:${location.id}`, marker);
      }
    }

    void syncLocations();
    return () => {
      cancelled = true;
    };
  }, [locations, ready, selectedLocationId, visibleLocations]);

  function resetMap() {
    setFallbackResetSelectionKey(selectionKey);
    mapRef.current?.fitBounds(MAINLAND_MARKET_BOUNDS, {
      padding: 20,
      duration: 650,
    });
    onReset();
  }

  function setSwipeFromPointer(clientX: number) {
    const bounds = mapCanvasRef.current?.getBoundingClientRect();
    if (!bounds?.width) return;
    const next = Math.min(95, Math.max(5, ((clientX - bounds.left) / bounds.width) * 100));
    onSwipePercentChange?.(Math.round(next));
  }

  function moveSwipeDivider(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setSwipeFromPointer(event.clientX);
  }

  function moveSwipeDividerWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    let next = swipePercent;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 2;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 2;
    else if (event.key === "Home") next = 5;
    else if (event.key === "End") next = 95;
    else return;
    event.preventDefault();
    onSwipePercentChange?.(Math.min(95, Math.max(5, next)));
  }

  const fallbackView = fallbackNational
    ? NATIONAL_VIEW_BOX
    : fallbackViewBox(collection, selectedMarketCode, selectedLocation);

  return (
    <section
      className="map-card unified-map-card"
      aria-label="Unified clinic and public market context map"
      data-unified-map="true"
    >
      {workspaceMode === "markets" && !seattleDeepDiveOverlay ? (
        <section className="map-comparison-tray" aria-label="Market comparison tray">
          <div className="map-comparison-active">
            <span>Active market</span>
            <strong>
              {selectedMarketFeature?.properties.cbsa_name ?? "Select a market"}
            </strong>
            <small>
              {selectedMarketCode
                ? marketScores[selectedMarketCode] === undefined
                  ? "Not scored"
                  : `${marketScoreLabel} ${marketScores[selectedMarketCode].toFixed(1)}`
                : "Choose a market boundary to begin"}
            </small>
            <button
              type="button"
              disabled={!comparisonAddEligibility.allowed}
              onClick={onAddMarketToComparison}
            >
              Add to comparison
            </button>
            {!comparisonAddEligibility.allowed && selectedMarketCode ? (
              <small className="map-comparison-reason">
                {comparisonAddEligibility.reason}
              </small>
            ) : null}
          </div>
          <div className="map-comparison-selection">
            <div>
              <strong>{comparisonMarkets.length} of 5 selected</strong>
              <span>
                {comparisonMarkets.length
                  ? "Numbered in analyst selection order"
                  : "Map exploration does not add markets automatically"}
              </span>
            </div>
            <div className="map-comparison-chips">
              {comparisonMarkets.map((market, index) => (
                <span key={market.code}>
                  {index + 1}. {market.name}
                  <button
                    type="button"
                    aria-label={`Remove ${market.name} from comparison`}
                    onClick={() => onRemoveMarketFromComparison(market.code)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="map-comparison-actions">
              <button
                type="button"
                disabled={!comparisonMarkets.length}
                onClick={onClearMarketComparison}
              >
                Clear
              </button>
              <button type="button" onClick={onOpenMarketComparison}>
                Open comparison
              </button>
            </div>
          </div>
          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {comparisonStatus || comparisonAddEligibility.reason}
          </p>
        </section>
      ) : null}

      <div ref={mapCanvasRef} className="unified-map-canvas">
        {useFallback ? (
          <svg
            viewBox={fallbackView}
            role="img"
            aria-label={`${workspaceMode === "markets" ? "Market workflow categories" : "Locations"} with current, potential, and evaluated records. Street basemap unavailable.`}
          >
            <g className="market-boundary-layer">
              {collection.features.map((feature) => {
                const code = feature.properties.cbsa_code;
                if (!visibleMarketCodes.has(code)) return null;
                return (
                  <path
                    key={code}
                    d={fallbackPath(feature) ?? undefined}
                    className={`${
                      comparisonIndexByCode.has(code) ? "comparison-market" : ""
                    }${selectedMarketCode === code ? " selected-market" : ""}`}
                    style={{
                      fill:
                        workspaceMode === "markets"
                          ? marketScoreColor(marketScores[code])
                          : "#e5e7eb",
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${feature.properties.cbsa_name}, CBSA ${code}`}
                    onClick={() => onChooseMarket(code)}
                    onKeyDown={(event) => {
                      if (isKeyboardSelectionKey(event.key)) {
                        event.preventDefault();
                        onChooseMarket(code);
                      }
                    }}
                  />
                );
              })}
            </g>
            <g className="fallback-comparison-numbers" aria-hidden="true">
              {collection.features.map((feature) => {
                const code = feature.properties.cbsa_code;
                const comparisonNumber = comparisonIndexByCode.get(code);
                if (!comparisonNumber || !visibleMarketCodes.has(code)) return null;
                const point = fallbackPath.centroid(feature);
                if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
                return (
                  <g key={code} transform={`translate(${point[0]} ${point[1]})`}>
                    <circle r="9" />
                    <text textAnchor="middle" dy=".35em">{comparisonNumber}</text>
                  </g>
                );
              })}
            </g>
            <g className="unified-fallback-markers">
              {visibleLocations.map((location) => {
                const point = fallbackProjection([
                  location.longitude,
                  location.latitude,
                ]);
                if (!point) return null;
                return (
                  <g
                    key={`${location.category}:${location.id}`}
                    className={`${location.category}${
                      selectedLocationId === location.id ? " selected" : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-label={unifiedLocationAriaLabel(location)}
                    transform={`translate(${point[0]} ${point[1]})`}
                    onClick={() => onChooseLocation(location)}
                    onKeyDown={(event) => {
                      if (isKeyboardSelectionKey(event.key)) {
                        event.preventDefault();
                        onChooseLocation(location);
                      }
                    }}
                  >
                    {location.category === "current" ? (
                      <circle r="6" />
                    ) : location.category === "potential" ? (
                      <path d="M 0 -7 L 7 0 L 0 7 L -7 0 Z" />
                    ) : (
                      <rect x="-6" y="-6" width="12" height="12" rx="1" />
                    )}
                  </g>
                );
              })}
            </g>
            {seattleDeepDiveOverlay ? (
              <g className="seattle-fallback-overlay">
                {seattleDeepDiveOverlay.features.map((feature) => {
                  if (feature.properties.feature_kind !== "illustrative_area" || feature.geometry.type !== "Polygon") return null;
                  return (
                    <path
                      key={String(feature.id)}
                      d={fallbackPath(feature) ?? undefined}
                      className={activeSeattleSubmarketId === feature.properties.submarket_id ? "active" : ""}
                      style={{ "--area-color": feature.properties.color } as React.CSSProperties}
                      role="button"
                      tabIndex={0}
                      aria-label={`Focus illustrative demo area ${feature.properties.label}`}
                      onClick={() => onChooseSeattleSubmarket?.(feature.properties.submarket_id)}
                      onKeyDown={(event) => {
                        if (isKeyboardSelectionKey(event.key)) {
                          event.preventDefault();
                          onChooseSeattleSubmarket?.(feature.properties.submarket_id);
                        }
                      }}
                    />
                  );
                })}
                {seattleDeepDiveOverlay.features.map((feature) => {
                  if (feature.properties.feature_kind !== "illustrative_hub" || feature.geometry.type !== "Point") return null;
                  const point = fallbackProjection(feature.geometry.coordinates as [number, number]);
                  if (!point) return null;
                  return <g key={String(feature.id)} transform={`translate(${point[0]} ${point[1]})`}>
                    <circle r={activeSeattleSubmarketId === feature.properties.submarket_id ? 8 : 6} style={{ fill: feature.properties.color }} />
                    <text textAnchor="middle" dy=".35em">{feature.properties.display_number}</text>
                  </g>;
                })}
              </g>
            ) : null}
          </svg>
        ) : (
          <div
            ref={containerRef}
            className="unified-maplibre"
            role="region"
            aria-label={`${workspaceMode === "markets" ? "Market workflow categories" : "Locations"} on MapTiler streets with current, potential, and evaluated records.`}
          />
        )}

        {swipeEnabled ? (
          <>
            {useFallback ? (
              <svg
                className="unified-swipe-fallback"
                viewBox={fallbackView}
                aria-hidden="true"
                style={{ clipPath: `inset(0 ${100 - swipePercent}% 0 0)` }}
              >
                <g className="market-boundary-layer secondary-market-boundary-layer">
                  {collection.features.map((feature) => {
                    const code = feature.properties.cbsa_code;
                    if (!visibleMarketCodes.has(code)) return null;
                    return (
                      <path
                        key={code}
                        d={fallbackPath(feature) ?? undefined}
                        style={{ fill: secondaryScoreColor(secondaryMarketScores?.[code]) }}
                      />
                    );
                  })}
                </g>
              </svg>
            ) : (
              <div
                className="unified-swipe-map"
                style={{ clipPath: `inset(0 ${100 - swipePercent}% 0 0)` }}
                aria-hidden="true"
              >
                <div ref={secondaryContainerRef} className="unified-maplibre" />
              </div>
            )}
            <div className="unified-swipe-label secondary" style={{ right: `${100 - swipePercent}%` }}>
              <i aria-hidden="true" /> View B · {secondaryMarketScoreLabel}
            </div>
            <div className="unified-swipe-label primary" style={{ left: `${swipePercent}%` }}>
              <i aria-hidden="true" /> View A · {marketScoreLabel}
            </div>
            <div
              className="unified-swipe-divider"
              style={{ left: `${swipePercent}%` }}
              role="slider"
              tabIndex={0}
              aria-label={`Compare ${secondaryMarketScoreLabel} with ${marketScoreLabel}`}
              aria-valuemin={5}
              aria-valuemax={95}
              aria-valuenow={swipePercent}
              aria-valuetext={`${swipePercent}% ${secondaryMarketScoreLabel}, ${100 - swipePercent}% ${marketScoreLabel}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setSwipeFromPointer(event.clientX);
              }}
              onPointerMove={moveSwipeDivider}
              onKeyDown={moveSwipeDividerWithKeyboard}
            >
              <span>↔</span>
            </div>
          </>
        ) : null}

        {swipeEnabled && selectedMarketFeature ? (() => {
          const code = selectedMarketFeature.properties.cbsa_code;
          const primaryDetail = marketDetailByCode[code];
          const secondaryDetail = secondaryMarketDetailByCode[code];
          return (
            <aside
              className="unified-map-region-comparison"
              role="dialog"
              aria-label={`Compare views for ${selectedMarketFeature.properties.cbsa_name}`}
            >
              <header>
                <div>
                  <span>Selected region</span>
                  <strong>{selectedMarketFeature.properties.cbsa_name}</strong>
                </div>
                <button type="button" onClick={() => onChooseMarket("")} aria-label="Close region comparison">×</button>
              </header>
              <div className="unified-map-region-comparison-grid">
                <section className="unified-map-region-comparison-view secondary">
                  <span>View B</span>
                  <small>{secondaryDetail?.valueLabel ?? secondaryMarketScoreLabel ?? "Comparison view"}</small>
                  <b>{secondaryDetail?.formattedValue ?? "Unavailable"}</b>
                  <p>{secondaryDetail?.interpretation ?? "No approved value is available for this region in View B."}</p>
                </section>
                <section className="unified-map-region-comparison-view primary">
                  <span>View A</span>
                  <small>{primaryDetail?.valueLabel ?? marketScoreLabel}</small>
                  <b>{primaryDetail?.formattedValue ?? "Unavailable"}</b>
                  <p>{primaryDetail?.interpretation ?? "No approved value is available for this region in View A."}</p>
                </section>
              </div>
              <small className="unified-map-region-comparison-note">Same region · two approved measures · no combined score</small>
            </aside>
          );
        })() : null}

        <button
          type="button"
          className={`market-reset-map${useFallback ? "" : " with-navigation"}`}
          onClick={resetMap}
        >
          Reset map
        </button>

        {useFallback ? (
          <p className="basemap-fallback-note" role="status">
            {loadFailed
              ? "The configured MapTiler basemap could not be loaded."
              : config.status === "invalid"
                ? "The MapTiler style configuration is invalid."
                : "MapTiler is not configured."}{" "}
            Showing the provider-neutral Census and location fallback.
          </p>
        ) : null}

        {!hideLegend ? <div
          className={`workflow-map-legend ${workspaceMode === "markets" ? "market-score-legend" : ""}`}
          aria-label={workspaceMode === "markets" ? `${marketScoreLabel} legend` : "Location status legend"}
        >
          {seattleDeepDiveOverlay ? (
            <>
              <strong>Illustrative demo areas</strong>
              <span>Dashed areas may overlap</span>
              <small>Hypothesis · geometry scoring none</small>
              <small>Not approved boundaries, trade areas, or service areas.</small>
            </>
          ) : workspaceMode === "markets" ? (
            <>
              <strong>{marketScoreLabel}</strong>
              <div className="market-score-gradient" aria-hidden="true" />
              <div className="market-score-scale">
                <span>Lower 0</span>
                <span>50</span>
                <span>Higher 100</span>
              </div>
              <span>
                <i style={{ background: MARKET_SCORE_COLORS.notScored }} />
                Not scored
              </span>
              <small>
                {marketScoreMetadata.configurationVersion} · {marketScoreMetadata.configurationFingerprint}
              </small>
              <small>{marketScoreBoundary}</small>
            </>
          ) : (
            <>
              <strong>Location status</strong>
              {(["current", "potential", "evaluated"] as const).map((category) => (
                <span key={category}>
                  <i style={{ background: WORKFLOW_CATEGORY_COLORS[category] }} />
                  {category[0].toUpperCase() + category.slice(1)}
                </span>
              ))}
            </>
          )}
        </div> : null}
      </div>

      <div className="map-note">
        <span>Evidence boundary</span>
        MapTiler provides visual geographic context only. Census CBSAs are
        statistical areas, not trade areas, service areas, or drive-time
        polygons. Illustrative Seattle areas may overlap and are not scoring
        inputs. Evaluated does not mean approved or recommended.
      </div>
    </section>
  );
}
