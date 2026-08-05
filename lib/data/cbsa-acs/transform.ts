import type { CbsaMarket } from "../cbsa-universe/index.ts";
import {
  CBSA_ACS_METRICS,
  CBSA_ACS_OBSERVED_AT,
  CBSA_ACS_PERIOD_LABEL,
  CBSA_ACS_SOURCE_ID,
  CBSA_ACS_TRANSFORMATION_VERSION,
  CBSA_ACS_VINTAGE,
  type CbsaAcsDirectMetricKey,
  type CbsaAcsMarket,
  type CbsaAcsMetric,
  type CbsaAcsTransformationResult,
  type RejectedAcsRow,
} from "./types.ts";

export const CBSA_GEOGRAPHY_COLUMN =
  "metropolitan statistical area/micropolitan statistical area";
const SQUARE_METERS_PER_SQUARE_MILE = 2_589_988.110336;
const SUPPRESSED = new Set(["-666666666", "-999999999"]);
const UNAVAILABLE = new Set(["-888888888"]);

export function isCompatibleCbsaResponseGeoId(
  value: unknown,
  cbsaCode: string,
): boolean {
  return (
    value === `3100000US${cbsaCode}` ||
    value === `310M700US${cbsaCode}`
  );
}

function metric(
  metricId: string,
  rawValue: number | null,
  unit: string,
  evidenceStatus: "Confirmed" | "Derived",
  warning: string | null,
  rejected = false,
): CbsaAcsMetric {
  return {
    metric_id: metricId,
    raw_value: rawValue,
    unit,
    source_id: CBSA_ACS_SOURCE_ID,
    observed_at: CBSA_ACS_OBSERVED_AT,
    geography: "cbsa",
    quality_status: rejected ? "rejected" : warning ? "warning" : "accepted",
    evidence_status: evidenceStatus,
    sensitivity: "public",
    allowed_use: "market_context_only",
    scoring_weight: "none",
    warning,
  };
}

function directMetric(
  key: CbsaAcsDirectMetricKey,
  row: Readonly<Record<string, unknown>>,
): CbsaAcsMetric {
  const definition = CBSA_ACS_METRICS[key];
  const raw = row[definition.variable];
  const annotation = row[definition.annotation];
  let value: number | null = null;
  let warning: string | null = null;
  let rejected = false;
  if (raw === null || raw === "" || raw === undefined) {
    warning = `${definition.variable} is missing.`;
  } else if (SUPPRESSED.has(String(raw))) {
    warning = `${definition.variable} is suppressed.`;
  } else if (UNAVAILABLE.has(String(raw))) {
    warning = `${definition.variable} is unavailable.`;
  } else if (annotation === "median-" || annotation === "median+") {
    warning = `${definition.variable} is an open-ended median interval.`;
    rejected = true;
  } else {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      warning = `${definition.variable} is non-numeric or out of range.`;
      rejected = true;
    } else {
      value = parsed;
    }
  }
  return metric(
    definition.metric_id,
    value,
    definition.unit,
    "Confirmed",
    warning,
    rejected,
  );
}

export function parseAllAcsRows(payload: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(payload) || payload.length < 1) {
    throw new Error("ACS response must be a table.");
  }
  const [header, ...rows] = payload;
  if (!Array.isArray(header) || !header.every((value) => typeof value === "string")) {
    throw new Error("ACS response header is invalid.");
  }
  const required = [
    "NAME",
    "GEO_ID",
    CBSA_GEOGRAPHY_COLUMN,
    ...Object.values(CBSA_ACS_METRICS).flatMap(({ variable, annotation }) => [
      variable,
      annotation,
    ]),
  ];
  for (const column of required) {
    if (!header.includes(column)) throw new Error(`ACS response is missing ${column}.`);
  }
  return rows.map((row, index) => {
    if (!Array.isArray(row) || row.length !== header.length) {
      throw new Error(`ACS row ${index + 2} does not match the header.`);
    }
    return Object.fromEntries(header.map((column, columnIndex) => [column, row[columnIndex]]));
  });
}

