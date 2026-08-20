import { z } from "zod";
import { perspectiveIdSchema } from "../perspectives/contracts.ts";
import { receivingTeamIdSchema } from "../planning/receiving-team-catalog.ts";

export const CROSS_SOURCE_OPPORTUNITY_VERSION = "cross-source-regional-opportunity-v1" as const;

export const opportunityRecommendationTypeSchema = z.enum([
  "act_now",
  "controlled_test",
  "investigate",
  "monitor",
  "data_quality",
]);
export type OpportunityRecommendationType = z.infer<typeof opportunityRecommendationTypeSchema>;

export const opportunityEvidenceRoleSchema = z.enum([
  "signal",
  "business_outcome",
  "guardrail",
  "causal_validity",
  "approval",
  "context",
  "data_quality",
]);
export type OpportunityEvidenceRole = z.infer<typeof opportunityEvidenceRoleSchema>;

export const regionalOpportunityEvidenceSchema = z.object({
  evidenceId: z.string().trim().min(1),
  hypothesisId: z.string().trim().min(1),
  regionId: z.string().trim().min(1),
  regionName: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  sourceFamily: z.string().trim().min(1),
  metricId: z.string().trim().min(1),
  role: opportunityEvidenceRoleSchema,
  stance: z.enum(["supports", "contradicts", "context"]),
  statement: z.string().trim().min(1),
  qualityStatus: z.enum(["accepted", "warning", "rejected"]),
  compatibilityStatus: z.enum(["compatible", "incompatible"]),
  observationStart: z.string().date().nullable(),
  observationEnd: z.string().date().nullable(),
  value: z.number().finite().nullable(),
  unit: z.string().trim().min(1).nullable(),
  authorizationScope: z.enum(["test", "action"]).nullable().default(null),
}).strict().superRefine((value, ctx) => {
  if (value.observationStart && value.observationEnd && value.observationEnd < value.observationStart) {
    ctx.addIssue({ code: "custom", path: ["observationEnd"], message: "Evidence end date cannot precede its start date." });
  }
  if (value.role !== "approval" && value.authorizationScope !== null) {
    ctx.addIssue({ code: "custom", path: ["authorizationScope"], message: "Only approval evidence may declare an authorization scope." });
  }
});
export type RegionalOpportunityEvidence = z.infer<typeof regionalOpportunityEvidenceSchema>;

export const crossSourceHypothesisDefinitionSchema = z.object({
  hypothesisId: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]+$/),
  department: perspectiveIdSchema,
  title: z.string().trim().min(1),
  decisionQuestionTemplate: z.string().trim().min(1),
  hypothesisTemplate: z.string().trim().min(1),
  businessOutcome: z.string().trim().min(1),
  receivingTeamId: receivingTeamIdSchema,
  materialLever: z.enum(["paid_media", "price", "clinic_footprint", "none"]),
  minimumSourceFamilies: z.number().int().min(1).max(8).default(2),
}).strict();
export type CrossSourceHypothesisDefinition = z.infer<typeof crossSourceHypothesisDefinitionSchema>;

const evidenceReferenceSchema = z.object({
  evidenceId: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  sourceFamily: z.string().trim().min(1),
  metricId: z.string().trim().min(1),
  role: opportunityEvidenceRoleSchema,
  statement: z.string().trim().min(1),
  qualityStatus: z.enum(["accepted", "warning", "rejected"]),
  compatibilityStatus: z.enum(["compatible", "incompatible"]),
}).strict();

export const opportunityContinuitySchema = z.object({
  status: z.enum(["new", "unchanged", "strengthened", "weakened", "changed"]),
  previousRecommendationType: opportunityRecommendationTypeSchema.nullable(),
  previousOpportunityFingerprint: z.string().nullable(),
}).strict();

export const crossSourceRegionalOpportunitySchema = z.object({
  version: z.literal(CROSS_SOURCE_OPPORTUNITY_VERSION),
  opportunityId: z.string().trim().min(1),
  opportunityFingerprint: z.string().regex(/^[a-f0-9]{16}$/),
  hypothesisId: z.string().trim().min(1),
  department: perspectiveIdSchema,
  regionId: z.string().trim().min(1),
  regionName: z.string().trim().min(1),
  title: z.string().trim().min(1),
  decisionQuestion: z.string().trim().min(1),
  hypothesis: z.string().trim().min(1),
  businessOutcome: z.string().trim().min(1),
  receivingTeamId: receivingTeamIdSchema,
  materialLever: z.enum(["paid_media", "price", "clinic_footprint", "none"]),
  recommendation: z.object({
    type: opportunityRecommendationTypeSchema,
    rationale: z.string().trim().min(1),
    nextStep: z.string().trim().min(1),
    executionBoundary: z.string().trim().min(1),
  }).strict(),
  confidence: z.enum(["low", "medium", "high"]),
  evidence: z.object({
    corroborating: z.array(evidenceReferenceSchema),
    contrary: z.array(evidenceReferenceSchema),
    context: z.array(evidenceReferenceSchema),
    excluded: z.array(evidenceReferenceSchema),
  }).strict(),
  sourceIds: z.array(z.string().trim().min(1)),
  sourceFamilies: z.array(z.string().trim().min(1)),
  missingEvidence: z.array(z.string().trim().min(1)),
  continuity: opportunityContinuitySchema,
}).strict();
export type CrossSourceRegionalOpportunity = z.infer<typeof crossSourceRegionalOpportunitySchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Stable, dependency-free 64-bit-style fingerprint composed from two FNV-1a passes. */
export function opportunityFingerprint(value: unknown): string {
  const input = canonical(value);
  const pass = (seed: number) => {
    let hash = seed >>> 0;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  };
  return `${pass(0x811c9dc5)}${pass(0x9e3779b9)}`;
}

