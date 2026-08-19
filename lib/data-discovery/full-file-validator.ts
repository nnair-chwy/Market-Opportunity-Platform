import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { DiscoveredSourceProfile } from "./contracts.ts";
import { firstPartyOutcomeDefinitions, assessOutcomeCandidate, firstPartyOutcomeIdSchema, type FirstPartyOutcomeId } from "./outcome-readiness.ts";

export const FULL_FILE_VALIDATION_VERSION = "discovered-source-full-validation-v1" as const;
export const SEMANTIC_SOURCE_CONTRACT_VERSION = "semantic-regional-outcome-source-v1" as const;

const fieldValidationSchema = z.object({
  field: z.string(),
  role: z.enum(["grain", "geography", "time", "metric", "context"]),
  missingCount: z.number().int().nonnegative(),
  invalidCount: z.number().int().nonnegative(),
}).strict();

export const semanticSourceContractSchema = z.object({
  version: z.literal(SEMANTIC_SOURCE_CONTRACT_VERSION),
  sourceId: z.string(),
  packageId: z.string(),
  fileSha256: z.string().regex(/^[a-f0-9]{64}$/),
  format: z.enum(["csv", "tsv", "xlsx", "parquet"]),
  rowCount: z.number().int().positive(),
  rawRowsStored: z.literal(false),
  allowedUse: z.string(),
  sensitivity: z.enum(["public", "internal"]),
  privacy: z.object({ directIdentifiersDetected: z.literal(false), aggregateOnly: z.literal(true) }).strict(),
  grain: z.object({ keyFields: z.array(z.string()).min(1), uniqueness: z.literal("validated_unique"), duplicateRowCount: z.literal(0) }).strict(),
  geography: z.object({ grain: z.enum(["zip", "cbsa", "dma", "state", "county", "trade_area", "drive_time", "point"]), fields: z.array(z.string()).min(1), validity: z.literal("all_rows_valid"), semanticStatus: z.literal("candidate_requires_owner_review") }).strict(),
  time: z.object({ grain: z.enum(["day", "week", "month", "quarter", "year", "range", "snapshot"]), fields: z.array(z.string()).min(1), validity: z.literal("all_rows_valid"), semanticStatus: z.literal("candidate_requires_owner_review") }).strict(),
  metrics: z.array(z.object({ outcomeId: firstPartyOutcomeIdSchema, sourceField: z.string(), unit: z.string(), validity: z.literal("all_rows_numeric"), definitionStatus: z.literal("candidate_requires_owner_review") }).strict()).min(1),
  fieldValidation: z.array(fieldValidationSchema),
  approvalState: z.literal("candidate_requires_owner_review"),
  queryEligibility: z.literal("none_pending_semantic_approval"),
  limitations: z.array(z.string()).min(1),
}).strict();
export type SemanticSourceContract = z.infer<typeof semanticSourceContractSchema>;

export const fullFileValidationReportSchema = z.object({
  version: z.literal(FULL_FILE_VALIDATION_VERSION),
  sourceId: z.string(),
  status: z.enum(["structurally_valid_candidate", "failed_closed"]),
  rowsValidated: z.number().int().nonnegative(),
  distinctGrainKeys: z.number().int().nonnegative(),
  duplicateRowCount: z.number().int().nonnegative(),
  fieldValidation: z.array(fieldValidationSchema),
  failures: z.array(z.string()),
  rawRowsStored: z.literal(false),
  semanticContract: semanticSourceContractSchema.nullable(),
}).strict();
export type FullFileValidationReport = z.infer<typeof fullFileValidationReportSchema>;

export const semanticSourceContractRegistrySchema = z.object({
  version: z.literal("semantic-source-contract-registry-v1"),
  generatedAt: z.string().datetime(),
  rawRowsStored: z.literal(false),
  reports: z.array(fullFileValidationReportSchema),
  contracts: z.array(semanticSourceContractSchema),
  summary: z.object({ validatedCandidateCount: z.number().int().nonnegative(), failedClosedCount: z.number().int().nonnegative(), pendingOwnerReviewCount: z.number().int().nonnegative() }).strict(),
}).strict();

