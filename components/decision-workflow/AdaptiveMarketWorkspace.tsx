"use client";

import { useMemo, useState } from "react";
import { UnifiedEvaluatorMap } from "@/components/UnifiedEvaluatorMap";
import {
  PUBLIC_MARKET_METRICS,
  publicMarketMapGeoJson,
  publicMarkets,
} from "@/lib/data/public-market-ui";
import { resolveMapTilerConfig } from "@/lib/data/cbsa-market-map";
import type { CbsaAcsMetricKey } from "@/lib/data/cbsa-acs";
import { compare_cohort, DETERMINISTIC_OPERATOR_VERSION } from "@/lib/evaluation-operators";
import { currentClinics } from "@/lib/locations/map-data";
import type { UnifiedMapLocation } from "@/lib/locations/unified-map";
import {
  CURRENT_CLINIC_MARKET_IDS,
  INITIAL_MARKET_WORKFLOW_RECORDS,
  currentMarketIds,
  marketCategoryMap,
  matchesWorkflowCategory,
  type WorkflowCategory,
} from "@/lib/workflow/market-workflow";

const mapConfig = resolveMapTilerConfig(
  process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  process.env.NEXT_PUBLIC_MAPTILER_KEY,
);

function formatValue(value: number | null, metric: CbsaAcsMetricKey) {
  if (value === null) return "Unavailable";
  if (metric === "median_household_income") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: metric === "population_density" ? 1 : 0 }).format(value);
}

const clinicLocations: readonly UnifiedMapLocation[] = currentClinics.map((clinic) => ({
  id: clinic.id,
  marketId: CURRENT_CLINIC_MARKET_IDS[clinic.market] ?? null,
  name: clinic.name,
  market: clinic.market,
  city: clinic.city,
  state: clinic.state,
  latitude: clinic.latitude,
  longitude: clinic.longitude,
  category: "current",
  evidenceStatus: "Confirmed",
  sourceId: "SRC-009",
  statusLabel: "Confirmed public clinic; coordinates derived from its public address",
  address: clinic.address,
}));

