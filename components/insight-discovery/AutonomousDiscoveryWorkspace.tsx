"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AutonomousInsight, CurrentDataDiscoveryRun } from "@/lib/insight-discovery";
import type { PerspectiveId } from "@/lib/perspectives";

const LABELS: Record<PerspectiveId, string> = { marketing: "Marketing", pricing: "Pricing", cvc: "CVC" };

const ACTIONABILITY_LABELS = {
  decision_ready: "Ready for accountable review",
  test_ready: "Ready to design a controlled test",
  investigation_ready: "Worth investigating",
  descriptive_only: "Context only",
} as const;

function InsightCard({ finding, rankLabel, onInvestigate, selected = false }: {
  finding: AutonomousInsight;
  rankLabel: string;
  onInvestigate: (question: string) => void;
  selected?: boolean;
}) {
  const interpretation = finding.analystInterpretation;
  return (
    <article
      className="autonomous-insight-card"
      data-department={finding.department}
      data-selected={selected || undefined}
      id={`discovery-${finding.insightId.replaceAll(":", "-")}`}
      tabIndex={-1}
    >
      <header className="discovery-card-header">
        <div className="discovery-card-identity">
          <b>{rankLabel}</b>
          <span>{LABELS[finding.department]}</span>
          <small>{finding.marketName}</small>
        </div>
        <div className="discovery-card-status">
          <div className="discovery-importance" data-tier={finding.importance.tier}>
            <strong>{finding.importance.label}</strong>
            <span>{finding.importance.score}/100</span>
          </div>
          {interpretation ? (
            <div className="discovery-actionability" data-level={interpretation.actionabilityLevel}>
              {ACTIONABILITY_LABELS[interpretation.actionabilityLevel]}
            </div>
          ) : null}
        </div>
      </header>
      {interpretation ? (
        <>
          <h2>{finding.headline}</h2>
          <div className="discovery-card-decision">
            <div className="discovery-business-value" data-status={finding.businessValue.status}>
              <span>{finding.businessValue.label}</span>
              <strong>{finding.businessValue.headline}</strong>
              <small>{finding.businessValue.formula}</small>
            </div>
            <div className="discovery-analyst-action">
              <span>Do next</span>
              <strong>{interpretation.recommendedNextDecisionOrAction}</strong>
            </div>
          </div>
        </>
      ) : (
        <><h2>{finding.headline}</h2><p>{finding.whyInteresting}</p></>
      )}
      <div className="discovery-card-footer">
        <p><span>Owner</span><strong>{finding.applicability.primaryTeamLabel}</strong></p>
        <button className="secondary-action" type="button" onClick={() => onInvestigate(finding.question)}>Open investigation →</button>
      </div>
      <details>
        <summary>Evidence, caveats, and decision rules</summary>
        <dl>
          <div><dt>What this could change</dt><dd>{interpretation?.whyThisMattersToBusinessOutcome ?? finding.whyInteresting}</dd></div>
          <div><dt>Important caveat</dt><dd>{finding.valueTranslation.caveat}</dd></div>
          <div><dt>Observed evidence proxy</dt><dd>{finding.valueTranslation.statement}</dd></div>
          <div><dt>Inputs needed to size value</dt><dd>{finding.businessValue.requiredInputs.join("; ")}</dd></div>
          <div><dt>Why this owner</dt><dd>{finding.applicability.reason}</dd></div>
          <div><dt>Analyst read</dt><dd>{interpretation?.analystConclusion ?? finding.whyInteresting}</dd></div>
          <div><dt>Decision question</dt><dd>{interpretation?.decisionQuestion ?? finding.question}</dd></div>
          <div><dt>Observed signal</dt><dd>{finding.headline}. {finding.whyInteresting}</dd></div>
          <div><dt>Evidence detail</dt><dd>{finding.evidenceDetail}</dd></div>
          <div><dt>Why it ranked here</dt><dd>{finding.decisionValue?.reason ?? "This earlier run did not record a decision-value explanation."}</dd></div>
          <div><dt>Importance</dt><dd>{finding.importance.reason}</dd></div>
          <div><dt>Screens combined</dt><dd>{finding.signalCount} screen{finding.signalCount === 1 ? "" : "s"}: {finding.hypothesisIds.join(", ")}</dd></div>
          <div><dt>Sources</dt><dd>{finding.sourceIds.join(", ")}</dd></div>
          <div><dt>Exact evidence still needed</dt><dd>{interpretation?.exactMissingEvidence.join(" ") ?? finding.nextValidation}</dd></div>
          <div><dt>Validation partner</dt><dd>{interpretation?.validationPartner.label ?? finding.applicability.partnerTeams.map((team) => team.label).join(", ")}</dd></div>
          <div><dt>Decision boundary</dt><dd>{interpretation?.approvalBoundary ?? finding.applicability.approvalBoundary}</dd></div>
        </dl>
      </details>
    </article>
  );
}

