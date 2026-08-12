"use client";

import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath, type GeoProjection } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import statesTopology from "us-atlas/states-10m.json";
import { currentClinics } from "@/lib/locations/map-data";
import { stateDogOwnership } from "@/lib/data/state-dog-ownership";
import { publicMarketMapGeoJson } from "@/lib/data/public-market-ui";
import { planAnalysisPrototype, publicMarketGeographicArtifact } from "@/lib/evaluation";
import type { PublicMarketMeasureId } from "@/lib/evaluation/geographic-measures";
import styles from "./evaluation-workspace.module.css";

export type MapLayerId = "footprint" | "population" | "households" | "income" | "housing" | "density" | "pet_ownership";
type CompareMode = "single" | "swipe" | "blend";
type ViewShortcut = { label: string; primary: MapLayerId; secondary?: MapLayerId; mode: CompareMode };

const MODERN_ANIMAL_REGIONS = [
  { name: "Phoenix", latitude: 33.4484, longitude: -112.0740 }, { name: "SF Bay Area", latitude: 37.7749, longitude: -122.4194 },
  { name: "Los Angeles", latitude: 34.0522, longitude: -118.2437 }, { name: "Orange County", latitude: 33.7175, longitude: -117.8311 },
  { name: "Houston", latitude: 29.7604, longitude: -95.3698 }, { name: "Dallas", latitude: 32.7767, longitude: -96.7970 },
  { name: "Austin", latitude: 30.2672, longitude: -97.7431 }, { name: "Denver", latitude: 39.7392, longitude: -104.9903 },
] as const;

const LAYERS: Array<{ id: MapLayerId; label: string; detail: string; measure?: PublicMarketMeasureId }> = [
  { id: "footprint", label: "Clinic footprint", detail: "Chewy clinics and Modern Animal operating regions" },
  { id: "population", label: "Population", detail: "2020–2024 Census market estimate", measure: "market_population" },
  { id: "households", label: "Households", detail: "2020–2024 Census market estimate", measure: "market_households" },
  { id: "income", label: "Household income", detail: "2020–2024 Census market median", measure: "market_income" },
  { id: "housing", label: "Housing units", detail: "2020–2024 Census market estimate", measure: "market_housing_units" },
  { id: "density", label: "Density", detail: "Derived from Census population and land area", measure: "market_density" },
  { id: "pet_ownership", label: "Pet ownership", detail: "Reported dog-owning household rate by state" },
];

const DEFAULT_VIEWS: ViewShortcut[] = [
  { label: "Clinics", primary: "footprint", mode: "single" },
  { label: "Households", primary: "households", mode: "single" },
  { label: "Pet ownership", primary: "pet_ownership", mode: "single" },
  { label: "Population density", primary: "density", mode: "single" },
];

function viewsForQuestion(question: string): ViewShortcut[] {
  if (/income|afford|spend/i.test(question) && /household|population|market|scale/i.test(question)) return [
    { label: "Households", primary: "households", mode: "single" },
    { label: "Income", primary: "income", mode: "single" },
    { label: "Households + income", primary: "households", secondary: "income", mode: "swipe" },
    { label: "Income overlap", primary: "households", secondary: "income", mode: "blend" },
  ];
  if (/pet|dog|owner/i.test(question)) return [
    { label: "Pet ownership", primary: "pet_ownership", mode: "single" },
    { label: "Pet owners + households", primary: "pet_ownership", secondary: "households", mode: "swipe" },
    { label: "Pet owners + density", primary: "pet_ownership", secondary: "density", mode: "blend" },
    { label: "Clinic footprint", primary: "footprint", mode: "single" },
  ];
  if (/clinic|whitespace|location|footprint/i.test(question)) return [
    { label: "Clinic footprint", primary: "footprint", mode: "single" },
    { label: "Households", primary: "households", mode: "single" },
    { label: "Pet ownership", primary: "pet_ownership", mode: "single" },
    { label: "Clinics + pet owners", primary: "footprint", secondary: "pet_ownership", mode: "blend" },
  ];
  if (/dens|population|people/i.test(question)) return [
    { label: "Density", primary: "density", mode: "single" },
    { label: "Population", primary: "population", mode: "single" },
    { label: "Density + population", primary: "density", secondary: "population", mode: "swipe" },
    { label: "Households", primary: "households", mode: "single" },
  ];
  return DEFAULT_VIEWS;
}

const PALETTES = {
  blue: ["#dcecff", "#b7d9ff", "#77b5ff", "#2781f7", "#0057d9"],
  teal: ["#e0f2f2", "#b2dcdf", "#70bac1", "#2c8e9b", "#17626d"],
  red: ["#ffe0e5", "#ffb1bd", "#ff7387", "#ef3654", "#b20f31"],
} as const;

