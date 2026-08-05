import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CANDIDATE_OUTCOMES,
  CVC_PERFORMANCE_CSV_COLUMNS,
  filterByMaturityWindow,
  parseCvcPerformanceCsv,
  prepareCvcPerformanceComparison,
} from "../../../lib/adapters/cvc-performance/index.ts";

const FIXTURE_BASE = new URL(
  "../../../data/fixtures/cvc-performance/",
  import.meta.url,
);

async function fixture(name: string) {
  return readFile(new URL(name, FIXTURE_BASE), "utf8");
}

test("exposes a source-neutral aggregate-only CSV contract", () => {
  assert.deepEqual(CVC_PERFORMANCE_CSV_COLUMNS, [
    "business_id",
    "clinic_name",
    "opening_date",
    "observation_window_start",
    "observation_window_end",
    "weeks_since_opening",
    "metric_id",
    "aggregate_value",
    "unit",
    "source_id",
    "extracted_at",
    "quality_status",
  ]);
  assert.deepEqual(
    Object.values(CANDIDATE_OUTCOMES).map(
      ({ metricId, approvalStatus }) => [metricId, approvalStatus],
    ),
    [
      ["completed_appointments", "unapproved"],
      ["unique_customers", "unapproved"],
      ["net_sales", "unapproved"],
    ],
  );
});

test("parses synthetic clinic aggregates and preserves source metadata", async () => {
  const result = parseCvcPerformanceCsv(
    await fixture("aggregate-performance.synthetic.csv"),
  );

  assert.equal(result.rowCount, 9);
  assert.equal(result.records.length, 9);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.metadata, {
    sourceIds: ["SRC-002"],
    extractedAtDates: ["2026-07-25"],
    aggregateGrain: "clinic",
    containsIndividualDetail: false,
  });
  assert.equal(result.records[1].clinic_name, "Synthetic West, Clinic");
  assert.deepEqual(result.records[0], {
    business_id: "SYN-CVC-001",
    clinic_name: "Synthetic North Clinic",
    opening_date: "2025-01-06",
    observation_window_start: "2025-07-07",
    observation_window_end: "2025-09-28",
    weeks_since_opening: 38,
    metric_id: "completed_appointments",
    aggregate_value: 840,
    unit: "appointments",
    source_id: "SRC-002",
    extracted_at: "2026-07-25",
    quality_status: "accepted",
  });
});

test("reports missing dates, duplicates, inconsistent units, and windows", async () => {
  const imported = parseCvcPerformanceCsv(
    await fixture("aggregate-performance-invalid.synthetic.csv"),
  );
  const codes = new Set(imported.findings.map(({ code }) => code));

  assert.equal(imported.records.length, 3);
  assert.ok(codes.has("missing_opening_date"));
  assert.ok(codes.has("duplicate_clinic_period"));
  assert.ok(codes.has("inconsistent_units"));
  assert.ok(codes.has("incomparable_observation_windows"));

  const comparison = prepareCvcPerformanceComparison(imported.records, {
    outcome: {
      metricId: "completed_appointments",
      approvedBy: "Synthetic test owner",
      approvedAt: "2026-07-25",
      definitionVersion: "synthetic-v1",
    },
    maturityWindow: {
      minimumWeeksSinceOpening: 26,
      maximumWeeksSinceOpening: 52,
      version: "synthetic-26-to-52-v1",
    },
  });

  assert.equal(comparison.comparisonReady, false);
  assert.ok(
    comparison.findings.some(
      ({ code }) => code === "incomparable_observation_windows",
    ),
  );
  assert.ok(
    comparison.excluded.some(({ business_id }) => business_id === "SYN-CVC-102"),
  );
});

