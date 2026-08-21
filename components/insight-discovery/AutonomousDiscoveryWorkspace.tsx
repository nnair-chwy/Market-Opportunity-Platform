"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AutonomousInsight, CurrentDataDiscoveryRun, HybridDiscoveryRun, HybridInvestigationReceipt, HybridSupplementalFinding } from "@/lib/insight-discovery";
import { buildFindingDecisionCase } from "@/lib/insight-discovery/decision-case";
import { findingPresentation } from "@/lib/insight-discovery/finding-presentation";
import { buildTeamOpportunityBrief } from "@/lib/insight-discovery/team-opportunity-brief";
import { buildCrossSourceHypothesisBacklog } from "@/lib/insight-discovery/hypothesis-backlog";
import type { PerspectiveId } from "@/lib/perspectives";

const LABELS: Record<PerspectiveId, string> = { marketing: "Marketing", pricing: "Pricing", cvc: "CVC" };
type DiscoveryScope = "all" | "cross" | PerspectiveId;
// Bump when generated finding semantics change so an older browser-saved run
// cannot silently reintroduce superseded recommendations or source language.
const DISCOVERY_HISTORY_KEY = "market-opportunity:discovery-run-history:v2";
const DISCOVERY_HISTORY_LIMIT = 5;

function adaptiveMetricValue(value: number, unit: string) {
  if (["ratio", "percentage_point_ratio"].includes(unit)) return `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  if (unit === "USD") return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function CrossSourceFindings({ findings }: { findings: CurrentDataDiscoveryRun["adaptiveDiscovery"]["findings"] }) {
  if (!findings.length) return null;
  return (
    <section className="adaptive-decision-findings" aria-labelledby="adaptive-decision-findings-title">
      <header>
        <div>
          <div className="section-label">Cross-functional opportunities</div>
          <h2 id="adaptive-decision-findings-title">Signals that become more useful when teams look together</h2>
          <p>Every finding here combines evidence owned by more than one team and states the decision that the joined evidence changes.</p>
        </div>
        <span>{findings.length} shown</span>
      </header>
      <div className="adaptive-decision-list">
        {findings.map((finding) => (
          <article key={finding.id} data-kind={finding.findingKind}>
            <div className="adaptive-decision-meta">
              <span>{finding.departments.map((item) => LABELS[item]).join(" + ")}</span>
              <small>{finding.confidence.level} descriptive confidence</small>
            </div>
            <h3>{finding.implication}</h3>
            <div className="adaptive-origin-question"><span>Question tested</span><p>{finding.question}</p></div>
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
  );
}

function AiSupplementalFindings({ findings }: { findings: HybridSupplementalFinding[] }) {
  if (!findings.length) return null;
  return (
    <section className="discovery-ai-findings" aria-labelledby="discovery-ai-findings-title">
      <header>
        <div>
          <div className="section-label">AI additional discovery</div>
          <h2 id="discovery-ai-findings-title">New findings that cleared the evidence bar</h2>
          <p>These were opened by the AI investigation, then promoted only after deterministic execution returned a quantified comparison, decision implication, sources, and limits.</p>
        </div>
        <span>{findings.length} new</span>
      </header>
      <div>
        {findings.map((finding) => (
          <article key={finding.id}>
            <div className="discovery-card-identity"><span>{LABELS[finding.department]}</span><small>{finding.marketIds.join(", ") || "National"}</small></div>
            <div className="discovery-origin-question"><span>Question tested</span><p>{finding.question}</p></div>
            <section className="discovery-decision-first"><span>Recommended decision</span><h2>{finding.recommendation}</h2></section>
            <div className="discovery-region-rationale"><span>What the analysis found</span><p>{finding.quantifiedEvidence} {finding.comparison}</p></div>
            <div className="discovery-recommended-move"><span>Why it matters</span><p>{finding.businessImplication}</p><small><strong>Next action:</strong> {finding.nextAction}</small></div>
            <details><summary>Sources and limits</summary><p><strong>Sources:</strong> {finding.sourceIds.join(", ")}</p><p><strong>Limits:</strong> {finding.limitations.join(" ")}</p></details>
          </article>
        ))}
      </div>
    </section>
  );
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
      <div className="discovery-origin-question"><span>Question tested</span><p>{finding.question}</p></div>
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
  onInvestigate: (finding: AutonomousInsight, question?: string, sourceRunId?: string) => void;
  initialFindingId?: string | null;
  initialRun?: CurrentDataDiscoveryRun | null;
}) {
  const [run, setRun] = useState<CurrentDataDiscoveryRun | null>(initialRun);
  const [error, setError] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);
  const [hybridStatus, setHybridStatus] = useState<"idle" | "running" | "completed" | "fallback">("idle");
  const [supplementalInvestigations, setSupplementalInvestigations] = useState<HybridInvestigationReceipt[]>([]);
  const [hybridMessage, setHybridMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"email" | "download" | null>(null);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [railActionsTarget, setRailActionsTarget] = useState<HTMLElement | null>(null);
  const [followUpFinding, setFollowUpFinding] = useState<AutonomousInsight | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const resultsHeadingRef = useRef<HTMLDivElement | null>(null);
  const followUpRef = useRef<HTMLTextAreaElement | null>(null);
  const deliveryPanelRef = useRef<HTMLElement | null>(null);
  const hybridStartedRunRef = useRef<string | null>(null);
  const [department, setDepartment] = useState<DiscoveryScope>("all");
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

  useEffect(() => {
    setRailActionsTarget(document.getElementById("discovery-rail-run-actions"));
  }, []);

  useEffect(() => {
    if (!deliveryMode) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    deliveryPanelRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDeliveryMode(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [deliveryMode]);

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

  const requestHybridRun = useCallback(async (baselineRun: CurrentDataDiscoveryRun, scope: DiscoveryScope) => {
    hybridStartedRunRef.current = baselineRun.runId;
    setHybridStatus("running");
    setSupplementalInvestigations([]);
    setHybridMessage(null);
    const response = await fetch("/api/insight-discovery/hybrid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "hybrid",
        ...(["marketing", "pricing", "cvc"].includes(scope) ? { department: scope } : {}),
        maxSteps: 5,
        maxResultRows: 50,
      }),
    });
    const payload = await response.json() as HybridDiscoveryRun | { message?: string };
    if (!response.ok || !("hybridAudit" in payload)) throw new Error("message" in payload ? payload.message : "AI additional discovery did not complete.");
    setSupplementalInvestigations(payload.supplementalInvestigations);
    setHybridStatus(payload.hybridAudit.mode === "hybrid_completed" ? "completed" : "fallback");
    setHybridMessage(payload.hybridAudit.fallbackReason ?? (payload.hybridAudit.mode === "hybrid_completed"
      ? `${payload.hybridAudit.stepsAttempted} additional investigation step${payload.hybridAudit.stepsAttempted === 1 ? "" : "s"} completed.`
      : "The deterministic baseline is complete; no model-led investigation ran."));
  }, []);

  useEffect(() => {
    if (!initialRun || hybridStartedRunRef.current === initialRun.runId) return;
    void requestHybridRun(initialRun, "all").catch((reason: unknown) => {
      setHybridStatus("fallback");
      setHybridMessage(reason instanceof Error ? reason.message : "AI additional discovery did not complete.");
    });
  }, [initialRun, requestHybridRun]);

  useEffect(() => {
    if (initialRun) return;
    let cancelled = false;
    void requestRun()
      .then((payload) => { if (!cancelled) { setRun(payload); rememberRun(payload); void requestHybridRun(payload, "all").catch((reason: unknown) => { if (!cancelled) { setHybridStatus("fallback"); setHybridMessage(reason instanceof Error ? reason.message : "AI additional discovery did not complete."); } }); } })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "The insight scan did not complete.");
      });
    return () => { cancelled = true; };
  }, [initialRun, rememberRun, requestHybridRun, requestRun]);

  async function runAgain() {
    if (!run || isRerunning) return;
    setIsRerunning(true);
    setError(null);
    try {
      const nextRun = await requestRun(run);
      setRun(nextRun);
      rememberRun(nextRun);
      setSupplementalInvestigations([]);
      void requestHybridRun(nextRun, department).catch((reason: unknown) => { setHybridStatus("fallback"); setHybridMessage(reason instanceof Error ? reason.message : "AI additional discovery did not complete."); });
      requestAnimationFrame(() => resultsHeadingRef.current?.focus());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The insight scan did not complete.");
    } finally {
      setIsRerunning(false);
    }
  }

  async function downloadFindings(scope: "all" | PerspectiveId, format: "csv" | "docx") {
    if (!run || isExporting) return false;
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
      return true;
    } catch (reason) {
      setShareStatus(reason instanceof Error ? reason.message : "The findings export did not complete.");
      return false;
    } finally {
      setIsExporting(null);
    }
  }

  async function emailFindings() {
    if (!run || !teamOpportunityBrief) return;
    if (!emailRecipient.trim() || !emailRecipient.includes("@")) {
      setShareStatus("Enter the email address that should receive the findings.");
      return;
    }
    const briefScope = department === "cross" ? "all" : department;
    const downloaded = await downloadFindings(briefScope, "docx");
    if (!downloaded) return;
    const audience = briefScope === "all" ? "Cross-team" : LABELS[briefScope];
    const highlights = teamOpportunityBrief.opportunityMoves.slice(0, 3)
      .map((move) => `• ${move.market}: ${move.decision}. ${move.evidence}`)
      .join("\n");
    const body = `${audience.toUpperCase()} OPPORTUNITY BRIEF\n\n${teamOpportunityBrief.recommendation}\n\nWhy it matters\n${teamOpportunityBrief.why}\n\nTop opportunities\n${highlights}\n\nA Word brief has been downloaded. Attach it after reviewing the findings.`;
    window.location.href = `mailto:${encodeURIComponent(emailRecipient.trim())}?subject=${encodeURIComponent(`${audience} market opportunity findings`)}&body=${encodeURIComponent(body)}`;
    setShareStatus("The Word brief was downloaded and an addressed email draft was opened. Attach the file, review, and send.");
  }

  const primaryFindings = useMemo(() => (run?.primaryFindings
    .filter((finding) => department !== "cross" && (department === "all" || finding.department === department))
    .sort((left, right) => right.importance.score - left.importance.score) ?? []), [department, run]);
  const additionalFindings = useMemo(() => (run?.additionalFindings
    .filter((finding) => department !== "cross" && (department === "all" || finding.department === department))
    .sort((left, right) => right.importance.score - left.importance.score) ?? []), [department, run]);
  const additionalOpportunities = useMemo(() => additionalFindings.filter((finding) => findingPresentation(finding).recommendationType !== "data_quality"), [additionalFindings]);
  const dataQualityFindings = useMemo(() => additionalFindings.filter((finding) => findingPresentation(finding).recommendationType === "data_quality"), [additionalFindings]);
  const followUpTarget = followUpFinding;
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
  const departmentFindingCounts = useMemo(() => ({
    marketing: run?.findings.filter((finding) => finding.department === "marketing").length ?? 0,
    pricing: run?.findings.filter((finding) => finding.department === "pricing").length ?? 0,
    cvc: run?.findings.filter((finding) => finding.department === "cvc").length ?? 0,
  }), [run]);
  const allFindingCount = run?.findings.length ?? 0;
  const briefScope = department === "cross" ? "all" : department;
  const teamOpportunityBrief = useMemo(() => run ? buildTeamOpportunityBrief(run, briefScope) : null, [briefScope, run]);
  const emergingHypotheses = useMemo(() => run ? buildCrossSourceHypothesisBacklog(run) : [], [run]);
  const readyHypotheses = useMemo(() => emergingHypotheses.filter((lead) => lead.status === "ready_to_test"), [emergingHypotheses]);
  const incompleteHypotheses = useMemo(() => emergingHypotheses.filter((lead) => lead.status === "waiting_for_join"), [emergingHypotheses]);
  const adaptiveFindings = useMemo(() => {
    if (!run) return [];
    const crossFunctional = run.adaptiveDiscovery.findings.filter((finding) => finding.departments.length > 1);
    return department === "cross" ? crossFunctional : [];
  }, [department, run]);
  const promotedAiFindings = useMemo(() => supplementalInvestigations
    .flatMap((receipt) => receipt.supplementalFinding ? [receipt.supplementalFinding] : [])
    .filter((finding) => department === "all" || (department !== "cross" && finding.department === department)), [department, supplementalInvestigations]);
  const keyTakeaways = useMemo(() => department === "cross" ? adaptiveFindings.map((finding) => ({
    id: finding.id,
    label: finding.departments.map((item) => LABELS[item]).join(" + "),
    finding: finding.implication,
    decision: finding.proposedAction,
    evidence: finding.evidence.join(" "),
  })) : primaryFindings.map((finding) => {
    const presentation = findingPresentation(finding);
    return {
      id: finding.insightId,
      label: `${LABELS[finding.department]} · ${finding.marketName}`,
      finding: finding.headline,
      decision: presentation.analystRecommendation,
      evidence: presentation.analystRead,
    };
  }), [adaptiveFindings, department, primaryFindings]);

  function openAiAttemptRecord() {
    const target = document.getElementById("discovery-ai-attempts") as HTMLDetailsElement | null;
    if (!target) return;
    target.open = true;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

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
    onInvestigate(followUpFinding, nextQuestion, run?.runId);
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
      {railActionsTarget ? createPortal(
        <div className="discovery-rail-action-stack" aria-label="Discovery actions">
          <button type="button" onClick={() => setDeliveryMode("email")}>Email findings</button>
          <button type="button" onClick={() => setDeliveryMode("download")}>Download findings</button>
          <button type="button" onClick={() => void runAgain()} disabled={isRerunning}>{isRerunning ? "Finding signals…" : "Find next signal"}</button>
        </div>,
        railActionsTarget,
      ) : null}
      <div className="discovery-page-nav">
        <button className="text-action discovery-back" type="button" onClick={onBack}>← Back to questions</button>
        <div className="discovery-run-controls">
          <span>Run {run.runSequence} complete · {new Date(run.completedAt).toLocaleString()}</span>
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
      {shareStatus ? <div className="discovery-share-status" role="status"><span>{shareStatus}</span><button type="button" aria-label="Dismiss delivery status" onClick={() => setShareStatus(null)}>×</button></div> : null}
      <header className="discovery-hero" ref={resultsHeadingRef} tabIndex={-1}>
        <div>
          <div className="section-label">Regional opportunity portfolio</div>
          <h1 id="autonomous-discovery-title">{department === "all"
            ? "Top opportunities across the portfolio"
            : department === "cross"
              ? "Cross-department opportunities"
              : `${LABELS[department]} opportunities to review`}</h1>
          <p>{department === "all"
            ? "The strongest evidence-backed opportunities, ranked together across Marketing, Pricing, and CVC."
            : department === "cross"
              ? "Joined signals that become more useful when evidence from two or more departments is evaluated together."
              : `The strongest evidence-backed opportunities owned by ${LABELS[department]}.`}</p>
        </div>
        <div className="discovery-department-tabs" role="tablist" aria-label="Filter findings by department">
          <button type="button" role="tab" aria-selected={department === "all"} onClick={() => setDepartment("all")}>All departments <span>{allFindingCount}</span></button>
          <button type="button" role="tab" aria-selected={department === "cross"} onClick={() => setDepartment("cross")}>Cross-department <span>{run.adaptiveDiscovery.findings.filter((finding) => finding.departments.length > 1).length}</span></button>
          {(["marketing", "pricing", "cvc"] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={department === item} onClick={() => setDepartment(item)}>{LABELS[item]} <span>{departmentFindingCounts[item]}</span></button>
          ))}
        </div>
        <div className="discovery-hero-meta">
          <span className="discovery-method">{run.adaptiveDiscovery.generatedCount} hypotheses tested · {run.adaptiveDiscovery.testedCount} evidence-backed analyses</span>
          <span>{department === "cross" ? adaptiveFindings.length : primaryFindings.length} top finding{(department === "cross" ? adaptiveFindings.length : primaryFindings.length) === 1 ? "" : "s"} shown</span>
        </div>
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

      <div className="discovery-ai-result-status" data-status={hybridStatus} role="status" aria-live="polite">
        <div>
          <span>AI expansion</span>
          <strong>{hybridStatus === "running"
            ? "Testing additional cross-source analyses"
            : promotedAiFindings.length
              ? `${promotedAiFindings.length} new AI finding${promotedAiFindings.length === 1 ? "" : "s"} cleared the evidence bar`
              : supplementalInvestigations.length
                ? `${supplementalInvestigations.length} additional analysis attempt${supplementalInvestigations.length === 1 ? "" : "s"} executed; none cleared the finding bar`
              : "No additional AI finding was produced in this run"}</strong>
          <small>{hybridStatus === "running"
            ? "The ranked evidence-backed findings remain available while this runs."
            : hybridMessage ?? "The evidence-backed findings below remain the complete stakeholder result."}</small>
        </div>
        {hybridStatus !== "running" ? <button type="button" onClick={openAiAttemptRecord}>Review analysis record ↓</button> : null}
      </div>

      {department !== "cross" ? <AiSupplementalFindings findings={promotedAiFindings} /> : null}

      <section className="discovery-executive-summary" aria-labelledby="discovery-executive-summary-title">
        <header>
          <div>
            <div className="section-label">Read this first</div>
            <h2 id="discovery-executive-summary-title">Decision takeaways</h2>
            <p>{keyTakeaways.length} takeaway{keyTakeaways.length === 1 ? "" : "s"} with the benchmark and evidence boundary attached.</p>
          </div>
          <span>Directional evidence</span>
        </header>
        <ul className="discovery-key-takeaways">
          {keyTakeaways.map((takeaway) => (
            <li key={takeaway.id}>
              <div><span>{takeaway.label}</span><small>{takeaway.evidence}</small></div>
              <div className="discovery-takeaway-decision">
                <strong>{takeaway.finding}</strong>
                <p><b>Decision:</b> {takeaway.decision}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="discovery-inference-boundary" aria-label="Statistical evidence boundary">
          <div>
            <span>Supported by this run</span>
            <strong>Observed differences and peer-relative patterns</strong>
            <p>Values, source periods, market comparisons, and descriptive benchmarks remain attached to each finding.</p>
          </div>
          <div data-status="not-tested">
            <span>Statistical significance</span>
            <strong>Not tested</strong>
            <p>The current snapshots do not provide the sample sizes, variance, confidence intervals, or experimental design needed for an inferential significance test.</p>
          </div>
        </div>
      </section>

      {department === "cross" ? <CrossSourceFindings findings={adaptiveFindings} /> : (
        <>
          <div className="discovery-findings-divider"><span>{department === "all" ? "Ranked portfolio findings" : `Ranked ${LABELS[department]} findings`}</span><small>{primaryFindings.length} shown</small></div>
          <div className="autonomous-insight-grid">
            {primaryFindings.map((finding: AutonomousInsight, index) => (
              <InsightCard key={finding.insightId} finding={finding} rankLabel={`#${index + 1}`} onOpenInvestigation={openInAskAi} selected={finding.insightId === initialFindingId} />
            ))}
          </div>
        </>
      )}

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

      <details id="discovery-ai-attempts" className="discovery-ai-additional" data-status={hybridStatus}>
        <summary>
          <div>
            <div className="section-label">Analysis expansion</div>
            <strong>AI analysis attempts</strong>
            <small>Methods and executed queries—not stakeholder recommendations.</small>
          </div>
          <span>{hybridStatus === "running" ? "Investigating…" : hybridStatus === "completed" ? `${supplementalInvestigations.length} executed` : hybridStatus === "fallback" ? "No new finding" : "Waiting"}</span>
        </summary>
        <div className="discovery-ai-additional-body" aria-live="polite">
          <p className="discovery-ai-boundary">An analysis is promoted into the findings above only when it returns a traceable result with a benchmark and a decision implication. Requests to add context remain here as investigation records.</p>
          {hybridStatus === "running" ? <div className="discovery-ai-progress"><i /><span>Choosing and testing the next bounded analysis…</span></div> : null}
          {supplementalInvestigations.length ? (
            <div className="discovery-ai-additional-list">
              {supplementalInvestigations.map((receipt) => (
                <article key={receipt.fingerprint}>
                  <div><span>{receipt.kind === "exploratory_query" ? "AI-designed query" : receipt.kind === "registered_query" ? "Registered query" : "Focused market screen"}</span><small>{receipt.marketIds.length} market{receipt.marketIds.length === 1 ? "" : "s"} · {receipt.sourceIds.length} source{receipt.sourceIds.length === 1 ? "" : "s"}</small></div>
                  <h3>{receipt.objective}</h3>
                  <p>{receipt.reason}</p>
                  <small>Measures checked: {receipt.measureLabels.join(", ") || "No new measure returned"}</small>
                </article>
              ))}
            </div>
          ) : hybridStatus !== "running" ? <p className="discovery-ai-empty">{hybridMessage ?? "No additional analysis produced a result strong enough to add to the stakeholder findings."}</p> : null}
        </div>
      </details>

      <details className="discovery-coverage-details">
        <summary>Coverage and method · {run.analysesRun} analyses · {run.marketUniverse} markets · {run.measuresExamined} measures</summary>
        <dl className="discovery-run-metrics">
          <div><dt>Analyses completed</dt><dd>{run.analysesRun}</dd><small>{run.adaptiveDiscovery.testedCount} adaptive · {screenCounts.marketing + screenCounts.pricing + screenCounts.cvc} baseline screens</small></div>
          <div><dt>Markets compared</dt><dd>{run.marketUniverse}</dd><small>National CBSA comparison universe</small></div>
          <div><dt>Measures checked</dt><dd>{run.measuresExamined}</dd><small>Unique measures in approved snapshots</small></div>
          <div><dt>Evidence-backed analyses</dt><dd>{run.adaptiveDiscovery.testedCount}</dd><small>Cohort, contradiction, channel, SKU, and cross-source tests</small></div>
        </dl>
      </details>

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

      {deliveryMode && teamOpportunityBrief ? (
        <div className="discovery-delivery-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDeliveryMode(null); }}>
          <section ref={deliveryPanelRef} className="discovery-delivery-panel" role="dialog" aria-modal="true" aria-labelledby="discovery-delivery-title" tabIndex={-1}>
            <header>
              <div><div className="section-label">Shareable opportunity brief</div><h2 id="discovery-delivery-title">{deliveryMode === "email" ? "Email findings" : "Download findings"}</h2></div>
              <button type="button" aria-label="Close findings delivery" onClick={() => setDeliveryMode(null)}>×</button>
            </header>
            <div className="discovery-delivery-audience">
              <strong>Brief audience</strong>
              <p>Choose who should receive the readout. The brief will lead with the most relevant findings for that audience.</p>
              <div className="discovery-department-tabs" role="tablist" aria-label="Choose brief audience">
                <button type="button" role="tab" aria-selected={department === "all"} onClick={() => setDepartment("all")}>All departments</button>
                {(["marketing", "pricing", "cvc"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={department === item} onClick={() => setDepartment(item)}>{LABELS[item]}</button>)}
              </div>
            </div>
            <div className="discovery-delivery-preview">
              <span>{briefScope === "all" ? "Cross-team" : LABELS[briefScope]} brief preview</span>
              <strong>{teamOpportunityBrief.recommendation}</strong>
              <p>{teamOpportunityBrief.why}</p>
            </div>
            {deliveryMode === "email" ? (
              <div className="discovery-delivery-email">
                <label><span>Send to</span><input type="email" value={emailRecipient} onChange={(event) => setEmailRecipient(event.target.value)} placeholder="you@company.com" autoComplete="email" /></label>
                <button type="button" onClick={() => void emailFindings()} disabled={Boolean(isExporting)}>{isExporting ? "Preparing…" : "Download brief & open email"}</button>
                <small>The Word brief downloads first; an addressed email draft then opens for review and attachment.</small>
              </div>
            ) : (
              <div className="discovery-delivery-downloads">
                <button type="button" disabled={Boolean(isExporting)} onClick={() => void downloadFindings(briefScope, "docx")}>{isExporting === `${briefScope}:docx` ? "Preparing Word brief…" : "Stakeholder brief (Word)"}</button>
                <button type="button" disabled={Boolean(isExporting)} onClick={() => void downloadFindings(briefScope, "csv")}>{isExporting === `${briefScope}:csv` ? "Preparing data…" : "Full findings data (CSV)"}</button>
              </div>
            )}
          </section>
        </div>
      ) : null}

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
          <p>{followUpTarget ? "The exact finding, market, question, and evidence sources stay attached when you continue." : "Choose “Open in Ask AI” on a finding to carry its exact context into a follow-up."}</p>
        </div>
        {followUpTarget ? (
          <div className="discovery-follow-up-context" aria-label="Finding context sent to Ask AI">
            <div><span>{LABELS[followUpTarget.department]} · {followUpTarget.marketName}</span><button type="button" onClick={() => { setFollowUpFinding(null); setFollowUpQuestion(""); }}>Clear</button></div>
            <strong>{findingPresentation(followUpTarget).analystRecommendation}</strong>
            <p><b>Question that opened this finding:</b> {followUpTarget.question}</p>
            <small>{followUpTarget.sourceIds.length} evidence source{followUpTarget.sourceIds.length === 1 ? "" : "s"} · Finding {followUpTarget.insightId}</small>
          </div>
        ) : null}
        <div className="discovery-follow-up-suggestions" aria-label="Recommended follow-up questions">
          {followUpTarget ? followUpSuggestions.map((suggestion) => <button key={suggestion} type="button" title={suggestion} onClick={() => setFollowUpQuestion(suggestion)}>{suggestion}</button>) : null}
        </div>
        <div className="discovery-follow-up-composer">
          <textarea ref={followUpRef} value={followUpQuestion} onChange={(event) => setFollowUpQuestion(event.target.value)} placeholder="Ask a follow-up, add another factor, or request a different comparison…" aria-label="Ask AI about these findings" rows={2} />
          <button className="primary-action" type="button" disabled={!followUpQuestion.trim() || !followUpFinding} onClick={continueInvestigation}>Continue investigation →</button>
        </div>
        <small>This opens a new analysis plan without losing the original finding context.</small>
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
