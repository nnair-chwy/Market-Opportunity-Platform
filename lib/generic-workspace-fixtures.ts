import { z } from "zod";
import {
  actionPacketSchema,
  EVALUATION_CONTRACT_VERSION,
  evaluationContractSchema,
  questionSpecSchema,
  type ActionPacket,
  type EvaluationContract,
  type QuestionSpec,
} from "./evaluation-contracts.ts";
import {
  DETERMINISTIC_OPERATOR_VERSION,
  calculate_weighted_result,
  compare_cohort,
  normalize_metric,
  type DecisionLayer,
} from "./evaluation-operators.ts";

export const GENERIC_WORKSPACE_FIXTURE_VERSION = "1.0.0" as const;

const metricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().positive(),
  direction: z.enum(["higher_is_better", "lower_is_better"]),
  sourceId: z.string().min(1),
  unit: z.string().min(1),
}).strict();

const entitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subtitle: z.string().min(1),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  metrics: z.record(z.string(), z.number().min(0).max(100)),
  note: z.string().min(1),
}).strict();

const workspaceFixtureSchema = z.object({
  id: z.enum(["clinic_site", "local_growth_market"]),
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  decisionLayer: z.enum([
    "market_attractiveness",
    "submarket_opportunity",
    "property_feasibility",
    "execution_priority",
  ]),
  goal: z.string().min(1),
  proposedInterpretation: z.string().min(1),
  geographyLabel: z.string().min(1),
  timeLabel: z.string().min(1),
  cohortLabel: z.string().min(1),
  sourceId: z.string().min(1),
  metricSourceIds: z.array(z.string().min(1)).min(1),
  permittedDraftAction: z.string().min(1),
  approvalRole: z.string().min(1),
  metrics: z.array(metricSchema).min(1),
  entities: z.array(entitySchema).min(2),
}).strict().superRefine((fixture, context) => {
  const metricIds = new Set(fixture.metrics.map((metric) => metric.id));
  const totalWeight = fixture.metrics.reduce((sum, metric) => sum + metric.weight, 0);
  if (Math.abs(totalWeight - 100) > 1e-9) {
    context.addIssue({ code: "custom", path: ["metrics"], message: "Fixture weights must total 100." });
  }
  fixture.entities.forEach((entity, index) => {
    if (Object.keys(entity.metrics).some((id) => !metricIds.has(id))) {
      context.addIssue({ code: "custom", path: ["entities", index, "metrics"], message: "Entity contains an unknown metric." });
    }
    if (fixture.metrics.some((metric) => entity.metrics[metric.id] === undefined)) {
      context.addIssue({ code: "custom", path: ["entities", index, "metrics"], message: "Every synthetic entity requires every configured metric." });
    }
  });
});

export type WorkspaceFixture = z.infer<typeof workspaceFixtureSchema>;

