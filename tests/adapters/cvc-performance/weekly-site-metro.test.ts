import assert from "node:assert/strict";
import test from "node:test";
import { parseCvcWeeklySiteMetroCsv } from "../../../lib/adapters/cvc-performance/index.ts";

test("accepts privacy-safe weekly site and CBSA outcomes", () => {
  const result = parseCvcWeeklySiteMetroCsv([
    "SITE_ID,CBSA_CODE,WEEK_START_DATE,MATURITY_STATUS,COMPLETED_APPOINTMENTS,STAFFED_CAPACITY,NET_SALES,NEW_TO_CHEWY_COUNT",
    "CVC-1,38060,2026-08-03,mature,120,160,18000,25",
  ].join("\n"));
  assert.equal(result.ready, true);
  assert.equal(result.records[0]?.completedAppointments, 120);
  assert.deepEqual(result.metadata, { grain: "site_x_cbsa_x_week", containsIndividualDetail: false });
});

test("fails closed on missing maturity, duplicate grain, or individual detail", () => {
  const result = parseCvcWeeklySiteMetroCsv([
    "SITE_ID,CBSA_CODE,WEEK_START_DATE,COMPLETED_APPOINTMENTS,STAFFED_CAPACITY,CUSTOMER_ID",
    "CVC-1,38060,2026-08-03,120,160,C-1",
    "CVC-1,38060,2026-08-03,121,160,C-2",
  ].join("\n"));
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /identifier/i);
  assert.match(result.errors.join(" "), /MATURITY_STATUS|MONTHS_OPEN/);
});
