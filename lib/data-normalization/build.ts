import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { parseGoogleAdsMatchedLocationsReport, type GoogleAdsMatchedLocationsReport } from "../adapters/google-ads/index.ts";
import { booleanOrNull, integerOrNull, numberOrNull, parseCsv, type CsvRow } from "../adapters/snowflake-csv/parser.ts";
import { closeDuckDb, openDuckDb, sqlString } from "../evidence-snapshot/duckdb.ts";
import {
  DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
  NORMALIZATION_VERSION,
  NORMALIZED_CALCULATION_VERSION,
  NORMALIZED_QUERY_VERSION,
  geographyResolutionSchema,
  normalizedSnapshotManifestSchema,
  normalizedSourceRecordSchema,
  normalizationCoverageSchema,
  type GeographyResolution,
  type NormalizationCoverage,
  type NormalizedSnapshotManifest,
  type NormalizedSourceRecord,
} from "./contracts.ts";
import { createCbsaResolver, loadCbsaMarkets, normalizeGeographyText, normalizeState, stateCodesFromText, type CbsaResolver } from "./geography.ts";
import { assertNoSeoSources, normalizationSourceCatalog, type NormalizationDatasetId } from "./source-catalog.ts";

type LoadedSource = {
  definition: typeof normalizationSourceCatalog[number];
  text: string;
  rows: CsvRow[];
  columnNames: string[];
  sha256: string;
  googleAdsReport: GoogleAdsMatchedLocationsReport | null;
};

type BuildOptions = {
  sourceDir: string;
  outputDir?: string;
  snapshotVersion?: string;
  builtAt?: string;
  censusUniversePath?: string;
  censusContextPath?: string;
};

type TableDefinition = { rows: Array<Record<string, unknown>>; grain: string };

function hash(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(...parts: Array<string | number | null | undefined>): string {
  return hash(parts.map((part) => String(part ?? "")).join("|")).slice(0, 24);
}

function safeRate(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}

export function normalizeUsZip(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/^8600000US/i, "");
  if (!normalized) return null;
  const match = normalized.match(/^(\d{5})(?:-\d{4}|\.0)?$/);
  return match?.[1] ?? null;
}

function flattenResolution(resolution: GeographyResolution) {
  return {
    rawGeographyType: resolution.rawGeographyType,
    rawGeographyValue: resolution.rawGeographyValue,
    normalizedGeographyValue: resolution.normalizedGeographyValue,
    canonicalGeographyType: resolution.canonicalGeographyType,
    canonicalGeographyId: resolution.canonicalGeographyId,
    cbsaCode: resolution.cbsaCode,
    cbsaName: resolution.cbsaName,
    stateCodes: JSON.stringify(resolution.stateCodes),
    normalizationMethod: resolution.method,
    normalizationConfidence: resolution.confidence,
    normalizationConfidenceScore: resolution.confidenceScore,
    evidenceStatus: resolution.evidenceStatus,
    reviewStatus: resolution.reviewStatus,
    demoUsable: resolution.demoUsable,
    candidateMarketIds: JSON.stringify(resolution.candidateMarketIds),
    normalizationWarnings: JSON.stringify(resolution.warnings),
  };
}

function bridgeResolution(input: {
  base: GeographyResolution;
  rawType: GeographyResolution["rawGeographyType"];
  rawValue: string | null;
  method: GeographyResolution["method"];
  warning?: string;
}): GeographyResolution {
  const warnings = [...input.base.warnings, ...(input.warning ? [input.warning] : [])];
  return geographyResolutionSchema.parse({
    ...input.base,
    rawGeographyType: input.rawType,
    rawGeographyValue: input.rawValue,
    normalizedGeographyValue: input.rawValue ? normalizeGeographyText(input.rawValue) : null,
    method: input.method,
    evidenceStatus: input.base.cbsaCode ? (input.base.confidence === "exact" || input.base.confidence === "high" ? "Derived" : "Hypothesis") : input.base.evidenceStatus,
    warnings,
  });
}

function stateFallback(resolver: CbsaResolver, resolution: GeographyResolution, label: string, explicitState?: string | null): GeographyResolution {
  if (resolution.cbsaCode) return resolution;
  const state = normalizeState(explicitState) ?? stateCodesFromText(label)[0] ?? null;
  if (!state) return resolution;
  const fallback = resolver.resolveState(state);
  return geographyResolutionSchema.parse({ ...fallback, rawGeographyType: resolution.rawGeographyType, rawGeographyValue: label, normalizedGeographyValue: normalizeGeographyText(label), evidenceStatus: "Derived", warnings: [...resolution.warnings, `No CBSA was inferred; the record is retained at state ${state}.`] });
}

function validateColumns(source: LoadedSource) {
  const missing = source.definition.requiredColumns.filter((column) => !source.columnNames.includes(column));
  if (missing.length) throw new Error(`${source.definition.datasetId} is missing required columns: ${missing.join(", ")}.`);
}

async function loadSource(sourceDir: string, definition: typeof normalizationSourceCatalog[number], snapshotVersion: string): Promise<LoadedSource> {
  const filePath = resolve(sourceDir, definition.relativePath);
  const text = await readFile(filePath, "utf8");
  if (definition.geographyStrategy === "matched_location_label") {
    const report = parseGoogleAdsMatchedLocationsReport({ text, fileName: basename(filePath), snapshotId: snapshotVersion });
    const header = text.split(/\r?\n/).find((line) => line.startsWith("Matched location,"));
    const loaded = { definition, text, rows: header ? parseCsv(`${header}\n`) : [], columnNames: header ? Object.keys(parseCsv(`${header}\nplaceholder,,,,,,,,,\n`)[0] ?? {}) : [], sha256: hash(text), googleAdsReport: report };
    validateColumns(loaded);
    return loaded;
  }
  const rows = parseCsv(text);
  const loaded = { definition, text, rows, columnNames: Object.keys(rows[0] ?? {}), sha256: hash(text), googleAdsReport: null };
  validateColumns(loaded);
  return loaded;
}

