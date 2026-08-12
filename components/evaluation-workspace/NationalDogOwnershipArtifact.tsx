"use client";

import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import statesTopology from "us-atlas/states-10m.json";
import { stateDogOwnership } from "@/lib/data/state-dog-ownership";
import { statePetGeographicArtifact, type AnalysisPlan, type StatePetLayer } from "@/lib/evaluation";
import styles from "./evaluation-workspace.module.css";

function fill(value: number | null) {
  if (value === null) return "#d8dee8";
  if (value >= 80) return "#075c49";
  if (value >= 60) return "#16856f";
  if (value >= 40) return "#58ad91";
  if (value >= 20) return "#a8d4bf";
  return "#e2eee7";
}

export function NationalDogOwnershipArtifact({plan}:{plan:AnalysisPlan}) {
  const initialLayer:StatePetLayer = plan.activeMeasure==="cat_ownership" ? "cat" : plan.activeMeasure==="dog_income_proxy" ? "dogIncome" : "dog";
  const initialArtifact=statePetGeographicArtifact(plan,initialLayer);
  const [layer, setLayer] = useState<StatePetLayer>(initialLayer);
  const [selectedFips, setSelectedFips] = useState(()=>initialArtifact.defaultSelectedEntityId??"");
  const [hoveredFips, setHoveredFips] = useState("");
  const artifact = useMemo(() => statePetGeographicArtifact(plan,layer), [plan, layer]);
  const artifactRows = useMemo(() => new Map(artifact.rows.map((row) => [row.entityId, row])), [artifact]);
  const records = useMemo(() => new Map(stateDogOwnership.map((item) => [item.fips, item])), []);
  const states = useMemo(() => {
    const topology = statesTopology as unknown as Topology<{ states: { type: "GeometryCollection"; geometries: never[] } }>;
    return feature(topology, topology.objects.states) as unknown as FeatureCollection<Geometry, { name?: string }>;
  }, []);
  const path = useMemo(() => geoPath(geoAlbersUsa().translate([480, 300]).scale(1220)), []);
  const selected = records.get(selectedFips) ?? records.get(artifact.defaultSelectedEntityId??"") ?? stateDogOwnership[0];
  const selectedArtifactRow=artifactRows.get(selected.fips);
  const layerLabel=artifact.measure.label;
  const selectedScore=selectedArtifactRow?.score??null;
  const selectedRank=selectedArtifactRow?.rank??null;
  const selectedRate=layer==="cat"?selected.catHouseholdRate:selected.householdRate;
  function chooseLayer(next:StatePetLayer){const nextArtifact=statePetGeographicArtifact(plan,next);setLayer(next);setSelectedFips(nextArtifact.defaultSelectedEntityId??"");setHoveredFips("");}

  return <section className={styles.nationalMetricArtifact} aria-label="Nationwide dog ownership score artifact">
    <header><div><span className={styles.kicker}>1 · Look across the country</span><h2>{layerLabel}</h2><p>{layer==="dogIncome"?"Darker states combine stronger reported dog ownership with a higher income proxy. This does not measure willingness to pay.":`Darker states have a stronger reported ${layer==="cat"?"cat":"dog"}-owning-household signal. Select any state to inspect the evidence.`}</p></div><span className={styles.reportedBadge}>{layer==="dogIncome"?"Cross-source proxy":"Reported survey · 2016"}</span></header>
    <div className={styles.nationalLayerBar} aria-label="Map data layer"><b>Color by</b><button className={layer === "dog" ? styles.activeMetric : ""} onClick={() => chooseLayer("dog")}>Dog ownership</button><button className={layer === "cat" ? styles.activeMetric : ""} onClick={() => chooseLayer("cat")}>Cat ownership</button><button className={layer === "dogIncome" ? styles.activeMetric : ""} onClick={() => chooseLayer("dogIncome")}>Dog × income proxy</button><span>{artifact.schemaVersion} · {artifact.measure.observedPeriod}</span></div>
    <div className={styles.nationalMapGrid}>
      <div className={styles.nationalMapWrap}>
        <svg viewBox="0 0 960 600" role="img" aria-label={`United States map colored by ${layerLabel}`}>
          {states.features.filter((state) => records.has(String(state.id).padStart(2, "0"))).map((state: Feature<Geometry>) => {
            const fips = String(state.id).padStart(2, "0");
            const item = records.get(fips)!;
            const value = artifactRows.get(fips)?.score ?? null;
            const active = fips === selectedFips || fips === hoveredFips;
            return <path key={fips} d={path(state) ?? ""} fill={fill(value)} stroke={active ? "#101d3a" : "#ffffff"} strokeWidth={active ? 2.4 : 1.1} role="button" tabIndex={0} aria-label={`${item.name}: ${value === null ? "no reported value" : `${layerLabel} score ${value}`}`} onMouseEnter={() => setHoveredFips(fips)} onMouseLeave={() => setHoveredFips("")} onFocus={() => setHoveredFips(fips)} onBlur={() => setHoveredFips("")} onClick={() => setSelectedFips(fips)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedFips(fips); }} />;
          })}
        </svg>
        <div className={styles.nationalLegend}><span>Lower</span>{["#e2eee7", "#a8d4bf", "#58ad91", "#16856f", "#075c49"].map((color) => <i key={color} style={{ background: color }} />)}<span>Higher</span><em><i /> No reported value</em></div>
      </div>
      <aside className={styles.stateInspect} aria-live="polite">
        <span className={styles.miniLabel}>2 · Inspect a state</span><div className={styles.stateTitle}><div><strong>{selected.name}</strong><small>{selected.code}</small></div><b>{selectedScore ?? "—"}</b></div>
        <p>{layerLabel} score</p>
        <dl><div><dt>{layer==="cat"?"Cat-owning households":"Dog-owning households"}</dt><dd>{selectedRate === null ? "Not reported" : `${selectedRate.toFixed(1)}%`}</dd></div>{layer==="dogIncome"&&<><div><dt>Median household income</dt><dd>${selected.medianHouseholdIncome.toLocaleString("en-US")}</dd></div><div><dt>Income percentile score</dt><dd>{selected.incomeRelativeScore}</dd></div></>}<div><dt>Rank among reported areas</dt><dd>{selectedRank === null ? "—" : `${selectedRank} of 49`}</dd></div><div><dt>Evidence</dt><dd>{layer==="dogIncome"?"Derived from two public estimates":"Confirmed survey estimate"}</dd></div></dl>
        <div className={styles.stateCallout}><b>{layer==="dogIncome"?"Interpret carefully":"What this means"}</b><p>{selectedArtifactRow?.rawValue === null ? "The source has no compatible state estimate here, so the artifact does not impute one." : layer==="dogIncome"?artifact.measure.limitation:`${selected.name} is ${selectedRate !== null && selectedRate >= (layer==="cat"?25.4:38.4) ? "above" : "below"} the reported U.S. ${layer==="cat"?"cat":"dog"} ownership rate. This is context, not a site recommendation.`}</p></div>
      </aside>
    </div>
    <footer><div><span className={styles.miniLabel}>3 · Verify the measure</span><strong>{artifact.measure.sourceTitle}</strong><p>{artifact.measure.formula}</p></div><a href={artifact.measure.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a><small>{artifact.measure.limitation}</small></footer>
  </section>;
}
