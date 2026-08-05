import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  validateCsvRecords,
  validateJsonInput,
  type ValidationOptions,
} from "../../lib/data/index.ts";

const options: ValidationOptions = {
  asOfDate: "2026-07-24",
  allowedSourceIds: ["SYNTHETIC", "SRC-001"],
  expectedMetricIds: ["competitor_count", "demand_index"],
  metricDefinitions: {
    demand_index: {
      metricId: "demand_index",
      unit: "index",
      minimum: 0,
      maximum: 100,
      allowedGeographies: ["market"],
      freshnessDays: 365,
    },
    competitor_count: {
      metricId: "competitor_count",
      unit: "count",
      minimum: 0,
      allowedGeographies: ["radius"],
      freshnessDays: 365,
    },
  },
};

function fixture(name: string): unknown {
  const url = new URL(`../../data/fixtures/validation/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as unknown;
}

test("accepts a complete candidate and preserves provenance and zero", () => {
  const result = validateJsonInput(fixture("complete"), options);

  assert.equal(result.valid, true);
  assert.equal(result.scoringCandidates.length, 1);
  assert.equal(result.candidates[0].coverage.coveragePercent, 100);
  assert.equal(result.candidates[0].coverage.zeroValueCount, 1);
  assert.equal(result.candidates[0].coverage.missingValueCount, 0);
  assert.equal(
    result.scoringCandidates[0].metrics[0].transformation,
    "Synthetic aggregate generated for validation tests.",
  );
  assert.equal(
    result.scoringCandidates[0].qualitative_evidence[0].evidence_status,
    "Hypothesis",
  );
  assert(result.issues.some((issue) => issue.code === "zero_value"));
});

test("keeps a missing value null and reports candidate coverage", () => {
  const result = validateJsonInput(fixture("incomplete"), options);
  const candidate = result.candidates[0];

  assert.equal(candidate.candidate?.metrics[0].raw_value, null);
  assert.equal(candidate.scoringCandidate, null);
  assert.equal(candidate.acceptedForScoring, false);
  assert.equal(candidate.coverage.missingValueCount, 1);
  assert.equal(candidate.coverage.zeroValueCount, 0);
  assert.equal(candidate.coverage.coveragePercent, 0);
  assert.deepEqual(candidate.coverage.missingMetricIds, [
    "competitor_count",
    "demand_index",
  ]);
  assert(candidate.issues.some((issue) => issue.code === "missing_value"));
});

test("classifies stale and source-warning observations as warnings", () => {
  const result = validateJsonInput(fixture("stale"), options);
  const candidate = result.candidates[0];

  assert.equal(result.valid, true);
  assert.equal(candidate.coverage.staleMetricCount, 1);
  assert.equal(candidate.coverage.warningMetricCount, 1);
  assert(candidate.issues.some((issue) => issue.code === "stale_observation"));
  assert(candidate.issues.every((issue) => issue.severity !== "error"));
});

test("returns structured errors for malformed input without throwing", () => {
  const result = validateJsonInput(fixture("malformed"), options);

  assert.equal(result.valid, false);
  assert.equal(result.scoringCandidates.length, 0);
  assert(result.summary.errorCount >= 8);
  for (const issue of result.issues) {
    assert(issue.field.length > 0);
    assert(issue.record.kind.length > 0);
    assert(issue.reason.length > 0);
  }
});

test("retains rejected observations for audit and excludes them from scoring", () => {
  const result = validateJsonInput(fixture("rejected"), options);
  const candidate = result.candidates[0];

  assert.equal(candidate.candidate?.metrics.length, 2);
  assert.equal(candidate.scoringCandidate?.metrics.length, 1);
  assert.equal(candidate.scoringCandidate?.metrics[0].metric_id, "competitor_count");
  assert.equal(candidate.rejectedInputs[0].input !== undefined, true);
  assert.equal(candidate.coverage.rejectedMetricCount, 1);
  assert.equal(candidate.coverage.coveragePercent, 50);
});

test("excludes duplicate metric IDs and duplicate candidate IDs", () => {
  const complete = fixture("complete") as Record<string, unknown>;
  const duplicateMetrics = {
    ...complete,
    metrics: [
      ...(complete.metrics as unknown[]),
      (complete.metrics as unknown[])[0],
    ],
  };
  const metricResult = validateJsonInput(duplicateMetrics, options);

  assert.equal(metricResult.valid, false);
  assert.equal(
    metricResult.candidates[0].scoringCandidate?.metrics.some(
      (metric) => metric.metric_id === "demand_index",
    ),
    false,
  );

  const candidateResult = validateJsonInput([complete, complete], options);
  assert.equal(candidateResult.scoringCandidates.length, 1);
  assert.equal(candidateResult.candidates[1].acceptedForScoring, false);
  assert(
    candidateResult.candidates[1].issues.some(
      (issue) => issue.code === "duplicate_record",
    ),
  );
});

test("validates ranges, units, geography, source IDs, and sensitivity", () => {
  const input = fixture("complete") as {
    metrics: Array<Record<string, unknown>>;
  };
  const result = validateJsonInput(
    {
      ...input,
      metrics: [
        {
          ...input.metrics[0],
          raw_value: 101,
          unit: "percent",
          geography: "radius",
          source_id: "UNREGISTERED",
          sensitivity: "restricted",
        },
      ],
    },
    options,
  );
  const codes = new Set(result.issues.map((issue) => issue.code));

  assert.equal(result.scoringCandidates[0]?.metrics.length ?? 0, 0);
  assert(codes.has("out_of_range"));
  assert(codes.has("invalid_unit"));
  assert(codes.has("invalid_geographic_grain"));
  assert(codes.has("unknown_source_id"));
  assert(codes.has("restricted_data"));
});

test("normalizes CSV-derived records without converting blank values to zero", () => {
  const rows = [
    {
      record_type: "candidate",
      site_id: "CSV-SITE-001",
      site_name: "Synthetic CSV Candidate",
      evaluation_date: "2026-07-01",
    },
    {
      record_type: "metric",
      site_id: "CSV-SITE-001",
      site_name: "Synthetic CSV Candidate",
      evaluation_date: "2026-07-01",
      metric_id: "demand_index",
      raw_value: "",
      unit: "index",
      source_id: "SYNTHETIC",
      observed_at: "2026-06-15",
      geography: "market",
      quality_status: "accepted",
      sensitivity: "internal",
    },
    {
      record_type: "qualitative_evidence",
      site_id: "CSV-SITE-001",
      site_name: "Synthetic CSV Candidate",
      evaluation_date: "2026-07-01",
      evidence_id: "CSV-EVID-001",
      summary: "Synthetic CSV observation.",
      evidence_status: "Reported",
      source_id: "SYNTHETIC",
      observed_at: "2026-06-16",
      geography: "market",
      quality_status: "accepted",
      sensitivity: "internal",
    },
  ] as const;

  const result = validateCsvRecords(rows, options);

  assert.equal(result.candidates[0].candidate?.metrics[0].raw_value, null);
  assert.equal(
    result.candidates[0].candidate?.qualitative_evidence[0].evidence_status,
    "Reported",
  );
  assert.equal(result.candidates[0].coverage.zeroValueCount, 0);
  assert.equal(result.candidates[0].coverage.missingValueCount, 1);
});
