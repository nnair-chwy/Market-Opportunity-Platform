"use client";

import { useMemo, useState } from "react";
import { UnifiedEvaluatorMap } from "@/components/UnifiedEvaluatorMap";
import { publicMarketMapGeoJson, publicMarkets } from "@/lib/data/public-market-ui";
import { resolveMapTilerConfig } from "@/lib/data/cbsa-market-map";
import {
  formatPublicMarketValue,
  publicMarketGeographicArtifact,
  publicMarketMeasure,
  PUBLIC_MARKET_MEASURES,
  rawPublicMarketValue,
  type AnalysisPlan,
  type GeographicArtifact,
  type PublicMarketMeasureId,
} from "@/lib/evaluation";
import type { MarketComparisonEligibility } from "@/lib/market-attractiveness";
import type { MarketCategory } from "@/lib/workflow/market-workflow";
import styles from "./evaluation-workspace.module.css";

const mapConfig=resolveMapTilerConfig(process.env.NEXT_PUBLIC_MAP_STYLE_URL,process.env.NEXT_PUBLIC_MAPTILER_KEY);
const publicMeasureIds=new Set(PUBLIC_MARKET_MEASURES.map((measure)=>measure.id));

function initialMeasure(plan:AnalysisPlan):PublicMarketMeasureId{return publicMeasureIds.has(plan.activeMeasure as PublicMarketMeasureId)?plan.activeMeasure as PublicMarketMeasureId:"market_population";}

function questionMeasures(plan:AnalysisPlan){
  const requested=new Set(plan.intent.requestedMeasures.filter((id)=>publicMeasureIds.has(id as PublicMarketMeasureId)));
  const measures=PUBLIC_MARKET_MEASURES.filter((measure)=>requested.has(measure.id));
  return measures.length?measures:[publicMarketMeasure(initialMeasure(plan))];
}

function comparisonEligibility(selectedCode:string,comparisonCodes:readonly string[]):MarketComparisonEligibility{
  if(!selectedCode)return {allowed:false,reason:"Choose a market first."};
  if(comparisonCodes.includes(selectedCode))return {allowed:false,reason:"This market is already in the comparison."};
  if(comparisonCodes.length>=5)return {allowed:false,reason:"A comparison can include up to five markets."};
  const selected=publicMarkets.find((market)=>market.cbsa_code===selectedCode);
  const cohort=publicMarkets.find((market)=>market.cbsa_code===comparisonCodes[0])?.cbsa_type;
  if(cohort&&selected?.cbsa_type!==cohort)return {allowed:false,reason:"Compare metropolitan and micropolitan markets separately."};
  return {allowed:true,reason:null};
}

function PublicRanking({artifact,selectedCode,onChoose}:{artifact:GeographicArtifact;selectedCode:string;onChoose:(code:string)=>void}){
  const rows=artifact.rows.filter((row)=>row.rank!==null).slice(0,12);
  return <section className={styles.publicRanking} aria-label={`${artifact.measure.label} ranking`}><header><div><span className={styles.kicker}>2 · Compare</span><h3>Highest {artifact.measure.label.toLowerCase()}</h3><p>Observed values from the same versioned artifact as the map and selected-market detail.</p></div><span>{artifact.measure.evidenceStatus} · {artifact.measure.observedPeriod}</span></header><div>{rows.map((row)=><button key={row.entityId} className={selectedCode===row.entityId?styles.activePublicRow:""} onClick={()=>onChoose(row.entityId)}><em>{String(row.rank).padStart(2,"0")}</em><b>{row.entityLabel}</b><strong>{row.displayValue}</strong><small>{row.attributes.cbsaType} · {row.score?.toFixed(1)}th percentile</small></button>)}</div></section>;
}