const BLEND_PALETTES = {
  blue: ["rgba(0,87,217,0)", "rgba(0,87,217,.18)", "rgba(0,87,217,.46)", "rgba(0,87,217,.74)", "rgba(0,87,217,1)"],
  red: ["rgba(239,54,84,0)", "rgba(239,54,84,.18)", "rgba(239,54,84,.46)", "rgba(239,54,84,.74)", "rgba(239,54,84,1)"],
} as const;

function scoreFill(score: number | null, palette: readonly string[]) {
  if (score === null) return "#e7ebf2";
  return palette[Math.min(4, Math.max(0, Math.floor(score / 20)))] ?? palette[0];
}

function LayerSvg({ layer, projection, path, states, palette, opacity = 1, className }: { layer: MapLayerId; projection: GeoProjection; path: ReturnType<typeof geoPath>; states: FeatureCollection<Geometry, { name?: string }>; palette: readonly string[]; opacity?: number; className?: string }) {
  const marketMeasure = LAYERS.find((item) => item.id === layer)?.measure;
  const scores = useMemo(() => {
    if (!marketMeasure) return new Map<string, number | null>();
    const artifact = publicMarketGeographicArtifact(planAnalysisPrototype(`Show ${layer} across U.S. markets`), marketMeasure);
    return new Map(artifact.rows.map((row) => [row.entityId, row.score]));
  }, [layer, marketMeasure]);
  const ownership = useMemo(() => new Map(stateDogOwnership.map((item) => [item.fips, item.relativeScore])), []);

  return <svg className={className} viewBox="0 0 960 600" role="img" aria-label={`${LAYERS.find((item) => item.id === layer)?.label} map layer`} style={{ opacity }}>
    {layer === "pet_ownership" && states.features.map((state: Feature<Geometry>) => { const fips = String(state.id).padStart(2, "0"); return <path key={fips} d={path(state) ?? ""} fill={scoreFill(ownership.get(fips) ?? null, palette)} stroke="#fff" strokeWidth="1.1"/>; })}
    {marketMeasure && publicMarketMapGeoJson.features.map((market) => <path key={market.properties.cbsa_code} d={path(market) ?? ""} fill={scoreFill(scores.get(market.properties.cbsa_code) ?? null, palette)} stroke="rgba(255,255,255,.8)" strokeWidth=".28"><title>{market.properties.cbsa_name}</title></path>)}
    {layer === "footprint" && currentClinics.map((clinic) => { const point = projection([clinic.longitude, clinic.latitude]); return point ? <circle key={clinic.id} cx={point[0]} cy={point[1]} r="5.5" fill={palette[3]} stroke="#fff" strokeWidth="2"><title>{`Chewy Vet Care — ${clinic.name}, ${clinic.city}, ${clinic.state}`}</title></circle> : null; })}
    {layer === "footprint" && MODERN_ANIMAL_REGIONS.map((region) => { const point = projection([region.longitude, region.latitude]); return point ? <rect key={region.name} x={point[0] - 4.5} y={point[1] - 4.5} width="9" height="9" rx="1" fill="#dc8b4c" stroke="#fff" strokeWidth="1.7" transform={`rotate(45 ${point[0]} ${point[1]})`}><title>{`Modern Animal — ${region.name} operating region`}</title></rect> : null; })}
  </svg>;
}

