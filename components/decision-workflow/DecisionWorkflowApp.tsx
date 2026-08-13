"use client";

import { useEffect, useMemo, useState } from "react";
import { AdaptiveEvaluationWorkspace } from "@/components/decision-workflow/AdaptiveEvaluationWorkspace";
import { AnalysisBriefPanel } from "@/components/decision-workflow/AnalysisBriefPanel";
import { DecisionGraphAnimation } from "@/components/decision-workflow/DecisionGraphAnimation";
import { GeographicFocusMap } from "@/components/decision-workflow/GeographicFocusMap";
import { InsightActionPlanPanel } from "@/components/decision-workflow/InsightActionPlanPanel";
import { MarketInvestigationPanel } from "@/components/decision-workflow/MarketInvestigationPanel";
import { SisterGeographiesSection } from "@/components/decision-workflow/SisterGeographiesSection";
import { publicMarkets } from "@/lib/data/public-market-ui";
import type { CbsaAcsMetricKey } from "@/lib/data/cbsa-acs";
import type { PerspectiveId } from "@/lib/perspectives";
import { buildAnalysisBrief, type AnalysisBrief } from "@/lib/planning/analysis-brief";
import {
  buildEvidencePlan,
  generateEvaluationDefinitionDraft,
  type EvidencePlan,
  type EvaluationDefinitionDraft,
} from "@/lib/planning/evidence-plan";
import {
  answerInvestigationFollowUp,
  runConfirmedMarketInvestigation,
  runMarketInvestigation,
  type InvestigationFollowUp,
  type InvestigationLead,
  type MarketInvestigation,
} from "@/lib/planning/market-investigation";
import {
  assembleReviewableActionPacket,
  buildInsightActionPlan,
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
  type EvaluationPlan,
  type GeographicFocus,
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
  investigation?: MarketInvestigation;
  perspectiveId?: PerspectiveId;
  followUps?: InvestigationFollowUp[];
  analysisBrief?: AnalysisBrief;
  evidencePlan?: EvidencePlan;
  evaluationDefinition?: EvaluationDefinitionDraft;
  selectedLeadId?: string | null;
  selectedContextMetric?: CbsaAcsMetricKey;
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

function workspaceHeading(plan: EvaluationPlan, investigation?: MarketInvestigation | null) {
  if (investigation?.leads.length) return "Market investigation review";
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
  const [selectedActionId, setSelectedActionId] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [savedPackets, setSavedPackets] = useState<SavedPacket[]>([]);
  const [sisterFollowUpNotice, setSisterFollowUpNotice] = useState<string | null>(null);
  const [packetSummary, setPacketSummary] = useState<PacketFindingsSummary | null>(null);
  const [packetSummaryState, setPacketSummaryState] = useState<"idle" | "loading" | "ready">("idle");
  const [actionDetailsOpen, setActionDetailsOpen] = useState(false);
  const [investigation, setInvestigation] = useState<MarketInvestigation | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [perspectiveId, setPerspectiveId] = useState<PerspectiveId>("cvc");
  const [investigationFollowUps, setInvestigationFollowUps] = useState<InvestigationFollowUp[]>([]);
  const [analysisBrief, setAnalysisBrief] = useState<AnalysisBrief | null>(null);
  const [evidencePlan, setEvidencePlan] = useState<EvidencePlan | null>(null);
  const [evaluationDefinition, setEvaluationDefinition] = useState<EvaluationDefinitionDraft | null>(null);
  const [selectedContextMetric, setSelectedContextMetric] = useState<CbsaAcsMetricKey>("household_count");
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

  const selectedLead = useMemo(
    () => investigation?.leads.find((lead) => lead.id === selectedLeadId) ?? investigation?.leads[0] ?? null,
    [investigation, selectedLeadId],
  );

  const displayedGeographicFocus = useMemo<GeographicFocus | null>(() => {
    if (!selectedLead) return geographicFocus;
    const names = selectedLead.marketIds.map((code) => publicMarkets.find((market) => market.cbsa_code === code)?.cbsa_name ?? code);
    return {
      state: "focused",
      source: "evaluation_result",
      cbsaCodes: selectedLead.marketIds.slice(0, 5),
      label: names.join(" compared with "),
      evidenceStatus: "Derived",
      message: `Map focus follows the selected analyst lead: ${selectedLead.title}.`,
    };
  }, [geographicFocus, selectedLead]);

  const sisterGeographies = useMemo(
    () => (plan && geographicFocus?.state === "focused"
      ? suggestSisterGeographiesFromPlan(plan, undefined, geographicFocus.cbsaCodes)
      : []),
    [plan, geographicFocus],
  );

  const insightActionPlan = useMemo(
    () => (plan && investigation && selectedLead && analysisBrief
      ? buildInsightActionPlan(
        plan,
        investigation,
        selectedLead,
        analysisBrief,
        analysisBrief.confirmedAt ?? new Date().toISOString(),
      )
      : null),
    [analysisBrief, investigation, plan, selectedLead],
  );

  const reviewablePacket = useMemo(
    () => (plan && selectedAction
      ? assembleReviewableActionPacket(
        plan,
        selectedAction,
        new Date().toISOString(),
        investigation ?? undefined,
        investigationFollowUps,
        analysisBrief ?? undefined,
        evidencePlan ?? undefined,
        evaluationDefinition ?? undefined,
        { selectedLeadId, contextMetric: selectedContextMetric },
        insightActionPlan ?? undefined,
      )
      : null),
    [analysisBrief, evidencePlan, evaluationDefinition, insightActionPlan, investigation, investigationFollowUps, plan, selectedAction, selectedContextMetric, selectedLeadId],
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
  }, [investigation, phase, plan, selectedAction, selectedLead]);

  async function startWorkflow(nextQuestion = question, nextPerspectiveId: PerspectiveId = perspectiveId) {
    if (!nextQuestion.trim()) return;
    const normalizedQuestion = nextQuestion.trim();
    setQuestion(normalizedQuestion);
    setPlan(null);
    setSelectedActionId("");
    setRequestError(null);
    setActiveStep(-1);
    setSisterFollowUpNotice(null);
    setPacketSummary(null);
    setPacketSummaryState("idle");
    setActionDetailsOpen(false);
    setInvestigation(null);
    setSelectedLeadId(null);
    setInvestigationFollowUps([]);
    setAnalysisBrief(null);
    setEvidencePlan(null);
    setEvaluationDefinition(null);
    setPhase("interpreting");
    try {
      const response = await fetch("/api/evaluation-plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: normalizedQuestion, perspectiveId: nextPerspectiveId }),
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
      setSelectedContextMetric(parsed.data.plan.perspectiveId === "marketing" ? "population_density" : parsed.data.plan.perspectiveId === "pricing" ? "median_household_income" : "household_count");
      const nextInvestigation = runMarketInvestigation(parsed.data.plan);
      const nextBrief = buildAnalysisBrief(parsed.data.plan, nextInvestigation);
      const nextEvidencePlan = buildEvidencePlan(parsed.data.plan);
      setInvestigation(null);
      setAnalysisBrief(nextBrief);
      setEvidencePlan(nextEvidencePlan);
      setEvaluationDefinition(null);
      setSelectedLeadId(null);
      setSelectedActionId(proposedActionFromPlan(parsed.data.plan).id);
      setPhase("confirming");
    } catch {
      setRequestError("The evaluation plan service is unavailable. Retry or edit the question.");
      setPhase("error");
    }
  }

  function confirmAndRun(nextBrief: AnalysisBrief) {
    if (!plan) return;
    const nextInvestigation = runConfirmedMarketInvestigation(plan, nextBrief);
    const nextEvidencePlan = evidencePlan ?? buildEvidencePlan(plan);
    setAnalysisBrief(nextBrief);
    setInvestigation(nextInvestigation);
    setEvidencePlan(nextEvidencePlan);
    setEvaluationDefinition(generateEvaluationDefinitionDraft(nextBrief, nextInvestigation, nextEvidencePlan));
    setSelectedLeadId(nextInvestigation.leads[0]?.id ?? null);
    setActiveStep(0);
    setPhase("running");
  }

  function restart() {
    setQuestion("");
    setPlan(null);
    setActiveStep(-1);
    setSelectedActionId("");
    setRequestError(null);
    setSisterFollowUpNotice(null);
    setPacketSummary(null);
    setPacketSummaryState("idle");
    setActionDetailsOpen(false);
    setInvestigation(null);
    setSelectedLeadId(null);
    setInvestigationFollowUps([]);
    setAnalysisBrief(null);
    setEvidencePlan(null);
    setEvaluationDefinition(null);
    setPhase("question");
    setSelectedContextMetric("household_count");
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
      investigation: investigation ?? undefined,
      perspectiveId: plan.perspectiveId,
      followUps: investigationFollowUps,
      analysisBrief: analysisBrief ?? undefined,
      evidencePlan: evidencePlan ?? undefined,
      evaluationDefinition: evaluationDefinition ?? undefined,
      selectedLeadId,
      selectedContextMetric,
    };
    const next = [packet, ...savedPackets.filter((item) => item.question !== packet.question)].slice(0, 10);
    setSavedPackets(next);
    window.localStorage.setItem("market-intelligence-action-packets", JSON.stringify(next));
    setPhase("saved");
  }

  function openSavedPacket(packet: SavedPacket) {
    const restoredPlan = planEvaluation(packet.question, packet.perspectiveId);
    setQuestion(packet.question);
    setPlan(restoredPlan);
    setPerspectiveId(restoredPlan.perspectiveId);
    setSelectedContextMetric(packet.selectedContextMetric ?? (restoredPlan.perspectiveId === "marketing" ? "population_density" : restoredPlan.perspectiveId === "pricing" ? "median_household_income" : "household_count"));
    const restoredInvestigation = packet.investigation ?? runMarketInvestigation(restoredPlan);
    setInvestigation(restoredInvestigation);
    setSelectedLeadId(packet.selectedLeadId && restoredInvestigation.leads.some((lead) => lead.id === packet.selectedLeadId)
      ? packet.selectedLeadId
      : restoredInvestigation.leads[0]?.id ?? null);
    setInvestigationFollowUps(packet.followUps ?? []);
    const restoredBrief = packet.analysisBrief ?? buildAnalysisBrief(restoredPlan, restoredInvestigation);
    const restoredEvidencePlan = packet.evidencePlan ?? buildEvidencePlan(restoredPlan);
    setAnalysisBrief(restoredBrief);
    setEvidencePlan(restoredEvidencePlan);
    setEvaluationDefinition(packet.evaluationDefinition ?? generateEvaluationDefinitionDraft(restoredBrief, restoredInvestigation, restoredEvidencePlan));
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
    setInvestigation(null);
    setSelectedLeadId(null);
    setInvestigationFollowUps([]);
    setAnalysisBrief(null);
    setEvidencePlan(null);
    setEvaluationDefinition(null);
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
      : isConfirmationPage
        ? "confirmation"
      : isAnimationPage
        ? "animation"
        : isResultPage
          ? "result"
          : isErrorPage
            ? "error"
            : "workspace";
  const workspaceLayoutClass = isQuestionPage
    ? "question-layout"
    : isConfirmationPage
      ? "confirmation-page-layout"
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
            <li className={phase === "interpreting" || phase === "confirming" ? "current" : phase === "running" || showPacket || phase === "error" ? "complete" : ""}><span>2</span><div><strong>Confirm</strong><small>Set the analysis contract</small></div></li>
            <li className={phase === "running" ? "current" : showPacket ? "complete" : ""}><span>3</span><div><strong>Run</strong><small>Calculate the confirmed model</small></div></li>
            <li className={showPacket ? "current" : ""}><span>4</span><div><strong>Review</strong><small>Read and export results</small></div></li>
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
              onSubmit={(nextPerspectiveId) => void startWorkflow(question, nextPerspectiveId)}
              onPerspectiveChange={(nextPerspectiveId) => {
                setPerspectiveId(nextPerspectiveId);
                setQuestion("");
                setSisterFollowUpNotice(null);
              }}
              onOpenSaved={() => setActiveView("saved")}
            />
          </section>
        ) : null}

        {isConfirmationPage && plan && analysisBrief ? (
          <section className="analysis-contract-page" aria-labelledby="analysis-brief-title">
            <div className="analysis-contract-intro">
              <button className="text-action" type="button" onClick={restart}>← Edit original question</button>
              <div className="eyebrow">Human checkpoint · before calculation</div>
              <h1>Confirm what the analyst will calculate</h1>
              <p>The analyst translated your question into a scope, comparison method, and evidence boundary. Your edits below shape the investigation and what it may conclude.</p>
            </div>
            <AnalysisBriefPanel brief={analysisBrief} onConfirm={confirmAndRun} />
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
                  <div className="eyebrow">{phase === "saved" ? "Saved recommendation" : "Recommendation"}</div>
                  <h1 id="packet-title">{workspaceHeading(plan, investigation)}</h1>
                  <p className="lead">{investigation?.readiness.summary ?? packetSummaryFromPlan(plan)}</p>
                </div>
                <div className="packet-heading-actions">
                  <span className="draft-pill">{phase === "saved" ? "Saved draft" : "Draft for review"}</span>
                  <button className="secondary-action" onClick={restart}>New question</button>
                </div>
              </div>

              <div className="question-ribbon packet-question">
                <span>Confirmed question</span>
                <strong>{analysisBrief?.rewrittenQuestion ?? plan.originalQuestion}</strong>
              </div>

              {displayedGeographicFocus ? (
                <div className="decision-result-map-shell">
                  <GeographicFocusMap
                    focus={displayedGeographicFocus}
                    modeLabel={geographyModeLabel(plan)}
                    contextMetric={selectedContextMetric}
                  />
                </div>
              ) : null}

              {investigation ? (
                <MarketInvestigationPanel
                  investigation={investigation}
                  selectedLeadId={selectedLead?.id ?? null}
                  onSelectLead={(lead: InvestigationLead) => setSelectedLeadId(lead.id)}
                  followUps={investigationFollowUps.filter((turn) => turn.leadId === selectedLead?.id)}
                  onAskFollowUp={(followUpQuestion) => {
                    if (!selectedLead) return;
                    setInvestigationFollowUps((turns) => [...turns, {
                      id: `follow-up-${Date.now().toString(36)}`,
                      leadId: selectedLead.id,
                      question: followUpQuestion.trim(),
                      answer: answerInvestigationFollowUp(selectedLead, followUpQuestion),
                    }]);
                  }}
                  selectedContextMetric={selectedContextMetric}
                  onContextMetricChange={setSelectedContextMetric}
                />
              ) : null}

              <div className="decision-review-primary">
                <div className="decision-review-side">
                  <div className="action-packet-card">
                    <p className="action-packet-governance-note">
                      Draft for accountable review. This packet does not approve a market, site, lease, or spend decision.
                    </p>
                    {insightActionPlan ? (
                      <InsightActionPlanPanel actionPlan={insightActionPlan} />
                    ) : (
                      <>
                        <div className="section-label">Action packet</div>
                        <h2>{selectedLead ? `Validate ${selectedLead.title}` : selectedAction.title}</h2>
                        <p>{selectedLead?.businessMeaning ?? selectedAction.summary}</p>
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
                      </>
                    )}

                    {!insightActionPlan ? <details
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
                    </details> : null}

                    <div className="packet-card-footer">
                      <div className="packet-card-actions">
                        <button
                          className="secondary-action"
                          type="button"
                          onClick={() => {
                            if (reviewablePacket) downloadReviewableActionPacket(reviewablePacket);
                          }}
                        >
                          Download full report
                        </button>
                        <button className="primary-action" onClick={savePacket}>
                          {phase === "saved" ? "Saved" : "Save action packet"} <span aria-hidden="true">✓</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
