"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AutonomousInsight, CurrentDataDiscoveryRun } from "@/lib/insight-discovery";
import { buildFindingDecisionCase } from "@/lib/insight-discovery/decision-case";
import { findingPresentation } from "@/lib/insight-discovery/finding-presentation";
import { buildMarketingOpportunityBrief } from "@/lib/insight-discovery/marketing-opportunity-brief";
import { buildCrossSourceHypothesisBacklog } from "@/lib/insight-discovery/hypothesis-backlog";
import type { PerspectiveId } from "@/lib/perspectives";

const LABELS: Record<PerspectiveId, string> = { marketing: "Marketing", pricing: "Pricing", cvc: "CVC" };
// Bump when generated finding semantics change so an older browser-saved run
// cannot silently reintroduce superseded recommendations or source language.
const DISCOVERY_HISTORY_KEY = "market-opportunity:discovery-run-history:v2";
const DISCOVERY_HISTORY_LIMIT = 5;

function adaptiveMetricValue(value: number, unit: string) {
  if (["ratio", "percentage_point_ratio"].includes(unit)) return `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  if (unit === "USD") return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function adaptivePortfolioDigest(findings: CurrentDataDiscoveryRun["adaptiveDiscovery"]["findings"]) {
  const take = (kind: (typeof findings)[number]["findingKind"], count: number) => findings.filter((finding) => finding.findingKind === kind).slice(0, count);
  return [
    ...take("opportunity", 2),
    ...take("contradiction", 1),
    ...take("cross_functional", 2),
    ...take("price_test", 2),
    ...take("competitive_risk", 1),
  ];
}

function findingFollowUps(finding: AutonomousInsight | null) {
  if (!finding) return ["Which finding has the strongest business case after accounting for evidence quality?", "Which missing outcome would most change the current recommendation?"];
  if (finding.department === "marketing") return [
    `Does ${finding.marketName}'s attributed efficiency remain after joining new-customer and contribution outcomes?`,
    `Why do ${finding.marketName}'s click-through rate, attributed conversion rate, and cost per conversion point in different directions?`,
  ];
  if (finding.department === "pricing") return [
    `Would matched-SKU margin and expected unit response support a regional price test in ${finding.marketName}?`,
    `Which products, retailers, and coverage gaps drive the ${finding.marketName} pricing signal?`,
  ];
  return [
    `Does ${finding.marketName} have enough current demand and staffed capacity to justify a clinic intervention?`,
    `How do ${finding.marketName}'s appointments, new-to-Chewy mix, and sales compare with mature clinics?`,
  ];
}

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
            <span>Recommended decision</span>
            <h2>{presentation.analystRecommendation}</h2>
          </section>
          <div className="discovery-region-rationale"><span>Why this market</span><p>{presentation.analystRead}</p></div>
          <div className="discovery-analyst-brief" aria-label="Analyst evidence summary">
            <div className="discovery-impact"><span>Business implication</span><strong>{presentation.valueStatus}</strong></div>
            <div><span>Evidence used</span><strong>{presentation.evidenceSummary}</strong></div>
            <div><span>Confidence and limit</span><strong>{presentation.confidenceStatement}</strong></div>
          </div>
          <div className="discovery-recommended-move"><span>Recommended next action</span><p>{presentation.nextAction}</p><small><strong>What could change this view:</strong> {presentation.reversalCondition}</small></div>
          <details className="discovery-method-detail">
            <summary>Calculation, assumptions, and decision rules</summary>
            <section className="discovery-decision-case" aria-label="Decision case">
              <div><span>Observed scenario</span><p>{decisionCase.scenario.summary} {decisionCase.scenario.range ?? ""}</p></div>
              <div><span>How this was calculated</span><p>{decisionCase.calculation.join(" ")}</p></div>
              <div><span>Why validation changes the decision</span><p>{decisionCase.whyValidationMatters.join(" ")}</p></div>
              <div><span>Success and stop rules</span><p>{decisionCase.successRule} {decisionCase.stopRule}</p></div>
            </section>
          </details>
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

