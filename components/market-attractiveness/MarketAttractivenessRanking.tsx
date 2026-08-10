"use client";

import { useMemo, useState } from "react";

import {
  MARKET_ATTRACTIVENESS_CONFIGURATION,
  syntheticMarketAttractivenessResults,
} from "@/lib/market-attractiveness";
import type {
  MarketAttractivenessResult,
  MarketCohort,
  MarketMetricResult,
} from "@/lib/market-attractiveness";

import styles from "./market-attractiveness-ranking.module.css";

const PAGE_SIZE = 25;

type SortKey =
  | "overall"
  | "name"
  | "chewy_demand"
  | "market_capacity"
  | "veterinary_opportunity"
  | "chewy_clinic_engagement";

function formatMetric(metric: MarketMetricResult): string {
  if (metric.unit === "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(metric.rawValue);
  }
  if (metric.unit === "percent") {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(metric.rawValue);
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: metric.unit === "count" ? 0 : 2,
  }).format(metric.rawValue);
}

function subscore(result: MarketAttractivenessResult, dimensionId: SortKey): number {
  return (
    result.subscores.find((candidate) => candidate.dimensionId === dimensionId)
      ?.score ?? 0
  );
}

function sensitivityLabel(result: MarketAttractivenessResult): string {
  if (result.sensitivity.classification === "moderately-sensitive") {
    return "Moderate";
  }
  if (result.sensitivity.classification === "highly-sensitive") return "High";
  return "Stable";
}

