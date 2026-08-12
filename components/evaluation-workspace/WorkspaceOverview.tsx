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
import { planAnalysisPrototype, publicMarketGeographicArtifact, statePetGeographicArtifact } from "@/lib/evaluation";
import type { PublicMarketMeasureId } from "@/lib/evaluation/geographic-measures";
import styles from "./evaluation-workspace.module.css";

export type MapLayerId = "footprint" | "population" | "households" | "income" | "housing" | "density" | "pet_ownership";
export type DepartmentPerspective = "marketing" | "cvc" | "pricing";
type CompareMode = "single" | "swipe" | "blend";
type MapEvidence = {
  id: string;
  title: string;
  measure: string;
  value: string;
  percentile: number | null;
  rank: number | null;
  cohortSize: number | null;
  evidenceStatus: string;
  observedPeriod: string;
  sourceTitle: string;
  x: number;
  y: number;
};
type ViewShortcut = { label: string; primary: MapLayerId; secondary?: MapLayerId; mode: CompareMode };
type DepartmentConfig = {
  label: string;
  defaultLayer: MapLayerId;
  defaultSecondary: MapLayerId;
  layers: MapLayerId[];
  quickViews: ViewShortcut[];
};

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

const DEPARTMENTS: Record<DepartmentPerspective, DepartmentConfig> = {
  marketing: {
    label: "Marketing",
    defaultLayer: "households",
    defaultSecondary: "income",
    layers: ["households", "pet_ownership", "income", "density", "population", "housing"],
    quickViews: [
      { label: "Audience scale", primary: "households", mode: "single" },
      { label: "Pet households", primary: "pet_ownership", mode: "single" },
      { label: "Spending context", primary: "income", mode: "single" },
      { label: "Market concentration", primary: "density", mode: "single" },
    ],
  },
  cvc: {
    label: "CVC",
    defaultLayer: "footprint",
    defaultSecondary: "pet_ownership",
    layers: ["footprint", "pet_ownership", "households", "density", "population", "income"],
    quickViews: [
      { label: "Clinic footprint", primary: "footprint", mode: "single" },
      { label: "Pet ownership", primary: "pet_ownership", mode: "single" },
      { label: "Household demand", primary: "households", mode: "single" },
      { label: "Access + pet demand", primary: "footprint", secondary: "pet_ownership", mode: "blend" },
    ],
  },
  pricing: {
    label: "Pricing",
    defaultLayer: "income",
    defaultSecondary: "households",
    layers: ["income", "households", "density", "population", "housing"],
    quickViews: [
      { label: "Affordability context", primary: "income", mode: "single" },
      { label: "Customer scale", primary: "households", mode: "single" },
      { label: "Market density", primary: "density", mode: "single" },
      { label: "Income + scale", primary: "income", secondary: "households", mode: "swipe" },
    ],
  },
};

function viewsForQuestion(question: string, department: DepartmentPerspective): ViewShortcut[] {
  const config = DEPARTMENTS[department];
  const preferred: MapLayerId[] = [];
  if (/clinic|whitespace|location|footprint/i.test(question)) preferred.push("footprint", "pet_ownership", "households", "density");
  if (/pet|dog|owner/i.test(question)) preferred.push("pet_ownership", "households", "density");
  if (/income|afford|spend|price/i.test(question)) preferred.push("income", "households");
  if (/dens|concentrat/i.test(question)) preferred.push("density", "population", "households");
  if (/population|people|market|scale/i.test(question)) preferred.push("population", "households", "density");
  if (preferred.length === 0) return config.quickViews;
  return config.quickViews
    .map((view, index) => {
      const primaryRank = preferred.indexOf(view.primary);
      const secondaryRank = view.secondary ? preferred.indexOf(view.secondary) : -1;
      const relevance = Math.min(primaryRank < 0 ? Number.MAX_SAFE_INTEGER : primaryRank, secondaryRank < 0 ? Number.MAX_SAFE_INTEGER : secondaryRank);
      return { view, index, relevance };
    })
    .sort((a, b) => a.relevance - b.relevance || a.index - b.index)
    .map(({ view }) => view);
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

function topPercentLabel(percentile: number | null) {
  if (percentile === null) return null;
  return `Top ${Math.max(1, Math.ceil(100 - percentile))}% nationally`;
}

function formatMapEvidenceValue(value: number | null | undefined, measureId: PublicMarketMeasureId) {
  if (value === null || value === undefined) return "Unavailable";
  if (measureId === "market_income") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: measureId === "market_density" ? 1 : 0 }).format(value);
}

