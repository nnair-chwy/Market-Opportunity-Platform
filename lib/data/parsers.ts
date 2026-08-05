import type {
  CsvRecord,
  ParsedRecords,
  ValidationIssue,
} from "./types.ts";

function csvIssue(
  rowIndex: number,
  field: string,
  code: string,
  reason: string,
): ValidationIssue {
  return {
    code,
    severity: "error",
    field,
    record: { kind: "csv_row", index: rowIndex },
    reason,
  };
}

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  return Number(value);
}

function nullableNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  return Number(value);
}

/**
 * Converts already parsed CSV rows into the canonical nested candidate shape.
 * CSV parsing and delimiter handling stay outside this pure adapter boundary.
 */
export function recordsFromCsv(rows: readonly CsvRecord[]): ParsedRecords {
  const issues: ValidationIssue[] = [];
  const bySite = new Map<string, Record<string, unknown>>();
  const candidateRows = new Set<string>();

  rows.forEach((row, rowIndex) => {
    const siteId = row.site_id?.trim();
    if (!siteId) {
      issues.push(
        csvIssue(rowIndex, "site_id", "required_field", "site_id is required."),
      );
      return;
    }

    let candidate = bySite.get(siteId);
    if (!candidate) {
      candidate = {
        site_id: siteId,
        site_name: row.site_name,
        evaluation_date: row.evaluation_date,
        latitude: optionalNumber(row.latitude),
        longitude: optionalNumber(row.longitude),
        metrics: [],
        qualitative_evidence: [],
        constraints: [],
      };
      bySite.set(siteId, candidate);
    } else {
      for (const field of ["site_name", "evaluation_date"] as const) {
        if (
          row[field] !== undefined &&
          candidate[field] !== undefined &&
          row[field] !== candidate[field]
        ) {
          issues.push(
            csvIssue(
              rowIndex,
              field,
              "conflicting_candidate_field",
              `${field} conflicts with an earlier row for ${siteId}.`,
            ),
          );
        }
      }
    }

    const recordType = row.record_type?.trim();
    if (recordType === "candidate") {
      if (candidateRows.has(siteId)) {
        issues.push(
          csvIssue(
            rowIndex,
            "record_type",
            "duplicate_record",
            `Duplicate candidate row for ${siteId}.`,
          ),
        );
      }
      candidateRows.add(siteId);
      return;
    }

    const commonProvenance = {
      source_id: row.source_id,
      observed_at: row.observed_at,
      geography: row.geography,
      quality_status: row.quality_status,
      sensitivity: row.sensitivity,
      transformation: row.transformation || undefined,
    };

    if (recordType === "metric") {
      (candidate.metrics as unknown[]).push({
        metric_id: row.metric_id,
        raw_value: nullableNumber(row.raw_value),
        unit: row.unit,
        ...commonProvenance,
      });
    } else if (recordType === "qualitative_evidence") {
      (candidate.qualitative_evidence as unknown[]).push({
        evidence_id: row.evidence_id,
        summary: row.summary,
        evidence_status: row.evidence_status,
        ...commonProvenance,
      });
    } else if (recordType === "constraint") {
      (candidate.constraints as unknown[]).push({
        constraint_id: row.constraint_id,
        status: row.status,
        notes: row.notes || undefined,
        evidence_status: row.evidence_status,
        ...commonProvenance,
      });
    } else {
      issues.push(
        csvIssue(
          rowIndex,
          "record_type",
          "invalid_record_type",
          "record_type must be candidate, metric, qualitative_evidence, or constraint.",
        ),
      );
    }
  });

  return { records: [...bySite.values()], issues };
}

/** Accepts a parsed candidate object, array, or { candidates: [...] } envelope. */
export function recordsFromJson(input: unknown): ParsedRecords {
  if (Array.isArray(input)) return { records: input, issues: [] };
  if (
    typeof input === "object" &&
    input !== null &&
    "candidates" in input &&
    Array.isArray((input as { candidates: unknown }).candidates)
  ) {
    return {
      records: (input as { candidates: unknown[] }).candidates,
      issues: [],
    };
  }
  return { records: [input], issues: [] };
}
