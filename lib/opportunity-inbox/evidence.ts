import {
  CALCULATION_VERSION,
  type OpportunityEvidence,
  type SignalEvent,
} from "./contracts.ts";

const DAY_MS = 86_400_000;

export function freshnessFor(
  observedAt: string,
  effectiveAt: string,
  freshnessDays: number,
): "current" | "stale" {
  return new Date(effectiveAt).getTime() - new Date(observedAt).getTime() >
      freshnessDays * DAY_MS
    ? "stale"
    : "current";
}

export function missingEvidence(
  metricId: string,
): OpportunityEvidence {
  return {
    observationId: `missing:${metricId}`,
    metricId,
    sourceId: "Unknown",
    label: `Missing ${metricId.replaceAll("_", " ")}`,
    role: "missing",
    evidenceStatus: "Unknown",
    qualityStatus: "warning",
    freshnessState: "unknown",
    rawValue: null,
    unit: "unknown",
    observedAt: null,
    allowedUse: "synthetic_prototype_only",
    sensitivity: "internal",
    calculationVersion: null,
  };
}

export function evidenceFromEvent(
  event: SignalEvent,
  role: "supporting" | "contradicting",
  effectiveAt: string,
  freshnessDays: number,
): OpportunityEvidence {
  const freshnessState = freshnessFor(
    event.observedAt,
    effectiveAt,
    freshnessDays,
  );
  return {
    observationId: event.observationId,
    metricId: event.metricId,
    sourceId: event.sourceId,
    label: event.label,
    role: freshnessState === "stale" ? "stale" : role,
    evidenceStatus: event.evidenceStatus,
    qualityStatus: freshnessState === "stale" ? "warning" : event.qualityStatus,
    freshnessState,
    rawValue: event.rawValue,
    unit: event.unit,
    observedAt: event.observedAt,
    allowedUse: event.allowedUse,
    sensitivity: event.sensitivity,
    calculationVersion:
      event.evidenceStatus === "Derived" ? CALCULATION_VERSION : null,
  };
}