function LayerSvg({ layer, projection, path, states, palette, opacity = 1, className, selectedId, onSelect }: { layer: MapLayerId; projection: GeoProjection; path: ReturnType<typeof geoPath>; states: FeatureCollection<Geometry, { name?: string }>; palette: readonly string[]; opacity?: number; className?: string; selectedId?: string; onSelect: (evidence: MapEvidence) => void }) {
  const marketMeasure = LAYERS.find((item) => item.id === layer)?.measure;
  const marketArtifact = useMemo(() => {
    if (!marketMeasure) return null;
    return publicMarketGeographicArtifact(planAnalysisPrototype(`Show ${layer} across U.S. markets`), marketMeasure);
  }, [layer, marketMeasure]);
  const marketRows = useMemo(() => new Map(marketArtifact?.rows.map((row) => [row.entityId, row]) ?? []), [marketArtifact]);
  const marketCohortSize = useMemo(() => marketArtifact?.rows.filter((row) => row.rank !== null).length ?? 0, [marketArtifact]);
  const petArtifact = useMemo(() => statePetGeographicArtifact(planAnalysisPrototype("Show dog ownership across U.S. states"), "dog"), []);
  const petRows = useMemo(() => new Map(petArtifact.rows.map((row) => [row.entityId, row])), [petArtifact]);
  const petCohortSize = useMemo(() => petArtifact.rows.filter((row) => row.rank !== null).length, [petArtifact]);
  const ownership = useMemo(() => new Map(stateDogOwnership.map((item) => [item.fips, item.relativeScore])), []);

  return <svg className={className} viewBox="0 0 960 600" role="img" aria-label={`${LAYERS.find((item) => item.id === layer)?.label} map layer`} style={{ opacity }}>
    {layer === "pet_ownership" && states.features.map((state: Feature<Geometry>) => { const fips = String(state.id).padStart(2, "0"); const row = petRows.get(fips); const [x, y] = path.centroid(state); return <path key={fips} d={path(state) ?? ""} className={selectedId === `pet_ownership:${fips}` ? styles.selectedRegion : styles.mapRegion} tabIndex={0} role="button" aria-label={`${row?.entityLabel ?? "State"}: ${row?.displayValue ?? "not reported"}`} fill={scoreFill(ownership.get(fips) ?? null, palette)} stroke="#fff" strokeWidth="1.1" onClick={() => onSelect({ id: `pet_ownership:${fips}`, title: row?.entityLabel ?? "State", measure: petArtifact.measure.label, value: row?.displayValue ?? "Not reported", percentile: row?.score ?? null, rank: row?.rank ?? null, cohortSize: petCohortSize, evidenceStatus: petArtifact.measure.evidenceStatus, observedPeriod: petArtifact.measure.observedPeriod, sourceTitle: petArtifact.measure.sourceTitle, x, y })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}/>; })}
    {marketMeasure && publicMarketMapGeoJson.features.map((market) => { const code = market.properties.cbsa_code; const row = marketRows.get(code); const [x, y] = path.centroid(market); return <path key={code} d={path(market) ?? ""} className={selectedId === `${layer}:${code}` ? styles.selectedRegion : styles.mapRegion} tabIndex={0} role="button" aria-label={`${row?.entityLabel ?? market.properties.cbsa_name}: ${row?.displayValue ?? "unavailable"}`} fill={scoreFill(row?.score ?? null, palette)} stroke="rgba(255,255,255,.8)" strokeWidth=".28" onClick={() => onSelect({ id: `${layer}:${code}`, title: row?.entityLabel ?? market.properties.cbsa_name, measure: marketArtifact?.measure.label ?? "Market measure", value: formatMapEvidenceValue(row?.rawValue, marketMeasure), percentile: row?.score ?? null, rank: row?.rank ?? null, cohortSize: marketCohortSize, evidenceStatus: marketArtifact?.measure.evidenceStatus ?? "Unknown", observedPeriod: marketArtifact?.measure.observedPeriod ?? "Unknown", sourceTitle: marketArtifact?.measure.sourceTitle ?? "Unknown source", x, y })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}><title>{market.properties.cbsa_name}</title></path>; })}
    {layer === "footprint" && currentClinics.map((clinic) => { const point = projection([clinic.longitude, clinic.latitude]); return point ? <circle key={clinic.id} cx={point[0]} cy={point[1]} r="5.5" className={selectedId === `footprint:${clinic.id}` ? styles.selectedMarker : styles.mapMarker} tabIndex={0} role="button" aria-label={`Chewy Vet Care ${clinic.name}, ${clinic.city}, ${clinic.state}`} fill={palette[3]} stroke="#fff" strokeWidth="2" onClick={() => onSelect({ id: `footprint:${clinic.id}`, title: clinic.name, measure: "Clinic footprint", value: clinic.address, percentile: null, rank: null, cohortSize: null, evidenceStatus: "Confirmed location", observedPeriod: "Current published location", sourceTitle: "Chewy Vet Care clinic page", x: point[0], y: point[1] })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}><title>{`Chewy Vet Care — ${clinic.name}, ${clinic.city}, ${clinic.state}`}</title></circle> : null; })}
    {layer === "footprint" && MODERN_ANIMAL_REGIONS.map((region) => { const point = projection([region.longitude, region.latitude]); return point ? <rect key={region.name} x={point[0] - 4.5} y={point[1] - 4.5} width="9" height="9" rx="1" className={selectedId === `footprint:modern:${region.name}` ? styles.selectedMarker : styles.mapMarker} tabIndex={0} role="button" aria-label={`Modern Animal ${region.name} operating region`} fill="#dc8b4c" stroke="#fff" strokeWidth="1.7" transform={`rotate(45 ${point[0]} ${point[1]})`} onClick={() => onSelect({ id: `footprint:modern:${region.name}`, title: region.name, measure: "Modern Animal footprint", value: "Published operating region", percentile: null, rank: null, cohortSize: null, evidenceStatus: "Reported region", observedPeriod: "Current public footprint", sourceTitle: "Modern Animal public locations", x: point[0], y: point[1] })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}><title>{`Modern Animal — ${region.name} operating region`}</title></rect> : null; })}
  </svg>;
}

