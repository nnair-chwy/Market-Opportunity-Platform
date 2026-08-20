import assert from "node:assert/strict";
import test from "node:test";
import { parseMarketingWeeklyDmaCsv } from "../../../lib/adapters/marketing-outcomes/index.ts";

test("accepts DMA weekly spend joined to first-party outcomes", () => {
  const result = parseMarketingWeeklyDmaCsv([
    "DMA_CODE,WEEK_START_DATE,CHANNEL,SPEND,ORDER_COUNT,NEW_CUSTOMER_COUNT,CONTRIBUTION",
    "501,2026-08-03,Paid Search,1000,140,32,4200",
  ].join("\n"));
  assert.equal(result.ready, true);
  assert.equal(result.records[0]?.orderCount, 140);
  assert.equal(result.metadata.geographyConversion, "none");
});

test("rejects row-level identifiers and duplicate DMA-week-channel rows", () => {
  const result = parseMarketingWeeklyDmaCsv([
    "DMA_CODE,WEEK_START_DATE,CHANNEL,SPEND,ORDER_COUNT,ORDER_ID",
    "501,2026-08-03,Paid Search,1000,140,O-1",
    "501,2026-08-03,Paid Search,1000,140,O-2",
  ].join("\n"));
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /identifier/i);
});
