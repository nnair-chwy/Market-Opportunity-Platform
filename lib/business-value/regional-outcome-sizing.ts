import type { CvcWeeklySiteMetroRecord } from "../adapters/cvc-performance/index.ts";
import type { MarketingWeeklyDmaRecord } from "../adapters/marketing-outcomes/index.ts";

export type ObservedMarketingScenario = {
  incrementalSpend: number;
  observedCostPerOrder: number | null;
  projectedAttributedOrders: number | null;
  projectedContribution: number | null;
  conclusionBoundary: string;
};

export function sizeObservedMarketingScenario(
  record: MarketingWeeklyDmaRecord,
  spendChangePercent: number,
): ObservedMarketingScenario {
  const incrementalSpend = record.spend * (spendChangePercent / 100);
  const observedCostPerOrder = record.orderCount > 0 ? record.spend / record.orderCount : null;
  const projectedAttributedOrders = observedCostPerOrder && observedCostPerOrder > 0
    ? incrementalSpend / observedCostPerOrder
    : null;
  const projectedContribution = record.contribution !== null && record.spend > 0
    ? incrementalSpend * (record.contribution / record.spend)
    : null;
  return {
    incrementalSpend,
    observedCostPerOrder,
    projectedAttributedOrders,
    projectedContribution,
    conclusionBoundary: "Observed-efficiency scenario only. This is not an incremental sales or CCP forecast until a test/control counterfactual and governed value outcome are connected.",
  };
}

export type CvcCapacityScenario = {
  observedUtilization: number | null;
  availableCapacity: number;
  incrementalCompletedAppointments: number;
  projectedNetSales: number | null;
  conclusionBoundary: string;
};

export function sizeCvcCapacityScenario(
  record: CvcWeeklySiteMetroRecord,
  targetUtilization: number,
): CvcCapacityScenario {
  const boundedTarget = Math.min(1, Math.max(0, targetUtilization));
  const observedUtilization = record.staffedCapacity > 0
    ? record.completedAppointments / record.staffedCapacity
    : null;
  const availableCapacity = Math.max(0, record.staffedCapacity - record.completedAppointments);
  const incrementalCompletedAppointments = Math.max(
    0,
    Math.min(availableCapacity, record.staffedCapacity * boundedTarget - record.completedAppointments),
  );
  const netSalesPerCompletedAppointment = record.netSales !== null && record.completedAppointments > 0
    ? record.netSales / record.completedAppointments
    : null;
  return {
    observedUtilization,
    availableCapacity,
    incrementalCompletedAppointments,
    projectedNetSales: netSalesPerCompletedAppointment === null
      ? null
      : incrementalCompletedAppointments * netSalesPerCompletedAppointment,
    conclusionBoundary: "Capacity-constrained observed-value scenario only. It does not estimate incremental demand, contribution, or CCP without a governed causal response and value join.",
  };
}
