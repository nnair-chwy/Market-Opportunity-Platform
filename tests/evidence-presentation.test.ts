import assert from "node:assert/strict";
import test from "node:test";
import { SYNTHETIC_EVIDENCE_RESULT } from "../lib/evidence/fixtures.ts";
import {
  approvedSourceHref,
  formatEvidenceDate,
  formatRawValue,
  missingSourceIds,
  presentSource,
  sourcesForMetric,
  summarizeEvidence,
} from "../lib/evidence/presentation.ts";
import type {
  EvidenceSource,
  StructuredEvidenceResult,
} from "../lib/evidence/types.ts";

const publicSource: EvidenceSource = {
  sourceId: "SYN-PUBLIC",
  sourceLabel: "Approved synthetic source",
  evidenceStatus: "Confirmed",
  observedAt: "2026-07-01",
  extractedAt: "2026-07-02",
  geography: "market",
  aggregation: "count",
  qualityStatus: "warning",
  sensitivity: "public",
  approvedSourceUrl: "https://example.test/approved-source",
};

test("keeps evidence status and quality status independent", () => {
  const presented = presentSource(publicSource);

  assert.equal(presented.evidenceStatus, "Confirmed");
  assert.equal(presented.qualityStatus, "warning");
});

test("renders only valid, explicitly approved web links", () => {
  assert.equal(
    approvedSourceHref(publicSource),
    "https://example.test/approved-source",
  );
  assert.equal(
    approvedSourceHref({
      sensitivity: "public",
      approvedSourceUrl: "javascript:alert(1)",
    }),
    null,
  );
  assert.equal(
    approvedSourceHref({
      sensitivity: "restricted",
      approvedSourceUrl: "https://example.test/restricted",
    }),
    null,
  );
});

test("redacts restricted source fields before presentation", () => {
  const restricted = SYNTHETIC_EVIDENCE_RESULT.sources?.find(
    (source) => source.sensitivity === "restricted",
  );
  assert(restricted);

  const presented = presentSource({
    ...restricted,
    restrictedPayload: "extra restricted field",
  } as EvidenceSource);
  const serialized = JSON.stringify(presented);

  assert.equal(presented.sourceId, "Restricted source");
  assert.equal(presented.sourceLabel, "Restricted information");
  assert.equal(presented.isRestricted, true);
  assert.equal(presented.approvedSourceUrl, null);
  assert.doesNotMatch(
    serialized,
    /must not render|Restricted geography|extra restricted field/,
  );
});

test("links metric contributions to known metadata and exposes missing metadata", () => {
  const scoredMetric = SYNTHETIC_EVIDENCE_RESULT.metrics?.[0];
  const missingMetric = SYNTHETIC_EVIDENCE_RESULT.metrics?.find(
    (metric) => metric.disposition === "missing",
  );
  assert(scoredMetric);
  assert(missingMetric);

  assert.deepEqual(
    sourcesForMetric(scoredMetric, SYNTHETIC_EVIDENCE_RESULT.sources).map(
      (source) => source.sourceId,
    ),
    ["SYN-SRC-101"],
  );
  assert.deepEqual(
    missingSourceIds(missingMetric, SYNTHETIC_EVIDENCE_RESULT.sources),
    ["SYN-SRC-UNKNOWN"],
  );
});

test("summarizes dispositions without treating qualitative evidence as scored", () => {
  const summary = summarizeEvidence(SYNTHETIC_EVIDENCE_RESULT);

  assert.equal(summary.scoredMetrics, 2);
  assert.equal(summary.missingMetrics, 1);
  assert.equal(summary.rejectedMetrics, 1);
  assert.equal(summary.unscoredMetrics, 1);
  assert.equal(summary.qualitativeItems, 1);
  assert.equal(summary.restrictedSources, 1);
});

test("handles partial structured results and missing display values", () => {
  const partial: StructuredEvidenceResult = {
    evaluationId: "SYN-PARTIAL",
    candidateLabel: "Partial synthetic candidate",
  };

  assert.deepEqual(summarizeEvidence(partial), {
    totalSources: 0,
    availableSources: 0,
    restrictedSources: 0,
    staleSources: 0,
    scoredMetrics: 0,
    missingMetrics: 0,
    excludedMetrics: 0,
    rejectedMetrics: 0,
    unscoredMetrics: 0,
    qualitativeItems: 0,
    warningCount: 0,
  });
  assert.equal(formatRawValue(null, "locations"), "Missing");
  assert.equal(formatEvidenceDate(null), "Unknown");
});
