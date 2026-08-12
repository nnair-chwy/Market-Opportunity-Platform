import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptClinicIdentity,
  adaptClinicPerformance,
  adaptMarketContext,
  adaptZipMarket,
  adaptZipSales,
} from "../lib/adapters/snowflake-csv/index.ts";

test("market adapter preserves missing CBSA codes and repeated-total warning", () => {
  const result = adaptMarketContext([
    "CBSA_CODE,CBSA_NAME,REPORTING_DATE,ACTIVE_CUSTOMER_COUNT,ACTIVE_CUSTOMER_COUNT_PRIOR_YEAR,ACTIVE_CUSTOMER_YOY_GROWTH,TOTAL_HOUSEHOLDS,ACTIVE_CUSTOMERS_PER_1000_HOUSEHOLDS,LOCATION_MATCHED_CUSTOMER_COUNT,LOCATION_UNMATCHED_CUSTOMER_COUNT,LOCATION_MATCH_RATE,QUALITY_STATUS",
    ",Seattle-Tacoma-Bellevue, WA,2026-07-31,100,90,0.1,1000,100,10,2,0.8,OK",
    ",Portland-Vancouver-Hillsboro, OR,2026-07-31,50,60,-0.1,1000,100,10,2,0.8,MISSING_HOUSEHOLD_DATA",
  ].join("\n"));
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].cbsaCode, null);
  assert.equal(result.records[1].totalHouseholds, null);
  assert.ok(result.warnings.some((warning) => warning.code === "missing_cbsa_code"));
  assert.ok(result.warnings.some((warning) => warning.code === "repeated_location_totals"));
});

test("geography and demand adapters normalize ZIPs and retain unresolved assignments", () => {
  const geography = adaptZipMarket("ZIP_CODE,CBSA_TITLE,CSA_TITLE,METRO_MICRO_STATISTICAL_AREA\n1234,Example,Other,Metropolitan Statistical Area");
  assert.equal(geography.records[0].zip, "01234");
  const demand = adaptZipSales("YEAR,CUSTOMER_ADDRESS_ZIP,NET_SALES_EXCLUDING_REFUNDS,NET_SALES\n2025,1234,100,90\n2025,,20,20", "zip_sales.csv", new Map());
  assert.equal(demand.records[0].geographyId, "zip:01234");
  assert.equal(demand.records[0].marketId, null);
  assert.equal(demand.rejectedRows.length, 1);
});

test("clinic adapters do not expose restricted activity fields in identity output", () => {
  const identity = adaptClinicIdentity("CLINIC_ID,ZIP_CODE,BUSINESS_START_DATE,TENURE,CORPORATE_CLINIC_FLAG,PH_CLINIC_FLAG,PBC_CLINIC_FLAG\nabc,1234,2020-01-01,4,FALSE,TRUE,FALSE");
  assert.deepEqual(identity.records[0].clinicId, "abc");
  assert.equal(identity.records[0].zip, "01234");
  assert.equal("netSales" in identity.records[0], false);
  const performance = adaptClinicPerformance("CLINIC_ID,NET_SALES,LOW_RANGE_DATE,UP_RANGE_DATE\nabc,100,2024-01-01,2024-12-31");
  assert.equal(performance.records[0].rawValue, 100);
  assert.ok(performance.warnings.some((warning) => warning.code === "performance_not_scoring_eligible"));
});
