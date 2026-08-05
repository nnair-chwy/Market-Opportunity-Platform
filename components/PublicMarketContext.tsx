"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MarketComparisonWorkspace } from "@/components/market-comparison";
import {
  filterPublicMarkets,
  publicMarketAriaLabel,
  selectPublicMarket,
} from "@/lib/data/cbsa-market-context";
import {
  PUBLIC_MARKET_METRICS,
  publicMarkets,
} from "@/lib/data/public-market-ui";
import { scrollMarketRowIntoList } from "@/lib/data/market-list-scroll";
import type { CbsaAcsMetricKey } from "@/lib/data/cbsa-acs";
import {
  WORKFLOW_CATEGORY_COLORS,
  matchesWorkflowCategory,
  type MarketCategory,
  type WorkflowCategory,
} from "@/lib/workflow/market-workflow";

type PublicMarketContextProps = {
  selectedCode: string;
  selectedMetric: CbsaAcsMetricKey;
  includeMicropolitan: boolean;
  category: WorkflowCategory;
  marketCategories: Readonly<Record<string, MarketCategory>>;
  onChooseMarket: (code: string) => void;
  comparisonCodes: readonly string[];
  onAddActiveMarket: () => void;
  onRemoveComparisonMarket: (code: string) => void;
  onIncludeMicropolitanChange: (include: boolean) => void;
};

function formatMetric(value: number | null, key: CbsaAcsMetricKey): string {
  if (value === null) return "Missing";
  if (key === "median_household_income") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: key === "population_density" ? 1 : 0,
  }).format(value);
}

function categoryLabel(category: MarketCategory): string {
  return category[0].toUpperCase() + category.slice(1);
}

export function PublicMarketContext({
  selectedCode,
  selectedMetric,
  includeMicropolitan,
  category,
  marketCategories,
  onChooseMarket,
  comparisonCodes,
  onAddActiveMarket,
  onRemoveComparisonMarket,
  onIncludeMicropolitanChange,
}: PublicMarketContextProps) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const visibleMarkets = useMemo(
    () =>
      filterPublicMarkets(publicMarkets, {
        query,
        includeMicropolitan,
      }).filter((market) =>
        matchesWorkflowCategory(
          marketCategories[market.cbsa_code] ?? "unclassified",
          category,
        ),
      ),
    [category, includeMicropolitan, marketCategories, query],
  );
  const selected = selectPublicMarket(publicMarkets, selectedCode);
  const selectedVisible = visibleMarkets.some(
    (market) => market.cbsa_code === selectedCode,
  );

  const scrollBehavior = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto" as const
      : "smooth" as const;

  useEffect(() => {
    if (!selectedCode || !selectedVisible) return;
    const row = rowRefs.current.get(selectedCode);
    const list = listRef.current;
    if (!row || !list) return;
    const frame = window.requestAnimationFrame(() => {
      scrollMarketRowIntoList(list, row, scrollBehavior());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedCode, selectedVisible, visibleMarkets]);

  return (
    <div className="market-workspace-panel">
      <p className="visually-hidden" aria-live="polite">
        {selected
          ? `${selected.cbsa_name}, CBSA ${selected.cbsa_code}, selected.`
          : "No market selected."}
      </p>
      <aside className="location-list unified-side-panel" aria-label="Markets">
        <div className="market-controls">
          <label className="micro-toggle">
            <input
              type="checkbox"
              checked={includeMicropolitan}
              onChange={(event) =>
                onIncludeMicropolitanChange(event.target.checked)
              }
            />
            Show micropolitan areas
          </label>
        </div>
        <div className="market-browser-toolbar">
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Search markets"
              placeholder="Search market, code, city, county, or state"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <p>{visibleMarkets.length} markets</p>
        </div>
        {selected && !selectedVisible ? (
          <div className="market-selection-notice" role="status">
            <span>
              {selected.cbsa_name} remains active but is outside the current
              browser results. Your search is preserved.
            </span>
            {query ? (
              <button type="button" onClick={() => setQuery("")}>
                Clear search
              </button>
            ) : null}
          </div>
        ) : null}
        <div
          className="market-list-scroll"
          ref={listRef}
          role="listbox"
          aria-label="Market results"
        >
          {visibleMarkets.length ? (
            visibleMarkets.map((market) => {
              const marketCategory =
                marketCategories[market.cbsa_code] ?? "unclassified";
              const selectedRow = selectedCode === market.cbsa_code;
              const metric = market.acs?.metrics[selectedMetric] ?? null;
              return (
                <button
                  key={market.cbsa_code}
                  role="option"
                  ref={(node) => {
                    if (node) rowRefs.current.set(market.cbsa_code, node);
                    else rowRefs.current.delete(market.cbsa_code);
                  }}
                  className={`candidate-row market-row ${
                    selectedRow ? "active" : ""
                  }`}
                  aria-current={selectedRow ? "true" : undefined}
                  aria-selected={selectedRow}
                  aria-label={`${publicMarketAriaLabel(market)}. ${categoryLabel(marketCategory)} workflow status.`}
                  onClick={() => onChooseMarket(market.cbsa_code)}
                >
                  <i
                    className="market-status-swatch"
                    style={{
                      background: WORKFLOW_CATEGORY_COLORS[marketCategory],
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{market.cbsa_name}</strong>
                    <small>
                      CBSA {market.cbsa_code} · {categoryLabel(marketCategory)}
                    </small>
                    <small>
                      {PUBLIC_MARKET_METRICS.find(
                        (option) => option.key === selectedMetric,
                      )?.label ?? "Context"}
                      : {formatMetric(metric?.raw_value ?? null, selectedMetric)}
                    </small>
                  </div>
                  <span className="location-arrow" aria-hidden="true">
                    ›
                  </span>
                </button>
              );
            })
          ) : (
            <div className="empty-state">
              No markets match this category and search.
            </div>
          )}
        </div>
      </aside>

      <div className="market-detail-panel">
        <MarketComparisonWorkspace
          activeMarket={selected}
          selectedCodes={comparisonCodes}
          onAddActiveMarket={onAddActiveMarket}
          onRemoveMarket={onRemoveComparisonMarket}
        />
      </div>
    </div>
  );
}
