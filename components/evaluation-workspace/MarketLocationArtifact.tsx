"use client";

import { useEffect, useMemo, useState } from "react";
import { UnifiedEvaluatorMap } from "@/components/UnifiedEvaluatorMap";
import { publicMarketMapGeoJson, publicMarkets } from "@/lib/data/public-market-ui";
import { resolveMapTilerConfig } from "@/lib/data/cbsa-market-map";
import {
  formatPublicMarketValue,
  publicMarketMeasure,
  publicMarketMeasureScores,
  PUBLIC_MARKET_MEASURES,
  rankedPublicMarkets,
  rawPublicMarketValue,
  type AnalysisPlan,
  type PublicMarketMeasureId,
} from "@/lib/evaluation";
import type { MarketComparisonEligibility } from "@/lib/market-attractiveness";
import type { MarketCategory } from "@/lib/workflow/market-workflow";
import styles from "./evaluation-workspace.module.css";

const mapConfig=resolveMapTilerConfig(process.env.NEXT_PUBLIC_MAP_STYLE_URL,process.env.NEXT_PUBLIC_MAPTILER_KEY);
const publicMeasureIds=new Set(PUBLIC_MARKET_MEASURES.map((measure)=>measure.id));

function initialMeasure(plan:AnalysisPlan):PublicMarketMeasureId{return publicMeasureIds.has(plan.activeMeasure as PublicMarketMeasureId)?plan.activeMeasure as PublicMarketMeasureId:"market_population";}

function comparisonEligibility(selectedCode:string,comparisonCodes:readonly string[]):MarketComparisonEligibility{
  if(!selectedCode)return {allowed:false,reason:"Choose a market first."};
  if(comparisonCodes.includes(selectedCode))return {allowed:false,reason:"This market is already in the comparison."};
  if(comparisonCodes.length>=5)return {allowed:false,reason:"A comparison can include up to five markets."};
  const selected=publicMarkets.find((market)=>market.cbsa_code===selectedCode);
  const cohort=publicMarkets.find((market)=>market.cbsa_code===comparisonCodes[0])?.cbsa_type;
  if(cohort&&selected?.cbsa_type!==cohort)return {allowed:false,reason:"Compare metropolitan and micropolitan markets separately."};
  return {allowed:true,reason:null};
}

function PublicRanking({measureId,selectedCode,onChoose}:{measureId:PublicMarketMeasureId;selectedCode:string;onChoose:(code:string)=>void}){
  const measure=publicMarketMeasure(measureId);const scores=publicMarketMeasureScores(measureId);const rows=rankedPublicMarkets(measureId);
  return <section className={styles.publicRanking} aria-label={`${measure.label} ranking`}><header><div><span className={styles.kicker}>2 · Compare</span><h3>Highest {measure.label.toLowerCase()}</h3><p>Observed Census values. Select a row to inspect the same market on the map.</p></div><span>Public data · 2024 ACS</span></header><div>{rows.map((row,index)=><button key={row.market.cbsa_code} className={selectedCode===row.market.cbsa_code?styles.activePublicRow:""} onClick={()=>onChoose(row.market.cbsa_code)}><em>{String(index+1).padStart(2,"0")}</em><b>{row.market.cbsa_name}</b><strong>{formatPublicMarketValue(row.value,measureId)}</strong><small>{row.market.cbsa_type} · {scores[row.market.cbsa_code]?.toFixed(1)}th percentile</small></button>)}</div></section>;
}

