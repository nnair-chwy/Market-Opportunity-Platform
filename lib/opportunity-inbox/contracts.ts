import { z } from "zod";

export const OPPORTUNITY_SCHEMA_VERSION = "opportunity-inbox-v1" as const;
export const PLAYBOOK_VERSION = "seattle-three-sector-v2" as const;
export const FIXTURE_VERSION = "seattle-opportunity-fixtures-v2" as const;
export const CALCULATION_VERSION = "opportunity-discovery-v2" as const;
export const ACTION_PACKET_VERSION = "ecosystem-action-packet-v1" as const;
export const ACTION_PACKET_PROMPT_VERSION = "ecosystem-action-packet-explanation-v1" as const;
export const GEOGRAPHY_VINTAGE = "2023-07" as const;

export const sectorSchema = z.enum(["marketing", "pet_health", "ecosystem"]);
export type OpportunitySector = z.infer<typeof sectorSchema>;

export const evidenceStatusSchema = z.enum([
  "Confirmed",
  "Reported",
  "Derived",
  "Hypothesis",
  "Unknown",
]);
export const qualityStatusSchema = z.enum(["accepted", "warning", "rejected"]);
export const freshnessStateSchema = z.enum(["current", "stale", "unknown"]);
export const processingStateSchema = z.enum([
  "validated",
  "rejected",
  "quarantined",
]);
export const evidenceRoleSchema = z.enum([
  "supporting",
  "contradicting",
  "missing",
  "stale",
  "rejected",
  "quarantined",
]);

export const opportunityStateSchema = z.enum([
  "detected",
  "validating",
  "needs_review",
  "approved_for_routing",
  "routed",
  "investigating",
  "actioned",
  "dismissed",
  "prepared",
  "blocked",
  "stopped",
  "expired",
]);
export type OpportunityState = z.infer<typeof opportunityStateSchema>;

export const signalEventSchema = z.object({
  observationId: z.string().min(1),
  dedupeKey: z.string().min(1),
  sector: sectorSchema,
  regionId: z.literal("cbsa:42660"),
  metricId: z.string().min(1),
  rawValue: z.number().finite().nullable(),
  unit: z.string().min(1),
  observedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  sourceId: z.string().min(1),
  evidenceStatus: z.enum(["Derived", "Hypothesis"]),
  qualityStatus: qualityStatusSchema,
  freshnessState: freshnessStateSchema.default("unknown"),
  sensitivity: z.literal("internal"),
  allowedUse: z.literal("synthetic_prototype_only"),
  payloadVersion: z.string().min(1),
  processingState: z.literal("validated"),
  label: z.string().min(1),
}).strict();
export type SignalEvent = z.infer<typeof signalEventSchema>;

const contextObservationBaseSchema = z.object({
  observationId: z.string().min(1),
  fieldId: z.enum([
    "retailer_identity",
    "synthetic_location",
    "event_type",
    "closure_verification_status",
    "closure_permanence",
    "closure_effective_date",
    "source_verification_record",
    "approved_geography",
    "delivery_coverage_available",
    "nearby_cvc_presence",
    "campaign_saturation_index",
    "inventory_constraint_present",
    "competing_retailer_count",
  ]),
  label: z.string().min(1),
  sourceId: z.string().min(1),
  evidenceStatus: z.enum(["Derived", "Hypothesis", "Unknown"]),
  qualityStatus: qualityStatusSchema,
  observedAt: z.string().datetime().nullable(),
  receivedAt: z.string().datetime(),
  sensitivity: z.literal("internal"),
  allowedUse: z.literal("synthetic_prototype_only"),
  payloadVersion: z.string().min(1),
  processingState: z.literal("validated"),
});

export const ecosystemContextObservationSchema = z.discriminatedUnion("valueType", [
  contextObservationBaseSchema.extend({
    valueType: z.literal("string"),
    value: z.string().min(1).nullable(),
    unit: z.null(),
  }).strict(),
  contextObservationBaseSchema.extend({
    valueType: z.literal("boolean"),
    value: z.boolean().nullable(),
    unit: z.null(),
  }).strict(),
  contextObservationBaseSchema.extend({
    valueType: z.literal("number"),
    value: z.number().finite().nullable(),
    unit: z.string().min(1),
  }).strict(),
  contextObservationBaseSchema.extend({
    valueType: z.literal("date"),
    value: z.string().date().nullable(),
    unit: z.null(),
  }).strict(),
]);
export type EcosystemContextObservation = z.infer<typeof ecosystemContextObservationSchema>;

