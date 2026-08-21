"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdaptiveEvaluationWorkspace } from "@/components/decision-workflow/AdaptiveEvaluationWorkspace";
import { AnswerEvidenceTrail } from "@/components/decision-workflow/AnswerEvidenceTrail";
import { AnswerCoveragePanel } from "@/components/decision-workflow/AnswerCoveragePanel";
import { DecisionGraphAnimation, type DecisionGraphStep } from "@/components/decision-workflow/DecisionGraphAnimation";
import { AgenticRunSummary, lifecycleGraphSteps } from "@/components/decision-workflow/AgenticRunSummary";
import { GeographicFocusMap } from "@/components/decision-workflow/GeographicFocusMap";
import { InsightActionPlanPanel } from "@/components/decision-workflow/InsightActionPlanPanel";
import { MarketInvestigationPanel } from "@/components/decision-workflow/MarketInvestigationPanel";
import { RecommendationRevisionBar } from "@/components/decision-workflow/RecommendationRevisionBar";
import { ResultOutputBuilder } from "@/components/decision-workflow/ResultOutputBuilder";
import { SisterGeographiesSection } from "@/components/decision-workflow/SisterGeographiesSection";
import { ValidationWorkplanPanel } from "@/components/decision-workflow/ValidationWorkplanPanel";
import { EvidenceBundlePanel } from "@/components/evidence/EvidenceBundlePanel";
import { AutonomousDiscoveryWorkspace, type DiscoveryInvestigationContext } from "@/components/insight-discovery/AutonomousDiscoveryWorkspace";
import { EmailBriefControl } from "@/components/sharing/EmailBriefControl";
import {
  buildDiscoveryInvestigationIntent,
  discoveryInvestigationIntentFromSearchParams,
  discoveryInvestigationIntentSearchParams,
  type DiscoveryInvestigationIntent,
} from "@/lib/insight-discovery/investigation-intent";
import type { CurrentDataDiscoveryRun } from "@/lib/insight-discovery/current-data-discovery";
import { evidenceExecutionResponseSchema, type EvidenceExecutionResponse } from "@/lib/evidence-snapshot/contracts";
import type { CompactSourceReadiness } from "@/lib/data-discovery/readiness-service";
import { publicMarkets } from "@/lib/data/public-market-ui";
import type { CbsaAcsMetricKey } from "@/lib/data/cbsa-acs";
import type { PerspectiveId, PerspectiveViewId } from "@/lib/perspectives";
import { buildAnalysisBrief, describeAnalysisReframe, validateAnalysisBriefConsistency, type AnalysisBrief } from "@/lib/planning/analysis-brief";
import { buildAnalysisPlanRequest } from "@/lib/planning/analysis-plan-review";
import { restoreSavedInvestigation } from "@/lib/planning/saved-packet-state";
import {
  buildEvidencePlan,
  generateEvaluationDefinitionDraft,
  type EvidencePlan,
  type EvaluationDefinitionDraft,
} from "@/lib/planning/evidence-plan";
import {
  answerInvestigationFollowUp,
  recommendedInvestigationRevision,
  reviseMarketInvestigation,
  runConfirmedMarketInvestigation,
  runMarketInvestigation,
  type InvestigationFollowUp,
  type InvestigationLead,
  type MarketInvestigation,
} from "@/lib/planning/market-investigation";
import { marketInvestigationFromEvidence } from "@/lib/planning/evidence-market-investigation";
import { effectivePlanForSourceAdaptation } from "@/lib/planning/source-adaptation-plan";
import {
  assembleReviewableActionPacket,
  actionReadinessLabel,
  actionForInvestigationLead,
  buildInsightActionPlan,
  buildValidationWorkplan,
  buildSisterFollowUpQuestion,
  deterministicFindingsAndProposalSummary,
  deterministicReviewablePacketSummary,
  downloadDecisionBrief,
  downloadReviewableActionPacket,
  evaluationPlanSchema,
  evaluationPlanErrorSchema,
  evaluationPlanResponseSchema,
  focusPlaceLabelsForRewrite,
  packetFindingsSummarySchema,
  packetSummaryFromPlan,
  planEvaluation,
  proposedActionFromPlan,
  presentsActionPackage,
  reviewableActionPacketSchema,
  resolveGeographicFocus,
  suggestSisterGeographiesFromPlan,
  type EvaluationPlan,
  type GeographicFocus,
  type PacketFindingsSummary,
  type PacketAnswer,
  type ReviewableActionPacket,
  type SisterGeographySuggestion,
} from "@/lib/planning";
import { MAX_SELECTED_GEOGRAPHIC_CONTEXTS, type SelectedGeographicContext } from "@/lib/planning/geographic-context";
import {
  clinicSiteWorkflowResultSchema,
  type ClinicSiteWorkflowResult,
} from "@/lib/phoenix-retrieval/contracts";

type Phase = "question" | "interpreting" | "running" | "packet" | "saved" | "error" | "discovery";

const DISCOVERY_INTENT_QUERY_KEYS = ["finding", "perspective", "view", "cbsa", "question"] as const;

function writeDiscoveryIntentUrl(intent: DiscoveryInvestigationIntent, mode: "push" | "replace" = "push") {
  const url = new URL(window.location.href);
  DISCOVERY_INTENT_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
  const params = discoveryInvestigationIntentSearchParams(intent);
  params.forEach((value, key) => url.searchParams.append(key, value));
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
}

function clearDiscoveryIntentUrl() {
  const url = new URL(window.location.href);
  const hadIntent = DISCOVERY_INTENT_QUERY_KEYS.some((key) => url.searchParams.has(key));
  if (!hadIntent) return;
  DISCOVERY_INTENT_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
  window.history.replaceState(null, "", url);
}

type SavedPacket = {
  schemaVersion?: "saved-action-packet-v2";
  id: string;
  question: string;
  title: string;
  actionId: string;
  planActionId?: string;
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
  selectedGeographicContexts?: SelectedGeographicContext[];
  plan?: EvaluationPlan;
  evidenceExecution?: EvidenceExecutionResponse | null;
  packetAnswer?: PacketAnswer;
  packetSummary?: PacketFindingsSummary | null;
  reviewablePacket?: ReviewableActionPacket;
  recommendationDrafts?: RecommendationDraft[];
  activeDraftId?: string | null;
};

type RecommendationDraft = {
  id: string;
  number: number;
  investigation: MarketInvestigation;
  selectedLeadId: string | null;
  selectedContextMetric: CbsaAcsMetricKey;
  followUps: InvestigationFollowUp[];
  analystPrompt?: string;
};

function parseSavedPacket(value: unknown): SavedPacket | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!["id", "question", "title", "actionId", "savedAt"].every((key) => typeof item[key] === "string")) return null;
  const plan = evaluationPlanSchema.safeParse(item.plan);
  const reviewablePacket = reviewableActionPacketSchema.safeParse(item.reviewablePacket);
  const evidenceExecution = item.evidenceExecution === null
    ? null
    : evidenceExecutionResponseSchema.safeParse(item.evidenceExecution);
  const packetSummary = item.packetSummary === null
    ? null
    : packetFindingsSummarySchema.safeParse(item.packetSummary);
  return {
    ...(item as SavedPacket),
    ...(plan.success ? { plan: plan.data } : {}),
    ...(reviewablePacket.success ? { reviewablePacket: reviewablePacket.data, packetAnswer: reviewablePacket.data.packetAnswer } : {}),
    ...(evidenceExecution === null ? { evidenceExecution: null } : evidenceExecution.success ? { evidenceExecution: evidenceExecution.data } : {}),
    ...(packetSummary === null ? { packetSummary: null } : packetSummary.success ? { packetSummary: packetSummary.data } : {}),
  };
}

function nowLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
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

function questionMapMetric(plan: EvaluationPlan): CbsaAcsMetricKey {
  if (plan.intent.requestedMeasure !== "none") return plan.intent.requestedMeasure;
  if (plan.perspectiveId === "marketing") return "population_density";
  if (plan.perspectiveId === "pricing") return "median_household_income";
  return "household_count";
}

function defaultLeadForQuestion(plan: EvaluationPlan, investigation: MarketInvestigation) {
  const requestedCodes = new Set(plan.geographyResolution.selectedCbsaCodes);
  const eligibleLeads = requestedCodes.size
    ? investigation.leads.filter((lead) => lead.marketIds.some((marketId) => requestedCodes.has(marketId)))
    : investigation.leads;
  const patternByMeasure: Partial<Record<EvaluationPlan["intent"]["requestedMeasure"], RegExp>> = {
    total_population: /\bpopulation\b/i,
    household_count: /\bhouseholds?\b/i,
    median_household_income: /\bincome\b/i,
    housing_unit_count: /\bhousing\b/i,
    population_density: /\bdens(?:ity|e)\b/i,
  };
  const pattern = patternByMeasure[plan.intent.requestedMeasure];
  if (!pattern) return eligibleLeads[0] ?? null;
  return eligibleLeads.find((lead) => pattern.test(`${lead.title} ${lead.observation} ${lead.businessMeaning}`))
    ?? eligibleLeads[0]
    ?? null;
}

