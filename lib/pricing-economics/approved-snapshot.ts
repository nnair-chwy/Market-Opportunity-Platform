import approvedSnapshot from "../../data/approved/pricing-economics/current.json" with { type: "json" };
import { pricingEconomicsSnapshotSchema } from "./contracts.ts";

export function getApprovedPricingEconomicsSnapshot() {
  return pricingEconomicsSnapshotSchema.parse(approvedSnapshot);
}
