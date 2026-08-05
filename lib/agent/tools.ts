import { z } from "zod";
import {
  buildCandidateEvidenceBrief,
  buildCandidateEvidenceComparison,
  esriDemoManifest,
  esriFieldCatalog,
  esriPortfolioReadiness,
  esriSiteIdentities,
  esriSiteTradeAreaCrosswalk,
  esriTradeAreaProfiles,
} from "../esri-demo/index.ts";
import { publicMarkets } from "../data/public-market-ui.ts";
import {
  CURRENT_CLINIC_MARKET_IDS,
  INITIAL_MARKET_WORKFLOW_RECORDS,
  marketCategoryFor,
} from "../workflow/market-workflow.ts";
import { evaluateSite, type EvaluationInput, type ScoringConfiguration } from "../scoring.ts";
import {
  blockerSchema,
  evidenceReceiptSchema,
  humanDecisionRequestSchema,
  reviewArtifactSchema,
  type AgentBlocker,
  type AgentRun,
  type AgentToolName,
  type EvidenceReceipt,
} from "./contracts.ts";

const toolResultSchema = z.object({
  summary: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  receipt: evidenceReceiptSchema.nullable(),
  blockers: z.array(blockerSchema),
  humanDecision: humanDecisionRequestSchema.nullable(),
  artifact: reviewArtifactSchema.nullable(),
});
export type AgentToolResult = z.infer<typeof toolResultSchema>;

export type DeterministicEvaluationInput = {
  input: EvaluationInput;
  configuration: ScoringConfiguration;
};

type ToolContext = {
  now: () => string;
  deterministicEvaluation?: DeterministicEvaluationInput;
};

function commonBriefInput() {
  return {
    manifest: esriDemoManifest,
    fieldCatalog: esriFieldCatalog,
    sites: esriSiteIdentities,
    readiness: esriPortfolioReadiness,
    links: esriSiteTradeAreaCrosswalk,
    profiles: esriTradeAreaProfiles,
  };
}

function siteFor(run: AgentRun) {
  const site = esriSiteIdentities.find((item) => item.site_id === run.siteId);
  if (!site) throw new Error("The requested candidate is not in the approved fixture.");
  return site;
}

function selectedTradeAreaId(run: AgentRun) {
  const confirmed = [...run.reviewerResponses]
    .reverse()
    .find((item) => item.decision === "confirm" && item.selectedTradeAreaId);
  return confirmed?.selectedTradeAreaId ?? undefined;
}

function briefFor(run: AgentRun) {
  return buildCandidateEvidenceBrief({
    ...commonBriefInput(),
    siteId: run.siteId,
    tradeAreaId: selectedTradeAreaId(run),
  });
}

function receipt(
  run: AgentRun,
  toolName: AgentToolName,
  input: Omit<EvidenceReceipt, "receiptId" | "toolName" | "recordedAt">,
  now: string,
): EvidenceReceipt {
  return evidenceReceiptSchema.parse({
    receiptId: `${run.runId}-receipt-${run.evidenceReceipts.length + 1}`,
    toolName,
    recordedAt: now,
    ...input,
  });
}

function blocker(
  run: AgentRun,
  label: string,
  detail: string,
  sourceIds: string[],
  resolution: string,
): AgentBlocker {
  return blockerSchema.parse({
    blockerId: `${run.runId}-blocker-${run.unresolvedBlockers.length + 1}-${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}`,
    label,
    detail,
    sourceIds,
    resolution,
  });
}

function baseResult(summary: string, sourceIds: string[]): AgentToolResult {
  return { summary, sourceIds, receipt: null, blockers: [], humanDecision: null, artifact: null };
}

function readinessTool(run: AgentRun, now: string): AgentToolResult {
  const readiness = esriPortfolioReadiness.find((item) => item.site_id === run.siteId);
  if (!readiness) throw new Error("Candidate readiness is unavailable.");
  const result = baseResult(
    `Checked ${readiness.expected_evidence_count} required evidence fields. ${readiness.available_evidence_count} are available and ${readiness.issues.length} need attention.`,
    readiness.source_ids,
  );
  result.receipt = receipt(run, "get_candidate_readiness", {
    label: `${readiness.site_name} readiness`,
    sourceIds: readiness.source_ids,
    evidenceStatuses: ["Derived"],
    sensitivity: readiness.sensitivity,
    allowedUse: readiness.allowed_use,
    scoringEligibility: "none",
    snapshotVersions: [readiness.provenance.transformation_version],
  }, now);
  return result;
}