export function DecisionWorkflowApp() {
  const [activeView, setActiveView] = useState<"workflow" | "saved">("workflow");
  const [phase, setPhase] = useState<Phase>("question");
  const [question, setQuestion] = useState("");
  const [activeStep, setActiveStep] = useState(-1);
  const [plan, setPlan] = useState<EvaluationPlan | null>(null);
  const [clinicWorkflow, setClinicWorkflow] = useState<ClinicSiteWorkflowResult | null>(null);
  const [selectedActionId, setSelectedActionId] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [savedPackets, setSavedPackets] = useState<SavedPacket[]>([]);
  const [sisterFollowUpNotice, setSisterFollowUpNotice] = useState<string | null>(null);
  const [packetSummary, setPacketSummary] = useState<PacketFindingsSummary | null>(null);
  const [packetSummaryState, setPacketSummaryState] = useState<"idle" | "loading" | "ready">("idle");
  const [actionDetailsOpen, setActionDetailsOpen] = useState(false);
  const [investigation, setInvestigation] = useState<MarketInvestigation | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [investigationFollowUps, setInvestigationFollowUps] = useState<InvestigationFollowUp[]>([]);
  const [analysisBrief, setAnalysisBrief] = useState<AnalysisBrief | null>(null);
  const [evidencePlan, setEvidencePlan] = useState<EvidencePlan | null>(null);
  const [evaluationDefinition, setEvaluationDefinition] = useState<EvaluationDefinitionDraft | null>(null);
  const [evidenceExecution, setEvidenceExecution] = useState<EvidenceExecutionResponse | null>(null);
  const [persistedReviewablePacket, setPersistedReviewablePacket] = useState<ReviewableActionPacket | null>(null);
  const [replanNotice, setReplanNotice] = useState<string | null>(null);
  const [selectedContextMetric, setSelectedContextMetric] = useState<CbsaAcsMetricKey>("household_count");
  const [selectedGeographicContexts, setSelectedGeographicContexts] = useState<SelectedGeographicContext[]>([]);
  const [geographicContextNotice, setGeographicContextNotice] = useState<string | null>(null);
  const [recommendationDrafts, setRecommendationDrafts] = useState<RecommendationDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [sourceReadiness, setSourceReadiness] = useState<CompactSourceReadiness | null>(null);
  const [selectedDiscoveryFindingId, setSelectedDiscoveryFindingId] = useState<string | null>(null);
  const [selectedDiscoveryRun, setSelectedDiscoveryRun] = useState<CurrentDataDiscoveryRun | null>(null);
  const [discoveryRailClosed, setDiscoveryRailClosed] = useState(false);
  const [discoveryInvestigationIntent, setDiscoveryInvestigationIntent] = useState<DiscoveryInvestigationIntent | null>(null);
  const graphSteps = useMemo(() => plan?.steps ?? [], [plan]);
  const actionOptions = useMemo(() => plan?.actions ?? [], [plan]);
  const showsActionPackage = plan ? presentsActionPackage(plan) : false;
  const effectivePlan = useMemo(
    () => (plan ? effectivePlanForSourceAdaptation(plan, evidenceExecution?.sourceAdaptation) : null),
    [evidenceExecution?.sourceAdaptation, plan],
  );

  const applyDiscoveryInvestigationIntent = useCallback((intent: DiscoveryInvestigationIntent) => {
    setDiscoveryInvestigationIntent(intent);
    setQuestion(intent.question);
    setSelectedGeographicContexts(intent.selectedGeographicContexts);
    setGeographicContextNotice(null);
    setSisterFollowUpNotice(null);
    setActiveView("workflow");
    setPhase("question");
  }, []);

  useEffect(() => {
    function syncDiscoveryIntentFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const hasIntentMarker = DISCOVERY_INTENT_QUERY_KEYS.some((key) => params.has(key));
      const intent = discoveryInvestigationIntentFromSearchParams(params);
      if (intent) {
        applyDiscoveryInvestigationIntent(intent);
        return;
      }
      setDiscoveryInvestigationIntent(null);
      if (hasIntentMarker) {
        setQuestion("");
        setSelectedGeographicContexts([]);
        setGeographicContextNotice("This finding link is invalid or references an unsupported geography. Open the finding again from the current evidence inbox.");
        return;
      }
      setQuestion("");
      setSelectedGeographicContexts([]);
      setGeographicContextNotice(null);
      setSisterFollowUpNotice(null);
      setActiveView("workflow");
      setPhase("question");
    }
    syncDiscoveryIntentFromUrl();
    window.addEventListener("popstate", syncDiscoveryIntentFromUrl);
    return () => window.removeEventListener("popstate", syncDiscoveryIntentFromUrl);
  }, [applyDiscoveryInvestigationIntent]);

  function openDiscoveryInvestigation(finding: DiscoveryInvestigationContext, questionOverride?: string, sourceRunId?: string) {
    try {
      const intent = buildDiscoveryInvestigationIntent({
        insightId: finding.insightId,
        department: finding.department,
        viewId: finding.viewId,
        marketIds: finding.marketIds,
        question: questionOverride ?? finding.question,
        sourceRunId,
        originatingQuestion: finding.originatingQuestion,
        findingHeadline: finding.headline,
        sourceIds: finding.sourceIds,
      });
      writeDiscoveryIntentUrl(intent);
      applyDiscoveryInvestigationIntent(intent);
    } catch {
      setDiscoveryInvestigationIntent(null);
      setQuestion("");
      setSelectedGeographicContexts([]);
      setGeographicContextNotice("This finding could not be opened because its perspective, view, or geography is not supported by the current workspace.");
      setActiveView("workflow");
      setPhase("question");
    }
  }

  function detachDiscoveryInvestigationIntent() {
    setDiscoveryInvestigationIntent(null);
    clearDiscoveryIntentUrl();
  }

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

  const packetAction = useMemo(
    () => selectedAction ? actionForInvestigationLead(selectedAction, investigation, selectedLead) : undefined,
    [investigation, selectedAction, selectedLead],
  );

  const displayedGeographicFocus = useMemo<GeographicFocus | null>(() => {
    if (!selectedLead) return geographicFocus;
    if (investigation?.geography === "supplied_trade_area") return geographicFocus;
    const names = selectedLead.marketIds.map((code) => publicMarkets.find((market) => market.cbsa_code === code)?.cbsa_name ?? code);
    return {
      state: "focused",
      source: "evaluation_result",
      cbsaCodes: selectedLead.marketIds.slice(0, 5),
      label: names.join(" compared with "),
      evidenceStatus: "Derived",
      message: `Map focus follows the selected analyst lead: ${selectedLead.title}.`,
    };
  }, [geographicFocus, investigation?.geography, selectedLead]);

  const sisterGeographies = useMemo(
    () => (plan && plan.intent.topic !== "clinic_location" && geographicFocus?.state === "focused"
      ? suggestSisterGeographiesFromPlan(plan, undefined, geographicFocus.cbsaCodes)
      : []),
    [plan, geographicFocus],
  );

  const insightActionPlan = useMemo(
    () => (effectivePlan && investigation && selectedLead && analysisBrief
      && analysisBrief.planId === effectivePlan.planId
      && analysisBrief.originalQuestion === effectivePlan.originalQuestion
      ? buildInsightActionPlan(
        effectivePlan,
        investigation,
        selectedLead,
        analysisBrief,
        analysisBrief.confirmedAt ?? new Date().toISOString(),
      )
      : null),
    [analysisBrief, effectivePlan, investigation, selectedLead],
  );

  const validationWorkplan = useMemo(
    () => (effectivePlan && !insightActionPlan ? buildValidationWorkplan(effectivePlan) : null),
    [effectivePlan, insightActionPlan],
  );

  const reviewablePacket = useMemo(
    () => (persistedReviewablePacket && plan && persistedReviewablePacket.planId === plan.planId
      ? persistedReviewablePacket
      : effectivePlan && packetAction
      ? assembleReviewableActionPacket(
        effectivePlan,
        packetAction,
        new Date().toISOString(),
        investigation ?? undefined,
        investigationFollowUps,
        analysisBrief?.planId === effectivePlan.planId && analysisBrief.originalQuestion === effectivePlan.originalQuestion ? analysisBrief : undefined,
        evidencePlan?.planId === effectivePlan.planId && evidencePlan.originalQuestion === effectivePlan.originalQuestion ? evidencePlan : undefined,
        evaluationDefinition?.planId === effectivePlan.planId ? evaluationDefinition : undefined,
        { selectedLeadId, contextMetric: selectedContextMetric },
        insightActionPlan ?? undefined,
        null,
        validationWorkplan ?? undefined,
        evidenceExecution,
      )
      : null),
    [analysisBrief, effectivePlan, evidenceExecution, evidencePlan, evaluationDefinition, insightActionPlan, investigation, investigationFollowUps, packetAction, persistedReviewablePacket, plan, selectedContextMetric, selectedLeadId, validationWorkplan],
  );

  const evidenceGraphSteps = useMemo<DecisionGraphStep[]>(() => {
    if (evidenceExecution?.agenticLifecycle) return lifecycleGraphSteps(evidenceExecution.agenticLifecycle);
    if (phase === "running") return [{
      id: "active-evidence-request",
      label: "Investigating registered evidence",
      detail: "The evidence service is selecting and checking compatible registered sources. Individual passes appear only after the service returns receipts.",
      result: "Waiting for verified execution receipts.",
      evidenceState: "pending",
    }];
    if (!investigation || !reviewablePacket) return graphSteps;
    const challengeCount = investigation.rejectedPatterns.length
      + investigation.leads.filter((lead) => lead.challenge.trim()).length;
    return [
      ...investigation.investigationPath.map((step) => ({
        id: step.id,
        label: step.label,
        detail: step.result,
        result: step.result,
        evidenceState: step.status === "completed"
          ? "complete" as const
          : step.status === "waiting_for_evidence"
            ? "waiting" as const
            : "pending" as const,
      })),
      {
        id: "challenge_interpretation",
        label: "Challenge the interpretation",
        detail: `${challengeCount} alternative explanations or rejected readings recorded.`,
        result: `${challengeCount} alternative explanations or rejected readings recorded.`,
        evidenceState: "complete" as const,
      },
      {
        id: "synthesize_supported_answer",
        label: "Synthesize the supported answer",
        detail: `${reviewablePacket.answerCoverage.coveredRequiredCount} of ${reviewablePacket.answerCoverage.requiredCount} required items covered. ${reviewablePacket.finalAnswer.strongestSupportedConclusion}`,
        result: reviewablePacket.finalAnswer.strongestSupportedConclusion,
        evidenceState: "complete" as const,
      },
    ];
  }, [evidenceExecution, graphSteps, investigation, phase, reviewablePacket]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("market-intelligence-action-packets");
      if (!stored) return;
      try {
        const raw: unknown = JSON.parse(stored);
        setSavedPackets(Array.isArray(raw) ? raw.map(parseSavedPacket).filter((item): item is SavedPacket => item !== null) : []);
      } catch {
        window.localStorage.removeItem("market-intelligence-action-packets");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if ((phase !== "packet" && phase !== "saved") || !plan || !packetAction) {
      return;
    }
    if (phase === "saved" && persistedReviewablePacket) {
      return;
    }
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      const localSummary = reviewablePacket
        ? deterministicReviewablePacketSummary(reviewablePacket)
        : deterministicFindingsAndProposalSummary(plan, packetAction, evidenceExecution);
      setPacketSummaryState("loading");
      setPacketSummary(localSummary);
      try {
        const response = await fetch("/api/evaluation-plans/summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan, actionId: packetAction.id, action: packetAction, evidenceExecution, packet: reviewablePacket }),
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
          setPacketSummary(localSummary);
        }
        setPacketSummaryState("ready");
      } catch {
        if (cancelled) return;
        setPacketSummary(localSummary);
        setPacketSummaryState("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [evidenceExecution, persistedReviewablePacket, phase, plan, packetAction, reviewablePacket]);

  async function startWorkflow(
    nextQuestion = question,
    nextPerspectiveId?: PerspectiveId,
    activeViewId?: PerspectiveViewId,
    submittedGeographicContexts: readonly SelectedGeographicContext[] = selectedGeographicContexts,
  ) {
    if (!nextQuestion.trim()) return;
    const normalizedQuestion = nextQuestion.trim();
    setQuestion(normalizedQuestion);
    setSelectedGeographicContexts([...submittedGeographicContexts]);
    setPlan(null);
    setClinicWorkflow(null);
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
    setEvidenceExecution(null);
    setPersistedReviewablePacket(null);
    setReplanNotice(null);
    setRecommendationDrafts([]);
    setActiveDraftId(null);
    setPhase("interpreting");
    try {
      const response = await fetch("/api/evaluation-plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildAnalysisPlanRequest({
          question: normalizedQuestion,
          selectedCbsaCodes: submittedGeographicContexts.map((context) => context.cbsaCode),
          perspectiveId: nextPerspectiveId,
          activeViewId,
        })),
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
      setSelectedContextMetric(questionMapMetric(parsed.data.plan));
      const nextInvestigation = runMarketInvestigation(parsed.data.plan);
      const nextBrief = buildAnalysisBrief(parsed.data.plan, nextInvestigation);
      const confirmedBrief: AnalysisBrief = {
        ...nextBrief,
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
      };
      const nextEvidencePlan = buildEvidencePlan(parsed.data.plan);
      setInvestigation(null);
      setAnalysisBrief(confirmedBrief);
      setEvidencePlan(nextEvidencePlan);
      setEvaluationDefinition(null);
      setSelectedLeadId(null);
      setSelectedActionId(proposedActionFromPlan(parsed.data.plan).id);
      await confirmAndRun(confirmedBrief, parsed.data.plan, nextEvidencePlan);
    } catch {
      setRequestError("The evaluation plan service is unavailable. Retry or edit the question.");
      setPhase("error");
    }
  }

  async function confirmAndRun(
    nextBrief: AnalysisBrief,
    planToRun: EvaluationPlan | null = plan,
    evidencePlanToRun?: EvidencePlan,
  ) {
    if (!planToRun) return;
    const briefConsistencyIssues = validateAnalysisBriefConsistency(planToRun, nextBrief);
    if (briefConsistencyIssues.length) {
      setRequestError(`The analysis contract no longer matches the validated plan. ${briefConsistencyIssues.join(" ")}`);
      setReplanNotice("Execution was stopped before any query ran. Regenerate or edit the question to restore one consistent topic, geography, source, and query contract.");
      return;
    }
    setReplanNotice(null);
    const nextInvestigation = runConfirmedMarketInvestigation(planToRun, nextBrief);
    const normalizedEvidencePlan = planToRun.intent.selectedQueries.length > 0;
    const nextEvidencePlan = evidencePlanToRun ?? evidencePlan ?? buildEvidencePlan(planToRun);
    setAnalysisBrief(nextBrief);
    setInvestigation(nextInvestigation);
    setEvidencePlan(nextEvidencePlan);
    setEvaluationDefinition(generateEvaluationDefinitionDraft(nextBrief, nextInvestigation, nextEvidencePlan));
    const reviewInvestigation = nextInvestigation;
    const initialLeadId = reviewInvestigation ? defaultLeadForQuestion(planToRun, reviewInvestigation)?.id ?? null : null;
    setSelectedLeadId(initialLeadId);
    if (reviewInvestigation) {
      const initialDraft: RecommendationDraft = {
        id: `draft-1-${Date.now().toString(36)}`,
        number: 1,
        investigation: reviewInvestigation,
        selectedLeadId: initialLeadId,
        selectedContextMetric,
        followUps: [],
      };
      setRecommendationDrafts([initialDraft]);
      setActiveDraftId(initialDraft.id);
    } else {
      setRecommendationDrafts([]);
      setActiveDraftId(null);
    }
    setActiveStep(0);
    setPhase("running");
    setClinicWorkflow(null);
    setEvidenceExecution(null);
    setPersistedReviewablePacket(null);
    let executedEvidence: EvidenceExecutionResponse | null = null;
    try {
      const response = await fetch("/api/evaluation-plans/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: `workflow-${planToRun.planId}-${Date.now()}`, plan: planToRun }),
      });
      const payload: unknown = await response.json();
      const parsed = evidenceExecutionResponseSchema.safeParse(payload);
      if (parsed.success) {
        executedEvidence = parsed.data;
        setEvidenceExecution(parsed.data);
        const executedPlan = effectivePlanForSourceAdaptation(planToRun, parsed.data.sourceAdaptation);
        const executedInvestigation = marketInvestigationFromEvidence(executedPlan, parsed.data) ?? nextInvestigation;
        if (executedInvestigation) {
          const executedLeadId = executedInvestigation.leads[0]?.id ?? null;
          const executedDraftId = `draft-1-${Date.now().toString(36)}`;
          setInvestigation(executedInvestigation);
          setSelectedLeadId(executedLeadId);
          setRecommendationDrafts([{
            id: executedDraftId,
            number: 1,
            investigation: executedInvestigation,
            selectedLeadId: executedLeadId,
            selectedContextMetric,
            followUps: [],
          }]);
          setActiveDraftId(executedDraftId);
        }
        setActiveStep(parsed.data.agenticLifecycle?.passes.length ?? 0);
      }
    } catch {
      // The review page retains the validated plan when local evidence execution is unavailable.
    }
    if (planToRun.capabilityId !== "clinic_site_evaluation" || normalizedEvidencePlan || !executedEvidence || executedEvidence.status === "blocked" || executedEvidence.status === "failed") {
      setPhase("packet");
      return;
    }
    try {
      const response = await fetch("/api/clinic-site-evaluation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: planToRun.originalQuestion }),
      });
      const payload: unknown = await response.json();
      const workflow = payload && typeof payload === "object" && "workflow" in payload
        ? (payload as { workflow: unknown }).workflow
        : null;
      const parsed = clinicSiteWorkflowResultSchema.safeParse(workflow);
      if (parsed.success) setClinicWorkflow(parsed.data);
    } catch {
      // The existing deterministic packet remains usable if retrieval is unavailable.
    }
    setPhase("packet");
  }

  function restart() {
    detachDiscoveryInvestigationIntent();
    setQuestion("");
    setSelectedGeographicContexts([]);
    setPlan(null);
    setClinicWorkflow(null);
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
    setEvidenceExecution(null);
    setPersistedReviewablePacket(null);
    setReplanNotice(null);
    setRecommendationDrafts([]);
    setActiveDraftId(null);
    setPhase("question");
    setSelectedContextMetric("household_count");
  }

  function savePacket() {
    if (!plan || !selectedAction || !packetAction || !reviewablePacket) return;
    const packet: SavedPacket = {
      schemaVersion: "saved-action-packet-v2",
      id: `packet-${Date.now().toString(36)}`,
      question: plan.originalQuestion,
      title: packetAction.title,
      actionId: packetAction.id,
      planActionId: selectedAction.id,
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
      selectedGeographicContexts,
      plan,
      evidenceExecution,
      packetAnswer: reviewablePacket.packetAnswer,
      packetSummary,
      reviewablePacket,
      recommendationDrafts,
      activeDraftId,
    };
    const next = [packet, ...savedPackets.filter((item) => item.question !== packet.question)].slice(0, 10);
    setSavedPackets(next);
    window.localStorage.setItem("market-intelligence-action-packets", JSON.stringify(next));
    setPersistedReviewablePacket(reviewablePacket);
    setPhase("saved");
  }

  function openSavedPacket(packet: SavedPacket) {
    detachDiscoveryInvestigationIntent();
    const restoredGeographicContexts = packet.selectedGeographicContexts ?? [];
    const savedPlan = packet.plan ? evaluationPlanSchema.safeParse(packet.plan) : null;
    const restoredPlan = savedPlan?.success ? savedPlan.data : planEvaluation(packet.question, packet.perspectiveId, restoredGeographicContexts);
    const savedReviewablePacket = packet.reviewablePacket ? reviewableActionPacketSchema.safeParse(packet.reviewablePacket) : null;
    const restoredEvidenceExecution = packet.evidenceExecution !== undefined
      ? packet.evidenceExecution
      : savedReviewablePacket?.success
        ? savedReviewablePacket.data.evidenceExecution ?? null
        : null;
    setQuestion(packet.question);
    setSelectedGeographicContexts(restoredGeographicContexts);
    setGeographicContextNotice(null);
    setPlan(restoredPlan);
    setClinicWorkflow(null);
    setEvidenceExecution(restoredEvidenceExecution);
    setPersistedReviewablePacket(savedReviewablePacket?.success ? savedReviewablePacket.data : null);
    setPacketSummary(packet.packetSummary ?? null);
    setPacketSummaryState("ready");
    setSelectedContextMetric(packet.selectedContextMetric ?? questionMapMetric(restoredPlan));
    const fallbackInvestigation = runMarketInvestigation(restoredPlan);
    const restoredInvestigation = restoreSavedInvestigation(restoredPlan, packet.investigation, fallbackInvestigation);
    const restoredSelectedLeadId = restoredInvestigation
      ? packet.selectedLeadId && restoredInvestigation.leads.some((lead) => lead.id === packet.selectedLeadId)
        ? packet.selectedLeadId
        : defaultLeadForQuestion(restoredPlan, restoredInvestigation)?.id ?? null
      : null;
    setInvestigation(restoredInvestigation);
    setSelectedLeadId(restoredSelectedLeadId);
    setInvestigationFollowUps(packet.followUps ?? []);
    const investigationForPlanning = restoredInvestigation ?? fallbackInvestigation;
    const restoredBrief = packet.analysisBrief
      && packet.analysisBrief.planId === restoredPlan.planId
      && packet.analysisBrief.originalQuestion === restoredPlan.originalQuestion
      ? packet.analysisBrief
      : buildAnalysisBrief(restoredPlan, investigationForPlanning);
    const restoredEvidencePlan = packet.evidencePlan
      && packet.evidencePlan.planId === restoredPlan.planId
      && packet.evidencePlan.originalQuestion === restoredPlan.originalQuestion
      ? packet.evidencePlan
      : buildEvidencePlan(restoredPlan);
    setAnalysisBrief(restoredBrief);
    setEvidencePlan(restoredEvidencePlan);
    setEvaluationDefinition(packet.evaluationDefinition?.planId === restoredPlan.planId
      ? packet.evaluationDefinition
      : generateEvaluationDefinitionDraft(restoredBrief, investigationForPlanning, restoredEvidencePlan));
    const restoredDraft: RecommendationDraft = {
      id: `draft-1-${Date.now().toString(36)}`,
      number: 1,
      investigation: investigationForPlanning,
      selectedLeadId: restoredSelectedLeadId,
      selectedContextMetric: packet.selectedContextMetric ?? questionMapMetric(restoredPlan),
      followUps: packet.followUps ?? [],
    };
    const restoredDrafts = restoredInvestigation
      ? packet.recommendationDrafts?.length ? packet.recommendationDrafts : [restoredDraft]
      : [];
    const restoredActiveDraftId = packet.activeDraftId && restoredDrafts.some((draft) => draft.id === packet.activeDraftId)
      ? packet.activeDraftId
      : restoredDrafts.at(-1)?.id ?? null;
    setRecommendationDrafts(restoredDrafts);
    setActiveDraftId(restoredActiveDraftId);
    const restoredPlanActionId = packet.planActionId ?? packet.actionId;
    setSelectedActionId(restoredPlan.actions.some((action) => action.id === restoredPlanActionId) ? restoredPlanActionId : proposedActionFromPlan(restoredPlan).id);
    setRequestError(null);
    setSisterFollowUpNotice(null);
    setReplanNotice(savedPlan?.success
      ? "Restored the saved plan and executed evidence exactly as recorded. No replanning or query execution occurred."
      : "Legacy saved packet restored. Its original plan was not stored, so the current deterministic planner reconstructed the review context.");
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
    detachDiscoveryInvestigationIntent();
    setPlan(null);
    setInvestigation(null);
    setSelectedLeadId(null);
    setInvestigationFollowUps([]);
    setAnalysisBrief(null);
    setEvidencePlan(null);
    setEvaluationDefinition(null);
    setEvidenceExecution(null);
    setPersistedReviewablePacket(null);
    setRecommendationDrafts([]);
    setActiveDraftId(null);
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

  function reviseRecommendation(analystPrompt: string) {
    if (!investigation) return;
    const nextNumber = Math.max(0, ...recommendationDrafts.map((draft) => draft.number)) + 1;
    const nextInvestigation = reviseMarketInvestigation(investigation, analystPrompt, nextNumber);
    const retainedLeadId = selectedLeadId && nextInvestigation.leads.some((lead) => lead.id === selectedLeadId)
      ? selectedLeadId
      : nextInvestigation.leads[0]?.id ?? null;
    const nextDraft: RecommendationDraft = {
      id: `draft-${nextNumber}-${Date.now().toString(36)}`,
      number: nextNumber,
      investigation: nextInvestigation,
      selectedLeadId: retainedLeadId,
      selectedContextMetric,
      followUps: investigationFollowUps,
      analystPrompt,
    };
    setRecommendationDrafts((drafts) => [...drafts, nextDraft]);
    setActiveDraftId(nextDraft.id);
    setInvestigation(nextInvestigation);
    setSelectedLeadId(retainedLeadId);
    setPacketSummary(null);
    setPacketSummaryState("idle");
    setPhase("packet");
  }

  function openRecommendationDraft(draft: RecommendationDraft) {
    setActiveDraftId(draft.id);
    setInvestigation(draft.investigation);
    setSelectedLeadId(draft.selectedLeadId);
    setSelectedContextMetric(draft.selectedContextMetric);
    setInvestigationFollowUps(draft.followUps);
    setPacketSummary(null);
    setPacketSummaryState("idle");
    setPhase("packet");
  }

  const showPacket = phase === "packet" || phase === "saved";
  const isQuestionPage = activeView === "workflow" && phase === "question";
  const isAnimationPage = activeView === "workflow" && (phase === "interpreting" || phase === "running");
  const isResultPage = activeView === "workflow" && showPacket;
  const isErrorPage = activeView === "workflow" && phase === "error";
  const isDiscoveryPage = activeView === "workflow" && phase === "discovery";
  const analysisReframe = plan && analysisBrief ? describeAnalysisReframe(plan, analysisBrief) : null;

  useEffect(() => {
    if (!isResultPage) return;
    let cancelled = false;
    void fetch("/api/source-readiness", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as CompactSourceReadiness;
      })
      .then((readiness) => {
        if (!cancelled && readiness) setSourceReadiness(readiness);
      })
      .catch(() => {
        // The answer remains usable when the optional readiness summary is unavailable.
      });
    return () => { cancelled = true; };
  }, [isResultPage]);
  const pagePhase = activeView === "saved"
    ? "saved-list"
    : isQuestionPage
      ? "question"
      : isAnimationPage
        ? "animation"
        : isResultPage
          ? "result"
          : isDiscoveryPage
            ? "discovery"
          : isErrorPage
            ? "error"
            : "workspace";
  const workspaceLayoutClass = isQuestionPage
    ? "question-layout"
    : isAnimationPage
      ? "animation-page-layout"
      : isDiscoveryPage
        ? "discovery-page-layout"
      : "workspace-layout packet-workspace-layout result-page-layout";

  return (
    <main
      className={`decision-app ${isQuestionPage ? "question-page" : "workspace-mode"} page-phase-${pagePhase}`}
      data-page-phase={pagePhase}
    >
      <div className={`decision-layout ${workspaceLayoutClass} ${isDiscoveryPage && discoveryRailClosed ? "discovery-rail-collapsed" : ""}`} id="start">
        <aside className="decision-rail" aria-label={isDiscoveryPage ? "Autonomous discovery progress" : "Workflow progress"}>
          {isDiscoveryPage ? (
            <>
              <div className="discovery-rail-actions">
                <button className="discovery-rail-close" type="button" aria-label="Hide autonomous workflow panel" onClick={() => setDiscoveryRailClosed(true)}><span className="panel-toggle-icon" aria-hidden="true" /></button>
              </div>
              <div className="rail-kicker">Autonomous workflow</div>
              <h2>From data to insight</h2>
              <p>Scan approved evidence without waiting for a stakeholder question.</p>
              <ol className="rail-steps">
                <li className="complete"><span>1</span><div><strong>Generate</strong><small>Open hypotheses from the evidence</small></div></li>
                <li className="complete"><span>2</span><div><strong>Investigate</strong><small>Screen every compatible market</small></div></li>
                <li className="complete"><span>3</span><div><strong>Challenge</strong><small>Retain limits and alternatives</small></div></li>
                <li className="current"><span>4</span><div><strong>Discover</strong><small>Review the strongest leads</small></div></li>
              </ol>
              <div id="discovery-rail-run-actions" className="discovery-rail-run-actions" />
              <div className="rail-note"><strong>Current method</strong><p>Data-generated hypotheses are tested with reusable cohort, contradiction, channel-mix, and matched-SKU analyses. Findings do not authorize material action.</p></div>
            </>
          ) : (
            <>
          <div className="rail-kicker">Decision workflow</div>
          <h2>From question to action</h2>
          <p>Move from a business question to a reviewable next step.</p>
          <ol className="rail-steps">
            <li className={phase === "question" ? "current" : "complete"}><span>1</span><div><strong>Ask</strong><small>State the decision</small></div></li>
            <li className={phase === "interpreting" ? "current" : phase === "running" || showPacket || phase === "error" ? "complete" : ""}><span>2</span><div><strong>Frame</strong><small>Attach context and evidence</small></div></li>
            <li className={phase === "running" ? "current" : showPacket ? "complete" : ""}><span>3</span><div><strong>Run</strong><small>Calculate the analysis</small></div></li>
            <li className={showPacket ? "current" : ""}><span>4</span><div><strong>Review</strong><small>Read and export results</small></div></li>
          </ol>
          <div className="rail-note"><strong>Decision boundary</strong><p>The workspace prepares evidence and next actions. An accountable owner makes the business decision.</p></div>
            </>
          )}
        </aside>

        {isDiscoveryPage && discoveryRailClosed ? <button className="discovery-rail-open" type="button" aria-label="Show autonomous workflow panel" onClick={() => setDiscoveryRailClosed(false)}><span className="panel-toggle-icon" aria-hidden="true" /> Show workflow</button> : null}

        {activeView === "saved" ? (
          <section className="decision-content">
            <SavedPacketsView packets={savedPackets} onOpen={openSavedPacket} onStart={() => { detachDiscoveryInvestigationIntent(); setActiveView("workflow"); setPhase("question"); setQuestion(""); setSelectedGeographicContexts([]); setGeographicContextNotice(null); setSisterFollowUpNotice(null); }} />
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
              savedPackets={savedPackets.map((packet) => ({
                id: packet.id,
                question: packet.question,
                title: packet.title,
                savedAt: packet.savedAt,
                perspectiveId: packet.perspectiveId,
                viewId: packet.plan?.evidenceSelection?.viewId,
                selectedGeographicContexts: packet.selectedGeographicContexts,
              }))}
              onQuestionChange={(value) => {
                if (discoveryInvestigationIntent && value !== discoveryInvestigationIntent.question) {
                  detachDiscoveryInvestigationIntent();
                }
                setQuestion(value);
                if (sisterFollowUpNotice) setSisterFollowUpNotice(null);
              }}
              onSubmit={(nextPerspectiveId, activeViewId, geographicContexts) => void startWorkflow(
                question,
                discoveryInvestigationIntent?.perspectiveId ?? nextPerspectiveId,
                discoveryInvestigationIntent?.viewId ?? activeViewId,
                geographicContexts,
              )}
              onDiscoverInsights={(findingId, discoveryRun) => {
                setSelectedDiscoveryFindingId(findingId ?? null);
                setSelectedDiscoveryRun(discoveryRun ?? null);
                setPhase("discovery");
              }}
              onPerspectiveChange={() => {
                detachDiscoveryInvestigationIntent();
                setQuestion("");
                setSisterFollowUpNotice(null);
              }}
              onOpenSaved={() => setActiveView("saved")}
              onOpenSavedPacket={(id) => {
                const packet = savedPackets.find((candidate) => candidate.id === id);
                if (packet) openSavedPacket(packet);
              }}
              selectedGeographicContexts={selectedGeographicContexts}
              onGeographicContextSelect={(context) => {
                detachDiscoveryInvestigationIntent();
                setGeographicContextNotice(null);
                setSelectedGeographicContexts((current) => {
                  if (current.some((item) => item.cbsaCode === context.cbsaCode)) return current;
                  if (current.length >= MAX_SELECTED_GEOGRAPHIC_CONTEXTS) {
                    setGeographicContextNotice(`You can add up to ${MAX_SELECTED_GEOGRAPHIC_CONTEXTS} CBSA regions.`);
                    return current;
                  }
                  return [...current, context];
                });
              }}
              onGeographicContextRemove={(cbsaCode) => {
                detachDiscoveryInvestigationIntent();
                setSelectedGeographicContexts((current) => current.filter((context) => context.cbsaCode !== cbsaCode));
                setGeographicContextNotice(null);
              }}
              geographicContextNotice={geographicContextNotice}
            />
          </section>
        ) : null}

        {isDiscoveryPage ? (
          <section className="decision-content">
            <AutonomousDiscoveryWorkspace
              initialFindingId={selectedDiscoveryFindingId}
              initialRun={selectedDiscoveryRun}
              onBack={() => { setSelectedDiscoveryFindingId(null); setSelectedDiscoveryRun(null); setPhase("question"); }}
              onInvestigate={openDiscoveryInvestigation}
            />
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
                steps={evidenceGraphSteps}
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
                  <div className="eyebrow">Evidence graph in progress</div>
                  <h1 id="graph-title">Building the answer from checked evidence</h1>
                  {analysisBrief && analysisReframe?.changed ? (
                    <div className="analysis-reframe-note" role="status">
                      <strong>Question reframed for analysis</strong>
                      <p>{analysisBrief.rewrittenQuestion}</p>
                      <small><b>What changed</b>{analysisReframe.summary}</small>
                      <small><b>Why</b>{analysisReframe.reason}</small>
                    </div>
                  ) : null}
                  <p className="plan-method-ribbon" data-proposal-method={plan.proposalMethod}>
                    {proposalMethodLabel(plan.proposalMethod)} · {plan.capabilityId.replaceAll("_", " ")} · {plan.status === "blocked" ? "limited evidence — analysis continues" : plan.status.replaceAll("_", " ")}
                  </p>
                  <div className="animation-current-step">
                    <small>Active request</small>
                    <strong>Investigating compatible registered evidence</strong>
                    <span>The service is running a bounded investigation. Source passes and answer checks will be shown only after their execution receipts return.</span>
                  </div>
                  <div className="graph-footer">
                    <span className="progress-pulse" aria-hidden="true" />
                    Waiting for verified execution receipts
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
                  <div className="eyebrow">{phase === "saved" ? `Saved ${showsActionPackage ? "action package" : "result"}` : showsActionPackage ? "Action package" : "Result"}</div>
                  <h1 id="packet-title">{workspaceHeading(plan, investigation)}</h1>
                  <p className="lead">{investigation?.readiness.summary ?? packetSummaryFromPlan(plan)}</p>
                </div>
                <div className="packet-heading-actions">
                  {recommendationDrafts.length ? (
                    <div className="draft-ledger" role="tablist" aria-label={showsActionPackage ? "Recommendation drafts" : "Result drafts"}>
                      {recommendationDrafts.map((draft) => (
                        <button
                          key={draft.id}
                          type="button"
                          role="tab"
                          aria-selected={draft.id === activeDraftId}
                          onClick={() => openRecommendationDraft(draft)}
                          title={draft.analystPrompt ? `Revised to consider: ${draft.analystPrompt}` : showsActionPackage ? "Original recommendation" : "Original result"}
                        >
                          Draft {draft.number}
                        </button>
                      ))}
                    </div>
                  ) : <span className="draft-pill">{phase === "saved" ? "Saved draft" : "Draft 1"}</span>}
                  <button className="secondary-action" onClick={restart}>New question</button>
                </div>
              </div>

              <div className="question-ribbon packet-question">
                <span>Your question</span>
                <strong>{plan.originalQuestion}</strong>
                {analysisBrief?.rewrittenQuestion && analysisBrief.rewrittenQuestion !== plan.originalQuestion ? (
                  <small><b>Runnable investigation</b>{analysisBrief.rewrittenQuestion}</small>
                ) : null}
                {analysisReframe?.changed ? (
                  <div className="analysis-reframe-explanation">
                    <small><b>What changed</b>{analysisReframe.summary}</small>
                    <small><b>Why</b>{analysisReframe.reason}</small>
                  </div>
                ) : null}
              </div>

              {replanNotice ? (
                <div className="sister-follow-up-notice" role="status">
                  <strong>{phase === "saved" ? "Saved packet restored" : "Plan updated"}</strong>
                  <p>{replanNotice}</p>
                </div>
              ) : null}

              {reviewablePacket && packetAction ? (
                <section className="decision-answer-summary" data-result-priority="answer-to-goal" aria-labelledby="decision-answer-title">
                  <div className="section-label">Answer</div>
                  <h2 id="decision-answer-title">{selectedLead?.title ?? workspaceHeading(plan, investigation)}</h2>
                  <p>{selectedLead?.businessMeaning ?? reviewablePacket.finalAnswer.strongestSupportedConclusion}</p>
                  {showsActionPackage ? (
                    <div className="decision-answer-next-step">
                      <span>Recommendation</span>
                      <strong>{insightActionPlan?.recommendation ?? packetAction.title}</strong>
                      <small>{insightActionPlan ? `${actionReadinessLabel(insightActionPlan.actionReadiness)} · ${insightActionPlan.confidence} confidence` : packetAction.nextStep}</small>
                    </div>
                  ) : null}
                  <div className="answer-production-status" aria-label="How this answer was produced">
                    <span><b>Question framing</b>{proposalMethodLabel(plan.proposalMethod)}</span>
                    <span><b>Evidence analysis</b>{evidenceExecution?.agenticLifecycle ? `${evidenceExecution.agenticLifecycle.passes.length} checked pass${evidenceExecution.agenticLifecycle.passes.length === 1 ? "" : "es"}` : "Deterministic approved snapshot"}</span>
                    <span><b>National signals</b>{plan.geographyResolution.mode === "national" ? `${investigation?.leads.length ?? 0} returned` : `${investigation?.leads.length ?? 0} relevant finding${investigation?.leads.length === 1 ? "" : "s"}`}</span>
                    <span><b>Final narrative</b>{packetSummaryState === "loading" ? "AI synthesis in progress" : packetSummary?.origin === "ai" ? "AI-written from checked evidence" : "Deterministic evidence-grounded fallback"}</span>
                  </div>
                  {packetSummaryState === "loading" ? (
                    <p className="answer-ai-synthesis" role="status">The evidence answer is ready. AI is now writing the plain-language synthesis from the checked packet.</p>
                  ) : packetSummary ? (
                    <div className="answer-ai-synthesis" data-origin={packetSummary.origin}>
                      <strong>{packetSummary.origin === "ai" ? "AI synthesis" : "Evidence-grounded synthesis"}</strong>
                      <p>{packetSummary.summary}</p>
                      <small>{packetSummary.origin === "ai"
                        ? `${packetSummary.modelVersion ?? "configured model"} · grounded to the validated packet`
                        : packetSummary.state === "validation_rejected"
                          ? "AI draft did not pass evidence checks · verified synthesis shown"
                          : packetSummary.state === "not_configured"
                            ? "AI synthesis is not configured here · verified synthesis shown"
                            : "AI synthesis was unavailable · verified synthesis shown"}</small>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {displayedGeographicFocus && evidenceExecution?.query !== "clinic_performance_bundle" ? (
                <div className="decision-map-answer-layout">
                  <div className="decision-result-map-shell">
                    <GeographicFocusMap
                      focus={displayedGeographicFocus}
                      modeLabel={geographyModeLabel(plan)}
                      contextMetric={selectedContextMetric}
                      measureOrigin={plan.evidenceSelection.datasetId || plan.intent.requestedMeasure !== "none" ? "Confirmed question measure" : "Supporting context measure"}
                      findings={investigation?.leads ?? []}
                      selectedLeadId={selectedLeadId}
                      onSelectFinding={(lead: InvestigationLead) => setSelectedLeadId(lead.id)}
                      questionContext={`Original question: ${plan.originalQuestion} Analyst-framed question: ${analysisBrief?.rewrittenQuestion ?? plan.originalQuestion}`}
                      sourceIds={investigation?.sourceIds ?? ["SRC-016"]}
                      workspaceDatasetId={plan.evidenceSelection.datasetId === "marketing_paid_search_cpc" && investigation?.leads.some((lead) => lead.supportingMeasures?.some((item) => item.id === "cost_per_conversion"))
                        ? "marketing_paid_search_cost_per_conversion"
                        : plan.evidenceSelection.datasetId}
                      evidenceStage={investigation?.evidenceStage}
                    />
                  </div>
                  <aside className="selected-finding-summary" aria-label={showsActionPackage ? "Selected finding and action readiness" : "Selected finding and answer boundary"}>
                    <div className="section-label">Selected market signal</div>
                    <h3>{selectedLead?.title ?? "Select a highlighted market"}</h3>
                    <p>{selectedLead?.businessMeaning ?? "Choose a finding on the map to connect the geography to its supporting signal."}</p>
                    <dl>
                      <div><dt>Evidence detail</dt><dd>{selectedLead?.observation ?? "Select a finding to review its supporting evidence."}</dd></div>
                      <div><dt>Evidence strength</dt><dd>{selectedLead?.strength ?? "No finding selected"}</dd></div>
                      <div><dt>What could change this</dt><dd>{selectedLead?.challenge ?? "Select a finding to review its main challenge."}</dd></div>
                      <div>
                        <dt>{showsActionPackage ? "Action readiness" : "Answer boundary"}</dt>
                        <dd>{showsActionPackage
                          ? packetAction?.requiresApproval ? "Analyst validation ready; material action still requires review" : "Ready for the named analyst validation step"
                          : plan.answerContract.strongestPermittedConclusion}</dd>
                      </div>
                    </dl>
                  </aside>
                </div>
              ) : null}

              {showsActionPackage && insightActionPlan ? (
                <InsightActionPlanPanel actionPlan={insightActionPlan} />
              ) : showsActionPackage && packetAction ? (
                <section className="owned-action-plan" aria-labelledby="owned-action-plan-title">
                  <div className="section-label">Owned next step</div>
                  <h2 id="owned-action-plan-title">{insightActionPlan?.recommendation ?? packetAction.title}</h2>
                  <div className="owned-action-plan-meta">
                    <span><b>Owner</b>{insightActionPlan?.decisionOwner ?? packetAction.owner}</span>
                    <span><b>Timing</b>{insightActionPlan?.decisionDueDate ?? packetAction.timing}</span>
                    <span><b>Done next</b>{packetAction.nextStep}</span>
                  </div>
                </section>
              ) : null}

              {evidenceExecution ? <AnswerEvidenceTrail plan={effectivePlan ?? plan} result={evidenceExecution} readiness={sourceReadiness} /> : null}

              <details className="decision-analysis-details">
                <summary>How this answer was built</summary>
                <div className="decision-analysis-details-body">

              {evidenceExecution?.agenticLifecycle ? (
                <AgenticRunSummary
                  lifecycle={evidenceExecution.agenticLifecycle}
                  selectedActionId={selectedActionId}
                  actions={actionOptions.map((action) => ({ id: action.id, title: action.title }))}
                />
              ) : null}

              {evidenceExecution ? (
                <EvidenceBundlePanel result={evidenceExecution} action={selectedAction} answer={reviewablePacket?.packetAnswer} />
              ) : (
                <div className="packet-missing-gates" role="status">
                  <small>The registered evidence bundle is unavailable. The validated plan remains visible, but no snapshot result is being represented as complete.</small>
                </div>
              )}

              {investigation ? (
                <>
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
                  <RecommendationRevisionBar
                    recommendedPrompt={recommendedInvestigationRevision(investigation)}
                    onRevise={reviseRecommendation}
                    outputKind={showsActionPackage ? "recommendation" : "result"}
                  />
                </>
              ) : null}

              {reviewablePacket ? (
                <div className="goal-first-answer answer-contract-details">
                  <AnswerCoveragePanel
                    coverage={reviewablePacket.answerCoverage}
                    answer={reviewablePacket.finalAnswer}
                    evaluation={reviewablePacket.answerEvaluation}
                  />
                </div>
              ) : null}

                </div>
              </details>

              {showsActionPackage ? <div className="decision-review-primary">
                <div className="decision-review-side">
                  <div className="action-packet-card">
                    <p className="action-packet-governance-note">
                      Draft for accountable review. This packet does not approve a market, site, lease, or spend decision.
                    </p>
                    {validationWorkplan ? (
                      <>
                        <ValidationWorkplanPanel workplan={validationWorkplan} />
                        <section
                          className="packet-findings"
                          aria-labelledby="findings-summary-title"
                          data-summary-state={packetSummaryState}
                        >
                          <div className="section-label" id="findings-summary-title">Findings and proposed action</div>
                          {packetSummary ? (
                            <>
                              <p className="packet-ai-summary-notice">{packetSummary.draftOnlyNotice}</p>
                              <p className="packet-ai-summary-blurb">{packetSummary.summary}</p>
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
                    ) : insightActionPlan ? (
                      null
                    ) : (
                      <>
                        <div className="section-label">Action packet</div>
                        <h2>{packetAction.title}</h2>
                        <p>{packetAction.summary}</p>
                        <section
                          className="packet-findings"
                          aria-labelledby="findings-summary-title"
                          data-summary-state={packetSummaryState}
                        >
                          <div className="section-label" id="findings-summary-title">Findings and proposed action</div>
                          {packetSummary ? (
                            <>
                              <p className="packet-ai-summary-notice">{packetSummary.draftOnlyNotice}</p>
                              <p className="packet-ai-summary-blurb">{packetSummary.summary}</p>
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
                        {plan.capabilityId === "clinic_site_evaluation" && clinicWorkflow ? (
                          <section className="packet-evidence clinic-retrieval-panel" aria-label="Clinic evidence retrieval">
                            <div className="section-label">Retrieved clinic evidence</div>
                            <p>
                              {clinicWorkflow.supportedFindings[0] ?? "No registered clinic evidence was returned."}
                            </p>
                            {clinicWorkflow.missingEvidence.length ? (
                              <p><strong>Still needed:</strong> {clinicWorkflow.missingEvidence.join("; ")}</p>
                            ) : null}
                            <div className="packet-evidence">
                              <strong>Next research steps</strong>
                              {clinicWorkflow.nextResearchSteps.map((step) => (
                                <span key={step.id}><i>{step.priority === "next" ? "→" : "·"}</i>{step.title}</span>
                              ))}
                            </div>
                          </section>
                        ) : null}
                      </>
                    )}

                    {!insightActionPlan && !validationWorkplan ? <details
                      className="packet-action-details"
                      open={actionDetailsOpen}
                      onToggle={(event) => setActionDetailsOpen(event.currentTarget.open)}
                    >
                      <summary>Action details</summary>
                      <dl>
                        <div><dt>Owner</dt><dd>{packetAction.owner}</dd></div>
                        <div><dt>Timing</dt><dd>{packetAction.timing}</dd></div>
                        <div><dt>Confidence</dt><dd><span className={`confidence ${packetAction.confidence.toLowerCase()}`}>{packetAction.confidence}</span></dd></div>
                        <div><dt>Next step</dt><dd>{packetAction.nextStep}</dd></div>
                      </dl>
                      <div className="packet-evidence">
                        <strong>Evidence considered</strong>
                        {packetAction.evidence.map((item) => (
                          <span key={item}><i aria-hidden="true">✓</i>{item}</span>
                        ))}
                      </div>
                      <div className="packet-evidence tradeoffs">
                        <strong>Tradeoffs to review</strong>
                        {packetAction.tradeoffs.map((item) => (
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
                          className="primary-action"
                          type="button"
                          onClick={() => {
                            if (reviewablePacket) void downloadDecisionBrief(reviewablePacket);
                          }}
                        >
                          Download Word decision brief
                        </button>
                        <button
                          className="secondary-action"
                          type="button"
                          onClick={() => {
                            if (reviewablePacket) void downloadReviewableActionPacket(reviewablePacket);
                          }}
                        >
                          Download Word audit appendix
                        </button>
                        <button className="secondary-action" onClick={savePacket}>
                          {phase === "saved" ? "Saved" : "Save action packet"} <span aria-hidden="true">✓</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div> : reviewablePacket ? (
                <section className="result-delivery-card" aria-label="Result actions">
                  <div>
                    <div className="section-label">Result record</div>
                    <strong>Keep or share this evidence-backed result</strong>
                    <p>The result preserves the answer, sources, limitations, and investigation trail without turning it into an action recommendation.</p>
                  </div>
                  <div className="packet-card-actions">
                    <button className="primary-action" type="button" onClick={() => void downloadDecisionBrief(reviewablePacket)}>
                      Download Word result brief
                    </button>
                    <button className="secondary-action" type="button" onClick={() => void downloadReviewableActionPacket(reviewablePacket)}>
                      Download Word audit appendix
                    </button>
                    <button className="secondary-action" onClick={savePacket}>
                      {phase === "saved" ? "Saved" : "Save result"} <span aria-hidden="true">✓</span>
                    </button>
                  </div>
                </section>
              ) : null}

              {reviewablePacket ? <ResultOutputBuilder packet={reviewablePacket} /> : null}
              {reviewablePacket ? <EmailBriefControl packet={reviewablePacket} /> : null}

              <SisterGeographiesSection
                suggestions={sisterGeographies}
                onAskAbout={askAboutSisterGeography}
              />

              <div className="packet-disclosure">
                <span>{showsActionPackage ? "Decision record" : "Result record"}</span>
                <p>
                  {showsActionPackage
                    ? "This action package contains findings, evidence boundaries, and proposed next actions. It is not a final real-estate or business decision."
                    : "This result contains findings, evidence boundaries, and source-linked analysis. It does not imply a business action that was not asked for."}
                  {" "}Saved items remain in this browser for this workspace. Downloading does not approve or send anything externally.
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