export function AdaptiveMarketWorkspace({ initialMetric = "total_population" }: { initialMetric?: CbsaAcsMetricKey }) {
  const [metric, setMetric] = useState<CbsaAcsMetricKey>(initialMetric);
  const [includeMicropolitan, setIncludeMicropolitan] = useState(false);
  const [category, setCategory] = useState<WorkflowCategory>("all");
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState("42660");
  const [comparisonCodes, setComparisonCodes] = useState<string[]>([]);

  const categories = useMemo(() => marketCategoryMap(
    publicMarkets.map((market) => market.cbsa_code),
    currentMarketIds(currentClinics.map((clinic) => clinic.market)),
    INITIAL_MARKET_WORKFLOW_RECORDS,
  ), []);

  const cohort = useMemo(() => publicMarkets.filter((market) =>
    (includeMicropolitan || market.cbsa_type === "metropolitan") &&
    matchesWorkflowCategory(categories[market.cbsa_code] ?? "unclassified", category),
  ), [categories, category, includeMicropolitan]);

  const comparisons = useMemo(() => compare_cohort({
    operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
    decisionLayer: "market_attractiveness",
    comparisonVersion: `public-census-${metric}-v1`,
    cohortId: `${includeMicropolitan ? "all" : "metropolitan"}-${category}`,
    direction: "higher_is_better",
    entities: cohort.flatMap((market) => {
      const value = market.acs?.metrics[metric].raw_value ?? null;
      return value === null ? [] : [{
        entityId: market.cbsa_code,
        cohortId: `${includeMicropolitan ? "all" : "metropolitan"}-${category}`,
        value,
        provenance: { sourceIds: ["SRC-016"], inputVersion: "acs-2024-5yr", transformationVersion: "public-percentile-v1" },
      }];
    }),
  }), [category, cohort, includeMicropolitan, metric]);

  const scores = useMemo(() => Object.fromEntries(comparisons.map((item) => [item.entityId, item.percentile])), [comparisons]);
  const ranks = useMemo(() => new Map(comparisons.map((item) => [item.entityId, item.rank])), [comparisons]);
  const visibleCodes = useMemo(() => new Set(cohort.map((market) => market.cbsa_code)), [cohort]);
  const activeSelectedCode = selectedCode && visibleCodes.has(selectedCode) ? selectedCode : cohort[0]?.cbsa_code ?? "";
  const selected = publicMarkets.find((market) => market.cbsa_code === activeSelectedCode) ?? null;
  const selectedValue = selected?.acs?.metrics[metric].raw_value ?? null;
  const metricOption = PUBLIC_MARKET_METRICS.find((item) => item.key === metric) ?? PUBLIC_MARKET_METRICS[0];
  const comparisonMarkets = comparisonCodes.flatMap((code) => {
    const market = publicMarkets.find((item) => item.cbsa_code === code);
    return market ? [{ code, name: market.cbsa_name }] : [];
  });
  const listed = cohort
    .filter((market) => `${market.cbsa_name} ${market.cbsa_code}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => (ranks.get(left.cbsa_code) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(right.cbsa_code) ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 100);

  function addSelected() {
    if (!activeSelectedCode || comparisonCodes.includes(activeSelectedCode) || comparisonCodes.length >= 5) return;
    setComparisonCodes((current) => [...current, activeSelectedCode]);
  }

  return (
    <section className="adaptive-market-workspace" aria-labelledby="adaptive-map-title">
      <header className="adaptive-map-header">
        <div><span className="eyebrow">Interactive evidence map</span><h2 id="adaptive-map-title">Compare public market context</h2><p>Filter the national cohort, change the measure, inspect a market, and compare up to five selections.</p></div>
        <div className="adaptive-map-controls">
          <label>Measure<select value={metric} onChange={(event) => setMetric(event.target.value as CbsaAcsMetricKey)}>{PUBLIC_MARKET_METRICS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          <label>Workflow<select value={category} onChange={(event) => { setCategory(event.target.value as WorkflowCategory); setComparisonCodes([]); }}>{["all", "current", "potential", "evaluated"].map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
          <label className="adaptive-check"><input type="checkbox" checked={includeMicropolitan} onChange={(event) => { setIncludeMicropolitan(event.target.checked); setComparisonCodes([]); }} />Include micropolitan</label>
        </div>
      </header>
      <UnifiedEvaluatorMap
        config={mapConfig}
        collection={publicMarketMapGeoJson}
        visibleMarketCodes={visibleCodes}
        selectedMarketCode={activeSelectedCode}
        comparisonMarkets={comparisonMarkets}
        comparisonAddEligibility={{ allowed: Boolean(activeSelectedCode) && !comparisonCodes.includes(activeSelectedCode) && comparisonCodes.length < 5, reason: comparisonCodes.length >= 5 ? "A comparison can include up to five markets." : null }}
        comparisonStatus={`${comparisonCodes.length} of 5 markets selected`}
        workspaceMode="markets"
        marketCategories={categories}
        marketScores={scores}
        marketScoreMetadata={{ configurationVersion: "public-percentile-v1", configurationFingerprint: "SRC-016" }}
        marketScoreLabel={`${metricOption.label} percentile`}
        marketScoreBoundary="Deterministic comparison of one public measure. Not an opportunity score or recommendation."
        locations={clinicLocations}
        selectedLocationId={null}
        onChooseMarket={setSelectedCode}
        onAddMarketToComparison={addSelected}
        onRemoveMarketFromComparison={(code) => setComparisonCodes((current) => current.filter((item) => item !== code))}
        onClearMarketComparison={() => setComparisonCodes([])}
        onOpenMarketComparison={() => document.getElementById("adaptive-market-detail")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        onChooseLocation={() => undefined}
        onReset={() => setSelectedCode("")}
      />
      <div className="adaptive-market-detail" id="adaptive-market-detail">
        <aside><label>Find a market<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or CBSA code" /></label><div className="adaptive-market-list" role="listbox">{listed.map((market) => <button key={market.cbsa_code} className={activeSelectedCode === market.cbsa_code ? "active" : ""} onClick={() => setSelectedCode(market.cbsa_code)}><span><strong>{market.cbsa_name}</strong><small>CBSA {market.cbsa_code}</small></span><b>{scores[market.cbsa_code]?.toFixed(1) ?? "—"}</b></button>)}</div></aside>
        <article>{selected ? <><span className="eyebrow">Selected market</span><h3>{selected.cbsa_name}</h3><dl><div><dt>{metricOption.label}</dt><dd>{formatValue(selectedValue, metric)}</dd></div><div><dt>Percentile</dt><dd>{scores[activeSelectedCode]?.toFixed(1) ?? "Unavailable"}</dd></div><div><dt>Rank</dt><dd>{ranks.get(activeSelectedCode) ? `${ranks.get(activeSelectedCode)} of ${comparisons.length}` : "Unavailable"}</dd></div><div><dt>Evidence</dt><dd>Confirmed or Derived, SRC-016</dd></div></dl><button className="primary-action" type="button" onClick={addSelected} disabled={comparisonCodes.includes(activeSelectedCode) || comparisonCodes.length >= 5}>Add to comparison</button><p className="adaptive-boundary">ACS values are public market context. The percentile is deterministic and enters no clinic score.</p></> : <p>Select a visible market on the map or list.</p>}</article>
        <article><span className="eyebrow">Comparison set</span><h3>{comparisonMarkets.length ? `${comparisonMarkets.length} markets` : "No markets added"}</h3>{comparisonMarkets.map((market) => <button className="adaptive-compare-row" key={market.code} onClick={() => setSelectedCode(market.code)}><span>{market.name}</span><b>{scores[market.code]?.toFixed(1) ?? "—"}</b><i onClick={(event) => { event.stopPropagation(); setComparisonCodes((current) => current.filter((code) => code !== market.code)); }}>×</i></button>)}</article>
      </div>
    </section>
  );
}
