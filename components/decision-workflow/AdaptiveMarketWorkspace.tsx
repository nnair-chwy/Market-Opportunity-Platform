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
  APPROVED_MAP_LAYER_IDS,
  MAX_COMPARISON_REGIONS,
  appendComparisonRegion,
  assertMeasureIsolation,
  assertNoHiddenLayerScore,
  buildComparisonFingerprint,
  canAddRegionToComparison,
  clearComparisonRegions,
  createDefaultLayerVisibility,
  formatNullableMeasureValue,
  getDefaultView,
  layerVisibilityChangesScoringInputs,
  listApprovedMapLayers,
  preserveMissingNumeric,
  removeComparisonRegion,
  resolveLayerForPresentation,
  resolveMapPresentation,
  type ApprovedMapLayerId,
  type MapViewMode,
  type PerspectiveView,
} from "@/lib/perspectives";
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
  return formatNullableMeasureValue(value, (finite) => {
    if (metric === "median_household_income") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(finite);
    }
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: metric === "population_density" ? 1 : 0,
    }).format(finite);
  });
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

type AdaptiveMarketWorkspaceProps = {
  initialMetric?: CbsaAcsMetricKey;
  initialSelectedCode?: string | null;
  initialComparisonCodes?: readonly string[];
  selectionPrompt?: string | null;
  opening?: boolean;
  metric?: CbsaAcsMetricKey;
  onMetricChange?: (metric: CbsaAcsMetricKey) => void;
  includeMicropolitan?: boolean;
  onIncludeMicropolitanChange?: (value: boolean) => void;
  category?: WorkflowCategory;
  onCategoryChange?: (category: WorkflowCategory) => void;
  activeView?: PerspectiveView;
  mapMode?: MapViewMode;
};

