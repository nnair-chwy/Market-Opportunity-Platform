"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MAINLAND_MARKET_BOUNDS,
  resolveMapTilerConfig,
} from "@/lib/data/cbsa-market-map";

type ClickedPlace = {
  latitude: number;
  longitude: number;
};

const DEFAULT_STYLE_URL = "https://api.maptiler.com/maps/streets-v4/style.json";

function formatCoordinate(value: number) {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? "N/E" : "S/W"}`;
}

export function QuestionMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "fallback">("loading");
  const [clickedPlace, setClickedPlace] = useState<ClickedPlace | null>(null);
  const config = useMemo(
    () => resolveMapTilerConfig(
      process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_STYLE_URL,
      process.env.NEXT_PUBLIC_MAPTILER_KEY,
    ),
    [],
  );

  useEffect(() => {
    if (config.status !== "configured" || !containerRef.current) {
      setLoadState("fallback");
      return;
    }

    let disposed = false;

    async function initialize() {
      try {
        const { AttributionControl, Map, Marker, NavigationControl } = await import("maplibre-gl");
        if (disposed || !containerRef.current) return;

        const map = new Map({
          container: containerRef.current,
          style: config.styleUrl,
          bounds: MAINLAND_MARKET_BOUNDS,
          fitBoundsOptions: { padding: 42 },
          maxBounds: MAINLAND_MARKET_BOUNDS,
          maxZoom: 13,
          renderWorldCopies: false,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new AttributionControl({ compact: true }), "bottom-right");

        map.once("load", () => {
          if (disposed) return;
          setLoadState("ready");
        });
        map.on("error", () => {
          if (!disposed) setLoadState("fallback");
        });
        map.on("click", (event) => {
          if (disposed) return;
          const place = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };
          setClickedPlace(place);
          markerRef.current?.remove();
          markerRef.current = new Marker({ color: "#2c8e9b" })
            .setLngLat([place.longitude, place.latitude])
            .addTo(map);
        });
      } catch {
        if (!disposed) setLoadState("fallback");
      }
    }

    void initialize();
    return () => {
      disposed = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [config]);

  function resetMap() {
    mapRef.current?.fitBounds(MAINLAND_MARKET_BOUNDS, { padding: 42, duration: 700 });
    markerRef.current?.remove();
    markerRef.current = null;
    setClickedPlace(null);
  }

  return (
    <section className="question-map-section" aria-labelledby="question-map-title">
      <div className="question-map-heading">
        <div>
          <div className="eyebrow">Explore the geography</div>
          <h2 id="question-map-title">Start with a market view</h2>
          <p>Pan, zoom, or click a region to set geographic context. Market measures will appear here as the evidence layer is connected.</p>
        </div>
        <div className="question-map-actions">
          <span className={`map-connection-status ${loadState}`}><i aria-hidden="true" />{loadState === "ready" ? "MapTiler streets" : loadState === "loading" ? "Loading map" : "Provider-neutral map"}</span>
          <button type="button" className="secondary-action" onClick={resetMap}>Reset view</button>
        </div>
      </div>
      <div className="question-map-frame">
        {loadState === "fallback" ? (
          <div className="question-map-fallback" aria-label="United States geographic context map">
            <img src="/us-map.svg" alt="Illustrative United States geographic context" />
            <span className="map-marker marker-west" /><span className="map-marker marker-central" /><span className="map-marker marker-east" /><span className="map-marker marker-southeast" />
            <p>Configure <code>NEXT_PUBLIC_MAPTILER_KEY</code> to enable MapTiler streets and map interactions.</p>
          </div>
        ) : <div ref={containerRef} className="question-maplibre" role="region" aria-label="Interactive MapTiler geographic context map" />}
        {clickedPlace ? <div className="question-map-selection"><strong>Selected map point</strong><span>{formatCoordinate(clickedPlace.latitude)}, {formatCoordinate(clickedPlace.longitude)}</span><small>Context only. No market data is attached yet.</small></div> : null}
        <div className="question-map-legend"><span><i className="legend-demand" />Market context</span><span><i className="legend-site" />Selected point</span><small>MapTiler provides visual geographic context only.</small></div>
      </div>
    </section>
  );
}