test("requires explicit outcome, maturity, and owner approval", async () => {
  const imported = parseCvcPerformanceCsv(
    await fixture("aggregate-performance.synthetic.csv"),
  );
  const missing = prepareCvcPerformanceComparison(imported.records, {});
  assert.equal(missing.comparisonReady, false);
  assert.deepEqual(
    missing.findings.map(({ code }) => code),
    ["outcome_not_configured", "maturity_rule_not_configured"],
  );

  const unapproved = prepareCvcPerformanceComparison(imported.records, {
    outcome: { metricId: "net_sales" },
    maturityWindow: {
      minimumWeeksSinceOpening: 26,
      maximumWeeksSinceOpening: 52,
      version: "synthetic-26-to-52-v1",
    },
  });
  assert.equal(unapproved.comparisonReady, false);
  assert.ok(
    unapproved.findings.some(({ code }) => code === "outcome_not_approved"),
  );

  const missingOutcomeRecords = prepareCvcPerformanceComparison(
    imported.records,
    {
      outcome: {
        metricId: "synthetic_missing_metric",
        approvedBy: "Synthetic test owner",
        approvedAt: "2026-07-25",
        definitionVersion: "synthetic-v1",
      },
      maturityWindow: {
        minimumWeeksSinceOpening: 26,
        maximumWeeksSinceOpening: 52,
        version: "synthetic-26-to-52-v1",
      },
    },
  );
  assert.equal(missingOutcomeRecords.comparisonReady, false);
  assert.ok(
    missingOutcomeRecords.findings.some(
      ({ code }) => code === "no_records_for_outcome",
    ),
  );
});

test("rejects malformed row values instead of coercing them", () => {
  const csv = [
    CVC_PERFORMANCE_CSV_COLUMNS.join(","),
    [
      "SYN-CVC-BAD",
      "Synthetic Invalid Clinic",
      "2025-02-30",
      "2025-07-07",
      "2025-09-28",
      "many",
      "completed_appointments",
      "",
      "appointments",
      "SRC-002",
      "07/25/2026",
      "trusted",
    ].join(","),
  ].join("\n");
  const result = parseCvcPerformanceCsv(csv);
  const codes = new Set(result.findings.map(({ code }) => code));

  assert.equal(result.records.length, 0);
  assert.ok(codes.has("invalid_date"));
  assert.ok(codes.has("invalid_number"));
  assert.ok(codes.has("invalid_quality_status"));
});

test("filters maturity deterministically using inclusive week boundaries", async () => {
  const imported = parseCvcPerformanceCsv(
    await fixture("aggregate-performance.synthetic.csv"),
  );
  const records = imported.records.filter(
    ({ metric_id }) => metric_id === "completed_appointments",
  );
  const result = filterByMaturityWindow(
    [
      { ...records[0], weeks_since_opening: 26 },
      { ...records[1], weeks_since_opening: 52 },
      { ...records[2], weeks_since_opening: 53 },
    ],
    {
      minimumWeeksSinceOpening: 26,
      maximumWeeksSinceOpening: 52,
      version: "synthetic-26-to-52-v1",
    },
  );

  assert.equal(result.included.length, 2);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.findings[0].code, "record_outside_maturity_window");
});

test("returns a comparison-ready cohort only with explicit compatible inputs", async () => {
  const imported = parseCvcPerformanceCsv(
    await fixture("aggregate-performance.synthetic.csv"),
  );
  const result = prepareCvcPerformanceComparison(imported.records, {
    outcome: {
      metricId: "unique_customers",
      approvedBy: "Synthetic test owner",
      approvedAt: "2026-07-25",
      definitionVersion: "synthetic-v1",
    },
    maturityWindow: {
      minimumWeeksSinceOpening: 26,
      maximumWeeksSinceOpening: 52,
      version: "synthetic-26-to-52-v1",
    },
  });

  assert.equal(result.comparisonReady, true);
  assert.equal(result.included.length, 3);
  assert.ok(
    result.included.every(
      ({ metric_id }) => metric_id === "unique_customers",
    ),
  );
  assert.deepEqual(result.findings, []);
});