const rawFixtures: WorkspaceFixture[] = [
  {
    id: "clinic_site",
    label: "Clinic market or site evaluation",
    shortLabel: "Clinic site",
    decisionLayer: "property_feasibility",
    goal: "Compare synthetic clinic candidates and prepare a diligence packet for human review.",
    proposedInterpretation: "Evaluate the three synthetic clinic candidates in the demonstration cohort using the fixed demand, access, competition, and staffing criteria. Surface the strongest result under the fixture contract and its unresolved diligence items without recommending a site.",
    geographyLabel: "Synthetic candidate sites · United States",
    timeLabel: "Synthetic snapshot · 2026-08-10",
    cohortLabel: "SYN clinic candidate cohort",
    sourceId: "SYN-GENERIC-CLINIC-001",
    metricSourceIds: ["SYN-DEM-01", "SYN-GEO-01", "SYN-COMP-01", "SYN-OPS-01"],
    permittedDraftAction: "Draft a candidate diligence packet",
    approvalRole: "Authorized clinic real-estate reviewer",
    metrics: [
      { id: "demand", label: "Demand index", weight: 35, direction: "higher_is_better", sourceId: "SYN-DEM-01", unit: "index" },
      { id: "access", label: "Access coverage", weight: 25, direction: "higher_is_better", sourceId: "SYN-GEO-01", unit: "index" },
      { id: "competition", label: "Competitive intensity", weight: 20, direction: "lower_is_better", sourceId: "SYN-COMP-01", unit: "index" },
      { id: "staffing", label: "Staffing feasibility", weight: 20, direction: "higher_is_better", sourceId: "SYN-OPS-01", unit: "index" },
    ],
    entities: [
      { id: "clinic-river", name: "River District", subtitle: "Nashville, TN · synthetic site", latitude: 36.17, longitude: -86.77, metrics: { demand: 89, access: 84, competition: 32, staffing: 70 }, note: "Strong demand and access; staffing ownership remains unresolved." },
      { id: "clinic-north", name: "North Hills", subtitle: "Raleigh, NC · synthetic site", latitude: 35.81, longitude: -78.64, metrics: { demand: 82, access: 77, competition: 49, staffing: 78 }, note: "Balanced synthetic profile with moderate competition." },
      { id: "clinic-west", name: "Westshore", subtitle: "Tampa, FL · synthetic site", latitude: 27.95, longitude: -82.52, metrics: { demand: 85, access: 87, competition: 56, staffing: 73 }, note: "Access is strong; competition requires local validation." },
    ],
  },
  {
    id: "local_growth_market",
    label: "Local growth-market selection",
    shortLabel: "Growth market",
    decisionLayer: "market_attractiveness",
    goal: "Prioritize a synthetic market for a local growth-test planning brief.",
    proposedInterpretation: "Compare three synthetic markets using fixed audience scale, category headroom, media efficiency, and measurement-readiness criteria. Identify the priority under demo criteria and prepare only a draft test-planning packet; do not authorize targeting, spend, or campaign activation.",
    geographyLabel: "Synthetic market cohort · United States",
    timeLabel: "Synthetic planning snapshot · 2026-08-10",
    cohortLabel: "SYN local growth market cohort",
    sourceId: "SYN-GENERIC-GROWTH-001",
    metricSourceIds: ["SYN-GROWTH-AUD-01", "SYN-GROWTH-HEAD-01", "SYN-GROWTH-MEDIA-01", "SYN-GROWTH-MEAS-01"],
    permittedDraftAction: "Draft a local growth-test planning packet",
    approvalRole: "Growth owner and data-governance reviewer",
    metrics: [
      { id: "audience", label: "Audience scale", weight: 30, direction: "higher_is_better", sourceId: "SYN-GROWTH-AUD-01", unit: "index" },
      { id: "headroom", label: "Category headroom", weight: 30, direction: "higher_is_better", sourceId: "SYN-GROWTH-HEAD-01", unit: "index" },
      { id: "media", label: "Media efficiency", weight: 20, direction: "higher_is_better", sourceId: "SYN-GROWTH-MEDIA-01", unit: "index" },
      { id: "measurement", label: "Measurement readiness", weight: 20, direction: "higher_is_better", sourceId: "SYN-GROWTH-MEAS-01", unit: "index" },
    ],
    entities: [
      { id: "growth-denver", name: "Denver", subtitle: "Synthetic growth market · CO", latitude: 39.74, longitude: -104.99, metrics: { audience: 84, headroom: 72, media: 68, measurement: 88 }, note: "Highest measurement readiness in the fixture; audience activation remains prohibited." },
      { id: "growth-austin", name: "Austin", subtitle: "Synthetic growth market · TX", latitude: 30.27, longitude: -97.74, metrics: { audience: 88, headroom: 79, media: 61, measurement: 76 }, note: "Strong synthetic scale and headroom with a weaker media-efficiency assumption." },
      { id: "growth-charlotte", name: "Charlotte", subtitle: "Synthetic growth market · NC", latitude: 35.23, longitude: -80.84, metrics: { audience: 76, headroom: 85, media: 82, measurement: 69 }, note: "Strong headroom and media assumptions; measurement readiness needs review." },
    ],
  },
];

