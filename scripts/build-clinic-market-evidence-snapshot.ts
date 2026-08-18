import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { parseGoogleAdsMatchedLocationsReport, type GoogleAdsMatchedLocationsReport } from "../lib/adapters/google-ads/index.ts";
import { parseCsv } from "../lib/adapters/snowflake-csv/parser.ts";
import { canonicalObservationSchema, READINESS_CALCULATION_VERSION, READINESS_QUERY_VERSION, type CanonicalObservation, type QualityFinding, type QualityReport } from "../lib/clinic-market-readiness/contracts.ts";
import type { GoogleAdsObservation } from "../lib/evidence-snapshot/contracts.ts";
import { closeDuckDb, openDuckDb, sqlString } from "../lib/evidence-snapshot/duckdb.ts";
import { sourceStatusManifestSchema, type SourceFileStatus, type SourceFamilyStatus } from "../lib/evidence-snapshot/source-status.ts";

const execFileAsync = promisify(execFile);
const sourceDir = (() => {
  const value = process.env.SNOWFLAKE_EXPORT_DIR?.trim();
  if (!value) throw new Error("Set SNOWFLAKE_EXPORT_DIR to the approved export directory.");
  return value;
})();
const snapshotDir = resolve(process.env.CLINIC_MARKET_SNAPSHOT_DIR?.trim() || "data/approved/snowflake/2026-08-13-market-data");
const databasePath = resolve(process.env.DUCKDB_PATH?.trim() || ".local/evidence-snapshot.duckdb");
const snapshotVersion = process.env.CLINIC_MARKET_SNAPSHOT_VERSION?.trim() || "clinic-market-evidence-2026-08-13-v1";
const transformationVersion = "clinic-market-evidence-snapshot-v1";
const googleAdsFiles = [
  process.env.GOOGLE_ADS_SEARCH_SHOPPING_FILE?.trim() || "Google Ads/Chewy Seach_Shopping.csv",
  process.env.GOOGLE_ADS_VET_CLINIC_SEARCH_FILE?.trim() || "Google Ads/Chewy Vet Clinic Seach.csv",
] as const;

type LegacyRow = Record<string, unknown>;
type ApprovedInputFile = { file: string; rowCount: number; sha256: string; ingestionStatus: "loaded" };

function hash(content: Buffer | string) { return createHash("sha256").update(content).digest("hex"); }

const sourceFileRules: Record<string, Omit<SourceFileStatus, "file" | "rowCount" | "sha256">> = {
  "General Regional/cbsa_market_attractiveness_2026-07-31-1246 (1).csv": { qualityStatus: "warning", sensitivity: "internal", allowedUse: "approved_internal_decision_support", browserAiExposure: "aggregate_only", geographicGrain: "one reported CBSA market x reporting date; some rows lack exact CBSA codes" },
  "General Regional/annual_net_sales_by_customer_zip.csv": { qualityStatus: "warning", sensitivity: "internal", allowedUse: "local_demo_cbsa_aggregate_only", browserAiExposure: "aggregate_only", geographicGrain: "one customer-address ZIP x year" },
  "General Regional/cbsa_population_estimates.csv": { qualityStatus: "not_assessed", sensitivity: "internal", allowedUse: "approved_internal_decision_support", browserAiExposure: "aggregate_only", geographicGrain: "one CBSA x population estimate" },
  "General Regional/customer_zip_to_metro_state_mapping.csv": { qualityStatus: "not_assessed", sensitivity: "internal", allowedUse: "approved_internal_decision_support", browserAiExposure: "aggregate_only", geographicGrain: "one ZIP x metro x state" },
  "General Regional/zcta5_household_income_and_family_estimates_2026-08-10.csv": { qualityStatus: "not_assessed", sensitivity: "internal", allowedUse: "approved_internal_decision_support", browserAiExposure: "aggregate_only", geographicGrain: "one ZCTA5 x household context" },
  "General Regional/zip_code_to_cbsa_csa_statistical_area_mapping.csv": { qualityStatus: "warning", sensitivity: "internal", allowedUse: "approved_internal_decision_support", browserAiExposure: "aggregate_only", geographicGrain: "one ZIP x reported CBSA mapping" },
  "Clinic/clinic_market_profile_ownership_demographics.csv": { qualityStatus: "warning", sensitivity: "internal", allowedUse: "local_demo_aggregate_decision_support", browserAiExposure: "aggregate_only", geographicGrain: "one clinic profile row with reported market context" },
  "Clinic/clinic_level_pre_post_ph_orders_prescriptions_sales.csv": { qualityStatus: "warning", sensitivity: "internal", allowedUse: "local_demo_aggregate_decision_support", browserAiExposure: "aggregate_only", geographicGrain: "one clinic x timeframe activity row" },
  "Clinic/monthly_appointment_counts_by_geography_type_state_reason.csv": { qualityStatus: "not_assessed", sensitivity: "internal", allowedUse: "approved_internal_decision_support", browserAiExposure: "aggregate_only", geographicGrain: "one state x month x appointment dimensions" },
  "Clinic/weekly_customer_lifecycle_retention_metrics_by_channel.csv": { qualityStatus: "not_assessed", sensitivity: "internal", allowedUse: "approved_internal_decision_support", browserAiExposure: "aggregate_only", geographicGrain: "one week x aggregation level x business channel" },
};

