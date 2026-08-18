import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  CANONICAL_EVIDENCE_CALCULATION_VERSION,
  CANONICAL_EVIDENCE_QUERY_VERSION,
  canonicalSnapshotManifestSchema,
  evidenceExecutionRequestSchema,
  evidenceExecutionResponseSchema,
  type CanonicalSnapshotManifest,
  type EvidenceExecutionRequest,
  type EvidenceExecutionResponse,
  type ExecutionEvidenceItem,
} from "./contracts.ts";
import { closeDuckDb, duckDbPath, openDuckDb, sqlString } from "./duckdb.ts";
import { loadSourceStatus } from "./source-status.ts";

type DuckDbHandle = Awaited<ReturnType<typeof openDuckDb>>;

export type EvidenceExecutionOptions = {
  snapshotDir?: string;
  databasePath?: string;
  openDatabase?: (path: string, readOnly: boolean) => Promise<DuckDbHandle>;
  closeDatabase?: (handle: DuckDbHandle) => Promise<void>;
};

type QualityReport = {
  findings?: Array<{ findingId?: string; status?: string; message?: string }>;
};

function hash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function stringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function errorText(error: unknown, snapshotDir: string, databasePath: string): string {
  const message = error instanceof Error ? error.message : "Unknown evidence execution error.";
  return message.replaceAll(resolve(snapshotDir), "<snapshot>").replaceAll(resolve(databasePath), "<database>");
}

function responseBase(request: EvidenceExecutionRequest) {
  return {
    requestId: request.requestId,
    snapshotVersion: request.snapshotVersion,
    queryVersion: CANONICAL_EVIDENCE_QUERY_VERSION,
    calculationVersion: CANONICAL_EVIDENCE_CALCULATION_VERSION,
    query: request.query,
    componentQueries: [request.query],
    capability: null,
    planId: request.planId ?? null,
    originalQuestion: null,
    geographyIds: request.query === "canonical_market_evidence" || request.query === "canonical_clinic_performance"
      ? [request.parameters.marketId]
      : [],
    missingApprovals: [],
    guardrails: [],
    executionMode: request.executionMode,
  } as const;
}

function failed(request: EvidenceExecutionRequest, code: string, message: string): EvidenceExecutionResponse {
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(request),
    status: "failed",
    rows: [],
    evidenceBundle: [],
    sourceIds: [],
    qualityWarnings: [],
    missingEvidence: [],
    unknowns: [],
    allowedUse: "none",
    sensitivity: "internal",
    errorCode: code,
    errorMessage: message,
  });
}

function blocked(request: EvidenceExecutionRequest, input: {
  missingEvidence: string[];
  warnings?: string[];
  unknowns?: string[];
  sourceIds?: string[];
  allowedUse?: string;
  sensitivity?: EvidenceExecutionResponse["sensitivity"];
}): EvidenceExecutionResponse {
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(request),
    status: "blocked",
    rows: [],
    evidenceBundle: [],
    sourceIds: uniqueSorted(input.sourceIds ?? []),
    qualityWarnings: uniqueSorted(input.warnings ?? []),
    missingEvidence: uniqueSorted(input.missingEvidence),
    unknowns: uniqueSorted(input.unknowns ?? []),
    allowedUse: input.allowedUse ?? "none",
    sensitivity: input.sensitivity ?? "internal",
    errorCode: null,
    errorMessage: null,
  });
}

export async function validateCanonicalSnapshot(snapshotDir: string, requestedVersion: string): Promise<CanonicalSnapshotManifest> {
  const manifest = canonicalSnapshotManifestSchema.parse(JSON.parse(await readFile(join(snapshotDir, "manifest.json"), "utf8")));
  if (manifest.snapshotVersion !== requestedVersion) throw new Error(`Snapshot ${requestedVersion} is unavailable.`);
  for (const output of manifest.outputs) {
    const content = await readFile(join(snapshotDir, output.path));
    if (content.byteLength !== output.bytes) throw new Error(`Byte-count mismatch for ${output.path}.`);
    if (hash(content) !== output.sha256) throw new Error(`Hash mismatch for ${output.path}.`);
  }
  const sourceStatus = await loadSourceStatus(snapshotDir);
  if (sourceStatus.snapshotVersion !== manifest.snapshotVersion) throw new Error("Source-status snapshot version does not match the canonical manifest.");
  return manifest;
}