function sourceById(sources: LoadedSource[], datasetId: NormalizationDatasetId): LoadedSource {
  const source = sources.find((candidate) => candidate.definition.datasetId === datasetId);
  if (!source) throw new Error(`Required normalized source ${datasetId} was not loaded.`);
  return source;
}

function crosswalkRecorder() {
  type MutableRecord = Omit<NormalizedSourceRecord, "occurrenceCount"> & { occurrenceCount: number };
  const records = new Map<string, MutableRecord>();
  function record(input: {
    datasetId: string;
    sourceId: string;
    sourceRowNumber: number;
    sourceLocationKey: string;
    clinicId?: string | null;
    zip?: string | null;
    suppliedCbsaLabel?: string | null;
    suppliedState?: string | null;
    resolution: GeographyResolution;
  }) {
    const key = `${input.datasetId}|${input.sourceLocationKey}`;
    const existing = records.get(key);
    if (existing) { existing.occurrenceCount += 1; return; }
    records.set(key, {
      recordId: `norm:${stableId(input.datasetId, input.sourceLocationKey)}`,
      datasetId: input.datasetId,
      sourceId: input.sourceId,
      firstSourceRowNumber: input.sourceRowNumber,
      occurrenceCount: 1,
      sourceLocationKey: input.sourceLocationKey,
      clinicId: input.clinicId ?? null,
      zip: input.zip ?? null,
      suppliedCbsaLabel: input.suppliedCbsaLabel ?? null,
      suppliedState: input.suppliedState ?? null,
      resolution: input.resolution,
    });
  }
  return { record, values: () => [...records.values()].map((item) => normalizedSourceRecordSchema.parse(item)) };
}

function coverageFor(source: LoadedSource, records: NormalizedSourceRecord[]): NormalizationCoverage {
  const selected = records.filter((record) => record.datasetId === source.definition.datasetId);
  const weighted = (predicate: (record: NormalizedSourceRecord) => boolean) => selected.filter(predicate).reduce((sum, record) => sum + record.occurrenceCount, 0);
  const sourceRowCount = source.googleAdsReport?.observations.length ?? source.rows.length;
  const cbsaResolvedCount = weighted((record) => record.resolution.canonicalGeographyType === "cbsa");
  const stateResolvedCount = weighted((record) => record.resolution.canonicalGeographyType === "state");
  const nationalCount = weighted((record) => record.resolution.canonicalGeographyType === "national");
  const unresolvedCount = weighted((record) => record.resolution.canonicalGeographyType === "unresolved");
  const limitations: string[] = [];
  if (source.definition.geographyStrategy === "matched_location_label") limitations.push("Google Ads labels are intuitively mapped for the local demo and are not stable provider geography identifiers.");
  if (source.definition.datasetId === "appointments") limitations.push("Appointment rows are state-level and cannot be attributed to individual CBSAs.");
  if (source.definition.datasetId === "retention") limitations.push("Retention rows are national or channel aggregates and cannot be attributed to individual CBSAs.");
  if (source.definition.datasetId === "regional_demand") limitations.push("Canadian and other non-U.S. postal codes remain unresolved because the canonical registry is the U.S. Census CBSA universe.");
  if (unresolvedCount) limitations.push(`${unresolvedCount} source rows remain unresolved at the requested canonical geography.`);
  return normalizationCoverageSchema.parse({
    datasetId: source.definition.datasetId,
    sourceFamily: source.definition.sourceFamily,
    sourceRowCount,
    distinctLocationCount: selected.length,
    cbsaResolvedCount,
    stateResolvedCount,
    nationalCount,
    unresolvedCount,
    exactCount: weighted((record) => record.resolution.confidence === "exact"),
    highCount: weighted((record) => record.resolution.confidence === "high"),
    mediumCount: weighted((record) => record.resolution.confidence === "medium"),
    lowCount: weighted((record) => record.resolution.confidence === "low"),
    inferredCount: weighted((record) => record.resolution.evidenceStatus === "Hypothesis" || record.resolution.reviewStatus === "demo_inferred"),
    reviewRequiredCount: weighted((record) => record.resolution.reviewStatus === "review_required"),
    demoUsableCount: weighted((record) => record.resolution.demoUsable),
    coverageRate: safeRate(cbsaResolvedCount + stateResolvedCount + nationalCount, sourceRowCount),
    limitations,
  });
}

function addMetric(target: Record<string, number>, counts: Record<string, number>, key: string, value: number | null) {
  if (value === null) return;
  target[key] = (target[key] ?? 0) + value;
  counts[key] = (counts[key] ?? 0) + 1;
}

function summed(metrics: Record<string, number>, counts: Record<string, number>, key: string): number | null {
  return counts[key] ? metrics[key] ?? 0 : null;
}

function reportRows(report: GoogleAdsMatchedLocationsReport): CsvRow[] {
  return report.observations.map((observation) => ({
    matchedLocationLabel: observation.matchedLocationLabel,
    reportScope: observation.reportScope,
    observationStart: observation.observationStart,
    observationEnd: observation.observationEnd,
    spend: observation.spend == null ? "" : String(observation.spend),
    impressions: observation.impressions == null ? "" : String(observation.impressions),
    clicks: observation.clicks == null ? "" : String(observation.clicks),
    conversions: observation.conversions == null ? "" : String(observation.conversions),
    currency: observation.currency,
    sourceRowNumber: String(observation.provenance.sourceRowNumber),
    qualityStatus: observation.qualityStatus,
  }));
}