function approvedFileStatus(input: ApprovedInputFile): SourceFileStatus {
  const rules = sourceFileRules[input.file];
  if (!rules) throw new Error(`No source-status rule exists for approved input ${input.file}.`);
  return { file: input.file, rowCount: input.rowCount, sha256: input.sha256, ...rules };
}

async function csvFilesInOptionalDirectory(directoryName: string, allowedUse: string): Promise<SourceFileStatus[]> {
  const directory = resolve(sourceDir, directoryName);
  let names: string[];
  try { names = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv")).map((entry) => entry.name).sort(); }
  catch { return []; }
  const files: SourceFileStatus[] = [];
  for (const name of names) {
    const text = await readFile(join(directory, name), "utf8");
    const rows = parseCsv(text);
    files.push({ file: `${directoryName}/${name}`, rowCount: rows.length, sha256: hash(text), qualityStatus: "not_assessed", sensitivity: "internal", allowedUse, browserAiExposure: "none", geographicGrain: "unregistered source grain" });
  }
  return files;
}

async function buildSourceStatus(input: { approvedInputs: ApprovedInputFile[]; googleAdsReports: GoogleAdsMatchedLocationsReport[]; builtAt: string }) {
  const approvedFiles = input.approvedInputs.map(approvedFileStatus);
  const seoFiles = await csvFilesInOptionalDirectory("SEO Keywords", "national_directional_context_only_after_registration");
  const seoHeaders = await Promise.all(seoFiles.map(async (file) => Object.keys(parseCsv(await readFile(resolve(sourceDir, file.file), "utf8"))[0] ?? {})));
  const geographyFieldPattern = /^(market|market_id|cbsa|cbsa_code|zip|zip_code|dma|dma_code|state|city|location|geography)$/i;
  const seoGeographyFields = [...new Set(seoHeaders.flat().filter((header) => geographyFieldPattern.test(header.trim())))];
  const pricingFiles = await csvFilesInOptionalDirectory("Pricing", "unregistered_context_only");
  const competitorFiles = await csvFilesInOptionalDirectory("Competitors", "unregistered_context_only");
  const family = (value: SourceFamilyStatus) => value;
  return sourceStatusManifestSchema.parse({
    manifestVersion: "demo-source-status-v1",
    snapshotVersion,
    builtAt: input.builtAt,
    rawExportsCopied: false,
    families: [
      family({ sourceFamily: "general_regional", status: "loaded", evidenceStatus: "Reported", qualityStatus: "warning", geographyStatus: "partial_stable_keys", allowedUse: "local_demo_aggregate_decision_support", files: approvedFiles.filter((file) => file.file.startsWith("General Regional/")), limitations: ["Some market rows lack exact CBSA codes.", "ZIP sales may cross the browser boundary only after CBSA aggregation."] }),
      family({ sourceFamily: "clinic", status: "loaded", evidenceStatus: "Reported", qualityStatus: "warning", geographyStatus: "partial_stable_keys", allowedUse: "local_demo_aggregate_decision_support", files: approvedFiles.filter((file) => file.file.startsWith("Clinic/")), limitations: ["Clinic profile and activity aggregates are approved for this local demo.", "The completed-appointments outcome, shared maturity window, and approved real peer cohort remain unavailable in the supplied files."] }),
      family({ sourceFamily: "google_ads", status: "registered_context_only", evidenceStatus: "Reported", qualityStatus: "valid", geographyStatus: "matched_location_label_only", allowedUse: "matched_location_descriptive_context_only", files: input.googleAdsReports.map((report) => ({ file: `Google Ads/${report.sourceFile}`, rowCount: report.observations.length, sha256: report.sourceSha256, qualityStatus: report.observations.every((row) => row.qualityStatus === "valid") ? "valid" : "warning", sensitivity: "internal", allowedUse: "matched_location_descriptive_context_only", browserAiExposure: "aggregate_only", geographicGrain: "one matched-location label x report scope x observation window" })), limitations: ["No stable Google Ads geography ID is present.", "CBSA joins, cross-source regional comparison, scoring, and ranking are blocked."] }),
      family({ sourceFamily: "seo", status: seoFiles.length ? "present_unregistered" : "unavailable", evidenceStatus: seoFiles.length ? "Reported" : "Unknown", qualityStatus: seoFiles.length ? "not_assessed" : "blocked", geographyStatus: seoFiles.length ? (seoGeographyFields.length ? "unreviewed_geography_present" : "national_no_geography") : "unavailable", allowedUse: seoFiles.length ? (seoGeographyFields.length ? "blocked_pending_geography_review_and_registration" : "national_directional_context_only_after_registration") : "unavailable", files: seoFiles, limitations: seoFiles.length ? [seoGeographyFields.length ? `Potential geography fields require review: ${seoGeographyFields.join(", ")}.` : "No market, CBSA, ZIP, DMA, state, city, location, or geography field was detected.", "SEO is not available to regional queries until a typed adapter and query are registered."] : ["No SEO CSV files were found in the exact supplied folder."] }),
      family({ sourceFamily: "pricing", status: pricingFiles.length ? "present_unregistered" : "unavailable", evidenceStatus: pricingFiles.length ? "Reported" : "Unknown", qualityStatus: pricingFiles.length ? "not_assessed" : "blocked", geographyStatus: pricingFiles.length ? "unreviewed_geography_present" : "unavailable", allowedUse: pricingFiles.length ? "blocked_pending_registration" : "unavailable", files: pricingFiles, limitations: pricingFiles.length ? ["Pricing files are present but unregistered."] : ["No Pricing directory or CSV files were found in the exact supplied data root."] }),
      family({ sourceFamily: "competitor", status: competitorFiles.length ? "present_unregistered" : "unavailable", evidenceStatus: competitorFiles.length ? "Reported" : "Unknown", qualityStatus: competitorFiles.length ? "not_assessed" : "blocked", geographyStatus: competitorFiles.length ? "unreviewed_geography_present" : "unavailable", allowedUse: competitorFiles.length ? "blocked_pending_registration" : "unavailable", files: competitorFiles, limitations: competitorFiles.length ? ["Competitor files are present but unregistered."] : ["No dedicated Competitors directory or CSV files were found in the exact supplied data root."] }),
    ],
  });
}
function sourceFrom(row: LegacyRow, fallback: string) {
  const source = row.source && typeof row.source === "object" ? row.source as LegacyRow : {};
  return {
    sourceId: String(source.sourceId ?? fallback),
    sourceFile: String(source.sourceFile ?? "approved-snowflake-snapshot"),
    grain: String(source.grain ?? "source-derived aggregate"),
    sensitivity: String(source.sensitivity ?? "internal"),
    allowedUse: String(source.allowedUse ?? "approved_internal_decision_support"),
  };
}

function observation(input: {
  marketId: string;
  cbsaCode: string | null;
  marketName: string;
  domain: CanonicalObservation["evidence_domain"];
  metricId: string;
  value: unknown;
  unit: string;
  observedAt: unknown;
  source: ReturnType<typeof sourceFrom>;
  evidenceStatus?: CanonicalObservation["evidence_status"];
  qualityStatus?: CanonicalObservation["quality_status"];
  allowedUse?: string;
  isSynthetic?: boolean;
  warning?: string | null;
}): CanonicalObservation {
  const numeric = typeof input.value === "number" && Number.isFinite(input.value) ? input.value : null;
  return canonicalObservationSchema.parse({
    observation_id: `${input.marketId}:${input.domain}:${input.metricId}`,
    market_id: input.marketId,
    cbsa_code: input.cbsaCode,
    market_name: input.marketName,
    evidence_domain: input.domain,
    metric_id: input.metricId,
    raw_value: numeric,
    unit: input.unit,
    observed_at: input.observedAt == null ? null : String(input.observedAt),
    source_id: input.source.sourceId,
    source_file: input.source.sourceFile,
    grain: input.source.grain,
    evidence_status: input.evidenceStatus ?? "Reported",
    quality_status: input.qualityStatus ?? "warning",
    sensitivity: input.source.sensitivity as CanonicalObservation["sensitivity"],
    allowed_use: input.allowedUse ?? input.source.allowedUse,
    scoring_eligibility: "none",
    transformation_version: transformationVersion,
    is_synthetic: input.isSynthetic ?? false,
    warning: input.warning ?? null,
  });
}

function addLegacyObservations(rows: Record<string, LegacyRow[]>): CanonicalObservation[] {
  const output: CanonicalObservation[] = [];
  for (const row of rows.market_context ?? []) {
    if (typeof row.marketId !== "string" || typeof row.cbsaName !== "string") continue;
    const source = sourceFrom(row, "SNOWFLAKE-CSV-MARKET-CONTEXT");
    const quality = row.qualityStatus === "OK" ? "accepted" : "warning";
    for (const [metricId, value, unit] of [
      ["market.active_customer_count", row.activeCustomerCount, "customers"],
      ["market.prior_year_active_customer_count", row.priorYearActiveCustomerCount, "customers"],
      ["market.active_customer_yoy_growth", row.activeCustomerYoyGrowth, "ratio"],
      ["market.total_households", row.totalHouseholds, "households"],
      ["market.active_customers_per_1000_households", row.activeCustomersPer1000Households, "customers_per_1000_households"],
    ] as const) output.push(observation({ marketId: row.marketId, cbsaCode: typeof row.cbsaCode === "string" ? row.cbsaCode : null, marketName: row.cbsaName, domain: "market_context", metricId, value, unit, observedAt: row.reportingDate, source, qualityStatus: quality, warning: quality === "warning" ? String(row.qualityStatus ?? "source quality warning") : null }));
  }
  for (const row of rows.clinic_market_summary ?? []) {
    if (typeof row.marketId !== "string" || typeof row.cbsaName !== "string") continue;
    const source = sourceFrom(row, "SNOWFLAKE-CSV-CLINIC-PROFILE");
    output.push(observation({ marketId: row.marketId, cbsaCode: typeof row.cbsaCode === "string" ? row.cbsaCode : null, marketName: row.cbsaName, domain: "clinic_identity", metricId: "clinic.profile_count", value: row.clinicCount, unit: "clinic_profile_rows", observedAt: null, source, qualityStatus: "warning", allowedUse: "approved_internal_decision_support_pending_identity_rule", warning: "Physical clinic-location identity rule is unresolved." }));
  }
  for (const row of rows.clinic_performance_market_summary ?? []) {
    if (typeof row.marketId !== "string" || typeof row.cbsaName !== "string") continue;
    const source = sourceFrom(row, "SNOWFLAKE-CSV-CLINIC-ACTIVITY");
    output.push(observation({ marketId: row.marketId, cbsaCode: typeof row.cbsaCode === "string" ? row.cbsaCode : null, marketName: row.cbsaName, domain: "clinic_performance", metricId: "clinic.performance_net_sales", value: row.netSales, unit: "source_currency", observedAt: null, source, qualityStatus: "warning", allowedUse: "approved_internal_decision_support", warning: "Outcome definition, maturity window, and comparable cohort should be documented for interpretation." }));
  }
  return output;
}

function qualityReport(observations: CanonicalObservation[], googleAds: GoogleAdsObservation[]): QualityReport {
  const findings: QualityFinding[] = [];
  const ids = observations.map((row) => row.observation_id);
  const duplicateCount = ids.length - new Set(ids).size;
  if (duplicateCount) findings.push({ findingId: "Q-001", severity: "critical", status: "failed", check: "observation_key_uniqueness", message: "Canonical observation IDs are duplicated.", evidence: { duplicateCount }, impact: "A query could double-count evidence.", remediation: "Correct the source grain or transformation before review." });
  const rejectedCount = observations.filter((row) => row.quality_status === "rejected").length;
  if (rejectedCount) findings.push({ findingId: "Q-002", severity: "high", status: "warning", check: "rejected_observations", message: "Rejected observations were retained for audit and excluded from packets.", evidence: { rejectedCount }, impact: "Evidence coverage may be incomplete.", remediation: "Resolve source validation failures or document the missing evidence." });
  const performanceRows = observations.filter((row) => row.evidence_domain === "clinic_performance").length;
  if (performanceRows) findings.push({ findingId: "Q-003", severity: "medium", status: "warning", check: "clinic_performance_definition", message: "Clinic performance evidence is available; outcome, maturity, and cohort definitions should be documented.", evidence: { affectedObservations: performanceRows }, impact: "Interpretation and cross-market comparison may vary until the definitions are documented.", remediation: "Document the outcome, maturity window, and comparable cohort without excluding the available evidence." });
  const missingGeography = observations.filter((row) => row.cbsa_code === null && !row.is_synthetic).length;
  if (missingGeography) findings.push({ findingId: "Q-004", severity: "high", status: "warning", check: "exact_market_geography", message: "Non-synthetic observations lack an exact CBSA code.", evidence: { affectedObservations: missingGeography }, impact: "Market joins and comparisons may be ambiguous.", remediation: "Resolve the approved geography assignment; do not fuzzy-match at runtime." });
  findings.push({ findingId: "Q-005", severity: "low", status: "passed", check: "restricted_output_boundary", message: "Restricted values are excluded by the readiness query boundary.", evidence: { restrictedRowsInCanonicalSnapshot: observations.filter((row) => row.sensitivity === "restricted").length }, impact: "No direct impact when the packet boundary is respected.", remediation: "Keep browser and AI outputs aggregate-only." });
  findings.push({ findingId: "Q-006", severity: "medium", status: "warning", check: "google_ads_stable_geography", message: "Google Ads observations have matched-location labels but no approved stable geography IDs.", evidence: { affectedObservations: googleAds.length }, impact: "The observations can provide descriptive context but cannot support CBSA joins, cross-source regional comparison, scoring, or ranking.", remediation: "Export Google Ads stable location IDs and approve an exact geography bridge before enabling market-level use." });
  const googleAdsWarningCount = googleAds.filter((row) => row.qualityStatus !== "valid").length;
  findings.push({ findingId: "Q-007", severity: googleAdsWarningCount ? "low" : "low", status: googleAdsWarningCount ? "warning" : "passed", check: "google_ads_metric_reconciliation", message: googleAdsWarningCount ? "Some Google Ads observations have metric-reconciliation or completeness warnings." : "Google Ads reported metrics reconcile within declared rounding tolerances.", evidence: { observationCount: googleAds.length, warningOrRejectedCount: googleAdsWarningCount }, impact: googleAdsWarningCount ? "Affected metrics require their attached warnings during interpretation." : "No direct impact for descriptive context.", remediation: googleAdsWarningCount ? "Review the source rows and preserve warnings; do not silently recalculate reported values." : "Retain the current deterministic checks." });
  const qualityCounts = Object.fromEntries(["accepted", "warning", "rejected"].map((status) => [status, observations.filter((row) => row.quality_status === status).length]));
  const evidenceCounts = Object.fromEntries(["Confirmed", "Reported", "Derived", "Hypothesis", "Unknown"].map((status) => [status, observations.filter((row) => row.evidence_status === status).length]));
  const sensitivityCounts = Object.fromEntries(["public", "internal", "confidential", "restricted"].map((status) => [status, observations.filter((row) => row.sensitivity === status).length]));
  return { reportVersion: "clinic-market-quality-report-v1", snapshotVersion, generatedAt: new Date().toISOString(), intendedUse: "One-market clinic evidence-readiness review; not scoring or site selection.", observationCount: observations.length, marketCount: new Set(observations.map((row) => row.market_id)).size, sourceCount: new Set(observations.map((row) => row.source_id)).size, evidenceCounts, qualityCounts, sensitivityCounts, findings, status: findings.some((finding) => finding.severity === "critical" && finding.status === "failed") ? "blocked" : findings.some((finding) => finding.status === "warning") ? "ready_with_warnings" : "ready", completenessThreshold: 0.8, queryVersion: READINESS_QUERY_VERSION, calculationVersion: READINESS_CALCULATION_VERSION };
}

function markdownReport(report: QualityReport) {
  const findings = report.findings.map((finding) => `- **${finding.severity} ${finding.status}** ${finding.findingId}: ${finding.message} ${finding.impact} Remediation: ${finding.remediation}`).join("\n");
  return `# Clinic-market snapshot quality report\n\n- Snapshot: \`${report.snapshotVersion}\`\n- Status: **${report.status}**\n- Intended use: ${report.intendedUse}\n- Observations: ${report.observationCount}\n- Markets: ${report.marketCount}\n- Sources: ${report.sourceCount}\n- Completeness threshold: ${report.completenessThreshold * 100}%\n\n## Findings\n\n${findings}\n`;
}

async function writeParquetFromJson(handle: Awaited<ReturnType<typeof openDuckDb>>, jsonPath: string, parquetPath: string) {
  await handle.connection.run(`COPY (SELECT * FROM read_json_auto(${sqlString(jsonPath)}, records=true, format='array')) TO ${sqlString(parquetPath)} (FORMAT PARQUET, COMPRESSION ZSTD)`);
}

async function main() {
  const legacyDir = await mkdtemp(join(tmpdir(), "clinic-market-legacy-"));
  const canonicalJson = join(legacyDir, "evidence_observations.json");
  try {
    await execFileAsync(process.execPath, ["--experimental-strip-types", resolve("scripts/build-approved-snowflake-snapshot.ts")], { env: {
      ...process.env,
      SNOWFLAKE_EXPORT_DIR: sourceDir,
      SNOWFLAKE_SNAPSHOT_DIR: legacyDir,
      SNOWFLAKE_CLINIC_PROFILE_FILE: "Clinic/clinic_market_profile_ownership_demographics.csv",
      SNOWFLAKE_APPOINTMENTS_FILE: "Clinic/monthly_appointment_counts_by_geography_type_state_reason.csv",
      SNOWFLAKE_CLINIC_ACTIVITY_FILE: "Clinic/clinic_level_pre_post_ph_orders_prescriptions_sales.csv",
      SNOWFLAKE_RETENTION_FILE: "Clinic/weekly_customer_lifecycle_retention_metrics_by_channel.csv",
      SNOWFLAKE_CBSA_POPULATION_FILE: "General Regional/cbsa_population_estimates.csv",
      SNOWFLAKE_ZIP_CBSA_FILE: "General Regional/zip_code_to_cbsa_csa_statistical_area_mapping.csv",
      SNOWFLAKE_ZIP_METRO_FILE: "General Regional/customer_zip_to_metro_state_mapping.csv",
      SNOWFLAKE_ZIP_SALES_FILE: "General Regional/annual_net_sales_by_customer_zip.csv",
      SNOWFLAKE_MARKET_FILE: "General Regional/cbsa_market_attractiveness_2026-07-31-1246 (1).csv",
      SNOWFLAKE_ZIP_CONTEXT_FILE: "General Regional/zcta5_household_income_and_family_estimates_2026-08-10.csv",
    } });
    const read = async (file: string) => JSON.parse(await readFile(join(legacyDir, file), "utf8")) as LegacyRow[];
    const approvedManifest = JSON.parse(await readFile(join(legacyDir, "manifest.json"), "utf8")) as { inputFiles: ApprovedInputFile[] };
    const observations = addLegacyObservations({ market_context: await read("market-context.json"), clinic_market_summary: await read("clinic-market-summary.json"), clinic_performance_market_summary: await read("clinic-performance-market-summary.json") });
    const googleAdsReports: GoogleAdsMatchedLocationsReport[] = [];
    for (const relativePath of googleAdsFiles) {
      const text = await readFile(resolve(sourceDir, relativePath), "utf8");
      googleAdsReports.push(parseGoogleAdsMatchedLocationsReport({ text, fileName: relativePath, snapshotId: snapshotVersion }));
    }
    const googleAdsObservations = googleAdsReports
      .flatMap((report) => report.observations)
      .sort((left, right) => left.reportScope.localeCompare(right.reportScope) || left.matchedLocationLabel.localeCompare(right.matchedLocationLabel));
    const synthetic = JSON.parse(await readFile(resolve("data/fixtures/clinic-market-readiness/reviewable.synthetic.json"), "utf8")) as unknown[];
    const all = [...observations, ...synthetic.map((row) => canonicalObservationSchema.parse(row))];
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(canonicalJson, `${JSON.stringify(all)}\n`);
    const googleAdsJson = join(legacyDir, "google_ads_matched_location_context.json");
    await writeFile(googleAdsJson, `${JSON.stringify(googleAdsObservations)}\n`);
    const markets = [...new Map(all.map((row) => [row.market_id, { market_id: row.market_id, cbsa_code: row.cbsa_code, market_name: row.market_name, is_synthetic: row.is_synthetic }])).values()];
    const sources = [...new Map([
      ...all.map((row) => [row.source_id, { source_id: row.source_id, source_file: row.source_file, grain: row.grain, sensitivity: row.sensitivity, allowed_use: row.allowed_use, scoring_eligibility: row.scoring_eligibility }] as const),
      ...googleAdsReports.map((report) => [report.sourceId, { source_id: report.sourceId, source_file: report.sourceFile, grain: "one matched-location label x report scope x observation window", sensitivity: "internal", allowed_use: "matched_location_descriptive_context_only", scoring_eligibility: "none" }] as const),
    ]).values()];
    const marketsJson = join(legacyDir, "markets.json");
    const sourcesJson = join(legacyDir, "source_registry.json");
    await writeFile(marketsJson, `${JSON.stringify(markets)}\n`);
    await writeFile(sourcesJson, `${JSON.stringify(sources)}\n`);
    const handle = await openDuckDb(databasePath, false);
    try {
      await writeParquetFromJson(handle, canonicalJson, join(snapshotDir, "evidence_observations.parquet"));
      await writeParquetFromJson(handle, googleAdsJson, join(snapshotDir, "google_ads_matched_location_context.parquet"));
      await writeParquetFromJson(handle, marketsJson, join(snapshotDir, "markets.parquet"));
      await writeParquetFromJson(handle, sourcesJson, join(snapshotDir, "source_registry.parquet"));
      await handle.connection.run(`COPY (SELECT * FROM read_parquet(${sqlString(join(snapshotDir, "evidence_observations.parquet"))}) WHERE quality_status = 'rejected') TO ${sqlString(join(snapshotDir, "rejected_observations.parquet"))} (FORMAT PARQUET, COMPRESSION ZSTD)`);
      await handle.connection.run(`CREATE OR REPLACE TABLE clinic_market_evidence AS SELECT * FROM read_parquet(${sqlString(join(snapshotDir, "evidence_observations.parquet"))})`);
      await handle.connection.run(`CREATE OR REPLACE TABLE google_ads_matched_location_context AS SELECT * FROM read_parquet(${sqlString(join(snapshotDir, "google_ads_matched_location_context.parquet"))})`);
    } finally { await closeDuckDb(handle); }
    const report = qualityReport(all, googleAdsObservations);
    const builtAt = new Date().toISOString();
    const sourceStatus = await buildSourceStatus({ approvedInputs: approvedManifest.inputFiles, googleAdsReports, builtAt });
    await writeFile(join(snapshotDir, "quality-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(join(snapshotDir, "quality-report.md"), markdownReport(report));
    await writeFile(join(snapshotDir, "source-status.json"), `${JSON.stringify(sourceStatus, null, 2)}\n`);
    const outputPaths = ["evidence_observations.parquet", "google_ads_matched_location_context.parquet", "markets.parquet", "source_registry.parquet", "rejected_observations.parquet", "quality-report.json", "quality-report.md", "source-status.json"];
    const outputs = [];
    for (const path of outputPaths) { const content = await readFile(join(snapshotDir, path)); outputs.push({ path, sha256: hash(content), bytes: content.byteLength }); }
    const manifest = {
      manifestVersion: "clinic-market-snapshot-manifest-v2",
      snapshotVersion,
      builtAt,
      sourceType: "approved_csv_plus_registered_google_ads_context_plus_synthetic_fixture",
      rawExportsCopied: false,
      outputGrain: "canonical market evidence plus separate matched-location Google Ads context",
      outputs,
      inputFiles: [
        { file: "approved CSV exports", path: sourceDir },
        ...googleAdsReports.map((googleAdsReport) => ({ file: googleAdsReport.sourceFile, sha256: googleAdsReport.sourceSha256, rowCount: googleAdsReport.observations.length })),
        { file: "reviewable.synthetic.json", path: "data/fixtures/clinic-market-readiness/reviewable.synthetic.json" },
      ],
      googleAdsRegistration: googleAdsReports.map((googleAdsReport) => ({
        sourceId: googleAdsReport.sourceId,
        sourceFile: googleAdsReport.sourceFile,
        sha256: googleAdsReport.sourceSha256,
        observationStart: googleAdsReport.observationStart,
        observationEnd: googleAdsReport.observationEnd,
        observationCount: googleAdsReport.observations.length,
        totalRowsExcluded: googleAdsReport.totalRowsExcluded,
        geographyType: "matched_location_label",
        stableGeographyIdAvailable: false,
        allowedUse: "matched_location_descriptive_context_only",
        marketJoinEligibility: "blocked_missing_stable_geography_id",
        rankingEligibility: "none",
        findings: googleAdsReport.findings,
      })),
      exclusions: ["Raw CSV exports", "Restricted values from browser and AI packets", "Google Ads CBSA joins, cross-source regional comparison, scoring, and ranking until stable geography IDs are registered", "SEO observations until registered and approved", "Scoring and ranking"],
      knownIssues: report.findings.filter((finding) => finding.status !== "passed").map((finding) => finding.message),
      rejectedObservationCount: all.filter((row) => row.quality_status === "rejected").length + googleAdsObservations.filter((row) => row.qualityStatus === "rejected").length,
      provenanceFields: ["evidence_status", "quality_status", "sensitivity", "allowed_use", "scoring_eligibility", "source_file", "source_sha256", "source_row_number", "transformation_version"],
      queryVersion: READINESS_QUERY_VERSION,
      calculationVersion: READINESS_CALCULATION_VERSION,
    };
    await writeFile(join(snapshotDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({ snapshotDir, databasePath, snapshotVersion, observations: all.length, googleAdsMatchedLocationObservations: googleAdsObservations.length, qualityStatus: report.status }, null, 2));
  } finally { await rm(legacyDir, { recursive: true, force: true }); }
}

await main();
