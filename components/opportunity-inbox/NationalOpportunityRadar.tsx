"use client";

import { geoAlbersUsa, geoPath } from "d3-geo";
import { publicMarketMapGeoJson } from "@/lib/data/public-market-ui";
import type { MarketScanState, MarketScanStatus } from "@/lib/opportunity-inbox";
import styles from "./opportunity-inbox.module.css";

const WIDTH = 920;
const HEIGHT = 470;
const projection = geoAlbersUsa().fitExtent(
  [[16, 18], [WIDTH - 16, HEIGHT - 18]],
  publicMarketMapGeoJson,
);
const path = geoPath(projection);

const STATUS_LABELS: Record<MarketScanState, string> = {
  pending: "Awaiting scan",
  scanned_no_signal: "Scanned, no signal",
  opportunity_qualified: "Qualified opportunity",
  blocked_stale: "Blocked, stale evidence",
  blocked_missing: "Blocked, missing evidence",
  duplicate_suppressed: "Duplicate suppressed",
  quarantined: "Quarantined",
  failed: "Failed",
};

const EXCEPTION_STATES = new Set<MarketScanState>([
  "opportunity_qualified",
  "blocked_stale",
  "blocked_missing",
  "duplicate_suppressed",
  "quarantined",
  "failed",
]);

export function NationalOpportunityRadar({
  statuses,
  selectedMarketId,
  onSelectMarket,
}: {
  statuses: readonly MarketScanStatus[];
  selectedMarketId: string | null;
  onSelectMarket: (marketId: string) => void;
}) {
  const byCode = new Map(statuses.map((status) => [status.cbsaCode, status]));
  const highlighted = statuses.filter((status) => EXCEPTION_STATES.has(status.scanState));

  return (
    <section className={styles.radarPanel} aria-labelledby="national-radar-title">
      <header className={styles.radarHeader}>
        <div>
          <p className={styles.kicker}>National opportunity radar</p>
          <h2 id="national-radar-title">Every registered market, one visible process.</h2>
          <p>Operational scan status across the public CBSA universe. Colors show workflow state, not market attractiveness or rank.</p>
        </div>
        <span className={styles.radarScope}>917 CBSA markets · synthetic run</span>
      </header>

      <div className={styles.radarGrid}>
        <div className={styles.mapFrame}>
          <svg
            className={styles.radarMap}
            role="img"
            aria-label="United States CBSA monitoring map"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            {publicMarketMapGeoJson.features.map((feature) => {
              const status = byCode.get(feature.properties.cbsa_code);
              if (!status) return null;
              const selected = status.marketId === selectedMarketId;
              const exceptional = EXCEPTION_STATES.has(status.scanState);
              return (
                <path
                  key={status.cbsaCode}
                  d={path(feature) ?? undefined}
                  className={`${styles.marketShape} ${styles[`scan_${status.scanState}`]} ${selected ? styles.selectedMarket : ""}`}
                  role={exceptional ? "button" : undefined}
                  tabIndex={exceptional ? 0 : -1}
                  aria-label={exceptional ? `${status.marketName}: ${STATUS_LABELS[status.scanState]}` : undefined}
                  onClick={() => onSelectMarket(status.marketId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectMarket(status.marketId);
                    }
                  }}
                />
              );
            })}
          </svg>
          <div className={styles.mapNote}>Public boundaries: SRC-015 · Monitoring only · Scoring eligibility: none</div>
        </div>

        <aside className={styles.marketSignals} aria-label="Markets requiring attention">
          <div className={styles.marketSignalsHeader}>
            <span>Markets requiring attention</span>
            <strong>{highlighted.length}</strong>
          </div>
          {highlighted.map((status) => (
            <button
              key={status.marketId}
              className={status.marketId === selectedMarketId ? styles.selectedSignal : ""}
              onClick={() => onSelectMarket(status.marketId)}
            >
              <i className={`${styles.signalDot} ${styles[`scan_${status.scanState}`]}`} />
              <span><strong>{status.marketName}</strong><small>{STATUS_LABELS[status.scanState]}</small></span>
              <em>{String(status.opportunityCount).padStart(2, "0")}</em>
            </button>
          ))}
          <div className={styles.radarLegend}>
            <span><i className={styles.scan_scanned_no_signal} />Scan complete</span>
            <span><i className={styles.scan_opportunity_qualified} />Qualified</span>
            <span><i className={styles.scan_blocked_stale} />Withheld</span>
            <span><i className={styles.scan_quarantined} />Quarantined</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
