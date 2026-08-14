"use client";

import { useEffect, useMemo, useState } from "react";
import { AdaptiveEvaluationWorkspace } from "@/components/decision-workflow/AdaptiveEvaluationWorkspace";
import { DecisionGraphAnimation } from "@/components/decision-workflow/DecisionGraphAnimation";
import { GeographicFocusMap } from "@/components/decision-workflow/GeographicFocusMap";
import { SisterGeographiesSection } from "@/components/decision-workflow/SisterGeographiesSection";
import { SnapshotEvidenceStatus } from "@/components/decision-workflow/SnapshotEvidenceStatus";
import { publicMarkets } from "@/lib/data/public-market-ui";
import {
  assembleReviewableActionPacket,
  buildSisterFollowUpQuestion,
  deterministicFindingsAndProposalSummary,
  downloadReviewableActionPacket,
  evaluationPlanErrorSchema,
  evaluationPlanResponseSchema,
  focusPlaceLabelsForRewrite,
  packetFindingsSummarySchema,
  packetSummaryFromPlan,
  planEvaluation,
  proposedActionFromPlan,
  resolveGeographicFocus,
  suggestSisterGeographiesFromPlan,
  executeEvaluationPlan,
  type EvaluationPlan,
  type EvaluationExecutionResult,
  type PacketFindingsSummary,
  type SisterGeographySuggestion,
} from "@/lib/planning";

type Phase = "question" | "interpreting" | "confirming" | "running" | "packet" | "saved" | "error";

type SavedPacket = {
  id: string;
  question: string;
  title: string;
  actionId: string;
  savedAt: string;
  summary?: string;
};

function nowLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function statusForStep(index: number, activeStep: number) {
  if (activeStep > index) return "complete";
  if (activeStep === index) return "active";
  return "pending";
}

function proposalMethodLabel(method: EvaluationPlan["proposalMethod"]) {
  return method === "ai_proposed" ? "AI-proposed intent" : "Deterministic fallback";
}

function workspaceHeading(plan: EvaluationPlan) {
  if (plan.resultWorkspaceType === "clarification") return "Clarification required";
  if (plan.resultWorkspaceType === "evidence_readiness") return "Evidence readiness review";
  if (plan.resultWorkspaceType === "clinic_evaluation_surface") return "Bounded clinic evaluation";
  if (plan.resultWorkspaceType === "adaptive_market_workspace") return "Decision review";
  return "Decision review";
}

function geographyModeLabel(plan: EvaluationPlan) {
  return plan.geographyResolution.mode.replaceAll("_", " ");
}

