"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { seattleAgentRunSchema, type SeattleAgentRun, type SegmentationDecision } from "@/lib/seattle-market-deep-dive/agent-contracts";
import { seattleDeepDiveManifest, seattleDemoBrokers, seattleSubmarkets } from "@/lib/seattle-market-deep-dive/data";
import { compareSeattleSubmarkets } from "@/lib/seattle-market-deep-dive/scoring";
import styles from "./seattle-market-deep-dive.module.css";

type Props = {
  initialRun?: SeattleAgentRun | null;
  autoStart?: boolean;
  activeSubmarketId?: string | null;
  onActiveSubmarketChange?: (submarketId: string | null) => void;
  onBack: () => void;
};
const STATUS: Record<SeattleAgentRun["status"], string> = {
  planned: "Planned", collecting: "Collecting context", waiting_for_segmentation_review: "Waiting for segmentation review",
  validating: "Validating evidence", comparing: "Comparing submarkets", preparing_broker_research: "Preparing broker research",
  drafting: "Drafting packet", completed: "Draft complete", blocked: "Blocked", failed: "Failed safely",
};

function message(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string" ? payload.message : fallback;
}

export function SeattleMarketDeepDive({
  initialRun = null,
  autoStart = true,
  activeSubmarketId = null,
  onActiveSubmarketChange,
  onBack,
}: Props) {
  const [run, setRun] = useState<SeattleAgentRun | null>(initialRun);
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const started = useRef(Boolean(initialRun)); const comparison = useMemo(() => compareSeattleSubmarkets(seattleSubmarkets), []);

  async function start() {
    if (loading) return; setLoading(true); setError("");
    try {
      const response = await fetch("/api/market-deep-dive-runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cbsaCode: "42660" }) });
      const payload: unknown = await response.json().catch(() => null); if (!response.ok) throw new Error(message(payload, "Seattle deep dive could not start."));
      setRun(seattleAgentRunSchema.parse(payload)); started.current = true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Seattle deep dive could not start."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (autoStart && !started.current) { started.current = true; void start(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(decisionId: string, decision: SegmentationDecision) {
    if (!run || loading) return; setLoading(true); setError("");
    try {
      const response = await fetch(`/api/market-deep-dive-runs/${encodeURIComponent(run.runId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decisionId, decision }) });
      const payload: unknown = await response.json().catch(() => null); if (!response.ok) throw new Error(message(payload, "Seattle deep dive could not continue."));
      setRun(seattleAgentRunSchema.parse(payload));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Seattle deep dive could not continue."); }
    finally { setLoading(false); }
  }

  const pending = run?.requestedHumanDecisions.find((item) => item.status === "pending") ?? null;
  const completedSteps = run?.plannedSteps.filter((step) => step.status === "completed").length ?? 0;
  const showComparison = Boolean(run?.comparisonReady); const showBrokers = Boolean(run?.brokerDirectoryReady);

  function focusSubmarket(submarketId: string) {
    onActiveSubmarketChange?.(submarketId);
  }

  function viewAreasOnMap() {
    document.querySelector<HTMLElement>("[data-unified-map='true']")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <section className={styles.workspace} aria-labelledby="seattle-deep-dive-title">
    <header className={styles.hero}>
      <div><button className={styles.back} onClick={onBack}>← Back to market overview</button><p className={styles.eyebrow}>Bounded Seattle demo</p>
        <h1 id="seattle-deep-dive-title">Seattle market deep dive</h1>
        <p>Split one selected market into synthetic submarkets, compare priorities under demo criteria, and prepare fictional broker research leads.</p></div>
      <div className={styles.status}><span>Run status</span><strong>{run ? STATUS[run.status] : loading ? "Starting" : "Not started"}</strong><small>Process-local prototype</small></div>
    </header>

    <div className={styles.boundary}><strong>Demo boundaries</strong><span>All submarket values are synthetic.</span><span>Public CBSA context is non-scored.</span><span>Broker profiles are fictional and unverified.</span><span>No market-entry, property, or lease decision is produced.</span></div>
    {error ? <div className={styles.error} role="alert"><strong>Run needs attention</strong><span>{error}</span><button onClick={() => void start()}>Retry</button></div> : null}
    {!run ? <div className={styles.empty}><strong>{loading ? "Starting the bounded workflow" : "Prepare the Seattle demo"}</strong><p>The workflow will pause before comparing the proposed segmentation.</p>{!autoStart && !loading ? <button onClick={() => void start()}>Start demo</button> : null}</div> : <>
      <div className={styles.summary}><div><span>Market</span><strong>{run.marketName}</strong><small>CBSA {run.cbsaCode}</small></div><div><span>Current step</span><strong>{run.currentStep}</strong><small>{run.stepCount} of {run.maxSteps} maximum tools</small></div><div><span>Plan progress</span><strong>{completedSteps} / {run.plannedSteps.length}</strong><small>Visible and bounded</small></div></div>
      <div className={styles.grid}><div className={styles.main}>
        <article className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Analyst-defined proposal</p><h2>Seven Seattle demo areas</h2></div><span>Hypothesis</span></div>
          <div className={styles.mapDisclosure} role="note">
            <div><strong>Illustrative demo areas</strong><p>These overlapping shapes use approximate public city-center hubs. They are synthetic analysis aids, not approved neighborhoods, trade areas, service areas, drive-time polygons, or scoring inputs.</p></div>
            <button type="button" onClick={viewAreasOnMap}>View illustrative areas on map</button>
          </div>
          <ol className={styles.legend}>{seattleSubmarkets.map((item) => <li key={item.submarket_id}>
            <button
              type="button"
              className={activeSubmarketId === item.submarket_id ? styles.activeArea : undefined}
              aria-pressed={activeSubmarketId === item.submarket_id}
              onClick={() => focusSubmarket(item.submarket_id)}
              onMouseEnter={() => focusSubmarket(item.submarket_id)}
              onFocus={() => focusSubmarket(item.submarket_id)}
            >
              <span style={{ background: item.display_color }}>{item.display_number}</span>
              <div><strong>{item.label}</strong><small>{item.hub.place_label} hub · {item.hub.radius_km} km illustrative radius</small></div>
            </button>
          </li>)}</ol>
          <div className={styles.method}><span>Fixture {seattleDeepDiveManifest.fixture_version}</span><span>Method {seattleDeepDiveManifest.geometry_method_version}</span><span>Geometry scoring: none</span></div>
        </article>
        {pending ? <article className={styles.approval}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Analyst confirmation required</p><h2>{pending.question}</h2></div><span>Paused</span></div><p>{pending.reason}</p>
          <div className={styles.actions}><button disabled={loading} onClick={() => void decide(pending.decisionId, "confirm")}>Confirm demo segmentation</button><button disabled={loading} onClick={() => void decide(pending.decisionId, "reject")}>Reject</button><button disabled={loading} onClick={() => void decide(pending.decisionId, "leave_unresolved")}>Leave unresolved</button></div>
        </article> : null}
        {showComparison ? <article className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Deterministic comparison</p><h2>Priority under demo criteria</h2></div><span>Top 3</span></div>
          <div className={styles.priority}>{comparison.scores.slice(0, 3).map((score) => <button type="button" className={activeSubmarketId === score.submarketId ? styles.activeArea : undefined} aria-pressed={activeSubmarketId === score.submarketId} onClick={() => focusSubmarket(score.submarketId)} onMouseEnter={() => focusSubmarket(score.submarketId)} onFocus={() => focusSubmarket(score.submarketId)} key={score.submarketId}><span>Priority {score.priorityRank}</span><strong>{score.label}</strong><b>{score.overallScore.toFixed(1)}</b><small>Coverage {score.coveragePercent}% · rank range {score.sensitivity.bestRank}-{score.sensitivity.worstRank}</small></button>)}</div>
          <div className={styles.tableWrap}><table><thead><tr><th>Submarket</th><th>Score</th><th>Coverage</th><th>Sensitivity</th><th>Missing</th></tr></thead><tbody>{comparison.scores.map((score) => <tr className={activeSubmarketId === score.submarketId ? styles.activeRow : undefined} key={score.submarketId}><td><button type="button" onClick={() => focusSubmarket(score.submarketId)} onMouseEnter={() => focusSubmarket(score.submarketId)} onFocus={() => focusSubmarket(score.submarketId)}>{score.priorityRank}. {score.label}</button></td><td>{score.overallScore.toFixed(2)}</td><td>{score.coveragePercent}%</td><td>{score.sensitivity.bestRank}-{score.sensitivity.worstRank}</td><td>{score.missingInputs.length ? score.missingInputs.join(", ").replaceAll("_", " ") : "None"}</td></tr>)}</tbody></table></div>
          <details><summary>Show metric contributions</summary>{comparison.scores.slice(0, 3).map((score) => <div className={styles.contributions} key={score.submarketId}><strong>{score.label}</strong>{score.metricResults.map((metric) => <span key={metric.metricId}>{metric.label}: {metric.rawValue ?? "Missing"} × {metric.effectiveWeight.toFixed(1)}% = {metric.contribution ?? "Excluded"}</span>)}</div>)}</details>
        </article> : null}
        {showBrokers ? <article className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Fictional workflow data</p><h2>Broker research leads</h2></div><span>Unverified</span></div><div className={styles.brokers}>{seattleDemoBrokers.map((broker) => <article key={broker.broker_profile_id}><strong>{broker.display_name}</strong><span>{broker.firm_name}</span><small>{broker.coverage_labels.join(" · ")}</small><small>{broker.specialty_labels.join(" · ")}</small><code>{broker.contact_page_placeholder}</code></article>)}</div><p className={styles.note}>These are fictional profiles, not real contacts. License and verify a real directory before outreach.</p></article> : null}
        {run.artifact ? <article className={styles.packet}><p className={styles.eyebrow}>Draft output</p><h2>{run.artifact.title}</h2><p>{run.artifact.summary}</p><h3>What remains before real use</h3><ul>{run.artifact.remainingItems.map((item) => <li key={item}>{item}</li>)}</ul><small>Sources: {run.artifact.sourceIds.join(" · ")}</small></article> : null}
      </div><aside className={styles.side}>
        <article className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Visible plan</p><h2>Run checklist</h2></div></div><ol className={styles.plan}>{run.plannedSteps.map((step) => <li key={step.stepId} data-status={step.status}><span>{step.status === "completed" ? "✓" : step.status === "waiting" ? "!" : "•"}</span><div><strong>{step.label}</strong><small>{step.status}</small></div></li>)}</ol></article>
        <article className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Tool activity</p><h2>Evidence trail</h2></div><span>{run.toolInvocations.length}</span></div><ol className={styles.timeline}>{run.toolInvocations.map((item) => <li key={item.invocationId}><strong>{item.toolName.replaceAll("_", " ")}</strong><p>{item.summary}</p><small>{item.sourceIds.join(" · ")}</small></li>)}</ol></article>
        <article className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Evidence use</p><h2>Receipts</h2></div></div>{run.evidenceReceipts.map((item) => <div className={styles.receipt} key={item.receiptId}><strong>{item.label}</strong><span>{item.evidenceStatuses.join(" · ")}</span><small>{item.allowedUse} · scoring {item.scoringEligibility}</small><small>{item.sourceIds.join(" · ")}</small></div>)}</article>
      </aside></div>
    </>}
  </section>;
}
