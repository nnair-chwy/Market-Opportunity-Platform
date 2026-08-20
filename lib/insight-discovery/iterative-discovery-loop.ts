import { z } from "zod";
import {
  buildCrossSourceRegionalOpportunity,
  crossSourceHypothesisDefinitionSchema,
  crossSourceRegionalOpportunitySchema,
  opportunityFingerprint,
  regionalOpportunityEvidenceSchema,
  type CrossSourceHypothesisDefinition,
  type CrossSourceRegionalOpportunity,
  type RegionalOpportunityEvidence,
} from "./cross-source-opportunity.ts";

export const ITERATIVE_DISCOVERY_LOOP_VERSION = "iterative-cross-source-discovery-v1" as const;

const recommendationCountsSchema = z.object({
  act_now: z.number().int().nonnegative(),
  controlled_test: z.number().int().nonnegative(),
  investigate: z.number().int().nonnegative(),
  monitor: z.number().int().nonnegative(),
  data_quality: z.number().int().nonnegative(),
}).strict();

export const iterativeDiscoveryRunSchema = z.object({
  version: z.literal(ITERATIVE_DISCOVERY_LOOP_VERSION),
  runId: z.string().trim().min(1),
  generatedAt: z.string().datetime(),
  previousRun: z.object({ runId: z.string().trim().min(1), resultFingerprint: z.string().regex(/^[a-f0-9]{16}$/) }).strict().nullable(),
  inputFingerprint: z.string().regex(/^[a-f0-9]{16}$/),
  resultFingerprint: z.string().regex(/^[a-f0-9]{16}$/),
  status: z.enum(["completed", "completed_with_data_quality_issues", "no_hypotheses"]),
  stopReason: z.string().trim().min(1),
  iterations: z.array(z.object({
    iteration: z.number().int().positive(),
    stage: z.enum(["generate_hypotheses", "challenge_with_evidence", "classify_recommendations"]),
    hypothesesConsidered: z.number().int().nonnegative(),
    evidenceConsidered: z.number().int().nonnegative(),
    changedOpportunityCount: z.number().int().nonnegative(),
    note: z.string().trim().min(1),
  }).strict()).length(3),
  opportunities: z.array(crossSourceRegionalOpportunitySchema),
  counts: z.object({
    regions: z.number().int().nonnegative(),
    hypotheses: z.number().int().nonnegative(),
    evidenceItems: z.number().int().nonnegative(),
    sourceFamilies: z.number().int().nonnegative(),
    recommendations: recommendationCountsSchema,
    continuity: z.object({ new: z.number().int().nonnegative(), unchanged: z.number().int().nonnegative(), strengthened: z.number().int().nonnegative(), weakened: z.number().int().nonnegative(), changed: z.number().int().nonnegative() }).strict(),
  }).strict(),
}).strict();
export type IterativeDiscoveryRun = z.infer<typeof iterativeDiscoveryRunSchema>;

function groupKey(item: RegionalOpportunityEvidence) {
  return `${item.hypothesisId}\u0000${item.regionId}`;
}

function zeroRecommendationCounts() {
  return { act_now: 0, controlled_test: 0, investigate: 0, monitor: 0, data_quality: 0 };
}

