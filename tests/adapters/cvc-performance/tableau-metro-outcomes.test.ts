import assert from "node:assert/strict";
import test from "node:test";
import { parseTableauCvcMetroOutcomesCsv } from "../../../lib/adapters/cvc-performance/index.ts";

test("accepts privacy-safe Tableau metro-week-channel aggregates", () => {
  const result = parseTableauCvcMetroOutcomesCsv([
    "METRO,WEEK_START_DATE,CHANNEL_CODE,SPEND,IMPRESSIONS,CLICKS,CVC_APPOINTMENTS,COMPLETED_APPOINTMENTS,NEW_TO_CHEWY_APPOINTMENTS,NET_SALES,SITE_COUNT,SOURCE_ROWS",
    "Atlanta,2025-02-03,Paid Search,1000,10000,500,20,18,9,4500,2,4",
  ].join("\n"));
  assert.equal(result.ready, true);
  assert.equal(result.records[0]?.netSales, 4500);
  assert.equal(result.metadata.crosswalkStatus, "tableau_label_only");
});

test("rejects direct identifiers and invalid measures", () => {
  const result = parseTableauCvcMetroOutcomesCsv("METRO,WEEK_START_DATE,CHANNEL_CODE,SPEND,IMPRESSIONS,CLICKS,CVC_APPOINTMENTS,COMPLETED_APPOINTMENTS,NEW_TO_CHEWY_APPOINTMENTS,NET_SALES,SITE_COUNT,PATIENT_ID\nAtlanta,2025-02-03,Paid Search,-1,1,1,1,1,1,1,1,p1");
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /identifiers/i);
});
