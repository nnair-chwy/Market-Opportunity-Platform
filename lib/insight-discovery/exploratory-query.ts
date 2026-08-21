import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { closeDuckDb, openDuckDb } from "../evidence-snapshot/duckdb.ts";
import { normalizedSnapshotDirectory, validateNormalizedSnapshot } from "../data-normalization/query.ts";

export const EXPLORATORY_QUERY_VERSION = "normalized-exploratory-query-v1" as const;
export const EXPLORATORY_QUERY_MAX_TABLES = 3;
export const EXPLORATORY_QUERY_MAX_ROWS = 50;

type ColumnDefinition = { type: "number" | "string"; role: "dimension" | "measure" | "metadata" };
type TableDefinition = { tableName: string; grain: string; columns: Record<string, ColumnDefinition> };

const common = {
  cbsaCode: { type: "string", role: "dimension" },
  cbsaName: { type: "string", role: "dimension" },
  sourceId: { type: "string", role: "metadata" },
  evidenceStatus: { type: "string", role: "metadata" },
} as const satisfies Record<string, ColumnDefinition>;

export const EXPLORATORY_TABLE_CATALOG = {
  census: {
    tableName: "normalized_census_market_context",
    grain: "one Census CBSA market",
    columns: { ...common, totalPopulation: { type: "number", role: "measure" }, householdCount: { type: "number", role: "measure" }, medianHouseholdIncome: { type: "number", role: "measure" }, housingUnits: { type: "number", role: "measure" }, populationDensity: { type: "number", role: "measure" }, observedAt: { type: "string", role: "dimension" } },
  },
  market: {
    tableName: "normalized_market_context",
    grain: "one supplied CBSA market context row",
    columns: { ...common, reportingDate: { type: "string", role: "dimension" }, activeCustomerCount: { type: "number", role: "measure" }, priorYearActiveCustomerCount: { type: "number", role: "measure" }, activeCustomerYoyGrowth: { type: "number", role: "measure" }, totalHouseholds: { type: "number", role: "measure" }, activeCustomersPer1000Households: { type: "number", role: "measure" }, sourceQualityStatus: { type: "string", role: "metadata" } },
  },
  demand: {
    tableName: "normalized_regional_demand_by_cbsa_year",
    grain: "one derived CBSA x year aggregate",
    columns: { ...common, year: { type: "number", role: "dimension" }, contributingZipCount: { type: "number", role: "measure" }, contributingSourceRowCount: { type: "number", role: "measure" }, netSalesExcludingRefunds: { type: "number", role: "measure" }, netSales: { type: "number", role: "measure" } },
  },
  clinic_profile: {
    tableName: "normalized_clinic_profile_by_cbsa",
    grain: "one derived CBSA clinic-profile aggregate",
    columns: { ...common, clinicCount: { type: "number", role: "measure" }, totalOrders: { type: "number", role: "measure" }, totalVetsCapped: { type: "number", role: "measure" }, corporateClinicCount: { type: "number", role: "measure" }, practiceHubClinicCount: { type: "number", role: "measure" }, pharmacyBusinessClinicCount: { type: "number", role: "measure" }, inferredClinicCount: { type: "number", role: "measure" }, reviewRequiredClinicCount: { type: "number", role: "measure" } },
  },
  clinic_activity: {
    tableName: "normalized_clinic_activity_by_cbsa",
    grain: "one derived CBSA x timeframe clinic-activity aggregate",
    columns: { ...common, timeframe: { type: "string", role: "dimension" }, clinicCount: { type: "number", role: "measure" }, totalCustomers: { type: "number", role: "measure" }, totalOrders: { type: "number", role: "measure" }, rxOrders: { type: "number", role: "measure" }, netSales: { type: "number", role: "measure" }, rxNetSales: { type: "number", role: "measure" }, netSalesChange: { type: "number", role: "measure" }, inferredClinicCount: { type: "number", role: "measure" } },
  },
  ads: {
    tableName: "normalized_google_ads_by_cbsa",
    grain: "one inferred CBSA x Google Ads report scope",
    columns: { ...common, reportScope: { type: "string", role: "dimension" }, observationStart: { type: "string", role: "dimension" }, observationEnd: { type: "string", role: "dimension" }, currency: { type: "string", role: "dimension" }, spend: { type: "number", role: "measure" }, impressions: { type: "number", role: "measure" }, clicks: { type: "number", role: "measure" }, conversions: { type: "number", role: "measure" }, derivedCtr: { type: "number", role: "measure" }, derivedCostPerConversion: { type: "number", role: "measure" }, inferredLocationCount: { type: "number", role: "measure" }, reviewRequiredLocationCount: { type: "number", role: "measure" }, sourceWarningCount: { type: "number", role: "measure" } },
  },
} as const satisfies Record<string, TableDefinition>;