function evidenceTool(run: AgentRun, now: string): AgentToolResult {
  const brief = briefFor(run);
  const observations = brief.sections.flatMap((section) => section.observations);
  const sourceIds = [...new Set(observations.map((item) => item.source_id))];
  const result = baseResult(
    `Loaded ${observations.length} minimized observations across ${brief.sections.length} evidence sections. Restricted values remain redacted.`,
    sourceIds,
  );
  result.receipt = receipt(run, "get_candidate_evidence", {
    label: `${brief.site_label} candidate evidence`,
    sourceIds,
    evidenceStatuses: [...new Set(observations.map((item) => item.evidence_status))],
    sensitivity: "internal",
    allowedUse: brief.allowed_use,
    scoringEligibility: "none",
    snapshotVersions: brief.source_snapshot_versions,
  }, now);
  return result;
}

function marketTool(run: AgentRun, now: string): AgentToolResult {
  const site = siteFor(run);
  const market = site.cbsa_id
    ? publicMarkets.find((item) => item.cbsa_code === site.cbsa_id) ?? null
    : null;
  const result = baseResult(
    market
      ? `Loaded approved public context for ${market.cbsa_name}. It remains non-scored market context.`
      : "No stable parent market is available, so public market context was not attached.",
    market ? ["SRC-014", "SRC-015", "SRC-016"] : [site.source_id],
  );
  result.receipt = receipt(run, "get_market_context", {
    label: market ? `${market.cbsa_name} public market context` : "Parent market unavailable",
    sourceIds: result.sourceIds,
    evidenceStatuses: market ? ["Confirmed", "Derived"] : ["Unknown"],
    sensitivity: market ? "public" : "internal",
    allowedUse: market ? "market_context_only" : "internal_demo_evidence_only",
    scoringEligibility: "none",
    snapshotVersions: market
      ? ["cbsa-universe-2023-07", "cbsa-geometry-2024", "cbsa-acs-2024"]
      : [esriDemoManifest.snapshot_id],
  }, now);
  return result;
}

function validationTool(run: AgentRun, now: string): AgentToolResult {
  const brief = briefFor(run);
  const profile = esriTradeAreaProfiles.find((item) => item.site_id === run.siteId);
  const result = baseResult(
    `Validated evidence states, provenance, dates, methods, allowed use, and redaction for ${brief.sections.flatMap((item) => item.observations).length} observations.`,
    [...new Set(brief.sections.flatMap((item) => item.observations.map((observation) => observation.source_id)))],
  );
  result.receipt = receipt(run, "validate_candidate_evidence", {
    label: "Deterministic candidate evidence validation",
    sourceIds: result.sourceIds,
    evidenceStatuses: ["Derived"],
    sensitivity: "internal",
    allowedUse: "internal_demo_evidence_only",
    scoringEligibility: "none",
    snapshotVersions: brief.source_snapshot_versions,
  }, now);

  const hasAnsweredRelationship = run.reviewerResponses.some(
    (item) => item.decisionId === `${run.runId}-trade-area-review`,
  );
  if (profile && profile.variants.length > 1 && !hasAnsweredRelationship) {
    result.humanDecision = humanDecisionRequestSchema.parse({
      decisionId: `${run.runId}-trade-area-review`,
      kind: "trade_area_relationship",
      question: "Which supplied trade-area relationship should this review packet use?",
      reason:
        "The supplied source ID links this site to multiple records, and no approved primary role or method is documented.",
      evidence: profile.variants.map((variant, index) => ({
        label: `Variant ${index + 1}`,
        value: variant.trade_area_id,
        sourceId: variant.observations[0]?.source_id ?? "SRC-017",
      })),
      consequences: [
        "Confirming selects one relationship only for this process-local draft run.",
        "Rejecting records that the supplied alternatives should not be used.",
        "Leaving unresolved keeps the relationship blocker visible.",
        "No choice changes the source fixture, scoring logic, or final site decision.",
      ],
      options: ["confirm", "reject", "leave_unresolved"],
      status: "pending",
    });
  }
  return result;
}