function MarketDetailDrawer({code,measureId,artifact,measures,onClose}:{code:string;measureId:PublicMarketMeasureId;artifact:GeographicArtifact;measures:ReturnType<typeof questionMeasures>;onClose:()=>void}){
  const market=publicMarkets.find((item)=>item.cbsa_code===code);if(!market)return null;
  const selected=artifact.rows.find((row)=>row.entityId===code);
  return <aside className={styles.marketDrawer} aria-label={`Public market detail for ${market.cbsa_name}`}><header><div><span className={styles.miniLabel}>Selected Census market</span><h3>{market.cbsa_name}</h3><p>{market.cbsa_type} · CBSA {market.cbsa_code}</p></div><button onClick={onClose} aria-label="Close market detail">×</button></header><div className={styles.drawerScore}><strong>{selected?.score?.toFixed(1)??"—"}</strong><span>{artifact.measure.shortLabel} percentile across {artifact.comparison.cohort.toLowerCase()}</span></div><div className={styles.publicMetricDetails}>{measures.map((item)=>{const raw=rawPublicMarketValue(code,item.id);return <div key={item.id} className={item.id===measureId?styles.activeDetailMetric:""}><span>{item.label}</span><b>{raw===null?"Unavailable":formatPublicMarketValue(raw,item.id)}</b><small>{item.evidenceStatus}</small></div>;})}</div><div className={styles.drawerBoundary}><b>What this can support</b><p>{artifact.measure.limitation}</p></div><div className={styles.drawerSource}><b>Source</b><a href={artifact.measure.sourceUrl} target="_blank" rel="noreferrer">{artifact.measure.sourceTitle}</a><small>{artifact.measure.observedPeriod} · {artifact.measure.allowedUse.replaceAll('_',' ')}</small></div></aside>;
}

const PARTNERS={
  seo:{team:"SEO — David Lee",ask:"A location-keyword export from Conductor / SEMrush / GSC: keyword, location, device, date, rank, volume, intent, landing page, and source lineage.",why:"Adds local search demand and message-language evidence without treating search rank as sales demand."},
  gis:{team:"Real Estate Research / GIS — Ralph, with Matt Merrill",ask:"Versioned trade areas, drive times, competitor and clinic supply, site candidates, access, signage, lease, permitting, and broker evidence.",why:"Lets the national market screen narrow honestly into submarket and candidate-site diligence."},
  measurement:{team:"MSO Analytics & Measurement / MarTech",ask:"Geo-level campaign exposure, spend, reach, frequency, audience, conversion and experimental lift using common market IDs and dates.",why:"Turns public context into a testable campaign evaluation rather than a made-up opportunity score."},
  brand:{team:"Brand Marketing / Consumer Insights",ask:"Market-level aided and unaided awareness, message/creative test results, respondent definitions, sample sizes, dates, and confidence intervals.",why:"Supports location-specific wording and awareness recommendations with measured evidence."},
  data:{team:"Data Governance + EDS / Certified Data Layer",ask:"Use Alation to find governed assets and DBT to publish approved Snowflake aggregates keyed to CBSA, DMA, state and ZIP; expose them through an approved read path such as Omni, Sigma or Tableau.",why:"Chewy already has these Snowflake access paths. The workspace is not connected to them yet; the next step is a narrow governed view, not broad raw-table access."},
} as const;

function DataPartnerRequests({plan}:{plan:AnalysisPlan}){
  const keys=plan.analysisType==="campaign_opportunity"?["seo","measurement","brand","data"] as const:plan.analysisType==="market_attractiveness"?["gis","data","seo"] as const:["data","seo"] as const;
  return <section className={styles.dataPartners}><header><span className={styles.kicker}>3 · Improve</span><h3>Who can make this decision-ready?</h3><p>Specific, bounded requests—not a generic request for “all the data.”</p></header><div>{keys.map((key,index)=><article key={key}><span>{String(index+1).padStart(2,"0")}</span><div><b>{PARTNERS[key].team}</b><p>{PARTNERS[key].ask}</p><small>{PARTNERS[key].why}</small></div></article>)}</div></section>;
}