export function AdaptiveMarketWorkspace({
  initialMetric = "total_population",
  initialSelectedCode = null,
  initialComparisonCodes = [],
  selectionPrompt = null,
  opening = false,
  metric: controlledMetric,
  onMetricChange,
  includeMicropolitan: controlledIncludeMicropolitan,
  onIncludeMicropolitanChange,
  category: controlledCategory,
  onCategoryChange,
  activeView,
  mapMode = "single",
}: AdaptiveMarketWorkspaceProps) {
  const [metricState, setMetricState] = useState<CbsaAcsMetricKey>(initialMetric);
  const [includeMicropolitanState, setIncludeMicropolitanState] = useState(false);
  const [categoryState, setCategoryState] = useState<WorkflowCategory>("all");
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState(initialSelectedCode ?? "");
  const [comparisonCodes, setComparisonCodes] = useState<string[]>(() => [...initialComparisonCodes]);
  const [layerVisibility, setLayerVisibility] = useState(createDefaultLayerVisibility);
  const [unsupportedLayerMessage, setUnsupportedLayerMessage] = useState<string | null>(null);

  const presentation = useMemo(() => {
    const view = activeView ?? getDefaultView("cvc");
    assertMeasureIsolation(view.activeMeasure, view.perspectiveId);
    return resolveMapPresentation(view);
  }, [activeView]);

  const censusMetric =
    presentation.mapBinding.kind === "census_percentile"
      ? presentation.mapBinding.censusMetric
      : controlledMetric ?? metricState;
  const metric = censusMetric;
  const includeMicropolitan = controlledIncludeMicropolitan ?? includeMicropolitanState;
  const category = controlledCategory ?? categoryState;
  const mapReady =
    presentation.evidenceAvailability === "available" &&
    presentation.mapBinding.kind !== "unavailable";
  const showCensusChoropleth =
    mapReady &&
    presentation.mapBinding.kind === "census_percentile" &&
    (mapMode !== "layer" || layerVisibility.active_measure);
  const showClinicOverlay =
    mapMode === "layer"
      ? Boolean(layerVisibility.current_locations && presentation.supportsLayerMode)
      : presentation.mapBinding.kind === "clinic_locations" ||
        presentation.supportsLayerMode;
  const compareEnabled = mapMode === "compare" && presentation.supportsComparison;

  function setMetric(value: CbsaAcsMetricKey) {
    setMetricState(value);
    onMetricChange?.(value);
  }

  function setIncludeMicropolitan(value: boolean) {
    setIncludeMicropolitanState(value);
    onIncludeMicropolitanChange?.(value);
  }

  function setCategory(value: WorkflowCategory) {
    setCategoryState(value);
    onCategoryChange?.(value);
  }

  const categories = useMemo(
    () =>
      marketCategoryMap(
        publicMarkets.map((market) => market.cbsa_code),
        currentMarketIds(currentClinics.map((clinic) => clinic.market)),
        INITIAL_MARKET_WORKFLOW_RECORDS,
      ),
    [],
  );

  const cohort = useMemo(
    () =>
      publicMarkets.filter(
        (market) =>
          (includeMicropolitan || market.cbsa_type === "metropolitan") &&
          matchesWorkflowCategory(categories[market.cbsa_code] ?? "unclassified", category),
      ),
    [categories, category, includeMicropolitan],
  );

  const cohortId = `${includeMicropolitan ? "all" : "metropolitan"}-${category}`;
  const comparisonVintage =
    presentation.mapBinding.kind === "census_percentile"
      ? "acs-2024-5yr"
      : presentation.mapBinding.kind === "clinic_locations"
        ? "public-clinic-directory"
        : "unavailable";
  const activeFingerprint = useMemo(
    () =>
      buildComparisonFingerprint({
        presentation,
        geographyGrain: activeView?.geographyGrain ?? "cbsa",
        vintage: comparisonVintage,
        cohortId,
      }),
    [activeView?.geographyGrain, cohortId, comparisonVintage, presentation],
  );

  const comparisons = useMemo(() => {
    const binding = presentation.mapBinding;
    if (!showCensusChoropleth || binding.kind !== "census_percentile") {
      return [];
    }
    assertMeasureIsolation(presentation.measureId, presentation.perspectiveId);
    const censusKey = binding.censusMetric;
    const entities = cohort.flatMap((market) => {
      const raw = preserveMissingNumeric(market.acs?.metrics[censusKey].raw_value);
      return raw === null
        ? []
        : [
            {
              entityId: market.cbsa_code,
              cohortId,
              value: raw,
              provenance: {
                sourceIds: ["SRC-016"] as string[],
                inputVersion: "acs-2024-5yr",
                transformationVersion: "public-percentile-v1",
              },
            },
          ];
    });
    if (!entities.length) return [];
    return compare_cohort({
      operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
      decisionLayer: "market_attractiveness",
      comparisonVersion: `public-census-${censusKey}-v1`,
      cohortId,
      direction: "higher_is_better",
      entities,
    });
  }, [
    cohort,
    cohortId,
    presentation.mapBinding,
    presentation.measureId,
    presentation.perspectiveId,
    showCensusChoropleth,
  ]);

  const scores = useMemo(
    () =>
      showCensusChoropleth
        ? Object.fromEntries(comparisons.map((item) => [item.entityId, item.percentile]))
        : {},
    [comparisons, showCensusChoropleth],
  );
  const ranks = useMemo(
    () => new Map(comparisons.map((item) => [item.entityId, item.rank])),
    [comparisons],
  );
  const visibleCodes = useMemo(
    () => new Set(cohort.map((market) => market.cbsa_code)),
    [cohort],
  );
  const activeSelectedCode =
    selectedCode && visibleCodes.has(selectedCode) ? selectedCode : "";
  const selected = publicMarkets.find((market) => market.cbsa_code === activeSelectedCode) ?? null;
  const selectedRaw = preserveMissingNumeric(selected?.acs?.metrics[metric].raw_value);
  const selectedValue = selectedRaw;
  const metricOption =
    PUBLIC_MARKET_METRICS.find((item) => item.key === metric) ?? PUBLIC_MARKET_METRICS[0];
  const comparisonMarkets = comparisonCodes.flatMap((code) => {
    const market = publicMarkets.find((item) => item.cbsa_code === code);
    return market ? [{ code, name: market.cbsa_name }] : [];
  });
  const listed = cohort
    .filter((market) =>
      `${market.cbsa_name} ${market.cbsa_code}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort(
      (left, right) =>
        (ranks.get(left.cbsa_code) ?? Number.MAX_SAFE_INTEGER) -
        (ranks.get(right.cbsa_code) ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, 100);

  const candidateFingerprint = presentation.supportsComparison
    ? activeFingerprint
    : null;
  const comparisonEligibility = canAddRegionToComparison({
    regionId: activeSelectedCode,
    selectedRegionIds: comparisonCodes,
    activeFingerprint,
    candidateFingerprint,
  });

  function addSelected() {
    if (!compareEnabled || !comparisonEligibility.allowed || !activeSelectedCode) {
      return;
    }
    setComparisonCodes((current) => appendComparisonRegion(current, activeSelectedCode));
  }

  function toggleLayer(layerId: ApprovedMapLayerId) {
    const resolved = resolveLayerForPresentation(layerId, presentation);
    if ("status" in resolved) {
      setUnsupportedLayerMessage(resolved.reason);
      return;
    }
    setUnsupportedLayerMessage(null);
    setLayerVisibility((current) => {
      const next = { ...current, [layerId]: !current[layerId] };
      if (layerVisibilityChangesScoringInputs(current, next)) {
        return current;
      }
      return next;
    });
  }

  const approvedLayers = listApprovedMapLayers();
  assertNoHiddenLayerScore(approvedLayers);
  const layerEntries = APPROVED_MAP_LAYER_IDS.map((layerId) => {
    const resolved = resolveLayerForPresentation(layerId, presentation);
    return { layerId, resolved, enabled: layerVisibility[layerId] };
  });

  const scoreLabel = presentation.legend.title;
  const scoreBoundary = presentation.evidenceBoundary;
  const scoreMetadata = {
    configurationVersion: showCensusChoropleth
      ? "public-percentile-v1"
      : presentation.evidenceAvailability,
    configurationFingerprint: presentation.sourceIds.join(" · "),
  };
  const comparisonStatus = compareEnabled
    ? `${comparisonCodes.length} of ${MAX_COMPARISON_REGIONS} regions selected · up to five regions`
    : "Comparison mode is off";

  const selectedPercentile = showCensusChoropleth
    ? scores[activeSelectedCode]
    : undefined;
  const selectedRank = ranks.get(activeSelectedCode);

  return (
    <section
      className={`adaptive-market-workspace ${opening ? "opening-market-surface" : ""}`}
      aria-labelledby="adaptive-map-title"
      data-perspective={presentation.perspectiveId}
      data-view={presentation.viewId}
      data-measure={presentation.measureId}
      data-map-mode={mapMode}
      data-evidence-availability={presentation.evidenceAvailability}
      data-allowed-use={presentation.allowedUse}
      data-scoring-eligibility={presentation.scoringEligibility}
    >
      <header className="adaptive-map-header">
        <div>
          <span className="eyebrow">Interactive evidence map</span>
          <h2 id="adaptive-map-title">{presentation.mapTitle}</h2>
          <p>{presentation.sourceLabel}</p>
        </div>
        <div className="adaptive-map-controls">
          {showCensusChoropleth || presentation.mapBinding.kind === "census_percentile" ? (
            <label>
              Measure
              <select
                value={metric}
                onChange={(event) => setMetric(event.target.value as CbsaAcsMetricKey)}
                disabled={Boolean(activeView)}
              >
                {PUBLIC_MARKET_METRICS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Workflow
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as WorkflowCategory);
                setComparisonCodes(clearComparisonRegions());
              }}
            >
              {["all", "current", "potential", "evaluated"].map((item) => (
                <option key={item} value={item}>
                  {item[0].toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="adaptive-check">
            <input
              type="checkbox"
              checked={includeMicropolitan}
              onChange={(event) => {
                setIncludeMicropolitan(event.target.checked);
                setComparisonCodes(clearComparisonRegions());
              }}
            />
            Include micropolitan
          </label>
        </div>
      </header>

      {opening ? (
        <div className="adaptive-opening-map-chrome" role="status">
          <strong id="adaptive-opening-map-title">{presentation.mapTitle}</strong>
          <span>{presentation.sourceLabel}</span>
          {mapMode === "single" && selected ? (
            <dl className="adaptive-single-summary" data-view-a-mode="single">
              <div>
                <dt>Active region</dt>
                <dd>{selected.cbsa_name}</dd>
              </div>
              <div>
                <dt>{showCensusChoropleth ? metricOption.label : presentation.legend.title}</dt>
                <dd>
                  {showCensusChoropleth
                    ? formatValue(selectedValue, metric)
                    : mapReady
                      ? "Context only"
                      : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Percentile</dt>
                <dd>
                  {selectedPercentile === undefined
                    ? showCensusChoropleth
                      ? "Unavailable"
                      : "Not scored"
                    : selectedPercentile.toFixed(1)}
                </dd>
              </div>
              <div>
                <dt>Rank</dt>
                <dd>
                  {showCensusChoropleth && selectedRank
                    ? `${selectedRank} of ${comparisons.length}`
                    : "Unavailable"}
                </dd>
              </div>
            </dl>
          ) : null}
          {mapMode === "single" && !selected ? (
            <small className="adaptive-map-prompt">Click a market to see its value, percentile, rank, and evidence source.</small>
          ) : null}
          {mapMode === "single" && selected ? (
            <small className="adaptive-percentile-disclaimer">
              Percentile is market context only — not an opportunity score or recommendation.
            </small>
          ) : null}
        </div>
      ) : null}

      {opening && mapMode === "compare" ? (
        <div
          className="adaptive-view-a-panel adaptive-compare-panel"
          data-view-a-mode="compare"
          aria-label="Compare regions"
        >
          <div className="adaptive-compare-status">
            <strong>
              {comparisonCodes.length} of {MAX_COMPARISON_REGIONS} regions
            </strong>
            <span>Up to five regions · analyst selection order</span>
          </div>
          <div className="adaptive-compare-chips" role="list">
            {comparisonMarkets.map((market, index) => (
              <button
                key={market.code}
                type="button"
                role="listitem"
                className={
                  activeSelectedCode === market.code
                    ? "adaptive-compare-chip active"
                    : "adaptive-compare-chip"
                }
                onClick={() => setSelectedCode(market.code)}
              >
                <span>
                  {index + 1}. {market.name}
                </span>
                <b aria-hidden="true">
                  {scores[market.code] === undefined
                    ? "—"
                    : scores[market.code].toFixed(1)}
                </b>
                <i
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${market.name} from comparison`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setComparisonCodes((current) =>
                      removeComparisonRegion(current, market.code),
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      setComparisonCodes((current) =>
                        removeComparisonRegion(current, market.code),
                      );
                    }
                  }}
                >
                  ×
                </i>
              </button>
            ))}
          </div>
          <div className="adaptive-compare-actions">
            <button
              type="button"
              className="primary-action"
              onClick={addSelected}
              disabled={!comparisonEligibility.allowed}
            >
              Add selected region
            </button>
            <button
              type="button"
              onClick={() => setComparisonCodes(clearComparisonRegions())}
              disabled={!comparisonCodes.length}
            >
              Clear comparison
            </button>
          </div>
          {!comparisonEligibility.allowed && comparisonEligibility.reason ? (
            <small role="status">{comparisonEligibility.reason}</small>
          ) : null}
        </div>
      ) : null}

      {opening && mapMode === "layer" ? (
        <div
          className="adaptive-view-a-panel adaptive-layer-panel"
          data-view-a-mode="layer"
          aria-label="Regional data layers"
        >
          <strong>Approved layers</strong>
          <p>Layers stay visually separate. No hidden combined score is created.</p>
          <ul className="adaptive-layer-list">
            {layerEntries.map(({ layerId, resolved, enabled }) => {
              const unsupported = "status" in resolved;
              const layer = unsupported ? null : resolved;
              return (
                <li key={layerId} data-layer-id={layerId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={enabled && !unsupported}
                      disabled={unsupported}
                      onChange={() => toggleLayer(layerId)}
                    />
                    <span>{layer?.label ?? layerId}</span>
                  </label>
                  {unsupported ? (
                    <small className="adaptive-layer-unsupported" role="status">
                      {resolved.reason}
                    </small>
                  ) : (
                    <div className="adaptive-layer-meta">
                      <span>{layer.legendLabel}</span>
                      <span>
                        {layer.sourceIds.join(" · ")} · {layer.vintage}
                      </span>
                      <span>
                        {layer.evidenceStatus} · {layer.allowedUse}
                      </span>
                      {layer.descriptiveOnly ? (
                        <small>{layer.evidenceBoundary}</small>
                      ) : (
                        <small>{layer.evidenceBoundary}</small>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {unsupportedLayerMessage ? (
            <small className="adaptive-layer-unsupported" role="status">
              {unsupportedLayerMessage}
            </small>
          ) : null}
          <small data-hidden-score="false">
            Layer visibility does not change deterministic scoring inputs unless an analyst
            explicitly selects a supported measure.
          </small>
        </div>
      ) : null}

      {!mapReady ? (
        <div className="adaptive-view-unavailable" role="status" aria-live="polite">
          <strong>{presentation.emptyState.title}</strong>
          <p>{presentation.emptyState.message}</p>
          <small>{presentation.evidenceBoundary}</small>
        </div>
      ) : null}

      <UnifiedEvaluatorMap
        config={mapConfig}
        collection={publicMarketMapGeoJson}
        visibleMarketCodes={visibleCodes}
        selectedMarketCode={activeSelectedCode}
        comparisonMarkets={compareEnabled ? comparisonMarkets : []}
        comparisonAddEligibility={{
          allowed: compareEnabled && comparisonEligibility.allowed,
          reason: !compareEnabled
            ? "Switch to Compare mode to build a comparison set."
            : comparisonEligibility.reason,
        }}
        comparisonStatus={comparisonStatus}
        workspaceMode="markets"
        marketCategories={categories}
        marketScores={scores}
        marketScoreMetadata={scoreMetadata}
        marketScoreLabel={scoreLabel}
        marketScoreBoundary={scoreBoundary}
        locations={showClinicOverlay ? clinicLocations : []}
        selectedLocationId={null}
        onChooseMarket={setSelectedCode}
        onAddMarketToComparison={addSelected}
        onRemoveMarketFromComparison={(code) =>
          setComparisonCodes((current) => removeComparisonRegion(current, code))
        }
        onClearMarketComparison={() => setComparisonCodes(clearComparisonRegions())}
        onOpenMarketComparison={() =>
          document.getElementById("adaptive-market-detail")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
        onChooseLocation={() => undefined}
        onReset={() => setSelectedCode("")}
      />

      <div className="adaptive-market-detail" id="adaptive-market-detail">
        <aside>
          <label>
            Find a market
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or CBSA code"
            />
          </label>
          <div className="adaptive-market-list" role="listbox" aria-label="Ranked market list">
            {listed.map((market) => (
              <button
                key={market.cbsa_code}
                type="button"
                role="option"
                aria-selected={activeSelectedCode === market.cbsa_code}
                className={activeSelectedCode === market.cbsa_code ? "active" : ""}
                onClick={() => setSelectedCode(market.cbsa_code)}
              >
                <span>
                  <strong>{market.cbsa_name}</strong>
                  <small>CBSA {market.cbsa_code}</small>
                </span>
                <b>
                  {scores[market.cbsa_code] === undefined
                    ? "—"
                    : scores[market.cbsa_code].toFixed(1)}
                </b>
              </button>
            ))}
          </div>
        </aside>
        <article data-selected-market-detail="true">
          {selected ? (
            <>
              <span className="eyebrow">Selected market</span>
              <h3>{selected.cbsa_name}</h3>
              <dl>
                <div>
                  <dt>{showCensusChoropleth ? metricOption.label : presentation.legend.title}</dt>
                  <dd>
                    {showCensusChoropleth
                      ? formatValue(selectedValue, metric)
                      : mapReady
                        ? "Context only"
                        : "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Percentile</dt>
                  <dd>
                    {selectedPercentile === undefined
                      ? showCensusChoropleth
                        ? "Unavailable"
                        : "Not scored"
                      : selectedPercentile.toFixed(1)}
                  </dd>
                </div>
                <div>
                  <dt>Rank</dt>
                  <dd>
                    {showCensusChoropleth && selectedRank
                      ? `${selectedRank} of ${comparisons.length}`
                      : "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>
                    {presentation.evidenceAvailability === "available"
                      ? `${presentation.sourceLabel}`
                      : presentation.emptyState.title}
                  </dd>
                </div>
              </dl>
              {compareEnabled ? (
                <button
                  className="primary-action"
                  type="button"
                  onClick={addSelected}
                  disabled={!comparisonEligibility.allowed}
                >
                  Add to comparison
                </button>
              ) : null}
              <p className="adaptive-boundary">{presentation.evidenceBoundary}</p>
              <p className="adaptive-percentile-disclaimer">
                Percentile is market context only — not an opportunity score or recommendation.
              </p>
            </>
          ) : (
            <p>{selectionPrompt ?? "Select a visible market on the map or list."}</p>
          )}
        </article>
        <article data-comparison-detail="true">
          <span className="eyebrow">Comparison set</span>
          <h3>
            {comparisonMarkets.length
              ? `${comparisonMarkets.length} of ${MAX_COMPARISON_REGIONS} regions`
              : "No regions added"}
          </h3>
          <p>Up to five regions · preserved in analyst selection order</p>
          {comparisonMarkets.map((market) => (
            <button
              className="adaptive-compare-row"
              type="button"
              key={market.code}
              onClick={() => setSelectedCode(market.code)}
            >
              <span>{market.name}</span>
              <b>
                {scores[market.code] === undefined ? "—" : scores[market.code].toFixed(1)}
              </b>
              <i
                role="button"
                tabIndex={0}
                aria-label={`Remove ${market.name} from comparison`}
                onClick={(event) => {
                  event.stopPropagation();
                  setComparisonCodes((current) =>
                    removeComparisonRegion(current, market.code),
                  );
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    setComparisonCodes((current) =>
                      removeComparisonRegion(current, market.code),
                    );
                  }
                }}
              >
                ×
              </i>
            </button>
          ))}
          <button
            type="button"
            disabled={!comparisonCodes.length}
            onClick={() => setComparisonCodes(clearComparisonRegions())}
          >
            Clear comparison
          </button>
        </article>
      </div>
    </section>
  );
}