export const genericWorkspaceFixtures = rawFixtures.map((fixture) =>
  workspaceFixtureSchema.parse(fixture),
);

function makeQuestion(fixture: WorkspaceFixture, text = fixture.goal): QuestionSpec {
  return questionSpecSchema.parse({
    questionId: `question:${fixture.id}`,
    version: GENERIC_WORKSPACE_FIXTURE_VERSION,
    text,
    decisionType: fixture.id,
    geography: { grain: fixture.id === "clinic_site" ? "site" : "market", geographyId: fixture.id, label: fixture.geographyLabel, method: "Checked-in synthetic fixture", version: GENERIC_WORKSPACE_FIXTURE_VERSION },
    timeScope: { asOfDate: "2026-08-10", startDate: null, endDate: null, label: fixture.timeLabel },
    eligibility: { status: "conditional", scoringEligibility: "synthetic_prototype_only", allowedUse: "synthetic_prototype_only", reasons: ["Checked-in synthetic fixture only.", "Any material action requires separate human approval."] },
    requiredEvidence: fixture.metrics.map((metric) => ({ evidenceId: `metric:${metric.id}`, purpose: `Deterministic ${metric.label} input.`, requiredFor: "formula", allowMissing: false, missingDataRuleId: `missing:${metric.id}` })),
    permittedActionIds: ["prepare-draft-packet"],
    approvalGateIds: ["human-review"],
  });
}

export function validateWorkspaceInterpretation(
  fixture: WorkspaceFixture,
  proposedText: string,
): QuestionSpec {
  const text = proposedText.trim();
  if (text.length < 20) throw new Error("The interpreted question must contain at least 20 characters.");
  return makeQuestion(fixture, text);
}