function applyRegion(template: string, regionName: string) {
  return template.replaceAll("{region}", regionName);
}

function evidenceReference(item: RegionalOpportunityEvidence) {
  return {
    evidenceId: item.evidenceId,
    sourceId: item.sourceId,
    sourceFamily: item.sourceFamily,
    metricId: item.metricId,
    role: item.role,
    statement: item.statement,
    qualityStatus: item.qualityStatus,
    compatibilityStatus: item.compatibilityStatus,
  };
}

function missingRole(role: OpportunityEvidenceRole, definition: CrossSourceHypothesisDefinition) {
  if (role === "business_outcome") return `Compatible first-party business outcome tied to ${definition.businessOutcome}.`;
  if (role === "guardrail") return "Explicit success threshold, stop condition, rollback rule, and operational guardrails.";
  if (role === "causal_validity") return "Causal or counterfactual validation that separates the observed signal from selection and confounding.";
  if (role === "approval") return `Documented ${definition.receivingTeamId} authorization for the bounded test or material action.`;
  return `Compatible ${role.replaceAll("_", " ")} evidence.`;
}

const recommendationRank: Record<OpportunityRecommendationType, number> = {
  data_quality: 0,
  monitor: 1,
  investigate: 2,
  controlled_test: 3,
  act_now: 4,
};

function recommendationFor(input: {
  definition: CrossSourceHypothesisDefinition;
  corroborating: RegionalOpportunityEvidence[];
  contrary: RegionalOpportunityEvidence[];
  context: RegionalOpportunityEvidence[];
  excluded: RegionalOpportunityEvidence[];
  sourceFamilies: string[];
}) {
  const { definition, corroborating, contrary, excluded, sourceFamilies } = input;
  const role = (candidate: OpportunityEvidenceRole) => corroborating.some((item) => item.role === candidate);
  const actionApproval = corroborating.some((item) => item.role === "approval" && item.authorizationScope === "action");
  const testApproval = actionApproval || corroborating.some((item) => item.role === "approval" && item.authorizationScope === "test");
  const enoughSources = sourceFamilies.length >= definition.minimumSourceFamilies;
  const material = definition.materialLever !== "none";
  const outcomeReady = role("business_outcome");
  const guardrailReady = role("guardrail");
  const causalReady = role("causal_validity");
  const noMaterialContrary = contrary.length === 0;
  let type: OpportunityRecommendationType;
  if (!corroborating.length && excluded.length) type = "data_quality";
  else if (!corroborating.length || (!enoughSources && !outcomeReady)) type = "monitor";
  else if (material && outcomeReady && guardrailReady && causalReady && actionApproval && enoughSources && noMaterialContrary) type = "act_now";
  else if (material && outcomeReady && guardrailReady && testApproval && enoughSources && contrary.length < corroborating.length) type = "controlled_test";
  else type = "investigate";

  const executionBoundary = type === "act_now"
    ? "Route through the recorded accountable authorization; this model records readiness but does not execute the action."
    : type === "controlled_test"
      ? "Only the approved reversible test may proceed; no live material lever change is authorized outside it."
      : "No material spend, price, clinic, lease, or footprint action is authorized from this finding.";
  const nextStep: Record<OpportunityRecommendationType, string> = {
    act_now: `Route the evidence packet to ${definition.receivingTeamId} for the authorized action decision and retain outcome monitoring and rollback controls.`,
    controlled_test: `Run the approved bounded test with the recorded success, stop, and rollback rules before any broader ${definition.materialLever.replaceAll("_", " ")} change.`,
    investigate: `Resolve the named evidence gaps and challenge the hypothesis against the contrary evidence before proposing a material action.`,
    monitor: "Keep the signal on the next deterministic refresh; promote it only if another compatible source or business outcome corroborates it.",
    data_quality: "Repair source quality or compatibility and rerun discovery before interpreting this regional pattern.",
  };
  const rationale: Record<OpportunityRecommendationType, string> = {
    act_now: "Compatible cross-source outcomes, guardrails, causal validity, and action authorization are present with no retained contrary evidence.",
    controlled_test: "Cross-source business outcomes and guardrails support a reversible test, but the evidence does not authorize an unrestricted live action.",
    investigate: "A supported cross-source hypothesis exists, but outcome, validity, guardrail, approval, or contrary-evidence gaps remain.",
    monitor: "The current signal is too weak or too single-source to justify an active investigation package.",
    data_quality: "No interpretable corroborating evidence remains after quality and compatibility exclusions.",
  };
  return { type, rationale: rationale[type], nextStep: nextStep[type], executionBoundary };
}