export function WorkspaceOverview({ activeLayer, onLayerChange, evaluationQuestion }: { activeLayer: MapLayerId; onLayerChange: (layer: MapLayerId) => void; evaluationQuestion?: string }) {
  const [department, setDepartment] = useState<DepartmentPerspective>("cvc");
  const [secondaryLayer, setSecondaryLayer] = useState<MapLayerId>("households");
  const [mode, setMode] = useState<CompareMode>("single");
  const [split, setSplit] = useState(50);
  const [indexOpen, setIndexOpen] = useState(false);
  const [mapEvidence, setMapEvidence] = useState<MapEvidence | null>(null);
  const states = useMemo(() => { const topology = statesTopology as unknown as Topology<{ states: { type: "GeometryCollection"; geometries: never[] } }>; return feature(topology, topology.objects.states) as unknown as FeatureCollection<Geometry, { name?: string }>; }, []);
  const projection = useMemo(() => geoAlbersUsa().translate([480, 300]).scale(1220), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const departmentConfig = DEPARTMENTS[department];
  const availableLayers = LAYERS.filter((layer) => departmentConfig.layers.includes(layer.id));
  const primary = availableLayers.find((item) => item.id === activeLayer) ?? availableLayers[0];
  const effectiveSecondaryLayer = secondaryLayer === activeLayer || !departmentConfig.layers.includes(secondaryLayer)
    ? (availableLayers.find((layer) => layer.id !== activeLayer) ?? availableLayers[0]).id
    : secondaryLayer;
  const secondary = LAYERS.find((item) => item.id === effectiveSecondaryLayer) ?? LAYERS[1];
  const quickViews = useMemo(() => {
    const suggested = evaluationQuestion ? viewsForQuestion(evaluationQuestion, department) : [];
    return suggested.length > 0 ? suggested : departmentConfig.quickViews;
  }, [department, departmentConfig.quickViews, evaluationQuestion]);
  const visibleMapEvidence = mapEvidence && (mapEvidence.id.startsWith(`${activeLayer}:`) || (mode !== "single" && mapEvidence.id.startsWith(`${effectiveSecondaryLayer}:`))) ? mapEvidence : null;

  function applyView(view: ViewShortcut) {
    setMapEvidence(null);
    onLayerChange(view.primary);
    if (view.secondary && view.secondary !== view.primary) setSecondaryLayer(view.secondary);
    setMode(view.mode);
  }

  function changeDepartment(nextDepartment: DepartmentPerspective) {
    const next = DEPARTMENTS[nextDepartment];
    const nextViews = evaluationQuestion ? viewsForQuestion(evaluationQuestion, nextDepartment) : next.quickViews;
    const initialView = nextViews[0] ?? { label: next.label, primary: next.defaultLayer, mode: "single" as const };
    setDepartment(nextDepartment);
    setMapEvidence(null);
    onLayerChange(initialView.primary);
    setSecondaryLayer(initialView.secondary ?? next.defaultSecondary);
    setMode(initialView.mode);
  }

  return <section className={styles.mapStage} aria-label="National market evidence map">
    <div className={styles.mapBackdrop}/>
    <div className={styles.mapCanvas}>
      <svg className={styles.baseMap} viewBox="0 0 960 600" aria-hidden="true">{states.features.map((state: Feature<Geometry>) => <path key={String(state.id)} d={path(state) ?? ""} fill="#edf1f6" stroke="#fff" strokeWidth="1.2"/>)}</svg>
      <LayerSvg layer={activeLayer} projection={projection} path={path} states={states} palette={mode === "blend" ? BLEND_PALETTES.blue : PALETTES.blue} opacity={mode === "blend" ? 0.5 : 1} className={`${styles.dataLayer} ${mode === "blend" ? styles.blendLayer : ""}`} selectedId={visibleMapEvidence?.id} onSelect={setMapEvidence}/>
      {mode === "swipe" && <div className={styles.swipeLayer} style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}><LayerSvg layer={effectiveSecondaryLayer} projection={projection} path={path} states={states} palette={PALETTES.red} className={styles.dataLayer} selectedId={visibleMapEvidence?.id} onSelect={setMapEvidence}/></div>}
      {mode === "blend" && <LayerSvg layer={effectiveSecondaryLayer} projection={projection} path={path} states={states} palette={BLEND_PALETTES.red} opacity={0.5} className={`${styles.dataLayer} ${styles.blendLayer}`} selectedId={visibleMapEvidence?.id} onSelect={setMapEvidence}/>}
      {mode === "swipe" && <><div className={styles.splitLine} style={{ left: `${split}%` }}><span>↔</span></div><input className={styles.splitRange} type="range" min="5" max="95" value={split} onChange={(event) => setSplit(Number(event.target.value))} aria-label={`Compare ${secondary.label} with ${primary.label}`} aria-valuetext={`${split}% ${secondary.label}, ${100 - split}% ${primary.label}`}/></>}
      {visibleMapEvidence && <aside className={styles.mapEvidencePopup} style={{ left: `${Math.min(82, Math.max(18, visibleMapEvidence.x / 9.6))}%`, top: `${Math.min(74, Math.max(22, visibleMapEvidence.y / 6))}%` }} aria-live="polite">
        <button type="button" aria-label="Close market details" onClick={() => setMapEvidence(null)}>×</button>
        <span>{visibleMapEvidence.measure}</span>
        <h3>{visibleMapEvidence.title}</h3>
        <strong>{visibleMapEvidence.value}</strong>
        {visibleMapEvidence.rank !== null && visibleMapEvidence.cohortSize !== null && <div className={styles.mapEvidenceRank}><b>{topPercentLabel(visibleMapEvidence.percentile)}</b><small>Rank {visibleMapEvidence.rank} of {visibleMapEvidence.cohortSize}</small></div>}
        <footer><em>{visibleMapEvidence.evidenceStatus}</em><small>{visibleMapEvidence.observedPeriod} · {visibleMapEvidence.sourceTitle}</small></footer>
      </aside>}
    </div>

    <div className={styles.mapToolbar}>
      <header className={styles.mapTitle}>
        <label><span>Perspective</span><select aria-label="Department perspective" value={department} onChange={(event) => changeDepartment(event.target.value as DepartmentPerspective)}>{Object.entries(DEPARTMENTS).map(([id, config]) => <option key={id} value={id}>{config.label}</option>)}</select></label>
      </header>
      <div className={styles.mapViewBar}>
        <nav className={styles.questionShelf} aria-label={evaluationQuestion ? "Suggested views for this evaluation" : "Quick views"}>
          <span>{evaluationQuestion ? `${departmentConfig.label} suggestions` : `${departmentConfig.label} views`}</span>
          {quickViews.map((view) => {
            const selected = activeLayer === view.primary && mode === view.mode && (!view.secondary || effectiveSecondaryLayer === view.secondary);
            return <button type="button" key={`${view.label}-${view.mode}`} className={selected ? styles.activeView : ""} aria-pressed={selected} onClick={() => applyView(view)}>{view.label}</button>;
          })}
        </nav>
        <div className={styles.layerControls}>
          <label><span>View A {mode !== "single" && "· blue"}</span><select value={activeLayer} onChange={(event) => onLayerChange(event.target.value as MapLayerId)}>{availableLayers.map((layer) => <option key={layer.id} value={layer.id}>{layer.label}</option>)}</select></label>
          {mode !== "single" && <label><span>View B · red</span><select value={effectiveSecondaryLayer} onChange={(event) => setSecondaryLayer(event.target.value as MapLayerId)}>{availableLayers.filter((layer) => layer.id !== activeLayer).map((layer) => <option key={layer.id} value={layer.id}>{layer.label}</option>)}</select></label>}
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