function MarketDetailDrawer({code,measureId,onClose}:{code:string;measureId:PublicMarketMeasureId;onClose:()=>void}){
  const market=publicMarkets.find((item)=>item.cbsa_code===code);if(!market)return null;
  const measure=publicMarketMeasure(measureId);const scores=publicMarketMeasureScores(measureId);const value=rawPublicMarketValue(code,measureId);
  return <aside className={styles.marketDrawer} aria-label={`Public market detail for ${market.cbsa_name}`}><header><div><span className={styles.miniLabel}>Selected Census market</span><h3>{market.cbsa_name}</h3><p>{market.cbsa_type} · CBSA {market.cbsa_code}</p></div><button onClick={onClose} aria-label="Close market detail">×</button></header><div className={styles.drawerScore}><strong>{scores[code]?.toFixed(1)??"—"}</strong><span>{measure.shortLabel} percentile across available U.S. CBSAs</span></div><div className={styles.publicMetricDetails}>{PUBLIC_MARKET_MEASURES.map((item)=>{const raw=rawPublicMarketValue(code,item.id);return <div key={item.id} className={item.id===measureId?styles.activeDetailMetric:""}><span>{item.label}</span><b>{raw===null?"Unavailable":formatPublicMarketValue(raw,item.id)}</b><small>{item.evidenceStatus}</small></div>;})}</div><div className={styles.drawerBoundary}><b>What this can support</b><p>{measure.limitation}</p></div><div className={styles.drawerSource}><b>Source</b><a href={measure.sourceUrl} target="_blank" rel="noreferrer">{measure.sourceTitle}</a><small>Observed through 2024 · governed public context</small></div></aside>;
}

const PARTNERS={
  seo:{team:"SEO — David Lee",ask:"A location-keyword export from Conductor / SEMrush / GSC: keyword, location, device, date, rank, volume, intent, landing page, and source lineage.",why:"Adds local search demand and message-language evidence without treating search rank as sales demand."},
  gis:{team:"Real Estate Research / GIS — Ralph, with Matt Merrill",ask:"Versioned trade areas, drive times, competitor and clinic supply, site candidates, access, signage, lease, permitting, and broker evidence.",why:"Lets the national market screen narrow honestly into submarket and candidate-site diligence."},
  measurement:{team:"MSO Analytics & Measurement / MarTech",ask:"Geo-level campaign exposure, spend, reach, frequency, audience, conversion and experimental lift using common market IDs and dates.",why:"Turns public context into a testable campaign evaluation rather than a made-up opportunity score."},
  brand:{team:"Brand Marketing / Consumer Insights",ask:"Market-level aided and unaided awareness, message/creative test results, respondent definitions, sample sizes, dates, and confidence intervals.",why:"Supports location-specific wording and awareness recommendations with measured evidence."},
  data:{team:"Data Governance + EDS / Certified Data Layer",ask:"Use Alation to find governed assets and DBT to publish approved Snowflake aggregates keyed to CBSA, DMA, state and ZIP; expose them through an approved read path such as Omni, Sigma or Tableau.",why:"Chewy already has these Snowflake access paths. This prototype is not connected to them yet; the next step is a narrow governed view, not broad raw-table access."},
} as const;

function DataPartnerRequests({plan}:{plan:AnalysisPlan}){
  const keys=plan.analysisType==="campaign_opportunity"?["seo","measurement","brand","data"] as const:plan.analysisType==="market_attractiveness"?["gis","data","seo"] as const:["data","seo"] as const;
  return <section className={styles.dataPartners}><header><span className={styles.kicker}>3 · Improve</span><h3>Who can make this decision-ready?</h3><p>Specific, bounded requests—not a generic request for “all the data.”</p></header><div>{keys.map((key,index)=><article key={key}><span>{String(index+1).padStart(2,"0")}</span><div><b>{PARTNERS[key].team}</b><p>{PARTNERS[key].ask}</p><small>{PARTNERS[key].why}</small></div></article>)}</div></section>;
}

