import {
  evidenceExecutionResponseSchema,
  type AgenticEvidenceLifecycle,
  type EvidenceExecutionResponse,
  type ExecutionEvidenceItem,
} from "../evidence-snapshot/contracts.ts";
import { z } from "zod";
import type { EvaluationPlan, PlanningIntent } from "./contracts.ts";
import { evaluateAnswerCompletion } from "./answer-evaluation.ts";
import { executeEvaluationPlanEvidence, type PlanExecutionOptions } from "./execute-plan.ts";
import { marketInvestigationFromEvidence } from "./evidence-market-investigation.ts";
import { composeFinalAnswer } from "./final-answer-composer.ts";
import { checkInvestigationCoverage } from "./investigation-coverage.ts";
import {
  adaptPlanForUsedSources,
  buildSourceAdaptationReadiness,
  type DynamicSourceConsideration,
} from "./source-adaptation.ts";

export const AGENTIC_EVIDENCE_LOOP_VERSION = "agentic-evidence-loop-v1" as const;
export const DEFAULT_AGENTIC_MAX_ITERATIONS = 3;

type RegisteredQuery = PlanningIntent["selectedQueries"][number];

export const vettedDynamicResearchPassSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{1,79}$/),
  label: z.string().trim().min(3).max(160),
  sourceFamily: z.enum(["census", "regional", "clinic", "google_ads", "consumer_insights", "pricing", "other"]),
  sourceIds: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  relevanceScore: z.number().int().min(0).max(100),
  addressesCriterionIds: z.array(z.string().trim().min(1).max(100)).max(12),
  dedupeKey: z.string().trim().min(1).max(120),
  compatibilityStatus: z.enum(["compatible", "compatible_with_limits"]),
  allowedUse: z.enum(["internal_decision_support", "internal_shadow_evaluation", "synthetic_prototype"]),
  vetted: z.literal(true),
  browserSafeAggregateOnly: z.literal(true),
  executesMaterialAction: z.literal(false),
}).strict();

export type VettedDynamicResearchPass = z.infer<typeof vettedDynamicResearchPassSchema>;

export type AgenticEvidenceLoopOptions = PlanExecutionOptions & {
  maxIterations?: number;
  now?: () => string;
  executePass?: (input: { requestId: string; plan: EvaluationPlan }, options: PlanExecutionOptions) => Promise<EvidenceExecutionResponse>;
  candidateResearchPasses?: readonly VettedDynamicResearchPass[];
  executeCandidatePass?: (
    candidate: VettedDynamicResearchPass,
    input: { requestId: string; plan: EvaluationPlan },
    options: PlanExecutionOptions,
  ) => Promise<EvidenceExecutionResponse>;
  sourceConsiderations?: readonly DynamicSourceConsideration[];
  dynamicRegistryVersion?: string;
  dynamicRegistryFingerprint?: string;
};

const QUERY_FAMILY: Record<RegisteredQuery, PlanningIntent["sourceFamilies"][number] | "coverage"> = {
  supported_regions: "coverage",
  regional_context_by_cbsa: "regional",
  clinic_context_by_cbsa: "clinic",
  google_ads_context_by_cbsa: "google_ads",
  normalization_coverage: "coverage",
  growth_test_screening: "coverage",
  consumer_insights_by_cbsa: "consumer_insights",
  brand_funnel_by_cbsa: "consumer_insights",
  brand_relevance_drivers_by_cbsa: "consumer_insights",
  brand_health_by_cbsa: "consumer_insights",
};