const tableIdSchema = z.enum(["census", "market", "demand", "clinic_profile", "clinic_activity", "ads"]);
const TABLE_ID_BY_NAME = new Map(Object.entries(EXPLORATORY_TABLE_CATALOG).map(([tableId, table]) => [table.tableName, tableId]));

function approvedTableId(value: unknown) {
  if (typeof value !== "string") return value;
  return value in EXPLORATORY_TABLE_CATALOG ? value : TABLE_ID_BY_NAME.get(value) ?? value;
}

/**
 * Canonicalizes only application-owned contract fields in a model proposal.
 * It never repairs an unknown table, column, filter, join, or aggregation;
 * those still fail the strict approved-query schema before execution.
 */
export function normalizeModelExploratoryQuerySpec(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const value = raw as Record<string, unknown>;
  const tableReference = (item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const record = item as Record<string, unknown>;
    return { ...record, tableId: approvedTableId(record.tableId) };
  };
  const joinReference = (item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const record = item as Record<string, unknown>;
    return { ...record, leftTableId: approvedTableId(record.leftTableId), rightTableId: approvedTableId(record.rightTableId) };
  };
  return {
    version: EXPLORATORY_QUERY_VERSION,
    tables: Array.isArray(value.tables) ? value.tables.map(approvedTableId) : value.tables,
    joins: Array.isArray(value.joins) ? value.joins.map(joinReference) : [],
    groupBy: Array.isArray(value.groupBy) ? value.groupBy : value.groupBy,
    measures: Array.isArray(value.measures) ? value.measures.map(tableReference) : value.measures,
    filters: Array.isArray(value.filters) ? value.filters.map(tableReference) : [],
    orderBy: Array.isArray(value.orderBy) ? value.orderBy : [],
    limit: value.limit,
  };
}
const filterSchema = z.object({
  tableId: tableIdSchema,
  column: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "is_null", "is_not_null"]),
  value: z.union([z.string().max(240), z.number().finite()]).optional(),
  values: z.array(z.union([z.string().max(240), z.number().finite()])).min(1).max(10).optional(),
}).strict();

