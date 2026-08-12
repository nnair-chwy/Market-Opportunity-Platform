import {
  CALCULATION_VERSION,
  GEOGRAPHY_VINTAGE,
  OPPORTUNITY_SCHEMA_VERSION,
  PLAYBOOK_VERSION,
  playbookDefinitionSchema,
  opportunitySchema,
  type Opportunity,
  type OpportunityDraft,
  type OpportunityEvidence,
  type OpportunitySector,
  type PlaybookDefinition,
  type ValidatedSignalBatch,
} from "./contracts.ts";
import { conditionForMetric, conditionPasses } from "./baselines.ts";
import { evidenceFromEvent, freshnessFor, missingEvidence } from "./evidence.ts";
import { assembleActionPacket, deterministicActionPacketExplanation } from "./action-packets.ts";

const PROMPT_VERSION = "opportunity-card-deterministic-v1";
const DAY_MS = 86_400_000;

export const PLAYBOOKS: readonly PlaybookDefinition[] = [
  playbookDefinitionSchema.parse({
    playbookId: "regional-acquisition-gap",
    version: PLAYBOOK_VERSION,
    sector: "marketing",
    evidenceStatus: "Hypothesis",
    allowedUse: "synthetic_prototype_only",
    eligibleRegionIds: ["cbsa:42660"],
    requiredMetricIds: ["category_interest_change_pct", "chewy_penetration_index", "marketing_reach_index", "delivery_ready"],
    conditions: [
      { metricId: "category_interest_change_pct", operator: "gte", threshold: 10, role: "eligibility", label: "Interest change is at least 10%" },
      { metricId: "chewy_penetration_index", operator: "lte", threshold: 50, role: "eligibility", label: "Penetration index is at most 50" },
      { metricId: "marketing_reach_index", operator: "lte", threshold: 50, role: "eligibility", label: "Marketing reach index is at most 50" },
      { metricId: "delivery_ready", operator: "eq", threshold: 1, role: "supporting", label: "Delivery is available" },
    ],
    minimumEvidenceCoverage: 1,
    freshnessDays: 7,
    dedupeWindowDays: 14,
    cooldownDays: 7,
    expirationDays: 14,
    permittedActions: ["Prepare a controlled acquisition-test brief"],
    stakeholderRole: "Marketing",
    outcomeDefinition: "Incremental customers or orders under an approved experiment design",
    guardrails: ["Acquisition cost", "Delivery availability", "Inventory availability"],
  }),
  playbookDefinitionSchema.parse({
    playbookId: "clinic-awareness-capacity",
    version: PLAYBOOK_VERSION,
    sector: "pet_health",
    evidenceStatus: "Hypothesis",
    allowedUse: "synthetic_prototype_only",
    eligibleRegionIds: ["cbsa:42660"],
    requiredMetricIds: ["appointment_interest_change_pct", "available_capacity_pct", "clinic_awareness_index", "staffed_capacity_ready"],
    conditions: [
      { metricId: "appointment_interest_change_pct", operator: "gte", threshold: 15, role: "eligibility", label: "Appointment interest change is at least 15%" },
      { metricId: "available_capacity_pct", operator: "gte", threshold: 20, role: "eligibility", label: "Available capacity is at least 20%" },
      { metricId: "clinic_awareness_index", operator: "lte", threshold: 50, role: "eligibility", label: "Awareness index is at most 50" },
      { metricId: "staffed_capacity_ready", operator: "eq", threshold: 1, role: "supporting", label: "Staffed capacity is available" },
    ],
    minimumEvidenceCoverage: 0.75,
    freshnessDays: 3,
    dedupeWindowDays: 14,
    cooldownDays: 7,
    expirationDays: 7,
    permittedActions: ["Prepare a localized clinic-awareness experiment"],
    stakeholderRole: "CVC",
    outcomeDefinition: "Qualified bookings or completed visits under an approved test",
    guardrails: ["Wait time", "Cancellations", "Staffed capacity"],
  }),
  playbookDefinitionSchema.parse({
    playbookId: "local-competitor-closure",
    version: PLAYBOOK_VERSION,
    sector: "ecosystem",
    evidenceStatus: "Hypothesis",
    allowedUse: "synthetic_prototype_only",
    eligibleRegionIds: ["cbsa:42660"],
    requiredMetricIds: ["closure_reported", "local_demand_change_pct", "replacement_competitor_present", "event_age_days"],
    conditions: [
      { metricId: "closure_reported", operator: "eq", threshold: 1, role: "eligibility", label: "Closure is reported" },
      { metricId: "local_demand_change_pct", operator: "gte", threshold: -5, role: "eligibility", label: "Demand is stable" },
      { metricId: "event_age_days", operator: "lte", threshold: 30, role: "eligibility", label: "Event is within 30 days" },
      { metricId: "replacement_competitor_present", operator: "eq", threshold: 0, role: "supporting", label: "No replacement competitor is present" },
    ],
    minimumEvidenceCoverage: 0.75,
    freshnessDays: 30,
    dedupeWindowDays: 30,
    cooldownDays: 14,
    expirationDays: 30,
    permittedActions: ["Prepare a synthetic regional acquisition and clinic-awareness response plan"],
    stakeholderRole: "Seattle Market Expansion Lead",
    outcomeDefinition: "Synthetic incremental qualified response during a bounded 14-day test",
    guardrails: ["Acquisition cost", "Inventory availability", "Delivery coverage", "Campaign saturation", "Clinic capacity", "Wait time", "Cancellations"],
    ecosystemActionPolicy: {
      deadlineHours: 48,
      testDurationDays: 14,
      demandFloorPct: -5,
      maximumCampaignSaturationIndex: 60,
      accountableOwner: {
        role: "Market Expansion",
        displayName: "Seattle Market Expansion Lead",
        synthetic: true,
      },
      recommendedCourseOfAction: "Initiate a synthetic 14-day regional acquisition and clinic-awareness test plan for the affected Seattle service area.",
    },
  }),
] as const;

