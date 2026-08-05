"use client";

import { useEffect, useRef, useState } from "react";
import {
  agentRunSchema,
  type AgentRun,
  type ReviewerDecision,
} from "@/lib/agent/contracts";
import { getEsriSite } from "@/lib/esri-demo";
import styles from "./candidate-review-agent.module.css";

type CandidateReviewAgentProps = {
  siteId: string;
  initialRun?: AgentRun | null;
  autoStart?: boolean;
  onOpenReadiness?: (siteId: string) => void;
  onOpenBrief: (siteId: string) => void;
  onOpenMarket: (marketId: string) => void;
};

const STATUS_LABELS: Record<AgentRun["status"], string> = {
  planned: "Planned",
  collecting: "Collecting evidence",
  validating: "Validating evidence",
  waiting_for_review: "Waiting for analyst review",
  ready_for_evaluation: "Ready for deterministic evaluation",
  completed: "Completed",
  blocked: "Blocked",
  failed: "Failed safely",
};

function responseMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
    ? payload.message
    : fallback;
}

export function CandidateReviewAgent({
  siteId,
  initialRun = null,
  autoStart = true,
  onOpenReadiness,
  onOpenBrief,
  onOpenMarket,
}: CandidateReviewAgentProps) {
  const [run, setRun] = useState<AgentRun | null>(initialRun);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const startedSiteRef = useRef<string | null>(initialRun ? siteId : null);

  async function startRun() {
    if (!siteId || isLoading) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/agent-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(payload, "Candidate review could not start."));
      setRun(agentRunSchema.parse(payload));
      startedSiteRef.current = siteId;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Candidate review could not start.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (autoStart && siteId && startedSiteRef.current !== siteId) {
      startedSiteRef.current = siteId;
      void startRun();
    }
    // startRun intentionally uses the current site only once per workspace launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, siteId]);

  async function submitDecision(
    decisionId: string,
    decision: ReviewerDecision,
  ) {
    if (!run || isLoading) return;
    const selectedTradeAreaId = selectedVariants[decisionId] ?? null;
    if (decision === "confirm" && !selectedTradeAreaId) {
      setError("Select one supplied trade-area variant before confirming.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/agent-runs/${encodeURIComponent(run.runId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decisionId,
          decision,
          selectedTradeAreaId: decision === "confirm" ? selectedTradeAreaId : null,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(payload, "Candidate review could not continue."));
      setRun(agentRunSchema.parse(payload));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Candidate review could not continue.");
    } finally {
      setIsLoading(false);
    }
  }

  const completedCount = run?.plannedSteps.filter((step) => step.status === "completed").length ?? 0;
  const progress = run ? Math.round((completedCount / run.plannedSteps.length) * 100) : 0;
  const marketId = getEsriSite(siteId)?.cbsa_id ?? null;

  return (
    <section className={styles.workspace} aria-labelledby="candidate-review-agent-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Bounded analyst workflow</p>
          <h1 id="candidate-review-agent-title">Candidate Review Agent</h1>
          <p>
            Prepares approved evidence for human review. It does not select a site,
            recommend a lease, or change scoring logic.
          </p>
        </div>
        <div className={styles.statusCard}>
          <span>Run status</span>
          <strong>{run ? STATUS_LABELS[run.status] : isLoading ? "Starting" : "Not started"}</strong>
          <small>{run?.persistence === "process_local_prototype" ? "Process-local prototype, not durable" : "Session-only prototype"}</small>
        </div>
      </header>

      <div className={styles.boundaries} role="note">
        <strong>Human decision boundary</strong>
        <span>Data readiness is not site quality.</span>
        <span>The review packet is a draft.</span>
        <span>Qualitative evidence is not scored.</span>
        <span>The agent does not make the final site decision.</span>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          <strong>Run needs attention</strong>
          <span>{error}</span>
          {!run ? <button onClick={() => void startRun()}>Retry review run</button> : null}
        </div>
      ) : null}

      {!run ? (
        <div className={styles.starting} aria-live="polite">
          <span className={styles.pulse} aria-hidden="true">✦</span>
          <div>
            <strong>{isLoading ? "Starting a bounded review run" : "Prepare this candidate for review"}</strong>
            <p>The agent will use only approved application tools and evidence already available in this prototype.</p>
          </div>
          {!autoStart && !isLoading ? <button onClick={() => void startRun()}>Prepare candidate review</button> : null}
        </div>
      ) : (
        <>
          <div className={styles.runSummary}>
            <div>
              <span>Candidate</span>
              <strong>{run.siteLabel}</strong>
              <small>{run.siteId}</small>
            </div>
            <div>
              <span>Current step</span>
              <strong>{run.currentStep}</strong>
              <small>{run.stepCount} of {run.maxSteps} maximum tool steps</small>
            </div>
            <div>
              <span>Progress</span>
              <strong>{progress}%</strong>
              <small>{completedCount} of {run.plannedSteps.length} plan steps complete</small>
            </div>
            <div>
              <span>Evaluation</span>
              <strong>{run.evaluationStatus.replaceAll("_", " ")}</strong>
              <small>Deterministic policy result</small>
            </div>
          </div>

          <div className={styles.layout}>
            <div className={styles.primary}>
              <section className={styles.panel}>
                <header><div><p className={styles.eyebrow}>Visible plan</p><h2>Review checklist</h2></div><span>{progress}%</span></header>
                <ol className={styles.plan}>
                  {run.plannedSteps.map((step) => (
                    <li key={step.stepId} className={styles[step.status]}>
                      <span aria-hidden="true">{step.status === "completed" ? "✓" : step.status === "waiting" ? "!" : "•"}</span>
                      <div><strong>{step.label}</strong><small>{step.status.replaceAll("_", " ")}</small></div>
                    </li>
                  ))}
                </ol>
              </section>

              {run.requestedHumanDecisions.filter((item) => item.status === "pending").map((decision) => (
                <section className={styles.approval} key={decision.decisionId} aria-labelledby={`${decision.decisionId}-title`}>
                  <header><div><p className={styles.eyebrow}>Analyst confirmation required</p><h2 id={`${decision.decisionId}-title`}>{decision.question}</h2></div><span>Paused</span></header>
                  <p>{decision.reason}</p>
                  <fieldset>
                    <legend>Supplied evidence</legend>
                    {decision.evidence.map((item) => (
                      <label key={item.value}>
                        <input
                          type="radio"
                          name={decision.decisionId}
                          value={item.value}
                          checked={selectedVariants[decision.decisionId] === item.value}
                          onChange={() => setSelectedVariants((current) => ({ ...current, [decision.decisionId]: item.value }))}
                        />
                        <span><strong>{item.label}</strong><small>{item.value} · {item.sourceId}</small></span>
                      </label>
                    ))}
                  </fieldset>
                  <div className={styles.consequences}>
                    <strong>What this action means</strong>
                    <ul>{decision.consequences.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                  <div className={styles.approvalActions}>
                    <button disabled={isLoading || !selectedVariants[decision.decisionId]} onClick={() => void submitDecision(decision.decisionId, "confirm")}>Confirm selected</button>
                    <button disabled={isLoading} onClick={() => void submitDecision(decision.decisionId, "reject")}>Reject</button>
                    <button disabled={isLoading} onClick={() => void submitDecision(decision.decisionId, "leave_unresolved")}>Leave unresolved</button>
                  </div>
                </section>
              ))}

              <section className={styles.panel}>
                <header><div><p className={styles.eyebrow}>Tool activity</p><h2>Activity timeline</h2></div><span>{run.toolInvocations.length}</span></header>
                <ol className={styles.timeline}>
                  {run.toolInvocations.map((item) => (
                    <li key={item.invocationId}>
                      <span aria-hidden="true">{item.status === "completed" ? "✓" : "•"}</span>
                      <div><strong>{item.toolName.replaceAll("_", " ")}</strong><p>{item.summary}</p><small>{item.sourceIds.length ? item.sourceIds.join(" · ") : "Policy and model action only"}</small></div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <aside className={styles.secondary}>
              <section className={styles.panel}>
                <header><div><p className={styles.eyebrow}>Evidence added</p><h2>Evidence receipts</h2></div><span>{run.evidenceReceipts.length}</span></header>
                <div className={styles.receipts}>
                  {run.evidenceReceipts.map((item) => (
                    <article key={item.receiptId}>
                      <strong>{item.label}</strong>
                      <span>{item.evidenceStatuses.join(" · ")}</span>
                      <small>{item.sourceIds.join(" · ")}</small>
                      <small>{item.allowedUse} · scoring {item.scoringEligibility}</small>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.panel}>
                <header><div><p className={styles.eyebrow}>Before evaluation</p><h2>Remaining blockers</h2></div><span>{run.unresolvedBlockers.length}</span></header>
                {run.unresolvedBlockers.length ? (
                  <div className={styles.blockers}>{run.unresolvedBlockers.map((item) => (
                    <article key={item.blockerId}><strong>{item.label}</strong><p>{item.detail}</p><small>{item.sourceIds.join(" · ") || "Application policy"}</small><span>{item.resolution}</span></article>
                  ))}</div>
                ) : <p className={styles.empty}>No unresolved blockers are recorded.</p>}
              </section>

              <section className={styles.packet}>
                <p className={styles.eyebrow}>Final review-packet status</p>
                {run.artifact ? (
                  <><h2>{run.artifact.title}</h2><strong>{run.artifact.status.replaceAll("_", " ")}</strong><p>{run.artifact.summary}</p><small>Draft for human review · {run.artifact.sourceIds.join(" · ")}</small></>
                ) : <><h2>Draft packet not assembled yet</h2><p>The packet is created only after validation, any required analyst response, and prerequisite checks.</p></>}
              </section>
            </aside>
          </div>

          <div className={styles.links}>
            {onOpenReadiness ? (
              <button onClick={() => onOpenReadiness(run.siteId)}>
                Open readiness
              </button>
            ) : null}
            <button onClick={() => onOpenBrief(run.siteId)}>Open evidence brief</button>
            <button disabled={!marketId} onClick={() => marketId && onOpenMarket(marketId)}>Open market context</button>
          </div>
        </>
      )}
    </section>
  );
}