export async function buildNormalizationTables(options: BuildOptions) {
  assertNoSeoSources();
  const snapshotVersion = options.snapshotVersion ?? DEFAULT_NORMALIZED_SNAPSHOT_VERSION;
  const markets = await loadCbsaMarkets(options.censusUniversePath);
  const resolver = createCbsaResolver(markets);
  const sources = await Promise.all(normalizationSourceCatalog.map((definition) => loadSource(resolve(options.sourceDir), definition, snapshotVersion)));
  const crosswalk = crosswalkRecorder();

  const zipMarket = sourceById(sources, "zip_market");
  const zipBridge = new Map<string, GeographyResolution>();
  const zipBridgeRows: Array<Record<string, unknown>> = [];
  zipMarket.rows.forEach((row, index) => {
    const zip = normalizeUsZip(row.ZIP_CODE);
    const label = row.CBSA_TITLE?.trim() || null;
    const base = resolver.resolveLabel(label, null, "cbsa_label");
    const resolution = zip ? bridgeResolution({ base, rawType: "zip", rawValue: zip, method: "zip_bridge", warning: "ZIP-to-CBSA assignment uses the supplied General Regional bridge and Census CBSA-name normalization." }) : base;
    if (zip) zipBridge.set(zip, resolution);
    crosswalk.record({ datasetId: zipMarket.definition.datasetId, sourceId: zipMarket.definition.sourceId, sourceRowNumber: index + 2, sourceLocationKey: zip ?? `missing:${index + 2}`, zip, suppliedCbsaLabel: label, resolution });
    zipBridgeRows.push({ zip, suppliedCbsaLabel: label, statisticalAreaType: row.METRO_MICRO_STATISTICAL_AREA || null, csaTitle: row.CSA_TITLE || null, sourceId: zipMarket.definition.sourceId, ...flattenResolution(resolution) });
  });

  const marketContext = sourceById(sources, "market_context");
  const marketRows = marketContext.rows.map((row, index) => {
    const resolution = resolver.resolveCode(row.CBSA_CODE) ?? stateFallback(resolver, resolver.resolveLabel(row.CBSA_NAME, null, "cbsa_label"), row.CBSA_NAME);
    crosswalk.record({ datasetId: marketContext.definition.datasetId, sourceId: marketContext.definition.sourceId, sourceRowNumber: index + 2, sourceLocationKey: row.CBSA_CODE || row.CBSA_NAME || `missing:${index + 2}`, suppliedCbsaLabel: row.CBSA_NAME || null, resolution });
    return { sourceId: marketContext.definition.sourceId, reportingDate: row.REPORTING_DATE || null, priorYearReportingDate: row.PRIOR_YEAR_REPORTING_DATE || null, activeCustomerCount: integerOrNull(row.ACTIVE_CUSTOMER_COUNT), priorYearActiveCustomerCount: integerOrNull(row.ACTIVE_CUSTOMER_COUNT_PRIOR_YEAR), activeCustomerYoyGrowth: numberOrNull(row.ACTIVE_CUSTOMER_YOY_GROWTH), totalHouseholds: integerOrNull(row.TOTAL_HOUSEHOLDS), activeCustomersPer1000Households: numberOrNull(row.ACTIVE_CUSTOMERS_PER_1000_HOUSEHOLDS), sourceQualityStatus: row.QUALITY_STATUS || null, ...flattenResolution(resolution) };
  });

  const cbsaPopulation = sourceById(sources, "cbsa_population");
  const populationRows = cbsaPopulation.rows.map((row, index) => {
    const resolution = resolver.resolveCode(row.CBSA) ?? resolver.resolveLabel(row.CBSA, null, "cbsa_label");
    crosswalk.record({ datasetId: cbsaPopulation.definition.datasetId, sourceId: cbsaPopulation.definition.sourceId, sourceRowNumber: index + 2, sourceLocationKey: row.CBSA || `missing:${index + 2}`, resolution });
    return { sourceId: cbsaPopulation.definition.sourceId, populationEstimate: integerOrNull(row.POP_ESTIMATE), statisticalAreaType: row.LSAD || null, ...flattenResolution(resolution) };
  });

  const zipMetro = sourceById(sources, "zip_metro");
  const zipMetroBridge = new Map<string, GeographyResolution>();
  zipMetro.rows.forEach((row, index) => {
    const zip = normalizeUsZip(row.CUSTOMER_ADDRESS_ZIP);
    const bridged = zip ? zipBridge.get(zip) : null;
    const fallback = stateFallback(resolver, resolver.resolveLabel(row.METRO, row.STATE, "cbsa_label"), row.METRO, row.STATE);
    const resolution = bridged ? bridgeResolution({ base: bridged, rawType: "zip", rawValue: zip, method: "zip_bridge" }) : fallback;
    if (zip && resolution.demoUsable) zipMetroBridge.set(zip, resolution);
    crosswalk.record({ datasetId: zipMetro.definition.datasetId, sourceId: zipMetro.definition.sourceId, sourceRowNumber: index + 2, sourceLocationKey: zip ?? `missing:${index + 2}`, zip, suppliedCbsaLabel: row.METRO || null, suppliedState: row.STATE || null, resolution });
  });

  const resolutionForZip = (zip: string | null): GeographyResolution | null => zip ? zipBridge.get(zip) ?? zipMetroBridge.get(zip) ?? null : null;

  const zipContext = sourceById(sources, "zip_context");
  type ZipContextAggregate = { cbsaCode: string; cbsaName: string; zips: Set<string>; households: number; householdRows: number; families: number; familyRows: number; incomeWeighted: number; incomeWeight: number };
  const zipContextByCbsa = new Map<string, ZipContextAggregate>();
  zipContext.rows.forEach((row, index) => {
    const zip = normalizeUsZip(row.GEO_ZIPCODE);
    const zipResolution = resolutionForZip(zip);
    const resolution = zipResolution ? bridgeResolution({ base: zipResolution, rawType: "zip", rawValue: zip, method: "zip_bridge" }) : resolver.resolveLabel(null);
    crosswalk.record({ datasetId: zipContext.definition.datasetId, sourceId: zipContext.definition.sourceId, sourceRowNumber: index + 2, sourceLocationKey: zip ?? `missing:${index + 2}`, zip, resolution });
    if (!resolution.cbsaCode || !resolution.cbsaName || !zip) return;
    const current = zipContextByCbsa.get(resolution.cbsaCode) ?? { cbsaCode: resolution.cbsaCode, cbsaName: resolution.cbsaName, zips: new Set<string>(), households: 0, householdRows: 0, families: 0, familyRows: 0, incomeWeighted: 0, incomeWeight: 0 };
    current.zips.add(zip);
    const households = integerOrNull(row.ESTIMATED_HOUSEHOLDS); const families = integerOrNull(row.ESTIMATED_NUMBER_OF_FAMILIES); const income = numberOrNull(row.ESTIMATED_MEDIAN_HOUSEHOLD_INCOME);
    if (households !== null) { current.households += households; current.householdRows += 1; }
    if (families !== null) { current.families += families; current.familyRows += 1; }
    if (income !== null && households !== null && households > 0) { current.incomeWeighted += income * households; current.incomeWeight += households; }
    zipContextByCbsa.set(resolution.cbsaCode, current);
  });
  const zipContextRows = [...zipContextByCbsa.values()].sort((a, b) => a.cbsaCode.localeCompare(b.cbsaCode)).map((row) => ({ cbsaCode: row.cbsaCode, cbsaName: row.cbsaName, contributingZipCount: row.zips.size, estimatedHouseholds: row.householdRows ? row.households : null, estimatedFamilies: row.familyRows ? row.families : null, householdWeightedMedianIncomeProxy: row.incomeWeight ? row.incomeWeighted / row.incomeWeight : null, sourceId: zipContext.definition.sourceId, evidenceStatus: "Derived", qualityStatus: "warning", warning: "ZIP medians are represented as a household-weighted income proxy; this is not a recalculated CBSA median." }));

  const regionalDemand = sourceById(sources, "regional_demand");
  type DemandAggregate = { cbsaCode: string; cbsaName: string; year: number; zips: Set<string>; metrics: Record<string, number>; counts: Record<string, number>; sourceRows: number };
  const demandByCbsa = new Map<string, DemandAggregate>();
  regionalDemand.rows.forEach((row, index) => {
    const zip = normalizeUsZip(row.CUSTOMER_ADDRESS_ZIP); const zipResolution = resolutionForZip(zip); const resolution = zipResolution ? bridgeResolution({ base: zipResolution, rawType: "zip", rawValue: zip, method: "zip_bridge" }) : resolver.resolveLabel(null); const year = integerOrNull(row.YEAR);
    crosswalk.record({ datasetId: regionalDemand.definition.datasetId, sourceId: regionalDemand.definition.sourceId, sourceRowNumber: index + 2, sourceLocationKey: zip ?? `missing:${index + 2}`, zip, resolution });
    if (!resolution.cbsaCode || !resolution.cbsaName || year === null || !zip) return;
    const key = `${resolution.cbsaCode}|${year}`; const current = demandByCbsa.get(key) ?? { cbsaCode: resolution.cbsaCode, cbsaName: resolution.cbsaName, year, zips: new Set<string>(), metrics: {}, counts: {}, sourceRows: 0 };
    current.zips.add(zip); current.sourceRows += 1; addMetric(current.metrics, current.counts, "netSalesExcludingRefunds", numberOrNull(row.NET_SALES_EXCLUDING_REFUNDS)); addMetric(current.metrics, current.counts, "netSales", numberOrNull(row.NET_SALES)); demandByCbsa.set(key, current);
  });
  const demandRows = [...demandByCbsa.values()].sort((a, b) => a.cbsaCode.localeCompare(b.cbsaCode) || a.year - b.year).map((row) => ({ cbsaCode: row.cbsaCode, cbsaName: row.cbsaName, year: row.year, contributingZipCount: row.zips.size, contributingSourceRowCount: row.sourceRows, netSalesExcludingRefunds: summed(row.metrics, row.counts, "netSalesExcludingRefunds"), netSales: summed(row.metrics, row.counts, "netSales"), sourceId: regionalDemand.definition.sourceId, evidenceStatus: "Derived", sensitivity: "internal", allowedUse: "local_demo_cbsa_aggregate_only", scoringEligibility: "none" }));

  const clinicProfile = sourceById(sources, "clinic_profile");
  const clinicResolution = new Map<string, GeographyResolution>();
  type ClinicAggregate = { cbsaCode: string; cbsaName: string; clinicIds: Set<string>; metrics: Record<string, number>; counts: Record<string, number>; corporateCount: number; practiceHubCount: number; pharmacyBusinessCount: number; inferredCount: number; reviewRequiredCount: number };
  const clinicByCbsa = new Map<string, ClinicAggregate>();
  clinicProfile.rows.forEach((row, index) => {
    const clinicId = row.CLINIC_ID?.trim() || null; const zip = normalizeUsZip(row.ZIP_CODE); const labelResolution = stateFallback(resolver, resolver.resolveLabel(row.CBSA_NAME, row.CLINIC_STATE, "cbsa_label"), row.CBSA_NAME, row.CLINIC_STATE); const zipResolution = resolutionForZip(zip);
    let resolution = zipResolution ? bridgeResolution({ base: zipResolution, rawType: "zip", rawValue: zip, method: "zip_bridge" }) : labelResolution;
    if (zipResolution?.cbsaCode && labelResolution.cbsaCode && zipResolution.cbsaCode !== labelResolution.cbsaCode) resolution = geographyResolutionSchema.parse({ ...resolution, reviewStatus: "review_required", evidenceStatus: "Hypothesis", warnings: [...resolution.warnings, `ZIP bridge and supplied CBSA label disagree; ZIP bridge ${zipResolution.cbsaCode} is retained for the demo.`] });
    if (clinicId) clinicResolution.set(clinicId, resolution);
    crosswalk.record({ datasetId: clinicProfile.definition.datasetId, sourceId: clinicProfile.definition.sourceId, sourceRowNumber: index + 2, sourceLocationKey: clinicId ?? `${zip ?? "missing"}:${index + 2}`, clinicId, zip, suppliedCbsaLabel: row.CBSA_NAME || null, suppliedState: row.CLINIC_STATE || null, resolution });
    if (!resolution.cbsaCode || !resolution.cbsaName || !clinicId) return;
    const current = clinicByCbsa.get(resolution.cbsaCode) ?? { cbsaCode: resolution.cbsaCode, cbsaName: resolution.cbsaName, clinicIds: new Set<string>(), metrics: {}, counts: {}, corporateCount: 0, practiceHubCount: 0, pharmacyBusinessCount: 0, inferredCount: 0, reviewRequiredCount: 0 };
    current.clinicIds.add(clinicId); addMetric(current.metrics, current.counts, "totalOrders", numberOrNull(row.TOTAL_ORDERS)); addMetric(current.metrics, current.counts, "totalVets", numberOrNull(row.TOTAL_VETS_CAPPED)); current.corporateCount += booleanOrNull(row.CORPORATE_CLINIC_FLAG) ? 1 : 0; current.practiceHubCount += booleanOrNull(row.PH_CLINIC_FLAG) ? 1 : 0; current.pharmacyBusinessCount += booleanOrNull(row.PBC_CLINIC_FLAG) ? 1 : 0; current.inferredCount += resolution.evidenceStatus === "Hypothesis" ? 1 : 0; current.reviewRequiredCount += resolution.reviewStatus === "review_required" ? 1 : 0; clinicByCbsa.set(resolution.cbsaCode, current);
  });
  const clinicProfileRows = [...clinicByCbsa.values()].sort((a, b) => a.cbsaCode.localeCompare(b.cbsaCode)).map((row) => ({ cbsaCode: row.cbsaCode, cbsaName: row.cbsaName, clinicCount: row.clinicIds.size, totalOrders: summed(row.metrics, row.counts, "totalOrders"), contributingOrderRows: row.counts.totalOrders ?? 0, totalVetsCapped: summed(row.metrics, row.counts, "totalVets"), contributingVetRows: row.counts.totalVets ?? 0, corporateClinicCount: row.corporateCount, practiceHubClinicCount: row.practiceHubCount, pharmacyBusinessClinicCount: row.pharmacyBusinessCount, inferredClinicCount: row.inferredCount, reviewRequiredClinicCount: row.reviewRequiredCount, sourceId: clinicProfile.definition.sourceId, evidenceStatus: row.inferredCount ? "Hypothesis" : "Derived", sensitivity: "internal", allowedUse: "local_demo_aggregate_decision_support", scoringEligibility: "none" }));

  const clinicActivity = sourceById(sources, "clinic_activity");
  type ActivityAggregate = { cbsaCode: string; cbsaName: string; timeframe: string; clinicIds: Set<string>; metrics: Record<string, number>; counts: Record<string, number>; inferredCount: number };
  const activityByCbsa = new Map<string, ActivityAggregate>();
  clinicActivity.rows.forEach((row, index) => {
    const clinicId = row.CLINIC_ID?.trim() || null; const zip = normalizeUsZip(row.ZIP_CODE); const identity = clinicId ? clinicResolution.get(clinicId) : null; const zipResolution = resolutionForZip(zip); const resolution = identity ? bridgeResolution({ base: identity, rawType: "zip", rawValue: zip, method: "clinic_identity_bridge" }) : zipResolution ? bridgeResolution({ base: zipResolution, rawType: "zip", rawValue: zip, method: "zip_bridge" }) : resolver.resolveLabel(null); const timeframe = row.TIMEFRAME || "Unknown";
    crosswalk.record({ datasetId: clinicActivity.definition.datasetId, sourceId: clinicActivity.definition.sourceId, sourceRowNumber: index + 2, sourceLocationKey: clinicId ?? `${zip ?? "missing"}:${index + 2}`, clinicId, zip, resolution });
    if (!resolution.cbsaCode || !resolution.cbsaName || !clinicId) return;
    const key = `${resolution.cbsaCode}|${timeframe}`; const current = activityByCbsa.get(key) ?? { cbsaCode: resolution.cbsaCode, cbsaName: resolution.cbsaName, timeframe, clinicIds: new Set<string>(), metrics: {}, counts: {}, inferredCount: 0 };
    current.clinicIds.add(clinicId); for (const [metric, field] of Object.entries({ totalCustomers: "TOTAL_CUSTOMER", totalOrders: "TOTAL_ORDERS", rxOrders: "RX_ORDERS", netSales: "NET_SALES", rxNetSales: "RX_NET_SALES", netSalesChange: "NET_SALES_CHANGE" })) addMetric(current.metrics, current.counts, metric, numberOrNull(row[field])); current.inferredCount += resolution.evidenceStatus === "Hypothesis" ? 1 : 0; activityByCbsa.set(key, current);
  });
  const clinicActivityRows = [...activityByCbsa.values()].sort((a, b) => a.cbsaCode.localeCompare(b.cbsaCode) || a.timeframe.localeCompare(b.timeframe)).map((row) => ({ cbsaCode: row.cbsaCode, cbsaName: row.cbsaName, timeframe: row.timeframe, clinicCount: row.clinicIds.size, totalCustomers: summed(row.metrics, row.counts, "totalCustomers"), totalOrders: summed(row.metrics, row.counts, "totalOrders"), rxOrders: summed(row.metrics, row.counts, "rxOrders"), netSales: summed(row.metrics, row.counts, "netSales"), rxNetSales: summed(row.metrics, row.counts, "rxNetSales"), netSalesChange: summed(row.metrics, row.counts, "netSalesChange"), inferredClinicCount: row.inferredCount, sourceId: clinicActivity.definition.sourceId, evidenceStatus: row.inferredCount ? "Hypothesis" : "Derived", sensitivity: "internal", allowedUse: "local_demo_aggregate_decision_support", scoringEligibility: "none" }));

  const appointments = sourceById(sources, "appointments");
  const appointmentRows = appointments.rows.map((row, index) => { const resolution = resolver.resolveState(row.GEOGRAPHY); crosswalk.record({ datasetId: appointments.definition.datasetId, sourceId: appointments.definition.sourceId, sourceRowNumber: index + 2, sourceLocationKey: row.GEOGRAPHY || `missing:${index + 2}`, suppliedState: row.GEOGRAPHY || null, resolution }); return { stateCode: resolution.stateCodes[0] ?? null, reportingMonth: row.REPORTING_MONTH || null, appointmentType: row.APPOINTMENT_TYPE || null, appointmentState: row.APPOINTMENT_STATE || null, reason: row.REASON || null, appointmentCount: integerOrNull(row.APPOINTMENT_COUNT), sourceId: appointments.definition.sourceId, evidenceStatus: "Reported", sensitivity: "internal", allowedUse: "local_demo_aggregate_decision_support", scoringEligibility: "none" }; });

  const retention = sourceById(sources, "retention");
  const retentionRows = retention.rows.map((row, index) => { const resolution = resolver.national(); crosswalk.record({ datasetId: retention.definition.datasetId, sourceId: retention.definition.sourceId, sourceRowNumber: index + 2, sourceLocationKey: `${row.AGGREGATION_LEVEL}|${row.BUSINESS_CHANNEL}`, resolution }); return { loadDate: row.LOAD_DATE || null, reportingYear: integerOrNull(row.FINANCIAL_CALENDAR_REPORTING_YEAR), reportingPeriod: row.FINANCIAL_CALENDAR_REPORTING_PERIOD || null, reportingWeek: row.FINANCIAL_CALENDAR_REPORTING_WEEK || null, weekStartDate: row.WEEK_START_DATE || null, weekEndDate: row.WEEK_END_DATE || null, aggregationLevel: row.AGGREGATION_LEVEL || null, businessChannel: row.BUSINESS_CHANNEL || null, totalCustomers: integerOrNull(row.TOTAL_CUSTOMERS), potentialCount: integerOrNull(row.POTENTIAL_COUNT), recentCount: integerOrNull(row.RECENT_COUNT), lapsedCount: integerOrNull(row.LAPSED_COUNT), inactiveCount: integerOrNull(row.INACTIVE_COUNT), churnedCount: integerOrNull(row.CHURNED_COUNT), sourceId: retention.definition.sourceId, evidenceStatus: "Reported", sensitivity: "internal", allowedUse: "local_demo_national_context_only", scoringEligibility: "none" }; });

  type AdsAggregate = { cbsaCode: string; cbsaName: string; reportScope: string; observationStart: string; observationEnd: string; currency: string; labels: Set<string>; metrics: Record<string, number>; counts: Record<string, number>; inferredCount: number; reviewRequiredCount: number; warningCount: number; sourceId: string };
  const adsByCbsa = new Map<string, AdsAggregate>();
  for (const datasetId of ["google_ads_search_shopping", "google_ads_vet_clinic_search"] as const) {
    const source = sourceById(sources, datasetId); const report = source.googleAdsReport!;
    reportRows(report).forEach((row) => {
      const label = row.matchedLocationLabel; const base = resolver.resolveLabel(label, null, "matched_location_label"); const resolution = stateFallback(resolver, base, label);
      crosswalk.record({ datasetId: source.definition.datasetId, sourceId: report.sourceId, sourceRowNumber: Number(row.sourceRowNumber), sourceLocationKey: label, suppliedCbsaLabel: label, resolution });
      if (!resolution.cbsaCode || !resolution.cbsaName) return;
      const key = `${resolution.cbsaCode}|${row.reportScope}`; const current = adsByCbsa.get(key) ?? { cbsaCode: resolution.cbsaCode, cbsaName: resolution.cbsaName, reportScope: row.reportScope, observationStart: row.observationStart, observationEnd: row.observationEnd, currency: row.currency, labels: new Set<string>(), metrics: {}, counts: {}, inferredCount: 0, reviewRequiredCount: 0, warningCount: 0, sourceId: report.sourceId };
      current.labels.add(label); for (const metric of ["spend", "impressions", "clicks", "conversions"]) addMetric(current.metrics, current.counts, metric, numberOrNull(row[metric])); current.inferredCount += resolution.evidenceStatus === "Hypothesis" ? 1 : 0; current.reviewRequiredCount += resolution.reviewStatus === "review_required" ? 1 : 0; current.warningCount += row.qualityStatus === "valid" ? 0 : 1; adsByCbsa.set(key, current);
    });
  }
  const adsRows = [...adsByCbsa.values()].sort((a, b) => a.cbsaCode.localeCompare(b.cbsaCode) || a.reportScope.localeCompare(b.reportScope)).map((row) => { const clicks = summed(row.metrics, row.counts, "clicks"); const impressions = summed(row.metrics, row.counts, "impressions"); const conversions = summed(row.metrics, row.counts, "conversions"); const spend = summed(row.metrics, row.counts, "spend"); return { cbsaCode: row.cbsaCode, cbsaName: row.cbsaName, reportScope: row.reportScope, observationStart: row.observationStart, observationEnd: row.observationEnd, currency: row.currency, matchedLocationCount: row.labels.size, matchedLocationLabels: JSON.stringify([...row.labels].sort()), spend, impressions, clicks, conversions, derivedCtr: clicks !== null && impressions ? clicks / impressions : null, derivedCostPerConversion: spend !== null && conversions ? spend / conversions : null, inferredLocationCount: row.inferredCount, reviewRequiredLocationCount: row.reviewRequiredCount, sourceWarningCount: row.warningCount, sourceId: row.sourceId, evidenceStatus: row.inferredCount || row.reviewRequiredCount ? "Hypothesis" : "Derived", sensitivity: "internal", allowedUse: "local_demo_inferred_regional_context", scoringEligibility: "none", warning: "CBSA is inferred from the Google Ads display label using Census names, principal cities, states, and token similarity; it is not a provider-stable geography join." }; });

  const censusPath = resolve(options.censusContextPath ?? "data/public/census/cbsa-acs/2024/market-context.json");
  const census = JSON.parse(await readFile(censusPath, "utf8")) as { markets: Array<{ market_id: string; cbsa_code: string; cbsa_name: string; metrics: Record<string, { raw_value: number | null; unit?: string }> }> };
  const censusRows = census.markets.map((market) => ({ marketId: market.market_id, cbsaCode: market.cbsa_code, cbsaName: market.cbsa_name, totalPopulation: market.metrics.total_population?.raw_value ?? null, householdCount: market.metrics.household_count?.raw_value ?? null, medianHouseholdIncome: market.metrics.median_household_income?.raw_value ?? null, housingUnits: market.metrics.housing_units?.raw_value ?? null, populationDensity: market.metrics.population_density?.raw_value ?? null, observedAt: "2024-12-31", sourceId: "SRC-016", evidenceStatus: "Confirmed", sensitivity: "public", allowedUse: "market_context_only", scoringEligibility: "none" }));

  const crosswalkRows = crosswalk.values();
  const coverage = sources.map((source) => coverageFor(source, crosswalkRows));
  const sourceRegistryRows = sources.map((source) => ({ datasetId: source.definition.datasetId, sourceFamily: source.definition.sourceFamily, sourceId: source.googleAdsReport?.sourceId ?? source.definition.sourceId, relativePath: source.definition.relativePath, sourceFileName: basename(source.definition.relativePath), sourceSha256: source.sha256, sourceRowCount: source.googleAdsReport?.observations.length ?? source.rows.length, columnNames: JSON.stringify(source.columnNames), grain: source.definition.grain, geographyStrategy: source.definition.geographyStrategy, sensitivity: source.definition.sensitivity, allowedUse: source.definition.allowedUse, browserExposure: source.definition.browserExposure }));
  const geographyRows = markets.map((market) => ({ marketId: market.market_id, cbsaCode: market.cbsa_code, cbsaName: market.cbsa_name, cbsaType: market.cbsa_type, stateCodes: JSON.stringify(market.state_codes), principalCities: JSON.stringify(market.principal_cities), componentCounties: JSON.stringify(market.component_counties), delineationVintage: market.delineation_vintage, sourceId: market.source_id, evidenceStatus: market.evidence_status, sensitivity: market.sensitivity, allowedUse: market.allowed_use, scoringEligibility: market.scoring_eligibility }));
  const flattenedCrosswalk = crosswalkRows.map((record) => ({ recordId: record.recordId, datasetId: record.datasetId, sourceId: record.sourceId, firstSourceRowNumber: record.firstSourceRowNumber, occurrenceCount: record.occurrenceCount, sourceLocationKey: record.sourceLocationKey, clinicId: record.clinicId, zip: record.zip, suppliedCbsaLabel: record.suppliedCbsaLabel, suppliedState: record.suppliedState, ...flattenResolution(record.resolution) }));
  const coverageRows = coverage.map((item) => ({ ...item, limitations: JSON.stringify(item.limitations) }));

  const tables: Record<string, TableDefinition> = {
    normalized_source_registry: { rows: sourceRegistryRows, grain: "one registered non-SEO source file" },
    normalized_geography_registry: { rows: geographyRows, grain: "one Census CBSA" },
    normalized_source_geography: { rows: flattenedCrosswalk, grain: "one distinct source-location key with occurrence count" },
    normalized_zip_to_cbsa: { rows: zipBridgeRows, grain: "one supplied ZIP-to-CBSA bridge row" },
    normalized_census_market_context: { rows: censusRows, grain: "one Census CBSA market" },
    normalized_market_context: { rows: marketRows, grain: "one supplied market context row" },
    normalized_cbsa_population: { rows: populationRows, grain: "one supplied CBSA population row" },
    normalized_zip_context_by_cbsa: { rows: zipContextRows, grain: "one derived CBSA ZIP-context aggregate" },
    normalized_regional_demand_by_cbsa_year: { rows: demandRows, grain: "one derived CBSA x year aggregate" },
    normalized_clinic_profile_by_cbsa: { rows: clinicProfileRows, grain: "one derived CBSA clinic-profile aggregate" },
    normalized_clinic_activity_by_cbsa: { rows: clinicActivityRows, grain: "one derived CBSA x timeframe clinic-activity aggregate" },
    normalized_appointments_by_state_month: { rows: appointmentRows, grain: "one supplied state x month x appointment-dimension row" },
    normalized_retention_context: { rows: retentionRows, grain: "one supplied week x aggregation level x business channel row" },
    normalized_google_ads_by_cbsa: { rows: adsRows, grain: "one inferred CBSA x Google Ads report scope" },
    normalized_coverage: { rows: coverageRows, grain: "one registered source dataset" },
  };
  return { snapshotVersion, sources, coverage, tables };
}

