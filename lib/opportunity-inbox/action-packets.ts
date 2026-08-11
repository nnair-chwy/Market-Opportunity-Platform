import {
  ACTION_PACKET_PROMPT_VERSION,
  ACTION_PACKET_VERSION,
  CALCULATION_VERSION,
  actionPacketExplanationSchema,
  actionPacketSchema,
  type ActionPacket,
  type ActionPacketExplanation,
  type EcosystemContextObservation,
  type OpportunityEvidence,
  type PlaybookDefinition,
  type ValidatedSignalBatch,
} from "./contracts.ts";

type PacketInput = {
  batch: ValidatedSignalBatch;
  playbook: PlaybookDefinition;
  opportunityId: string;
  generatedAt: string;
  expiresAt: string;
  evidence: OpportunityEvidence[];
};

type Evaluation = "met" | "not_met" | "unknown";

function contextMap(context: EcosystemContextObservation[]) {
  return new Map(context.map((item) => [item.fieldId, item]));
}

function evidenceMap(evidence: OpportunityEvidence[]) {
  return new Map(evidence.map((item) => [item.metricId, item]));
}

function contextValue(
  context: Map<string, EcosystemContextObservation>,
  fieldId: EcosystemContextObservation["fieldId"],
) {
  return context.get(fieldId)?.value ?? null;
}

function contextEvidenceIds(
  context: Map<string, EcosystemContextObservation>,
  fieldId: EcosystemContextObservation["fieldId"],
) {
  const observationId = context.get(fieldId)?.observationId;
  return observationId ? [observationId] : [];
}

function metricValue(evidence: Map<string, OpportunityEvidence>, metricId: string) {
  return evidence.get(metricId)?.rawValue ?? null;
}

function metricEvidenceIds(evidence: Map<string, OpportunityEvidence>, metricId: string) {
  const observationId = evidence.get(metricId)?.observationId;
  return observationId && evidence.get(metricId)?.rawValue !== null ? [observationId] : [];
}

function equals(value: unknown, expected: unknown): Evaluation {
  if (value === null || value === undefined) return "unknown";
  return value === expected ? "met" : "not_met";
}

function atMost(value: unknown, threshold: number): Evaluation {
  if (typeof value !== "number") return "unknown";
  return value <= threshold ? "met" : "not_met";
}

function atLeast(value: unknown, threshold: number): Evaluation {
  if (typeof value !== "number") return "unknown";
  return value >= threshold ? "met" : "not_met";
}

function present(value: unknown): Evaluation {
  return value === null || value === undefined || value === "" ? "unknown" : "met";
}

function finding(label: string, evaluation: Evaluation, value: unknown) {
  if (evaluation === "unknown") return `${label} is not available in the validated synthetic evidence.`;
  const rendered = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return `${label}: ${rendered}.`;
}

export function deterministicActionPacketExplanation(packet: ActionPacket): ActionPacketExplanation {
  const retailer = packet.situation.retailerIdentity ?? "The fictional retailer";
  const location = packet.situation.syntheticLocation ?? "an unknown synthetic location";
  const demand = packet.situation.demandChangePct === null
    ? "synthetic demand is unavailable"
    : `synthetic local category demand is ${packet.situation.demandChangePct >= 0 ? "up " : "down "}${Math.abs(packet.situation.demandChangePct)}%`;
  const disposition = packet.systemDisposition === "advance"
    ? "passes every configured demonstration condition"
    : packet.systemDisposition === "stop"
      ? "meets at least one configured stop condition"
      : "is missing evidence required by the configured demonstration policy";

  return actionPacketExplanationSchema.parse({
    state: "deterministic_fallback",
    headline: packet.systemDisposition === "advance"
      ? "Synthetic Seattle retailer closure: initiate a bounded regional response plan"
      : packet.systemDisposition === "stop"
        ? "Synthetic Seattle retailer closure: close the response plan"
        : "Synthetic Seattle retailer closure: response plan is blocked",
    summary: `${retailer} at ${location} is fictionally recorded as a permanent closure. ${demand}, and the packet ${disposition}.`,
    courseOfAction: packet.recommendedCourseOfAction,
    limitation: "This packet uses fictional synthetic evidence and cannot initiate a real campaign, outreach, operational change, or market decision.",
    sourceIds: packet.sourceIds,
    origin: "deterministic_fallback",
    modelVersion: null,
    promptVersion: ACTION_PACKET_PROMPT_VERSION,
  });
}