type Row = Record<string, unknown>;

function uniqueHeaders(values: string[]) {
  const trimmed = values.map((value) => value.replace(/^\uFEFF/, "").trim());
  if (trimmed.some((value) => !value)) throw new Error("The full file contains an unnamed column.");
  if (new Set(trimmed).size !== trimmed.length) throw new Error("The full file contains duplicate column names.");
  return trimmed;
}

async function xlsxRows(file: string): Promise<Row[]> {
  const details = await stat(file);
  if (details.size > 10 * 1024 * 1024) throw new Error("XLSX full-file validation is limited to 10 MB; convert larger approved aggregates to Parquet before validation.");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readFile(file) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  if (workbook.worksheets.length !== 1) throw new Error("XLSX candidates must contain exactly one worksheet to avoid ambiguous table selection.");
  const worksheet = workbook.worksheets[0];
  const headers = uniqueHeaders((worksheet.getRow(1).values as unknown[]).slice(1).map((value) => String(value ?? "")));
  const rows: Row[] = [];
  if (worksheet.rowCount > 250_001) throw new Error("XLSX full-file validation is limited to 250,000 data rows; convert larger approved aggregates to Parquet.");
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const values = worksheet.getRow(rowNumber).values as unknown[];
    if (values.slice(1).every((value) => value === null || value === undefined || value === "")) continue;
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index + 1] ?? null])));
  }
  return rows;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function blankSql(field: string) {
  const column = quoteIdentifier(field);
  return `${column} IS NULL OR trim(CAST(${column} AS VARCHAR)) = ''`;
}

function validTimeSql(field: string, grain: DiscoveredSourceProfile["time"]["grain"]) {
  const column = `trim(CAST(${quoteIdentifier(field)} AS VARCHAR))`;
  if (grain === "year") return `regexp_full_match(${column}, '[0-9]{4}')`;
  if (grain === "quarter") return `regexp_full_match(upper(${column}), '[0-9]{4}[- ]?Q[1-4]')`;
  if (grain === "month") return `regexp_full_match(${column}, '[0-9]{4}[-/][0-9]{1,2}([-/][0-9]{1,2})?')`;
  return `try_cast(${column} AS TIMESTAMP) IS NOT NULL`;
}

function validGeographySql(field: string, grain: DiscoveredSourceProfile["geography"]["grain"]) {
  const column = `trim(CAST(${quoteIdentifier(field)} AS VARCHAR))`;
  if (grain === "zip" || grain === "cbsa") return `regexp_full_match(${column}, '[0-9]{5}')`;
  if (grain === "state") return `regexp_full_match(upper(${column}), '[A-Z]{2}')`;
  if (grain === "dma" && /code|id/i.test(field)) return `regexp_full_match(${column}, '[0-9]{3}')`;
  if (grain === "point" && /lat/i.test(field)) return `try_cast(${column} AS DOUBLE) BETWEEN -90 AND 90`;
  if (grain === "point" && /lon|lng/i.test(field)) return `try_cast(${column} AS DOUBLE) BETWEEN -180 AND 180`;
  return `${column} <> ''`;
}