function registeredQuery(request: EvidenceExecutionRequest, snapshotDir: string): { sql: string; values: Array<string | null>; requiredOutput: string } {
  const canonicalPath = join(snapshotDir, "evidence_observations.parquet");
  if (request.query === "canonical_market_evidence") return {
    sql: `SELECT observation_id, market_id, cbsa_code, market_name, evidence_domain, metric_id, raw_value, unit, observed_at, source_id, source_file, evidence_status, quality_status, sensitivity, allowed_use, warning, is_synthetic FROM read_parquet(${sqlString(canonicalPath)}) WHERE market_id = ? AND evidence_domain = 'market_context' AND quality_status <> 'rejected' ORDER BY observation_id`,
    values: [request.parameters.marketId],
    requiredOutput: "evidence_observations.parquet",
  };
  if (request.query === "canonical_clinic_performance") return {
    sql: `SELECT observation_id, market_id, cbsa_code, market_name, evidence_domain, metric_id, raw_value, unit, observed_at, source_id, source_file, evidence_status, quality_status, sensitivity, allowed_use, warning, is_synthetic FROM read_parquet(${sqlString(canonicalPath)}) WHERE market_id = ? AND evidence_domain IN ('clinic_identity', 'clinic_performance') AND quality_status <> 'rejected' ORDER BY evidence_domain, observation_id`,
    values: [request.parameters.marketId],
    requiredOutput: "evidence_observations.parquet",
  };
  const adsPath = join(snapshotDir, "google_ads_matched_location_context.parquet");
  return {
    sql: `SELECT observationId, sourceId, snapshotId, reportScope, geographyType, matchedLocationLabel, stableGeographyId, observationStart, observationEnd, spend, impressions, clicks, conversions, ctr, averageCpc, conversionRate, costPerConversion, currency, spendUnit, sensitivity, allowedUse, qualityStatus, evidenceStatus, scoringEligibility, rankingEligibility, marketJoinEligibility, warnings, provenance FROM read_parquet(${sqlString(adsPath)}) WHERE (? IS NULL OR matchedLocationLabel = ?) AND (? IS NULL OR reportScope = ?) ORDER BY reportScope, matchedLocationLabel, observationId`,
    values: [request.parameters.matchedLocationLabel ?? null, request.parameters.matchedLocationLabel ?? null, request.parameters.reportScope ?? null, request.parameters.reportScope ?? null],
    requiredOutput: "google_ads_matched_location_context.parquet",
  };
}

function relevantQualityWarnings(report: QualityReport, query: EvidenceExecutionRequest["query"]): string[] {
  const allowedFindingIds = query === "canonical_clinic_performance" ? new Set(["Q-003", "Q-004"])
    : query === "google_ads_matched_location_context" ? new Set(["Q-006", "Q-007"])
      : new Set(["Q-004"]);
  return uniqueSorted((report.findings ?? []).filter((finding) => finding.status === "warning" && allowedFindingIds.has(finding.findingId ?? "")).map((finding) => finding.message));
}

function canonicalEvidence(rows: Record<string, unknown>[], snapshotVersion: string): ExecutionEvidenceItem[] {
  return rows.flatMap((row) => {
    const rawValue = numberOrNull(row.raw_value);
    if (rawValue === null) return [];
    return [{
      evidenceId: String(row.observation_id),
      metricId: String(row.metric_id),
      geographyId: String(row.market_id),
      geographyLabel: String(row.market_name),
      rawValue,
      structuredValue: null,
      unit: String(row.unit),
      sourceId: String(row.source_id),
      snapshotId: snapshotVersion,
      evidenceStatus: String(row.evidence_status) as ExecutionEvidenceItem["evidenceStatus"],
      qualityStatus: String(row.quality_status) as ExecutionEvidenceItem["qualityStatus"],
      observationStart: null,
      observationEnd: stringOrNull(row.observed_at),
      period: stringOrNull(row.observed_at)
        ? { kind: "as_of" as const, start: null, end: String(row.observed_at).slice(0, 10), label: `As of ${String(row.observed_at).slice(0, 10)}` }
        : { kind: "not_provided" as const, start: null, end: null, label: "Period not provided" },
      reportScope: null,
      currency: null,
      allowedUse: String(row.allowed_use),
      sensitivity: String(row.sensitivity) as ExecutionEvidenceItem["sensitivity"],
      warning: stringOrNull(row.warning),
      origin: row.is_synthetic === true ? "synthetic_demo_fixture" as const : "frozen_csv_snapshot" as const,
    }];
  });
}

