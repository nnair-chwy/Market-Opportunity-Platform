import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { closeDuckDb, openDuckDb, sqlString } from "../evidence-snapshot/duckdb.ts";
import {
  discoveredAggregateQueryResponseSchema,
  discoveredAggregateQuerySchema,
  validatedDiscoveredSourceContractSchema,
  type AggregateFunction,
  type DiscoveredAggregateQuery,
  type DiscoveredAggregateQueryResponse,
  type ValidatedDiscoveredSourceContract,
} from "./contracts.ts";

export type DiscoveredEvidenceQueryContext = { workspaceRoot: string; approvedRoots: string[] };

const inside = (parent: string, child: string) => child === parent || child.startsWith(`${parent}${path.sep}`);
const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const finiteNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function validateRelativePath(value: string, label: string) {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/).includes("..")) throw new Error(`${label} must be workspace-relative and cannot contain traversal.`);
}

async function fileSha256(file: string) {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function resolveContractFile(context: DiscoveredEvidenceQueryContext, contract: ValidatedDiscoveredSourceContract) {
  const workspace = await realpath(context.workspaceRoot);
  if (!context.approvedRoots.length) throw new Error("At least one approved workspace-relative source root is required.");
  const roots = await Promise.all(context.approvedRoots.map(async (root) => {
    validateRelativePath(root, "Approved root");
    const configured = path.resolve(workspace, root);
    if (!inside(workspace, configured)) throw new Error("Approved root escapes the workspace.");
    const resolved = await realpath(configured);
    if (!inside(workspace, resolved)) throw new Error("Approved root resolves outside the workspace.");
    return resolved;
  }));
  validateRelativePath(contract.relativePath, "Contract source path");
  const file = await realpath(path.resolve(workspace, contract.relativePath));
  if (!roots.some((root) => inside(root, file))) throw new Error("Contract source is outside the approved query roots.");
  const details = await lstat(file);
  if (!details.isFile()) throw new Error("Contract source must resolve to a regular file.");
  if (details.size > contract.policy.maxSourceBytes) throw new Error(`Contract source exceeds the ${contract.policy.maxSourceBytes}-byte query limit.`);
  if (await fileSha256(file) !== contract.sha256) throw new Error("Contract source SHA-256 does not match the reviewed file.");
  return file;
}

function relationFor(file: string, contract: ValidatedDiscoveredSourceContract) {
  const source = sqlString(file);
  if (contract.format === "csv") return `read_csv_auto(${source}, header=true, all_varchar=true, sample_size=20000)`;
  if (contract.format === "tsv") return `read_csv_auto(${source}, header=true, all_varchar=true, delim='\\t', sample_size=20000)`;
  if (contract.format === "json") return `read_json_auto(${source}, format='auto')`;
  if (contract.format === "parquet") return `read_parquet(${source})`;
  throw new Error(`Format ${contract.format} is not enabled in the temporary aggregate-query layer.`);
}

function scalarSql(value: string | number | boolean | null) {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return sqlString(value);
}

function typedExpression(field: string, contract: ValidatedDiscoveredSourceContract) {
  const column = contract.columns.find((item) => item.name === field)!;
  const source = quoteIdentifier(field);
  const text = `NULLIF(TRIM(CAST(${source} AS VARCHAR)), '')`;
  if (column.inferredType === "integer") return `TRY_CAST(${text} AS BIGINT)`;
  if (column.inferredType === "number") return `TRY_CAST(REPLACE(${text}, ',', '') AS DOUBLE)`;
  if (column.inferredType === "boolean") return `TRY_CAST(${text} AS BOOLEAN)`;
  if (column.inferredType === "date") return `TRY_CAST(${text} AS DATE)`;
  if (column.inferredType === "datetime") return `TRY_CAST(${text} AS TIMESTAMP)`;
  return text;
}

function aggregateSql(alias: string, operation: AggregateFunction) {
  if (operation === "sum") return `SUM(${alias})`;
  if (operation === "average") return `AVG(${alias})`;
  if (operation === "minimum") return `MIN(${alias})`;
  if (operation === "maximum") return `MAX(${alias})`;
  if (operation === "count_non_null") return `COUNT(${alias})`;
  return `COUNT(DISTINCT ${alias})`;
}

function validateQueryAgainstContract(contract: ValidatedDiscoveredSourceContract, request: DiscoveredAggregateQuery) {
  if (request.contractId !== contract.contractId) throw new Error("The query does not belong to the supplied discovered-source contract.");
  const dimensions = new Set(contract.policy.dimensionFields);
  const filters = new Set(contract.policy.filterFields);
  const measures = new Map(contract.policy.measures.map((measure) => [measure.field, new Set(measure.allowedAggregations)]));
  for (const field of request.dimensions) if (!dimensions.has(field)) throw new Error(`Dimension ${field} is not allowlisted by the reviewed contract.`);
  for (const filter of request.filters) if (!filters.has(filter.field)) throw new Error(`Filter ${filter.field} is not allowlisted by the reviewed contract.`);
  for (const measure of request.measures) if (!measures.get(measure.field)?.has(measure.aggregation)) throw new Error(`${measure.aggregation} is not allowlisted for measure ${measure.field}.`);
  if (request.limit > contract.policy.maxGroups) throw new Error(`Query limit exceeds the reviewed ${contract.policy.maxGroups}-group maximum.`);
  if (request.orderBy && !request.measures.some((measure) => measure.field === request.orderBy!.field && measure.aggregation === request.orderBy!.aggregation)) throw new Error("Order-by must reference a requested allowlisted aggregate.");
}

function filterSql(filter: DiscoveredAggregateQuery["filters"][number], fieldAlias: string) {
  if (filter.operator === "in") return `${fieldAlias} IN (${filter.values!.map(scalarSql).join(", ")})`;
  if (filter.value === null) return filter.operator === "equals" ? `${fieldAlias} IS NULL` : "FALSE";
  const operator = filter.operator === "equals" ? "=" : filter.operator === "greater_than_or_equal" ? ">=" : "<=";
  return `${fieldAlias} ${operator} ${scalarSql(filter.value!)}`;
}

/**
 * Executes only a reviewed aggregate contract. SQL is compiled exclusively
 * from exact allowlisted identifiers, fixed operators, escaped scalar values,
 * a resolved approved file, and fixed result/source caps.
 */
export async function executeDiscoveredAggregateQuery(
  context: DiscoveredEvidenceQueryContext,
  contractInput: unknown,
  requestInput: unknown,
): Promise<DiscoveredAggregateQueryResponse> {
  const contract = validatedDiscoveredSourceContractSchema.parse(contractInput);
  const request = discoveredAggregateQuerySchema.parse(requestInput);
  validateQueryAgainstContract(contract, request);
  const file = await resolveContractFile(context, contract);
  const queriedFields = [...new Set([...request.dimensions, ...request.measures.map((item) => item.field), ...request.filters.map((item) => item.field)])];
  const aliases = new Map(queriedFields.map((field, index) => [field, `field_${index}`]));
  const relation = relationFor(file, contract);
  const sourceCap = contract.policy.maxSourceRows;
  const typedColumns = queriedFields.map((field) => `${typedExpression(field, contract)} AS ${aliases.get(field)}`).join(", ");
  const ctes = `WITH bounded_source AS (SELECT ${queriedFields.map(quoteIdentifier).join(", ")} FROM ${relation} LIMIT ${sourceCap + 1}), typed_source AS (SELECT *, ${typedColumns} FROM bounded_source LIMIT ${sourceCap}), filtered_source AS (SELECT * FROM typed_source${request.filters.length ? ` WHERE ${request.filters.map((filter) => filterSql(filter, aliases.get(filter.field)!)).join(" AND ")}` : ""})`;
  const dimensions = request.dimensions.map((field) => aliases.get(field)!);
  const measureAliases = request.measures.map((_, index) => `measure_${index}`);
  const selectDimensions = dimensions.map((alias, index) => `${alias} AS dimension_${index}`);
  const selectMeasures = request.measures.map((measure, index) => `${aggregateSql(aliases.get(measure.field)!, measure.aggregation)} AS ${measureAliases[index]}`);
  const selectNonNullCounts = request.measures.map((measure, index) => `COUNT(${aliases.get(measure.field)!}) AS non_null_${index}`);
  const groupClause = dimensions.length ? ` GROUP BY ${dimensions.join(", ")}` : "";
  const havingClause = ` HAVING COUNT(*) >= ${contract.policy.minimumGroupSize}`;
  const orderClause = request.orderBy ? ` ORDER BY ${measureAliases[request.measures.findIndex((item) => item.field === request.orderBy!.field && item.aggregation === request.orderBy!.aggregation)]} ${request.orderBy.direction === "ascending" ? "ASC" : "DESC"} NULLS LAST` : "";
  const aggregateQuery = `${ctes} SELECT ${[...selectDimensions, ...selectMeasures, ...selectNonNullCounts, "COUNT(*) AS contributing_row_count"].join(", ")} FROM filtered_source${groupClause}${havingClause}${orderClause} LIMIT ${request.limit + 1}`;
  const statsSelect = queriedFields.flatMap((field) => {
    const alias = aliases.get(field)!;
    const source = quoteIdentifier(field);
    const sourceText = `NULLIF(TRIM(CAST(${source} AS VARCHAR)), '')`;
    return [
      `SUM(CASE WHEN ${sourceText} IS NULL THEN 1 ELSE 0 END) AS null_${alias}`,
      `SUM(CASE WHEN ${sourceText} IS NOT NULL AND ${alias} IS NULL THEN 1 ELSE 0 END) AS invalid_${alias}`,
    ];
  });
  const statsQuery = `WITH bounded_source AS (SELECT ${queriedFields.map(quoteIdentifier).join(", ")} FROM ${relation} LIMIT ${sourceCap + 1}), typed_source AS (SELECT *, ${typedColumns} FROM bounded_source LIMIT ${sourceCap}) SELECT (SELECT COUNT(*) FROM bounded_source) AS bounded_count, COUNT(*) AS source_rows_read, SUM(CASE WHEN ${request.filters.length ? request.filters.map((filter) => filterSql(filter, aliases.get(filter.field)!)).join(" AND ") : "TRUE"} THEN 1 ELSE 0 END) AS source_rows_matched${statsSelect.length ? `, ${statsSelect.join(", ")}` : ""} FROM typed_source`;
  const groupCountQuery = `${ctes} SELECT SUM(CASE WHEN group_size < ${contract.policy.minimumGroupSize} THEN 1 ELSE 0 END) AS suppressed_group_count FROM (SELECT COUNT(*) AS group_size FROM filtered_source${groupClause}) groups`;
  const handle = await openDuckDb(":memory:");
  try {
    const aggregateReader = await handle.connection.runAndReadAll(aggregateQuery);
    const statsReader = await handle.connection.runAndReadAll(statsQuery);
    const groupReader = await handle.connection.runAndReadAll(groupCountQuery);
    const aggregateRows = aggregateReader.getRowObjectsJson() as Array<Record<string, unknown>>;
    const stats = (statsReader.getRowObjectsJson() as Array<Record<string, unknown>>)[0] ?? {};
    const groupStats = (groupReader.getRowObjectsJson() as Array<Record<string, unknown>>)[0] ?? {};
    const resultLimitReached = aggregateRows.length > request.limit;
    const sourceRowsTruncated = Number(stats.bounded_count ?? 0) > sourceCap;
    const nullCounts = Object.fromEntries(queriedFields.map((field) => [field, Number(stats[`null_${aliases.get(field)}`] ?? 0)]));
    const invalidValueCounts = Object.fromEntries(queriedFields.map((field) => [field, Number(stats[`invalid_${aliases.get(field)}`] ?? 0)]));
    const suppressedGroupCount = Number(groupStats.suppressed_group_count ?? 0);
    const warnings = [...contract.quality.profileWarnings, ...contract.quality.unresolvedContractQuestions];
    if (sourceRowsTruncated) warnings.push(`The query scanned the first ${sourceCap} rows under the reviewed source cap; results are partial and are not full-file totals.`);
    if (resultLimitReached) warnings.push(`More than ${request.limit} qualifying groups were found; only the first ${request.limit} ordered groups are returned.`);
    if (suppressedGroupCount) warnings.push(`${suppressedGroupCount} group(s) below the reviewed minimum group size were suppressed.`);
    for (const [field, count] of Object.entries(invalidValueCounts)) if (count) warnings.push(`${count} invalid ${field} value(s) were preserved as null.`);
    const columnByName = new Map(contract.columns.map((column) => [column.name, column]));
    return discoveredAggregateQueryResponseSchema.parse({
      version: contract.version,
      requestId: request.requestId,
      contractId: contract.contractId,
      sourceId: contract.sourceId,
      status: sourceRowsTruncated || resultLimitReached || warnings.length ? "partial" : "complete",
      rows: aggregateRows.slice(0, request.limit).map((row) => ({
        dimensions: Object.fromEntries(request.dimensions.map((field, index) => [field, row[`dimension_${index}`] ?? null])),
        measures: request.measures.map((measure, index) => ({
          field: measure.field,
          aggregation: measure.aggregation,
          rawValue: finiteNumber(row[`measure_${index}`]),
          unit: ["count_non_null", "distinct_count"].includes(measure.aggregation) ? "count" : columnByName.get(measure.field)!.inferredUnit,
          nonNullCount: Number(row[`non_null_${index}`] ?? 0),
        })),
        contributingRowCount: Number(row.contributing_row_count ?? 0),
      })),
      sourceRowsRead: Number(stats.source_rows_read ?? 0),
      sourceRowsMatched: Number(stats.source_rows_matched ?? 0),
      sourceRowsTruncated,
      resultLimitReached,
      suppressedGroupCount,
      provenance: {
        sourceId: contract.sourceId,
        relativePath: contract.relativePath,
        sha256: contract.sha256,
        contractId: contract.contractId,
        fullFileValidationVersion: contract.fullFileValidationVersion,
        semanticSourceContractVersion: contract.semanticSourceContractVersion,
        validatedRowCount: contract.validatedRowCount,
        reviewedBy: contract.reviewedBy,
        reviewedAt: contract.reviewedAt,
        allowedUse: contract.allowedUse,
        sensitivity: contract.sensitivity,
      },
      quality: { nullCounts, invalidValueCounts, warnings: [...new Set(warnings)] },
      rawRowsReturned: false,
    });
  } finally {
    await closeDuckDb(handle);
  }
}