type ResearchPassSpec = {
  kind: "registered";
  id: string;
  dedupeKey: string;
  rank: number;
  selectedQueries: RegisteredQuery[];
} | {
  kind: "dynamic";
  id: string;
  dedupeKey: string;
  rank: number;
  candidate: VettedDynamicResearchPass;
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

/** Selects only sources already registered on the validated plan. */
export function rankCompatibleResearchQueries(plan: EvaluationPlan): RegisteredQuery[] {
  const familyPriority: Array<PlanningIntent["sourceFamilies"][number] | "coverage"> = plan.perspectiveId === "marketing"
    ? ["google_ads", "regional", "clinic", "consumer_insights", "census", "coverage"]
    : plan.perspectiveId === "cvc"
      ? ["clinic", "regional", "census", "google_ads", "consumer_insights", "coverage"]
      : ["regional", "consumer_insights", "google_ads", "clinic", "census", "coverage"];
  const familyRank = new Map(familyPriority.map((family, index) => [family, index]));
  return [...plan.intent.selectedQueries]
    .sort((left, right) => (familyRank.get(QUERY_FAMILY[left]) ?? 99) - (familyRank.get(QUERY_FAMILY[right]) ?? 99)
      || plan.intent.selectedQueries.indexOf(left) - plan.intent.selectedQueries.indexOf(right));
}

function planForQueries(plan: EvaluationPlan, selectedQueries: RegisteredQuery[]): EvaluationPlan {
  return {
    ...plan,
    intent: {
      ...plan.intent,
      selectedQueries,
      sourceFamilies: unique(selectedQueries
        .map((query) => QUERY_FAMILY[query])
        .filter((family): family is PlanningIntent["sourceFamilies"][number] => family !== "coverage" && family !== "census")),
    },
  };
}

function mergeEvidenceItems(responses: EvidenceExecutionResponse[]): ExecutionEvidenceItem[] {
  const byId = new Map<string, ExecutionEvidenceItem>();
  for (const response of responses) {
    for (const item of response.evidenceBundle) if (!byId.has(item.evidenceId)) byId.set(item.evidenceId, item);
  }
  return [...byId.values()];
}

function mergeRows(responses: EvidenceExecutionResponse[]) {
  const seen = new Set<string>();
  return responses.flatMap((response) => response.rows).filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergePassResponses(plan: EvaluationPlan, requestId: string, responses: EvidenceExecutionResponse[]): EvidenceExecutionResponse {
  const successful = responses.filter((response) => !["blocked", "failed"].includes(response.status));
  const base = successful[0] ?? responses[responses.length - 1];
  if (!base) throw new Error("The agentic evidence loop produced no execution response.");
  const evidenceBundle = mergeEvidenceItems(successful);
  const failed = responses.find((response) => response.status === "failed");
  const status: EvidenceExecutionResponse["status"] = evidenceBundle.length
    ? responses.every((response) => response.status === "complete") ? "complete" : "partial"
    : failed ? "failed" : "blocked";
  const mergedQuery: EvidenceExecutionResponse["query"] = plan.intent.topic === "clinic_location"
    ? "clinic_location_evidence_bundle"
    : plan.intent.topic === "consumer_insights"
      ? "consumer_insights_bundle"
      : plan.intent.topic === "source_coverage"
        ? "source_coverage_bundle"
        : plan.intent.topic === "growth_test_screening"
          ? "growth_test_screening_bundle"
          : plan.intent.topic === "multi_market_comparison"
            ? "multi_market_comparison_bundle"
            : plan.intent.selectedQueries.length
              ? "normalized_evidence_bundle"
              : base.query;
  return evidenceExecutionResponseSchema.parse({
    ...base,
    requestId,
    status,
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    query: mergedQuery,
    componentQueries: unique(successful.flatMap((response) => response.componentQueries)),
    geographyIds: unique(successful.flatMap((response) => response.geographyIds)),
    rows: mergeRows(successful),
    evidenceBundle,
    sourceIds: unique(successful.flatMap((response) => response.sourceIds)),
    qualityWarnings: unique(responses.flatMap((response) => response.qualityWarnings)),
    missingEvidence: unique(responses.flatMap((response) => response.missingEvidence)),
    missingApprovals: unique(responses.flatMap((response) => response.missingApprovals)),
    unknowns: unique(responses.flatMap((response) => response.unknowns)),
    guardrails: unique(responses.flatMap((response) => response.guardrails)),
    errorCode: status === "failed" ? failed?.errorCode ?? "AGENTIC_EXECUTION_FAILED" : null,
    errorMessage: status === "failed" ? failed?.errorMessage ?? "Every bounded evidence pass failed." : null,
    agenticLifecycle: undefined,
  });
}

function isSingleBundlePlan(plan: EvaluationPlan) {
  return plan.intent.selectedQueries.length <= 1
    || ["source_coverage", "growth_test_screening", "multi_market_comparison"].includes(plan.intent.topic)
    || plan.planId.startsWith("plan-demo-");
}

function rankedResearchPasses(
  plan: EvaluationPlan,
  rankedQueries: RegisteredQuery[],
  candidates: readonly VettedDynamicResearchPass[],
): ResearchPassSpec[] {
  const registered: ResearchPassSpec[] = isSingleBundlePlan(plan)
    ? [{ kind: "registered", id: "registered-plan-bundle", dedupeKey: "registered-plan-bundle", rank: 80, selectedQueries: rankedQueries }]
    : rankedQueries.map((query, index) => ({
        kind: "registered" as const,
        id: `registered-${query}`,
        dedupeKey: `registered:${query}`,
        rank: 80 - index,
        selectedQueries: [query],
      }));
  if (!registered.length) registered.push({ kind: "registered", id: "registered-plan-bundle", dedupeKey: "registered-plan-bundle", rank: 80, selectedQueries: [] });

  const dynamic = candidates.map((raw) => {
    const candidate = vettedDynamicResearchPassSchema.parse(raw);
    return {
      kind: "dynamic" as const,
      id: `dynamic-${candidate.id}`,
      dedupeKey: candidate.dedupeKey,
      rank: candidate.relevanceScore,
      candidate,
    };
  });
  const ranked = [...registered, ...dynamic].sort((left, right) => right.rank - left.rank
    || (left.kind === right.kind ? 0 : left.kind === "registered" ? -1 : 1)
    || left.id.localeCompare(right.id));
  const seen = new Set<string>();
  return ranked.filter((pass) => {
    if (seen.has(pass.dedupeKey)) return false;
    seen.add(pass.dedupeKey);
    return true;
  });
}

/**
 * Runs a bounded research loop over compatible queries already approved by the
 * plan. It never discovers external sources, changes scoring, or performs a
 * material action.
 */
export async function executeAgenticEvidenceLoop(
  input: { requestId: string; plan: EvaluationPlan },
  options: AgenticEvidenceLoopOptions = {},
): Promise<EvidenceExecutionResponse> {
  const { requestId, plan } = input;
  const maxIterations = Math.max(1, Math.min(5, options.maxIterations ?? DEFAULT_AGENTIC_MAX_ITERATIONS));
  const now = options.now ?? (() => new Date().toISOString());
  const executePass = options.executePass ?? executeEvaluationPlanEvidence;
  const rankedQueries = rankCompatibleResearchQueries(plan);
  const candidateResearchPasses = options.executeCandidatePass ? options.candidateResearchPasses ?? [] : [];
  const researchPasses = rankedResearchPasses(plan, rankedQueries, candidateResearchPasses);

  const responses: EvidenceExecutionResponse[] = [];
  const passReceipts: AgenticEvidenceLifecycle["passes"] = [];
  const exhaustedQueries: string[] = [];
  const seenEvidence = new Set<string>();
  const usedCandidateEvidence = new Map<string, string[]>();
  let finalAnswerStatus: AgenticEvidenceLifecycle["finalAnswerStatus"] = "fail";
  let stopStatus: AgenticEvidenceLifecycle["status"] = "best_available_answer";
  let stopReason = "Every compatible registered source was investigated; the best available answer retains unresolved criteria.";

  for (let index = 0; index < researchPasses.length && index < maxIterations; index += 1) {
    const researchPass = researchPasses[index];
    const selectedQueries = researchPass.kind === "registered" ? researchPass.selectedQueries : [];
    const passPlan = selectedQueries.length ? planForQueries(plan, selectedQueries) : plan;
    const startedAt = now();
    const passRequest = { requestId: `${requestId}:pass-${index + 1}`, plan: passPlan };
    const response = evidenceExecutionResponseSchema.parse(researchPass.kind === "dynamic"
      ? await options.executeCandidatePass!(researchPass.candidate, passRequest, options)
      : await executePass(passRequest, options));
    if (researchPass.kind === "dynamic") {
      const declaredSources = new Set(researchPass.candidate.sourceIds);
      if (response.sourceIds.some((sourceId) => !declaredSources.has(sourceId))) {
        throw new Error(`Dynamic research pass ${researchPass.candidate.id} returned an undeclared source.`);
      }
    }
    responses.push(response);
    if (researchPass.kind === "dynamic") exhaustedQueries.push(`dynamic:${researchPass.candidate.id}`);
    else exhaustedQueries.push(...selectedQueries);
    const newEvidence = response.evidenceBundle.filter((item) => !seenEvidence.has(item.evidenceId));
    newEvidence.forEach((item) => seenEvidence.add(item.evidenceId));
    if (researchPass.kind === "dynamic" && newEvidence.length) usedCandidateEvidence.set(researchPass.candidate.id, newEvidence.map((item) => item.evidenceId));
    const usedConsiderations = (options.sourceConsiderations ?? []).filter((item) => usedCandidateEvidence.has(item.candidateId));
    const adaptedPlan = adaptPlanForUsedSources(plan, usedConsiderations);
    const merged = mergePassResponses(adaptedPlan, requestId, responses);
    const investigation = marketInvestigationFromEvidence(adaptedPlan, merged) ?? undefined;
    const coverage = checkInvestigationCoverage(adaptedPlan, investigation);
    const composed = composeFinalAnswer(adaptedPlan, investigation, adaptedPlan.actions[0], coverage);
    const evaluation = evaluateAnswerCompletion(adaptedPlan, investigation, coverage);
    finalAnswerStatus = evaluation.overallStatus;
    passReceipts.push({
      passId: `${requestId}:pass-${index + 1}`,
      iteration: index + 1,
      selectedQueries: researchPass.kind === "dynamic"
        ? [`dynamic:${researchPass.candidate.id}`]
        : selectedQueries.length ? selectedQueries : [response.query],
      executionStatus: response.status,
      answerStatus: evaluation.overallStatus,
      composedAnswerStatus: composed.status,
      addedEvidenceCount: newEvidence.length,
      sourceIds: response.sourceIds,
      evidenceIds: newEvidence.map((item) => item.evidenceId),
      unmetCriterionIds: evaluation.unmetCriterionIds,
      startedAt,
      completedAt: now(),
    });

    if (evaluation.overallStatus === "pass") {
      stopStatus = "goal_satisfied";
      stopReason = "The composed answer passed every completion criterion in the confirmed answer contract.";
      break;
    }
    if (!newEvidence.length) {
      stopStatus = response.status === "failed" && !seenEvidence.size ? "execution_failed" : "no_useful_source";
      stopReason = response.status === "failed"
        ? "The bounded registered-source pass failed and produced no usable evidence."
        : "The next compatible registered source added no new evidence, so further repetition would not improve the answer.";
      break;
    }
    if (index + 1 === maxIterations && researchPasses.length > maxIterations) {
      stopStatus = "max_iterations";
      stopReason = `The deterministic ${maxIterations}-pass safety limit was reached before every answer criterion passed.`;
    }
  }

  const usedConsiderations = (options.sourceConsiderations ?? []).filter((item) => usedCandidateEvidence.has(item.candidateId));
  const adaptedPlan = adaptPlanForUsedSources(plan, usedConsiderations);
  const merged = mergePassResponses(adaptedPlan, requestId, responses);
  const finalInvestigation = marketInvestigationFromEvidence(adaptedPlan, merged) ?? undefined;
  const finalCoverage = checkInvestigationCoverage(adaptedPlan, finalInvestigation);
  const finalEvaluation = evaluateAnswerCompletion(adaptedPlan, finalInvestigation, finalCoverage);
  finalAnswerStatus = finalEvaluation.overallStatus;
  const lifecycle: AgenticEvidenceLifecycle = {
    version: AGENTIC_EVIDENCE_LOOP_VERSION,
    runId: requestId,
    planId: plan.planId,
    contractId: plan.answerContract.contractId,
    goal: plan.originalQuestion,
    status: stopStatus,
    stopReason,
    maxIterations,
    candidateQueries: researchPasses.map((pass) => pass.kind === "dynamic" ? `dynamic:${pass.candidate.id}` : pass.selectedQueries).flat(),
    exhaustedQueries: unique(exhaustedQueries),
    finalAnswerStatus,
    passes: passReceipts,
  };
  const sourceAdaptation = options.dynamicRegistryVersion && options.dynamicRegistryFingerprint
    ? buildSourceAdaptationReadiness({
        plan,
        registryVersion: options.dynamicRegistryVersion,
        registryFingerprint: options.dynamicRegistryFingerprint,
        considerations: [...(options.sourceConsiderations ?? [])],
        usedCandidateEvidence,
        evaluation: finalEvaluation,
      })
    : undefined;
  return evidenceExecutionResponseSchema.parse({ ...merged, agenticLifecycle: lifecycle, sourceAdaptation });
}
