import assert from "node:assert/strict";
import test from "node:test";
import { sizeCvcCapacityScenario, sizeObservedMarketingScenario } from "../lib/business-value/regional-outcome-sizing.ts";

test("sizes an observed marketing scenario without calling it incremental", () => {
  const result = sizeObservedMarketingScenario({ dmaCode: "501", weekStartDate: "2026-08-03", channel: "Paid Search", spend: 1000, orderCount: 100, newCustomerCount: 20, contribution: 2500 }, 10);
  assert.equal(result.incrementalSpend, 100);
  assert.equal(result.observedCostPerOrder, 10);
  assert.equal(result.projectedAttributedOrders, 10);
  assert.equal(result.projectedContribution, 250);
  assert.match(result.conclusionBoundary, /not an incremental/i);
});

test("caps a CVC scenario at staffed capacity and carries observed sales value", () => {
  const result = sizeCvcCapacityScenario({ siteId: "CVC-1", cbsaCode: "38060", weekStartDate: "2026-08-03", completedAppointments: 80, staffedCapacity: 100, maturityStatus: "mature", monthsOpen: 24, netSales: 12000, newToChewyCount: 15 }, 0.9);
  assert.equal(result.observedUtilization, 0.8);
  assert.equal(result.incrementalCompletedAppointments, 10);
  assert.equal(result.projectedNetSales, 1500);
  assert.match(result.conclusionBoundary, /does not estimate incremental demand/i);
});