export function AutonomousDiscoveryWorkspace({ onBack, onInvestigate, initialFindingId = null, initialRun = null }: {
  onBack: () => void;
  onInvestigate: (finding: AutonomousInsight, question?: string) => void;
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
  const followUpTarget = followUpFinding ?? primaryFindings[0] ?? null;
  const followUpSuggestions = findingFollowUps(followUpTarget);
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
  const marketingOpportunityBrief = useMemo(() => buildMarketingOpportunityBrief(run ?? undefined), [run]);
  const emergingHypotheses = useMemo(() => run ? buildCrossSourceHypothesisBacklog(run) : [], [run]);
  const readyHypotheses = useMemo(() => emergingHypotheses.filter((lead) => lead.status === "ready_to_test"), [emergingHypotheses]);
  const incompleteHypotheses = useMemo(() => emergingHypotheses.filter((lead) => lead.status === "waiting_for_join"), [emergingHypotheses]);
  const adaptiveFindings = useMemo(() => {
    if (!run) return [];
    if (department === "all") return adaptivePortfolioDigest(run.adaptiveDiscovery.findings);
    return run.adaptiveDiscovery.findings.filter((finding) => finding.departments.includes(department)).slice(0, 8);
  }, [department, run]);

  function openInAskAi(finding: AutonomousInsight) {
    setFollowUpFinding(finding);
    setFollowUpQuestion(finding.question);
    requestAnimationFrame(() => {
      followUpRef.current?.focus({ preventScroll: true });
      followUpRef.current?.select();
    });
  }

  function continueInvestigation() {
    const nextQuestion = followUpQuestion.trim();
    if (!nextQuestion || !followUpFinding) return;
    onInvestigate(followUpFinding, nextQuestion);
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
      <button className="text-action discovery-back" type="button" onClick={onBack}>← Back to questions</button>
      <div className="discovery-error" role="alert"><h1 id="autonomous-discovery-title">The current-data scan could not complete</h1><p>{error}</p><button className="primary-action" type="button" onClick={() => window.location.reload()}>Retry</button></div>
    </section>
  );

  if (!run) return (
    <section className="autonomous-discovery-page discovery-running" aria-labelledby="autonomous-discovery-title">
      <button className="text-action discovery-back" type="button" onClick={onBack}>← Back to questions</button>
      <div className="section-label">Autonomous insight discovery</div>
      <h1 id="autonomous-discovery-title">Investigating the current data without waiting for a question</h1>
      <p>The agent is profiling approved sources, generating decision hypotheses from observed patterns, and testing them with cohort, contradiction, channel-mix, quality, and matched-SKU analyses.</p>
      <ol className="discovery-running-steps">
        <li><span />Profile native source grain, measures, and quality</li>
        <li><span />Generate cross-team decision hypotheses from anomalies and contradictions</li>
        <li><span />Run bounded cohort, decomposition, and matched-SKU recipes</li>
        <li><span />Return the supported decision, benchmark, confidence, and limit</li>
      </ol>
    </section>
  );

  return (
    <section className="autonomous-discovery-page" aria-labelledby="autonomous-discovery-title" aria-busy={isRerunning}>
      <div className="discovery-page-nav">
        <button className="text-action discovery-back" type="button" onClick={onBack}>← Back to questions</button>
        <div className="discovery-run-controls">
          <span>Run {run.runSequence} complete · {new Date(run.completedAt).toLocaleString()}</span>
          <button className="discovery-share-all" type="button" onClick={() => void sendAllFindings()} disabled={isSending}>
            {isSending ? "Sending…" : "Send all to Slack"}
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
            {isRerunning ? `Testing ${run.analysesRun} analyses…` : "Find next signals"}
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
          <h1 id="autonomous-discovery-title">The decisions worth investigating first</h1>
          <p>The system generated decision hypotheses from the data, tested them with cohort, contradiction, channel-mix, quality, and matched-SKU operators, then separated observed evidence from the next decision.</p>
        </div>
        <span className="discovery-method">{run.adaptiveDiscovery.generatedCount} generated hypotheses · {run.adaptiveDiscovery.testedCount} evidence-backed</span>
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
        <div><dt>Analyses completed</dt><dd>{run.analysesRun}</dd><small>{run.adaptiveDiscovery.testedCount} adaptive · {screenCounts.marketing + screenCounts.pricing + screenCounts.cvc} baseline screens</small></div>
        <div><dt>Markets compared</dt><dd>{run.marketUniverse}</dd><small>National CBSA comparison universe</small></div>
        <div><dt>Measures checked</dt><dd>{run.measuresExamined}</dd><small>Unique measures in approved snapshots</small></div>
        <div><dt>Evidence-backed analyses</dt><dd>{run.adaptiveDiscovery.testedCount}</dd><small>Cohort, contradiction, channel, SKU, and cross-source tests</small></div>
      </dl>

      {readyHypotheses.length ? (
        <section className="discovery-hypothesis-backlog" aria-labelledby="discovery-hypothesis-backlog-title">
          <header>
            <div>
              <div className="section-label">Emerging cross-source questions</div>
              <h2 id="discovery-hypothesis-backlog-title">New hypotheses opened by this run</h2>
              <p>These questions have compatible evidence available for a bounded test. They are research priorities, not recommendations.</p>
            </div>
            <span>{readyHypotheses.length} ready to test</span>
          </header>
          <div>
            {readyHypotheses.map((lead) => (
              <article key={lead.hypothesisId}>
                <div><span>{lead.departments.map((item) => LABELS[item]).join(" + ")}</span><small>Ready to test</small></div>
                <h3>{lead.marketName}: {lead.headline}</h3>
                <p>{lead.hypothesis}</p>
                <strong>Next test</strong><p>{lead.nextTest}</p>
                <details><summary>Why it emerged and how to disprove it</summary><p>{lead.whyItEmerged}</p><p><b>Reject if:</b> {lead.falsificationRule}</p></details>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="discovery-department-tabs" role="tablist" aria-label="Insight department">
        {(["all", "marketing", "pricing", "cvc"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={department === item} onClick={() => setDepartment(item)}>
            {item === "all" ? "All departments" : LABELS[item]}
            <span>{item === "all" ? run.findings.length : run.findings.filter((finding) => finding.department === item).length}</span>
          </button>
        ))}
      </div>

      {adaptiveFindings.length ? (
        <section className="adaptive-decision-findings" aria-labelledby="adaptive-decision-findings-title">
          <header>
            <div>
              <div className="section-label">Generated from the evidence</div>
              <h2 id="adaptive-decision-findings-title">Cross-source signals that change a decision</h2>
              <p>Each question was opened by a repeatable pattern in the current data and tested with a bounded analytical recipe. The conclusion comes first; calculation and limits stay attached.</p>
            </div>
            <span>{adaptiveFindings.length} shown</span>
          </header>
          <div className="adaptive-decision-list">
            {adaptiveFindings.map((finding) => (
              <article key={finding.id} data-kind={finding.findingKind}>
                <div className="adaptive-decision-meta">
                  <span>{finding.departments.map((item) => LABELS[item]).join(" + ")}</span>
                  <small>{finding.confidence.level} descriptive confidence</small>
                </div>
                <h3>{finding.implication}</h3>
                <p className="adaptive-decision-question">{finding.question}</p>
                <div className="adaptive-decision-metrics">
                  {finding.metrics.slice(0, 3).map((metric) => (
                    <div key={metric.id}><strong>{adaptiveMetricValue(metric.value, metric.unit)}</strong><span>{metric.label}</span>{metric.benchmark !== undefined ? <small>Peer benchmark {adaptiveMetricValue(Number(metric.benchmark), metric.unit)}</small> : null}</div>
                  ))}
                </div>
                <div className="adaptive-decision-action"><span>What this changes now</span><p>{finding.proposedAction}</p></div>
                <details><summary>Evidence, calculation, and limits</summary><p>{finding.evidence.join(" ")}</p><p><strong>Confidence:</strong> {finding.confidence.reason}</p><p><strong>Boundary:</strong> {finding.decisionBoundary}</p><p><strong>Limits:</strong> {finding.limits.join(" ")}</p></details>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {incompleteHypotheses.length ? (
        <details className="discovery-hypothesis-backlog discovery-hypothesis-backlog-pending">
          <summary>Incomplete cross-source questions · {incompleteHypotheses.length}</summary>
          <p>These are not findings. The system noticed signals from different teams in the same named market, but the geography, period, or business outcomes are not compatible enough to determine whether the signals are related.</p>
          <div>
            {incompleteHypotheses.map((lead) => (
              <article key={lead.hypothesisId}>
                <div><span>{lead.departments.map((item) => LABELS[item]).join(" + ")}</span><small>Incomplete · do not act</small></div>
                <h3>{lead.marketName}: {lead.headline}</h3>
                <p><strong>What we know:</strong> Separate team findings appeared in the same market.</p>
                <p><strong>What we do not know:</strong> {lead.hypothesis}</p>
                <details><summary>What would make this answerable</summary><p>{lead.nextTest}</p><p><b>Required evidence:</b> {lead.requiredInputs.join("; ")}.</p><p><b>Reject if:</b> {lead.falsificationRule}</p></details>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {department === "all" || department === "marketing" ? (
        <section className="pricing-geo-test-handoff" aria-labelledby="marketing-opportunity-brief-title">
          <header>
            <div>
              <div className="section-label">Shareable Marketing opportunity brief</div>
              <h2 id="marketing-opportunity-brief-title">{marketingOpportunityBrief.title}</h2>
              <p>Prepared for {marketingOpportunityBrief.preparedFor} · {marketingOpportunityBrief.recipientRole}</p>
            </div>
            <button type="button" onClick={() => void downloadFindings("marketing", "docx")} disabled={Boolean(isExporting)}>
              {isExporting === "marketing:docx" ? "Preparing…" : "Download Word brief"}
            </button>
          </header>
          <div className="pricing-geo-test-recommendation">
            <span>Portfolio recommendation</span>
            <strong>{marketingOpportunityBrief.recommendation}</strong>
            <p>{marketingOpportunityBrief.why}</p>
          </div>
          <div className="pricing-geo-test-grid">
            {marketingOpportunityBrief.opportunityMoves.slice(0, 3).map((move) => <article key={move.market}><span>{move.market}</span><p><strong>{move.decision}.</strong> {move.evidence}</p></article>)}
          </div>
          <details>
            <summary>All opportunity moves, success measures, and limits</summary>
            {marketingOpportunityBrief.opportunityMoves.map((move) => <div key={move.market}><strong>{move.market}: {move.decision}</strong><p>{move.action}</p></div>)}
            <p><strong>Measure:</strong> {marketingOpportunityBrief.primaryOutcomes.join("; ")}.</p>
            <ul>{marketingOpportunityBrief.evidenceNeededToScale.map((input) => <li key={input}>{input}</li>)}</ul>
            <strong>{marketingOpportunityBrief.evidenceBoundary}</strong>
          </details>
        </section>
      ) : null}

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
          <p>{followUpTarget ? `Focused on ${followUpTarget.marketName}. Open another finding to change context.` : "Ask a follow-up about the discovery run."}</p>
        </div>
        <div className="discovery-follow-up-suggestions" aria-label="Recommended follow-up questions">
          {followUpSuggestions.map((suggestion) => <button key={suggestion} type="button" title={suggestion} onClick={() => setFollowUpQuestion(suggestion)}>{suggestion}</button>)}
        </div>
        <div className="discovery-follow-up-composer">
          <textarea ref={followUpRef} value={followUpQuestion} onChange={(event) => setFollowUpQuestion(event.target.value)} placeholder="Ask a follow-up, add another factor, or request a different comparison…" aria-label="Ask AI about these findings" rows={2} />
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