export function runIterativeCrossSourceDiscovery(input: {
  runId: string;
  generatedAt: string;
  definitions: CrossSourceHypothesisDefinition[];
  evidence: RegionalOpportunityEvidence[];
  previousRun?: IterativeDiscoveryRun | null;
}): IterativeDiscoveryRun {
  const definitions = input.definitions.map((item) => crossSourceHypothesisDefinitionSchema.parse(item))
    .sort((left, right) => left.hypothesisId.localeCompare(right.hypothesisId));
  if (new Set(definitions.map((item) => item.hypothesisId)).size !== definitions.length) throw new Error("Cross-source hypothesis IDs must be unique.");
  const definitionById = new Map(definitions.map((item) => [item.hypothesisId, item]));
  const evidence = input.evidence.map((item) => regionalOpportunityEvidenceSchema.parse(item))
    .sort((left, right) => groupKey(left).localeCompare(groupKey(right)) || left.evidenceId.localeCompare(right.evidenceId));
  for (const item of evidence) if (!definitionById.has(item.hypothesisId)) throw new Error(`Evidence references unknown hypothesis ${item.hypothesisId}.`);
  const groups = new Map<string, RegionalOpportunityEvidence[]>();
  for (const item of evidence) groups.set(groupKey(item), [...(groups.get(groupKey(item)) ?? []), item]);
  const previousById = new Map((input.previousRun?.opportunities ?? []).map((item) => [item.opportunityId, item]));
  const opportunities: CrossSourceRegionalOpportunity[] = [];
  for (const [key, items] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
    const [hypothesisId, regionId] = key.split("\u0000");
    const definition = definitionById.get(hypothesisId!)!;
    const regionName = [...new Set(items.map((item) => item.regionName))];
    if (regionName.length !== 1) throw new Error(`Region ${regionId} has inconsistent names in hypothesis ${hypothesisId}.`);
    const opportunityId = `opportunity:${hypothesisId}:${regionId}`.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
    opportunities.push(buildCrossSourceRegionalOpportunity({
      definition,
      regionId: regionId!,
      regionName: regionName[0]!,
      evidence: items,
      previous: previousById.get(opportunityId) ?? null,
    }));
  }
  opportunities.sort((left, right) => {
    const rank = { act_now: 0, controlled_test: 1, investigate: 2, monitor: 3, data_quality: 4 } as const;
    return rank[left.recommendation.type] - rank[right.recommendation.type]
      || left.department.localeCompare(right.department)
      || left.regionName.localeCompare(right.regionName)
      || left.opportunityId.localeCompare(right.opportunityId);
  });

  const inputFingerprint = opportunityFingerprint({ definitions, evidence });
  const resultFingerprint = opportunityFingerprint(opportunities.map((item) => ({
    opportunityId: item.opportunityId,
    opportunityFingerprint: item.opportunityFingerprint,
    recommendation: item.recommendation,
    continuity: item.continuity,
  })));
  const recommendationCounts = zeroRecommendationCounts();
  const continuity = { new: 0, unchanged: 0, strengthened: 0, weakened: 0, changed: 0 };
  opportunities.forEach((item) => {
    recommendationCounts[item.recommendation.type] += 1;
    continuity[item.continuity.status] += 1;
  });
  const changedOpportunityCount = opportunities.filter((item) => item.continuity.status !== "unchanged").length;
  const sourceFamilies = new Set(evidence.map((item) => item.sourceFamily));
  const regions = new Set(evidence.map((item) => item.regionId));
  const dataQualityCount = recommendationCounts.data_quality;
  const status = !opportunities.length ? "no_hypotheses" as const : dataQualityCount ? "completed_with_data_quality_issues" as const : "completed" as const;

  return iterativeDiscoveryRunSchema.parse({
    version: ITERATIVE_DISCOVERY_LOOP_VERSION,
    runId: input.runId,
    generatedAt: input.generatedAt,
    previousRun: input.previousRun ? { runId: input.previousRun.runId, resultFingerprint: input.previousRun.resultFingerprint } : null,
    inputFingerprint,
    resultFingerprint,
    status,
    stopReason: !opportunities.length
      ? "No regional evidence matched a registered cross-source hypothesis."
      : "Every generated regional hypothesis was challenged against compatible corroborating, contrary, and quality evidence, then assigned one explicit recommendation type.",
    iterations: [
      { iteration: 1, stage: "generate_hypotheses", hypothesesConsidered: groups.size, evidenceConsidered: evidence.length, changedOpportunityCount: groups.size, note: "Generated one stable candidate per registered hypothesis and region represented in the evidence." },
      { iteration: 2, stage: "challenge_with_evidence", hypothesesConsidered: groups.size, evidenceConsidered: evidence.length, changedOpportunityCount: opportunities.filter((item) => item.evidence.contrary.length || item.evidence.excluded.length).length, note: "Separated corroborating, contrary, contextual, rejected, and incompatible evidence without blending unlike sources." },
      { iteration: 3, stage: "classify_recommendations", hypothesesConsidered: groups.size, evidenceConsidered: evidence.length, changedOpportunityCount, note: "Applied deterministic outcome, guardrail, causality, authorization, source-diversity, and prior-run continuity gates." },
    ],
    opportunities,
    counts: {
      regions: regions.size,
      hypotheses: groups.size,
      evidenceItems: evidence.length,
      sourceFamilies: sourceFamilies.size,
      recommendations: recommendationCounts,
      continuity,
    },
  });
}

