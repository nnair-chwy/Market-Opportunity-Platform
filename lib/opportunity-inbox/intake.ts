import {
  ecosystemContextObservationSchema,
  signalBatchEnvelopeSchema,
  signalEventSchema,
  type EcosystemContextObservation,
  type SignalEvent,
  type ValidatedSignalBatch,
} from "./contracts.ts";

export function validateSignalBatch(input: unknown): ValidatedSignalBatch {
  const envelope = signalBatchEnvelopeSchema.parse(input);
  const accepted: SignalEvent[] = [];
  const acceptedContext: EcosystemContextObservation[] = [];
  const dedupeKeys = new Set<string>();
  const quarantineReceipts: ValidatedSignalBatch["quarantineReceipts"] = [];
  const duplicateObservationIds: string[] = [];

  for (const [index, rawEvent] of envelope.events.entries()) {
    const raw = rawEvent && typeof rawEvent === "object"
      ? rawEvent as Record<string, unknown>
      : {};
    const result = signalEventSchema.safeParse({
      ...raw,
      receivedAt: raw.receivedAt ?? envelope.receivedAt,
      payloadVersion: raw.payloadVersion ?? envelope.fixtureVersion,
      processingState: "validated",
    });
    if (!result.success || result.data.qualityStatus === "rejected") {
      const reasons = result.success
        ? ["The source marked this synthetic observation as rejected."]
        : result.error.issues.map((issue) => `${issue.path.join(".") || "event"}: ${issue.message}`);
      quarantineReceipts.push({
        receiptId: `quarantine:${envelope.batchId}:${index}`,
        batchId: envelope.batchId,
        observationId: typeof raw.observationId === "string" ? raw.observationId : null,
        dedupeKey: typeof raw.dedupeKey === "string" ? raw.dedupeKey : null,
        processingState: raw.qualityStatus === "rejected" ? "rejected" : "quarantined",
        reasons,
        recordedAt: envelope.receivedAt,
      });
      continue;
    }
    if (dedupeKeys.has(result.data.dedupeKey)) {
      duplicateObservationIds.push(result.data.observationId);
      continue;
    }
    dedupeKeys.add(result.data.dedupeKey);
    accepted.push(result.data);
  }

  const contextFieldIds = new Set<string>();
  for (const [index, rawObservation] of envelope.context.entries()) {
    const raw = rawObservation && typeof rawObservation === "object"
      ? rawObservation as Record<string, unknown>
      : {};
    const result = ecosystemContextObservationSchema.safeParse({
      ...raw,
      receivedAt: raw.receivedAt ?? envelope.receivedAt,
      payloadVersion: raw.payloadVersion ?? envelope.fixtureVersion,
      processingState: "validated",
    });
    if (!result.success || result.data.qualityStatus === "rejected") {
      const reasons = result.success
        ? ["The source marked this synthetic context observation as rejected."]
        : result.error.issues.map((issue) => `${issue.path.join(".") || "context"}: ${issue.message}`);
      quarantineReceipts.push({
        receiptId: `quarantine:${envelope.batchId}:context:${index}`,
        batchId: envelope.batchId,
        observationId: typeof raw.observationId === "string" ? raw.observationId : null,
        dedupeKey: typeof raw.fieldId === "string" ? raw.fieldId : null,
        processingState: raw.qualityStatus === "rejected" ? "rejected" : "quarantined",
        reasons,
        recordedAt: envelope.receivedAt,
      });
      continue;
    }
    if (contextFieldIds.has(result.data.fieldId)) {
      duplicateObservationIds.push(result.data.observationId);
      continue;
    }
    contextFieldIds.add(result.data.fieldId);
    acceptedContext.push(result.data);
  }

  return {
    ...envelope,
    events: accepted,
    context: acceptedContext,
    quarantineReceipts,
    duplicateObservationIds,
    quarantinedCount: quarantineReceipts.length,
    duplicateObservationCount: duplicateObservationIds.length,
  };
}
