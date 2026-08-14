import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { canonicalObservationSchema, READINESS_CALCULATION_VERSION, READINESS_QUERY_VERSION, type CanonicalObservation, type QualityFinding, type QualityReport } from "../lib/clinic-market-readiness/contracts.ts";
import { closeDuckDb, openDuckDb, sqlString } from "../lib/evidence-snapshot/duckdb.ts";

const execFileAsync = promisify(execFile);
const sourceDir = process.env.SNOWFLAKE_EXPORT_DIR?.trim();
if (!sourceDir) throw new Error("Set SNOWFLAKE_EXPORT_DIR to the approved export directory.");
const snapshotDir = resolve(process.env.CLINIC_MARKET_SNAPSHOT_DIR?.trim() || "data/approved/snowflake/2026-08-13-market-data");
const databasePath = resolve(process.env.DUCKDB_PATH?.trim() || ".local/evidence-snapshot.duckdb");
const snapshotVersion = process.env.CLINIC_MARKET_SNAPSHOT_VERSION?.trim() || "clinic-market-evidence-2026-08-13-v1";
const transformationVersion = "clinic-market-evidence-snapshot-v1";

type LegacyRow = Record<string, unknown>;

function hash(content: Buffer | string) { return createHash("sha256").update(content).digest("hex"); }
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

function qualityReport(observations: CanonicalObservation[]): QualityReport {
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
    const observations = addLegacyObservations({ market_context: await read("market-context.json"), clinic_market_summary: await read("clinic-market-summary.json"), clinic_performance_market_summary: await read("clinic-performance-market-summary.json") });
    const synthetic = JSON.parse(await readFile(resolve("data/fixtures/clinic-market-readiness/reviewable.synthetic.json"), "utf8")) as unknown[];
    const all = [...observations, ...synthetic.map((row) => canonicalObservationSchema.parse(row))];
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(canonicalJson, `${JSON.stringify(all)}\n`);
    const markets = [...new Map(all.map((row) => [row.market_id, { market_id: row.market_id, cbsa_code: row.cbsa_code, market_name: row.market_name, is_synthetic: row.is_synthetic }])).values()];
    const sources = [...new Map(all.map((row) => [row.source_id, { source_id: row.source_id, source_file: row.source_file, grain: row.grain, sensitivity: row.sensitivity, allowed_use: row.allowed_use, scoring_eligibility: row.scoring_eligibility }])).values()];
    const marketsJson = join(legacyDir, "markets.json");
    const sourcesJson = join(legacyDir, "source_registry.json");
    await writeFile(marketsJson, `${JSON.stringify(markets)}\n`);
    await writeFile(sourcesJson, `${JSON.stringify(sources)}\n`);
    const handle = await openDuckDb(databasePath, false);
    try {
      await writeParquetFromJson(handle, canonicalJson, join(snapshotDir, "evidence_observations.parquet"));
      await writeParquetFromJson(handle, marketsJson, join(snapshotDir, "markets.parquet"));
      await writeParquetFromJson(handle, sourcesJson, join(snapshotDir, "source_registry.parquet"));
      await handle.connection.run(`COPY (SELECT * FROM read_parquet(${sqlString(join(snapshotDir, "evidence_observations.parquet"))}) WHERE quality_status = 'rejected') TO ${sqlString(join(snapshotDir, "rejected_observations.parquet"))} (FORMAT PARQUET, COMPRESSION ZSTD)`);
      await handle.connection.run(`CREATE OR REPLACE TABLE clinic_market_evidence AS SELECT * FROM read_parquet(${sqlString(join(snapshotDir, "evidence_observations.parquet"))})`);
    } finally { await closeDuckDb(handle); }
    const report = qualityReport(all);
    await writeFile(join(snapshotDir, "quality-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(join(snapshotDir, "quality-report.md"), markdownReport(report));
    const outputPaths = ["evidence_observations.parquet", "markets.parquet", "source_registry.parquet", "rejected_observations.parquet", "quality-report.json", "quality-report.md"];
    const outputs = [];
    for (const path of outputPaths) { const content = await readFile(join(snapshotDir, path)); outputs.push({ path, sha256: hash(content), bytes: content.byteLength }); }
    const manifest = { manifestVersion: "clinic-market-snapshot-manifest-v1", snapshotVersion, builtAt: new Date().toISOString(), sourceType: "approved_csv_plus_synthetic_fixture", rawExportsCopied: false, outputGrain: "one market x evidence domain x metric", outputs, inputFiles: [{ file: "approved CSV exports", path: sourceDir }, { file: "reviewable.synthetic.json", path: "data/fixtures/clinic-market-readiness/reviewable.synthetic.json" }], exclusions: ["Raw CSV exports", "Restricted values from browser and AI packets", "Google Ads and SEO observations until registered and approved", "Scoring and ranking"], knownIssues: report.findings.filter((finding) => finding.status !== "passed").map((finding) => finding.message), rejectedObservationCount: all.filter((row) => row.quality_status === "rejected").length, provenanceFields: ["evidence_status", "quality_status", "sensitivity", "allowed_use", "scoring_eligibility"], queryVersion: READINESS_QUERY_VERSION, calculationVersion: READINESS_CALCULATION_VERSION };
    await writeFile(join(snapshotDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({ snapshotDir, databasePath, snapshotVersion, observations: all.length, qualityStatus: report.status }, null, 2));
  } finally { await rm(legacyDir, { recursive: true, force: true }); }
}

await main();