async function writeDatabaseAndParquet(outputDir: string, tables: Record<string, TableDefinition>) {
  const temporaryDir = await mkdtemp(join(tmpdir(), "normalized-market-data-"));
  const databasePath = resolve(outputDir, "normalized-market-data.duckdb");
  await rm(databasePath, { force: true });
  const handle = await openDuckDb(databasePath);
  const outputs: NormalizedSnapshotManifest["outputs"] = [];
  try {
    for (const [tableName, table] of Object.entries(tables)) {
      if (!table.rows.length) throw new Error(`Normalized table ${tableName} has no rows and cannot be materialized.`);
      const jsonPath = resolve(temporaryDir, `${tableName}.json`);
      const parquetPath = resolve(outputDir, `${tableName}.parquet`);
      await writeFile(jsonPath, `${JSON.stringify(table.rows)}\n`);
      await handle.connection.run(`DROP TABLE IF EXISTS ${tableName}; CREATE TABLE ${tableName} AS SELECT * FROM read_json_auto(${sqlString(jsonPath)}, format='array', sample_size=-1);`);
      await handle.connection.run(`COPY ${tableName} TO ${sqlString(parquetPath)} (FORMAT PARQUET, COMPRESSION ZSTD);`);
      const content = await readFile(parquetPath); const details = await stat(parquetPath);
      outputs.push({ tableName, path: basename(parquetPath), rowCount: table.rows.length, bytes: details.size, sha256: hash(content), grain: table.grain });
    }
  } finally {
    await closeDuckDb(handle);
    await rm(temporaryDir, { recursive: true, force: true });
  }
  const database = await readFile(databasePath); const details = await stat(databasePath);
  outputs.push({ tableName: "normalized_database", path: basename(databasePath), rowCount: Object.values(tables).reduce((sum, table) => sum + table.rows.length, 0), bytes: details.size, sha256: hash(database), grain: "registered normalized tables" });
  return outputs;
}