export function MarketAttractivenessRanking({selectedMarketCode="",onChooseMarket,defaultOpen=false}:{selectedMarketCode?:string;onChooseMarket?:(code:string)=>void;defaultOpen?:boolean}={}) {
  const initialSelection=syntheticMarketAttractivenessResults.find((market)=>market.cbsaCode===selectedMarketCode);
  const [cohort, setCohort] = useState<MarketCohort>(initialSelection?.cohort??"metropolitan");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [page, setPage] = useState(initialSelection?Math.ceil(initialSelection.cohortRank/PAGE_SIZE):1);
  const [expandedId, setExpandedId] = useState<string | null>(initialSelection?.prototypeMarketId??null);

  const cohortCounts = useMemo(
    () => ({
      metropolitan: syntheticMarketAttractivenessResults.filter(
        (market) => market.cohort === "metropolitan",
      ).length,
      micropolitan: syntheticMarketAttractivenessResults.filter(
        (market) => market.cohort === "micropolitan",
      ).length,
    }),
    [],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return syntheticMarketAttractivenessResults
      .filter(
        (market) =>
          market.cohort === cohort &&
          (!normalizedQuery ||
            market.marketName.toLocaleLowerCase().includes(normalizedQuery)),
      )
      .sort((left, right) => {
        if (sortKey === "name") {
          return left.marketName.localeCompare(right.marketName);
        }
        const leftValue =
          sortKey === "overall" ? left.overallScore : subscore(left, sortKey);
        const rightValue =
          sortKey === "overall" ? right.overallScore : subscore(right, sortKey);
        return (
          rightValue - leftValue ||
          left.cohortRank - right.cohortRank ||
          left.marketName.localeCompare(right.marketName)
        );
      });
  }, [cohort, query, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE,
  );

  function changeCohort(nextCohort: MarketCohort) {
    setCohort(nextCohort);
    setPage(1);
    setExpandedId(null);
  }

  function reset() {
    setCohort("metropolitan");
    setQuery("");
    setSortKey("overall");
    setPage(1);
    setExpandedId(null);
  }

  return (
    <details className={styles.panel} open={defaultOpen||undefined}>
      <summary className={styles.summary}>
        <div>
          <div className={styles.eyebrow}>Synthetic screening model</div>
          <h2 id="market-attractiveness-title">Market attractiveness ranking</h2>
          <p>Open the ranked market list</p>
        </div>
        <div className={styles.summaryAction}>
          <span className={styles.summaryBoundary}>
            Synthetic only · Not a recommendation
          </span>
          <span className={styles.chevron} aria-hidden="true">
            ▾
          </span>
        </div>
      </summary>

      <div className={styles.panelContent} aria-labelledby="market-attractiveness-title">
        <details className={styles.scoreGuide}>
          <summary>
            <span className={styles.infoIcon} aria-hidden="true">i</span>
            <span>
              <strong>What goes into this score?</strong>
              <small>View the metrics, weights, and scoring direction</small>
            </span>
            <span className={styles.guideChevron} aria-hidden="true">+</span>
          </summary>
          <div className={styles.scoreGuideContent}>
            <p>
              The synthetic overall score combines ten configured metrics across
              four dimensions. Each metric is normalized within its market cohort
              before its weighted contribution is calculated.
            </p>
            <div className={styles.dimensionGuideGrid}>
              {MARKET_ATTRACTIVENESS_CONFIGURATION.dimensions.map((dimension) => (
                <section key={dimension.dimensionId}>
                  <header>
                    <strong>{dimension.label}</strong>
                    <span>{dimension.weight}%</span>
                  </header>
                  <ul>
                    {MARKET_ATTRACTIVENESS_CONFIGURATION.metrics
                      .filter(
                        (metric) => metric.dimensionId === dimension.dimensionId,
                      )
                      .map((metric) => (
                        <li key={metric.metricId}>
                          <span>{metric.label}</span>
                          <small>
                            {metric.weight}% · {metric.direction === "higher-is-better"
                              ? "Higher increases the score"
                              : "Lower increases the score"}
                          </small>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
            <p className={styles.guideBoundary}>
              Synthetic and unapproved. Metropolitan and micropolitan markets
              are normalized separately. A higher score is a screening signal,
              not a market-entry, site, lease, or opening recommendation.
            </p>
          </div>
        </details>

        <div className={styles.controls}>
          <div className={styles.tabs} role="tablist" aria-label="Market cohort">
            {(["metropolitan", "micropolitan"] as const).map((value) => (
              <button
                className={cohort === value ? styles.activeTab : undefined}
                key={value}
                onClick={() => changeCohort(value)}
                role="tab"
                aria-selected={cohort === value}
              >
                {value === "metropolitan" ? "Metropolitan" : "Micropolitan"}{" "}
                <span>{cohortCounts[value]}</span>
              </button>
            ))}
          </div>
          <label>
            <span>Search markets</span>
            <input
              type="search"
              value={query}
              placeholder="Market name"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
                setExpandedId(null);
              }}
            />
          </label>
          <label>
            <span>Sort by</span>
            <select
              value={sortKey}
              onChange={(event) => {
                setSortKey(event.target.value as SortKey);
                setPage(1);
              }}
            >
              <option value="overall">Overall score</option>
              <option value="chewy_demand">Chewy demand</option>
              <option value="market_capacity">Market capacity</option>
              <option value="veterinary_opportunity">Veterinary opportunity</option>
              <option value="chewy_clinic_engagement">Clinic engagement</option>
              <option value="name">Market name</option>
            </select>
          </label>
          <button className={styles.resetButton} type="button" onClick={reset}>
            Reset
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">Cohort rank</th>
                <th scope="col">Market</th>
                <th scope="col">Overall</th>
                <th scope="col">Demand</th>
                <th scope="col">Capacity</th>
                <th scope="col">Vet opportunity</th>
                <th scope="col">Clinic engagement</th>
                <th scope="col">Sensitivity</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((market) => {
                const expanded = expandedId === market.prototypeMarketId;
                return (
                  <MarketRow
                    key={market.prototypeMarketId}
                    market={market}
                    expanded={expanded}
                    onToggle={() =>
                      {setExpandedId(expanded ? null : market.prototypeMarketId);if(market.cbsaCode)onChooseMarket?.(market.cbsaCode);}
                    }
                  />
                );
              })}
            </tbody>
          </table>
          {!visible.length ? (
            <div className={styles.empty}>No markets match this search.</div>
          ) : null}
        </div>

        <div className={styles.pagination}>
          <span>
            {filtered.length
              ? `${(activePage - 1) * PAGE_SIZE + 1}-${Math.min(
                  activePage * PAGE_SIZE,
                  filtered.length,
                )} of ${filtered.length}`
              : "0 markets"}
          </span>
          <div>
            <button
              type="button"
              disabled={activePage === 1}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
                setExpandedId(null);
              }}
            >
              Previous
            </button>
            <span>
              Page {activePage} of {pageCount}
            </span>
            <button
              type="button"
              disabled={activePage === pageCount}
              onClick={() => {
                setPage((current) => Math.min(pageCount, current + 1));
                setExpandedId(null);
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}

function MarketRow({
  market,
  expanded,
  onToggle,
}: {
  market: MarketAttractivenessResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={expanded ? styles.expandedRow : undefined}>
        <td>
          <strong>#{market.cohortRank}</strong>
        </td>
        <td>
          <button
            className={styles.marketButton}
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            {market.marketName}
            <span>{expanded ? "Hide detail" : "Show detail"}</span>
          </button>
        </td>
        <td>
          <strong className={styles.score}>{market.overallScore.toFixed(1)}</strong>
        </td>
        <td>{subscore(market, "chewy_demand").toFixed(1)}</td>
        <td>{subscore(market, "market_capacity").toFixed(1)}</td>
        <td>{subscore(market, "veterinary_opportunity").toFixed(1)}</td>
        <td>{subscore(market, "chewy_clinic_engagement").toFixed(1)}</td>
        <td>
          <span
            className={`${styles.sensitivity} ${
              market.sensitivity.classification === "stable"
                ? styles.stable
                : styles.sensitive
            }`}
          >
            {sensitivityLabel(market)}
          </span>
          <small>
            #{market.sensitivity.bestRank}-#{market.sensitivity.worstRank}
          </small>
        </td>
      </tr>
      {expanded ? (
        <tr className={styles.detailRow}>
          <td colSpan={8}>
            <div className={styles.detailHeader}>
              <div>
                <strong>Score construction</strong>
                <span>
                  Raw input, cohort-normalized value, weight, and contribution
                </span>
              </div>
              <div>
                <strong>{market.sensitivity.scenarioCount} sensitivity scenarios</strong>
                <span>
                  Rank range {market.sensitivity.rankRange}; reporting date {market.reportingDate}
                </span>
              </div>
            </div>
            <div className={styles.metricGrid}>
              {market.metricResults.map((metric) => (
                <article key={metric.metricId}>
                  <div>
                    <strong>{metric.label}</strong>
                    <span>
                      {metric.direction === "higher-is-better"
                        ? "Higher is better"
                        : "Lower is better"}
                      {metric.transform === "log1p" ? " · log transformed" : ""}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Raw</dt>
                      <dd>{formatMetric(metric)}</dd>
                    </div>
                    <div>
                      <dt>Normalized</dt>
                      <dd>{metric.normalizedScore.toFixed(1)}</dd>
                    </div>
                    <div>
                      <dt>Weight</dt>
                      <dd>{metric.weight}%</dd>
                    </div>
                    <div>
                      <dt>Contribution</dt>
                      <dd>{metric.contribution.toFixed(2)}</dd>
                    </div>
                  </dl>
                  {metric.prototypeAssumption ? (
                    <p>{metric.prototypeAssumption}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