export const exploratoryQuerySpecSchema = z.object({
  version: z.literal(EXPLORATORY_QUERY_VERSION),
  tables: z.array(tableIdSchema).min(1).max(EXPLORATORY_QUERY_MAX_TABLES),
  joins: z.array(z.object({ leftTableId: tableIdSchema, rightTableId: tableIdSchema, on: z.literal("cbsaCode") }).strict()).max(EXPLORATORY_QUERY_MAX_TABLES - 1),
  groupBy: z.array(z.enum(["cbsaCode", "cbsaName"])).min(1).max(2),
  measures: z.array(z.object({
    tableId: tableIdSchema,
    column: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/),
    aggregation: z.enum(["sum", "avg", "min", "max", "count", "count_distinct"]),
  }).strict()).min(1).max(8),
  filters: z.array(filterSchema).max(8),
  orderBy: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("measure"), measureIndex: z.number().int().min(0).max(7), direction: z.enum(["asc", "desc"]) }).strict(),
    z.object({ kind: z.literal("cbsaCode"), direction: z.enum(["asc", "desc"]) }).strict(),
  ])).max(3),
  limit: z.number().int().min(1).max(EXPLORATORY_QUERY_MAX_ROWS),
}).strict().superRefine((spec, context) => {
  const tables = new Set(spec.tables);
  if (tables.size !== spec.tables.length) context.addIssue({ code: "custom", path: ["tables"], message: "Exploratory tables must be unique." });
  if (!spec.groupBy.includes("cbsaCode")) context.addIssue({ code: "custom", path: ["groupBy"], message: "Exploratory grouping must include cbsaCode." });
  const referenced = [...spec.measures, ...spec.filters, ...spec.joins.flatMap((join) => [{ tableId: join.leftTableId }, { tableId: join.rightTableId }])];
  referenced.forEach((item, index) => {
    if (!tables.has(item.tableId)) context.addIssue({ code: "custom", path: ["references", index], message: `Table ${item.tableId} is referenced but not selected.` });
  });
  spec.measures.forEach((measure, index) => {
    const column = EXPLORATORY_TABLE_CATALOG[measure.tableId].columns[measure.column as keyof typeof EXPLORATORY_TABLE_CATALOG[typeof measure.tableId]["columns"]] as ColumnDefinition | undefined;
    if (!column) context.addIssue({ code: "custom", path: ["measures", index, "column"], message: `Unknown approved column ${measure.tableId}.${measure.column}.` });
    else if (column.type !== "number" && !["count", "count_distinct"].includes(measure.aggregation)) context.addIssue({ code: "custom", path: ["measures", index, "aggregation"], message: "Non-numeric columns allow only count or count_distinct." });
  });
  spec.filters.forEach((filter, index) => {
    const column = EXPLORATORY_TABLE_CATALOG[filter.tableId].columns[filter.column as keyof typeof EXPLORATORY_TABLE_CATALOG[typeof filter.tableId]["columns"]] as ColumnDefinition | undefined;
    if (!column) context.addIssue({ code: "custom", path: ["filters", index, "column"], message: `Unknown approved column ${filter.tableId}.${filter.column}.` });
    const nullOperator = filter.operator === "is_null" || filter.operator === "is_not_null";
    if (nullOperator && (filter.value !== undefined || filter.values !== undefined)) context.addIssue({ code: "custom", path: ["filters", index], message: "Null filters do not accept values." });
    else if (filter.operator === "in" && (!filter.values || filter.value !== undefined)) context.addIssue({ code: "custom", path: ["filters", index], message: "The in operator requires values only." });
    else if (!nullOperator && filter.operator !== "in" && (filter.value === undefined || filter.values !== undefined)) context.addIssue({ code: "custom", path: ["filters", index], message: "Comparison filters require one value." });
    if (column?.type === "number") {
      const values = filter.operator === "in" ? filter.values : [filter.value];
      if (values?.some((value) => typeof value !== "number")) context.addIssue({ code: "custom", path: ["filters", index], message: "Numeric columns require numeric filter values." });
    }
  });
  if (spec.tables.length === 1 && spec.joins.length) context.addIssue({ code: "custom", path: ["joins"], message: "A one-table query cannot contain joins." });
  if (spec.tables.length > 1) {
    if (spec.joins.length !== spec.tables.length - 1) context.addIssue({ code: "custom", path: ["joins"], message: "Selected tables require one connected CBSA equality join tree." });
    const connected = new Set([spec.tables[0]]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const join of spec.joins) {
        if (connected.has(join.leftTableId) && !connected.has(join.rightTableId)) { connected.add(join.rightTableId); changed = true; }
        if (connected.has(join.rightTableId) && !connected.has(join.leftTableId)) { connected.add(join.leftTableId); changed = true; }
      }
    }
    if (connected.size !== spec.tables.length) context.addIssue({ code: "custom", path: ["joins"], message: "CBSA joins must connect every selected table." });
  }
  spec.orderBy.forEach((order, index) => {
    if (order.kind === "measure" && order.measureIndex >= spec.measures.length) context.addIssue({ code: "custom", path: ["orderBy", index, "measureIndex"], message: "Order references an unavailable measure." });
  });
});
export type ExploratoryQuerySpec = z.infer<typeof exploratoryQuerySpecSchema>;

const AGGREGATION_SQL = { sum: "SUM", avg: "AVG", min: "MIN", max: "MAX", count: "COUNT", count_distinct: "COUNT(DISTINCT" } as const;
const OPERATOR_SQL = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" } as const;
const quote = (identifier: string) => `"${identifier}"`;