export function assembleActionPacket(input: PacketInput): ActionPacket {
  const policy = input.playbook.ecosystemActionPolicy;
  if (input.playbook.playbookId !== "local-competitor-closure" || !policy) {
    throw new Error("The ecosystem action policy is required to assemble an ActionPacket.");
  }

  const context = contextMap(input.batch.context);
  const evidence = evidenceMap(input.evidence);
  const retailerIdentity = contextValue(context, "retailer_identity");
  const syntheticLocation = contextValue(context, "synthetic_location");
  const eventType = contextValue(context, "event_type");
  const verification = contextValue(context, "closure_verification_status");
  const permanence = contextValue(context, "closure_permanence");
  const effectiveDate = contextValue(context, "closure_effective_date");
  const sourceRecord = contextValue(context, "source_verification_record");
  const geography = contextValue(context, "approved_geography");
  const delivery = contextValue(context, "delivery_coverage_available");
  const cvcPresence = contextValue(context, "nearby_cvc_presence");
  const saturation = contextValue(context, "campaign_saturation_index");
  const inventoryConstraint = contextValue(context, "inventory_constraint_present");
  const competingRetailers = contextValue(context, "competing_retailer_count");
  const closureReported = metricValue(evidence, "closure_reported");
  const demand = metricValue(evidence, "local_demand_change_pct");
  const replacement = metricValue(evidence, "replacement_competitor_present");
  const eventAge = metricValue(evidence, "event_age_days");

  const checks = [
    { id: "closure_reported", label: "Closure is reported", value: closureReported, evaluation: equals(closureReported, 1), evidenceIds: metricEvidenceIds(evidence, "closure_reported") },
    { id: "retailer_identity", label: "Retailer identity is available", value: retailerIdentity, evaluation: present(retailerIdentity), evidenceIds: contextEvidenceIds(context, "retailer_identity") },
    { id: "synthetic_location", label: "Exact synthetic location is available", value: syntheticLocation, evaluation: present(syntheticLocation), evidenceIds: contextEvidenceIds(context, "synthetic_location") },
    { id: "source_verification", label: "Fictional source verification passes", value: verification, evaluation: equals(verification, "verified"), evidenceIds: contextEvidenceIds(context, "closure_verification_status") },
    { id: "source_record", label: "Fictional source verification record is available", value: sourceRecord, evaluation: present(sourceRecord), evidenceIds: contextEvidenceIds(context, "source_verification_record") },
    { id: "closure_permanence", label: "Closure is permanent", value: permanence, evaluation: equals(permanence, "permanent"), evidenceIds: contextEvidenceIds(context, "closure_permanence") },
    { id: "effective_date", label: "Closure effective date is available", value: effectiveDate, evaluation: present(effectiveDate), evidenceIds: contextEvidenceIds(context, "closure_effective_date") },
    { id: "approved_geography", label: "Event is inside the approved synthetic geography", value: geography, evaluation: equals(geography, true), evidenceIds: contextEvidenceIds(context, "approved_geography") },
    { id: "event_window", label: "Event is within 30 days", value: eventAge, evaluation: atMost(eventAge, 30), evidenceIds: metricEvidenceIds(evidence, "event_age_days") },
    { id: "demand_floor", label: `Demand is at least ${policy.demandFloorPct}%`, value: demand, evaluation: atLeast(demand, policy.demandFloorPct), evidenceIds: metricEvidenceIds(evidence, "local_demand_change_pct") },
    { id: "replacement_competitor", label: "No replacement competitor is confirmed", value: replacement, evaluation: equals(replacement, 0), evidenceIds: metricEvidenceIds(evidence, "replacement_competitor_present") },
    { id: "delivery_coverage", label: "Synthetic delivery coverage is available", value: delivery, evaluation: equals(delivery, true), evidenceIds: contextEvidenceIds(context, "delivery_coverage_available") },
    { id: "nearby_cvc_presence", label: "Synthetic nearby CVC presence is available", value: cvcPresence, evaluation: equals(cvcPresence, true), evidenceIds: contextEvidenceIds(context, "nearby_cvc_presence") },
    { id: "campaign_saturation", label: `Campaign saturation is at most ${policy.maximumCampaignSaturationIndex}`, value: saturation, evaluation: atMost(saturation, policy.maximumCampaignSaturationIndex), evidenceIds: contextEvidenceIds(context, "campaign_saturation_index") },
    { id: "inventory", label: "No synthetic inventory constraint is present", value: inventoryConstraint, evaluation: equals(inventoryConstraint, false), evidenceIds: contextEvidenceIds(context, "inventory_constraint_present") },
    { id: "competing_retailers", label: "Competing-retailer context is available", value: competingRetailers, evaluation: typeof competingRetailers === "number" ? "met" as const : "unknown" as const, evidenceIds: contextEvidenceIds(context, "competing_retailer_count") },
  ];

  const remainingBlockers = checks
    .filter((check) => check.evaluation === "unknown")
    .map((check) => ({
      blockerId: `blocker:${check.id}`,
      label: check.label,
      reason: "Required synthetic evidence is missing or explicitly Unknown.",
      state: "open" as const,
      evidenceIds: check.evidenceIds,
    }));
  const hasStopCondition = checks.some((check) => check.evaluation === "not_met");
  const systemDisposition = hasStopCondition ? "stop" : remainingBlockers.length ? "blocked" : "advance";
  const recommendedCourseOfAction = systemDisposition === "advance"
    ? policy.recommendedCourseOfAction
    : systemDisposition === "stop"
      ? "Close the synthetic regional response plan because a configured stop condition is met."
      : "Hold the synthetic regional response plan until every required fixture input is available.";
  const sourceIds = [...new Set([
    ...input.evidence.filter((item) => item.sourceId !== "Unknown").map((item) => item.sourceId),
    ...input.batch.context.map((item) => item.sourceId),
  ])].sort();
  const dueAt = new Date(new Date(input.batch.receivedAt).getTime() + policy.deadlineHours * 3_600_000).toISOString();

  return actionPacketSchema.parse({
    packetId: `packet:${input.opportunityId}`,
    packetVersion: ACTION_PACKET_VERSION,
    playbookId: "local-competitor-closure",
    playbookVersion: input.playbook.version,
    opportunityId: input.opportunityId,
    generatedAt: input.generatedAt,
    expiresAt: input.expiresAt,
    regionId: input.batch.regionId,
    regionName: input.batch.regionName,
    synthetic: true,
    systemDisposition,
    recommendedCourseOfAction,
    accountableOwner: policy.accountableOwner,
    deadline: {
      slaHours: policy.deadlineHours,
      basis: "batch_received_at",
      dueAt,
      calculationVersion: CALCULATION_VERSION,
    },
    situation: {
      retailerIdentity: typeof retailerIdentity === "string" ? retailerIdentity : null,
      syntheticLocation: typeof syntheticLocation === "string" ? syntheticLocation : null,
      eventType: typeof eventType === "string" ? eventType : null,
      effectiveDate: typeof effectiveDate === "string" ? effectiveDate : null,
      eventAgeDays: typeof eventAge === "number" ? eventAge : null,
      demandChangePct: typeof demand === "number" ? demand : null,
    },
    completedAnalysis: checks.map((check) => ({
      analysisId: `analysis:${check.id}`,
      label: check.label,
      finding: finding(check.label, check.evaluation, check.value),
      evaluation: check.evaluation,
      evidenceIds: check.evidenceIds,
    })),
    remainingBlockers,
    orderedActions: [
      "Define the synthetic affected service area from the validated fictional event location.",
      "Confirm eligible synthetic delivery and clinic-awareness coverage.",
      "Define a synthetic target audience and exclusion group.",
      "Apply campaign saturation and inventory guardrails.",
      "Prepare channel-ready acquisition and clinic-awareness messaging.",
      "Define the measurement window and versioned baseline.",
      "Record the simulated launch-readiness disposition without executing an action.",
    ].map((action, index) => ({ order: index + 1, action, owner: policy.accountableOwner.displayName, status: "prepared" })),
    advanceConditions: checks.map((check) => ({ conditionId: `advance:${check.id}`, label: check.label, evaluation: check.evaluation, evidenceIds: check.evidenceIds })),
    stopConditions: checks.filter((check) => check.evaluation === "not_met").map((check) => ({ conditionId: `stop:${check.id}`, label: `Stop when not true: ${check.label}`, evaluation: "met", evidenceIds: check.evidenceIds })).concat(
      checks.filter((check) => check.evaluation !== "not_met").map((check) => ({ conditionId: `stop:${check.id}`, label: `Stop when not true: ${check.label}`, evaluation: check.evaluation === "unknown" ? "unknown" as const : "not_met" as const, evidenceIds: check.evidenceIds })),
    ),
    measurableOutcome: {
      name: "Synthetic incremental qualified response",
      definition: "Change in qualified customer or booking response relative to the versioned synthetic pre-event baseline.",
      target: "At least 5% synthetic incremental qualified response.",
      baseline: "Versioned 14-day synthetic pre-event response baseline.",
      measurementWindowDays: policy.testDurationDays,
      evidenceStatus: "Hypothesis",
    },
    guardrails: [
      { guardrailId: "acquisition_cost", label: "Synthetic acquisition cost", threshold: "At or below the configured synthetic ceiling", evaluation: "unknown", evidenceIds: [], evidenceStatus: "Hypothesis" },
      { guardrailId: "inventory", label: "Inventory availability", threshold: "No active synthetic inventory constraint", evaluation: equals(inventoryConstraint, false), evidenceIds: contextEvidenceIds(context, "inventory_constraint_present"), evidenceStatus: "Hypothesis" },
      { guardrailId: "delivery", label: "Delivery coverage", threshold: "Synthetic delivery coverage remains available", evaluation: equals(delivery, true), evidenceIds: contextEvidenceIds(context, "delivery_coverage_available"), evidenceStatus: "Hypothesis" },
      { guardrailId: "campaign_saturation", label: "Campaign saturation", threshold: `Index at or below ${policy.maximumCampaignSaturationIndex}`, evaluation: atMost(saturation, policy.maximumCampaignSaturationIndex), evidenceIds: contextEvidenceIds(context, "campaign_saturation_index"), evidenceStatus: "Hypothesis" },
      { guardrailId: "clinic_capacity", label: "Clinic capacity", threshold: "Synthetic clinic capacity remains available", evaluation: equals(cvcPresence, true), evidenceIds: contextEvidenceIds(context, "nearby_cvc_presence"), evidenceStatus: "Hypothesis" },
      { guardrailId: "wait_time", label: "Wait time", threshold: "Within a future approved threshold", evaluation: "unknown", evidenceIds: [], evidenceStatus: "Hypothesis" },
      { guardrailId: "cancellations", label: "Cancellations", threshold: "Within a future approved threshold", evaluation: "unknown", evidenceIds: [], evidenceStatus: "Hypothesis" },
    ],
    assumptions: [
      "Every business identity, location, source record, threshold, and outcome in this packet is fictional synthetic configuration.",
      "The synthetic location is a label only and is not an approved trade area, service area, or real-world address.",
      "The packet prepares simulated planning artifacts and cannot launch a campaign, contact a stakeholder, or change an operational system.",
    ],
    sourceIds,
    inputVersion: `${input.batch.fixtureVersion}:${input.batch.batchId}`,
    calculationVersion: CALCULATION_VERSION,
    evidenceSnapshotVersion: `${input.batch.fixtureVersion}:${input.batch.batchId}`,
  });
}
