"use client";

import type {
  DiscoveryActivityEvent,
  DiscoveryStageReceipt,
  PortfolioMetrics,
} from "@/lib/opportunity-inbox";
import styles from "./opportunity-inbox.module.css";

export function PortfolioMetricsStrip({ metrics }: { metrics: PortfolioMetrics }) {
  const values = [
    ["Markets monitored", metrics.monitoredMarkets],
    ["Latest scan coverage", metrics.scannedMarkets],
    ["Markets qualified", metrics.qualifiedMarkets],
    ["Active opportunities", metrics.activeOpportunities],
    ["Exception markets", metrics.exceptionMarkets],
  ] as const;
  return (
    <dl className={styles.nationalMetrics} aria-label="National portfolio metrics">
      {values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.toLocaleString()}</dd></div>)}
    </dl>
  );
}

export function DiscoveryOperations({
  receipts,
  events,
  onSelectMarket,
}: {
  receipts: readonly DiscoveryStageReceipt[];
  events: readonly DiscoveryActivityEvent[];
  onSelectMarket: (marketId: string) => void;
}) {
  return (
    <section className={styles.operationsGrid} aria-label="Discovery operations">
      <div className={styles.pipelinePanel}>
        <header>
          <div><p className={styles.kicker}>Latest run receipts</p><h2>From signal intake to human review</h2></div>
          <span>Deterministic workflow</span>
        </header>
        <ol className={styles.pipeline}>
          {receipts.map((receipt, index) => (
            <li key={receipt.stageId} className={styles[receipt.status]}>
              <div className={styles.stageIndex}>{String(index + 1).padStart(2, "0")}</div>
              <div><strong>{receipt.label}</strong><small>{receipt.detail}</small></div>
              <span>{receipt.count.toLocaleString()} <small>{receipt.unit}</small></span>
            </li>
          ))}
        </ol>
      </div>

      <aside className={styles.activityPanel}>
        <header><p className={styles.kicker}>National activity</p><h2>What the system retained</h2></header>
        {events.length ? (
          <ol>
            {events.map((event) => (
              <li key={event.eventId}>
                <button onClick={() => onSelectMarket(event.marketId)}>
                  <i className={`${styles.activityDot} ${styles[`scan_${event.scanState}`]}`} />
                  <span><strong>{event.title}</strong><small>{event.marketName}</small></span>
                  <em>{event.evidenceStatus}</em>
                </button>
              </li>
            ))}
          </ol>
        ) : <div className={styles.activityEmpty}>Run discovery to create inspectable stage and market receipts.</div>}
      </aside>
    </section>
  );
}
