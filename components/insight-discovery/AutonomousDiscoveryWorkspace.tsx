"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AutonomousInsight, CurrentDataDiscoveryRun } from "@/lib/insight-discovery";
import { buildFindingDecisionCase } from "@/lib/insight-discovery/decision-case";
import { findingPresentation } from "@/lib/insight-discovery/finding-presentation";
import type { PerspectiveId } from "@/lib/perspectives";

const LABELS: Record<PerspectiveId, string> = { marketing: "Marketing", pricing: "Pricing", cvc: "CVC" };
const DISCOVERY_HISTORY_KEY = "market-opportunity:discovery-run-history:v1";
const DISCOVERY_HISTORY_LIMIT = 5;

function InsightCard({ finding, rankLabel, onOpenInvestigation, selected = false }: {
  finding: AutonomousInsight;
  rankLabel: string;
  onOpenInvestigation: (finding: AutonomousInsight) => void;
  selected?: boolean;
}) {
  const interpretation = finding.analystInterpretation;
  const presentation = findingPresentation(finding);
  const decisionCase = buildFindingDecisionCase(finding);
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
          <div className="discovery-recommendation-type" data-type={presentation.recommendationType}>
            {presentation.recommendationLabel}
          </div>
        </div>
      </header>
      {interpretation ? (
        <>
          <section className="discovery-decision-first" aria-label="Recommended decision">
            <span>{presentation.recommendationLabel}</span>
            <h2>{presentation.primaryStatement}</h2>
            <p><strong>{decisionCase.scenario.label}:</strong> {decisionCase.scenario.summary}</p>
            {decisionCase.scenario.range ? <small>{decisionCase.scenario.range}</small> : null}
          </section>
          <div className="discovery-decision-facts" aria-label="Recommendation readiness">
            <div><span>Potential value</span><strong>{presentation.valueStatus}</strong></div>
            <div><span>Observed signal</span><strong>{presentation.signalConfidence}</strong></div>
            <div><span>Decision readiness</span><strong>{presentation.decisionReadiness}</strong></div>
            <div><span>Priority</span><strong>{presentation.urgency}</strong></div>
          </div>
          <div className="discovery-recommended-move"><span>Recommended move</span><p>{decisionCase.proposedAction}</p></div>
          <section className="discovery-decision-case" aria-label="Decision case">
            <div><span>How this was calculated</span><p>{decisionCase.calculation.join(" ")}</p></div>
            <div><span>Why validation changes the decision</span><p>{decisionCase.whyValidationMatters.join(" ")}</p></div>
            <div><span>Success rule</span><p>{decisionCase.successRule}</p></div>
            <div><span>Stop or reverse if</span><p>{decisionCase.stopRule}</p></div>
          </section>
          <div className="discovery-region-rationale"><span>Why this region</span><p>{finding.headline}. {finding.whyInteresting}</p></div>
        </>
      ) : (
        <><h2>{finding.headline}</h2><p>{finding.whyInteresting}</p></>
      )}
      <div className="discovery-card-footer">
        <p><span>Owner</span><strong>{finding.applicability.primaryTeamLabel}</strong></p>
        <button className="secondary-action" type="button" onClick={() => onOpenInvestigation(finding)}>Open in Ask AI →</button>
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
          <div><dt>Why it is in this action tier</dt><dd>{finding.importance.reason}</dd></div>
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

export function AutonomousDiscoveryWorkspace({ onInvestigate, initialFindingId = null, initialRun = null }: {
  onInvestigate: (question: string) => void;
  initialFindingId?: string | null;
  initialRun?: CurrentDataDiscoveryRun | null;
}) {
  const [run, setRun] = useState<CurrentDataDiscoveryRun | null>(initialRun);
  const [error, setError] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [followUpFinding, setFollowUpFinding] = useState<AutonomousInsight | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [slackConfig, setSlackConfig] = useState<{ configured: boolean; destination: string } | null>(null);
  const resultsHeadingRef = useRef<HTMLDivElement | null>(null);
  const followUpRef = useRef<HTMLTextAreaElement | null>(null);
  const [department, setDepartment] = useState<"all" | PerspectiveId>("all");
  const [runHistory, setRunHistory] = useState<CurrentDataDiscoveryRun[]>(() => {
    let storedRuns: CurrentDataDiscoveryRun[] = [];
    try {
      if (typeof window === "undefined") return initialRun ? [initialRun] : [];
      const stored = JSON.parse(window.localStorage.getItem(DISCOVERY_HISTORY_KEY) ?? "[]") as unknown;
      if (Array.isArray(stored)) {
        storedRuns = stored.filter((item): item is CurrentDataDiscoveryRun => Boolean(item) && typeof item === "object" && "runId" in item && "findings" in item);
      }
    } catch { /* Start with the current run when saved history is unavailable. */ }
    return initialRun
      ? [initialRun, ...storedRuns.filter((item) => item.runId !== initialRun.runId)].slice(0, DISCOVERY_HISTORY_LIMIT)
      : storedRuns.slice(0, DISCOVERY_HISTORY_LIMIT);
  });

  const rememberRun = useCallback((completedRun: CurrentDataDiscoveryRun) => {
    setRunHistory((history) => {
      const next = [completedRun, ...history.filter((item) => item.runId !== completedRun.runId)].slice(0, DISCOVERY_HISTORY_LIMIT);
      try { window.localStorage.setItem(DISCOVERY_HISTORY_KEY, JSON.stringify(next)); } catch { /* The completed run still remains in memory. */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!initialRun) return;
    try { window.localStorage.setItem(DISCOVERY_HISTORY_KEY, JSON.stringify(runHistory)); } catch { /* The run remains available in memory. */ }
  }, [initialRun, runHistory]);

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
      .then((payload) => { if (!cancelled) { setRun(payload); rememberRun(payload); } })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "The insight scan did not complete.");
      });
    return () => { cancelled = true; };
  }, [initialRun, rememberRun, requestRun]);

  async function runAgain() {
    if (!run || isRerunning) return;
    setIsRerunning(true);
    setError(null);
    try {
      const nextRun = await requestRun(run);
      setRun(nextRun);
      rememberRun(nextRun);
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

  async function downloadFindings(scope: "all" | PerspectiveId, format: "csv" | "docx") {
    if (!run || isExporting) return;
    const exportKey = `${scope}:${format}`;
    setIsExporting(exportKey);
    setShareStatus(null);
    try {
      const response = await fetch("/api/insight-discovery/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ run, scope, format }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(payload.message ?? "The findings export did not complete.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1]
        ?? `market-opportunity-findings-${scope}.${format}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setShareStatus(reason instanceof Error ? reason.message : "The findings export did not complete.");
    } finally {
      setIsExporting(null);
    }
  }

  const primaryFindings = useMemo(() => (run?.primaryFindings
    .filter((finding) => department === "all" || finding.department === department)
    .sort((left, right) => right.importance.score - left.importance.score) ?? []), [department, run]);
  const additionalFindings = useMemo(() => (run?.additionalFindings
    .filter((finding) => department === "all" || finding.department === department)
    .sort((left, right) => right.importance.score - left.importance.score) ?? []), [department, run]);
  const additionalOpportunities = useMemo(() => additionalFindings.filter((finding) => findingPresentation(finding).recommendationType !== "data_quality"), [additionalFindings]);
  const dataQualityFindings = useMemo(() => additionalFindings.filter((finding) => findingPresentation(finding).recommendationType === "data_quality"), [additionalFindings]);
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

  function openInAskAi(finding: AutonomousInsight) {
    setFollowUpFinding(finding);
    setFollowUpQuestion(finding.question);
    requestAnimationFrame(() => {
      followUpRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      followUpRef.current?.focus({ preventScroll: true });
      followUpRef.current?.select();
    });
  }

  function continueInvestigation() {
    const nextQuestion = followUpQuestion.trim();
    if (!nextQuestion) return;
    onInvestigate(nextQuestion);
  }

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
      <div className="discovery-error" role="alert"><h1 id="autonomous-discovery-title">The current-data scan could not complete</h1><p>{error}</p><button className="primary-action" type="button" onClick={() => window.location.reload()}>Retry</button></div>
    </section>
  );

  if (!run) return (
    <section className="autonomous-discovery-page discovery-running" aria-labelledby="autonomous-discovery-title">
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
        <div className="discovery-run-controls">
          <span>Run {run.runSequence} complete · {new Date(run.completedAt).toLocaleString()}</span>
          <button className="discovery-share-all" type="button" onClick={() => void sendAllFindings()} disabled={isSending}>
            {isSending ? "Sending findings…" : "Send all findings to Slack"}
          </button>
          <details className="discovery-export-menu">
            <summary>{isExporting ? "Preparing download…" : "Download findings"}</summary>
            <div>
              {(["all", "marketing", "pricing", "cvc"] as const).map((scope) => (
                <section key={scope} aria-label={`${scope === "all" ? "All teams" : LABELS[scope]} exports`}>
                  <strong>{scope === "all" ? "All teams" : LABELS[scope]}</strong>
                  <button type="button" disabled={Boolean(isExporting)} onClick={() => void downloadFindings(scope, "csv")}>CSV</button>
                  <button type="button" disabled={Boolean(isExporting)} onClick={() => void downloadFindings(scope, "docx")}>Word brief</button>
                </section>
              ))}
            </div>
          </details>
          <button className="discovery-run-again" type="button" onClick={() => void runAgain()} disabled={isRerunning}>
            {isRerunning ? `Re-running ${run.analysesRun} screens…` : "Find next signals"}
          </button>
        </div>
      </div>
      {runHistory.some((item) => item.runId !== run.runId) ? (
        <details className="discovery-run-history">
          <summary>Previous investigations · {runHistory.filter((item) => item.runId !== run.runId).length}</summary>
          <div>
            {runHistory.filter((item) => item.runId !== run.runId).map((item) => (
              <button key={item.runId} type="button" onClick={() => { setRun(item); setDepartment("all"); requestAnimationFrame(() => resultsHeadingRef.current?.focus()); }}>
                <strong>Run {item.runSequence}</strong>
                <span>{new Date(item.completedAt).toLocaleString()} · {item.findings.length} qualified findings</span>
              </button>
            ))}
          </div>
        </details>
      ) : null}
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
          <InsightCard key={finding.insightId} finding={finding} rankLabel={`#${index + 1}`} onOpenInvestigation={openInAskAi} selected={finding.insightId === initialFindingId} />
        ))}
      </div>

      {additionalOpportunities.length > 0 ? (
        <details className="discovery-additional-findings" open={Boolean(initialFindingId && additionalFindings.some((finding) => finding.insightId === initialFindingId)) || undefined}>
          <summary>Show {additionalOpportunities.length} additional reviewable lead{additionalOpportunities.length === 1 ? "" : "s"}</summary>
          <p>These have traceable evidence and a next validation step, but rank below the primary digest on present decision value.</p>
          <div className="autonomous-insight-grid">
            {additionalOpportunities.map((finding: AutonomousInsight, index) => (
              <InsightCard key={finding.insightId} finding={finding} rankLabel={`Additional #${index + 1}`} onOpenInvestigation={openInAskAi} selected={finding.insightId === initialFindingId} />
            ))}
          </div>
        </details>
      ) : null}

      {dataQualityFindings.length > 0 ? (
        <details className="discovery-additional-findings discovery-data-quality-findings">
          <summary>{dataQualityFindings.length} source issue{dataQualityFindings.length === 1 ? "" : "s"} excluded from opportunity ranking</summary>
          <p>These are pipeline repair items, not recommendations. They remain available for data owners without taking space in the primary opportunity digest.</p>
          <div className="autonomous-insight-grid">
            {dataQualityFindings.map((finding: AutonomousInsight, index) => (
              <InsightCard key={finding.insightId} finding={finding} rankLabel={`Data issue #${index + 1}`} onOpenInvestigation={openInAskAi} selected={finding.insightId === initialFindingId} />
            ))}
          </div>
        </details>
      ) : null}

      <section className="discovery-follow-up" aria-labelledby="discovery-follow-up-title">
        <div>
          <div className="section-label">Ask AI</div>
          <h2 id="discovery-follow-up-title">Continue the investigation</h2>
          <p>{followUpFinding ? `Using the ${followUpFinding.marketName} finding as context. Edit the question or ask the analyst to explain or test another factor.` : "Open any finding above or ask a new follow-up about the discovery run."}</p>
        </div>
        <div className="discovery-follow-up-suggestions" aria-label="Recommended follow-up questions">
          <button type="button" onClick={() => setFollowUpQuestion(`Investigate whether ${followUpFinding?.marketName ?? "the strongest market"}'s signal remains after joining first-party outcomes and comparing similar markets.`)}>Investigate more deeply</button>
          <button type="button" onClick={() => setFollowUpQuestion(`Explain how the ${followUpFinding?.marketName ?? "top"} finding was calculated, what is observed versus assumed, and what evidence could change it.`)}>Explain this finding</button>
        </div>
        <div className="discovery-follow-up-composer">
          <textarea ref={followUpRef} value={followUpQuestion} onChange={(event) => setFollowUpQuestion(event.target.value)} placeholder="Ask a follow-up, add another factor, or request a different comparison…" aria-label="Ask AI about these findings" />
          <button className="primary-action" type="button" disabled={!followUpQuestion.trim()} onClick={continueInvestigation}>Continue investigation →</button>
        </div>
        <small>The question opens the normal analysis plan so you can confirm the evidence and geography before it runs.</small>
      </section>

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