export const signalBatchEnvelopeSchema = z.object({
  schemaVersion: z.literal(OPPORTUNITY_SCHEMA_VERSION),
  fixtureVersion: z.literal(FIXTURE_VERSION),
  batchId: z.string().min(1),
  regionId: z.literal("cbsa:42660"),
  regionName: z.literal("Seattle-Tacoma-Bellevue, WA"),
  receivedAt: z.string().datetime(),
  events: z.array(z.unknown()),
  context: z.array(z.unknown()).default([]),
}).strict();

export const quarantineReceiptSchema = z.object({
  receiptId: z.string().min(1),
  batchId: z.string().min(1),
  observationId: z.string().nullable(),
  dedupeKey: z.string().nullable(),
  processingState: z.enum(["rejected", "quarantined"]),
  reasons: z.array(z.string().min(1)).min(1),
  recordedAt: z.string().datetime(),
});
export type QuarantineReceipt = z.infer<typeof quarantineReceiptSchema>;

export type ValidatedSignalBatch = Omit<
  z.infer<typeof signalBatchEnvelopeSchema>,
  "events" | "context"
> & {
  events: SignalEvent[];
  context: EcosystemContextObservation[];
  quarantineReceipts: QuarantineReceipt[];
  duplicateObservationIds: string[];
  quarantinedCount: number;
  duplicateObservationCount: number;
};

export const evidenceObservationSchema = z.object({
  observationId: z.string().min(1),
  metricId: z.string().min(1),
  rawValue: z.number().finite().nullable(),
  unit: z.string().min(1),
  regionId: z.literal("cbsa:42660"),
  sourceId: z.string().min(1),
  observedAt: z.string().datetime().nullable(),
  receivedAt: z.string().datetime(),
  evidenceStatus: evidenceStatusSchema,
  qualityStatus: qualityStatusSchema,
  freshnessState: freshnessStateSchema,
  sensitivity: z.literal("internal"),
  allowedUse: z.literal("synthetic_prototype_only"),
  calculationVersion: z.string().nullable(),
  processingState: processingStateSchema,
});
export type EvidenceObservation = z.infer<typeof evidenceObservationSchema>;

const playbookConditionSchema = z.object({
  metricId: z.string().min(1),
  operator: z.enum(["gte", "lte", "eq"]),
  threshold: z.number().finite(),
  role: z.enum(["eligibility", "supporting", "contradicting"]),
  label: z.string().min(1),
});

const ecosystemActionPolicySchema = z.object({
  deadlineHours: z.number().int().positive(),
  testDurationDays: z.number().int().positive(),
  demandFloorPct: z.number().finite(),
  maximumCampaignSaturationIndex: z.number().finite(),
  accountableOwner: z.object({
    role: z.string().min(1),
    displayName: z.string().min(1),
    synthetic: z.literal(true),
  }),
  recommendedCourseOfAction: z.string().min(1),
});

export const playbookDefinitionSchema = z.object({
  playbookId: z.string().min(1),
  version: z.literal(PLAYBOOK_VERSION),
  sector: sectorSchema,
  evidenceStatus: z.literal("Hypothesis"),
  allowedUse: z.literal("synthetic_prototype_only"),
  eligibleRegionIds: z.tuple([z.literal("cbsa:42660")]),
  requiredMetricIds: z.array(z.string().min(1)).min(1),
  conditions: z.array(playbookConditionSchema).min(1),
  minimumEvidenceCoverage: z.number().min(0).max(1),
  freshnessDays: z.number().int().positive(),
  dedupeWindowDays: z.number().int().positive(),
  cooldownDays: z.number().int().nonnegative(),
  expirationDays: z.number().int().positive(),
  permittedActions: z.array(z.string().min(1)).min(1),
  stakeholderRole: z.string().min(1),
  outcomeDefinition: z.string().min(1),
  guardrails: z.array(z.string().min(1)).min(1),
  ecosystemActionPolicy: ecosystemActionPolicySchema.optional(),
});
export type PlaybookDefinition = z.infer<typeof playbookDefinitionSchema>;