async function aggregateTabularFile(file: string, profile: DiscoveredSourceProfile, requiredFields: string[], keyFields: string[], geographyFields: string[], timeFields: string[], metricFields: string[]) {
  const { closeDuckDb, openDuckDb, sqlString } = await import("../evidence-snapshot/duckdb.ts");
  const handle = await openDuckDb(":memory:");
  try {
    const source = profile.format === "parquet"
      ? `read_parquet(${sqlString(file)})`
      : `read_csv_auto(${sqlString(file)}, header=true, all_varchar=true, ignore_errors=false, sample_size=-1, delim=${sqlString(profile.format === "tsv" ? "\t" : ",")})`;
    const aggregates: string[] = ["count(*) AS row_count"];
    requiredFields.forEach((field, index) => {
      const blank = blankSql(field);
      let valid = "TRUE";
      if (geographyFields.includes(field)) valid = validGeographySql(field, profile.geography.grain);
      else if (timeFields.includes(field)) valid = validTimeSql(field, profile.time.grain);
      else if (metricFields.includes(field)) valid = `try_cast(regexp_replace(CAST(${quoteIdentifier(field)} AS VARCHAR), '[$,%]', '', 'g') AS DOUBLE) IS NOT NULL`;
      aggregates.push(`count(*) FILTER (WHERE ${blank}) AS missing_${index}`);
      aggregates.push(`count(*) FILTER (WHERE NOT (${blank}) AND NOT (${valid})) AS invalid_${index}`);
    });
    const keyList = keyFields.map(quoteIdentifier).join(", ");
    const sql = `WITH source AS MATERIALIZED (SELECT ${requiredFields.map(quoteIdentifier).join(", ")} FROM ${source}), stats AS (SELECT ${aggregates.join(", ")} FROM source), grain_keys AS (SELECT ${keyList} FROM source GROUP BY ${keyList}) SELECT stats.*, (SELECT count(*) FROM grain_keys) AS distinct_grain_keys FROM stats`;
    const reader = await handle.connection.runAndReadAll(sql);
    const row = (reader.getRowObjectsJson() as Row[])[0] ?? {};
    return {
      rowsValidated: Number(row.row_count ?? 0),
      distinctGrainKeys: Number(row.distinct_grain_keys ?? 0),
      fieldStats: new Map(requiredFields.map((field, index) => [field, { missingCount: Number(row[`missing_${index}`] ?? 0), invalidCount: Number(row[`invalid_${index}`] ?? 0) }])),
    };
  } finally {
    await closeDuckDb(handle);
  }
}

const blank = (value: unknown) => value === null || value === undefined || String(value).trim() === "";
const numeric = (value: unknown) => !blank(value) && Number.isFinite(Number(String(value).replaceAll(",", "").replace(/[$%]/g, "")));

function validTime(value: unknown, grain: DiscoveredSourceProfile["time"]["grain"]) {
  if (blank(value)) return false;
  const text = String(value).trim();
  if (grain === "year") return /^\d{4}$/.test(text);
  if (grain === "quarter") return /^\d{4}[- ]?Q[1-4]$/i.test(text);
  if (grain === "month") return /^\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?$/.test(text);
  if (grain === "week" || grain === "day" || grain === "snapshot" || grain === "range") return !Number.isNaN(Date.parse(text));
  return false;
}

function validGeography(value: unknown, grain: DiscoveredSourceProfile["geography"]["grain"], field: string) {
  if (blank(value)) return false;
  const text = String(value).trim();
  if (grain === "zip" || grain === "cbsa") return /^\d{5}$/.test(text);
  if (grain === "state") return /^[A-Z]{2}$/i.test(text);
  if (grain === "dma" && /code|id/i.test(field)) return /^\d{3}$/.test(text);
  if (grain === "point" && /lat/i.test(field)) return numeric(value) && Number(value) >= -90 && Number(value) <= 90;
  if (grain === "point" && /lon|lng/i.test(field)) return numeric(value) && Number(value) >= -180 && Number(value) <= 180;
  return text.length > 0;
}

const directIdentifier = /(^|_)(customer_id|customer_address|address_id|order_id|order_line_id|patient_id|patient_name|email|phone|street_address)($|_)/;

