import {
  CVC_PERFORMANCE_CSV_COLUMNS,
  CVC_PERFORMANCE_QUALITY_STATUSES,
  type CvcAggregatePerformanceRecord,
  type CvcPerformanceFinding,
  type CvcPerformanceImportResult,
  type CvcPerformanceQualityStatus,
} from "./types.ts";

type ParsedCsv = {
  rows: string[][];
  syntaxFindings: CvcPerformanceFinding[];
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 86_400_000;

function finding(
  code: CvcPerformanceFinding["code"],
  severity: CvcPerformanceFinding["severity"],
  message: string,
  rowNumbers: number[] = [],
  businessIds: string[] = [],
  metricIds: string[] = [],
): CvcPerformanceFinding {
  return { code, severity, message, rowNumbers, businessIds, metricIds };
}

function parseCsvRows(csv: string): ParsedCsv {
  const rows: string[][] = [];
  const syntaxFindings: CvcPerformanceFinding[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let rowNumber = 1;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      rowNumber += 1;
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) {
    syntaxFindings.push(
      finding(
        "csv_syntax_error",
        "error",
        "The CSV ended inside a quoted field.",
        [rowNumber],
      ),
    );
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return { rows, syntaxFindings };
}

function isDateOnly(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseFiniteNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isQualityStatus(
  value: string,
): value is CvcPerformanceQualityStatus {
  return CVC_PERFORMANCE_QUALITY_STATUSES.some((status) => status === value);
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort();
}

function recordKey(record: CvcAggregatePerformanceRecord) {
  return [
    record.business_id,
    record.observation_window_start,
    record.observation_window_end,
    record.metric_id,
  ].join("|");
}

function inclusiveWindowDays(record: CvcAggregatePerformanceRecord) {
  const start = Date.parse(`${record.observation_window_start}T00:00:00.000Z`);
  const end = Date.parse(`${record.observation_window_end}T00:00:00.000Z`);
  return Math.round((end - start) / MILLISECONDS_PER_DAY) + 1;
}

function crossRecordFindings(
  records: readonly CvcAggregatePerformanceRecord[],
  rowNumbers: ReadonlyMap<CvcAggregatePerformanceRecord, number>,
) {
  const findings: CvcPerformanceFinding[] = [];
  const byKey = new Map<string, CvcAggregatePerformanceRecord[]>();
  const byMetric = new Map<string, CvcAggregatePerformanceRecord[]>();

  for (const record of records) {
    const key = recordKey(record);
    byKey.set(key, [...(byKey.get(key) ?? []), record]);
    byMetric.set(record.metric_id, [
      ...(byMetric.get(record.metric_id) ?? []),
      record,
    ]);
  }

  for (const duplicates of byKey.values()) {
    if (duplicates.length < 2) {
      continue;
    }
    findings.push(
      finding(
        "duplicate_clinic_period",
        "error",
        "The same clinic, metric, and observation period appears more than once.",
        duplicates.map((record) => rowNumbers.get(record) ?? 0),
        uniqueSorted(duplicates.map((record) => record.business_id)),
        uniqueSorted(duplicates.map((record) => record.metric_id)),
      ),
    );
  }

  for (const [metricId, metricRecords] of byMetric) {
    const units = uniqueSorted(metricRecords.map((record) => record.unit));
    if (units.length > 1) {
      findings.push(
        finding(
          "inconsistent_units",
          "error",
          `Metric "${metricId}" uses inconsistent units: ${units.join(", ")}.`,
          metricRecords.map((record) => rowNumbers.get(record) ?? 0),
          uniqueSorted(metricRecords.map((record) => record.business_id)),
          [metricId],
        ),
      );
    }

    const windowDays = [
      ...new Set(metricRecords.map((record) => inclusiveWindowDays(record))),
    ].sort((left, right) => left - right);
    if (windowDays.length > 1) {
      findings.push(
        finding(
          "incomparable_observation_windows",
          "error",
          `Metric "${metricId}" uses incomparable inclusive observation-window lengths: ${windowDays.join(", ")} days.`,
          metricRecords.map((record) => rowNumbers.get(record) ?? 0),
          uniqueSorted(metricRecords.map((record) => record.business_id)),
          [metricId],
        ),
      );
    }
  }

  return findings;
}

export function parseCvcPerformanceCsv(
  csv: string,
): CvcPerformanceImportResult {
  const parsed = parseCsvRows(csv);
  const findings = [...parsed.syntaxFindings];
  const [rawHeader = [], ...dataRows] = parsed.rows;
  const header = rawHeader.map((column, index) =>
    index === 0 ? column.replace(/^\uFEFF/, "").trim() : column.trim(),
  );
  const duplicateHeaders = uniqueSorted(
    header.filter((column, index) => header.indexOf(column) !== index),
  );

  for (const column of duplicateHeaders) {
    findings.push(
      finding(
        "duplicate_header",
        "error",
        `CSV column "${column}" appears more than once.`,
        [1],
      ),
    );
  }

  const missingColumns = CVC_PERFORMANCE_CSV_COLUMNS.filter(
    (column) => !header.includes(column),
  );
  for (const column of missingColumns) {
    findings.push(
      finding(
        "missing_column",
        "error",
        `Required CSV column "${column}" is missing.`,
        [1],
      ),
    );
  }

  for (const column of header.filter(
    (value) =>
      value !== "" &&
      !CVC_PERFORMANCE_CSV_COLUMNS.includes(
        value as (typeof CVC_PERFORMANCE_CSV_COLUMNS)[number],
      ),
  )) {
    findings.push(
      finding(
        "unexpected_column",
        "warning",
        `Unexpected CSV column "${column}" was ignored.`,
        [1],
      ),
    );
  }

  if (missingColumns.length > 0 || duplicateHeaders.length > 0) {
    return {
      sourceKind: "approved_manual_aggregate_csv",
      rowCount: dataRows.length,
      records: [],
      findings,
      metadata: {
        sourceIds: [],
        extractedAtDates: [],
        aggregateGrain: "clinic",
        containsIndividualDetail: false,
      },
    };
  }

  const records: CvcAggregatePerformanceRecord[] = [];
  const recordRowNumbers = new Map<CvcAggregatePerformanceRecord, number>();
  const headerIndexes = new Map(
    header.map((column, index) => [column, index] as const),
  );

  for (const [rowIndex, values] of dataRows.entries()) {
    if (values.every((value) => value.trim() === "")) {
      continue;
    }

    const rowNumber = rowIndex + 2;
    const value = (column: (typeof CVC_PERFORMANCE_CSV_COLUMNS)[number]) =>
      (values[headerIndexes.get(column) ?? -1] ?? "").trim();
    const businessId = value("business_id");
    const metricId = value("metric_id");
    const requiredTextColumns = [
      "business_id",
      "clinic_name",
      "observation_window_start",
      "observation_window_end",
      "metric_id",
      "unit",
      "source_id",
      "extracted_at",
      "quality_status",
    ] as const;
    let rowValid = true;

    for (const column of requiredTextColumns) {
      if (value(column) === "") {
        rowValid = false;
        findings.push(
          finding(
            "blank_required_field",
            "error",
            `Required field "${column}" is blank.`,
            [rowNumber],
            businessId ? [businessId] : [],
            metricId ? [metricId] : [],
          ),
        );
      }
    }

    const openingDate = value("opening_date");
    if (openingDate === "") {
      findings.push(
        finding(
          "missing_opening_date",
          "error",
          "Opening date is missing, so clinic maturity cannot be independently reviewed.",
          [rowNumber],
          businessId ? [businessId] : [],
          metricId ? [metricId] : [],
        ),
      );
    } else if (!isDateOnly(openingDate)) {
      rowValid = false;
      findings.push(
        finding(
          "invalid_date",
          "error",
          'Field "opening_date" must be an ISO date in YYYY-MM-DD format.',
          [rowNumber],
          businessId ? [businessId] : [],
          metricId ? [metricId] : [],
        ),
      );
    }

    const dateColumns = [
      "observation_window_start",
      "observation_window_end",
      "extracted_at",
    ] as const;
    for (const column of dateColumns) {
      if (value(column) !== "" && !isDateOnly(value(column))) {
        rowValid = false;
        findings.push(
          finding(
            "invalid_date",
            "error",
            `Field "${column}" must be an ISO date in YYYY-MM-DD format.`,
            [rowNumber],
            businessId ? [businessId] : [],
            metricId ? [metricId] : [],
          ),
        );
      }
    }

    if (
      isDateOnly(value("observation_window_start")) &&
      isDateOnly(value("observation_window_end")) &&
      value("observation_window_start") > value("observation_window_end")
    ) {
      rowValid = false;
      findings.push(
        finding(
          "invalid_observation_window",
          "error",
          "Observation-window start must be on or before its end.",
          [rowNumber],
          businessId ? [businessId] : [],
          metricId ? [metricId] : [],
        ),
      );
    }

    const weeksSinceOpening = parseFiniteNumber(value("weeks_since_opening"));
    if (
      weeksSinceOpening === null ||
      !Number.isInteger(weeksSinceOpening) ||
      weeksSinceOpening < 0
    ) {
      rowValid = false;
      findings.push(
        finding(
          "invalid_number",
          "error",
          'Field "weeks_since_opening" must be a non-negative integer.',
          [rowNumber],
          businessId ? [businessId] : [],
          metricId ? [metricId] : [],
        ),
      );
    }

    const aggregateValue = parseFiniteNumber(value("aggregate_value"));
    if (aggregateValue === null) {
      rowValid = false;
      findings.push(
        finding(
          "invalid_number",
          "error",
          'Field "aggregate_value" must be a finite number.',
          [rowNumber],
          businessId ? [businessId] : [],
          metricId ? [metricId] : [],
        ),
      );
    }

    const qualityStatus = value("quality_status");
    if (
      qualityStatus !== "" &&
      !isQualityStatus(qualityStatus)
    ) {
      rowValid = false;
      findings.push(
        finding(
          "invalid_quality_status",
          "error",
          `Quality status must be one of: ${CVC_PERFORMANCE_QUALITY_STATUSES.join(", ")}.`,
          [rowNumber],
          businessId ? [businessId] : [],
          metricId ? [metricId] : [],
        ),
      );
    }

    if (
      !rowValid ||
      weeksSinceOpening === null ||
      aggregateValue === null ||
      !isQualityStatus(qualityStatus)
    ) {
      continue;
    }

    const record: CvcAggregatePerformanceRecord = {
      business_id: businessId,
      clinic_name: value("clinic_name"),
      opening_date: openingDate || null,
      observation_window_start: value("observation_window_start"),
      observation_window_end: value("observation_window_end"),
      weeks_since_opening: weeksSinceOpening,
      metric_id: metricId,
      aggregate_value: aggregateValue,
      unit: value("unit"),
      source_id: value("source_id"),
      extracted_at: value("extracted_at"),
      quality_status: qualityStatus,
    };
    records.push(record);
    recordRowNumbers.set(record, rowNumber);
  }

  findings.push(...crossRecordFindings(records, recordRowNumbers));

  return {
    sourceKind: "approved_manual_aggregate_csv",
    rowCount: dataRows.filter(
      (row) => !row.every((value) => value.trim() === ""),
    ).length,
    records,
    findings,
    metadata: {
      sourceIds: uniqueSorted(records.map((record) => record.source_id)),
      extractedAtDates: uniqueSorted(
        records.map((record) => record.extracted_at),
      ),
      aggregateGrain: "clinic",
      containsIndividualDetail: false,
    },
  };
}
