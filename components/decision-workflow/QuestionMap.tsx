"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MAINLAND_MARKET_BOUNDS,
  resolveMapTilerConfig,
} from "@/lib/data/cbsa-market-map";
import { currentClinics, fulfillmentCenters } from "@/lib/locations/map-data";

type ClickedPlace = {
  latitude: number;
  longitude: number;
};

const DEFAULT_STYLE_URL = "https://api.maptiler.com/maps/streets-v4/style.json";

function mapPoint(latitude: number, longitude: number) {
  const left = ((longitude + 125) / 59) * 100;
  const top = ((49.5 - latitude) / 25.5) * 100;
  return {
    left: `${Math.min(98, Math.max(2, left))}%`,
    top: `${Math.min(96, Math.max(4, top))}%`,
  };
}

function createContextMarker(
  documentRef: Document,
  className: string,
  label: string,
) {
  const element = documentRef.createElement("button");
  element.type = "button";
  element.className = `question-network-pin ${className}`;
  element.setAttribute("aria-label", label);
  element.title = label;
  return element;
}

function formatCoordinate(value: number) {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? "N/E" : "S/W"}`;
}

export function QuestionMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const contextMarkersRef = useRef<import("maplibre-gl").Marker[]>([]);
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
    const configuredStyleUrl = config.styleUrl;

    let disposed = false;

    async function initialize() {
      try {
        const { AttributionControl, Map, Marker, NavigationControl } = await import("maplibre-gl");
        if (disposed || !containerRef.current) return;

        const map = new Map({
          container: containerRef.current,
          style: configuredStyleUrl,
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
          for (const clinic of currentClinics) {
            const marker = new Marker({
              element: createContextMarker(
                document,
                "clinic-pin",
                `Chewy Vet Care ${clinic.name}, ${clinic.address}`,
              ),
              anchor: "center",
            })
              .setLngLat([clinic.longitude, clinic.latitude])
              .addTo(map);
            contextMarkersRef.current.push(marker);
          }
          for (const center of fulfillmentCenters.filter((item) => item.state !== "ON")) {
            const marker = new Marker({
              element: createContextMarker(
                document,
                "fulfillment-pin",
                `${center.name}, ${center.address}`,
              ),
              anchor: "center",
            })
              .setLngLat([center.longitude, center.latitude])
              .addTo(map);
            contextMarkersRef.current.push(marker);
          }
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
      for (const marker of contextMarkersRef.current) marker.remove();
      contextMarkersRef.current = [];
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
    <section className="question-map-section" aria-label="Geographic context">
      <div className="question-map-toolbar">
        <div className="question-map-actions">
          <span className={`map-connection-status ${loadState}`}><i aria-hidden="true" />{loadState === "ready" ? "MapTiler streets" : loadState === "loading" ? "Loading map" : "Provider-neutral map"}</span>
          <button type="button" className="secondary-action" onClick={resetMap}>Reset view</button>
        </div>
      </div>
      <div className="question-map-frame">
        {loadState === "fallback" ? (
          <div className="question-map-fallback" aria-label="United States geographic context map">
            <img src="/us-map.svg" alt="Illustrative United States geographic context" />
            <div className="question-network-pins" aria-label="Chewy network locations">
              {fulfillmentCenters.filter((center) => center.state !== "ON").map((center) => <button key={center.id} type="button" className="question-network-pin fulfillment-pin" style={mapPoint(center.latitude, center.longitude)} title={`${center.name}: ${center.address}`} aria-label={`${center.name}, ${center.address}`} />)}
              {currentClinics.map((clinic) => <button key={clinic.id} type="button" className="question-network-pin clinic-pin" style={mapPoint(clinic.latitude, clinic.longitude)} title={`Chewy Vet Care ${clinic.name}: ${clinic.address}`} aria-label={`Chewy Vet Care ${clinic.name}, ${clinic.address}`} />)}
            </div>
            <p>Configure <code>NEXT_PUBLIC_MAPTILER_KEY</code> to enable MapTiler streets and map interactions.</p>
          </div>
        ) : <div ref={containerRef} className="question-maplibre" role="region" aria-label="Interactive MapTiler geographic context map" />}
        {clickedPlace ? <div className="question-map-selection"><strong>Selected map point</strong><span>{formatCoordinate(clickedPlace.latitude)}, {formatCoordinate(clickedPlace.longitude)}</span><small>Context only. No market data is attached yet.</small></div> : null}
        <div className="question-map-legend"><span><i className="legend-clinic" />Current Vet Care clinics ({currentClinics.length})</span><span><i className="legend-fulfillment" />U.S. fulfillment centers ({fulfillmentCenters.filter((center) => center.state !== "ON").length})</span></div>
      </div>
    </section>
  );
}