export function DecisionWorkflowApp() {
  const [activeView, setActiveView] = useState<"workflow" | "saved">("workflow");
  const [phase, setPhase] = useState<Phase>("question");
  const [question, setQuestion] = useState("");
  const [activeStep, setActiveStep] = useState(-1);
  const [plan, setPlan] = useState<EvaluationPlan | null>(null);
  const [execution, setExecution] = useState<EvaluationExecutionResult | null>(null);
  const [selectedActionId, setSelectedActionId] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [savedPackets, setSavedPackets] = useState<SavedPacket[]>([]);
  const [sisterFollowUpNotice, setSisterFollowUpNotice] = useState<string | null>(null);
  const [packetSummary, setPacketSummary] = useState<PacketFindingsSummary | null>(null);
  const [packetSummaryState, setPacketSummaryState] = useState<"idle" | "loading" | "ready">("idle");
  const [actionDetailsOpen, setActionDetailsOpen] = useState(false);
  const graphSteps = useMemo(() => plan?.steps ?? [], [plan]);
  const actionOptions = useMemo(() => plan?.actions ?? [], [plan]);

  const selectedAction = useMemo(
    () => actionOptions.find((action) => action.id === selectedActionId) ?? (plan ? proposedActionFromPlan(plan) : undefined),
    [actionOptions, plan, selectedActionId],
  );

  const geographicFocus = useMemo(
    () => (plan ? resolveGeographicFocus(plan, publicMarkets) : null),
    [plan],
  );

  const sisterGeographies = useMemo(
    () => (plan && geographicFocus?.state === "focused"
      ? suggestSisterGeographiesFromPlan(plan, undefined, geographicFocus.cbsaCodes)
      : []),
    [plan, geographicFocus],
  );

  const reviewablePacket = useMemo(
    () => (plan && selectedAction ? assembleReviewableActionPacket(plan, selectedAction, new Date().toISOString(), execution) : null),
    [plan, selectedAction, execution],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("market-intelligence-action-packets");
      if (!stored) return;
      try {
        setSavedPackets(JSON.parse(stored) as SavedPacket[]);
      } catch {
        window.localStorage.removeItem("market-intelligence-action-packets");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "running" || !graphSteps.length) return;
    const timer = window.setInterval(() => {
      setActiveStep((current) => {
        if (current >= graphSteps.length - 1) {
          window.clearInterval(timer);
          window.setTimeout(() => setPhase("packet"), 450);
          return current;
        }
        return current + 1;
      });
    }, 850);
    return () => window.clearInterval(timer);
  }, [graphSteps.length, phase]);

  useEffect(() => {
    if ((phase !== "packet" && phase !== "saved") || !plan || !selectedAction) {
      setPacketSummary(null);
      setPacketSummaryState("idle");
      return;
    }
    let cancelled = false;
    setPacketSummaryState("loading");
    setPacketSummary(deterministicFindingsAndProposalSummary(plan, selectedAction));
    void (async () => {
      try {
        const response = await fetch("/api/evaluation-plans/summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan, actionId: selectedAction.id }),
        });
        const payload: unknown = await response.json();
        const parsed = packetFindingsSummarySchema.safeParse(
          payload && typeof payload === "object" && "summary" in payload
            ? (payload as { summary: unknown }).summary
            : payload,
        );
        if (cancelled) return;
        if (parsed.success) {
          setPacketSummary(parsed.data);
        } else {
          setPacketSummary(deterministicFindingsAndProposalSummary(plan, selectedAction));
        }
        setPacketSummaryState("ready");
      } catch {
        if (cancelled) return;
        setPacketSummary(deterministicFindingsAndProposalSummary(plan, selectedAction));
        setPacketSummaryState("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, plan, selectedAction]);

  async function startWorkflow(nextQuestion = question) {
    if (!nextQuestion.trim()) return;
    const normalizedQuestion = nextQuestion.trim();
    setQuestion(normalizedQuestion);
    setPlan(null);
    setExecution(null);
    setSelectedActionId("");
    setRequestError(null);
    setActiveStep(-1);
    setSisterFollowUpNotice(null);
    setPacketSummary(null);
    setPacketSummaryState("idle");
    setActionDetailsOpen(false);
    setPhase("interpreting");
    try {
      const response = await fetch("/api/evaluation-plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: normalizedQuestion }),
      });
      const payload: unknown = await response.json();
      const parsed = evaluationPlanResponseSchema.safeParse(payload);
      if (!response.ok || !parsed.success) {
        const error = evaluationPlanErrorSchema.safeParse(payload);
        setRequestError(error.success ? error.data.message : "The evaluation plan request failed. Retry or edit the question.");
        setPhase("error");
        return;
      }
      setPlan(parsed.data.plan);
      setSelectedActionId(proposedActionFromPlan(parsed.data.plan).id);
      setActiveStep(-1);
      setPhase("confirming");
    } catch {
      setRequestError("The evaluation plan service is unavailable. Retry or edit the question.");
      setPhase("error");
    }
  }

  function restart() {
    setQuestion("");
    setPlan(null);
    setExecution(null);
    setActiveStep(-1);
    setSelectedActionId("");
    setRequestError(null);
    setSisterFollowUpNotice(null);
    setPacketSummary(null);
    setPacketSummaryState("idle");
    setActionDetailsOpen(false);
    setPhase("question");
  }

  function confirmInterpretation() {
    if (!plan) return;
    setExecution(executeEvaluationPlan(plan, publicMarkets));
    setActiveStep(0);
    setPhase("running");
  }

  function savePacket() {
    if (!plan || !selectedAction) return;
    const packet: SavedPacket = {
      id: `packet-${Date.now().toString(36)}`,
      question: plan.originalQuestion,
      title: selectedAction.title,
      actionId: selectedAction.id,
      savedAt: nowLabel(),
      summary: packetSummaryFromPlan(plan),
    };
    const next = [packet, ...savedPackets.filter((item) => item.question !== packet.question)].slice(0, 10);
    setSavedPackets(next);
    window.localStorage.setItem("market-intelligence-action-packets", JSON.stringify(next));
    setPhase("saved");
  }

  function openSavedPacket(packet: SavedPacket) {
    const restoredPlan = planEvaluation(packet.question);
    setQuestion(packet.question);
    setPlan(restoredPlan);
    setExecution(executeEvaluationPlan(restoredPlan, publicMarkets));
    setSelectedActionId(restoredPlan.actions.some((action) => action.id === packet.actionId) ? packet.actionId : proposedActionFromPlan(restoredPlan).id);
    setRequestError(null);
    setSisterFollowUpNotice(null);
    setActiveView("workflow");
    setPhase("saved");
  }

  function askAboutSisterGeography(suggestion: SisterGeographySuggestion) {
    if (!plan) return;
    const currentQuestion = plan.originalQuestion;
    const currentPhase = phase;
    const focusLabels = [
      ...focusPlaceLabelsForRewrite(plan),
      ...(geographicFocus?.label ? [geographicFocus.label] : []),
    ];
    const followUp = buildSisterFollowUpQuestion(
      currentQuestion,
      focusLabels,
      suggestion,
    );
    const retained = currentPhase === "saved"
      || savedPackets.some((packet) => packet.question === currentQuestion);
    // Leave saved packets untouched. Do not auto-save or overwrite the current packet.
    setPlan(null);
    setExecution(null);
    setSelectedActionId("");
    setActiveStep(-1);
    setRequestError(null);
    setPacketSummary(null);
    setPacketSummaryState("idle");
    setQuestion(followUp);
    setSisterFollowUpNotice(
      retained
        ? `Create a new action packet for ${suggestion.cbsaName}. The previous packet remains in Saved action packets and was not changed.`
        : `Create a new action packet for ${suggestion.cbsaName}. The previous packet was not saved or overwritten; save packets explicitly when you want to keep them.`,
    );
    setActiveView("workflow");
    setPhase("question");
  }

  const showPacket = phase === "packet" || phase === "saved";
  const isQuestionPage = activeView === "workflow" && phase === "question";
  const isConfirmationPage = activeView === "workflow" && phase === "confirming";
  const isAnimationPage = activeView === "workflow" && (phase === "interpreting" || phase === "running");
  const isResultPage = activeView === "workflow" && showPacket;
  const isErrorPage = activeView === "workflow" && phase === "error";
  const pagePhase = activeView === "saved"
    ? "saved-list"
    : isQuestionPage
      ? "question"
    : isAnimationPage
      ? "animation"
      : isConfirmationPage
        ? "confirmation"
        : isResultPage
          ? "result"
          : isErrorPage
            ? "error"
            : "workspace";
  const workspaceLayoutClass = isQuestionPage
    ? "question-layout"
    : isConfirmationPage
      ? "workspace-layout confirmation-layout"
    : isAnimationPage
      ? "animation-page-layout"
      : "workspace-layout packet-workspace-layout result-page-layout";

  return (
    <main
      className={`decision-app ${isQuestionPage ? "question-page" : "workspace-mode"} page-phase-${pagePhase}`}
      data-page-phase={pagePhase}
    >
      <div className={`decision-layout ${workspaceLayoutClass}`} id="start">
        <aside className="decision-rail" aria-label="Workflow progress">
          <div className="rail-kicker">Decision workflow</div>
          <h2>From question to action</h2>
          <p>Move from a business question to a reviewable next step.</p>
          <ol className="rail-steps">
            <li className={phase === "question" ? "current" : "complete"}><span>1</span><div><strong>Ask</strong><small>State the decision</small></div></li>
            <li className={phase === "interpreting" || phase === "confirming" || phase === "running" ? "current" : showPacket || phase === "error" ? "complete" : ""}><span>2</span><div><strong>Trace</strong><small>Confirm the interpretation</small></div></li>
            <li className={showPacket && phase !== "saved" ? "current" : phase === "saved" ? "complete" : ""}><span>3</span><div><strong>Review</strong><small>Read the action packet</small></div></li>
            <li className={phase === "saved" ? "current complete" : ""}><span>4</span><div><strong>Save</strong><small>Keep the reviewable draft</small></div></li>
          </ol>
          <div className="rail-note"><strong>Decision boundary</strong><p>The workspace prepares evidence and next actions. An accountable owner makes the business decision.</p></div>
        </aside>

        {activeView === "saved" ? (
          <section className="decision-content">
            <SavedPacketsView packets={savedPackets} onOpen={openSavedPacket} onStart={() => { setActiveView("workflow"); setPhase("question"); setSisterFollowUpNotice(null); }} />
          </section>
        ) : null}

        {isQuestionPage ? (
          <section className="decision-content">
            {sisterFollowUpNotice ? (
              <div className="sister-follow-up-notice" role="status">
                <strong>New geography follow-up</strong>
                <p>{sisterFollowUpNotice}</p>
              </div>
            ) : null}
            <AdaptiveEvaluationWorkspace
              question={question}
              savedPackets={savedPackets}
              onQuestionChange={(value) => {
                setQuestion(value);
                if (sisterFollowUpNotice) setSisterFollowUpNotice(null);
              }}
              onSubmit={() => void startWorkflow()}
              onOpenSaved={() => setActiveView("saved")}
            />
          </section>
        ) : null}

        {isConfirmationPage && plan ? (
          <section className="decision-content confirmation-page">
            <section className="packet-view plan-confirmation" aria-labelledby="plan-confirmation-title" data-plan-confirmation="true">
              <div className="eyebrow">Review interpretation</div>
              <h1 id="plan-confirmation-title">Confirm the evaluation before it runs</h1>
              <p className="lead">Check the complete interpretation, evidence boundary, and permitted output. This is the final in-product approval step for the demo.</p>
              <SnapshotEvidenceStatus />
              <div className="question-ribbon packet-question"><span>Your question</span><strong>{plan.originalQuestion}</strong></div>
              <div className="confirmation-grid">
                <div><span>Decision type</span><strong>{plan.intent.topic.replaceAll("_", " ")}</strong></div>
                <div><span>Geography</span><strong>{plan.geographyResolution.message}</strong></div>
                <div><span>Time window</span><strong>2020–2024 ACS 5-year estimate</strong></div>
                <div><span>Evidence categories</span><strong>{plan.capabilityId.replaceAll("_", " ")}</strong></div>
                <div><span>Requested measure</span><strong>{plan.intent.requestedMeasure.replaceAll("_", " ")}</strong></div>
                <div><span>Scoring approach</span><strong>{plan.capabilityId === "census_market_context" ? "Deterministic cohort percentile, no opportunity score" : "No calculation until evidence gates clear"}</strong></div>
                <div><span>Expected output</span><strong>{plan.actions[0]?.outputId.replaceAll("_", " ") ?? "Review packet"}</strong></div>
                <div><span>Permitted next action</span><strong>{plan.actions[0]?.title ?? "Research needed"}</strong></div>
              </div>
              <div className="confirmation-boundary"><strong>Evidence boundary</strong><p>{plan.evidenceBoundary}</p></div>
              {(plan.missingEvidence.length || plan.missingApprovals.length) ? (
                <div className="confirmation-gates" role="status">
                  {plan.missingEvidence.length ? <p><strong>Missing evidence:</strong> {plan.missingEvidence.join("; ")}</p> : null}
                  {plan.missingApprovals.length ? <p><strong>Missing approvals:</strong> {plan.missingApprovals.join("; ")}</p> : null}
                </div>
              ) : null}
              <div className="packet-heading-actions">
                <button className="secondary-action" type="button" onClick={restart}>Edit question</button>
                <button className="primary-action" type="button" onClick={confirmInterpretation}>Confirm interpretation and run <span aria-hidden="true">→</span></button>
              </div>
            </section>
          </section>
        ) : null}

        {isAnimationPage ? (
          <section
            className="animation-page"
            aria-label="Decision graph animation"
            data-plan-request-state={phase === "interpreting" ? "pending" : "ready"}
            data-proposal-method={plan?.proposalMethod}
          >
            <div className="workspace-decision-graph" aria-label="Decision graph canvas">
              <DecisionGraphAnimation
                activeStep={activeStep}
                phase="running"
                question={question || plan?.originalQuestion || ""}
                selectedActionId={selectedActionId}
                steps={graphSteps}
                actions={actionOptions.map((action) => ({ id: action.id, title: action.title }))}
              />
            </div>
            <aside className="animation-page-status" aria-live="polite">
              {phase === "interpreting" ? (
                <>
                  <div className="eyebrow">Interpreting question</div>
                  <h1 id="interpreting-title">Building the decision graph</h1>
                  <p>Waiting for the validated evaluation plan. No result page is shown until the graph finishes.</p>
                  <div className="question-ribbon"><span>Your question</span><strong>{question}</strong></div>
                  <div className="graph-footer"><span className="progress-pulse" aria-hidden="true" />Calling /api/evaluation-plans</div>
                </>
              ) : null}
              {phase === "running" && plan ? (
                <>
                  <div className="eyebrow">Decision graph in progress</div>
                  <h1 id="graph-title">Tracing the validated plan</h1>
                  <p className="plan-method-ribbon" data-proposal-method={plan.proposalMethod}>
                    {proposalMethodLabel(plan.proposalMethod)} · {plan.capabilityId.replaceAll("_", " ")} · {plan.status.replaceAll("_", " ")}
                  </p>
                  <ol className="animation-step-list">
                    {graphSteps.map((step, index) => (
                      <li className={statusForStep(index, activeStep)} key={step.id}>
                        <strong>{step.label}</strong>
                        <span>{activeStep > index ? step.result : activeStep === index ? "Working" : "Pending"}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="graph-footer">
                    <span className="progress-pulse" aria-hidden="true" />
                    {graphSteps[activeStep]?.label ?? "Preparing the decision graph"}
                  </div>
                </>
              ) : null}
            </aside>
          </section>
        ) : null}

        {isErrorPage ? (
          <section className="decision-content">
            <section className="graph-view plan-error-view" aria-labelledby="plan-error-title" role="alert" data-plan-request-state="error">
              <div className="eyebrow">Plan request failed</div>
              <h1 id="plan-error-title">The evaluation plan could not be loaded</h1>
              <p className="lead">{requestError}</p>
              <div className="question-ribbon"><span>Your question</span><strong>{question}</strong></div>
              <div className="packet-heading-actions">
                <button className="primary-action" onClick={() => void startWorkflow(question)}>Retry</button>
                <button className="secondary-action" onClick={restart}>Edit question</button>
              </div>
            </section>
          </section>
        ) : null}

        {isResultPage && plan && selectedAction ? (
          <section className="decision-content result-page">
            <section
              className="packet-view decision-review"
              aria-labelledby="packet-title"
              data-result-workspace={plan.resultWorkspaceType}
              data-action-count={plan.actions.length}
            >
              <div className="packet-heading">
                <div>
                  <div className="eyebrow">{phase === "saved" ? "Saved action packet" : "Decision review"}</div>
                  <h1 id="packet-title">{workspaceHeading(plan)}</h1>
                  <p className="lead">{packetSummaryFromPlan(plan)}</p>
                </div>
                <div className="packet-heading-actions">
                  <span className="draft-pill">{phase === "saved" ? "Saved draft" : "Draft for review"}</span>
                  <button className="secondary-action" onClick={restart}>New question</button>
                </div>
              </div>

              <div className="question-ribbon packet-question">
                <span>Your question</span>
                <strong>{plan.originalQuestion}</strong>
              </div>
              <SnapshotEvidenceStatus />

              <div className="decision-review-primary">
                {geographicFocus ? (
                  <GeographicFocusMap
                    focus={geographicFocus}
                    modeLabel={geographyModeLabel(plan)}
                  />
                ) : null}

                <div className="decision-review-side">
                  <div className="action-packet-card">
                    <div className="section-label">Draft action packet</div>
                    <p className="action-packet-governance-note">
                      Draft for accountable review. This packet does not approve a market, site, lease, or spend decision.
                    </p>
                    <h2>{selectedAction.title}</h2>
                    <p>{selectedAction.summary}</p>

                    <section
                      className="packet-findings"
                      aria-labelledby="findings-summary-title"
                      data-summary-state={packetSummaryState}
                    >
                      <div className="section-label" id="findings-summary-title">Findings and proposed action</div>
                      {packetSummary ? (
                        <>
                          <p className="packet-ai-summary-notice">{packetSummary.draftOnlyNotice}</p>
                          <ol className="packet-ai-summary-list">
                            <li><strong>What the evidence indicates</strong><p>{packetSummary.evidenceIndicates}</p></li>
                            <li><strong>Why the proposed action is relevant</strong><p>{packetSummary.whyActionRelevant}</p></li>
                            <li><strong>What the owner should do next</strong><p>{packetSummary.ownerNextStep}</p></li>
                            <li><strong>What remains unknown</strong><p>{packetSummary.remainsUnknown}</p></li>
                          </ol>
                          <small className="packet-findings-meta">
                            Summary origin: {packetSummary.origin.replaceAll("_", " ")}
                            {packetSummary.modelVersion ? ` · model ${packetSummary.modelVersion}` : ""}
                            {" · "}prompt {packetSummary.promptVersion}
                          </small>
                        </>
                      ) : (
                        <p className="packet-findings-loading">Preparing the draft findings summary from the validated packet.</p>
                      )}
                    </section>

                    <details
                      className="packet-action-details"
                      open={actionDetailsOpen}
                      onToggle={(event) => setActionDetailsOpen(event.currentTarget.open)}
                    >
                      <summary>Action details</summary>
                      <dl>
                        <div><dt>Owner</dt><dd>{selectedAction.owner}</dd></div>
                        <div><dt>Timing</dt><dd>{selectedAction.timing}</dd></div>
                        <div><dt>Confidence</dt><dd><span className={`confidence ${selectedAction.confidence.toLowerCase()}`}>{selectedAction.confidence}</span></dd></div>
                        <div><dt>Next step</dt><dd>{selectedAction.nextStep}</dd></div>
                      </dl>
                      <div className="packet-evidence">
                        <strong>Evidence considered</strong>
                        {selectedAction.evidence.map((item) => (
                          <span key={item}><i aria-hidden="true">✓</i>{item}</span>
                        ))}
                      </div>
                      <div className="packet-evidence tradeoffs">
                        <strong>Tradeoffs to review</strong>
                        {selectedAction.tradeoffs.map((item) => (
                          <span key={item}><i aria-hidden="true">!</i>{item}</span>
                        ))}
                      </div>
                      {(plan.missingEvidence.length > 0 || plan.missingApprovals.length > 0) ? (
                        <div className="packet-missing-gates">
                          {plan.missingEvidence.length ? (
                            <small>Missing evidence: {plan.missingEvidence.join("; ")}</small>
                          ) : null}
                          {plan.missingApprovals.length ? (
                            <small>Missing approvals: {plan.missingApprovals.join("; ")}</small>
                          ) : null}
                        </div>
                      ) : null}
                    </details>

                    <div className="packet-card-footer">
                      <div className="packet-card-actions">
                        <button
                          className="secondary-action"
                          type="button"
                          onClick={() => {
                            if (reviewablePacket) downloadReviewableActionPacket(reviewablePacket);
                          }}
                        >
                          Download action packet
                        </button>
                        <button className="primary-action" onClick={savePacket}>
                          {phase === "saved" ? "Saved" : "Save action packet"} <span aria-hidden="true">✓</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {execution ? (
                <section className="execution-result" aria-labelledby="execution-result-title" data-execution-status={execution.status}>
                  <div className="section-label" id="execution-result-title">Executed evidence result</div>
                  <div className="execution-result-meta">
                    <span>Status: {execution.status.replaceAll("_", " ")}</span>
                    <span>Snapshot: {execution.snapshotVersion}</span>
                    <span>Calculation: {execution.calculationVersion}</span>
                    <span>Confidence: {execution.confidence}</span>
                  </div>
                  <div className="execution-result-columns">
                    <div><strong>Supported findings</strong>{execution.supportedFindings.map((item) => <p key={item}>{item}</p>)}</div>
                    <div><strong>Contrary evidence</strong>{execution.contraryEvidence.map((item) => <p key={item}>{item}</p>)}</div>
                    <div><strong>Missing evidence and warnings</strong>{[...execution.missingEvidence, ...execution.warnings].map((item) => <p key={item}>{item}</p>)}</div>
                  </div>
                  {execution.comparisons.length ? (
                    <div className="execution-comparison-list" aria-label="Deterministic market comparison">
                      {execution.comparisons.slice(0, 10).map((comparison) => <div key={comparison.cbsaCode}><strong>{comparison.cbsaName}</strong><span>{comparison.rawValue.toLocaleString()} {comparison.unit} · percentile {comparison.percentile.toFixed(1)}</span></div>)}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <SisterGeographiesSection
                suggestions={sisterGeographies}
                onAskAbout={askAboutSisterGeography}
              />

              <div className="packet-disclosure">
                <span>Decision record</span>
                <p>
                  This packet contains findings, evidence boundaries, and proposed next actions. It is not a final real-estate or business decision.
                  Saved packets remain in this browser for this workspace. Downloading the packet does not approve or send it externally.
                </p>
              </div>
            </section>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function SavedPacketsView({
  packets,
  onOpen,
  onStart,
}: {
  packets: SavedPacket[];
  onOpen: (packet: SavedPacket) => void;
  onStart: () => void;
}) {
  return (
    <section className="saved-packets-view" aria-labelledby="saved-packets-title">
      <div className="eyebrow">Saved workspace</div>
      <div className="saved-packets-heading">
        <div>
          <h1 id="saved-packets-title">Saved action packets</h1>
          <p className="lead">Open any packet to review its findings or ask a packet-scoped question.</p>
        </div>
        <button className="primary-action" onClick={onStart}>Start a new question <span aria-hidden="true">→</span></button>
      </div>
      {packets.length ? (
        <div className="saved-packets-list">
          {packets.map((packet) => (
            <button className="saved-packet-row" key={packet.id} onClick={() => onOpen(packet)}>
              <span className="saved-packet-icon" aria-hidden="true">↗</span>
              <span className="saved-packet-copy"><strong>{packet.title}</strong><small>{packet.question}</small></span>
              <span className="saved-packet-meta"><small>{packet.savedAt}</small><b>Open review</b></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="saved-packets-empty">
          <strong>No saved packets yet</strong>
          <p>Run a question and save the packet when it is ready for review.</p>
          <button className="secondary-action" onClick={onStart}>Ask a question</button>
        </div>
      )}
    </section>
  );
}