export function createWorkspaceContract(fixture: WorkspaceFixture): EvaluationContract {
  const question = makeQuestion(fixture);
  const evidence = fixture.metrics.map((metric) => ({
    evidenceId: `metric:${metric.id}`,
    label: metric.label,
    evidenceStatus: "Hypothesis" as const,
    availability: "available" as const,
    value: { syntheticEntityCount: fixture.entities.length },
    unit: metric.unit,
    geography: question.geography,
    timeScope: question.timeScope,
    eligibility: { status: "eligible" as const, scoringEligibility: "synthetic_prototype_only" as const, allowedUse: "synthetic_prototype_only", reasons: ["Synthetic fixture metric; not a production observation."] },
    sourceIds: [metric.sourceId],
    provenance: { observationId: null, snapshotVersion: GENERIC_WORKSPACE_FIXTURE_VERSION, transformation: "Checked-in generic workspace fixture", observedAt: null, recordedAt: "2026-08-10T00:00:00.000Z" },
    sensitivity: "internal" as const,
    qualityStatus: "accepted" as const,
    limitations: ["Synthetic values are hypotheses and cannot authorize an action."],
    aiProposedInterpretation: null,
    humanApprovedInterpretation: null,
  }));
  return evaluationContractSchema.parse({
    contractVersion: EVALUATION_CONTRACT_VERSION,
    contractId: `generic:${fixture.id}`,
    contractRevision: GENERIC_WORKSPACE_FIXTURE_VERSION,
    domain: fixture.id,
    status: "synthetic",
    question,
    decisionGraph: {
      graphId: `graph:${fixture.id}`,
      version: GENERIC_WORKSPACE_FIXTURE_VERSION,
      entryNodeId: "goal",
      nodes: [
        { nodeId: "goal", kind: "question", referenceId: question.questionId, label: "Validated goal" },
        { nodeId: "evidence", kind: "evidence", referenceId: fixture.sourceId, label: "Validate synthetic evidence" },
        { nodeId: "calculate", kind: "formula", referenceId: `formula:${fixture.id}`, label: "Run deterministic ranking" },
        { nodeId: "review", kind: "human_review", referenceId: "human-review", label: "Human review" },
        { nodeId: "packet", kind: "artifact", referenceId: "draft-action-packet", label: "Prepare draft packet" },
      ],
      edges: [
        { edgeId: "goal-evidence", fromNodeId: "goal", toNodeId: "evidence", condition: "Application validates the interpreted question.", outcome: "continue" },
        { edgeId: "evidence-calculate", fromNodeId: "evidence", toNodeId: "calculate", condition: "Required synthetic fixture fields pass schema validation.", outcome: "continue" },
        { edgeId: "calculate-review", fromNodeId: "calculate", toNodeId: "review", condition: "Deterministic result is available.", outcome: "require_review" },
        { edgeId: "review-packet", fromNodeId: "review", toNodeId: "packet", condition: "Reviewer records a review state; no action is authorized.", outcome: "complete" },
      ],
    },
    capabilities: [
      { capabilityId: `fixture:${fixture.id}`, kind: "deterministic_calculation", availability: "available", syntheticOnly: true, sourceIds: [fixture.sourceId, ...fixture.metricSourceIds], restrictions: ["Synthetic fixture execution only."] },
      { capabilityId: "ai-question-interpretation", kind: "ai_interpretation", availability: "available", syntheticOnly: true, sourceIds: [fixture.sourceId], restrictions: ["Application validation is required before calculation.", "AI cannot calculate, rank, approve, or recommend."] },
      { capabilityId: "human-review", kind: "human_review", availability: "available", syntheticOnly: false, sourceIds: [], restrictions: ["Review state does not authorize a material action."] },
    ],
    evidence,
    formulas: fixture.metrics.map((metric) => ({ formulaId: `normalize:${metric.id}`, version: GENERIC_WORKSPACE_FIXTURE_VERSION, expression: `linear 0–100 normalization; ${metric.direction}`, inputEvidenceIds: [`metric:${metric.id}`], outputUnit: "normalized_score", deterministic: true, sourceIds: [metric.sourceId] })),
    thresholds: [],
    weights: fixture.metrics.map((metric) => ({ evidenceId: `metric:${metric.id}`, weight: metric.weight, included: true, rationale: "Fixed synthetic demonstration weight.", sourceIds: [metric.sourceId] })),
    expectedWeightTotal: 100,
    missingDataRules: fixture.metrics.map((metric) => ({ ruleId: `missing:${metric.id}`, behavior: "fail_evaluation", imputationPermitted: false, description: "Do not calculate when the required synthetic fixture value is missing." })),
    artifacts: [{ artifactId: "draft-action-packet", version: GENERIC_WORKSPACE_FIXTURE_VERSION, kind: "action_packet", title: fixture.permittedDraftAction, requiredEvidenceIds: evidence.map((item) => item.evidenceId), status: "review_required", allowedUse: "synthetic_prototype_only", sensitivity: "internal", approvalGateIds: ["human-review"] }],
    permittedActions: [{ actionId: "prepare-draft-packet", label: fixture.permittedDraftAction, kind: "draft", aiMayPropose: true, humanApprovalRequired: false, approvalGateIds: [], prohibitedEffects: ["No targeting, spend, outreach, lease, opening, or final recommendation."] }],
    approvalGates: [{ gateId: "human-review", label: "Human review required for any next step", requiredRole: fixture.approvalRole, status: "required", approvedBy: null, approvedAt: null, scope: "Any material business action outside this draft packet." }],
    contractApproval: null,
    sourceIds: [fixture.sourceId, ...fixture.metricSourceIds],
  });
}

export type WorkspaceEntityResult = {
  entity: WorkspaceFixture["entities"][number];
  score: number;
  rank: number;
  contributions: Array<{ metricId: string; contribution: number }>;
};