export function MarketLocationArtifact({onOpenSeattle,plan}:{onOpenSeattle:()=>void;plan:AnalysisPlan}){
  const [measureId,setMeasureId]=useState<PublicMarketMeasureId>(()=>initialMeasure(plan));const [selectedCode,setSelectedCode]=useState("");const [comparisonCodes,setComparisonCodes]=useState<string[]>([]);
  const measures=useMemo(()=>questionMeasures(plan),[plan]);
  const artifact=useMemo(()=>publicMarketGeographicArtifact(plan,measureId),[plan,measureId]);
  const visibleCodes=useMemo(()=>new Set(publicMarkets.map((market)=>market.cbsa_code)),[]);const categories=useMemo(()=>Object.fromEntries(publicMarkets.map((market)=>[market.cbsa_code,"unclassified" as MarketCategory])),[]);
  const scores=useMemo(()=>Object.fromEntries(artifact.rows.filter((row)=>row.score!==null).map((row)=>[row.entityId,row.score as number])),[artifact]);const measure=publicMarketMeasure(measureId);const eligibility=comparisonEligibility(selectedCode,comparisonCodes);const selectedMarket=publicMarkets.find((market)=>market.cbsa_code===selectedCode);const top=artifact.rows.find((row)=>row.rank===1);
  const purpose=plan.analysisType==="campaign_opportunity"?"This answers the public-context part of the campaign question. It does not yet rank campaign opportunity.":plan.analysisType==="market_attractiveness"?"This starts national market screening with governed context. It does not yet rank clinic opportunity.":"This directly compares the requested public measure across markets.";
  return <section className={styles.marketArtifact} aria-label="Public national market context artifact"><header><div><span className={styles.kicker}>1 · Look</span><h2>{plan.analysisType==="public_market_context"?`How does ${measure.label.toLowerCase()} vary across U.S. markets?`:plan.analysisType==="campaign_opportunity"?"What public market context is available for this campaign question?":"What public market context is available for clinic screening?"}</h2><p>{measures.length>1?"The map includes only the compatible measures named in the question.":"The map uses the compatible measure identified from the question; unrelated dimensions stay out of the evaluation."}</p></div><span className={styles.publicBadge}>Confirmed public context</span></header>
    <div className={styles.nationalLayerBar}><b>{measures.length>1?"Measures requested":"Mapped measure"}</b>{measures.map((item)=>measures.length>1?<button key={item.id} className={measureId===item.id?styles.activeMetric:""} onClick={()=>setMeasureId(item.id)}>{item.shortLabel}</button>:<em key={item.id}>{item.shortLabel}</em>)}<span>Deeper blue = higher national percentile</span></div>
    <div className={`${styles.marketInspectLayout} ${selectedMarket?styles.drawerOpen:""}`}><UnifiedEvaluatorMap config={mapConfig} collection={publicMarketMapGeoJson} visibleMarketCodes={visibleCodes} selectedMarketCode={selectedCode} comparisonMarkets={comparisonCodes.map((code)=>({code,name:publicMarkets.find((market)=>market.cbsa_code===code)?.cbsa_name??code}))} comparisonAddEligibility={eligibility} comparisonStatus={`${comparisonCodes.length} of 5 markets selected`} workspaceMode="markets" marketCategories={categories} marketScores={scores} marketScoreMetadata={{configurationVersion:artifact.schemaVersion,configurationFingerprint:artifact.artifactId}} marketScoreLabel={`${artifact.measure.label} percentile`} marketScoreBoundary={artifact.measure.limitation} locations={[]} selectedLocationId={null} onChooseMarket={setSelectedCode} onAddMarketToComparison={()=>{if(eligibility.allowed)setComparisonCodes((current)=>[...current,selectedCode]);}} onRemoveMarketFromComparison={(code)=>setComparisonCodes((current)=>current.filter((item)=>item!==code))} onClearMarketComparison={()=>setComparisonCodes([])} onOpenMarketComparison={()=>document.getElementById("public-market-ranking")?.scrollIntoView({behavior:"smooth"})} onChooseLocation={()=>{}} onReset={()=>setSelectedCode("")}/>{selectedMarket&&<MarketDetailDrawer code={selectedCode} measureId={measureId} artifact={artifact} measures={measures} onClose={()=>setSelectedCode("")}/>}</div>
    <section className={styles.mapMethodSummary} aria-label="How this map was made"><b>How this map was made</b><p>Each area is a Census Core Based Statistical Area; deeper blue means a higher percentile. {artifact.measure.formula} {top?`${top.entityLabel} has the highest available value at ${top.displayValue}. `:""}{purpose} Best next data: {plan.missingMeasures.slice(0,3).join("; ")||"none for this descriptive comparison"}.</p><span>{artifact.measure.evidenceStatus} · {artifact.measure.observedPeriod} · {artifact.schemaVersion}</span></section>
    {plan.analysisType==="market_attractiveness"&&selectedCode==="42660"&&<div className={styles.marketSelection}><div><span>Next supported evaluation level</span><strong>Greater Seattle selected</strong><small>Open the labeled illustrative regional comparison.</small></div><button onClick={onOpenSeattle}>Compare Seattle submarkets →</button></div>}
    <div id="public-market-ranking"><PublicRanking artifact={artifact} selectedCode={selectedCode} onChoose={setSelectedCode}/></div><DataPartnerRequests plan={plan}/>
  </section>;
}