function draftFor(sector: OpportunitySector, sourceIds: string[]): OpportunityDraft {
  const common = {
    state: "not_requested" as const,
    sourceIds,
    origin: "deterministic_fallback" as const,
    modelVersion: null,
    promptVersion: PROMPT_VERSION,
  };
  if (sector === "marketing") return { ...common, headline: "Seattle acquisition signal is ready for review", explanation: "Synthetic category interest is increasing while synthetic Chewy penetration and marketing reach remain below configured demonstration thresholds.", uncertainty: "These values are synthetic and do not establish a real Seattle acquisition opportunity.", suggestedAction: "Prepare a controlled regional acquisition-test brief for Marketing review." };
  if (sector === "pet_health") return { ...common, headline: "Seattle clinic-awareness signal is ready for review", explanation: "Synthetic appointment interest is increasing while synthetic capacity remains available and awareness remains below the demonstration threshold.", uncertainty: "The fixture does not represent real appointment demand, staffing, capacity, or awareness.", suggestedAction: "Prepare a localized clinic-awareness experiment for CVC review." };
  return { ...common, headline: "Seattle competitive-change signal is ready for review", explanation: "A synthetic retailer closure is marked verified while synthetic local demand remains stable.", uncertainty: "The closure and demand observations are fictional and require real verification before use.", suggestedAction: "Route a source-linked investigation to an approved stakeholder." };
}

function windowKey(at: string, windowDays: number): string {
  return String(Math.floor(new Date(at).getTime() / (windowDays * DAY_MS)));
}

function ruleCopy(sector: OpportunitySector) {
  if (sector === "marketing") return ["Growing interest with a penetration and reach gap", "Synthetic interest, penetration, and reach pass the versioned demonstration gates."] as const;
  if (sector === "pet_health") return ["Growing appointment interest with usable capacity", "Synthetic appointment interest, capacity, and awareness pass the versioned demonstration gates."] as const;
  return ["Reported local change with stable demand", "The synthetic report, demand, and event window pass the initial versioned detection gates; the ActionPacket evaluates the richer operating policy."] as const;
}