function comparisonTool(run: AgentRun, now: string): AgentToolResult {
  const siteIds = esriTradeAreaProfiles.slice(0, 2).map((item) => item.site_id);
  if (!siteIds.includes(run.siteId)) siteIds[1] = run.siteId;
  const comparison = buildCandidateEvidenceComparison({
    ...commonBriefInput(),
    siteIds,
  });
  const result = baseResult(
    `Compared raw source-linked evidence for ${comparison.briefs.length} candidates and found ${comparison.comparability_warnings.length} comparability warnings. No rank or winner was produced.`,
    ["SRC-017", "SYN-CLINIC-LANDSCAPE-001"],
  );
  result.receipt = receipt(run, "compare_candidate_evidence", {
    label: "Raw candidate evidence comparison",
    sourceIds: result.sourceIds,
    evidenceStatuses: ["Reported", "Hypothesis", "Derived"],
    sensitivity: "internal",
    allowedUse: "internal_demo_evidence_only",
    scoringEligibility: "none",
    snapshotVersions: [comparison.comparison_version],
  }, now);
  return result;
}

function evidenceRequestTool(run: AgentRun, now: string): AgentToolResult {
  const brief = briefFor(run);
  const ownerCount = new Set(
    brief.follow_up_questions.map((item) => item.expected_source_or_owner),
  ).size;
  const result = baseResult(
    `Prepared ${brief.follow_up_questions.length} draft follow-up questions for ${ownerCount} evidence owners. Nothing was sent.`,
    [...new Set(brief.follow_up_questions.flatMap((item) =>
      item.source_observation_ids.length ? ["SRC-017"] : [],
    ))],
  );
  result.receipt = receipt(run, "prepare_evidence_request", {
    label: "Draft evidence request",
    sourceIds: result.sourceIds.length ? result.sourceIds : ["SRC-017"],
    evidenceStatuses: ["Derived"],
    sensitivity: "internal",
    allowedUse: "internal_demo_evidence_only",
    scoringEligibility: "none",
    snapshotVersions: [brief.brief_version],
  }, now);
  return result;
}

function prerequisiteTool(
  run: AgentRun,
  now: string,
  deterministicEvaluation?: DeterministicEvaluationInput,
): AgentToolResult {
  const site = siteFor(run);
  const brief = briefFor(run);
  const currentMarketIds = new Set(Object.values(CURRENT_CLINIC_MARKET_IDS));
  const category = site.cbsa_id
    ? marketCategoryFor(site.cbsa_id, currentMarketIds, INITIAL_MARKET_WORKFLOW_RECORDS)
    : null;
  const blockers: AgentBlocker[] = [];
  const review = run.reviewerResponses.find(
    (item) => item.decisionId === `${run.runId}-trade-area-review`,
  );
  if (brief.trade_area_relationship.review_state === "review_required" && review?.decision !== "confirm") {
    blockers.push(blocker(
      run,
      "Trade-area relationship unresolved",
      review?.decision === "reject"
        ? "The reviewer rejected the supplied alternatives."
        : "The reviewer left the supplied relationship unresolved.",
      ["SRC-017"],
      "An authorized reviewer must confirm an intended relationship and role.",
    ));
  }
  if (!site.cbsa_id || !["current", "evaluated"].includes(category ?? "")) {
    blockers.push(blocker(
      run,
      "Parent market prerequisite not met",
      "The candidate does not have an eligible Current or Evaluated parent market workflow state.",
      site.cbsa_id ? ["SRC-014", "SRC-017"] : ["SRC-017"],
      "Confirm the approved parent market and complete the required market review.",
    ));
  }
  if (!deterministicEvaluation) {
    blockers.push(blocker(
      run,
      "Approved scoring input unavailable",
      "The current candidate brief is non-scored evidence and has no approved mapping to the scoring contract.",
      ["SRC-017"],
      "Provide a separately approved scoring input and versioned configuration.",
    ));
  }
  const result = baseResult(
    blockers.length
      ? `Checked deterministic evaluation prerequisites and found ${blockers.length} blockers.`
      : "All deterministic evaluation prerequisites passed.",
    [...new Set(blockers.flatMap((item) => item.sourceIds))],
  );
  result.blockers = blockers;
  result.receipt = receipt(run, "check_evaluation_prerequisites", {
    label: "Deterministic evaluation prerequisite check",
    sourceIds: result.sourceIds.length ? result.sourceIds : ["DERIVED-DETERMINISTIC-RULES"],
    evidenceStatuses: ["Derived"],
    sensitivity: "internal",
    allowedUse: "internal_demo_evidence_only",
    scoringEligibility: blockers.length ? "none" : "eligible",
    snapshotVersions: [brief.brief_version],
  }, now);
  return result;
}