export type CompiledExploratoryQuery = {
  spec: ExploratoryQuerySpec;
  sql: string;
  parameters: Array<string | number>;
  fingerprint: string;
  selectedColumns: string[];
  lineageQueries: Array<{ tableId: keyof typeof EXPLORATORY_TABLE_CATALOG; sql: string; parameters: Array<string | number> }>;
};

export function compileExploratoryQuery(rawSpec: unknown): CompiledExploratoryQuery {
  const spec = exploratoryQuerySpecSchema.parse(rawSpec);
  const parameters: Array<string | number> = [];
  const lineageQueries: CompiledExploratoryQuery["lineageQueries"] = [];
  const ctes = spec.tables.map((tableId, tableIndex) => {
    const table = EXPLORATORY_TABLE_CATALOG[tableId];
    const tableParameters: Array<string | number> = [];
    const filters = spec.filters.filter((filter) => filter.tableId === tableId).map((filter) => {
      const field = quote(filter.column);
      if (filter.operator === "is_null") return `${field} IS NULL`;
      if (filter.operator === "is_not_null") return `${field} IS NOT NULL`;
      if (filter.operator === "in") {
        tableParameters.push(...filter.values!);
        return `${field} IN (${filter.values!.map(() => "?").join(", ")})`;
      }
      tableParameters.push(filter.value!);
      return `${field} ${OPERATOR_SQL[filter.operator]} ?`;
    });
    const measures = spec.measures.flatMap((measure, measureIndex) => {
      if (measure.tableId !== tableId) return [];
      const field = quote(measure.column);
      const expression = measure.aggregation === "count_distinct" ? `COUNT(DISTINCT ${field})` : `${AGGREGATION_SQL[measure.aggregation]}(${field})`;
      return [`${expression} AS ${quote(`measure_${measureIndex}`)}`];
    });
    parameters.push(...tableParameters);
    lineageQueries.push({
      tableId,
      sql: `SELECT DISTINCT ${quote("sourceId")} FROM ${quote(table.tableName)} WHERE ${quote("sourceId")} IS NOT NULL AND ${quote("cbsaCode")} IS NOT NULL${filters.length ? ` AND ${filters.join(" AND ")}` : ""} ORDER BY ${quote("sourceId")} LIMIT 100`,
      parameters: tableParameters,
    });
    return `${quote(`source_${tableIndex}`)} AS (SELECT ${quote("cbsaCode")}, MIN(${quote("cbsaName")}) AS ${quote("cbsaName")}${measures.length ? `, ${measures.join(", ")}` : ""} FROM ${quote(table.tableName)} WHERE ${quote("cbsaCode")} IS NOT NULL${filters.length ? ` AND ${filters.join(" AND ")}` : ""} GROUP BY ${quote("cbsaCode")})`;
  });
  const aliases = new Map(spec.tables.map((tableId, index) => [tableId, `source_${index}`]));
  const firstAlias = aliases.get(spec.tables[0])!;
  let joined = quote(firstAlias);
  const joinedTables = new Set([spec.tables[0]]);
  const remainingJoins = [...spec.joins];
  while (remainingJoins.length) {
    const index = remainingJoins.findIndex((join) => joinedTables.has(join.leftTableId) !== joinedTables.has(join.rightTableId));
    if (index < 0) throw new Error("The validated CBSA join tree could not be compiled.");
    const join = remainingJoins.splice(index, 1)[0]!;
    const anchorTable = joinedTables.has(join.leftTableId) ? join.leftTableId : join.rightTableId;
    const nextTable = anchorTable === join.leftTableId ? join.rightTableId : join.leftTableId;
    const anchor = aliases.get(anchorTable)!;
    const next = aliases.get(nextTable)!;
    joined += ` INNER JOIN ${quote(next)} ON ${quote(anchor)}.${quote("cbsaCode")} = ${quote(next)}.${quote("cbsaCode")}`;
    joinedTables.add(nextTable);
  }
  const outputs = [
    `${quote(firstAlias)}.${quote("cbsaCode")} AS ${quote("cbsaCode")}`,
    ...(spec.groupBy.includes("cbsaName") ? [`${quote(firstAlias)}.${quote("cbsaName")} AS ${quote("cbsaName")}`] : []),
    ...spec.measures.map((measure, index) => `${quote(aliases.get(measure.tableId)!)}.${quote(`measure_${index}`)} AS ${quote(`measure_${index}`)}`),
  ];
  const order = spec.orderBy.length ? ` ORDER BY ${spec.orderBy.map((item) => item.kind === "cbsaCode" ? `${quote("cbsaCode")} ${item.direction.toUpperCase()}` : `${quote(`measure_${item.measureIndex}`)} ${item.direction.toUpperCase()} NULLS LAST`).join(", ")}` : "";
  const sql = `WITH ${ctes.join(", ")} SELECT ${outputs.join(", ")} FROM ${joined}${order} LIMIT ${spec.limit}`;
  return {
    spec,
    sql,
    parameters,
    fingerprint: createHash("sha256").update(JSON.stringify(spec)).digest("hex"),
    selectedColumns: spec.measures.map((measure) => `${measure.tableId}.${measure.column}`),
    lineageQueries,
  };
}

