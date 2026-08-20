import type {
  EvidenceExecutionResponse,
  ExecutionEvidenceItem,
} from "../evidence-snapshot/contracts.ts";
import type { EvaluationPlan } from "./contracts.ts";
import { reconcileEvidenceCompatibility } from "./evidence-compatibility.ts";
import { goldenMarketInvestigationFromEvidence } from "./golden-market-investigation.ts";
import {
  restrictInvestigationToRequestedGeography,
  type InvestigationLead,
  type MarketInvestigation,
} from "./market-investigation.ts";

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim()))];
}

function formattedValue(item: ExecutionEvidenceItem) {
  if (item.rawValue === null) return "reported without a numeric value";
  const value = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(item.rawValue);
  return `${value} ${item.unit.replaceAll("_", " ")}`;
}

function evidencePeriod(response: EvidenceExecutionResponse) {
  const periods = unique(response.evidenceBundle.map((item) => item.period.label));
  if (!periods.length) return "Period not provided";
  if (periods.length <= 3) return periods.join("; ");
  return `${periods.slice(0, 3).join("; ")} and ${periods.length - 3} additional recorded period(s)`;
}

function geographyGroups(response: EvidenceExecutionResponse) {
  const groups = new Map<string, ExecutionEvidenceItem[]>();
  for (const item of response.evidenceBundle) {
    const key = item.geographyId ?? `unresolved:${item.geographyLabel}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 10);
}

function leadForEvidenceGroup(
  plan: EvaluationPlan,
  response: EvidenceExecutionResponse,
  key: string,
  items: ExecutionEvidenceItem[],
  index: number,
): InvestigationLead {
  const label = items[0]?.geographyLabel || key.replace(/^cbsa:/, "");
  const sources = unique(items.map((item) => item.sourceId));
  const observations = items.slice(0, 6).map((item) => {
    const metric = item.metricId.replace(/^normalized\./, "").replaceAll("_", " ");
    return `${metric}: ${formattedValue(item)} (${item.period.label}; ${item.sourceId}; ${item.evidenceStatus})`;
  });
  const warnings = unique(items.flatMap((item) => item.warning ? [item.warning] : []));
  const unresolved = unique([...warnings, ...response.qualityWarnings, ...response.unknowns]);
  const nextEvidence = unique([...response.missingEvidence, ...plan.missingEvidence]);
  const sourceFamilyLabel = plan.intent.sourceFamilies.length
    ? plan.intent.sourceFamilies.map((family) => family.replaceAll("_", " ")).join(", ")
    : "registered";
  return {
    id: `registered-evidence-${index + 1}-${key.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`,
    marketIds: [key.replace(/^cbsa:/, "")],
    title: `${label} has source-linked ${sourceFamilyLabel} evidence to reconcile`,
    observation: observations.join("; "),
    businessMeaning: plan.intent.topic === "multi_source_evidence"
      ? "These registered observations can support a bounded cross-source investigation. Different grains, periods, definitions, and geography quality must be reconciled before treating the pattern as a combined business finding."
      : "These registered observations answer the available descriptive portion of the question. They do not by themselves establish causality, opportunity, or authority for a material action.",
    method: `Executed ${response.componentQueries.join(", ") || response.query} without imputing missing values or merging incompatible source semantics.`,
    sampleSize: items.length,
    strength: `${items.length} structured observation${items.length === 1 ? "" : "s"} from ${sources.length} source${sources.length === 1 ? "" : "s"}`,
    challenge: unresolved[0] ?? "The evidence may differ in period, grain, definition, or allowed use and requires accountable interpretation.",
    nextEvidence: nextEvidence[0] ?? "Confirm source compatibility, business outcome relevance, and the accountable review boundary before acting.",
  };
}

/**
 * Converts every successful registered evidence execution into the same
 * investigation contract used by coverage, answer composition, saving, and UI.
 * Golden-question evidence keeps its richer reviewed specialization.
 */
export function marketInvestigationFromEvidence(
  plan: EvaluationPlan,
  response: EvidenceExecutionResponse,
): MarketInvestigation | null {
  if (response.planId !== plan.planId || response.originalQuestion !== plan.originalQuestion) {
    throw new Error("The evidence execution does not belong to this evaluation plan.");
  }
  const golden = goldenMarketInvestigationFromEvidence(plan, response);
  if (golden) return restrictInvestigationToRequestedGeography(plan, golden);
  if (["blocked", "failed"].includes(response.status) || !response.evidenceBundle.length || !response.sourceIds.length) return null;

  const requestedCodes = new Set(plan.geographyResolution.selectedCbsaCodes);
  const groups = geographyGroups(response).filter(([key]) =>
    requestedCodes.size === 0 || requestedCodes.has(key.replace(/^cbsa:/, "")),
  );
  if (requestedCodes.size && !groups.length) return null;
  const leads = groups.map(([key, items], index) => leadForEvidenceGroup(plan, response, key, items, index));
  const reconciliation = reconcileEvidenceCompatibility(response.evidenceBundle, {
    operation: plan.intent.sourceFamilies.length > 1 ? "join" : "compare",
    // No crosswalk is silently assumed. Approved crosswalk metadata must be
    // attached by a future source contract before unlike geographies combine.
    crosswalks: [],
    missingEvidence: [...response.missingEvidence, ...response.unknowns],
  });
  const reconciliationGaps = reconciliation.issues
    .filter((item) => item.severity === "error")
    .map((item) => item.message);
  const evidenceNeeded = unique([
    ...response.missingEvidence,
    ...response.unknowns,
    ...plan.missingEvidence,
    ...plan.missingApprovals,
    ...reconciliationGaps,
  ]);
  const hasUnmetEvidence = evidenceNeeded.length > 0 || response.status !== "complete";
  const querySteps = response.componentQueries.length ? response.componentQueries : [response.query];

  return restrictInvestigationToRequestedGeography(plan, {
    version: "1.0.0",
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    perspectiveId: plan.perspectiveId,
    geography: "CBSA",
    period: evidencePeriod(response),
    dataSnapshotLabel: `Registered ${response.query.replaceAll("_", " ")} evidence`,
    dataSnapshotVersion: response.snapshotVersion,
    readiness: {
      label: hasUnmetEvidence ? "Partial answer" : "Context only",
      summary: `${response.evidenceBundle.length} structured observation${response.evidenceBundle.length === 1 ? "" : "s"} from ${response.sourceIds.length} registered source${response.sourceIds.length === 1 ? "" : "s"} produced ${leads.length} bounded investigation lead${leads.length === 1 ? "" : "s"}. ${hasUnmetEvidence ? "Unmet evidence and compatibility checks remain explicit." : "The result remains descriptive context for accountable review."}`,
      missing: evidenceNeeded,
    },
    toolsRun: querySteps.map((query) => `Run registered query ${query}`),
    measuresExamined: unique(response.evidenceBundle.map((item) => item.metricId)),
    comparisonsExamined: groups.length,
    screeningScope: {
      marketUniverse: groups.length,
      eligibleCohort: response.geographyIds.length
        ? `The ${response.geographyIds.length} geography scope validated by the evaluation plan`
        : "The registered execution scope returned by the evidence service",
      eligibleComparisons: groups.length,
      allMarketPairs: groups.length > 1 ? groups.length * (groups.length - 1) / 2 : 0,
      selectionRule: "Retain source-linked observations returned by the plan's registered queries; do not impute missing values or create a cross-source score.",
      executionMode: "deterministic_local_snapshot",
    },
    leads,
    rejectedPatterns: unique([
      ...response.unknowns.map((item) => `Unresolved interpretation: ${item}`),
      "Do not convert descriptive multi-source observations into a causal conclusion or material-action recommendation.",
    ]),
    limitations: unique([
      ...response.qualityWarnings,
      ...response.unknowns,
      ...response.guardrails,
      ...reconciliation.issues.map((item) => item.message),
    ]),
    sourceIds: response.sourceIds,
    allowedUse: "internal_shadow_evaluation_only",
    scoringEligibility: "none",
    evidenceStage: "signal",
    reconciliation,
    nextPass: {
      status: hasUnmetEvidence ? "waiting_for_evidence" : "ready_to_run",
      question: hasUnmetEvidence
        ? "What compatible business outcome, geography, period, or approval evidence is still required to answer the confirmed goal?"
        : "Does accountable review confirm that this descriptive answer addresses the confirmed goal within its evidence boundary?",
      evidenceNeeded: evidenceNeeded.length
        ? evidenceNeeded
        : ["Accountable review of source compatibility, conclusion boundary, and permitted next action."],
      completionRule: "Advance only when every required answer criterion is supported or explicitly dispositioned and the conclusion remains within the validated decision boundary.",
    },
    investigationPath: [
      ...querySteps.map((query) => ({
        id: `execute-${query.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
        label: `Investigate ${query.replaceAll("_", " ")}`,
        purpose: "Retrieve the source through the registered deterministic evidence contract.",
        contributionToAnswer: `Added source-linked observations for ${plan.originalQuestion}`,
        status: "completed" as const,
        sourceIds: response.sourceIds,
        result: `The registered query completed inside ${response.snapshotVersion}.`,
      })),
      {
        id: "reconcile-registered-evidence",
        label: "Reconcile evidence against the question",
        purpose: "Keep source periods, grains, evidence status, and incompatible semantics visible before synthesis.",
        contributionToAnswer: `${leads.length} bounded lead${leads.length === 1 ? "" : "s"} retained without a cross-source score.`,
        status: reconciliation.canCombine ? "completed" : "waiting_for_evidence",
        sourceIds: response.sourceIds,
        result: reconciliation.canCombine
          ? `${response.evidenceBundle.length} structured observations were reconciled with ${reconciliation.summary.warningCount} visible warning(s).`
          : `${reconciliation.summary.errorCount} compatibility error(s) keep unlike evidence separate; the investigation remains available as source-specific leads.`,
      },
      {
        id: "check-goal-completion",
        label: "Check the answer against the confirmed goal",
        purpose: "Evaluate the answer contract and preserve every unmet completion criterion.",
        contributionToAnswer: hasUnmetEvidence ? "Keeps the result partial and identifies the bounded next research pass." : "Routes the descriptive answer to accountable review.",
        status: hasUnmetEvidence ? "waiting_for_evidence" : "completed",
        sourceIds: response.sourceIds,
        result: hasUnmetEvidence ? `${evidenceNeeded.length} evidence, compatibility, or approval gap(s) remain.` : "No execution-level evidence gap was reported; accountable review remains required.",
      },
    ],
  });
}