export function MarketLocationArtifact({onOpenSeattle,plan}:{onOpenSeattle:()=>void;plan:AnalysisPlan}){
  const [measureId,setMeasureId]=useState<PublicMarketMeasureId>(()=>initialMeasure(plan));const [selectedCode,setSelectedCode]=useState("");const [comparisonCodes,setComparisonCodes]=useState<string[]>([]);
  useEffect(()=>setMeasureId(initialMeasure(plan)),[plan.planId,plan.activeMeasure]);
  const visibleCodes=useMemo(()=>new Set(publicMarkets.map((market)=>market.cbsa_code)),[]);const categories=useMemo(()=>Object.fromEntries(publicMarkets.map((market)=>[market.cbsa_code,"unclassified" as MarketCategory])),[]);
  const scores=useMemo(()=>publicMarketMeasureScores(measureId),[measureId]);const measure=publicMarketMeasure(measureId);const eligibility=comparisonEligibility(selectedCode,comparisonCodes);const selectedMarket=publicMarkets.find((market)=>market.cbsa_code===selectedCode);const top=rankedPublicMarkets(measureId,1)[0];
  const purpose=plan.analysisType==="campaign_opportunity"?"This answers the public-context part of the campaign question. It does not yet rank campaign opportunity.":plan.analysisType==="market_attractiveness"?"This starts national market screening with governed context. It does not yet rank clinic opportunity.":"This directly compares the requested public measure across markets.";
  return <section className={styles.marketArtifact} aria-label="Public national market context artifact"><header><div><span className={styles.kicker}>1 · Look</span><h2>{plan.analysisType==="public_market_context"?`How does ${measure.label.toLowerCase()} vary across U.S. markets?`:plan.analysisType==="campaign_opportunity"?"What public market context is available for this campaign question?":"What public market context is available for clinic screening?"}</h2><p>Choose one measure, scan the color pattern, then click any market for its actual values and evidence boundary.</p></div><span className={styles.publicBadge}>Confirmed public context</span></header>
    <div className={styles.nationalLayerBar}><b>Color the map by</b>{PUBLIC_MARKET_MEASURES.map((item)=><button key={item.id} className={measureId===item.id?styles.activeMetric:""} onClick={()=>setMeasureId(item.id)}>{item.shortLabel}</button>)}<span>Deeper blue = higher national percentile</span></div>
    <div className={`${styles.marketInspectLayout} ${selectedMarket?styles.drawerOpen:""}`}><UnifiedEvaluatorMap config={mapConfig} collection={publicMarketMapGeoJson} visibleMarketCodes={visibleCodes} selectedMarketCode={selectedCode} comparisonMarkets={comparisonCodes.map((code)=>({code,name:publicMarkets.find((market)=>market.cbsa_code===code)?.cbsa_name??code}))} comparisonAddEligibility={eligibility} comparisonStatus={`${comparisonCodes.length} of 5 markets selected`} workspaceMode="markets" marketCategories={categories} marketScores={scores} marketScoreMetadata={{configurationVersion:`census-acs-2024-${measureId}`,configurationFingerprint:`SRC-016:${measure.metricKey}`}} marketScoreLabel={`${measure.label} percentile`} marketScoreBoundary={measure.limitation} locations={[]} selectedLocationId={null} onChooseMarket={setSelectedCode} onAddMarketToComparison={()=>{if(eligibility.allowed)setComparisonCodes((current)=>[...current,selectedCode]);}} onRemoveMarketFromComparison={(code)=>setComparisonCodes((current)=>current.filter((item)=>item!==code))} onClearMarketComparison={()=>setComparisonCodes([])} onOpenMarketComparison={()=>document.getElementById("public-market-ranking")?.scrollIntoView({behavior:"smooth"})} onChooseLocation={()=>{}} onReset={()=>setSelectedCode("")}/>{selectedMarket&&<MarketDetailDrawer code={selectedCode} measureId={measureId} onClose={()=>setSelectedCode("")}/>}</div>
    <section className={styles.mapMethodSummary} aria-label="How this map was made"><b>How this map was made</b><p>Each area is a Census Core Based Statistical Area. The map colors its observed {measure.label.toLowerCase()} by percentile across markets with data; deeper blue means a higher percentile. {top?`${top.market.cbsa_name} has the highest available value at ${formatPublicMarketValue(top.value,measureId)}. `:""}{purpose} Best next data: {plan.missingMeasures.slice(0,3).join("; ")||"none for this descriptive comparison"}.</p><span>{measure.evidenceStatus} · Census ACS 2024</span></section>
    {plan.analysisType==="market_attractiveness"&&selectedCode==="42660"&&<div className={styles.marketSelection}><div><span>Next supported evaluation level</span><strong>Greater Seattle selected</strong><small>Open the labeled synthetic regional prototype.</small></div><button onClick={onOpenSeattle}>Compare Seattle submarkets →</button></div>}
    <div id="public-market-ranking"><PublicRanking measureId={measureId} selectedCode={selectedCode} onChoose={setSelectedCode}/></div><DataPartnerRequests plan={plan}/>
  </section>;
}