export const opportunityEvidenceSchema = z.object({
  observationId: z.string().min(1),
  metricId: z.string().min(1),
  sourceId: z.string().min(1),
  label: z.string().min(1),
  role: evidenceRoleSchema,
  evidenceStatus: evidenceStatusSchema,
  qualityStatus: qualityStatusSchema,
  freshnessState: freshnessStateSchema,
  rawValue: z.number().finite().nullable(),
  unit: z.string().min(1),
  observedAt: z.string().datetime().nullable(),
  allowedUse: z.literal("synthetic_prototype_only"),
  sensitivity: z.literal("internal"),
  calculationVersion: z.string().nullable(),
});
export type OpportunityEvidence = z.infer<typeof opportunityEvidenceSchema>;

export const conditionEvaluationSchema = z.enum(["met", "not_met", "unknown"]);
export const systemDispositionSchema = z.enum(["advance", "stop", "blocked"]);

const packetConditionSchema = z.object({
  conditionId: z.string().min(1),
  label: z.string().min(1),
  evaluation: conditionEvaluationSchema,
  evidenceIds: z.array(z.string().min(1)),
});

const completedAnalysisSchema = z.object({
  analysisId: z.string().min(1),
  label: z.string().min(1),
  finding: z.string().min(1),
  evaluation: conditionEvaluationSchema,
  evidenceIds: z.array(z.string().min(1)),
});

const actionPacketBlockerSchema = z.object({
  blockerId: z.string().min(1),
  label: z.string().min(1),
  reason: z.string().min(1),
  state: z.enum(["open", "resolved"]),
  evidenceIds: z.array(z.string().min(1)),
});

export const actionPacketSchema = z.object({
  packetId: z.string().min(1),
  packetVersion: z.literal(ACTION_PACKET_VERSION),
  playbookId: z.literal("local-competitor-closure"),
  playbookVersion: z.literal(PLAYBOOK_VERSION),
  opportunityId: z.string().min(1),
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  regionId: z.literal("cbsa:42660"),
  regionName: z.literal("Seattle-Tacoma-Bellevue, WA"),
  synthetic: z.literal(true),
  systemDisposition: systemDispositionSchema,
  recommendedCourseOfAction: z.string().min(1),
  accountableOwner: ecosystemActionPolicySchema.shape.accountableOwner,
  deadline: z.object({
    slaHours: z.number().int().positive(),
    basis: z.literal("batch_received_at"),
    dueAt: z.string().datetime(),
    calculationVersion: z.literal(CALCULATION_VERSION),
  }),
  situation: z.object({
    retailerIdentity: z.string().nullable(),
    syntheticLocation: z.string().nullable(),
    eventType: z.string().nullable(),
    effectiveDate: z.string().date().nullable(),
    eventAgeDays: z.number().finite().nullable(),
    demandChangePct: z.number().finite().nullable(),
  }),
  completedAnalysis: z.array(completedAnalysisSchema),
  remainingBlockers: z.array(actionPacketBlockerSchema),
  orderedActions: z.array(z.object({
    order: z.number().int().positive(),
    action: z.string().min(1),
    owner: z.string().min(1),
    status: z.literal("prepared"),
  })).min(1),
  advanceConditions: z.array(packetConditionSchema).min(1),
  stopConditions: z.array(packetConditionSchema).min(1),
  measurableOutcome: z.object({
    name: z.string().min(1),
    definition: z.string().min(1),
    target: z.string().min(1),
    baseline: z.string().min(1),
    measurementWindowDays: z.number().int().positive(),
    evidenceStatus: z.literal("Hypothesis"),
  }),
  guardrails: z.array(z.object({
    guardrailId: z.string().min(1),
    label: z.string().min(1),
    threshold: z.string().min(1),
    evaluation: conditionEvaluationSchema,
    evidenceIds: z.array(z.string().min(1)),
    evidenceStatus: z.literal("Hypothesis"),
  })).min(1),
  assumptions: z.array(z.string().min(1)).min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
  inputVersion: z.string().min(1),
  calculationVersion: z.literal(CALCULATION_VERSION),
  evidenceSnapshotVersion: z.string().min(1),
});
export type ActionPacket = z.infer<typeof actionPacketSchema>;