function googleAdsEvidence(rows: Record<string, unknown>[]): ExecutionEvidenceItem[] {
  return rows.map((row) => ({
    evidenceId: String(row.observationId),
    metricId: "google_ads.matched_location_context",
    geographyId: null,
    geographyLabel: String(row.matchedLocationLabel),
    rawValue: null,
    structuredValue: {
      reportScope: row.reportScope,
      spend: numberOrNull(row.spend),
      impressions: numberOrNull(row.impressions),
      clicks: numberOrNull(row.clicks),
      conversions: numberOrNull(row.conversions),
      ctr: numberOrNull(row.ctr),
      averageCpc: numberOrNull(row.averageCpc),
      conversionRate: numberOrNull(row.conversionRate),
      costPerConversion: numberOrNull(row.costPerConversion),
      currency: row.currency,
      stableGeographyId: null,
    },
    unit: null,
    sourceId: String(row.sourceId),
    snapshotId: String(row.snapshotId),
    evidenceStatus: "Reported" as const,
    qualityStatus: String(row.qualityStatus) as ExecutionEvidenceItem["qualityStatus"],
    observationStart: stringOrNull(row.observationStart),
    observationEnd: stringOrNull(row.observationEnd),
    period: {
      kind: "date_range" as const,
      start: String(row.observationStart).slice(0, 10),
      end: String(row.observationEnd).slice(0, 10),
      label: `${String(row.observationStart).slice(0, 10)} to ${String(row.observationEnd).slice(0, 10)}`,
    },
    reportScope: String(row.reportScope),
    currency: String(row.currency),
    allowedUse: String(row.allowedUse),
    sensitivity: String(row.sensitivity) as ExecutionEvidenceItem["sensitivity"],
    warning: Array.isArray(row.warnings) && row.warnings.length ? row.warnings.map(String).join(" ") : null,
    origin: "frozen_csv_snapshot" as const,
  }));
}

function sensitivityFor(rows: Record<string, unknown>[]): EvidenceExecutionResponse["sensitivity"] {
  const sensitivities = new Set(rows.map((row) => String(row.sensitivity)));
  if (sensitivities.has("restricted")) return "restricted";
  if (sensitivities.has("confidential")) return "confidential";
  if (sensitivities.has("internal")) return "internal";
  return "public";
}

function allowedUseFor(rows: Record<string, unknown>[]): string {
  const values = uniqueSorted(rows.map((row) => stringOrNull(row.allowed_use ?? row.allowedUse)));
  return values.length === 1 ? values[0]! : `combined:${values.join("|")}`;
}

function freshnessWarnings(rows: Record<string, unknown>[], request: EvidenceExecutionRequest): string[] {
  const dates = rows.flatMap((row) => {
    const value = stringOrNull(row.observed_at ?? row.observationEnd);
    return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? [value.slice(0, 10)] : [];
  }).sort();
  if (!dates.length) return [];
  const newest = dates.at(-1)!;
  const ageDays = Math.floor((Date.parse(request.requestedAt) - Date.parse(`${newest}T00:00:00.000Z`)) / 86_400_000);
  const thresholdDays = request.query === "google_ads_matched_location_context" ? 90 : 400;
  return ageDays > thresholdDays
    ? [`The newest registered ${request.query} observation is ${ageDays} days old, exceeding the ${thresholdDays}-day demo freshness threshold.`]
    : [];
}