export function transformCbsaAcs(
  payload: unknown,
  markets: readonly CbsaMarket[],
  landAreaByCode: ReadonlyMap<string, number>,
): CbsaAcsTransformationResult {
  const rows = parseAllAcsRows(payload);
  const universe = new Map(markets.map((market) => [market.cbsa_code, market]));
  const codeCounts = new Map<string, number>();
  for (const row of rows) {
    const code = typeof row[CBSA_GEOGRAPHY_COLUMN] === "string"
      ? row[CBSA_GEOGRAPHY_COLUMN] as string
      : "";
    if (/^\d{5}$/.test(code)) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
  }

  const accepted = new Map<string, Record<string, unknown>>();
  const rejectedRows: RejectedAcsRow[] = [];
  let unmatchedRows = 0;
  rows.forEach((row, index) => {
    const rawCode = row[CBSA_GEOGRAPHY_COLUMN];
    const code = typeof rawCode === "string" && /^\d{5}$/.test(rawCode) ? rawCode : null;
    const reasons: string[] = [];
    if (!code) reasons.push("CBSA code must be exactly five digits.");
    if (code && !isCompatibleCbsaResponseGeoId(row.GEO_ID, code)) {
      reasons.push("GEO_ID does not match summary level 310 and the CBSA code.");
    }
    if (code && (codeCounts.get(code) ?? 0) > 1) reasons.push(`Duplicate ACS row for CBSA ${code}.`);
    if (code && !universe.has(code)) {
      reasons.push(`CBSA ${code} is not in the validated mainland market universe.`);
      unmatchedRows += 1;
    }
    if (reasons.length) {
      rejectedRows.push({ row_number: index + 2, cbsa_code: code, reasons: reasons.sort() });
    } else {
      accepted.set(code!, row);
    }
  });

  const output: CbsaAcsMarket[] = [...markets]
    .sort((a, b) => a.cbsa_code.localeCompare(b.cbsa_code))
    .map((marketValue) => {
      const row = accepted.get(marketValue.cbsa_code);
      const direct = Object.fromEntries(
        (Object.keys(CBSA_ACS_METRICS) as CbsaAcsDirectMetricKey[]).map((key) => [
          key,
          row
            ? directMetric(key, row)
            : metric(
                CBSA_ACS_METRICS[key].metric_id,
                null,
                CBSA_ACS_METRICS[key].unit,
                "Confirmed",
                "No matching 2024 ACS observation was returned.",
              ),
        ]),
      ) as Record<CbsaAcsDirectMetricKey, CbsaAcsMetric>;
      const population = direct.total_population.raw_value;
      const area = landAreaByCode.get(marketValue.cbsa_code);
      const density =
        population === null
          ? metric("census.population_density", null, "people_per_square_mile", "Derived", "Population density is unavailable because total population is missing.")
          : !Number.isFinite(area) || (area ?? 0) <= 0
            ? metric("census.population_density", null, "people_per_square_mile", "Derived", "Population density is unavailable because compatible 2024 CBSA ALAND is missing.", true)
            : metric(
                "census.population_density",
                Math.round((population / (area! / SQUARE_METERS_PER_SQUARE_MILE)) * 1_000_000) / 1_000_000,
                "people_per_square_mile",
                "Derived",
                null,
              );
      return {
        market_id: marketValue.market_id,
        cbsa_code: marketValue.cbsa_code,
        cbsa_name: marketValue.cbsa_name,
        cbsa_type: marketValue.cbsa_type,
        census_geo_id: `3100000US${marketValue.cbsa_code}`,
        metrics: { ...direct, population_density: density },
      };
    });

  return {
    snapshot: {
      schema_version: "1.0.0",
      transformation_version: CBSA_ACS_TRANSFORMATION_VERSION,
      dataset: "acs/acs5",
      dataset_vintage: CBSA_ACS_VINTAGE,
      estimate_period: CBSA_ACS_PERIOD_LABEL,
      observed_at: CBSA_ACS_OBSERVED_AT,
      source_id: CBSA_ACS_SOURCE_ID,
      sensitivity: "public",
      allowed_use: "market_context_only",
      scoring_weight: "none",
      markets: output,
    },
    rejected_rows: rejectedRows.sort((a, b) => a.row_number - b.row_number),
    counts: {
      input_rows: rows.length,
      matched_rows: accepted.size,
      missing_markets: markets.length - accepted.size,
      rejected_rows: rejectedRows.length,
      unmatched_rows: unmatchedRows,
    },
  };
}