export function AutonomousDiscoveryWorkspace({ onBack, onInvestigate, initialFindingId = null, initialRun = null }: {
  onBack: () => void;
  onInvestigate: (question: string) => void;
  initialFindingId?: string | null;
  initialRun?: CurrentDataDiscoveryRun | null;
}) {
  const [run, setRun] = useState<CurrentDataDiscoveryRun | null>(initialRun);
  const [error, setError] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [slackConfig, setSlackConfig] = useState<{ configured: boolean; destination: string } | null>(null);
  const resultsHeadingRef = useRef<HTMLDivElement | null>(null);
  const [department, setDepartment] = useState<"all" | PerspectiveId>("all");

  const requestRun = useCallback(async (previousRun?: CurrentDataDiscoveryRun) => {
    const response = await fetch("/api/insight-discovery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(previousRun ? {
        previousRunId: previousRun.runId,
        previousPrimaryFindingIds: previousRun.primaryFindings.map((finding) => finding.insightId),
        explorationCursor: previousRun.explorationCursor,
      } : {}),
    });
    const payload = await response.json() as CurrentDataDiscoveryRun | { message?: string };
    if (!response.ok || !("findings" in payload)) throw new Error("message" in payload ? payload.message : "The insight scan did not complete.");
    return payload;
  }, []);

  useEffect(() => {
    if (initialRun) return;
    let cancelled = false;
    void requestRun()
      .then((payload) => { if (!cancelled) setRun(payload); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "The insight scan did not complete.");
      });
    return () => { cancelled = true; };
  }, [initialRun, requestRun]);

  async function runAgain() {
    if (!run || isRerunning) return;
    setIsRerunning(true);
    setError(null);
    try {
      const nextRun = await requestRun(run);
      setRun(nextRun);
      setDepartment("all");
      requestAnimationFrame(() => resultsHeadingRef.current?.focus());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The insight scan did not complete.");
    } finally {
      setIsRerunning(false);
    }
  }

  async function sendAllFindings() {
    if (!run || isSending) return;
    setIsSending(true);
    setShareStatus("Sending every qualified finding…");
    try {
      const config = slackConfig ?? await (await fetch("/api/share/slack", { cache: "no-store" })).json() as { configured: boolean; destination: string };
      setSlackConfig(config);
      if (!config.configured) {
        setShareStatus("Slack needs an administrator to connect the destination before findings can be sent.");
        return;
      }
      const response = await fetch("/api/share/slack/discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ run }),
      });
      const payload = await response.json() as { message?: string };
      setShareStatus(payload.message ?? (response.ok ? "Findings sent." : "Slack delivery did not complete."));
    } catch {
      setShareStatus("Slack delivery did not complete. The findings remain available here.");
    } finally {
      setIsSending(false);
    }
  }

  const primaryFindings = useMemo(() => (run?.primaryFindings
    .filter((finding) => department === "all" || finding.department === department)
    .sort((left, right) => right.importance.score - left.importance.score) ?? []), [department, run]);
  const additionalFindings = useMemo(() => (run?.additionalFindings
    .filter((finding) => department === "all" || finding.department === department)
    .sort((left, right) => right.importance.score - left.importance.score) ?? []), [department, run]);
  const selectedFinding = useMemo(
    () => run?.findings.find((finding) => finding.insightId === initialFindingId) ?? null,
    [initialFindingId, run],
  );
  const warehouseTemplates = useMemo(() => {
    const templates = run?.snowflakeEscalations.flatMap((assessment) => assessment.accessRequest?.templates ?? []) ?? [];
    return [...new Map(templates.map((template) => [template.templateId, template])).values()];
  }, [run]);
  const screenCounts = useMemo(() => ({
    marketing: run?.traces.filter((trace) => trace.department === "marketing").length ?? 0,
    pricing: run?.traces.filter((trace) => trace.department === "pricing").length ?? 0,
    cvc: run?.traces.filter((trace) => trace.department === "cvc").length ?? 0,
  }), [run]);

  useEffect(() => {
    if (!selectedFinding) return;
    requestAnimationFrame(() => {
      const target = document.getElementById(`discovery-${selectedFinding.insightId.replaceAll(":", "-")}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }, [selectedFinding]);

  if (error && !run) return (
    <section className="autonomous-discovery-page" aria-labelledby="autonomous-discovery-title">
      <button className="text-action" type="button" onClick={onBack}>← Back to questions</button>
      <div className="discovery-error" role="alert"><h1 id="autonomous-discovery-title">The current-data scan could not complete</h1><p>{error}</p><button className="primary-action" type="button" onClick={() => window.location.reload()}>Retry</button></div>
    </section>
  );

  if (!run) return (
    <section className="autonomous-discovery-page discovery-running" aria-labelledby="autonomous-discovery-title">
      <button className="text-action" type="button" onClick={onBack}>← Back to questions</button>
      <div className="section-label">Autonomous insight discovery</div>
      <h1 id="autonomous-discovery-title">Investigating the current data without waiting for a question</h1>
      <p>The agent is running the reviewed departmental hypothesis registry, screening regional contrasts, combining repeated market signals, challenging interpretations, and ranking the strongest leads.</p>
      <ol className="discovery-running-steps">
        <li><span />Generate Marketing, Pricing, and CVC hypotheses</li>
        <li><span />Run bounded queries across approved snapshots</li>
        <li><span />Deduplicate and cross-check repeated regional signals</li>
        <li><span />Return a five-item portfolio digest plus every additional qualified finding</li>
      </ol>
    </section>
  );

  return (
    <section className="autonomous-discovery-page" aria-labelledby="autonomous-discovery-title" aria-busy={isRerunning}>
      <div className="discovery-page-nav">
        <button className="text-action" type="button" onClick={onBack}>← Back to questions</button>
        <div className="discovery-run-controls">
          <span>Run {run.runSequence} complete · {new Date(run.completedAt).toLocaleString()}</span>
          <button className="discovery-share-all" type="button" onClick={() => void sendAllFindings()} disabled={isSending}>
            {isSending ? "Sending findings…" : "Send all findings to Slack"}
          </button>
          <button className="discovery-run-again" type="button" onClick={() => void runAgain()} disabled={isRerunning}>
            {isRerunning ? `Re-running ${run.analysesRun} screens…` : "Find next signals"}
          </button>
        </div>
      </div>
      {shareStatus ? <div className="discovery-share-status" role="status"><span>{shareStatus}</span><button type="button" aria-label="Dismiss Slack delivery status" onClick={() => setShareStatus(null)}>×</button></div> : null}
      <header className="discovery-hero">
        <div>
          <div className="section-label">Autonomous insight discovery</div>
          <h1 id="autonomous-discovery-title">The strongest regional signals in the current data</h1>
          <p>The system tested {run.analysesRun} predefined regional questions, ranked the qualified signals by decision value, and translated the strongest ones into a measurable next action.</p>
        </div>
        <span className="discovery-method">Reviewed query registry · deterministic evidence checks</span>
      </header>

      <div className="discovery-run-sequence" data-run-mode={run.runAudit.mode} role="status" aria-live="polite">
        <span>Run {run.runSequence}</span>
        <div>
          <strong>{run.runAudit.mode === "same_snapshot_reprioritization"
            ? "Same snapshots · next qualified findings"
            : run.runAudit.mode === "refreshed_data"
              ? "Source snapshots changed · refreshed ranking"
              : run.runAudit.mode === "snapshot_comparison_unavailable"
                ? "Next qualified findings · snapshot comparison unavailable"
                : "Initial approved-snapshot scan"}</strong>
          <small>{run.runAudit.mode === "same_snapshot_reprioritization"
            ? `All ${run.runAudit.reranHypothesisCount} investigations ran again. ${run.runAudit.excludedPreviousPrimaryFindingIds.length} prior digest finding(s) were held out so the next strongest qualified signals could surface; no data refresh is claimed.`
            : run.runAudit.mode === "refreshed_data"
              ? `All ${run.runAudit.reranHypothesisCount} investigations ran again against a different source-snapshot fingerprint.`
              : `All ${run.runAudit.reranHypothesisCount} reviewed investigations ran against the approved evidence available to this run.`}</small>
        </div>
      </div>
      {error ? <div className="discovery-rerun-error" role="alert"><span>{error} The completed run remains visible.</span><button type="button" onClick={() => void runAgain()}>Try run again</button></div> : null}

      <dl className="discovery-run-metrics">
        <div><dt>Decision screens tested</dt><dd>{run.analysesRun}</dd><small>{screenCounts.marketing} Marketing · {screenCounts.pricing} Pricing · {screenCounts.cvc} CVC</small></div>
        <div><dt>Markets compared</dt><dd>{run.marketUniverse}</dd><small>National CBSA comparison universe</small></div>
        <div><dt>Measures checked</dt><dd>{run.measuresExamined}</dd><small>Unique measures in approved snapshots</small></div>
        <div><dt>Qualified leads</dt><dd>{run.findings.length}</dd><small>Evidence-backed leads, not approved actions</small></div>
      </dl>

      <div className="discovery-department-tabs" role="tablist" aria-label="Insight department">
        {(["all", "marketing", "pricing", "cvc"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={department === item} onClick={() => setDepartment(item)}>
            {item === "all" ? "All departments" : LABELS[item]}
            <span>{item === "all" ? run.findings.length : run.findings.filter((finding) => finding.department === item).length}</span>
          </button>
        ))}
      </div>

      <div className="discovery-results-heading" ref={resultsHeadingRef} tabIndex={-1}>
        <div><div className="section-label">Primary digest</div><h2>Top findings to review first</h2></div>
        <span>{primaryFindings.length} shown{department === "all" ? " across the portfolio" : ` for ${LABELS[department]}`}</span>
      </div>

      <div className="autonomous-insight-grid">
        {primaryFindings.map((finding: AutonomousInsight, index) => (
          <InsightCard key={finding.insightId} finding={finding} rankLabel={`#${index + 1}`} onInvestigate={onInvestigate} selected={finding.insightId === initialFindingId} />
        ))}
      </div>

      {additionalFindings.length > 0 ? (
        <details className="discovery-additional-findings" open={Boolean(initialFindingId && additionalFindings.some((finding) => finding.insightId === initialFindingId)) || undefined}>
          <summary>Show {additionalFindings.length} additional reviewable lead{additionalFindings.length === 1 ? "" : "s"}</summary>
          <p>These have traceable evidence and a next validation step, but rank below the primary digest on present decision value.</p>
          <div className="autonomous-insight-grid">
            {additionalFindings.map((finding: AutonomousInsight, index) => (
              <InsightCard key={finding.insightId} finding={finding} rankLabel={`Additional #${index + 1}`} onInvestigate={onInvestigate} selected={finding.insightId === initialFindingId} />
            ))}
          </div>
        </details>
      ) : null}

      <details className="discovery-data-expansion">
        <summary>
          <div>
            <div className="section-label">Evidence needed next</div>
            <h2 id="discovery-data-expansion-title">{run.dataAccessSummary.status === "additional_access_recommended" ? "Connect business outcomes before turning these leads into material decisions" : "The current approved evidence is sufficient for this scan"}</h2>
            <p>{run.dataAccessSummary.status === "additional_access_recommended"
              ? `${run.dataAccessSummary.questionsNeedingWarehouseEvidence} screens still need first-party outcomes or operating context.`
              : "No additional warehouse evidence was identified for this run."}</p>
          </div>
          <span>Review evidence requests</span>
        </summary>
        {warehouseTemplates.length ? (
          <div className="discovery-access-request-grid">
            {warehouseTemplates.map((template) => (
              <article key={template.templateId}>
                <span>{template.owningTeam}</span>
                <h3>{template.semanticViewConcept.replace(/^governed_/, "").replaceAll("_", " ")}</h3>
                <p>{template.purpose}</p>
                <dl>
                  <div><dt>Metrics</dt><dd>{template.requiredMetrics.join(", ")}</dd></div>
                  <div><dt>Geography</dt><dd>{template.parameters.geographyGrains.join(", ")} · {template.parameters.geographyScope.replaceAll("_", " ")}</dd></div>
                  <div><dt>Time</dt><dd>{template.parameters.timeGrain} · {template.parameters.lookbackDays}-day lookback · finalized periods only</dd></div>
                  <div><dt>Privacy floor</dt><dd>Groups of at least {template.parameters.minimumGroupSize}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </details>

      <details className="discovery-run-audit">
        <summary>How the autonomous run worked · {run.traces.length} executed analyses</summary>
        <dl className="discovery-run-audit-meta">
          <div><dt>Run</dt><dd>{run.runId}</dd></div>
          <div><dt>Previous run</dt><dd>{run.runAudit.previousRunId ?? "None — initial scan"}</dd></div>
          <div><dt>Snapshot comparison</dt><dd>{run.runAudit.mode.replaceAll("_", " ")}</dd></div>
          <div><dt>Snapshot fingerprint</dt><dd>{run.runAudit.snapshotFingerprint.slice(0, 16)}…</dd></div>
        </dl>
        <ol>{run.traces.map((trace) => <li key={trace.hypothesisId}><strong>{trace.objective}</strong><span>{trace.question}</span><small>{trace.leadsFound} leads · {trace.comparisonsExamined.toLocaleString()} comparisons · {trace.sourceIds.join(", ")}</small></li>)}</ol>
        <h3>Current boundaries</h3>
        <ul>{run.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
      </details>
    </section>
  );
}