async function hashFile(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export async function validateDiscoveredOutcomeSource(options: { workspaceRoot: string; approvedRoot: string; profile: DiscoveredSourceProfile; outcomeIds: FirstPartyOutcomeId[] }): Promise<FullFileValidationReport> {
  const profile = options.profile;
  const failures: string[] = [];
  if (!profile.sha256) failures.push("An inventory SHA-256 is required before full-file validation.");
  if (profile.approvalState !== "approved_local_source") failures.push("The file is not matched to an approved local-source inventory record.");
  if (!["public", "internal"].includes(profile.inferredSensitivity)) failures.push("The inferred sensitivity exceeds the aggregate internal outcome boundary.");
  const identifiers = profile.columns.filter((column) => directIdentifier.test(column.normalizedName)).map((column) => column.name);
  if (identifiers.length) failures.push(`Direct or row-level identifiers are present: ${identifiers.join(", ")}.`);
  if (profile.geography.confidence !== "high" || profile.geography.grain === "unknown" || profile.geography.alternatives.length) failures.push("Geography is ambiguous; exactly one high-confidence aggregate geography is required.");
  if (profile.time.confidence !== "high" || profile.time.grain === "unknown") failures.push("Time semantics are ambiguous; exactly one recognized bounded period field is required.");

  const definitions = options.outcomeIds.map((outcomeId) => firstPartyOutcomeDefinitions.find((item) => item.id === outcomeId)).filter((item) => item !== undefined);
  const assessments = definitions.map((definition) => assessOutcomeCandidate(profile, definition));
  for (const assessment of assessments) if (assessment.status !== "ready_for_adapter") failures.push(`${assessment.outcomeId} is ${assessment.status}: ${assessment.missingRequirements.join("; ") || assessment.warnings.join("; ")}.`);
  const metricPairs = assessments.flatMap((assessment) => assessment.matchedMetricFields.map((field) => ({ outcomeId: assessment.outcomeId, field })));
  for (const outcomeId of options.outcomeIds) if (metricPairs.filter((item) => item.outcomeId === outcomeId).length !== 1) failures.push(`${outcomeId} must resolve to exactly one metric field.`);

  const keyFields = profile.grain.keyFields;
  if (!keyFields.length) failures.push("A proposed aggregate grain key is required.");
  const contextFields = [...new Set(assessments.flatMap((assessment) => assessment.matchedContextFields))];
  const requiredFields = [...new Set([...keyFields, ...profile.geography.fields, ...profile.time.fields, ...metricPairs.map((item) => item.field), ...contextFields])];
  const available = new Set(profile.columns.map((column) => column.name));
  for (const field of requiredFields) if (!available.has(field)) failures.push(`Required field ${field} is absent from the discovered schema.`);

  let file: string | null = null;
  if (!failures.length) {
    try {
      file = await realpath(resolveApprovedCandidateFile(options.workspaceRoot, profile, options.approvedRoot));
      const details = await stat(file);
      if (details.size > 2 * 1024 * 1024 * 1024) failures.push("Full-file validation is limited to 2 GB per candidate; publish a bounded approved aggregate or partitioned Parquet contract.");
      else if (profile.sha256 && await hashFile(file) !== profile.sha256) failures.push("The full file SHA-256 does not match the approved inventory record.");
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "The approved candidate path could not be resolved.");
    }
  }

  if (failures.length) return fullFileValidationReportSchema.parse({ version: FULL_FILE_VALIDATION_VERSION, sourceId: profile.sourceId, status: "failed_closed", rowsValidated: 0, distinctGrainKeys: 0, duplicateRowCount: 0, fieldValidation: [], failures: [...new Set(failures)], rawRowsStored: false, semanticContract: null });

  const fieldStats = new Map(requiredFields.map((field) => [field, { missingCount: 0, invalidCount: 0 }]));
  const grainKeys = new Set<string>();
  let rowsValidated = 0;
  let distinctGrainKeys = 0;
  let duplicateRowCount = 0;
  try {
    if (!file) throw new Error("The approved candidate path was not resolved.");
    if (profile.format === "xlsx") {
      const rows = await xlsxRows(file);
      for (const row of rows) {
        rowsValidated += 1;
        for (const field of requiredFields) if (blank(row[field])) fieldStats.get(field)!.missingCount += 1;
        for (const field of profile.geography.fields) if (!validGeography(row[field], profile.geography.grain, field)) fieldStats.get(field)!.invalidCount += 1;
        for (const field of profile.time.fields) if (!validTime(row[field], profile.time.grain)) fieldStats.get(field)!.invalidCount += 1;
        for (const { field } of metricPairs) if (!numeric(row[field])) fieldStats.get(field)!.invalidCount += 1;
        const key = JSON.stringify(keyFields.map((field) => row[field] ?? null));
        if (grainKeys.has(key)) duplicateRowCount += 1;
        else grainKeys.add(key);
      }
      distinctGrainKeys = grainKeys.size;
    } else if (["csv", "tsv", "parquet"].includes(profile.format)) {
      const aggregate = await aggregateTabularFile(file, profile, requiredFields, keyFields, profile.geography.fields, profile.time.fields, metricPairs.map((item) => item.field));
      rowsValidated = aggregate.rowsValidated;
      distinctGrainKeys = aggregate.distinctGrainKeys;
      duplicateRowCount = aggregate.rowsValidated - aggregate.distinctGrainKeys;
      for (const [field, stats] of aggregate.fieldStats) fieldStats.set(field, stats);
    } else {
      failures.push(`Full semantic validation does not accept ${profile.format}.`);
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "Full-file read failed.");
  }
  if (!rowsValidated) failures.push("The source contains no data rows.");
  if (duplicateRowCount) failures.push(`${duplicateRowCount} row(s) duplicate the proposed aggregate grain key.`);
  for (const [field, stats] of fieldStats) {
    if (stats.missingCount) failures.push(`${field} is missing in ${stats.missingCount} row(s).`);
    if (stats.invalidCount) failures.push(`${field} is invalid in ${stats.invalidCount} row(s).`);
  }
  const fieldValidation = requiredFields.map((field) => {
    const role = metricPairs.some((item) => item.field === field) ? "metric" : profile.geography.fields.includes(field) ? "geography" : profile.time.fields.includes(field) ? "time" : contextFields.includes(field) ? "context" : "grain";
    return { field, role, ...fieldStats.get(field)! };
  });
  if (failures.length) return fullFileValidationReportSchema.parse({ version: FULL_FILE_VALIDATION_VERSION, sourceId: profile.sourceId, status: "failed_closed", rowsValidated, distinctGrainKeys, duplicateRowCount, fieldValidation, failures: [...new Set(failures)], rawRowsStored: false, semanticContract: null });

  const semanticContract = semanticSourceContractSchema.parse({
    version: SEMANTIC_SOURCE_CONTRACT_VERSION,
    sourceId: profile.sourceId,
    packageId: profile.packageId,
    fileSha256: profile.sha256,
    format: profile.format,
    rowCount: rowsValidated,
    rawRowsStored: false,
    allowedUse: profile.allowedUse,
    sensitivity: profile.inferredSensitivity,
    privacy: { directIdentifiersDetected: false, aggregateOnly: true },
    grain: { keyFields, uniqueness: "validated_unique", duplicateRowCount: 0 },
    geography: { grain: profile.geography.grain, fields: profile.geography.fields, validity: "all_rows_valid", semanticStatus: "candidate_requires_owner_review" },
    time: { grain: profile.time.grain, fields: profile.time.fields, validity: "all_rows_valid", semanticStatus: "candidate_requires_owner_review" },
    metrics: metricPairs.map(({ outcomeId, field }) => ({ outcomeId, sourceField: field, unit: profile.columns.find((column) => column.name === field)!.inferredUnit!, validity: "all_rows_numeric", definitionStatus: "candidate_requires_owner_review" })),
    fieldValidation,
    approvalState: "candidate_requires_owner_review",
    queryEligibility: "none_pending_semantic_approval",
    limitations: ["Column-name inference does not approve metric meaning, geography semantics, period semantics, cohort rules, small-cell policy, or source-owner use.", "A reviewer must approve this semantic contract before a typed adapter or allowlisted query is registered."],
  });
  return fullFileValidationReportSchema.parse({ version: FULL_FILE_VALIDATION_VERSION, sourceId: profile.sourceId, status: "structurally_valid_candidate", rowsValidated, distinctGrainKeys, duplicateRowCount: 0, fieldValidation, failures: [], rawRowsStored: false, semanticContract });
}

export function resolveApprovedCandidateFile(workspaceRoot: string, profile: DiscoveredSourceProfile, approvedRoot: string) {
  if (path.isAbsolute(profile.relativePath) || profile.relativePath.split(/[\\/]/).includes("..")) throw new Error("Candidate relative path is invalid.");
  const workspace = path.resolve(workspaceRoot);
  const root = path.resolve(workspace, approvedRoot);
  const file = path.resolve(workspace, profile.relativePath);
  if (!(root === file || file.startsWith(`${root}${path.sep}`))) throw new Error("Candidate file is outside its configured approved root.");
  return file;
}
