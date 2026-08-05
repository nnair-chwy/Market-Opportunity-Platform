import type { SubmarketMetricDefinition } from "./types.ts";

export const SEATTLE_DEEP_DIVE_CONFIGURATION_VERSION = "seattle-submarket-demo-v1";
export const SEATTLE_DEEP_DIVE_CALCULATION_VERSION = "seattle-submarket-priority-v1";

export const SEATTLE_SUBMARKET_METRICS: readonly SubmarketMetricDefinition[] = [
  { metricId: "demand_potential", label: "Demand potential", weight: 30, direction: "higher-is-better", unit: "index" },
  { metricId: "veterinary_whitespace", label: "Veterinary whitespace", weight: 20, direction: "higher-is-better", unit: "index" },
  { metricId: "customer_presence", label: "Customer presence", weight: 20, direction: "higher-is-better", unit: "index" },
  { metricId: "commercial_availability", label: "Commercial availability", weight: 15, direction: "higher-is-better", unit: "index" },
  { metricId: "staffing_feasibility", label: "Staffing feasibility", weight: 15, direction: "higher-is-better", unit: "index" },
] as const;

export const SEATTLE_DEEP_DIVE_NOTES = [
  "All values and weights are synthetic and unapproved.",
  "Priority reflects demo criteria, not site quality or a market-entry recommendation.",
  "Missing metrics are excluded and remaining configured weights are renormalized visibly.",
] as const;
