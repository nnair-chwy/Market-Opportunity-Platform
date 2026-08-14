import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildReadinessPacket } from "../lib/clinic-market-readiness/readiness.ts";
import type { QualityReport } from "../lib/clinic-market-readiness/contracts.ts";

const fixture = JSON.parse(await readFile(new URL("../data/fixtures/clinic-market-readiness/reviewable.synthetic.json", import.meta.url), "utf8")) as unknown[];
const qualityReport: QualityReport = {
  reportVersion: "clinic-market-quality-report-v1",
  snapshotVersion: "test-snapshot-v1",
  generatedAt: "2026-08-13T00:00:00.000Z",
  intendedUse: "test",
  observationCount: fixture.length,
  marketCount: 1,
  sourceCount: 1,
  evidenceCounts: { Hypothesis: fixture.length },
  qualityCounts: { accepted: fixture.length },
  sensitivityCounts: { internal: fixture.length },
  findings: [],
  status: "ready",
  completenessThreshold: 0.8,
  queryVersion: "clinic-market-evidence-readiness-v1",
  calculationVersion: "clinic-market-evidence-readiness-calculation-v1",
};

test("returns a reviewable packet for the complete synthetic case", () => {
  const packet = buildReadinessPacket({ snapshotVersion: "test-snapshot-v1", marketId: "synthetic:reviewable-clinic-market", observations: fixture, qualityReport });
  assert.equal(packet.packetStatus, "reviewable");
  assert.equal(packet.completeness.percentage, 1);
  assert.equal(packet.evidence.every((row) => row.scoring_eligibility === "none"), true);
  assert.match(packet.warnings.join(" "), /synthetic/i);
});

test("keeps an approved market reviewable when performance definitions need documentation", () => {
  const approved = (fixture as Array<Record<string, unknown>>).map((row) => ({ ...row, market_id: "cbsa:10180", cbsa_code: "10180", market_name: "Example Market", is_synthetic: false, evidence_status: "Reported", allowed_use: "approved_internal_decision_support", warning: row.evidence_domain === "clinic_performance" ? "Definition warning" : null }));
  const packet = buildReadinessPacket({ snapshotVersion: "test-snapshot-v1", marketId: "cbsa:10180", observations: approved, qualityReport });
  assert.equal(packet.packetStatus, "reviewable");
  assert.ok(packet.warnings.some((warning) => /definition warning/i.test(warning)));
});

test("does not silently treat missing evidence as zero", () => {
  const incomplete = fixture.filter((row) => (row as { evidence_domain: string }).evidence_domain !== "clinic_performance");
  const packet = buildReadinessPacket({ snapshotVersion: "test-snapshot-v1", marketId: "synthetic:reviewable-clinic-market", observations: incomplete, qualityReport });
  assert.equal(packet.packetStatus, "blocked");
  assert.deepEqual(packet.missingEvidence, ["Missing usable clinic_performance evidence."]);
});
