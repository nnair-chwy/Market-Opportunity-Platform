import type { DiscoveryUncertainty, DiscoveredColumn } from "./contracts.ts";

type Row = Record<string, unknown>;
type Confidence = "high" | "medium" | "low" | "none";

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const matches = (name: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(name));

const geographyPatterns: Array<[string, RegExp[]]> = [
  ["zip", [/(^|_)(zip|zipcode|zip_code|postal|postal_code|zcta|zcta5)($|_)/]],
  ["cbsa", [/(^|_)(cbsa|metro_code|metropolitan_statistical_area)($|_)/]],
  ["metro", [/(^|_)metro($|_)/]],
  ["dma", [/(^|_)(dma|designated_market_area|nielsen_market)($|_)/]],
  ["state", [/(^|_)(state|state_code|state_fips)($|_)/]],
  ["county", [/(^|_)(county|county_fips)($|_)/]],
  ["trade_area", [/(^|_)(trade_area|service_area)($|_)/]],
  ["drive_time", [/(^|_)(drive_time|drivetime|travel_time)($|_)/]],
  ["point", [/(^|_)(latitude|longitude|lat|lon|lng)($|_)/]],
];

const timePatterns = [/(^|_)(date|day|week|month|quarter|year|timestamp|timeframe|period|as_of|snapshot)($|_)/, /(_at|_date)$/];
const identifierPatterns = [/(^|_)(id|key|code|sku|uuid|globalid|product_part_number)($|_)/];
const sensitivePatterns: Array<["restricted" | "confidential", string, RegExp]> = [
  ["restricted", "precise customer or patient identity", /(^|_)(customer|patient|member)_(id|name|email|phone|address)($|_)/],
  ["restricted", "person-level medical or prescription field", /(^|_)(medical_record|diagnosis|patient_medical|prescription_id|prescription_number|prescription_detail)($|_)/],
  ["confidential", "personal contact or employee field", /(^|_)(email|phone|employee|created_by|updated_by|first_name|last_name)($|_)/],
  ["confidential", "street-level address field", /(^|_)(street|address_line|full_address)($|_)/],
];

function valueType(value: unknown): DiscoveredColumn["inferredType"] {
  if (value === null || value === undefined || value === "") return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  const text = String(value).trim();
  if (/^(true|false)$/i.test(text)) return "boolean";
  if (/^-?\d+$/.test(text)) return "integer";
  if (/^-?(?:\d+\.\d+|\d+e[+-]?\d+)$/i.test(text)) return "number";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return "date";
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(text)) return "datetime";
  return "string";
}

function mergeTypes(types: Set<DiscoveredColumn["inferredType"]>): DiscoveredColumn["inferredType"] {
  types.delete("null");
  if (types.size === 0) return "null";
  if (types.size === 1) return [...types][0];
  if ([...types].every((type) => type === "integer" || type === "number")) return "number";
  if ([...types].every((type) => type === "date" || type === "datetime")) return "datetime";
  return "mixed";
}

export function inferUnit(name: string): string | null {
  const value = normalize(name);
  if (matches(value, [/(^|_)(pct|percent|percentage)($|_)/])) return "percent";
  if (matches(value, [/(^|_)(rate|ratio|ctr|cvr)($|_)/])) return "ratio";
  if (matches(value, [/(^|_)(cost|spend|sales|revenue|price|margin|profit|contribution|discount|refund)($|_)/])) return "currency_unspecified";
  if (matches(value, [/(^|_)(count|orders|customers|appointments|clicks|impressions|conversions|units|households|population)($|_)/])) return "count";
  if (matches(value, [/(^|_)(capacity|appointment_slots|available_slots)($|_)/])) return "count";
  if (matches(value, [/(^|_)(staffed_hours|vet_hours)($|_)/])) return "hours";
  if (matches(value, [/(^|_)(miles|distance)($|_)/])) return "miles";
  if (matches(value, [/(^|_)(minutes|drive_time)($|_)/])) return "minutes";
  return null;
}

export function inferColumns(columnNames: string[], rows: Row[]): DiscoveredColumn[] {
  return columnNames.map((name) => {
    const normalizedName = normalize(name) || "unnamed_column";
    const values = rows.map((row) => row[name]);
    const nonNull = values.filter((value) => value !== null && value !== undefined && value !== "");
    const roles: DiscoveredColumn["roles"] = [];
    if (matches(normalizedName, identifierPatterns)) roles.push("identifier");
    if (geographyPatterns.some(([, patterns]) => matches(normalizedName, patterns))) roles.push("geography");
    if (matches(normalizedName, timePatterns)) roles.push("time");
    const sensitive = sensitivePatterns.some(([, , pattern]) => pattern.test(normalizedName));
    if (sensitive) roles.push("sensitive");
    const type = mergeTypes(new Set(values.map(valueType)));
    const unit = inferUnit(normalizedName);
    if (!roles.includes("identifier") && !roles.includes("geography") && !roles.includes("time") && (unit !== null || type === "number" || type === "integer")) roles.push("metric");
    if (roles.length === 0) roles.push("dimension");
    return {
      name,
      normalizedName,
      inferredType: type,
      nullable: nonNull.length < values.length,
      sampledNonNullCount: nonNull.length,
      sampledDistinctCount: new Set(nonNull.map((value) => String(value))).size,
      roles,
      inferredUnit: unit,
    };
  });
}