export async function executeEvidenceRequest(input: unknown, options: EvidenceExecutionOptions = {}): Promise<EvidenceExecutionResponse> {
  const request = evidenceExecutionRequestSchema.parse(input);
  const snapshotDir = resolve(options.snapshotDir ?? ".local-data/clinic-market-snapshot");
  const databasePath = resolve(options.databasePath ?? duckDbPath());
  let manifest: CanonicalSnapshotManifest;
  try {
    manifest = await validateCanonicalSnapshot(snapshotDir, request.snapshotVersion);
  } catch (error) {
    return failed(request, "SNAPSHOT_VALIDATION_FAILED", errorText(error, snapshotDir, databasePath));
  }

  const query = registeredQuery(request, snapshotDir);
  if (!manifest.outputs.some((output) => output.path === query.requiredOutput)) return failed(request, "SNAPSHOT_OUTPUT_MISSING", `The registered query requires ${query.requiredOutput}.`);
  let qualityReport: QualityReport = {};
  try { qualityReport = JSON.parse(await readFile(join(snapshotDir, "quality-report.json"), "utf8")) as QualityReport; }
  catch (error) { return failed(request, "QUALITY_REPORT_INVALID", errorText(error, snapshotDir, databasePath)); }

  const openDatabase = options.openDatabase ?? openDuckDb;
  const closeDatabase = options.closeDatabase ?? closeDuckDb;
  let handle: DuckDbHandle | null = null;
  let rows: Record<string, unknown>[] = [];
  let executionError: unknown = null;
  try {
    handle = await openDatabase(databasePath, true);
    const reader = await handle.connection.runAndReadAll(query.sql, query.values);
    rows = reader.getRowObjectsJson().map(asRecord);
  } catch (error) {
    executionError = error;
  }
  if (handle) {
    try { await closeDatabase(handle); }
    catch (error) { executionError ??= error; }
  }
  if (executionError) return failed(request, "REGISTERED_QUERY_FAILED", errorText(executionError, snapshotDir, databasePath));

  const sourceIds = uniqueSorted(rows.map((row) => stringOrNull(row.source_id ?? row.sourceId)));
  const sensitivity = sensitivityFor(rows);
  const qualityWarnings = uniqueSorted([
    ...relevantQualityWarnings(qualityReport, request.query),
    ...freshnessWarnings(rows, request),
    ...rows.flatMap((row) => Array.isArray(row.warnings) ? row.warnings.map(String) : [stringOrNull(row.warning)]),
  ]);
  if (sensitivity === "restricted" || sensitivity === "confidential") {
    return blocked(request, {
      sourceIds,
      sensitivity,
      allowedUse: allowedUseFor(rows),
      warnings: qualityWarnings,
      missingEvidence: ["The registered evidence is confidential or restricted and cannot cross the browser or AI response boundary."],
      unknowns: ["An approved aggregate declassification or synthetic fallback is required for this workflow."],
    });
  }
  if (!rows.length) return blocked(request, { missingEvidence: [`No rows matched the registered ${request.query} parameters.`], warnings: relevantQualityWarnings(qualityReport, request.query) });

  const evidenceBundle = request.query === "google_ads_matched_location_context" ? googleAdsEvidence(rows) : canonicalEvidence(rows, request.snapshotVersion);
  const missingEvidence = request.query === "google_ads_matched_location_context" ? ["Stable Google Ads geography IDs are unavailable, so market joins and regional ranking are blocked."]
    : rows.filter((row) => row.raw_value === null || row.raw_value === undefined).map((row) => `Metric ${String(row.metric_id)} is missing for ${String(row.market_id)}.`);
  const unknowns = request.query === "google_ads_matched_location_context" ? ["The relationship between each matched-location label and the platform's CBSA geography is unknown."]
    : rows.filter((row) => row.evidence_status === "Unknown").map((row) => `Evidence ${String(row.observation_id)} has Unknown status.`);
  const status = missingEvidence.length || unknowns.length ? "partial" : "complete";
  return evidenceExecutionResponseSchema.parse({
    ...responseBase(request),
    status,
    rows,
    evidenceBundle,
    sourceIds,
    qualityWarnings,
    missingEvidence: uniqueSorted(missingEvidence),
    unknowns: uniqueSorted(unknowns),
    allowedUse: allowedUseFor(rows),
    sensitivity,
    errorCode: null,
    errorMessage: null,
  });
}
