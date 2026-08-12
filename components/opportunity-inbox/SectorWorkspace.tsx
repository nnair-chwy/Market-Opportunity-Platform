"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeliveryReceipt, Opportunity, OpportunityInboxSnapshot } from "@/lib/opportunity-inbox";
import {
  getOpportunityBlockers,
  summarizeSectorOpportunities,
} from "@/lib/opportunity-inbox/sector-opportunities";
import {
  SECTOR_SLUGS,
  SECTOR_WORKSPACES,
  type SectorWorkspaceDefinition,
} from "@/lib/opportunity-inbox/sector-catalog";
import styles from "./sector-workspace.module.css";
import { OpportunityDetail } from "./OpportunityInbox";

function stateLabel(state: Opportunity["state"]) {
  return state.replaceAll("_", " ");
}

export function SectorWorkspace({ definition }: { definition: SectorWorkspaceDefinition }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "opportunities">("profile");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryReceipt | null>(null);
  const [reviewReason, setReviewReason] = useState(
    "Evidence is sufficient for the synthetic demonstration.",
  );
  const workflowRef = useRef<HTMLElement>(null);

  const loadOpportunities = useCallback(async () => {
    const response = await fetch("/api/opportunity-runs", { cache: "no-store" });
    if (!response.ok) throw new Error("The sector opportunity queue could not load.");
    const snapshot = (await response.json()) as OpportunityInboxSnapshot;
    const sectorOpportunities = snapshot.opportunities.filter(
      (item) => item.sector === definition.sector,
    );
    setOpportunities(sectorOpportunities);
    setSelectedId((current) =>
      sectorOpportunities.some((item) => item.opportunityId === current)
        ? current
        : sectorOpportunities[0]?.opportunityId ?? null,
    );
    setLoaded(true);
  }, [definition.sector]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void loadOpportunities().catch(() => {
        if (active) setLoaded(true);
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadOpportunities]);

  const summary = summarizeSectorOpportunities(opportunities);
  const selected = opportunities.find((item) => item.opportunityId === selectedId) ?? opportunities[0] ?? null;

  function openWorkflow(opportunityId: string) {
    setSelectedId(opportunityId);
    setDelivery(null);
    window.requestAnimationFrame(() => {
      workflowRef.current?.focus({ preventScroll: true });
      workflowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

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
      await loadOpportunities();
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
      await loadOpportunities();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preview could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.workspace} ${styles[definition.sector]}`}>
      <aside className={styles.rail}>
        <Link href="/opportunities" className={styles.brand}>
          <span>M</span>
          <div><strong>Market Opportunity</strong><small>Decision platform</small></div>
        </Link>
        <nav aria-label="Opportunity sectors">
          <p>Portfolio</p>
          <Link href="/opportunities" className={styles.portfolioLink}>National radar</Link>
          <p>Sectors</p>
          {SECTOR_SLUGS.map((slug) => {
            const item = SECTOR_WORKSPACES[slug];
            return (
              <Link key={slug} href={`/opportunities/${slug}`} className={slug === definition.slug ? styles.active : ""}>
                <span>{item.code}</span>
                <strong>{item.name}</strong>
              </Link>
            );
          })}
        </nav>
        <div className={styles.railNote}>
          <span>Environment</span>
          <strong>Synthetic prototype</strong>
          <small>Planned sources are not connected</small>
        </div>
      </aside>

      <main>
        <header className={styles.topbar}>
          <div><Link href="/opportunities">Portfolio</Link><span>/</span><strong>{definition.name}</strong></div>
          <span className={styles.environment}>Synthetic prototype only</span>
        </header>

        <div className={styles.content}>
          <section className={styles.hero}>
            <div className={styles.sectorMark}>{definition.code}</div>
            <div className={styles.heroCopy}>
              <p>{definition.eyebrow}</p>
              <h1>{definition.name}</h1>
              <h2>{definition.mandate}</h2>
              <span>{definition.description}</span>
            </div>
            <dl className={styles.heroFacts}>
              <div><dt>Current playbook</dt><dd>{definition.playbookName}</dd></div>
              <div><dt>Accountable function</dt><dd>{definition.owner}</dd></div>
              <div><dt>Prototype coverage</dt><dd>Seattle CBSA 42660</dd></div>
            </dl>
          </section>

          <div className={styles.workspaceTabs} role="tablist" aria-label={`${definition.name} workspace views`}>
            <button
              type="button"
              role="tab"
              id="sector-profile-tab"
              aria-selected={activeTab === "profile"}
              aria-controls="sector-profile-panel"
              className={activeTab === "profile" ? styles.activeTab : ""}
              onClick={() => setActiveTab("profile")}
            >
              <span>Sector profile</span>
              <small>Mandate, playbook, data and guardrails</small>
            </button>
            <button
              type="button"
              role="tab"
              id="sector-opportunities-tab"
              aria-selected={activeTab === "opportunities"}
              aria-controls="sector-opportunities-panel"
              className={activeTab === "opportunities" ? styles.activeTab : ""}
              onClick={() => setActiveTab("opportunities")}
            >
              <span>Opportunities &amp; blockers</span>
              <small>{loaded ? `${summary.activeCount} active synthetic` : "Loading active findings"}</small>
            </button>
          </div>

          {activeTab === "profile" ? <div
            id="sector-profile-panel"
            role="tabpanel"
            aria-labelledby="sector-profile-tab"
            className={styles.tabPanel}
          >
          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <div><p className={styles.kicker}>Opportunity mandate</p><h2>What this sector is looking for</h2></div>
              <p>One implemented playbook and two forward-looking patterns. Future patterns remain product hypotheses until rules and owners are approved.</p>
            </header>
            <div className={styles.opportunityGrid}>
              {definition.opportunities.map((opportunity, index) => (
                <article key={opportunity.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{opportunity.title}</h3>
                  <p>{opportunity.description}</p>
                  <small>{opportunity.qualification}</small>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <div><p className={styles.kicker}>Evidence strategy</p><h2>What we consume today and what comes next</h2></div>
              <p>Current inputs are checked-in synthetic observations or non-scored public context. Planned inputs require access, governance, definitions, and operating ownership.</p>
            </header>
            <div className={styles.dataColumns}>
              <div className={styles.dataPanel}>
                <div className={styles.dataPanelTitle}><span>Available now</span><strong>Prototype inputs</strong></div>
                {definition.currentData.map((item) => (
                  <article key={item.name}>
                    <div><h3>{item.name}</h3><span>{item.status}</span></div>
                    <p>{item.use}</p>
                    <small>{item.source}</small>
                  </article>
                ))}
              </div>
              <div className={`${styles.dataPanel} ${styles.plannedPanel}`}>
                <div className={styles.dataPanelTitle}><span>Future state</span><strong>Planned, not connected</strong></div>
                {definition.plannedData.map((item) => (
                  <article key={item.name}>
                    <div><h3>{item.name}</h3><span>Approval required</span></div>
                    <p>{item.use}</p>
                    <dl><dt>Dependency</dt><dd>{item.dependency}</dd></dl>
                    <small>{item.source}</small>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.operatingModel}>
            <div>
              <p className={styles.kicker}>Decision boundary</p>
              <h2>Evidence becomes a reviewable opportunity, not an automatic decision.</h2>
              <p>The application validates inputs, applies the versioned sector playbook, retains missing or contradictory evidence, and prepares the permitted next step. Execution remains outside this prototype.</p>
            </div>
            <ol>
              <li><span>01</span><strong>Observe</strong><small>Receive approved, source-linked signals</small></li>
              <li><span>02</span><strong>Validate</strong><small>Check quality, freshness, geography, and duplicates</small></li>
              <li><span>03</span><strong>Qualify</strong><small>Apply deterministic sector-specific rules</small></li>
              <li><span>04</span><strong>Prepare</strong><small>Assemble evidence and the permitted next step</small></li>
            </ol>
            <div className={styles.guardrails}><span>Primary guardrails</span>{definition.guardrails.map((guardrail) => <em key={guardrail}>{guardrail}</em>)}</div>
          </section>
          </div> : <div
            id="sector-opportunities-panel"
            role="tabpanel"
            aria-labelledby="sector-opportunities-tab"
            className={styles.tabPanel}
          >
            <section className={styles.opportunityOverview}>
              <header>
                <div><p className={styles.kicker}>Sector queue</p><h2>Active synthetic opportunities</h2></div>
                <p>Findings shown here are generated from checked-in synthetic evidence. They are review artifacts, not verified market facts or authorization to act.</p>
              </header>
              <dl className={styles.queueMetrics}>
                <div><dt>Active</dt><dd>{loaded ? summary.activeCount : "–"}</dd></div>
                <div><dt>Needs attention</dt><dd>{loaded ? summary.needsAttentionCount : "–"}</dd></div>
                <div><dt>Open evidence blockers</dt><dd>{loaded ? summary.blockerCount : "–"}</dd></div>
                <div><dt>Average evidence coverage</dt><dd>{loaded ? `${Math.round(summary.averageCoverage * 100)}%` : "–"}</dd></div>
              </dl>
            </section>

            <section className={styles.opportunityQueue} aria-live="polite">
              {!loaded ? <div className={styles.emptyQueue}>Loading active findings for this sector.</div> : null}
              {loaded && !opportunities.length ? <div className={styles.emptyQueue}>Run the synthetic discovery workflow from the national radar to populate this sector.</div> : null}
              {opportunities.map((opportunity) => {
                const blockers = getOpportunityBlockers(opportunity);
                return (
                  <article className={`${styles.opportunityCard} ${selected?.opportunityId === opportunity.opportunityId ? styles.selectedOpportunity : ""}`} key={opportunity.opportunityId}>
                    <header>
                      <div>
                        <span className={styles.state}>{stateLabel(opportunity.state)}</span>
                        <h2>{opportunity.draft.headline}</h2>
                        <p>{opportunity.regionName} · {opportunity.owner}</p>
                      </div>
                      <div className={styles.coverage}><strong>{Math.round(opportunity.evidenceCoverage * 100)}%</strong><span>evidence coverage</span></div>
                    </header>
                    <div className={styles.opportunityBody}>
                      <div className={styles.findingDetail}>
                        <span>Why it qualified</span>
                        <h3>{opportunity.ruleLabel}</h3>
                        <p>{opportunity.ruleExplanation}</p>
                        <span>Prepared next step</span>
                        <p>{opportunity.draft.suggestedAction}</p>
                      </div>
                      <div className={styles.blockerPanel}>
                        <span>Current evidence blockers</span>
                        {blockers.length ? blockers.map((blocker) => (
                          <div key={blocker.id}>
                            <strong>{blocker.label}</strong>
                            <p>{blocker.reason}</p>
                            {blocker.sourceIds.length ? <small>Evidence: {blocker.sourceIds.join(", ")}</small> : null}
                          </div>
                        )) : <div className={styles.noBlockers}><strong>No current evidence blockers</strong><p>The synthetic inputs satisfy this playbook&apos;s configured evidence checks. Human review and real-source verification still apply.</p></div>}
                      </div>
                    </div>
                    <footer>
                      <span>Updated {new Date(opportunity.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <div>
                        <button type="button" onClick={() => openWorkflow(opportunity.opportunityId)}>Open sector workflow</button>
                        <Link href="/opportunities">View portfolio context</Link>
                      </div>
                    </footer>
                  </article>
                );
              })}
            </section>

            {error ? <div className={styles.workflowError} role="alert">{error}</div> : null}
            {selected ? <section ref={workflowRef} tabIndex={-1} className={styles.sectorWorkflow} aria-label="Sector opportunity workflow">
              <header>
                <div><p className={styles.kicker}>Sector workflow</p><h2>Review and progress this opportunity</h2></div>
                <p>Inspect the complete evidence record, record the permitted disposition, and prepare a simulated stakeholder brief without leaving {definition.name}.</p>
              </header>
              <OpportunityDetail
                opportunity={selected}
                reviewReason={reviewReason}
                setReviewReason={setReviewReason}
                review={review}
                prepareDelivery={prepareDelivery}
                delivery={delivery}
                busy={busy}
              />
            </section> : null}

            <section className={styles.activationBlockers}>
              <header><div><p className={styles.kicker}>Production readiness</p><h2>Unconnected dependencies</h2></div><p>These dependencies block production activation. They do not invalidate the current synthetic demonstration.</p></header>
              <div>
                {definition.plannedData.map((item) => (
                  <article key={item.name}>
                    <span>Unconnected</span>
                    <h3>{item.name}</h3>
                    <p>{item.dependency}</p>
                    <small>{item.source}</small>
                  </article>
                ))}
              </div>
            </section>
          </div>}
        </div>
      </main>
    </div>
  );
}