export const actionPacketExplanationSchema = z.object({
  state: z.enum([
    "deterministic_fallback",
    "available",
    "not_configured",
    "timeout",
    "provider_error",
    "invalid_structure",
    "validation_rejected",
  ]),
  headline: z.string().min(1),
  summary: z.string().min(1),
  courseOfAction: z.string().min(1),
  limitation: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
  origin: z.enum(["deterministic_fallback", "ai"]),
  modelVersion: z.string().nullable(),
  promptVersion: z.literal(ACTION_PACKET_PROMPT_VERSION),
});
export type ActionPacketExplanation = z.infer<typeof actionPacketExplanationSchema>;

export const opportunityDraftSchema = z.object({
  state: z.enum(["not_requested", "unavailable", "available", "rejected"]),
  headline: z.string().min(1),
  explanation: z.string().min(1),
  uncertainty: z.string().min(1),
  suggestedAction: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  origin: z.enum(["deterministic_fallback", "ai"]),
  modelVersion: z.string().nullable(),
  promptVersion: z.string(),
});
export type OpportunityDraft = z.infer<typeof opportunityDraftSchema>;

export const reviewDecisionSchema = z.object({
  decisionId: z.string().min(1),
  action: z.enum(["approve", "dismiss", "request_evidence"]),
  priorState: opportunityStateSchema,
  nextState: opportunityStateSchema,
  reason: z.string().min(1),
  reviewer: z.string().min(1),
  decidedAt: z.string().datetime(),
});
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

export const deliveryReceiptSchema = z.object({
  receiptId: z.string().min(1),
  channel: z.enum(["outlook", "slack"]),
  intendedStakeholder: z.string().min(1),
  subject: z.string().min(1),
  message: z.string().min(1),
  status: z.literal("simulated"),
  generatedAt: z.string().datetime(),
});
export type DeliveryReceipt = z.infer<typeof deliveryReceiptSchema>;

export const outcomeObservationSchema = z.object({
  opportunityId: z.string().min(1),
  actionType: z.string().min(1),
  owner: z.string().min(1),
  outcomeDefinition: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date().nullable(),
  resultSource: z.string().min(1),
  resultValue: z.union([z.number().finite(), z.string().min(1)]).nullable(),
  evidenceStatus: evidenceStatusSchema,
});
export type OutcomeObservation = z.infer<typeof outcomeObservationSchema>;