export function WorkspaceOverview({ activeLayer, onLayerChange, evaluationQuestion }: { activeLayer: MapLayerId; onLayerChange: (layer: MapLayerId) => void; evaluationQuestion?: string }) {
  const [secondaryLayer, setSecondaryLayer] = useState<MapLayerId>("households");
  const [mode, setMode] = useState<CompareMode>("single");
  const [split, setSplit] = useState(50);
  const [indexOpen, setIndexOpen] = useState(false);
  const states = useMemo(() => { const topology = statesTopology as unknown as Topology<{ states: { type: "GeometryCollection"; geometries: never[] } }>; return feature(topology, topology.objects.states) as unknown as FeatureCollection<Geometry, { name?: string }>; }, []);
  const projection = useMemo(() => geoAlbersUsa().translate([480, 300]).scale(1220), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const primary = LAYERS.find((item) => item.id === activeLayer) ?? LAYERS[0];
  const effectiveSecondaryLayer = secondaryLayer === activeLayer ? (LAYERS.find((layer) => layer.id !== activeLayer) ?? LAYERS[0]).id : secondaryLayer;
  const secondary = LAYERS.find((item) => item.id === effectiveSecondaryLayer) ?? LAYERS[1];
  const quickViews = useMemo(() => evaluationQuestion ? viewsForQuestion(evaluationQuestion) : DEFAULT_VIEWS, [evaluationQuestion]);

  function applyView(view: ViewShortcut) {
    onLayerChange(view.primary);
    if (view.secondary && view.secondary !== view.primary) setSecondaryLayer(view.secondary);
    setMode(view.mode);
  }

  return <section className={styles.mapStage} aria-label="National market evidence map">
    <div className={styles.mapBackdrop}/>
    <div className={styles.mapCanvas}>
      <svg className={styles.baseMap} viewBox="0 0 960 600" aria-hidden="true">{states.features.map((state: Feature<Geometry>) => <path key={String(state.id)} d={path(state) ?? ""} fill="#edf1f6" stroke="#fff" strokeWidth="1.2"/>)}</svg>
      <LayerSvg layer={activeLayer} projection={projection} path={path} states={states} palette={mode === "blend" ? BLEND_PALETTES.blue : PALETTES.blue} opacity={mode === "blend" ? 0.5 : 1} className={`${styles.dataLayer} ${mode === "blend" ? styles.blendLayer : ""}`}/>
      {mode === "swipe" && <div className={styles.swipeLayer} style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}><LayerSvg layer={effectiveSecondaryLayer} projection={projection} path={path} states={states} palette={PALETTES.red} className={styles.dataLayer}/></div>}
      {mode === "blend" && <LayerSvg layer={effectiveSecondaryLayer} projection={projection} path={path} states={states} palette={BLEND_PALETTES.red} opacity={0.5} className={`${styles.dataLayer} ${styles.blendLayer}`}/>}
      {mode === "swipe" && <><div className={styles.splitLine} style={{ left: `${split}%` }}><span>↔</span></div><input className={styles.splitRange} type="range" min="5" max="95" value={split} onChange={(event) => setSplit(Number(event.target.value))} aria-label={`Compare ${secondary.label} with ${primary.label}`} aria-valuetext={`${split}% ${secondary.label}, ${100 - split}% ${primary.label}`}/></>}
    </div>

    <div className={styles.mapToolbar}>
      <header className={styles.mapTitle}><span>National evidence view</span><h2>{mode === "single" ? primary.label : `${primary.label} + ${secondary.label}`}</h2><p>{mode === "single" ? primary.detail : mode === "swipe" ? "Drag to compare the two views." : "Blue and red overlap at 50% opacity."}</p></header>
      <div className={styles.mapViewBar}>
        <nav className={styles.questionShelf} aria-label={evaluationQuestion ? "Suggested views for this evaluation" : "Quick views"}>
          <span>{evaluationQuestion ? "Suggested views" : "Quick views"}</span>
          {quickViews.map((view) => {
            const selected = activeLayer === view.primary && mode === view.mode && (!view.secondary || effectiveSecondaryLayer === view.secondary);
            return <button type="button" key={`${view.label}-${view.mode}`} className={selected ? styles.activeView : ""} aria-pressed={selected} onClick={() => applyView(view)}>{view.label}</button>;
          })}
        </nav>
        <div className={styles.layerControls}>
          <label><span>View A {mode !== "single" && "· blue"}</span><select value={activeLayer} onChange={(event) => onLayerChange(event.target.value as MapLayerId)}>{LAYERS.map((layer) => <option key={layer.id} value={layer.id}>{layer.label}</option>)}</select></label>
          {mode !== "single" && <label><span>View B · red</span><select value={effectiveSecondaryLayer} onChange={(event) => setSecondaryLayer(event.target.value as MapLayerId)}>{LAYERS.filter((layer) => layer.id !== activeLayer).map((layer) => <option key={layer.id} value={layer.id}>{layer.label}</option>)}</select></label>}
          <div className={styles.compareButtons} aria-label="Map comparison mode"><button type="button" className={mode === "single" ? styles.activeMode : ""} onClick={() => setMode("single")}>Single</button><button type="button" className={mode === "swipe" ? styles.activeMode : ""} onClick={() => setMode("swipe")}>Compare</button><button type="button" className={mode === "blend" ? styles.activeMode : ""} onClick={() => setMode("blend")}>Layer</button></div>
        </div>
      </div>
    </div>

    <div className={styles.mapIndex}>
      <div id="map-index-key" className={styles.mapIndexPanel} role="region" aria-label="Map key" hidden={!indexOpen}>
        <span className={styles.mapIndexTitle}>Map key</span>
        <div className={styles.mapLegend}>
          {mode === "single" ? <><span>Lower</span>{PALETTES.blue.map((color) => <i key={color} style={{ background: color }}/>) }<span>Higher</span></> : <><span className={styles.layerKey}><b className={styles.blueKey}/>View A</span><span className={styles.layerKey}><b className={styles.redKey}/>View B</span><span className={styles.overlapKey}><b/>Both</span></>}
          {activeLayer === "footprint" && <><b className={styles.chewyDot}/>Chewy<b className={styles.modernDot}/>Modern Animal</>}
        </div>
      </div>
      <button type="button" className={styles.mapIndexToggle} aria-expanded={indexOpen} aria-controls="map-index-key" aria-label={indexOpen ? "Hide map key" : "Show map key"} onClick={() => setIndexOpen((open) => !open)}>?</button>
    </div>
  </section>;
}