export type ExploratoryQueryResponse = {
  version: typeof EXPLORATORY_QUERY_VERSION;
  snapshotVersion: string;
  rows: Array<Record<string, unknown>>;
  rowLimitReached: boolean;
  lineage: {
    queryFingerprint: string;
    tableIds: string[];
    tables: Array<{ tableId: string; tableName: string; grain: string; sourceIds: string[] }>;
    selectedColumns: string[];
    filterColumns: string[];
    joinRule: "cbsaCode_equality_only";
    parametersBound: number;
    readOnly: true;
  };
};

function safeSnapshotFile(snapshotDirectory: string, relativePath: string) {
  let decoded = relativePath;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  const root = path.resolve(snapshotDirectory);
  const resolved = path.resolve(root, decoded);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("The normalized database resolves outside the reviewed snapshot directory.");
  return resolved;
}

export async function executeExploratoryQuery(rawSpec: unknown, options: { snapshotVersion: string; snapshotDir?: string }): Promise<ExploratoryQueryResponse> {
  const compiled = compileExploratoryQuery(rawSpec);
  const snapshotDir = options.snapshotDir ?? normalizedSnapshotDirectory();
  const manifest = await validateNormalizedSnapshot(snapshotDir, options.snapshotVersion);
  const databaseOutput = manifest.outputs.find((output) => output.tableName === "normalized_database");
  if (!databaseOutput) throw new Error("The reviewed normalized DuckDB output is unavailable.");
  const databasePath = safeSnapshotFile(snapshotDir, databaseOutput.path);
  const handle = await openDuckDb(databasePath, true);
  try {
    const reader = await handle.connection.runAndReadAll(compiled.sql, compiled.parameters);
    const rows = (reader.getRowObjectsJson() as Array<Record<string, unknown>>).slice(0, compiled.spec.limit);
    const tables = [];
    for (const lineageQuery of compiled.lineageQueries) {
      const tableId = lineageQuery.tableId;
      const table = EXPLORATORY_TABLE_CATALOG[tableId];
      const lineageReader = await handle.connection.runAndReadAll(lineageQuery.sql, lineageQuery.parameters);
      const sourceIds = (lineageReader.getRowObjectsJson() as Array<Record<string, unknown>>).flatMap((row) => typeof row.sourceId === "string" ? [row.sourceId] : []);
      tables.push({ tableId, tableName: table.tableName, grain: table.grain, sourceIds });
    }
    return {
      version: EXPLORATORY_QUERY_VERSION,
      snapshotVersion: manifest.snapshotVersion,
      rows,
      rowLimitReached: rows.length === compiled.spec.limit,
      lineage: {
        queryFingerprint: compiled.fingerprint,
        tableIds: [...compiled.spec.tables],
        tables,
        selectedColumns: compiled.selectedColumns,
        filterColumns: compiled.spec.filters.map((filter) => `${filter.tableId}.${filter.column}`),
        joinRule: "cbsaCode_equality_only",
        parametersBound: compiled.parameters.length,
        readOnly: true,
      },
    };
  } finally {
    await closeDuckDb(handle);
  }
}