export const opportunitySchema = z.object({
  schemaVersion: z.literal(OPPORTUNITY_SCHEMA_VERSION),
  opportunityId: z.string().min(1),
  dedupeKey: z.string().min(1),
  inputFingerprint: z.string().min(1),
  sector: sectorSchema,
  sectorLabel: z.string().min(1),
  playbookId: z.string().min(1),
  playbookVersion: z.literal(PLAYBOOK_VERSION),
  regionId: z.literal("cbsa:42660"),
  regionName: z.literal("Seattle-Tacoma-Bellevue, WA"),
  geographyVintage: z.literal(GEOGRAPHY_VINTAGE),
  state: opportunityStateSchema,
  detectedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  ruleLabel: z.string().min(1),
  ruleExplanation: z.string().min(1),
  triggeringRuleResult: z.enum(["qualified", "insufficient_evidence"]),
  evidenceCoverage: z.number().min(0).max(1),
  owner: z.string().min(1),
  permittedActions: z.array(z.string().min(1)).min(1),
  evidence: z.array(opportunityEvidenceSchema),
  draft: opportunityDraftSchema,
  reviewDecisions: z.array(reviewDecisionSchema),
  deliveryReceipts: z.array(deliveryReceiptSchema),
  humanDisposition: z.enum(["approved", "dismissed", "evidence_requested"]).nullable(),
  actionPacket: actionPacketSchema.nullable().default(null),
  actionPacketExplanation: actionPacketExplanationSchema.nullable().default(null),
  batchId: z.string().min(1),
  fixtureVersion: z.literal(FIXTURE_VERSION),
  inputVersion: z.string().min(1),
  calculationVersion: z.literal(CALCULATION_VERSION),
  evidenceSnapshotVersion: z.string().min(1),
  persistence: z.literal("process_local_prototype"),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

export const discoveryRunSchema = z.object({
  runId: z.string().min(1),
  batchId: z.string().min(1),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: z.enum(["completed", "completed_with_warnings", "failed"]),
  acceptedObservations: z.number().int().nonnegative(),
  quarantinedObservations: z.number().int().nonnegative(),
  duplicateObservations: z.number().int().nonnegative(),
  candidatesCreated: z.number().int().nonnegative(),
  candidatesUpdated: z.number().int().nonnegative().default(0),
  candidatesSuppressed: z.number().int().nonnegative(),
  candidatesExpired: z.number().int().nonnegative().default(0),
  quarantineReceipts: z.array(quarantineReceiptSchema).default([]),
  inputVersion: z.string().min(1),
  calculationVersion: z.literal(CALCULATION_VERSION),
  message: z.string().min(1),
});
export type DiscoveryRun = z.infer<typeof discoveryRunSchema>;

export const marketScanStateSchema = z.enum([
  "pending",
  "scanned_no_signal",
  "opportunity_qualified",
  "blocked_stale",
  "blocked_missing",
  "duplicate_suppressed",
  "quarantined",
  "failed",
]);
export type MarketScanState = z.infer<typeof marketScanStateSchema>;

export const marketScanStatusSchema = z.object({
  marketId: z.string().min(1),
  cbsaCode: z.string().regex(/^\d{5}$/),
  marketName: z.string().min(1),
  stateCodes: z.array(z.string().min(2)),
  scanState: marketScanStateSchema,
  opportunityCount: z.number().int().nonnegative(),
  detail: z.string().min(1),
  observedAt: z.string().datetime().nullable(),
  evidenceStatus: z.enum(["Derived", "Hypothesis", "Unknown"]),
  allowedUse: z.literal("synthetic_prototype_only"),
  scoringEligibility: z.literal("none"),
});
export type MarketScanStatus = z.infer<typeof marketScanStatusSchema>;

export const discoveryStageReceiptSchema = z.object({
  stageId: z.enum(["ingest", "validate", "detect", "qualify", "route"]),
  label: z.string().min(1),
  count: z.number().int().nonnegative(),
  unit: z.string().min(1),
  status: z.enum(["pending", "completed", "completed_with_warnings"]),
  detail: z.string().min(1),
});
export type DiscoveryStageReceipt = z.infer<typeof discoveryStageReceiptSchema>;

export const discoveryActivityEventSchema = z.object({
  eventId: z.string().min(1),
  marketId: z.string().min(1),
  marketName: z.string().min(1),
  scanState: marketScanStateSchema,
  occurredAt: z.string().datetime(),
  title: z.string().min(1),
  detail: z.string().min(1),
  evidenceStatus: z.enum(["Derived", "Hypothesis"]),
});
export type DiscoveryActivityEvent = z.infer<typeof discoveryActivityEventSchema>;

export const portfolioMetricsSchema = z.object({
  monitoredMarkets: z.number().int().nonnegative(),
  scannedMarkets: z.number().int().nonnegative(),
  qualifiedMarkets: z.number().int().nonnegative(),
  activeOpportunities: z.number().int().nonnegative(),
  exceptionMarkets: z.number().int().nonnegative(),
  lastCompletedAt: z.string().datetime().nullable(),
});
export type PortfolioMetrics = z.infer<typeof portfolioMetricsSchema>;

export const reviewRequestSchema = z.object({
  action: z.enum(["approve", "dismiss", "request_evidence"]),
  reason: z.string().trim().min(3).max(600),
  reviewer: z.string().trim().min(1).max(120).default("Demo reviewer"),
});

export const deliveryPreviewRequestSchema = z.object({
  channel: z.enum(["outlook", "slack"]),
});

export type OpportunityInboxSnapshot = {
  opportunities: Opportunity[];
  historicalOpportunities: Opportunity[];
  runs: DiscoveryRun[];
  nextBatchId: string;
  marketStatuses: MarketScanStatus[];
  stageReceipts: DiscoveryStageReceipt[];
  activityEvents: DiscoveryActivityEvent[];
  portfolioMetrics: PortfolioMetrics;
};