export async function buildNormalizedMarketData(options: BuildOptions): Promise<{ manifest: NormalizedSnapshotManifest; outputDir: string }> {
  const outputDir = resolve(options.outputDir ?? ".local-data/normalized-market-data");
  await mkdir(outputDir, { recursive: true });
  const model = await buildNormalizationTables(options);
  const outputs = await writeDatabaseAndParquet(outputDir, model.tables);
  const sourceFiles = model.sources.map((source) => ({ datasetId: source.definition.datasetId, sourceId: source.googleAdsReport?.sourceId ?? source.definition.sourceId, relativePath: source.definition.relativePath, rowCount: source.googleAdsReport?.observations.length ?? source.rows.length, columnNames: source.columnNames, sha256: source.sha256, geographyStrategy: source.definition.geographyStrategy, sensitivity: source.definition.sensitivity, allowedUse: source.definition.allowedUse, browserExposure: source.definition.browserExposure }));
  const manifest = normalizedSnapshotManifestSchema.parse({
    manifestVersion: "normalized-market-snapshot-v1",
    snapshotVersion: model.snapshotVersion,
    normalizationVersion: NORMALIZATION_VERSION,
    queryVersion: NORMALIZED_QUERY_VERSION,
    calculationVersion: NORMALIZED_CALCULATION_VERSION,
    builtAt: options.builtAt ?? new Date().toISOString(),
    censusUniverseVersion: "2023-07",
    censusSourceId: "SRC-014",
    sourceRootStored: false,
    rawExportsCopied: false,
    seoIncluded: false,
    purpose: "local_demo_geography_normalization",
    sourceFiles,
    outputs,
    coverage: model.coverage,
    warnings: [
      "Medium- and low-confidence geography assignments are demo inferences, not production geography.",
      "Google Ads CBSA assignments are inferred from display labels and do not use provider-stable geography IDs.",
      "Clinic outputs are internal aggregate local-demo evidence; raw clinic rows are not exposed by the query contract.",
      "State-only and national datasets remain at their source grain and are not forced into CBSAs.",
    ],
    exclusions: [
      "National SEO keyword files",
      "Raw CSV exports",
      "Customer-level, employee-level, medical, credential, lease, contact, and other restricted fields",
      "Scoring, ranking, causal claims, spend authorization, and external writes",
    ],
  });
  await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const report = [
    "# Normalized market data coverage",
    "",
    `Snapshot: \`${manifest.snapshotVersion}\``,
    "",
    "| Dataset | Source rows | CBSA | State | National | Unresolved | Coverage | Inferred | Review required |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...manifest.coverage.map((item) => `| ${item.datasetId} | ${item.sourceRowCount} | ${item.cbsaResolvedCount} | ${item.stateResolvedCount} | ${item.nationalCount} | ${item.unresolvedCount} | ${(item.coverageRate * 100).toFixed(1)}% | ${item.inferredCount} | ${item.reviewRequiredCount} |`),
    "",
    "All inferred mappings preserve the original label, method, confidence, alternatives, warnings, and review status. SEO is intentionally excluded because the supplied files are national.",
    "",
  ].join("\n");
  await writeFile(resolve(outputDir, "coverage-report.md"), report);
  return { manifest, outputDir };
}