function evaluatePlaybook(
  batch: ValidatedSignalBatch,
  playbook: PlaybookDefinition,
  effectiveAt: string,
): Opportunity | null {
  const observations = new Map(
    batch.events.filter((event) => event.sector === playbook.sector).map((event) => [event.metricId, event]),
  );
  const firstCondition = playbook.conditions[0];
  const firstEvent = observations.get(firstCondition.metricId);
  if (!firstEvent || conditionPasses(firstCondition, firstEvent) !== true) return null;

  const evidence: OpportunityEvidence[] = [];
  for (const metricId of playbook.requiredMetricIds) {
    const event = observations.get(metricId);
    const condition = conditionForMetric(playbook, metricId);
    if (!event || event.rawValue === null) {
      evidence.push(missingEvidence(metricId));
      continue;
    }
    const freshness = freshnessFor(event.observedAt, effectiveAt, playbook.freshnessDays);
    if (freshness === "stale" && condition?.role === "eligibility") return null;
    const passes = condition ? conditionPasses(condition, event) : true;
    if (condition?.role === "eligibility" && passes === false) return null;
    evidence.push(evidenceFromEvent(event, passes === false ? "contradicting" : "supporting", effectiveAt, playbook.freshnessDays));
  }

  const available = evidence.filter((item) => !["missing", "stale"].includes(item.role) && item.rawValue !== null).length;
  const coverage = available / playbook.requiredMetricIds.length;
  const detectedAt = batch.receivedAt;
  const dedupeKey = `${batch.regionId}:${playbook.playbookId}:${windowKey(detectedAt, playbook.dedupeWindowDays)}`;
  const sourceIds = [...new Set(evidence.filter((item) => item.sourceId !== "Unknown").map((item) => item.sourceId))];
  const [ruleLabel, ruleExplanation] = ruleCopy(playbook.sector);
  const sectorLabel = playbook.sector === "marketing" ? "Customer acquisition and marketing" : playbook.sector === "pet_health" ? "Pet Health and CVC" : "Competitive and local ecosystem changes";
  const opportunityId = `opp:${dedupeKey}`;
  const expiresAt = new Date(new Date(detectedAt).getTime() + playbook.expirationDays * DAY_MS).toISOString();
  const actionPacket = playbook.sector === "ecosystem"
    ? assembleActionPacket({
        batch,
        playbook,
        opportunityId,
        generatedAt: effectiveAt,
        expiresAt,
        evidence,
      })
    : null;
  const actionPacketExplanation = actionPacket
    ? deterministicActionPacketExplanation(actionPacket)
    : null;
  const state = actionPacket
    ? actionPacket.systemDisposition === "advance"
      ? "prepared"
      : actionPacket.systemDisposition === "stop"
        ? "stopped"
        : "blocked"
    : "needs_review";
  const draft = actionPacketExplanation
    ? {
        state: "available" as const,
        headline: actionPacketExplanation.headline,
        explanation: actionPacketExplanation.summary,
        uncertainty: actionPacketExplanation.limitation,
        suggestedAction: actionPacketExplanation.courseOfAction,
        sourceIds: actionPacketExplanation.sourceIds,
        origin: actionPacketExplanation.origin,
        modelVersion: actionPacketExplanation.modelVersion,
        promptVersion: actionPacketExplanation.promptVersion,
      }
    : draftFor(playbook.sector, sourceIds);

  return opportunitySchema.parse({
    schemaVersion: OPPORTUNITY_SCHEMA_VERSION,
    opportunityId,
    dedupeKey,
    inputFingerprint: `${batch.batchId}:${batch.fixtureVersion}:${CALCULATION_VERSION}`,
    sector: playbook.sector,
    sectorLabel,
    playbookId: playbook.playbookId,
    playbookVersion: playbook.version,
    regionId: batch.regionId,
    regionName: batch.regionName,
    geographyVintage: GEOGRAPHY_VINTAGE,
    state,
    detectedAt,
    updatedAt: effectiveAt,
    expiresAt,
    ruleLabel,
    ruleExplanation,
    triggeringRuleResult: coverage >= playbook.minimumEvidenceCoverage ? "qualified" : "insufficient_evidence",
    evidenceCoverage: coverage,
    owner: playbook.stakeholderRole,
    permittedActions: playbook.permittedActions,
    evidence,
    draft,
    reviewDecisions: [],
    deliveryReceipts: [],
    humanDisposition: null,
    actionPacket,
    actionPacketExplanation,
    batchId: batch.batchId,
    fixtureVersion: batch.fixtureVersion,
    inputVersion: `${batch.fixtureVersion}:${batch.batchId}`,
    calculationVersion: CALCULATION_VERSION,
    evidenceSnapshotVersion: `${batch.fixtureVersion}:${batch.batchId}`,
    persistence: "process_local_prototype",
  });
}

export function runPlaybooks(
  batch: ValidatedSignalBatch,
  effectiveAt = batch.receivedAt,
): Opportunity[] {
  return PLAYBOOKS.map((playbook) => evaluatePlaybook(batch, playbook, effectiveAt))
    .filter((item): item is Opportunity => item !== null);
}