export function buildCrossSourceRegionalOpportunity(input: {
  definition: CrossSourceHypothesisDefinition;
  regionId: string;
  regionName: string;
  evidence: RegionalOpportunityEvidence[];
  previous?: CrossSourceRegionalOpportunity | null;
}): CrossSourceRegionalOpportunity {
  const definition = crossSourceHypothesisDefinitionSchema.parse(input.definition);
  const evidence = input.evidence.map((item) => regionalOpportunityEvidenceSchema.parse(item))
    .filter((item) => item.hypothesisId === definition.hypothesisId && item.regionId === input.regionId)
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const excluded = evidence.filter((item) => item.qualityStatus === "rejected" || item.compatibilityStatus === "incompatible" || item.role === "data_quality");
  const usable = evidence.filter((item) => !excluded.includes(item));
  const corroborating = usable.filter((item) => item.stance === "supports");
  const contrary = usable.filter((item) => item.stance === "contradicts");
  const context = usable.filter((item) => item.stance === "context");
  const sourceIds = [...new Set(usable.map((item) => item.sourceId))].sort();
  const sourceFamilies = [...new Set(usable.map((item) => item.sourceFamily))].sort();
  const recommendation = recommendationFor({ definition, corroborating, contrary, context, excluded, sourceFamilies });
  const supportedRoles = new Set(corroborating.map((item) => item.role));
  const requiredRoles: OpportunityEvidenceRole[] = definition.materialLever === "none"
    ? ["signal"]
    : ["business_outcome", "guardrail", "causal_validity", "approval"];
  const missingEvidence = requiredRoles.filter((role) => !supportedRoles.has(role)).map((role) => missingRole(role, definition));
  if (sourceFamilies.length < definition.minimumSourceFamilies) missingEvidence.push(`At least ${definition.minimumSourceFamilies} compatible source families; ${sourceFamilies.length} currently corroborate the hypothesis.`);
  if (contrary.length) missingEvidence.push("Disposition the retained contrary evidence before increasing action readiness.");
  if (excluded.length) missingEvidence.push("Resolve rejected, incompatible, or data-quality evidence before treating it as corroboration.");
  const opportunityId = `opportunity:${definition.hypothesisId}:${input.regionId}`.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
  const core = {
    opportunityId,
    hypothesisId: definition.hypothesisId,
    regionId: input.regionId,
    recommendation,
    corroborating: corroborating.map((item) => item.evidenceId),
    contrary: contrary.map((item) => item.evidenceId),
    excluded: excluded.map((item) => item.evidenceId),
    missingEvidence,
  };
  const fingerprint = opportunityFingerprint(core);
  const previous = input.previous?.opportunityId === opportunityId ? input.previous : null;
  const priorType = previous?.recommendation.type ?? null;
  const continuityStatus = !previous
    ? "new" as const
    : previous.opportunityFingerprint === fingerprint
      ? "unchanged" as const
      : recommendationRank[recommendation.type] > recommendationRank[previous.recommendation.type]
        ? "strengthened" as const
        : recommendationRank[recommendation.type] < recommendationRank[previous.recommendation.type]
          ? "weakened" as const
          : "changed" as const;

  return crossSourceRegionalOpportunitySchema.parse({
    version: CROSS_SOURCE_OPPORTUNITY_VERSION,
    opportunityId,
    opportunityFingerprint: fingerprint,
    hypothesisId: definition.hypothesisId,
    department: definition.department,
    regionId: input.regionId,
    regionName: input.regionName,
    title: applyRegion(definition.title, input.regionName),
    decisionQuestion: applyRegion(definition.decisionQuestionTemplate, input.regionName),
    hypothesis: applyRegion(definition.hypothesisTemplate, input.regionName),
    businessOutcome: definition.businessOutcome,
    receivingTeamId: definition.receivingTeamId,
    materialLever: definition.materialLever,
    recommendation,
    confidence: recommendation.type === "act_now" ? "high" : recommendation.type === "controlled_test" || (recommendation.type === "investigate" && sourceFamilies.length >= 2) ? "medium" : "low",
    evidence: {
      corroborating: corroborating.map(evidenceReference),
      contrary: contrary.map(evidenceReference),
      context: context.map(evidenceReference),
      excluded: excluded.map(evidenceReference),
    },
    sourceIds,
    sourceFamilies,
    missingEvidence: [...new Set(missingEvidence)],
    continuity: {
      status: continuityStatus,
      previousRecommendationType: priorType,
      previousOpportunityFingerprint: previous?.opportunityFingerprint ?? null,
    },
  });
}
