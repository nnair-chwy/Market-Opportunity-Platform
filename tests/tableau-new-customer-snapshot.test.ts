import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("connected Tableau acquisition snapshot is privacy-safe national context and never invents regional geography", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../data/approved/new-customer-acquisition/current.json", import.meta.url), "utf8")) as {
    grain: string;
    geography: { type: string; value: string; regionalJoinStatus: string };
    privacy: { containsIndividualDetail: boolean; containsDirectIdentifiers: boolean };
    records: Array<{ weekStartDate: string; businessSegment: string; netNewToChewySegmentAcquisitions: number }>;
    latestSegmentLeaders: unknown[];
    limitations: string[];
  };
  assert.equal(snapshot.grain, "week_x_business_segment_x_us_national");
  assert.deepEqual(snapshot.geography, { type: "country", value: "US", regionalJoinStatus: "not_available" });
  assert.equal(snapshot.privacy.containsIndividualDetail, false);
  assert.equal(snapshot.privacy.containsDirectIdentifiers, false);
  assert.ok(snapshot.records.length > 10_000);
  assert.ok(snapshot.latestSegmentLeaders.length > 0);
  assert.ok(snapshot.records.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.weekStartDate) && row.businessSegment.length > 0 && Number.isFinite(row.netNewToChewySegmentAcquisitions)));
  assert.ok(snapshot.limitations.some((item) => /cannot be allocated to regions/i.test(item)));
});