export function createWorkspaceActionPacket(
  fixture: WorkspaceFixture,
  result: WorkspaceEntityResult,
  proposedInterpretation: string,
): ActionPacket {
  const contract = genericWorkspaceContracts.get(fixture.id);
  if (!contract) throw new Error(`No validated contract exists for ${fixture.id}.`);
  const question = validateWorkspaceInterpretation(
    fixture,
    proposedInterpretation,
  );
  return actionPacketSchema.parse({
    packetId: `packet:${fixture.id}:${result.entity.id}`,
    packetVersion: GENERIC_WORKSPACE_FIXTURE_VERSION,
    contractId: contract.contractId,
    contractRevision: contract.contractRevision,
    status: "awaiting_human_review",
    generatedAt: "2026-08-10T00:00:00.000Z",
    evidence: contract.evidence,
    missingEvidenceIds: [],
    proposedAiInterpretation: {
      status: "proposed",
      text: question.text,
      modelVersion: "fixture-proposal-v1",
      promptVersion: "generic-question-interpretation-v1",
      generatedAt: "2026-08-10T00:00:00.000Z",
      sourceIds: [fixture.sourceId],
    },
    humanApprovedInterpretation: null,
    actions: [{
      actionId: "prepare-draft-packet",
      status: "proposed",
      proposedBy: "deterministic_system",
      rationale: `${result.entity.name} is priority under fixed synthetic demo criteria at ${result.score.toFixed(2)}; prepare evidence for review without authorizing an action.`,
      approvalGateIds: ["human-review"],
    }],
    approvalGates: contract.approvalGates,
    artifactIds: ["draft-action-packet"],
    sourceIds: contract.sourceIds,
  });
}

export function calculateWorkspaceResults(
  fixture: WorkspaceFixture,
): WorkspaceEntityResult[] {
  const results = fixture.entities.map((entity) => {
    const normalized = fixture.metrics.map((metric) =>
      normalize_metric({
        operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
        decisionLayer: fixture.decisionLayer as DecisionLayer,
        metricId: metric.id,
        rawValue: entity.metrics[metric.id],
        direction: metric.direction,
        validRange: { min: 0, max: 100 },
        normalization: { function: "linear", version: GENERIC_WORKSPACE_FIXTURE_VERSION, inputMin: 0, inputMax: 100, clamp: false },
        provenance: { sourceIds: [metric.sourceId], inputVersion: GENERIC_WORKSPACE_FIXTURE_VERSION, transformationVersion: GENERIC_WORKSPACE_FIXTURE_VERSION },
      }),
    );
    const weighted = calculate_weighted_result({
      operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
      decisionLayer: fixture.decisionLayer,
      formulaVersion: GENERIC_WORKSPACE_FIXTURE_VERSION,
      expectedWeightTotal: 100,
      metrics: fixture.metrics.map((metric) => ({
        metricId: metric.id,
        normalizedValue: normalized.find((item) => item.metricId === metric.id)!.normalizedValue,
        weight: metric.weight,
        included: true,
        state: "available",
        missingDataRule: "fail_evaluation",
        provenance: { sourceIds: [metric.sourceId], inputVersion: GENERIC_WORKSPACE_FIXTURE_VERSION, transformationVersion: GENERIC_WORKSPACE_FIXTURE_VERSION },
      })),
    });
    if (weighted.value === null) throw new Error(`Synthetic result was not calculated for ${entity.id}.`);
    return { entity, score: weighted.value, contributions: weighted.contributions.map((item) => ({ metricId: item.metricId, contribution: item.contribution ?? 0 })) };
  });
  const ranks = compare_cohort({
    operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
    decisionLayer: fixture.decisionLayer,
    comparisonVersion: GENERIC_WORKSPACE_FIXTURE_VERSION,
    cohortId: fixture.id,
    direction: "higher_is_better",
    entities: results.map((result) => ({ entityId: result.entity.id, cohortId: fixture.id, value: result.score, provenance: { sourceIds: [fixture.sourceId], inputVersion: GENERIC_WORKSPACE_FIXTURE_VERSION, transformationVersion: GENERIC_WORKSPACE_FIXTURE_VERSION } })),
  });
  return results
    .map((result) => ({ ...result, rank: ranks.find((rank) => rank.entityId === result.entity.id)!.rank }))
    .sort((left, right) => left.rank - right.rank);
}

export const genericWorkspaceContracts = new Map(
  genericWorkspaceFixtures.map((fixture) => [fixture.id, createWorkspaceContract(fixture)]),
);