export function inferProfile(columns: DiscoveredColumn[], rowCount: number | null, sampledRowCount: number) {
  const uncertainties: DiscoveryUncertainty[] = [];
  const geoMatches = geographyPatterns.flatMap(([grain, patterns]) => {
    const fields = columns.filter((column) => matches(column.normalizedName, patterns)).map((column) => column.name);
    return fields.length ? [{ grain, fields }] : [];
  });
  let geography: { grain: "zip" | "cbsa" | "metro" | "dma" | "state" | "county" | "trade_area" | "drive_time" | "point" | "national" | "unknown"; fields: string[]; confidence: Confidence; alternatives: string[] };
  if (geoMatches.length === 0) {
    geography = { grain: "unknown", fields: [], confidence: "none", alternatives: [] };
    uncertainties.push({ field: "geography", reason: "No recognized geographic field was found in the sampled schema.", candidates: [] });
  } else {
    const primary = geoMatches[0];
    geography = { grain: primary.grain as typeof geography.grain, fields: primary.fields, confidence: geoMatches.length === 1 ? "high" : "medium", alternatives: geoMatches.slice(1).map((match) => match.grain) };
    if (geoMatches.length > 1) uncertainties.push({ field: "geography", reason: "Multiple geographic grains are present; no crosswalk or primary geography is inferred automatically.", candidates: geoMatches.map((match) => match.grain) });
  }

  const timeFields = columns.filter((column) => column.roles.includes("time"));
  const timeNames = timeFields.map((column) => column.normalizedName).join(" ");
  const timeGrain = /week/.test(timeNames) ? "week" : /month/.test(timeNames) ? "month" : /quarter/.test(timeNames) ? "quarter" : /year/.test(timeNames) ? "year" : /start|end|range/.test(timeNames) && timeFields.length > 1 ? "range" : /date|day/.test(timeNames) ? "day" : /snapshot|as_of/.test(timeNames) ? "snapshot" : "unknown";
  const time = { fields: timeFields.map((column) => column.name), grain: timeGrain as "day" | "week" | "month" | "quarter" | "year" | "range" | "snapshot" | "unknown", confidence: (timeFields.length === 0 ? "none" : timeGrain === "unknown" ? "low" : timeFields.length === 1 ? "high" : "medium") as Confidence };
  if (timeFields.length === 0) uncertainties.push({ field: "time", reason: "No observation or reporting period field was found.", candidates: [] });
  else if (timeFields.length > 1) uncertainties.push({ field: "time", reason: "Multiple time fields are present; their observation, effective, and extraction semantics require review.", candidates: time.fields });

  const metricColumns = columns.filter((column) => column.roles.includes("metric"));
  const metrics = metricColumns.map((column) => ({ field: column.name, unit: column.inferredUnit, confidence: (column.inferredUnit ? "high" : "medium") as "high" | "medium" | "low" }));
  for (const metric of metrics.filter((item) => item.unit === null)) uncertainties.push({ field: "unit", reason: `Metric-like field ${itemLabel(metric.field)} has no inferable unit.`, candidates: [] });
  if (metrics.length === 0) uncertainties.push({ field: "metric", reason: "No numeric or conventionally named metric field was found.", candidates: [] });

  const keyFields = columns.filter((column) => column.roles.includes("identifier") || column.roles.includes("geography") || column.roles.includes("time")).map((column) => column.name).slice(0, 8);
  const grainConfidence: Confidence = keyFields.length === 0 ? "none" : keyFields.some((field) => time.fields.includes(field)) && geography.fields.length > 0 ? "medium" : "low";
  const grain = { description: keyFields.length ? `one row per inferred combination of ${keyFields.join(" × ")}` : "row grain unknown", keyFields, confidence: grainConfidence };
  uncertainties.push({ field: "grain", reason: "Grain is a schema hypothesis until uniqueness is validated across the complete source.", candidates: keyFields });

  const sensitivitySignals = columns.flatMap((column) => sensitivePatterns.filter(([, , pattern]) => pattern.test(column.normalizedName)).map(([level, reason]) => `${level}: ${reason} (${column.name})`));
  const inferredSensitivity = sensitivitySignals.some((signal) => signal.startsWith("restricted")) ? "restricted" : sensitivitySignals.length ? "confidential" : "internal";
  if (sensitivitySignals.length) uncertainties.push({ field: "sensitivity", reason: "Potential sensitive fields were detected from column names; classification requires owner review.", candidates: sensitivitySignals });
  if (rowCount === null && sampledRowCount > 0) uncertainties.push({ field: "schema", reason: "The profile is sample-based and the full row count was not calculated.", candidates: [] });
  return { grain, geography, time, metrics, uncertainties, sensitivitySignals, inferredSensitivity };
}

function itemLabel(value: string) {
  return `"${value}"`;
}