function evaluationTool(
  run: AgentRun,
  now: string,
  deterministicEvaluation?: DeterministicEvaluationInput,
): AgentToolResult {
  if (!deterministicEvaluation || run.evaluationStatus !== "ready") {
    throw new Error("Deterministic evaluation prerequisites have not passed.");
  }
  const evaluation = evaluateSite(
    deterministicEvaluation.input,
    deterministicEvaluation.configuration,
  );
  const result = baseResult(
    `Ran deterministic evaluation ${evaluation.calculationVersion}. The model did not calculate or alter the result.`,
    evaluation.sourceReferences.map((item) => item.sourceId),
  );
  result.receipt = receipt(run, "run_deterministic_evaluation", {
    label: "Deterministic evaluation result",
    sourceIds: result.sourceIds,
    evidenceStatuses: ["Derived"],
    sensitivity: "internal",
    allowedUse: "deterministic_evaluation_only",
    scoringEligibility: "eligible",
    snapshotVersions: [evaluation.calculationVersion, evaluation.scoringVersion],
  }, now);
  return result;
}

function draftTool(run: AgentRun, now: string): AgentToolResult {
  const brief = briefFor(run);
  const sourceIds = [...new Set(
    brief.sections.flatMap((section) =>
      section.observations.map((observation) => observation.source_id),
    ),
  )];
  const remainingItems = run.unresolvedBlockers.map((item) => item.label);
  const status = run.evaluationStatus === "ready"
    ? "ready_for_evaluation"
    : remainingItems.length
      ? "draft_blocked"
      : "draft_for_review";
  const artifact = reviewArtifactSchema.parse({
    artifactId: `${run.runId}-review-packet`,
    briefId: brief.brief_id,
    status,
    title: `${brief.site_label} candidate review packet`,
    summary: `Draft source-linked packet with ${brief.sections.length} sections, ${brief.missing_information.length} missing items, ${brief.conflicting_information.length} conflicts, and ${brief.restrictions.length} restricted or rejected items.`,
    sourceIds,
    remainingItems,
    generatedAt: now,
  });
  const result = baseResult(
    remainingItems.length
      ? `Assembled the draft review packet with ${remainingItems.length} remaining evaluation blockers.`
      : "Assembled the source-linked draft review packet for human review.",
    sourceIds,
  );
  result.artifact = artifact;
  result.receipt = receipt(run, "draft_review_brief", {
    label: "Draft candidate review packet",
    sourceIds,
    evidenceStatuses: ["Reported", "Derived", "Hypothesis", "Unknown"],
    sensitivity: "internal",
    allowedUse: "internal_demo_evidence_only",
    scoringEligibility: run.evaluationStatus === "ready" ? "eligible" : "none",
    snapshotVersions: brief.source_snapshot_versions,
  }, now);
  return result;
}

export function executeAgentTool(
  run: AgentRun,
  toolName: AgentToolName,
  context: Partial<ToolContext> = {},
): AgentToolResult {
  const now = (context.now ?? (() => new Date().toISOString()))();
  const result = (() => {
    switch (toolName) {
      case "get_candidate_readiness": return readinessTool(run, now);
      case "get_candidate_evidence": return evidenceTool(run, now);
      case "get_market_context": return marketTool(run, now);
      case "validate_candidate_evidence": return validationTool(run, now);
      case "compare_candidate_evidence": return comparisonTool(run, now);
      case "prepare_evidence_request": return evidenceRequestTool(run, now);
      case "check_evaluation_prerequisites":
        return prerequisiteTool(run, now, context.deterministicEvaluation);
      case "run_deterministic_evaluation":
        return evaluationTool(run, now, context.deterministicEvaluation);
      case "draft_review_brief": return draftTool(run, now);
    }
  })();
  return toolResultSchema.parse(result);
}
