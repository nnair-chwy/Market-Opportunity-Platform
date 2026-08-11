"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DeliveryReceipt,
  Opportunity,
  OpportunityInboxSnapshot,
  OpportunitySector,
} from "@/lib/opportunity-inbox";
import { DiscoveryOperations, PortfolioMetricsStrip } from "./DiscoveryOperations";
import { NationalOpportunityRadar } from "./NationalOpportunityRadar";
import styles from "./opportunity-inbox.module.css";

const EMPTY_SNAPSHOT: OpportunityInboxSnapshot = {
  opportunities: [],
  historicalOpportunities: [],
  runs: [],
  nextBatchId: "seattle-batch-01",
  marketStatuses: [],
  stageReceipts: [],
  activityEvents: [],
  portfolioMetrics: {
    monitoredMarkets: 0,
    scannedMarkets: 0,
    qualifiedMarkets: 0,
    activeOpportunities: 0,
    exceptionMarkets: 0,
    lastCompletedAt: null,
  },
};

const SECTOR_META: Record<OpportunitySector, {
  short: string;
  label: string;
  description: string;
  href: string;
}> = {
  marketing: {
    short: "GM",
    label: "Growth & marketing",
    description: "Customer acquisition, reach and regional demand",
    href: "/opportunities/growth-marketing",
  },
  pet_health: {
    short: "PH",
    label: "Pet health",
    description: "Clinic demand, capacity and awareness",
    href: "/opportunities/pet-health",
  },
  ecosystem: {
    short: "ME",
    label: "Market ecosystem",
    description: "Competitive and local market change",
    href: "/opportunities/market-ecosystem",
  },
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatValue(value: number | null, unit: string) {
  if (value === null) return "Not available";
  if (unit === "boolean") return value === 1 ? "Yes" : "No";
  return `${value}${unit === "%" ? "%" : ` ${unit}`}`;
}

function stateLabel(value: Opportunity["state"]) {
  const labels: Partial<Record<Opportunity["state"], string>> = {
    needs_review: "Review required",
    approved_for_routing: "Approved",
    routed: "Routed",
    investigating: "In progress",
    actioned: "Actioned",
    dismissed: "Dismissed",
    prepared: "Prepared",
    blocked: "Blocked",
    stopped: "Stopped",
    expired: "Expired",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function OpportunityInbox() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [sector, setSector] = useState<"all" | OpportunitySector>("all");
  const [reviewState, setReviewState] = useState("active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState(
    "Evidence is sufficient for the synthetic demonstration.",
  );
  const [countdown, setCountdown] = useState(60);
  const [delivery, setDelivery] = useState<DeliveryReceipt | null>(null);

  const loadSnapshot = useCallback(async () => {
    const response = await fetch("/api/opportunity-runs", { cache: "no-store" });
    if (!response.ok) throw new Error("The opportunity portfolio could not load.");
    const next = (await response.json()) as OpportunityInboxSnapshot;
    setSnapshot(next);
    setSelectedId((current) => current ?? next.opportunities[0]?.opportunityId ?? null);
  }, []);

  const runDiscovery = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/opportunity-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId: snapshot.nextBatchId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Discovery could not run.");
      setSnapshot(result.snapshot as OpportunityInboxSnapshot);
      setSelectedId((current) =>
        current ?? result.snapshot.opportunities[0]?.opportunityId ?? null,
      );
      setCountdown(60);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Discovery could not run.");
    } finally {
      setBusy(false);
    }
  }, [snapshot.nextBatchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSnapshot().catch((caught) =>
        setError(caught instanceof Error ? caught.message : "The portfolio could not load."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSnapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          void runDiscovery();
          return 60;
        }
        return current - 1;
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [runDiscovery]);

  const sourceOpportunities = reviewState === "history"
    ? snapshot.historicalOpportunities
    : snapshot.opportunities;
  const filtered = useMemo(() => sourceOpportunities.filter((opportunity) => {
    const sectorMatches = sector === "all" || opportunity.sector === sector;
    const marketMatches = selectedMarketId === null || opportunity.regionId === selectedMarketId;
    const stateMatches = reviewState === "active" || reviewState === "history" ||
      opportunity.state === reviewState;
    return sectorMatches && marketMatches && stateMatches;
  }), [reviewState, sector, selectedMarketId, sourceOpportunities]);

  const selected = filtered.find((item) => item.opportunityId === selectedId) ??
    filtered[0] ?? null;
  const selectedMarket = snapshot.marketStatuses.find((item) => item.marketId === selectedMarketId) ?? null;
  const latestRun = snapshot.runs[0] ?? null;
  const sectorCounts = useMemo(() => ({
    marketing: snapshot.opportunities.filter((item) => item.sector === "marketing").length,
    pet_health: snapshot.opportunities.filter((item) => item.sector === "pet_health").length,
    ecosystem: snapshot.opportunities.filter((item) => item.sector === "ecosystem").length,
  }), [snapshot.opportunities]);
  const reviewCount = snapshot.opportunities.filter((item) => item.state === "needs_review").length;
  const averageCoverage = snapshot.opportunities.length
    ? Math.round(snapshot.opportunities.reduce((sum, item) => sum + item.evidenceCoverage, 0) /
      snapshot.opportunities.length * 100)
    : 0;

  async function review(action: "approve" | "dismiss" | "request_evidence") {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setDelivery(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(selected.opportunityId)}/review`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, reason: reviewReason, reviewer: "Demo reviewer" }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Review could not be saved.");
      await loadSnapshot();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function prepareDelivery(channel: "outlook" | "slack") {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(selected.opportunityId)}/delivery-preview`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channel }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Preview could not be created.");
      setDelivery(result.receipt as DeliveryReceipt);
      await loadSnapshot();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preview could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function resetDemo() {
    setBusy(true);
    setDelivery(null);
    setError(null);
    try {
      const response = await fetch("/api/opportunity-runs", { method: "DELETE" });
      const next = (await response.json()) as OpportunityInboxSnapshot;
      setSnapshot(next);
      setSelectedId(null);
      setSelectedMarketId(null);
      setCountdown(60);
    } finally {
      setBusy(false);
    }
  }

  function selectSector(next: "all" | OpportunitySector) {
    setSector(next);
    setSelectedId(null);
    setDelivery(null);
  }

  function selectMarket(marketId: string) {
    setSelectedMarketId(marketId);
    setSelectedId(null);
    setDelivery(null);
  }

  return (
    <div className={styles.platform}>
      <aside className={styles.rail}>
        <div className={styles.railBrand}>
          <span className={styles.brandSymbol}>M</span>
          <div>
            <strong>Market Opportunity</strong>
            <span>Decision platform</span>
          </div>
        </div>

        <nav className={styles.navigation} aria-label="Platform navigation">
          <p>Portfolio</p>
          <button className={sector === "all" ? styles.activeNav : ""} onClick={() => selectSector("all")}>
            <span className={styles.navIcon}>01</span>
            <span>All opportunities</span>
            <em>{snapshot.opportunities.length}</em>
          </button>
          <p>Sectors</p>
          {(Object.keys(SECTOR_META) as OpportunitySector[]).map((key, index) => (
            <Link key={key} href={SECTOR_META[key].href} className={sector === key ? styles.activeNav : ""}>
              <span className={`${styles.navIcon} ${styles[key]}`}>{String(index + 2).padStart(2, "0")}</span>
              <span>{SECTOR_META[key].label}</span>
              <em>{sectorCounts[key]}</em>
            </Link>
          ))}
        </nav>

        <div className={styles.railContext}>
          <span>Active market</span>
          <strong>{selectedMarket?.marketName ?? "National portfolio"}</strong>
          <small>{selectedMarket ? `CBSA ${selectedMarket.cbsaCode}` : "917 registered CBSA markets"} · Synthetic environment</small>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumbs}>
            <span>Portfolio</span><b>/</b><strong>Opportunity register</strong>
          </div>
          <div className={styles.topActions}>
            <span className={styles.environment}>Prototype data</span>
            <button className={styles.secondaryButton} onClick={resetDemo} disabled={busy}>Reset</button>
            <button className={styles.primaryButton} onClick={runDiscovery} disabled={busy}>
              {busy ? "Processing" : "Run discovery"}
            </button>
          </div>
        </header>

        <div className={styles.content}>
          {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

          <section className={styles.pageIntro}>
            <div>
              <p className={styles.kicker}>Opportunity portfolio</p>
              <h1>Regional signals, organized for action.</h1>
              <p>Validated market changes are separated by business sector, grounded in visible evidence, and converted into bounded sector-specific action packets.</p>
            </div>
            <dl className={styles.portfolioStats}>
              <div><dt>Active</dt><dd>{snapshot.opportunities.length}</dd></div>
              <div><dt>Awaiting review</dt><dd>{reviewCount}</dd></div>
              <div><dt>Evidence coverage</dt><dd>{averageCoverage}%</dd></div>
            </dl>
          </section>

          <PortfolioMetricsStrip metrics={snapshot.portfolioMetrics} />

          <NationalOpportunityRadar
            statuses={snapshot.marketStatuses}
            selectedMarketId={selectedMarketId}
            onSelectMarket={selectMarket}
          />

          <DiscoveryOperations
            receipts={snapshot.stageReceipts}
            events={snapshot.activityEvents}
            onSelectMarket={selectMarket}
          />

          <section className={styles.sectorStrip} aria-label="Sector overview">
            {(Object.keys(SECTOR_META) as OpportunitySector[]).map((key) => (
              <Link key={key} href={SECTOR_META[key].href} className={`${styles.sectorSummary} ${styles[key]}`}>
                <span className={styles.sectorIndex}>{SECTOR_META[key].short}</span>
                <span className={styles.sectorCopy}>
                  <strong>{SECTOR_META[key].label}</strong>
                  <small>{SECTOR_META[key].description}</small>
                </span>
                <span className={styles.sectorCount}>{sectorCounts[key]}</span>
              </Link>
            ))}
          </section>

          <section className={styles.register}>
            <header className={styles.registerHeader}>
              <div>
                <p className={styles.kicker}>Opportunity register</p>
                <h2>{selectedMarket ? selectedMarket.marketName : sector === "all" ? "All sectors" : SECTOR_META[sector].label}</h2>
              </div>
              <div className={styles.runStatus}>
                <span className={styles.statusDot} />
                <div>
                  <strong>{latestRun ? `Last scan ${formatTime(latestRun.completedAt)}` : "Monitoring ready"}</strong>
                  <small>Next scan in {countdown}s · {latestRun?.acceptedObservations ?? 0} observations accepted</small>
                </div>
              </div>
            </header>

            <div className={styles.registerToolbar}>
              <div className={styles.viewTabs}>
                {[
                  ["active", "Active"],
                  ["needs_review", "Needs review"],
                  ["approved_for_routing", "Approved"],
                  ["history", "History"],
                ].map(([value, label]) => (
                  <button key={value} className={reviewState === value ? styles.activeTab : ""} onClick={() => { setReviewState(value); setSelectedId(null); }}>{label}</button>
                ))}
              </div>
              <div className={styles.registerFilters}>
                <button className={styles.clearSector} onClick={() => setSelectedMarketId(null)} disabled={!selectedMarketId}>All markets</button>
                <button className={styles.clearSector} onClick={() => selectSector("all")} disabled={sector === "all"}>Clear sector</button>
              </div>
            </div>

            <div className={styles.workspace}>
              <aside className={styles.opportunityList} aria-label="Opportunity register">
                <div className={styles.listColumns}><span>Opportunity</span><span>Coverage</span></div>
                {filtered.length ? filtered.map((opportunity) => (
                  <button
                    key={opportunity.opportunityId}
                    className={`${styles.opportunityRow} ${styles[opportunity.sector]} ${selected?.opportunityId === opportunity.opportunityId ? styles.selectedRow : ""}`}
                    onClick={() => { setSelectedId(opportunity.opportunityId); setSelectedMarketId(opportunity.regionId); setDelivery(null); }}
                  >
                    <span className={styles.rowAccent} />
                    <span className={styles.rowBody}>
                      <span className={styles.rowMeta}>
                        <span>{SECTOR_META[opportunity.sector].label}</span>
                        <em>{stateLabel(opportunity.state)}</em>
                      </span>
                      <strong>{opportunity.draft.headline}</strong>
                      <small>{opportunity.actionPacket?.accountableOwner.displayName ?? opportunity.owner} · Detected {formatTime(opportunity.detectedAt)}</small>
                    </span>
                    <span className={styles.coverage}>{Math.round(opportunity.evidenceCoverage * 100)}<small>%</small></span>
                  </button>
                )) : (
                  <div className={styles.emptyList}>
                    <span>00</span>
                    <strong>{selectedMarket ? "No qualified opportunity" : "No opportunities in this view"}</strong>
                    <p>{selectedMarket?.detail ?? "Run discovery or choose another sector to continue."}</p>
                  </div>
                )}
              </aside>

              <section className={styles.detail} aria-label="Opportunity detail">
                {selected ? (
                  <OpportunityDetail
                    opportunity={selected}
                    reviewReason={reviewReason}
                    setReviewReason={setReviewReason}
                    review={review}
                    prepareDelivery={prepareDelivery}
                    delivery={delivery}
                    busy={busy}
                  />
                ) : (
                  <div className={styles.emptyDetail}>
                    <span className={styles.emptyMonogram}>MO</span>
                    <h2>{selectedMarket ? selectedMarket.marketName : "Select an opportunity"}</h2>
                    <p>{selectedMarket?.detail ?? "Review its evidence, decision rule, accountable owner and next action."}</p>
                    {selectedMarket ? <small>Operational state: {selectedMarket.scanState.replaceAll("_", " ")} · {selectedMarket.evidenceStatus} synthetic evidence</small> : null}
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export function OpportunityDetail({
  opportunity,
  reviewReason,
  setReviewReason,
  review,
  prepareDelivery,
  delivery,
  busy,
}: {
  opportunity: Opportunity;
  reviewReason: string;
  setReviewReason: (value: string) => void;
  review: (action: "approve" | "dismiss" | "request_evidence") => Promise<void>;
  prepareDelivery: (channel: "outlook" | "slack") => Promise<void>;
  delivery: DeliveryReceipt | null;
  busy: boolean;
}) {
  const supporting = opportunity.evidence.filter((item) => item.role === "supporting");
  const exceptions = opportunity.evidence.filter((item) => item.role !== "supporting");
  const packet = opportunity.actionPacket;

  return (
    <div className={styles.detailContent}>
      <header className={styles.detailHeader}>
        <div className={styles.detailSector}>
          <span className={`${styles.sectorIndex} ${styles[opportunity.sector]}`}>{SECTOR_META[opportunity.sector].short}</span>
          <div><span>{SECTOR_META[opportunity.sector].label}</span><small>{opportunity.regionName}</small></div>
        </div>
        <span className={styles.stateBadge}>{stateLabel(opportunity.state)}</span>
        <h2>{opportunity.draft.headline}</h2>
        <p>{opportunity.draft.explanation}</p>
      </header>

      <dl className={styles.detailFacts}>
        <div><dt>Accountable owner</dt><dd>{packet?.accountableOwner.displayName ?? opportunity.owner}</dd></div>
        <div><dt>Evidence coverage</dt><dd>{Math.round(opportunity.evidenceCoverage * 100)}%</dd></div>
        <div><dt>Detected</dt><dd>{formatTime(opportunity.detectedAt)}</dd></div>
        <div><dt>{packet ? "Deadline" : "Expires"}</dt><dd>{formatTime(packet?.deadline.dueAt ?? opportunity.expiresAt)}</dd></div>
      </dl>

      {packet ? <ActionPacketDetail opportunity={opportunity} /> : <section className={styles.decisionBrief}>
        <div>
          <span className={styles.sectionLabel}>Qualification rule</span>
          <h3>{opportunity.ruleLabel}</h3>
          <p>{opportunity.ruleExplanation}</p>
        </div>
        <div className={styles.proposedAction}>
          <span className={styles.sectionLabel}>Prepared next step</span>
          <h3>{opportunity.draft.suggestedAction}</h3>
          <p>{opportunity.draft.uncertainty}</p>
          <small>Rules-based draft · Human approval required</small>
        </div>
      </section>}

      <section className={styles.evidenceSection}>
        <div className={styles.sectionTitle}>
          <div><span className={styles.sectionLabel}>Evidence ledger</span><h3>What supports this opportunity</h3></div>
          <span>{supporting.length} supporting · {exceptions.length} exceptions</span>
        </div>
        <div className={styles.evidenceTable}>
          <div className={styles.evidenceHead}><span>Observation</span><span>Status</span><span>Value</span><span>Source</span></div>
          {opportunity.evidence.map((item) => (
            <div className={styles.evidenceRow} key={item.observationId}>
              <span><i className={`${styles.evidenceDot} ${styles[item.role]}`} />{item.label}</span>
              <span>{item.role === "supporting" ? item.evidenceStatus : item.role}</span>
              <strong>{formatValue(item.rawValue, item.unit)}</strong>
              <small>{item.sourceId}</small>
            </div>
          ))}
        </div>
      </section>

      {!packet ? <section className={styles.reviewSection}>
        <div className={styles.sectionTitle}>
          <div><span className={styles.sectionLabel}>Human review</span><h3>Record a disposition</h3></div>
          <span>Decision remains with the accountable team</span>
        </div>
        <label className={styles.reasonField}>
          <span>Decision rationale</span>
          <textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} />
        </label>
        <div className={styles.reviewActions}>
          <button className={styles.approveButton} onClick={() => void review("approve")} disabled={busy}>Approve for routing</button>
          <button onClick={() => void review("request_evidence")} disabled={busy}>Request more evidence</button>
          <button className={styles.dismissButton} onClick={() => void review("dismiss")} disabled={busy}>Dismiss</button>
        </div>
      </section> : null}

      <div className={styles.detailFooterGrid}>
        <section className={styles.communicationSection}>
          <span className={styles.sectionLabel}>Stakeholder brief</span>
          <h3>Prepare communication</h3>
          <p>{packet ? "View a simulated preview from the validated ActionPacket. No message will be sent." : "Generate a controlled preview after the opportunity is approved."}</p>
          <div className={styles.channelActions}>
            <button onClick={() => void prepareDelivery("outlook")} disabled={busy || (!packet && opportunity.state !== "approved_for_routing")}>Outlook</button>
            <button onClick={() => void prepareDelivery("slack")} disabled={busy || (!packet && opportunity.state !== "approved_for_routing")}>Slack</button>
          </div>
          {delivery ? <div className={styles.messagePreview}><strong>{delivery.subject}</strong><p>{delivery.message}</p></div> : null}
        </section>

        <section className={styles.auditSection}>
          <span className={styles.sectionLabel}>Activity record</span>
          <h3>Audit history</h3>
          <ol>
            <li><span>Opportunity detected</span><time>{formatTime(opportunity.detectedAt)}</time></li>
            {opportunity.reviewDecisions.map((decision) => <li key={decision.decisionId}><span>{stateLabel(decision.nextState)}</span><time>{formatTime(decision.decidedAt)}</time></li>)}
            {opportunity.deliveryReceipts.map((receipt) => <li key={receipt.receiptId}><span>{receipt.channel} preview</span><time>{formatTime(receipt.generatedAt)}</time></li>)}
          </ol>
        </section>
      </div>
    </div>
  );
}

export function ActionPacketDetail({ opportunity }: { opportunity: Opportunity }) {
  const packet = opportunity.actionPacket;
  if (!packet) return null;
  const explanation = opportunity.actionPacketExplanation;

  return (
    <div className={styles.packet}>
      <section className={styles.packetLead}>
        <div>
          <span className={styles.sectionLabel}>System disposition</span>
          <strong className={`${styles.disposition} ${styles[packet.systemDisposition]}`}>{packet.systemDisposition}</strong>
          <small>Deterministic policy result · No approval gate</small>
        </div>
        <div>
          <span className={styles.sectionLabel}>Prepared course of action</span>
          <h3>{packet.recommendedCourseOfAction}</h3>
          <p>{explanation?.limitation}</p>
          <small>Language: {explanation?.origin === "ai" ? `AI · ${explanation.modelVersion}` : `Deterministic fallback · ${explanation?.state ?? "available"}`}</small>
        </div>
      </section>

      <section className={styles.packetSection}>
        <div className={styles.sectionTitle}>
          <div><span className={styles.sectionLabel}>Completed analysis</span><h3>What the platform already checked</h3></div>
          <span>{packet.completedAnalysis.filter((item) => item.evaluation === "met").length} met · {packet.completedAnalysis.filter((item) => item.evaluation === "unknown").length} unknown</span>
        </div>
        <ul className={styles.analysisList}>
          {packet.completedAnalysis.map((item) => (
            <li key={item.analysisId}>
              <i className={`${styles.conditionMark} ${styles[item.evaluation]}`} />
              <div><strong>{item.label}</strong><span>{item.finding}</span></div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.packetSection}>
        <div className={styles.sectionTitle}>
          <div><span className={styles.sectionLabel}>Execution plan</span><h3>Ordered synthetic actions</h3></div>
          <span>{packet.orderedActions.length} prepared actions</span>
        </div>
        <ol className={styles.actionList}>
          {packet.orderedActions.map((item) => <li key={item.order}><span>{item.order}</span><div><strong>{item.action}</strong><small>{item.owner} · Prepared only</small></div></li>)}
        </ol>
      </section>

      <section className={styles.packetGrid}>
        <div>
          <span className={styles.sectionLabel}>Advance conditions</span>
          <h3>All required to proceed</h3>
          <ul>{packet.advanceConditions.map((item) => <li key={item.conditionId}><i className={`${styles.conditionMark} ${styles[item.evaluation]}`} />{item.label}</li>)}</ul>
        </div>
        <div>
          <span className={styles.sectionLabel}>Stop conditions</span>
          <h3>Close when confirmed</h3>
          <ul>{packet.stopConditions.map((item) => <li key={item.conditionId}><i className={`${styles.conditionMark} ${styles[item.evaluation]}`} />{item.label}</li>)}</ul>
        </div>
      </section>

      <section className={styles.packetSection}>
        <div className={styles.sectionTitle}>
          <div><span className={styles.sectionLabel}>Measurement</span><h3>{packet.measurableOutcome.name}</h3></div>
          <span>{packet.measurableOutcome.measurementWindowDays}-day synthetic window</span>
        </div>
        <p className={styles.outcomeCopy}>{packet.measurableOutcome.definition} Target: {packet.measurableOutcome.target} Baseline: {packet.measurableOutcome.baseline}</p>
        <div className={styles.guardrailGrid}>{packet.guardrails.map((item) => <div key={item.guardrailId}><strong>{item.label}</strong><span>{item.threshold}</span><small>{item.evaluation}</small></div>)}</div>
      </section>

      <section className={styles.packetGrid}>
        <div>
          <span className={styles.sectionLabel}>Remaining blockers</span>
          <h3>{packet.remainingBlockers.length ? `${packet.remainingBlockers.length} open` : "None"}</h3>
          {packet.remainingBlockers.length ? <ul>{packet.remainingBlockers.map((item) => <li key={item.blockerId}>{item.label}: {item.reason}</li>)}</ul> : <p>Every required synthetic input is available for this fixture.</p>}
        </div>
        <div>
          <span className={styles.sectionLabel}>Visible assumptions</span>
          <h3>Synthetic limitations</h3>
          <ul>{packet.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <section className={styles.packetSources}>
        <span className={styles.sectionLabel}>Packet provenance</span>
        <p>{packet.sourceIds.join(" · ")}</p>
        <small>{packet.packetVersion} · {packet.calculationVersion} · {packet.evidenceSnapshotVersion}</small>
      </section>
    </div>
  );
}
