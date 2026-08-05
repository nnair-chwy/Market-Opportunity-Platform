import type {
  EvidenceSource,
  EvidenceSummary,
  MetricEvidence,
  SourcePresentation,
  StructuredEvidenceResult,
} from "./types";

const RESTRICTED_SOURCE_ID = "Restricted source";
const RESTRICTED_SOURCE_LABEL = "Restricted information";

export function approvedSourceHref(
  source: Pick<EvidenceSource, "approvedSourceUrl" | "sensitivity">,
): string | null {
  if (source.sensitivity === "restricted" || !source.approvedSourceUrl) {
    return null;
  }

  try {
    const url = new URL(source.approvedSourceUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function presentSource(source: EvidenceSource): SourcePresentation {
  const isRestricted = source.sensitivity === "restricted";

  return {
    sourceId: isRestricted ? RESTRICTED_SOURCE_ID : source.sourceId,
    sourceLabel: isRestricted
      ? RESTRICTED_SOURCE_LABEL
      : source.sourceLabel,
    evidenceStatus: source.evidenceStatus,
    observedAt: isRestricted ? null : source.observedAt,
    extractedAt: isRestricted ? null : source.extractedAt,
    geography: isRestricted ? null : source.geography,
    aggregation: isRestricted ? null : source.aggregation,
    qualityStatus: source.qualityStatus,
    sensitivity: source.sensitivity,
    freshnessWarning: isRestricted ? null : source.freshnessWarning,
    approvedSourceUrl: approvedSourceHref(source),
    isRestricted,
  };
}

export function formatEvidenceDate(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatRawValue(
  value?: number | string | null,
  unit?: string | null,
): string {
  if (value === null || value === undefined || value === "") {
    return "Missing";
  }

  const displayValue =
    typeof value === "number"
      ? new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 2,
        }).format(value)
      : value;

  return unit ? `${displayValue} ${unit}` : String(displayValue);
}

export function sourcesForMetric(
  metric: MetricEvidence,
  sources?: readonly EvidenceSource[] | null,
): EvidenceSource[] {
  const byId = new Map((sources ?? []).map((source) => [source.sourceId, source]));
  return metric.sourceIds.flatMap((sourceId) => {
    const source = byId.get(sourceId);
    return source ? [source] : [];
  });
}

export function missingSourceIds(
  metric: MetricEvidence,
  sources?: readonly EvidenceSource[] | null,
): string[] {
  const known = new Set((sources ?? []).map((source) => source.sourceId));
  return metric.sourceIds.filter((sourceId) => !known.has(sourceId));
}

export function summarizeEvidence(
  result: StructuredEvidenceResult,
): EvidenceSummary {
  const sources = result.sources ?? [];
  const metrics = result.metrics ?? [];
  const dispositionCount = (disposition: MetricEvidence["disposition"]) =>
    metrics.filter((metric) => metric.disposition === disposition).length;

  return {
    totalSources: sources.length,
    availableSources: sources.filter(
      (source) =>
        source.sensitivity !== "restricted" &&
        source.evidenceStatus !== "Unknown",
    ).length,
    restrictedSources: sources.filter(
      (source) => source.sensitivity === "restricted",
    ).length,
    staleSources: sources.filter((source) => Boolean(source.freshnessWarning))
      .length,
    scoredMetrics: dispositionCount("scored"),
    missingMetrics: dispositionCount("missing"),
    excludedMetrics: dispositionCount("excluded"),
    rejectedMetrics: dispositionCount("rejected"),
    unscoredMetrics: dispositionCount("unscored"),
    qualitativeItems: result.qualitativeEvidence?.length ?? 0,
    warningCount: result.warnings?.length ?? 0,
  };
}
