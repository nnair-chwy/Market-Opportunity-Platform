import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptClinicIdentity,
  adaptClinicPerformance,
  adaptMarketContext,
  adaptZipSales,
} from "../lib/adapters/snowflake-csv/index.ts";
import { prepareClinicSiteReview } from "../lib/playbooks/clinic-site-evaluation.ts";

const market = adaptMarketContext("CBSA_CODE,CBSA_NAME,REPORTING_DATE,ACTIVE_CUSTOMER_COUNT,ACTIVE_CUSTOMER_COUNT_PRIOR_YEAR,ACTIVE_CUSTOMER_YOY_GROWTH,TOTAL_HOUSEHOLDS,ACTIVE_CUSTOMERS_PER_1000_HOUSEHOLDS,LOCATION_MATCHED_CUSTOMER_COUNT,LOCATION_UNMATCHED_CUSTOMER_COUNT,LOCATION_MATCH_RATE,QUALITY_STATUS\n42660,Seattle-Tacoma-Bellevue, WA,2026-07-31,100,90,0.1,1000,100,10,2,0.8,OK");
const demand = adaptZipSales("YEAR,CUSTOMER_ADDRESS_ZIP,NET_SALES_EXCLUDING_REFUNDS,NET_SALES\n2025,98101,100,90", "zip_sales.csv", new Map([["98101", "cbsa:42660"]]));
const identity = adaptClinicIdentity("CLINIC_ID,ZIP_CODE,BUSINESS_START_DATE,TENURE,CORPORATE_CLINIC_FLAG,PH_CLINIC_FLAG,PBC_CLINIC_FLAG\nclinic-1,98101,2020-01-01,4,FALSE,TRUE,FALSE");
const performance = adaptClinicPerformance("CLINIC_ID,NET_SALES,LOW_RANGE_DATE,UP_RANGE_DATE\nclinic-1,100,2024-01-01,2024-12-31");

test("clinic review remains blocked until evidence approvals are supplied", () => {
  const result = prepareClinicSiteReview({ marketId: "cbsa:42660", marketContext: market, demand, clinicIdentity: identity, clinicPerformance: performance });
  assert.equal(result.status, "blocked");
  assert.ok(result.blockers.includes("clinic outcome definition is not approved"));
  assert.equal(result.package.marketId, "cbsa:42660");
});

test("clinic review becomes reviewable only after all gates pass", () => {
  const result = prepareClinicSiteReview({
    marketId: "cbsa:42660",
    marketContext: market,
    demand,
    clinicIdentity: identity,
    clinicPerformance: performance,
    approvals: { outcome: true, maturity: true, cohort: true, dataUse: true },
  });
  assert.equal(result.status, "ready_for_review");
  assert.deepEqual(result.blockers, []);
});
